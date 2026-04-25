
-- 1. Tabela de planos semanais
CREATE TABLE public.weekly_strategy_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.user_channels(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  performance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  niche_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  applied_project_ids UUID[] DEFAULT ARRAY[]::UUID[],
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_strategy_plans_status_check CHECK (status IN ('draft','applied','failed','skipped')),
  CONSTRAINT weekly_strategy_plans_unique_week UNIQUE (channel_id, week_start)
);

CREATE INDEX idx_weekly_strategy_plans_user ON public.weekly_strategy_plans(user_id, week_start DESC);
CREATE INDEX idx_weekly_strategy_plans_channel ON public.weekly_strategy_plans(channel_id, week_start DESC);

ALTER TABLE public.weekly_strategy_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_strategy_plans"
  ON public.weekly_strategy_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_manage_strategy_plans"
  ON public.weekly_strategy_plans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_weekly_strategy_plans_updated_at
  BEFORE UPDATE ON public.weekly_strategy_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Coluna de visibilidade no canal
ALTER TABLE public.user_channels
  ADD COLUMN IF NOT EXISTS strategist_last_run_at TIMESTAMPTZ;
