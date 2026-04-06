
CREATE TABLE public.user_reference_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_intelligence_id uuid REFERENCES public.channel_intelligence(id) ON DELETE SET NULL,
  youtube_channel_id text NOT NULL,
  channel_name text NOT NULL,
  thumbnail text,
  role text NOT NULL DEFAULT 'model',
  latest_intel jsonb DEFAULT '{}',
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id)
);

ALTER TABLE public.user_reference_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reference channels"
  ON public.user_reference_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reference channels"
  ON public.user_reference_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reference channels"
  ON public.user_reference_channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reference channels"
  ON public.user_reference_channels FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_ref_channels_user_id ON public.user_reference_channels(user_id);
