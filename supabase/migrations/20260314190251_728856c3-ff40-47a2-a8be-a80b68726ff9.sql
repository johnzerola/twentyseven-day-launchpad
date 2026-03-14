
-- MOTOR 1: PREDICTION VS RESULT
CREATE TABLE IF NOT EXISTS public.prediction_vs_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.video_projects(id) ON DELETE SET NULL,
  video_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  predicted_viral_score numeric DEFAULT 0,
  predicted_retention numeric DEFAULT 0,
  predicted_ctr numeric DEFAULT 0,
  predicted_engagement numeric DEFAULT 0,
  predicted_attention_score numeric DEFAULT 0,
  predicted_dopamine_score numeric DEFAULT 0,
  real_views bigint DEFAULT 0,
  real_likes integer DEFAULT 0,
  real_comments integer DEFAULT 0,
  real_subscribers_at_publish integer DEFAULT 0,
  real_view_velocity numeric DEFAULT 0,
  real_ctr numeric,
  real_retention numeric,
  real_engagement_rate numeric DEFAULT 0,
  prediction_error_score numeric DEFAULT 0,
  error_breakdown jsonb DEFAULT '{}',
  niche text,
  hook_type text,
  title_pattern text,
  video_type text DEFAULT 'long',
  calibrated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.prediction_vs_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own predictions" ON public.prediction_vs_result FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_pvr_user ON public.prediction_vs_result(user_id);
CREATE INDEX idx_pvr_niche ON public.prediction_vs_result(niche);
CREATE INDEX idx_pvr_error ON public.prediction_vs_result(prediction_error_score DESC);

-- MOTOR 2: EMERGING VIDEOS
CREATE TABLE IF NOT EXISTS public.emerging_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL UNIQUE,
  channel_id text,
  channel_name text,
  title text NOT NULL,
  niche text DEFAULT 'general',
  views bigint DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  subscribers integer DEFAULT 0,
  views_per_hour numeric DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  growth_acceleration numeric DEFAULT 0,
  velocity_score numeric DEFAULT 0,
  pre_viral_score numeric DEFAULT 0,
  view_ratio numeric DEFAULT 0,
  recency_factor numeric DEFAULT 0,
  status text DEFAULT 'monitoring',
  detected_at timestamp with time zone DEFAULT now(),
  confirmed_viral_at timestamp with time zone,
  peak_views bigint DEFAULT 0,
  snapshots_count integer DEFAULT 0,
  thumbnail_url text,
  published_at timestamp with time zone,
  duration_seconds integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.emerging_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read emerging_videos" ON public.emerging_videos FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_emerging_score ON public.emerging_videos(pre_viral_score DESC);
CREATE INDEX idx_emerging_status ON public.emerging_videos(status);
CREATE INDEX idx_emerging_niche ON public.emerging_videos(niche);

-- VELOCITY & PRE-VIRAL SCORE FUNCTIONS
CREATE OR REPLACE FUNCTION public.calculate_velocity_score(_views_per_hour numeric, _engagement_rate numeric, _growth_acceleration numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT ROUND((LEAST(_views_per_hour / 100.0, 100) * 0.5) + (LEAST(_engagement_rate * 100, 100) * 0.3) + (LEAST(_growth_acceleration, 100) * 0.2), 2) $$;

CREATE OR REPLACE FUNCTION public.calculate_pre_viral_score(_view_ratio numeric, _velocity_score numeric, _engagement_rate numeric, _recency_factor numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT ROUND((LEAST(_view_ratio, 100) * 0.4) + (LEAST(_velocity_score, 100) * 0.3) + (LEAST(_engagement_rate * 100, 100) * 0.2) + (LEAST(_recency_factor, 100) * 0.1), 2) $$;

-- CHANNEL VOICE - add missing columns
ALTER TABLE public.channel_voice_profiles ADD COLUMN IF NOT EXISTS common_hooks text[] DEFAULT '{}';
ALTER TABLE public.channel_voice_profiles ADD COLUMN IF NOT EXISTS visual_style text DEFAULT '';
ALTER TABLE public.channel_voice_profiles ADD COLUMN IF NOT EXISTS story_structure text DEFAULT '';
ALTER TABLE public.channel_voice_profiles ADD COLUMN IF NOT EXISTS average_video_length integer DEFAULT 0;

-- ADDITIONAL INDEXES
CREATE INDEX IF NOT EXISTS idx_velocity_snapshots_video ON public.velocity_snapshots(video_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_snapshots_trend ON public.velocity_snapshots(velocity_trend);
CREATE INDEX IF NOT EXISTS idx_video_perf_predicted ON public.video_performance(predicted_viral_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_video_perf_backtested ON public.video_performance(backtested_at NULLS FIRST);

-- SCORE CALIBRATION TABLE
CREATE TABLE IF NOT EXISTS public.score_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type text NOT NULL,
  niche text DEFAULT 'general',
  weight_adjustment numeric DEFAULT 1.0,
  bias_correction numeric DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  samples_count integer DEFAULT 0,
  avg_error numeric DEFAULT 0,
  last_calibrated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(score_type, niche)
);
ALTER TABLE public.score_calibration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read score_calibration" ON public.score_calibration FOR SELECT TO authenticated USING (true);

-- MATERIALIZED VIEWS
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_top_hooks_by_niche AS SELECT niche, hook_type, hook_text, retention_score, source_video FROM public.hook_library WHERE retention_score >= 7 ORDER BY niche, retention_score DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_top_titles_by_views AS SELECT title, views, niche, title_pattern, emotional_triggers, channel_name FROM public.viral_titles_db ORDER BY views DESC LIMIT 500;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_avg_scores_by_niche AS SELECT niche, COUNT(*) as total_videos, ROUND(AVG(viral_score)::numeric, 2) as avg_viral_score, ROUND(AVG(attention_score)::numeric, 2) as avg_attention_score, ROUND(AVG(dopamine_score)::numeric, 2) as avg_dopamine_score, ROUND(AVG(estimated_retention)::numeric, 2) as avg_retention, ROUND(AVG(gold_score)::numeric, 2) as avg_gold_score, ROUND(AVG(multiplier)::numeric, 2) as avg_multiplier FROM public.content_dna WHERE niche IS NOT NULL GROUP BY niche HAVING COUNT(*) >= 3;

-- REFRESH FUNCTION
CREATE OR REPLACE FUNCTION public.refresh_materialized_views() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN REFRESH MATERIALIZED VIEW public.mv_top_hooks_by_niche; REFRESH MATERIALIZED VIEW public.mv_top_titles_by_views; REFRESH MATERIALIZED VIEW public.mv_avg_scores_by_niche; END; $$;
