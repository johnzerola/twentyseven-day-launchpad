
-- Create channel_intelligence table
CREATE TABLE public.channel_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL,
  youtube_channel_id text NOT NULL DEFAULT '',
  niche text NOT NULL DEFAULT 'geral',
  sub_niche text,
  style text NOT NULL DEFAULT 'cinematic',
  country text NOT NULL DEFAULT 'US',
  language text NOT NULL DEFAULT 'en',
  subscribers bigint NOT NULL DEFAULT 0,
  avg_views bigint NOT NULL DEFAULT 0,
  growth_rate text NOT NULL DEFAULT 'steady',
  is_faceless boolean NOT NULL DEFAULT true,
  is_monetized boolean NOT NULL DEFAULT true,
  viral_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  visual_style_notes text,
  upload_frequency text,
  rpm_estimate numeric DEFAULT 0,
  analyzed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.channel_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channel_intelligence"
  ON public.channel_intelligence FOR SELECT
  TO authenticated
  USING (true);

-- Index for filtering
CREATE INDEX idx_channel_intelligence_style ON public.channel_intelligence(style);
CREATE INDEX idx_channel_intelligence_niche ON public.channel_intelligence(niche);
CREATE INDEX idx_channel_intelligence_country ON public.channel_intelligence(country);
CREATE INDEX idx_channel_intelligence_faceless ON public.channel_intelligence(is_faceless);
