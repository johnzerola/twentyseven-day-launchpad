
-- 1) Nova tabela: ai_learning
CREATE TABLE IF NOT EXISTS public.ai_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text,
  insight text,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai_learning"
  ON public.ai_learning FOR SELECT TO authenticated
  USING (true);

-- 2) Colunas faltantes em tabelas existentes
ALTER TABLE public.viral_patterns ADD COLUMN IF NOT EXISTS source_video text;
ALTER TABLE public.hook_library ADD COLUMN IF NOT EXISTS source_video text;

-- 3) Índices do schema que ainda não existem
CREATE INDEX IF NOT EXISTS idx_emerging_channels_channel_id ON public.emerging_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_niche ON public.viral_patterns(niche);
CREATE INDEX IF NOT EXISTS idx_research_cache_query ON public.research_cache(query);
CREATE INDEX IF NOT EXISTS idx_scenes_video_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON public.task_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_learning_topic ON public.ai_learning(topic);
