ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS audio_url        TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message    TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;

CREATE INDEX IF NOT EXISTS idx_video_projects_status
  ON public.video_projects (status, created_at);