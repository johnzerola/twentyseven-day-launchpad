-- 1) Add unique constraint required by ON CONFLICT in youtube-oauth-callback
ALTER TABLE public.user_channels
  ADD CONSTRAINT user_channels_user_id_youtube_channel_id_key
  UNIQUE (user_id, youtube_channel_id);

-- 2) Backfill youtube_refresh_token / access_token from youtube_oauth_tokens
UPDATE public.user_channels uc
SET
  youtube_refresh_token      = COALESCE(uc.youtube_refresh_token,      yot.refresh_token),
  youtube_access_token       = COALESCE(uc.youtube_access_token,       yot.access_token),
  youtube_token_expires_at   = COALESCE(uc.youtube_token_expires_at,   yot.token_expires_at),
  youtube_oauth_scope        = COALESCE(
                                 uc.youtube_oauth_scope,
                                 array_to_string(yot.scopes, ' ')
                               ),
  youtube_oauth_connected_at = COALESCE(uc.youtube_oauth_connected_at, yot.updated_at)
FROM public.youtube_oauth_tokens yot
WHERE yot.user_id    = uc.user_id
  AND yot.channel_id = uc.youtube_channel_id
  AND yot.refresh_token IS NOT NULL;