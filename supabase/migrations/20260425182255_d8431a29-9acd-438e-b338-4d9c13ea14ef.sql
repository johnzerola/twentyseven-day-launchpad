-- ─── niche_reference_reports ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.niche_reference_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL,
  niche TEXT,
  language TEXT,
  week_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  videos_analyzed INTEGER NOT NULL DEFAULT 0,
  top_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  title_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  thumbnail_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_insights JSONB NOT NULL DEFAULT '{}'::jsonb,
  structure_insights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_summary TEXT,
  prompt_injection TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT niche_reference_reports_status_chk
    CHECK (status IN ('queued','running','done','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_niche_reference_reports_channel_week
  ON public.niche_reference_reports(channel_id, week_start);

CREATE INDEX IF NOT EXISTS idx_niche_reference_reports_user
  ON public.niche_reference_reports(user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_niche_reference_reports_status
  ON public.niche_reference_reports(status, created_at DESC);

ALTER TABLE public.niche_reference_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own reports" ON public.niche_reference_reports;
CREATE POLICY "Users read own reports"
  ON public.niche_reference_reports
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own reports" ON public.niche_reference_reports;
CREATE POLICY "Users manage own reports"
  ON public.niche_reference_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_niche_reference_reports_updated_at
  BEFORE UPDATE ON public.niche_reference_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();