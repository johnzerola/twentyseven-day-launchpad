-- 1) Resilience columns on youtube_oauth_tokens
ALTER TABLE public.youtube_oauth_tokens
  ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_oauth_error text;

-- 2) Observability: analytics_collector_runs
CREATE TABLE IF NOT EXISTS public.analytics_collector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  mode text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'cron',
  user_id uuid,
  channels_processed integer NOT NULL DEFAULT 0,
  videos_updated integer NOT NULL DEFAULT 0,
  videos_failed integer NOT NULL DEFAULT 0,
  videos_skipped integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ok boolean NOT NULL DEFAULT true
);

ALTER TABLE public.analytics_collector_runs ENABLE ROW LEVEL SECURITY;

-- Admins can read all runs
CREATE POLICY "admins_can_read_collector_runs"
ON public.analytics_collector_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can read runs that pertain to them (manual triggers with user_id)
CREATE POLICY "users_can_read_their_collector_runs"
ON public.analytics_collector_runs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No INSERT/UPDATE policies → only service-role can write

CREATE INDEX IF NOT EXISTS idx_collector_runs_started_at
  ON public.analytics_collector_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_collector_runs_user_started
  ON public.analytics_collector_runs (user_id, started_at DESC);

-- 3) Index for collector scaling on video_performance
CREATE INDEX IF NOT EXISTS idx_video_performance_user_last_checked
  ON public.video_performance (user_id, last_checked_at);

CREATE INDEX IF NOT EXISTS idx_video_performance_user_published
  ON public.video_performance (user_id, published_at DESC);