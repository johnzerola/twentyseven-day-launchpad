
-- Knowledge Database: YouTube Algorithm & Strategy
CREATE TABLE public.youtube_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  source text,
  priority integer DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Knowledge Database: Script Writing Techniques
CREATE TABLE public.script_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  examples jsonb DEFAULT '[]'::jsonb,
  effectiveness_score integer DEFAULT 7,
  created_at timestamptz DEFAULT now()
);

-- Knowledge Database: Scene Prompts & Cinematography
CREATE TABLE public.scene_prompt_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  prompt_template text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  viral_score integer DEFAULT 7,
  created_at timestamptz DEFAULT now()
);

-- RLS: Public read for all authenticated users (knowledge is shared)
ALTER TABLE public.youtube_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_prompt_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read youtube_knowledge" ON public.youtube_knowledge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read script_knowledge" ON public.script_knowledge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read scene_prompt_knowledge" ON public.scene_prompt_knowledge FOR SELECT TO authenticated USING (true);
