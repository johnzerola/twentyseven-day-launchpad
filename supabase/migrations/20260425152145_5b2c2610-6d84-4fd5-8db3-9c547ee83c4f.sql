-- ============================================================
-- 1) channel_locks: 1 lock por canal, com TTL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.channel_locks (
  channel_id UUID PRIMARY KEY REFERENCES public.user_channels(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  project_id UUID REFERENCES public.video_projects(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'render', -- 'render' | 'upload' | 'edit'
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_locks_expires
  ON public.channel_locks (expires_at);

CREATE INDEX IF NOT EXISTS idx_channel_locks_worker
  ON public.channel_locks (worker_id);

ALTER TABLE public.channel_locks ENABLE ROW LEVEL SECURITY;

-- Apenas service role gerencia (nenhum cliente direto)
CREATE POLICY "Service role manages channel locks"
  ON public.channel_locks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Dono do canal pode visualizar (pra mostrar "canal X está renderizando" no dashboard)
CREATE POLICY "Users can view locks on their own channels"
  ON public.channel_locks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_channels uc
      WHERE uc.id = channel_id AND uc.user_id = auth.uid()
    )
  );

-- ============================================================
-- 2) claim_next_project — agora respeita o lock por canal
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_project(_worker_id text, _lease_minutes integer DEFAULT 180, _flow_account_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project record;
  _channel record;
  _today_count int;
  _lease_until timestamptz;
BEGIN
  _lease_until := now() + (_lease_minutes || ' minutes')::interval;

  -- Limpa locks expirados antes de procurar (rápido — só os afetados)
  DELETE FROM public.channel_locks WHERE expires_at < now();

  -- Pega próximo projeto cujo canal NÃO esteja travado por outro worker.
  -- LEFT JOIN em channel_locks + filtro: lock inexistente OU é meu OU expirou.
  SELECT vp.*
    INTO _project
    FROM public.video_projects vp
    LEFT JOIN public.user_channels uc ON uc.id = vp.channel_id_ref
    LEFT JOIN public.channel_locks cl ON cl.channel_id = vp.channel_id_ref
   WHERE vp.status IN ('ready_for_production', 'claimed')
     AND vp.scheduled_at IS NOT NULL
     AND vp.scheduled_at <= now()
     AND (vp.worker_id IS NULL OR vp.claim_expires_at < now())
     AND (vp.error_message IS NULL OR COALESCE(vp.retry_count, 0) < COALESCE(vp.max_retries, 3))
     AND (_flow_account_id IS NULL OR uc.flow_account_id = _flow_account_id)
     -- canal sem lock, ou lock meu, ou lock expirado
     AND (cl.channel_id IS NULL OR cl.worker_id = _worker_id OR cl.expires_at < now())
   ORDER BY
     COALESCE(uc.autopilot_enabled, false) DESC,
     vp.scheduled_at ASC,
     vp.created_at ASC
   LIMIT 1
   FOR UPDATE OF vp SKIP LOCKED;

  IF _project IS NULL THEN
    RETURN NULL;
  END IF;

  IF _project.channel_id_ref IS NOT NULL THEN
    SELECT * INTO _channel FROM public.user_channels WHERE id = _project.channel_id_ref;

    IF _channel.daily_render_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO _today_count
        FROM public.video_projects
       WHERE channel_id_ref = _project.channel_id_ref
         AND claimed_at >= now() - interval '24 hours';

      IF _today_count >= _channel.daily_render_limit THEN
        RETURN jsonb_build_object(
          'claimed', false,
          'reason', 'daily_render_limit_reached',
          'channel_id', _project.channel_id_ref,
          'limit', _channel.daily_render_limit,
          'used', _today_count
        );
      END IF;
    END IF;

    -- Adquire/renova o lock do canal ATOMICAMENTE com o claim do projeto.
    -- Se outro worker correu na frente entre o SELECT e o INSERT,
    -- a unique constraint do PK barra e levantamos exceção (rollback do claim).
    INSERT INTO public.channel_locks (channel_id, worker_id, project_id, stage, expires_at)
    VALUES (_project.channel_id_ref, _worker_id, _project.id, 'render', _lease_until)
    ON CONFLICT (channel_id) DO UPDATE
      SET worker_id = EXCLUDED.worker_id,
          project_id = EXCLUDED.project_id,
          stage = EXCLUDED.stage,
          expires_at = EXCLUDED.expires_at,
          heartbeat_at = now(),
          acquired_at = CASE
            WHEN public.channel_locks.worker_id = EXCLUDED.worker_id THEN public.channel_locks.acquired_at
            ELSE now()
          END
      WHERE public.channel_locks.worker_id = EXCLUDED.worker_id
         OR public.channel_locks.expires_at < now();

    -- Verifica se realmente pegamos o lock (UPDATE pode não ter rodado se outro worker o tem)
    PERFORM 1 FROM public.channel_locks
     WHERE channel_id = _project.channel_id_ref
       AND worker_id = _worker_id
       AND expires_at >= now();

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'claimed', false,
        'reason', 'channel_locked_by_other_worker',
        'channel_id', _project.channel_id_ref
      );
    END IF;
  END IF;

  UPDATE public.video_projects
     SET worker_id = _worker_id,
         claimed_at = now(),
         claim_expires_at = _lease_until,
         status = 'claimed',
         error_message = NULL,
         updated_at = now()
   WHERE id = _project.id;

  INSERT INTO public.project_events (project_id, worker_id, stage, status, message)
  VALUES (_project.id, _worker_id, 'claim', 'completed',
          format('Claimed by %s for %s minutes (channel locked)', _worker_id, _lease_minutes));

  RETURN jsonb_build_object(
    'claimed', true,
    'project', jsonb_build_object(
      'id', _project.id,
      'user_id', _project.user_id,
      'title', _project.title,
      'script', _project.script,
      'audio_url', _project.audio_url,
      'niche', _project.niche,
      'video_type', _project.video_type,
      'duration_seconds', _project.duration_seconds,
      'idempotency_key', _project.idempotency_key,
      'scheduled_at', _project.scheduled_at,
      'claim_expires_at', _lease_until,
      'intelligence_json', _project.intelligence_json,
      'retry_count', COALESCE(_project.retry_count, 0)
    ),
    'channel', CASE WHEN _channel IS NOT NULL THEN jsonb_build_object(
      'id', _channel.id,
      'channel_name', _channel.channel_name,
      'youtube_channel_id', _channel.youtube_channel_id,
      'language', _channel.language,
      'character_name', _channel.character_name,
      'character_bio', _channel.character_bio,
      'tts_voice_id', _channel.tts_voice_id,
      'tts_voice_style', _channel.tts_voice_style,
      'visual_style_prompt', _channel.visual_style_prompt,
      'flow_account_id', _channel.flow_account_id
    ) ELSE NULL END,
    'channel_lock', jsonb_build_object(
      'expires_at', _lease_until,
      'stage', 'render'
    ),
    'scenes', (
      SELECT jsonb_agg(s.*) FROM (
        SELECT id, sequence_order, duration_sec, tts_text, veo3_prompt,
               camera_movement, lighting, emotional_intent, style_tags,
               negative_prompt, character_ref, reference_image_url,
               media_url, video_clip_url
          FROM public.scenes
         WHERE project_id = _project.id
         ORDER BY sequence_order
      ) s
    )
  );
