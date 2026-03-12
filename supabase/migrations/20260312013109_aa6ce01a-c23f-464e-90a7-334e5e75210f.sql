
CREATE TABLE public.audience_psychology_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  example_titles TEXT[] DEFAULT '{}',
  example_hooks TEXT[] DEFAULT '{}',
  storytelling_pattern TEXT,
  retention_score INTEGER DEFAULT 7,
  niches TEXT[] DEFAULT '{}',
  source TEXT DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audience_psychology_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read audience_psychology_patterns"
  ON public.audience_psychology_patterns FOR SELECT
  TO authenticated USING (true);
