-- Add channel-level controls used by the claim function
ALTER TABLE public.user_channels
  ADD COLUMN IF NOT EXISTS flow_account_id text,
  ADD COLUMN IF NOT EXISTS daily_render_limit int;

-- ============================================================
-- claim_next_project
-- Atomically reserves the next renderable project for a worker.
-- Returns full payload (project + channel DNA + scenes) or NULL.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_project(
  _worker_id text,
  _lease_minutes int DEFAULT 180,
  _flow_account_id text DEFAULT NULL  -- worker can filter to a specific Flow.io account
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
  _channel record;
  _today_count int;
BEGIN
  -- Pick a candidate with row lock; skip rows other workers are touching.
  SELECT vp.*
    INTO _project
    FROM public.video_projects vp
    LEFT JOIN public.user_channels uc ON uc.id = vp.channel_id_ref
   WHERE vp.status IN ('ready_for_production', 'claimed')
     AND vp.scheduled_at IS NOT NULL
     AND vp.scheduled_at <= now()
     AND (vp.worker_id IS NULL OR vp.claim_expires_at < now())
     AND (vp.error_message IS NULL OR COALESCE(vp.retry_count, 0) < COALESCE(vp.max_retries, 3))
     AND (_flow_account_id IS NULL OR uc.flow_account_id = _flow_account_id)
   ORDER BY
     -- prioritize autopilot channels, then earliest scheduled, then oldest
     COALESCE(uc.autopilot_enabled, false) DESC,
     vp.scheduled_at ASC,
     vp.created_at ASC
   LIMIT 1
   FOR UPDATE OF vp SKIP LOCKED;

  IF _project IS NULL THEN
    RETURN NULL;
  END IF;

  -- Per-channel daily render cap (cost protection)
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
  END IF;

  -- Atomic claim
  UPDATE public.video_projects
     SET worker_id = _worker_id,
         claimed_at = now(),
         claim_expires_at = now() + (_lease_minutes || ' minutes')::interval,
         status = 'claimed',
         error_message = NULL,
         updated_at = now()
   WHERE id = _project.id;

  -- Log event
  INSERT INTO public.project_events (project_id, worker_id, stage, status, message)
  VALUES (_project.id, _worker_id, 'claim', 'completed',
          format('Claimed by %s for %s minutes', _worker_id, _lease_minutes));

  -- Build full payload for the worker (project + channel DNA + scenes)
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
      'claim_expires_at', now() + (_lease_minutes || ' minutes')::interval,
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
    'scenes', (
      SELECT jsonb_agg(s.*) FROM (
        SELECT id, scene_index, scene_duration_seconds, start_time, end_time,
               visual_prompt, narrative_text, camera_angle, mood
          FROM public.synced_scenes
         WHERE project_id = _project.id
         ORDER BY scene_index
      ) s
    )
  );
END;
$$;

-- Only the worker (via service role / edge function) can claim
REVOKE ALL ON FUNCTION public.claim_next_project(text, int, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_project(text, int, text) TO service_role;