END;
$function$;

-- ============================================================
-- 3) claim_next_upload — também respeita lock por canal
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_upload(_worker_id TEXT, _lease_minutes INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
  _channel record;
  _lease_until timestamptz;
BEGIN
  _lease_until := now() + (_lease_minutes || ' minutes')::interval;

  DELETE FROM public.channel_locks WHERE expires_at < now();

  SELECT vp.*
    INTO _project
    FROM public.video_projects vp
    LEFT JOIN public.channel_locks cl ON cl.channel_id = vp.channel_id_ref
   WHERE vp.rendered_video_url IS NOT NULL
     AND vp.youtube_video_id IS NULL
     AND vp.status IN ('rendered','upload_failed','claimed')
     AND COALESCE(vp.upload_attempts, 0) < 5
     AND (vp.next_retry_at IS NULL OR vp.next_retry_at <= now())
     AND (vp.worker_id IS NULL OR vp.claim_expires_at < now())
     AND (cl.channel_id IS NULL OR cl.worker_id = _worker_id OR cl.expires_at < now())
   ORDER BY vp.upload_attempts ASC, vp.scheduled_at ASC NULLS LAST, vp.created_at ASC
   LIMIT 1
   FOR UPDATE OF vp SKIP LOCKED;

  IF _project IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _channel FROM public.user_channels WHERE id = _project.channel_id_ref;

  IF _project.channel_id_ref IS NOT NULL THEN
    INSERT INTO public.channel_locks (channel_id, worker_id, project_id, stage, expires_at)
    VALUES (_project.channel_id_ref, _worker_id, _project.id, 'upload', _lease_until)
    ON CONFLICT (channel_id) DO UPDATE
      SET worker_id = EXCLUDED.worker_id,
          project_id = EXCLUDED.project_id,
          stage = EXCLUDED.stage,
          expires_at = EXCLUDED.expires_at,
          heartbeat_at = now()
      WHERE public.channel_locks.worker_id = EXCLUDED.worker_id
         OR public.channel_locks.expires_at < now();

    PERFORM 1 FROM public.channel_locks
     WHERE channel_id = _project.channel_id_ref
       AND worker_id = _worker_id
       AND expires_at >= now();

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'claimed', false,
        'reason', 'channel_locked_by_other_worker',
        'channel_id', _project.channel_id_ref
      );
    END IF;
  END IF;

  UPDATE public.video_projects
     SET worker_id = _worker_id,
         claimed_at = now(),
         claim_expires_at = _lease_until,
         status = 'uploading',
         upload_started_at = COALESCE(upload_started_at, now()),
         updated_at = now()
   WHERE id = _project.id;

  RETURN jsonb_build_object(
    'claimed', true,
    'project', jsonb_build_object(
      'id', _project.id,
      'user_id', _project.user_id,
      'title', _project.title,
      'description', _project.description,
      'tags', _project.tags,
      'youtube_category_id', _project.youtube_category_id,
      'privacy_status', _project.privacy_status,
      'made_for_kids', _project.made_for_kids,
      'rendered_video_url', _project.rendered_video_url,
      'rendered_video_sha256', _project.rendered_video_sha256,
      'thumbnail_url', _project.thumbnail_url,
      'idempotency_key', _project.idempotency_key,
      'upload_session_uri', _project.upload_session_uri,
      'upload_attempts', COALESCE(_project.upload_attempts, 0),
      'claim_expires_at', _lease_until
    ),
    'channel', CASE WHEN _channel IS NOT NULL THEN jsonb_build_object(
      'id', _channel.id,
      'youtube_channel_id', _channel.youtube_channel_id,
      'youtube_refresh_token', _channel.youtube_refresh_token,
      'youtube_access_token', _channel.youtube_access_token,
      'youtube_token_expires_at', _channel.youtube_token_expires_at,
      'language', _channel.language
    ) ELSE NULL END,
    'channel_lock', jsonb_build_object(
      'expires_at', _lease_until,
      'stage', 'upload'
    )
  );
END;
$$;

-- ============================================================
-- 4) release_channel_lock — worker chama ao terminar (sucesso/falha)
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_channel_lock(_channel_id UUID, _worker_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.channel_locks
   WHERE channel_id = _channel_id
     AND worker_id = _worker_id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted > 0;
END;
$$;

-- ============================================================
-- 5) extend_channel_lock — heartbeat para renovar TTL
-- ============================================================
CREATE OR REPLACE FUNCTION public.extend_channel_lock(_channel_id UUID, _worker_id TEXT, _additional_minutes INTEGER DEFAULT 60)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated INTEGER;
BEGIN
  UPDATE public.channel_locks
     SET expires_at = GREATEST(expires_at, now() + (_additional_minutes || ' minutes')::interval),
         heartbeat_at = now()
   WHERE channel_id = _channel_id
     AND worker_id = _worker_id
     AND expires_at >= now();
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

-- ============================================================
-- 6) cleanup_expired_channel_locks — usado pelo cron recovery
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_channel_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.channel_locks WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;