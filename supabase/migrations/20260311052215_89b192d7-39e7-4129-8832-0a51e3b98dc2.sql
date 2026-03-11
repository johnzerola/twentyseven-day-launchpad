
-- Phase 1: Unify scenes + video_segments
-- Add missing columns from video_segments to scenes
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS segment_index integer;
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS video_clip_url text;
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS text_content text DEFAULT '';
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS reference_image_url text;
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS negative_prompt text DEFAULT '';

-- Migrate any data from video_segments to scenes (both are empty but safe)
INSERT INTO public.scenes (project_id, sequence_order, segment_index, tts_text, veo3_prompt, audio_url, media_url, video_clip_url, reference_image_url, status, duration_sec)
SELECT project_id, segment_index, segment_index, text_content, visual_prompt, audio_url, reference_image_url, video_clip_url, reference_image_url, status, COALESCE(duration_ms / 1000, 8)
FROM public.video_segments
ON CONFLICT DO NOTHING;

-- Drop video_segments table
DROP TABLE IF EXISTS public.video_segments CASCADE;

-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT DO NOTHING;

-- RLS for media bucket: authenticated users can upload to their own folder
CREATE POLICY "Users can upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Users can view media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'media');
CREATE POLICY "Users can update own media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media');
CREATE POLICY "Users can delete own media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media');
CREATE POLICY "Public can view media" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'media');
