
-- Add OAuth sync columns to video_performance
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS oauth_synced boolean DEFAULT false;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS synced_at timestamptz;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS impressions integer DEFAULT 0;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS subscribers_gained integer DEFAULT 0;
ALTER TABLE public.video_performance ADD COLUMN IF NOT EXISTS watch_time_minutes integer DEFAULT 0;

-- Add unique constraint for upsert (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_performance_youtube_video_user_unique'
  ) THEN
    ALTER TABLE public.video_performance ADD CONSTRAINT video_performance_youtube_video_user_unique UNIQUE (youtube_video_id, user_id);
  END IF;
END $$;
