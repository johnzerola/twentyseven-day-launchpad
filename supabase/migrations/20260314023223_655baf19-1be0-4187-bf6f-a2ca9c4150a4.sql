
CREATE TABLE public.youtube_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id text NOT NULL,
  channel_name text,
  channel_thumbnail text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone,
  scopes text[] DEFAULT '{}',
  connected_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX idx_youtube_oauth_user_channel ON public.youtube_oauth_tokens(user_id, channel_id);

ALTER TABLE public.youtube_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own youtube tokens"
  ON public.youtube_oauth_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
