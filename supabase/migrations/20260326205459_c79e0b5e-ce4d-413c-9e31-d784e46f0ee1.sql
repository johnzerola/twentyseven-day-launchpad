
-- Composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_hook_library_niche_retention 
  ON public.hook_library (niche, retention_score DESC);

CREATE INDEX IF NOT EXISTS idx_dotti_suggestions_user_channel 
  ON public.dotti_suggestions (user_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_viral_titles_db_created_at 
  ON public.viral_titles_db (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viral_titles_db_niche_views 
  ON public.viral_titles_db (niche, views DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source 
  ON public.knowledge_embeddings (source_table, source_id);

CREATE INDEX IF NOT EXISTS idx_content_dna_niche_viral 
  ON public.content_dna (niche, viral_score DESC);

CREATE INDEX IF NOT EXISTS idx_channel_intelligence_niche 
  ON public.channel_intelligence (niche, avg_views DESC);
