-- Content Series table for recurring automated content
CREATE TABLE public.content_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid REFERENCES public.user_channels(id) ON DELETE SET NULL,
  series_name text NOT NULL,
  niche text NOT NULL DEFAULT 'general',
  sub_niche text,
  video_format text NOT NULL DEFAULT 'short',
  visual_style text NOT NULL DEFAULT 'cinematográfico',
  content_style text NOT NULL DEFAULT 'dopaminérgico',
  language text NOT NULL DEFAULT 'português',
  custom_prompt text,
  frequency text NOT NULL DEFAULT 'daily',
  auto_generate boolean DEFAULT false,
  total_generated integer DEFAULT 0,
  total_published integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own series" ON public.content_series
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reference channels showcase table
CREATE TABLE public.reference_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,
  youtube_handle text,
  youtube_channel_id text,
  subscribers integer DEFAULT 0,
  avg_views bigint DEFAULT 0,
  estimated_revenue_min numeric DEFAULT 0,
  estimated_revenue_max numeric DEFAULT 0,
  niche text NOT NULL DEFAULT 'general',
  country text DEFAULT 'US',
  language text DEFAULT 'en',
  is_faceless boolean DEFAULT true,
  top_videos jsonb DEFAULT '[]'::jsonb,
  visual_style text,
  content_format text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reference_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reference channels" ON public.reference_channels
  FOR SELECT TO authenticated
  USING (true);