
-- 3.1 user_content_memory
CREATE TABLE public.user_content_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.user_channels(id),
  preferred_duration_minutes NUMERIC DEFAULT NULL,
  preferred_style TEXT DEFAULT NULL,
  preferred_hook_type TEXT DEFAULT NULL,
  preferred_narration_style TEXT DEFAULT NULL,
  avg_retention_pct NUMERIC DEFAULT NULL,
  best_performing_style TEXT DEFAULT NULL,
  best_performing_niche TEXT DEFAULT NULL,
  best_performing_duration_minutes NUMERIC DEFAULT NULL,
  worst_performing_style TEXT DEFAULT NULL,
  total_scripts_generated INTEGER DEFAULT 0,
  total_scripts_published INTEGER DEFAULT 0,
  total_views_accumulated BIGINT DEFAULT 0,
  ai_identified_patterns JSONB DEFAULT '[]',
  last_topics_used TEXT[] DEFAULT '{}',
  topics_to_avoid TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_user_content_memory_user ON public.user_content_memory(user_id);
CREATE INDEX idx_user_content_memory_channel ON public.user_content_memory(channel_id);

ALTER TABLE public.user_content_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own content memory" ON public.user_content_memory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3.2 script_performance_link
CREATE TABLE public.script_performance_link (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  script_id UUID REFERENCES public.saved_scripts(id),
  youtube_video_id TEXT NOT NULL,
  video_title TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  views_48h INTEGER DEFAULT NULL,
  views_7d INTEGER DEFAULT NULL,
  views_30d INTEGER DEFAULT NULL,
  avg_retention_pct NUMERIC DEFAULT NULL,
  ctr_pct NUMERIC DEFAULT NULL,
  likes INTEGER DEFAULT NULL,
  comments INTEGER DEFAULT NULL,
  performance_grade TEXT DEFAULT NULL,
  beat_channel_average BOOLEAN DEFAULT NULL,
  learnings_extracted BOOLEAN DEFAULT FALSE,
  learnings_json JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_spl_user ON public.script_performance_link(user_id);
CREATE INDEX idx_spl_script ON public.script_performance_link(script_id);
CREATE INDEX idx_spl_video ON public.script_performance_link(youtube_video_id);

ALTER TABLE public.script_performance_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own script links" ON public.script_performance_link FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3.3 youtube_algorithm_knowledge
CREATE TABLE public.youtube_algorithm_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 8,
  source TEXT,
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TEXT,
  applies_to_format TEXT,
  applies_to_niche TEXT DEFAULT 'all',
  data_json JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 5,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_yak_category ON public.youtube_algorithm_knowledge(category);
CREATE INDEX idx_yak_format ON public.youtube_algorithm_knowledge(applies_to_format);
CREATE INDEX idx_yak_priority ON public.youtube_algorithm_knowledge(priority DESC);

-- 3.4 viral_mechanics_library
CREATE TABLE public.viral_mechanics_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mechanic_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  how_to_apply TEXT NOT NULL,
  effectiveness_score NUMERIC DEFAULT 7,
  avg_retention_boost_pct NUMERIC DEFAULT NULL,
  avg_ctr_boost_pct NUMERIC DEFAULT NULL,
  avg_views_multiplier NUMERIC DEFAULT NULL,
  best_niches TEXT[] DEFAULT '{}',
  best_video_format TEXT DEFAULT 'both',
  difficulty TEXT DEFAULT 'medium',
  example_titles TEXT[] DEFAULT '{}',
  example_channels TEXT[] DEFAULT '{}',
  real_world_evidence TEXT,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_vml_category ON public.viral_mechanics_library(category);
CREATE INDEX idx_vml_score ON public.viral_mechanics_library(effectiveness_score DESC);

-- 3.5 monetization_knowledge_base
CREATE TABLE public.monetization_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  data_json JSONB DEFAULT '{}',
  country_code TEXT DEFAULT 'ALL',
  niche TEXT DEFAULT 'all',
  confidence_score NUMERIC DEFAULT 8,
  source TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_mkb_topic ON public.monetization_knowledge_base(topic);
CREATE INDEX idx_mkb_country ON public.monetization_knowledge_base(country_code);

-- 3.6 daily_adaptive_plan
CREATE TABLE public.daily_adaptive_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES public.user_channels(id),
  plan_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]',
  generated_based_on TEXT,
  adaptation_reason TEXT,
  yesterday_performance JSONB DEFAULT '{}',
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  completion_pct NUMERIC DEFAULT 0,
  ai_adapted BOOLEAN DEFAULT FALSE,
  ai_adaptation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);
CREATE INDEX idx_dap_user_date ON public.daily_adaptive_plan(user_id, plan_date DESC);

ALTER TABLE public.daily_adaptive_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily plans" ON public.daily_adaptive_plan FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3.7 thumbnail_prompt_library
CREATE TABLE public.thumbnail_prompt_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche TEXT NOT NULL,
  style TEXT NOT NULL,
  title TEXT NOT NULL,
  midjourney_prompt TEXT NOT NULL,
  dalle_prompt TEXT NOT NULL,
  color_palette TEXT[],
  emotion_target TEXT,
  face_required BOOLEAN DEFAULT FALSE,
  expected_ctr_pct NUMERIC DEFAULT NULL,
  effectiveness_score NUMERIC DEFAULT 7,
  reference_channels TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_tpl_niche ON public.thumbnail_prompt_library(niche);
CREATE INDEX idx_tpl_style ON public.thumbnail_prompt_library(style);
