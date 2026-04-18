
-- Phase 2: Cost tracking
CREATE TABLE IF NOT EXISTS public.ai_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  function_name text NOT NULL,
  cost_usd numeric(10, 6) NOT NULL DEFAULT 0,
  tokens integer DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_ledger_provider_time ON public.ai_cost_ledger(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_ledger_function_time ON public.ai_cost_ledger(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_ledger_user_time ON public.ai_cost_ledger(user_id, created_at DESC) WHERE user_id IS NOT NULL;

ALTER TABLE public.ai_cost_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read cost ledger"
  ON public.ai_cost_ledger FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read their own costs"
  ON public.ai_cost_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Budget thresholds config
CREATE TABLE IF NOT EXISTS public.ai_budget_thresholds (
  provider text PRIMARY KEY,
  daily_limit_usd numeric(10, 2) NOT NULL,
  monthly_limit_usd numeric(10, 2) NOT NULL,
  alert_at_pct integer NOT NULL DEFAULT 80,
  hard_block boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_budget_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage thresholds"
  ON public.ai_budget_thresholds FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Default thresholds
INSERT INTO public.ai_budget_thresholds (provider, daily_limit_usd, monthly_limit_usd) VALUES
  ('perplexity', 50, 800),
  ('gemini', 200, 4000),
  ('openai', 100, 2000),
  ('elevenlabs', 50, 800),
  ('anthropic', 100, 2000)
ON CONFLICT (provider) DO NOTHING;

-- Phase 1: Real retention curve
ALTER TABLE public.video_performance
  ADD COLUMN IF NOT EXISTS retention_curve jsonb;

-- Cost aggregation helper
CREATE OR REPLACE FUNCTION public.get_provider_spend(_provider text, _hours integer DEFAULT 24)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM public.ai_cost_ledger
  WHERE provider = _provider
    AND created_at >= now() - (_hours || ' hours')::interval;
$$;

CREATE OR REPLACE FUNCTION public.check_budget(_provider text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily numeric;
  _monthly numeric;
  _daily_limit numeric;
  _monthly_limit numeric;
  _hard_block boolean;
  _alert_pct integer;
BEGIN
  SELECT daily_limit_usd, monthly_limit_usd, hard_block, alert_at_pct
    INTO _daily_limit, _monthly_limit, _hard_block, _alert_pct
  FROM public.ai_budget_thresholds WHERE provider = _provider;

  IF _daily_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_threshold_set');
  END IF;

  _daily := public.get_provider_spend(_provider, 24);
  _monthly := public.get_provider_spend(_provider, 720);

  IF _hard_block AND (_daily >= _daily_limit OR _monthly >= _monthly_limit) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'budget_exceeded',
      'daily_spend', _daily,
      'daily_limit', _daily_limit,
      'monthly_spend', _monthly,
      'monthly_limit', _monthly_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_spend', _daily,
    'daily_limit', _daily_limit,
    'monthly_spend', _monthly,
    'monthly_limit', _monthly_limit,
    'alert', (_daily >= (_daily_limit * _alert_pct / 100.0))
  );
END;
$$;
