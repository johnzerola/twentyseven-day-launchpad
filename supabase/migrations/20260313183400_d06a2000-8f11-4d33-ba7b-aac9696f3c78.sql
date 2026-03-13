-- Create video_type enum
CREATE TYPE public.video_type AS ENUM ('long', 'short');

-- Add video_type column to video_projects with default 'long' so existing projects are unaffected
ALTER TABLE public.video_projects ADD COLUMN video_type public.video_type NOT NULL DEFAULT 'long';

-- Add video_type to saved_scripts for future short script support
ALTER TABLE public.saved_scripts ADD COLUMN video_type public.video_type NOT NULL DEFAULT 'long';

-- Add video_type to content_queue
ALTER TABLE public.content_queue ADD COLUMN video_type public.video_type NOT NULL DEFAULT 'long';