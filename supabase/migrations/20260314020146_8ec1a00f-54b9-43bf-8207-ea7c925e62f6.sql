-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_performance_user_grade 
  ON public.video_performance(user_id, performance_grade);

CREATE INDEX IF NOT EXISTS idx_video_performance_last_checked 
  ON public.video_performance(last_checked_at ASC);

CREATE INDEX IF NOT EXISTS idx_title_rankings_video_keyword 
  ON public.title_rankings(video_performance_id, keyword, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_source 
  ON public.ai_learning(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_source 
  ON public.knowledge_embeddings(source_table, source_id);
