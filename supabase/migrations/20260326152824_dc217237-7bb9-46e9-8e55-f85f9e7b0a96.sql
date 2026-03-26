
-- Índices compostos para performance
CREATE INDEX IF NOT EXISTS idx_dotti_suggestions_user_channel ON dotti_suggestions(user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_viral_titles_db_created ON viral_titles_db(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_titles_db_niche_country ON viral_titles_db(niche, country);
CREATE INDEX IF NOT EXISTS idx_channel_intelligence_category ON channel_intelligence(content_category);
CREATE INDEX IF NOT EXISTS idx_channel_intelligence_category_niche ON channel_intelligence(content_category, niche);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source ON knowledge_embeddings(source_table, source_id);

-- Tabela para memória de preferências entre projetos
CREATE TABLE IF NOT EXISTS public.user_script_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  niche TEXT NOT NULL DEFAULT 'general',
  preferred_pov TEXT DEFAULT NULL,
  preferred_duration_min INTEGER DEFAULT NULL,
  preferred_style TEXT DEFAULT NULL,
  best_hook_types TEXT[] DEFAULT '{}',
  avg_score_achieved NUMERIC DEFAULT 0,
  total_scripts_generated INTEGER DEFAULT 0,
  top_performing_patterns JSONB DEFAULT '[]',
  voice_notes TEXT DEFAULT '',
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, niche)
);

ALTER TABLE public.user_script_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own script preferences"
  ON public.user_script_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
