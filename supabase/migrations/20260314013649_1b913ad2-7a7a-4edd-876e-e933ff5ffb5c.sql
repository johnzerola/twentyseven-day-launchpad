
-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 1: Velocity Tracking (snapshots for growth measurement)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.velocity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  channel_id text,
  niche text DEFAULT 'general',
  views bigint DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  subscribers integer DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  views_per_hour numeric DEFAULT 0,
  velocity_trend text DEFAULT 'stable',
  source text DEFAULT 'auto'
);

ALTER TABLE public.velocity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read velocity" ON public.velocity_snapshots FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_velocity_video ON public.velocity_snapshots(video_id, snapshot_at DESC);
CREATE INDEX idx_velocity_niche ON public.velocity_snapshots(niche, snapshot_at DESC);

-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 5: Performance indexes for existing tables
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_content_dna_niche_score ON public.content_dna(niche, viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_dna_hook_type ON public.content_dna(hook_type);
CREATE INDEX IF NOT EXISTS idx_viral_titles_niche_views ON public.viral_titles_db(niche, views DESC);
CREATE INDEX IF NOT EXISTS idx_hook_library_score ON public.hook_library(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_hook_library_niche ON public.hook_library(niche);
CREATE INDEX IF NOT EXISTS idx_channel_intel_niche ON public.channel_intelligence(niche, avg_views DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_embed_source ON public.knowledge_embeddings(source_table);
CREATE INDEX IF NOT EXISTS idx_execution_logs_fn ON public.execution_logs(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_source ON public.ai_learning(source, created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 6: Niche Velocity Index (time-series tracking)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.niche_velocity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_channels integer DEFAULT 0,
  new_channels_30d integer DEFAULT 0,
  avg_views_per_video bigint DEFAULT 0,
  top_video_views bigint DEFAULT 0,
  total_videos_30d integer DEFAULT 0,
  growth_velocity numeric DEFAULT 0,
  saturation_score numeric DEFAULT 0,
  opportunity_window text DEFAULT 'unknown',
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(niche, snapshot_date)
);

ALTER TABLE public.niche_velocity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read niche_velocity" ON public.niche_velocity FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_niche_vel_niche ON public.niche_velocity(niche, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 3: Channel Voice Learning 
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.channel_voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid,
  voice_signature jsonb DEFAULT '{}'::jsonb,
  tone_keywords text[] DEFAULT '{}',
  avg_sentence_length numeric DEFAULT 0,
  vocabulary_richness numeric DEFAULT 0,
  style_markers text[] DEFAULT '{}',
  sample_scripts_analyzed integer DEFAULT 0,
  last_analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE public.channel_voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own voice profiles" ON public.channel_voice_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 10: Case Study Mode
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_name text NOT NULL,
  niche text,
  start_date date,
  end_date date,
  initial_subscribers integer DEFAULT 0,
  final_subscribers integer DEFAULT 0,
  total_views bigint DEFAULT 0,
  total_videos integer DEFAULT 0,
  total_shorts integer DEFAULT 0,
  revenue_estimate numeric DEFAULT 0,
  monetized_at date,
  days_to_monetization integer,
  strategy_used text,
  tools_used text[] DEFAULT '{}',
  milestones jsonb DEFAULT '[]'::jsonb,
  lessons_learned text[] DEFAULT '{}',
  screenshots jsonb DEFAULT '[]'::jsonb,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own case studies" ON public.case_studies FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public case studies readable" ON public.case_studies FOR SELECT TO authenticated USING (is_public = true);

-- ═══════════════════════════════════════════════════════════
-- IMPROVEMENT 2: Backtesting - add prediction tracking columns
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS predicted_viral_score numeric DEFAULT 0;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS predicted_attention_score numeric DEFAULT 0;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS prediction_accuracy numeric;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS backtested_at timestamptz;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS script_id uuid;
