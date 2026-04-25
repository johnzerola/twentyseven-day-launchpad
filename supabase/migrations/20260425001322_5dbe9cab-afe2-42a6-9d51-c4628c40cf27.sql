-- Add missing columns to existing video_performance table
ALTER TABLE public.video_performance
  ADD COLUMN IF NOT EXISTS channel_id          UUID,
  ADD COLUMN IF NOT EXISTS views               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctr                 NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_view_duration_s INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscriber_gain     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_score   NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virality_score      NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_score     NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic               TEXT,
  ADD COLUMN IF NOT EXISTS video_type          TEXT,
  ADD COLUMN IF NOT EXISTS content_tags        TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS learning_notes      TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sync_count          INTEGER DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.video_performance
    ADD CONSTRAINT video_performance_channel_id_fkey
    FOREIGN KEY (channel_id) REFERENCES public.user_channels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.video_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_performance_select" ON public.video_performance;
DROP POLICY IF EXISTS "user_own_performance_insert" ON public.video_performance;
DROP POLICY IF EXISTS "user_own_performance_update" ON public.video_performance;
DROP POLICY IF EXISTS "user_own_performance_delete" ON public.video_performance;
CREATE POLICY "user_own_performance_select" ON public.video_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_own_performance_insert" ON public.video_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_own_performance_update" ON public.video_performance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_own_performance_delete" ON public.video_performance FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.channel_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_own_schedule_select" ON public.channel_schedule;
DROP POLICY IF EXISTS "user_own_schedule_insert" ON public.channel_schedule;
DROP POLICY IF EXISTS "user_own_schedule_update" ON public.channel_schedule;
DROP POLICY IF EXISTS "user_own_schedule_delete" ON public.channel_schedule;
CREATE POLICY "user_own_schedule_select" ON public.channel_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_own_schedule_insert" ON public.channel_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_own_schedule_update" ON public.channel_schedule FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_own_schedule_delete" ON public.channel_schedule FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_performance_channel ON public.video_performance(channel_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_performance_user ON public.video_performance(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_schedule_user_at ON public.channel_schedule(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_channel_schedule_channel ON public.channel_schedule(channel_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_video_projects_channel_ref ON public.video_projects(channel_id_ref);