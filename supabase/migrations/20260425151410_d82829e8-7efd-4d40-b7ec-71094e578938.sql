-- ============================================================
-- 1) video_projects: colunas para upload no YouTube
-- ============================================================
ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS youtube_category_id INTEGER DEFAULT 22, -- 22 = People & Blogs
  ADD COLUMN IF NOT EXISTS privacy_status TEXT DEFAULT 'private'
    CHECK (privacy_status IN ('public', 'unlisted', 'private')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS upload_session_uri TEXT,
  ADD COLUMN IF NOT EXISTS upload_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_upload_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upload_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upload_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS made_for_kids BOOLEAN DEFAULT false;

-- Index para buscar projetos prontos para upload (rendered mas não publicado)
CREATE INDEX IF NOT EXISTS idx_video_projects_pending_upload
  ON public.video_projects (status, rendered_video_url)
  WHERE rendered_video_url IS NOT NULL AND youtube_video_id IS NULL;

-- Index para buscar projetos publicados por canal (analytics)
CREATE INDEX IF NOT EXISTS idx_video_projects_published
  ON public.video_projects (channel_id_ref, published_at DESC)
  WHERE published_at IS NOT NULL;

-- ============================================================
-- 2) user_channels: tokens OAuth do YouTube
-- ============================================================
ALTER TABLE public.user_channels
  ADD COLUMN IF NOT EXISTS youtube_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_access_token TEXT,
  ADD COLUMN IF NOT EXISTS youtube_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS youtube_oauth_scope TEXT,
  ADD COLUMN IF NOT EXISTS youtube_oauth_email TEXT,
  ADD COLUMN IF NOT EXISTS youtube_oauth_connected_at TIMESTAMPTZ;

-- ============================================================
-- 3) youtube_upload_attempts: histórico para auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS public.youtube_upload_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  worker_id TEXT,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started','session_created','uploading','completed','failed','quota_exceeded','token_expired','retrying')),
  bytes_uploaded BIGINT,
  total_bytes BIGINT,
  upload_session_uri TEXT,
  youtube_video_id TEXT,
  error_code TEXT,
  error_message TEXT,
  http_status INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yt_upload_attempts_project
  ON public.youtube_upload_attempts (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yt_upload_attempts_status
  ON public.youtube_upload_attempts (status, created_at DESC)
  WHERE status IN ('failed','quota_exceeded');

ALTER TABLE public.youtube_upload_attempts ENABLE ROW LEVEL SECURITY;

-- Dono do projeto pode ver suas tentativas
CREATE POLICY "Users can view their own upload attempts"
  ON public.youtube_upload_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.video_projects vp
      WHERE vp.id = project_id AND vp.user_id = auth.uid()
    )
  );

-- Service role (edge function/worker) gerencia tudo
CREATE POLICY "Service role manages upload attempts"
  ON public.youtube_upload_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 4) RPC: buscar próximo projeto pronto para upload
-- (alternativa ao claim_next_project para workers só de upload)
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
BEGIN
  SELECT vp.*
    INTO _project
    FROM public.video_projects vp
   WHERE vp.rendered_video_url IS NOT NULL
     AND vp.youtube_video_id IS NULL
     AND vp.status IN ('rendered','upload_failed','claimed')
     AND COALESCE(vp.upload_attempts, 0) < 5
     AND (vp.next_retry_at IS NULL OR vp.next_retry_at <= now())
     AND (vp.worker_id IS NULL OR vp.claim_expires_at < now())
   ORDER BY vp.upload_attempts ASC, vp.scheduled_at ASC NULLS LAST, vp.created_at ASC
   LIMIT 1
   FOR UPDATE OF vp SKIP LOCKED;

  IF _project IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _channel FROM public.user_channels WHERE id = _project.channel_id_ref;

  UPDATE public.video_projects
     SET worker_id = _worker_id,
         claimed_at = now(),
         claim_expires_at = now() + (_lease_minutes || ' minutes')::interval,
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
      'claim_expires_at', now() + (_lease_minutes || ' minutes')::interval
    ),
    'channel', CASE WHEN _channel IS NOT NULL THEN jsonb_build_object(
      'id', _channel.id,
      'youtube_channel_id', _channel.youtube_channel_id,
      'youtube_refresh_token', _channel.youtube_refresh_token,
      'youtube_access_token', _channel.youtube_access_token,
      'youtube_token_expires_at', _channel.youtube_token_expires_at,
      'language', _channel.language
    ) ELSE NULL END
  );
END;
$$;