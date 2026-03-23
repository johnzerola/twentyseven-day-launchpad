
-- ═══ PILAR 1: Performance Indexes ═══
-- Indexes for generate-script parallel queries
CREATE INDEX IF NOT EXISTS idx_script_knowledge_eff_score ON public.script_knowledge(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_hook_library_ret_score ON public.hook_library(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_titles_views ON public.viral_titles_db(views DESC);
CREATE INDEX IF NOT EXISTS idx_attention_eng_impact ON public.attention_engineering(retention_impact DESC);
CREATE INDEX IF NOT EXISTS idx_attention_lib_score ON public.attention_library(attention_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_content_cat_score ON public.viral_content_library(category, effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_channel_intel_faceless ON public.channel_intelligence(is_faceless, avg_views DESC);
CREATE INDEX IF NOT EXISTS idx_psych_patterns_ret ON public.audience_psychology_patterns(retention_score DESC);

-- Auto-learn deduplication indexes
CREATE INDEX IF NOT EXISTS idx_script_knowledge_title ON public.script_knowledge(title);
CREATE INDEX IF NOT EXISTS idx_video_blueprints_vid ON public.video_blueprints(video_id);
CREATE INDEX IF NOT EXISTS idx_scene_prompt_title ON public.scene_prompt_knowledge(title);

-- Cache cleanup index
CREATE INDEX IF NOT EXISTS idx_research_cache_expires ON public.research_cache(expires_at);

-- Execution logs for throttling queries
CREATE INDEX IF NOT EXISTS idx_exec_logs_fn_date ON public.execution_logs(function_name, created_at DESC);

-- Knowledge embeddings for RAG
CREATE INDEX IF NOT EXISTS idx_knowledge_emb_source ON public.knowledge_embeddings(source_table, source_id);

-- ═══ PILAR 5: Processing Jobs Table (Async Pipeline) ═══
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL DEFAULT 'deep_scan',
  status text NOT NULL DEFAULT 'queued',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb DEFAULT NULL,
  progress integer DEFAULT 0,
  current_step text DEFAULT NULL,
  error_message text DEFAULT NULL,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz DEFAULT NULL,
  completed_at timestamptz DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own jobs" ON public.processing_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON public.processing_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user ON public.processing_jobs(user_id, created_at DESC);

-- Enable realtime for job progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_jobs;
