
CREATE TABLE public.viral_titles_db (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  channel_name TEXT,
  channel_id TEXT,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT DEFAULT 0,
  niche TEXT,
  language TEXT DEFAULT 'en',
  country TEXT DEFAULT 'US',
  duration_seconds INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE,
  why_viral TEXT,
  title_pattern TEXT,
  emotional_triggers TEXT[],
  seo_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.viral_titles_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read viral_titles_db"
  ON public.viral_titles_db
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_viral_titles_niche ON public.viral_titles_db (niche);
CREATE INDEX idx_viral_titles_views ON public.viral_titles_db (views DESC);
