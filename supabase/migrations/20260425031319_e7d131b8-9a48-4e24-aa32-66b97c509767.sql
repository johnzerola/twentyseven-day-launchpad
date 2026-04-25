ALTER TABLE public.user_channels
  ADD COLUMN IF NOT EXISTS avoided_topics TEXT[] DEFAULT ARRAY[]::TEXT[];