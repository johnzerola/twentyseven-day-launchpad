
ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS timeline_json jsonb,
  ADD COLUMN IF NOT EXISTS captions_url text,
  ADD COLUMN IF NOT EXISTS broll_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timeline_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS timeline_validation_errors jsonb;

ALTER TABLE public.scenes
  ADD COLUMN IF NOT EXISTS start_time_sec numeric(10,3),
  ADD COLUMN IF NOT EXISTS end_time_sec numeric(10,3),
  ADD COLUMN IF NOT EXISTS audio_duration_sec numeric(10,3),
  ADD COLUMN IF NOT EXISTS caption_text text,
  ADD COLUMN IF NOT EXISTS broll_url text;

CREATE INDEX IF NOT EXISTS idx_video_projects_timeline_validated
  ON public.video_projects (timeline_validated_at DESC NULLS LAST);
