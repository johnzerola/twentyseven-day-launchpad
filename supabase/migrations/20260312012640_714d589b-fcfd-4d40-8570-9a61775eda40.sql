
-- Video Blueprints table: stores reverse-engineered viral video structures
CREATE TABLE public.video_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL DEFAULT '',
  channel_name TEXT,
  channel_id TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  niche TEXT,
  story_structure JSONB DEFAULT '{}'::jsonb,
  hook_type TEXT,
  hook_text TEXT,
  psychological_triggers TEXT[] DEFAULT '{}',
  narrative_style TEXT,
  pacing_type TEXT,
  visual_style TEXT,
  scene_structure JSONB DEFAULT '[]'::jsonb,
  retention_map JSONB DEFAULT '{}'::jsonb,
  clone_template JSONB DEFAULT '{}'::jsonb,
  scores JSONB DEFAULT '{}'::jsonb,
  thumbnail_analysis JSONB DEFAULT '{}'::jsonb,
  source TEXT DEFAULT 'deep-scan',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id)
);

ALTER TABLE public.video_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read video_blueprints"
  ON public.video_blueprints FOR SELECT
  TO authenticated USING (true);

-- Script Scores: not a separate table, stored as JSONB in saved_scripts or returned inline
-- MonetizaScore: computed on-the-fly, no dedicated table needed
