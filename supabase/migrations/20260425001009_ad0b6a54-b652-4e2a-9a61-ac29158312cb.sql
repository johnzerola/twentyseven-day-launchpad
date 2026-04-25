CREATE TABLE IF NOT EXISTS public.channel_schedule (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL,
  channel_id       UUID NOT NULL,
  project_id       UUID,
  youtube_video_id TEXT,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  published_at     TIMESTAMPTZ,
  status           TEXT DEFAULT 'scheduled',
  title            TEXT,
  topic            TEXT,
  niche            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);