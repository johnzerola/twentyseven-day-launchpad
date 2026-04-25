ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public.channel_schedule
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_video_projects_retry
  ON public.video_projects (status, next_retry_at)
  WHERE error_message IS NOT NULL;