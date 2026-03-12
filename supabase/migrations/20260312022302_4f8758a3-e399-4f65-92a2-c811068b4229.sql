
-- video_retention_curve
CREATE TABLE IF NOT EXISTS public.video_retention_curve (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL,
  bucket_seconds int NOT NULL DEFAULT 0,
  percent_viewers numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.video_retention_curve ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read video_retention_curve" ON public.video_retention_curve FOR SELECT TO authenticated USING (true);

-- video_segments
CREATE TABLE IF NOT EXISTS public.video_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL,
  start_seconds int NOT NULL DEFAULT 0,
  end_seconds int NOT NULL DEFAULT 0,
  segment_type text NOT NULL DEFAULT 'peak_engagement',
  metric numeric DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read video_segments" ON public.video_segments FOR SELECT TO authenticated USING (true);

-- thumbnail_features
CREATE TABLE IF NOT EXISTS public.thumbnail_features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL,
  face_count int DEFAULT 0,
  emotion_tags jsonb DEFAULT '[]'::jsonb,
  color_profile jsonb DEFAULT '{}'::jsonb,
  text_overlay boolean DEFAULT false,
  avg_contrast numeric DEFAULT 0,
  dominant_colors jsonb DEFAULT '[]'::jsonb,
  ctr_estimate numeric DEFAULT 0,
  source_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.thumbnail_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read thumbnail_features" ON public.thumbnail_features FOR SELECT TO authenticated USING (true);

-- hook_library
CREATE TABLE IF NOT EXISTS public.hook_library (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hook_text text NOT NULL,
  hook_type text DEFAULT 'curiosity',
  niche text,
  retention_score numeric DEFAULT 7,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hook_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read hook_library" ON public.hook_library FOR SELECT TO authenticated USING (true);

-- viral_patterns
CREATE TABLE IF NOT EXISTS public.viral_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_name text NOT NULL,
  pattern_json jsonb DEFAULT '{}'::jsonb,
  niche text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.viral_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read viral_patterns" ON public.viral_patterns FOR SELECT TO authenticated USING (true);

-- ab_tests
CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid,
  test_type text DEFAULT 'title',
  variant_a jsonb DEFAULT '{}'::jsonb,
  variant_b jsonb DEFAULT '{}'::jsonb,
  metric_target text DEFAULT 'ctr',
  started_at timestamptz,
  ended_at timestamptz,
  result jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ab_tests" ON public.ab_tests FOR SELECT TO authenticated USING (true);
