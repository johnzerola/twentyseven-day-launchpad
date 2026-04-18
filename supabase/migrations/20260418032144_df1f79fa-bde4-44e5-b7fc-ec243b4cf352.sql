
-- Helper for updated_at (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. user_ctr_patterns
CREATE TABLE public.user_ctr_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  niche text NOT NULL DEFAULT 'general',
  winning_patterns jsonb DEFAULT '[]'::jsonb,
  losing_patterns jsonb DEFAULT '[]'::jsonb,
  best_openers jsonb DEFAULT '[]'::jsonb,
  niche_power_words jsonb DEFAULT '[]'::jsonb,
  optimal_length integer,
  data_points integer DEFAULT 0,
  avg_ctr numeric,
  top_ctr numeric,
  last_analysis_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, niche)
);
CREATE INDEX idx_user_ctr_patterns_user_niche ON public.user_ctr_patterns(user_id, niche);
ALTER TABLE public.user_ctr_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ctr patterns" ON public.user_ctr_patterns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ctr patterns" ON public.user_ctr_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ctr patterns" ON public.user_ctr_patterns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ctr patterns" ON public.user_ctr_patterns FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages ctr patterns" ON public.user_ctr_patterns FOR ALL USING (auth.role() = 'service_role');
CREATE TRIGGER trg_user_ctr_patterns_updated BEFORE UPDATE ON public.user_ctr_patterns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. hook_performance_real
CREATE TABLE public.hook_performance_real (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  youtube_video_id text NOT NULL,
  script_id uuid,
  hook_type text,
  hook_text text,
  retention_30s numeric,
  retention_60s numeric,
  avg_retention numeric,
  views integer,
  niche text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, youtube_video_id)
);
CREATE INDEX idx_hook_perf_user_niche ON public.hook_performance_real(user_id, niche);
CREATE INDEX idx_hook_perf_user_type ON public.hook_performance_real(user_id, hook_type);
ALTER TABLE public.hook_performance_real ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own hook perf" ON public.hook_performance_real FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own hook perf" ON public.hook_performance_real FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own hook perf" ON public.hook_performance_real FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own hook perf" ON public.hook_performance_real FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages hook perf" ON public.hook_performance_real FOR ALL USING (auth.role() = 'service_role');

-- 3. chosen_thumbnails
CREATE TABLE public.chosen_thumbnails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid,
  variant_index integer,
  variant_data jsonb DEFAULT '{}'::jsonb,
  style_summary text,
  thumbnail_url text,
  youtube_video_id text,
  ctr_actual numeric,
  niche text,
  chosen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chosen_thumbs_user ON public.chosen_thumbnails(user_id);
CREATE INDEX idx_chosen_thumbs_script ON public.chosen_thumbnails(script_id);
ALTER TABLE public.chosen_thumbnails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chosen thumbs" ON public.chosen_thumbnails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chosen thumbs" ON public.chosen_thumbnails FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chosen thumbs" ON public.chosen_thumbnails FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chosen thumbs" ON public.chosen_thumbnails FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages chosen thumbs" ON public.chosen_thumbnails FOR ALL USING (auth.role() = 'service_role');
CREATE TRIGGER trg_chosen_thumbnails_updated BEFORE UPDATE ON public.chosen_thumbnails FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
