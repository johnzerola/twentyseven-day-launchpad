
-- Distributed tracing table
CREATE TABLE public.function_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  span_id UUID NOT NULL DEFAULT gen_random_uuid(),
  parent_span_id UUID,
  function_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started', -- started | success | error | timeout
  user_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_summary JSONB,
  output_summary JSONB,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_function_traces_trace_id ON public.function_traces(trace_id);
CREATE INDEX idx_function_traces_user_id ON public.function_traces(user_id);
CREATE INDEX idx_function_traces_started_at ON public.function_traces(started_at DESC);
CREATE INDEX idx_function_traces_function_status ON public.function_traces(function_name, status);

ALTER TABLE public.function_traces ENABLE ROW LEVEL SECURITY;

-- Admins see everything
CREATE POLICY "Admins view all traces"
  ON public.function_traces FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users see their own traces
CREATE POLICY "Users view own traces"
  ON public.function_traces FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts/updates (edge functions)
CREATE POLICY "Service role manages traces"
  ON public.function_traces FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup function (14-day retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_function_traces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.function_traces
  WHERE created_at < now() - INTERVAL '14 days';
END;
$$;
