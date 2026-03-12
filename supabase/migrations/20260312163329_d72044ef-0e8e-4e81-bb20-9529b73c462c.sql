
-- Attention Library: scene-level retention patterns (behavioral database)
CREATE TABLE public.attention_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL,
  scene_type TEXT NOT NULL DEFAULT 'narrative',
  scene_duration_sec NUMERIC DEFAULT 5,
  time_window TEXT DEFAULT '0-5s',
  emotion TEXT DEFAULT 'neutral',
  visual_change NUMERIC DEFAULT 5,
  information_density NUMERIC DEFAULT 5,
  novelty_score NUMERIC DEFAULT 5,
  curiosity_gap_score NUMERIC DEFAULT 5,
  emotional_intensity NUMERIC DEFAULT 5,
  attention_score NUMERIC NOT NULL DEFAULT 5,
  retention_score NUMERIC DEFAULT 0.5,
  drop_off_risk TEXT DEFAULT 'medium',
  recovery_technique TEXT DEFAULT '',
  niche TEXT DEFAULT 'general',
  language TEXT DEFAULT 'en',
  example_text TEXT DEFAULT '',
  example_videos JSONB DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'research',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attention Curves: second-by-second attention model templates
CREATE TABLE public.attention_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curve_name TEXT NOT NULL,
  video_type TEXT NOT NULL DEFAULT 'longform',
  duration_minutes INTEGER DEFAULT 10,
  niche TEXT DEFAULT 'general',
  curve_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  avg_retention NUMERIC DEFAULT 0.5,
  best_for TEXT DEFAULT '',
  source TEXT DEFAULT 'modeled',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attention_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_curves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read attention_library" ON public.attention_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read attention_curves" ON public.attention_curves FOR SELECT TO authenticated USING (true);
