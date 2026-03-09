
-- Tracked channels table
CREATE TABLE public.tracked_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  youtube_channel_id text NOT NULL,
  channel_name text NOT NULL,
  thumbnail text,
  subscribers bigint DEFAULT 0,
  folder text DEFAULT 'default',
  last_video_check timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, youtube_channel_id)
);

ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracked channels" ON public.tracked_channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracked channels" ON public.tracked_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracked channels" ON public.tracked_channels FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tracked channels" ON public.tracked_channels FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Generated branding table
CREATE TABLE public.generated_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  niche text,
  channel_name_suggestions jsonb DEFAULT '[]',
  description text,
  seo_tags jsonb DEFAULT '[]',
  logo_url text,
  branding_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generated_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branding" ON public.generated_branding FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own branding" ON public.generated_branding FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own branding" ON public.generated_branding FOR DELETE TO authenticated USING (auth.uid() = user_id);
