
CREATE TABLE public.prompt_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  style TEXT,
  tags TEXT[] DEFAULT '{}',
  scene_type TEXT,
  word_count INT,
  quality_score NUMERIC,
  video_style TEXT,
  project_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prompts" ON public.prompt_library
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_prompt_library_user ON public.prompt_library(user_id, created_at DESC);
CREATE INDEX idx_prompt_library_style ON public.prompt_library(video_style, style);
