
-- 1. Script Skill Scores — track which techniques produce best scores per niche
CREATE TABLE public.script_skill_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  technique TEXT NOT NULL,
  niche TEXT NOT NULL,
  genre TEXT,
  avg_score NUMERIC DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  total_score_contribution NUMERIC DEFAULT 0,
  best_score NUMERIC DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, technique, niche)
);

-- RLS
ALTER TABLE public.script_skill_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skill scores"
  ON public.script_skill_scores
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add content_category to channel_intelligence for dark channel taxonomy
ALTER TABLE public.channel_intelligence 
  ADD COLUMN IF NOT EXISTS content_category TEXT DEFAULT 'general';

-- 3. Add niche_avg_score to track benchmark per niche
CREATE TABLE public.niche_score_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT NOT NULL UNIQUE,
  avg_score NUMERIC DEFAULT 0,
  total_scripts_scored INTEGER DEFAULT 0,
  min_passing_score NUMERIC DEFAULT 14,
  top_techniques TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.niche_score_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read niche benchmarks"
  ON public.niche_score_benchmarks
  FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_skill_scores_user_niche ON public.script_skill_scores(user_id, niche);
CREATE INDEX IF NOT EXISTS idx_channel_intel_category ON public.channel_intelligence(content_category);
