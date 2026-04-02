-- ═══════ PHASE 2: content_thesis ═══════
CREATE TABLE public.content_thesis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID REFERENCES public.user_channels(id) ON DELETE SET NULL,
  thesis_text TEXT NOT NULL,
  niche TEXT,
  angle TEXT,
  format TEXT DEFAULT 'long' CHECK (format IN ('short', 'long', 'both')),
  evidence_json JSONB DEFAULT '[]'::jsonb,
  originality_notes TEXT,
  source_notes TEXT,
  packaging_notes TEXT,
  confidence_score NUMERIC DEFAULT 0,
  freshness_score NUMERIC DEFAULT 0,
  saturation_risk NUMERIC DEFAULT 0,
  originality_risk NUMERIC DEFAULT 0,
  why_now TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scripted', 'packaged', 'published', 'measured')),
  script_id UUID,
  video_project_id UUID REFERENCES public.video_projects(id) ON DELETE SET NULL,
  youtube_video_id TEXT,
  title_ids UUID[] DEFAULT '{}',
  thumbnail_prompt_ids UUID[] DEFAULT '{}',
  actual_views BIGINT,
  actual_ctr NUMERIC,
  actual_retention NUMERIC,
  monetization_result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_thesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own thesis" ON public.content_thesis
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own thesis" ON public.content_thesis
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own thesis" ON public.content_thesis
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own thesis" ON public.content_thesis
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_content_thesis_user ON public.content_thesis(user_id);
CREATE INDEX idx_content_thesis_status ON public.content_thesis(status);
CREATE INDEX idx_content_thesis_niche ON public.content_thesis(niche);

-- ═══════ PHASE 3: Expand dotti_suggestions ═══════
ALTER TABLE public.dotti_suggestions
  ADD COLUMN IF NOT EXISTS suggestion_type TEXT DEFAULT 'tema',
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'long',
  ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freshness_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monetization_angle TEXT,
  ADD COLUMN IF NOT EXISTS production_effort TEXT,
  ADD COLUMN IF NOT EXISTS originality_risk NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS why_now TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_thesis_id UUID REFERENCES public.content_thesis(id) ON DELETE SET NULL;