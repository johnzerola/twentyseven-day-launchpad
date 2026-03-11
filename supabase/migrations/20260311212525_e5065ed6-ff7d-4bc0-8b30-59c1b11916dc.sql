
-- Research cache for Brave/YouTube search results
CREATE TABLE public.research_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  source text NOT NULL DEFAULT 'youtube',
  result_json jsonb NOT NULL DEFAULT '{}',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cache_key, source)
);

CREATE INDEX idx_research_cache_key ON public.research_cache(cache_key);
CREATE INDEX idx_research_cache_expires ON public.research_cache(expires_at);

ALTER TABLE public.research_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read cache"
  ON public.research_cache FOR SELECT TO authenticated
  USING (true);

-- Viral content library (replaces static viralDatabase.ts)
CREATE TABLE public.viral_content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'hook', 'cta', 'title_pattern', 'story_structure', 'seo_keyword'
  content_json jsonb NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'pt',
  effectiveness_score integer DEFAULT 7,
  niches text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_viral_content_category ON public.viral_content_library(category);
CREATE INDEX idx_viral_content_language ON public.viral_content_library(language);

ALTER TABLE public.viral_content_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read viral content"
  ON public.viral_content_library FOR SELECT TO authenticated
  USING (true);
