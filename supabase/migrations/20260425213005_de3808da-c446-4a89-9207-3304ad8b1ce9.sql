
-- Dedup: mantém o registro com id "maior" (mais recente em UUID v4 não é confiável,
-- então usamos updated_at quando existir, senão por id)
DELETE FROM public.video_performance a
USING public.video_performance b
WHERE a.user_id = b.user_id
  AND a.youtube_video_id = b.youtube_video_id
  AND a.youtube_video_id IS NOT NULL
  AND (
    (a.updated_at IS NOT NULL AND b.updated_at IS NOT NULL AND a.updated_at < b.updated_at)
    OR (a.updated_at IS NULL AND b.updated_at IS NOT NULL)
    OR (a.updated_at = b.updated_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS video_performance_user_yt_unique
  ON public.video_performance(user_id, youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS video_performance_channel_idx
  ON public.video_performance(channel_id)
  WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS video_performance_hook_null_idx
  ON public.video_performance(user_id)
  WHERE hook_type IS NULL;
