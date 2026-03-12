
-- 1. Script Structures Library (padrões de estrutura de roteiro)
CREATE TABLE public.script_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_name TEXT NOT NULL,
  niche TEXT DEFAULT 'general',
  intro_pattern TEXT NOT NULL DEFAULT '',
  middle_pattern TEXT NOT NULL DEFAULT '',
  cliffhanger_pattern TEXT NOT NULL DEFAULT '',
  ending_pattern TEXT NOT NULL DEFAULT '',
  segments JSONB DEFAULT '[]'::jsonb,
  avg_retention NUMERIC DEFAULT 0,
  effectiveness_score INTEGER DEFAULT 7,
  examples JSONB DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Micro Niches Library
CREATE TABLE public.micro_niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT NOT NULL,
  micro_niche TEXT NOT NULL,
  competition TEXT DEFAULT 'medium',
  growth_rate TEXT DEFAULT 'steady',
  avg_views BIGINT DEFAULT 0,
  monetization_score NUMERIC DEFAULT 5,
  faceless_friendly BOOLEAN DEFAULT true,
  trend_direction TEXT DEFAULT 'stable',
  example_channels JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(niche, micro_niche)
);

-- 3. YouTube Keywords SEO Library
CREATE TABLE public.youtube_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  niche TEXT DEFAULT 'general',
  language TEXT DEFAULT 'en',
  search_volume TEXT DEFAULT 'medium',
  competition TEXT DEFAULT 'medium',
  ctr_estimate NUMERIC DEFAULT 5,
  trend TEXT DEFAULT 'stable',
  related_keywords JSONB DEFAULT '[]'::jsonb,
  best_title_patterns JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(keyword, language)
);

-- 4. Thumbnail Patterns Library (padrões, não por vídeo)
CREATE TABLE public.thumbnail_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL,
  thumbnail_type TEXT NOT NULL DEFAULT 'standard',
  faces_required BOOLEAN DEFAULT false,
  emotion TEXT DEFAULT 'neutral',
  color_scheme JSONB DEFAULT '[]'::jsonb,
  text_overlay_style TEXT DEFAULT 'none',
  composition_rules JSONB DEFAULT '{}'::jsonb,
  ctr_average NUMERIC DEFAULT 8,
  niche TEXT DEFAULT 'general',
  examples JSONB DEFAULT '[]'::jsonb,
  effectiveness_score INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Attention Engineering Library (arma secreta)
CREATE TABLE public.attention_engineering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'retention',
  trigger_second NUMERIC DEFAULT 0,
  duration_window_sec NUMERIC DEFAULT 5,
  technique TEXT NOT NULL DEFAULT '',
  psychological_basis TEXT DEFAULT '',
  retention_impact NUMERIC DEFAULT 0,
  examples JSONB DEFAULT '[]'::jsonb,
  applicable_niches JSONB DEFAULT '[]'::jsonb,
  intensity_level INTEGER DEFAULT 5,
  source TEXT DEFAULT 'research',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: All readable by authenticated users
ALTER TABLE public.script_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thumbnail_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_engineering ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read script_structures" ON public.script_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read micro_niches" ON public.micro_niches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read youtube_keywords" ON public.youtube_keywords FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read thumbnail_patterns" ON public.thumbnail_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read attention_engineering" ON public.attention_engineering FOR SELECT TO authenticated USING (true);
