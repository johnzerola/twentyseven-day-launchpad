
-- Add unique constraint for upsert in link-script-to-video
ALTER TABLE public.script_performance_link ADD CONSTRAINT uq_spl_user_video UNIQUE (user_id, youtube_video_id);
-- Add unique constraint for user_content_memory upsert
ALTER TABLE public.user_content_memory ADD CONSTRAINT uq_ucm_user UNIQUE (user_id);
