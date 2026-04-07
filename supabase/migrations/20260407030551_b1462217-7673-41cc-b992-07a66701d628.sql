-- Channel Intelligence: impact tier
ALTER TABLE public.channel_intelligence 
ADD COLUMN IF NOT EXISTS impact_tier TEXT DEFAULT 'C';

-- Content DNA: quality tier
ALTER TABLE public.content_dna 
ADD COLUMN IF NOT EXISTS quality_tier TEXT DEFAULT 'unverified';

-- Viral Titles DB: impact score
ALTER TABLE public.viral_titles_db 
ADD COLUMN IF NOT EXISTS impact_score INTEGER DEFAULT 0;

-- Indexes for tier-based queries
CREATE INDEX IF NOT EXISTS idx_channel_intelligence_impact 
ON public.channel_intelligence (impact_tier, niche);

CREATE INDEX IF NOT EXISTS idx_content_dna_quality 
ON public.content_dna (quality_tier, niche);

CREATE INDEX IF NOT EXISTS idx_viral_titles_impact 
ON public.viral_titles_db (impact_score DESC);

-- Populate impact_tier for existing channels
UPDATE public.channel_intelligence SET impact_tier = 
  CASE 
    WHEN subscribers >= 10000000 THEN 'S'
    WHEN subscribers >= 1000000 THEN 'A'
    WHEN subscribers >= 100000 THEN 'B'
    WHEN subscribers >= 10000 THEN 'C'
    ELSE 'F'
  END;

-- Populate quality_tier for content_dna
UPDATE public.content_dna SET quality_tier = 
  CASE
    WHEN source = 'youtube_api' OR source = 'oauth_sync' THEN 'gold'
    WHEN source = 'gemini_analysis' AND views > 100000 THEN 'silver'
    WHEN views > 10000 THEN 'bronze'
    ELSE 'unverified'
  END;

-- Populate impact_score for viral_titles
UPDATE public.viral_titles_db SET impact_score = 
  CASE
    WHEN views >= 10000000 THEN 95
    WHEN views >= 1000000 THEN 80
    WHEN views >= 100000 THEN 60
    WHEN views >= 10000 THEN 40
    WHEN views >= 1000 THEN 20
    ELSE 5
  END;