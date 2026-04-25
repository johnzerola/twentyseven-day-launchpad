CREATE TABLE IF NOT EXISTS public.channel_intelligence_per_user (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID NOT NULL,
  channel_id                UUID NOT NULL,
  top_performing_topics     TEXT[] DEFAULT ARRAY[]::TEXT[],
  top_performing_hooks      TEXT[] DEFAULT ARRAY[]::TEXT[],
  best_posting_days         TEXT[] DEFAULT ARRAY[]::TEXT[],
  best_posting_hours        INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  low_performing_topics     TEXT[] DEFAULT ARRAY[]::TEXT[],
  avg_views_all_time        INTEGER DEFAULT 0,
  avg_ctr_all_time          NUMERIC(5,2) DEFAULT 0,
  best_video_id             TEXT,
  best_video_views          INTEGER DEFAULT 0,
  ai_suggestions            JSONB DEFAULT '[]'::jsonb,
  last_analyzed_at          TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cipu_channel_unique UNIQUE(channel_id)
);

ALTER TABLE public.channel_intelligence_per_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_intel_select" ON public.channel_intelligence_per_user FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_own_intel_insert" ON public.channel_intelligence_per_user FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_own_intel_update" ON public.channel_intelligence_per_user FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_own_intel_delete" ON public.channel_intelligence_per_user FOR DELETE USING (auth.uid() = user_id);