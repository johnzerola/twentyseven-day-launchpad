-- 1) api_usage: daily counters per API (different from api_logs which logs individual calls)
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  requests_used integer NOT NULL DEFAULT 0,
  daily_limit integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_name, date)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) write; authenticated users can read
CREATE POLICY "Authenticated can read api_usage"
  ON public.api_usage FOR SELECT TO authenticated
  USING (true);

-- 2) emerging_channels
CREATE TABLE IF NOT EXISTS public.emerging_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  channel_title text,
  sample_video_id text,
  niche text,
  viral_score numeric,
  meta jsonb DEFAULT '{}'::jsonb,
  detected_at timestamptz DEFAULT now(),
  last_checked timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emerging_channel_id ON public.emerging_channels (channel_id);

ALTER TABLE public.emerging_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read emerging_channels"
  ON public.emerging_channels FOR SELECT TO authenticated
  USING (true);

-- 3) task_queue
CREATE TABLE IF NOT EXISTS public.task_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  result jsonb,
  error_message text,
  idempotency_key text UNIQUE,
  scheduled_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_queue_status ON public.task_queue (status, scheduled_at);

ALTER TABLE public.task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read task_queue"
  ON public.task_queue FOR SELECT TO authenticated
  USING (true);

-- 4) api_config
CREATE TABLE IF NOT EXISTS public.api_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text UNIQUE NOT NULL,
  env_var_key text NOT NULL,
  daily_limit integer DEFAULT 0,
  notes text
);

ALTER TABLE public.api_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read api_config"
  ON public.api_config FOR SELECT TO authenticated
  USING (true);

-- 5) Add query column to research_cache if not exists (existing uses cache_key)
ALTER TABLE public.research_cache ADD COLUMN IF NOT EXISTS query text;
ALTER TABLE public.research_cache ADD COLUMN IF NOT EXISTS params jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.research_cache ADD COLUMN IF NOT EXISTS ttl timestamptz;

-- 6) execution_logs for observability
CREATE TABLE IF NOT EXISTS public.execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  duration_ms integer,
  success boolean NOT NULL DEFAULT true,
  payload_size integer,
  api_calls_made integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read execution_logs"
  ON public.execution_logs FOR SELECT TO authenticated
  USING (true);

-- 7) Security definer function for api proxy to check+increment usage
CREATE OR REPLACE FUNCTION public.check_and_increment_api_usage(_api_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit integer;
  _used integer;
BEGIN
  -- Get daily limit from config
  SELECT daily_limit INTO _limit FROM api_config WHERE api_name = _api_name;
  IF _limit IS NULL THEN _limit := 9999; END IF;

  -- Upsert today's usage
  INSERT INTO api_usage (api_name, date, requests_used, daily_limit)
  VALUES (_api_name, CURRENT_DATE, 1, _limit)
  ON CONFLICT (api_name, date) DO UPDATE
  SET requests_used = api_usage.requests_used + 1, updated_at = now()
  RETURNING requests_used INTO _used;

  -- Check if over limit
  IF _used > _limit THEN
    -- Rollback the increment
    UPDATE api_usage SET requests_used = requests_used - 1 WHERE api_name = _api_name AND date = CURRENT_DATE;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;