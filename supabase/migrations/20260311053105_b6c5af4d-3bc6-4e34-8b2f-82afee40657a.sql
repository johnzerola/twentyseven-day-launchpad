
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS intelligence_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS scene_blueprint_json jsonb DEFAULT '[]'::jsonb;
