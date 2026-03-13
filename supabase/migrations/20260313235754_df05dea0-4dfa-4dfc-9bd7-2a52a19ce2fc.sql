
CREATE TABLE IF NOT EXISTS public.content_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  video_title text NOT NULL DEFAULT '',
  channel_id text,
  channel_name text,
  niche text DEFAULT 'general',
  language text DEFAULT 'pt',
  views bigint DEFAULT 0,
  subscribers bigint DEFAULT 0,
  multiplier numeric DEFAULT 0,
  hook_type text,
  hook_pattern text,
  hook_strength numeric DEFAULT 0,
  title_structure text,
  title_uses_numbers boolean DEFAULT false,
  title_uses_questions boolean DEFAULT false,
  title_emotion text,
  story_structure text,
  pacing text,
  narrative_arc jsonb DEFAULT '{}',
  cliffhanger_count integer DEFAULT 0,
  open_loop_count integer DEFAULT 0,
  visual_style text,
  thumbnail_pattern text,
  emotion_primary text,
  emotion_secondary text,
  emotional_arc jsonb DEFAULT '[]',
  psychological_triggers text[] DEFAULT '{}',
  retention_hooks jsonb DEFAULT '[]',
  attention_score numeric DEFAULT 0,
  curiosity_score numeric DEFAULT 0,
  dopamine_score numeric DEFAULT 0,
  estimated_retention numeric DEFAULT 0,
  why_viral text,
  replication_template text,
  content_model text,
  gold_score numeric DEFAULT 0,
  viral_score numeric DEFAULT 0,
  source text DEFAULT 'auto',
  video_type text DEFAULT 'long',
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(video_id)
);

ALTER TABLE public.content_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read content_dna" ON public.content_dna
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_content_dna_niche ON public.content_dna(niche);
CREATE INDEX IF NOT EXISTS idx_content_dna_viral_score ON public.content_dna(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_dna_hook_type ON public.content_dna(hook_type);
CREATE INDEX IF NOT EXISTS idx_content_dna_story_structure ON public.content_dna(story_structure)
