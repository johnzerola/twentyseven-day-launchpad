-- ============================================================
-- SPRINT 1 — Performance Loop + Safety Net + Strategist preparado
-- ============================================================

-- 1) Tabela de auditoria do pre-upload-guard
CREATE TABLE IF NOT EXISTS public.pre_upload_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channel_id UUID,
  passed BOOLEAN NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('allow','regenerate','manual_review','block')),
  composite_score INTEGER,
  monetiza_score INTEGER,
  originality_score INTEGER,
  thumbnail_score INTEGER,
  title_score INTEGER,
  issues_json JSONB DEFAULT '[]'::jsonb,
  recommendations_json JSONB DEFAULT '[]'::jsonb,
  raw_responses JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_upload_audits_project ON public.pre_upload_audits(project_id);
CREATE INDEX IF NOT EXISTS idx_pre_upload_audits_user_created ON public.pre_upload_audits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pre_upload_audits_action ON public.pre_upload_audits(action) WHERE action <> 'allow';

ALTER TABLE public.pre_upload_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audits"
  ON public.pre_upload_audits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audits"
  ON public.pre_upload_audits FOR INSERT
  WITH CHECK (true);

-- 2) Colunas em video_projects (rastreabilidade do strategist + safety)
ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS created_by_agent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strategy_plan_id UUID,
  ADD COLUMN IF NOT EXISTS pre_upload_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS pre_upload_audit_id UUID REFERENCES public.pre_upload_audits(id),
  ADD COLUMN IF NOT EXISTS safety_block_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_video_projects_strategy_plan ON public.video_projects(strategy_plan_id) WHERE strategy_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_projects_agent ON public.video_projects(created_by_agent) WHERE created_by_agent = true;

-- 3) Colunas em user_channels (toggles de automação avançada)
ALTER TABLE public.user_channels
  ADD COLUMN IF NOT EXISTS strategist_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS safety_guard_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS competitor_benchmark_json JSONB,
  ADD COLUMN IF NOT EXISTS last_competitor_scan_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN NOT NULL DEFAULT false;

-- 4) Índices em video_performance pra acelerar o script-learning-context
CREATE INDEX IF NOT EXISTS idx_video_perf_channel_published
  ON public.video_performance(channel_id, published_at DESC)
  WHERE channel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_perf_user_grade
  ON public.video_performance(user_id, performance_grade);

CREATE INDEX IF NOT EXISTS idx_video_perf_user_score
  ON public.video_performance(user_id, performance_score DESC NULLS LAST);

-- 5) Índices em hook_performance_real (caso ainda não existam)
CREATE INDEX IF NOT EXISTS idx_hook_perf_real_user
  ON public.hook_performance_real(user_id) WHERE user_id IS NOT NULL;

-- 6) View: top hooks por canal (ranking) — leve, materializa nada
CREATE OR REPLACE VIEW public.v_channel_top_performers AS
SELECT
  vp.user_id,
  vp.channel_id,
  vp.youtube_video_id,
  vp.title,
  vp.topic,
  vp.hook_type,
  vp.title_pattern,
  vp.video_type,
  vp.duration_seconds,
  vp.views_current,
  vp.ctr_percent,
  vp.avg_retention_percent,
  vp.performance_score,
  vp.performance_grade,
  vp.published_at,
  ROW_NUMBER() OVER (
    PARTITION BY vp.user_id, vp.channel_id
    ORDER BY COALESCE(vp.performance_score, 0) DESC, COALESCE(vp.views_current, 0) DESC
  ) AS rank_in_channel,
  ROW_NUMBER() OVER (
    PARTITION BY vp.user_id, vp.channel_id
    ORDER BY COALESCE(vp.performance_score, 999) ASC, COALESCE(vp.views_current, 999999) ASC
  ) AS reverse_rank_in_channel
FROM public.video_performance vp
WHERE vp.published_at IS NOT NULL
  AND vp.published_at >= now() - INTERVAL '180 days';

GRANT SELECT ON public.v_channel_top_performers TO authenticated, service_role;