-- Content Models: structured templates for different content types
CREATE TABLE public.content_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  model_type text NOT NULL DEFAULT 'storytelling',
  description text NOT NULL DEFAULT '',
  structure_json jsonb NOT NULL DEFAULT '[]',
  hook_pattern text NOT NULL DEFAULT '',
  pacing_guide text NOT NULL DEFAULT '',
  retention_profile jsonb NOT NULL DEFAULT '{}',
  best_for_niches jsonb DEFAULT '[]',
  best_for_duration text DEFAULT 'any',
  video_type public.video_type NOT NULL DEFAULT 'long',
  effectiveness_score integer DEFAULT 7,
  examples jsonb DEFAULT '[]',
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.content_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read content_models"
  ON public.content_models FOR SELECT TO authenticated USING (true);

-- Hook patterns dedicated table
CREATE TABLE public.hook_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  pattern_type text NOT NULL DEFAULT 'curiosity',
  template text NOT NULL DEFAULT '',
  example_hooks jsonb DEFAULT '[]',
  psychology_trigger text DEFAULT '',
  avg_retention_boost numeric DEFAULT 0,
  best_for_video_type public.video_type DEFAULT 'long',
  best_for_niches jsonb DEFAULT '[]',
  effectiveness_score integer DEFAULT 7,
  source text DEFAULT 'analyzed',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hook_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hook_patterns"
  ON public.hook_patterns FOR SELECT TO authenticated USING (true);

-- Scene patterns for visual generation
CREATE TABLE public.scene_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  scene_type text NOT NULL DEFAULT 'narrative',
  visual_template text NOT NULL DEFAULT '',
  camera_movements jsonb DEFAULT '[]',
  lighting_setup text DEFAULT '',
  vfx_suggestions jsonb DEFAULT '[]',
  sound_design text DEFAULT '',
  duration_seconds integer DEFAULT 8,
  aspect_ratio text DEFAULT '16:9',
  video_type public.video_type DEFAULT 'long',
  mood text DEFAULT 'neutral',
  effectiveness_score integer DEFAULT 7,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scene_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read scene_patterns"
  ON public.scene_patterns FOR SELECT TO authenticated USING (true);