
-- ═══════════════════════════════════════════════════════════
-- VIRAL LONG-FORM ENGINE: Missing indexes + reverse_engineering table
-- ═══════════════════════════════════════════════════════════

-- 1) REVERSE ENGINEERING ANALYSES TABLE
CREATE TABLE IF NOT EXISTS public.reverse_engineering_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  video_title text NOT NULL DEFAULT '',
  channel_id text,
  channel_name text,
  niche text DEFAULT 'general',
  language text DEFAULT 'pt',
  views bigint DEFAULT 0,
  subscribers bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  hook_analysis jsonb DEFAULT '{}'::jsonb,
  retention_curve jsonb DEFAULT '[]'::jsonb,
  narrative_structure jsonb DEFAULT '{}'::jsonb,
  scene_structure jsonb DEFAULT '[]'::jsonb,
  psychological_triggers text[] DEFAULT '{}'::text[],
  pacing_analysis jsonb DEFAULT '{}'::jsonb,
  clone_template jsonb DEFAULT '{}'::jsonb,
  viral_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  monetization_score numeric DEFAULT 0,
  analyzed_by text DEFAULT 'ensemble',
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reverse_engineering_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reverse_engineering"
  ON public.reverse_engineering_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) PERFORMANCE INDEXES on existing tables
CREATE INDEX IF NOT EXISTS idx_research_cache_key_expires ON public.research_cache (cache_key, expires_at);
CREATE INDEX IF NOT EXISTS idx_task_queue_status_scheduled ON public.task_queue (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scenes_project_order ON public.scenes (project_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_hook_library_niche_score ON public.hook_library (niche, retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_titles_niche_views ON public.viral_titles_db (niche, views DESC);
CREATE INDEX IF NOT EXISTS idx_video_projects_user_status ON public.video_projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_function_time ON public.execution_logs (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emerging_channels_niche_score ON public.emerging_channels (niche, viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_queue_user_status ON public.content_queue (user_id, status);
CREATE INDEX IF NOT EXISTS idx_channel_intelligence_niche ON public.channel_intelligence (niche, avg_views DESC);
CREATE INDEX IF NOT EXISTS idx_reverse_eng_niche_score ON public.reverse_engineering_analyses (niche, viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_reverse_eng_user ON public.reverse_engineering_analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_video_blueprints_niche ON public.video_blueprints (niche, views DESC);
CREATE INDEX IF NOT EXISTS idx_characters_project ON public.characters (project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_scene ON public.prompts (scene_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_name_date ON public.api_usage (api_name, date);
