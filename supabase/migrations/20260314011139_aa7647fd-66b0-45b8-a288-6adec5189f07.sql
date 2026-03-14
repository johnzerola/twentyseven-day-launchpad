
-- ═══════════════════════════════════════════════════════════
-- 1. VIDEO PERFORMANCE TABLE — Feedback Loop Real
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.video_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.video_projects(id) ON DELETE SET NULL,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  niche TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Metrics snapshots
  views_day1 BIGINT DEFAULT 0,
  views_day3 BIGINT DEFAULT 0,
  views_day7 BIGINT DEFAULT 0,
  views_day30 BIGINT DEFAULT 0,
  views_current BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  
  -- CTR & Retention (from YouTube Studio if available)
  ctr_percent NUMERIC DEFAULT 0,
  avg_view_duration_seconds INTEGER DEFAULT 0,
  avg_retention_percent NUMERIC DEFAULT 0,
  
  -- Search Rankings
  ranking_keywords JSONB DEFAULT '[]'::jsonb,
  best_ranking_position INTEGER,
  
  -- AI-generated metadata at publish time
  script_score INTEGER,
  hook_type TEXT,
  title_pattern TEXT,
  predicted_viral_score NUMERIC DEFAULT 0,
  
  -- Feedback analysis
  performance_grade TEXT DEFAULT 'pending', -- S/A/B/C/D/F
  ai_feedback JSONB DEFAULT '{}'::jsonb,
  lessons_learned TEXT[],
  
  -- Tracking
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  check_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT unique_video UNIQUE(user_id, youtube_video_id)
);

ALTER TABLE public.video_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own video_performance"
  ON public.video_performance FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_video_performance_user ON public.video_performance(user_id);
CREATE INDEX idx_video_performance_grade ON public.video_performance(performance_grade);

-- ═══════════════════════════════════════════════════════════
-- 2. TITLE RANKINGS TABLE
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.title_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_performance_id UUID REFERENCES public.video_performance(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  position INTEGER,
  previous_position INTEGER,
  search_volume_estimate TEXT DEFAULT 'unknown',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  country TEXT DEFAULT 'US'
);

ALTER TABLE public.title_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own title_rankings"
  ON public.title_rankings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for video_performance
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_performance;
