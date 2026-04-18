-- Agent runs: tracks each meta-orchestrator execution
CREATE TABLE public.agent_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  goal text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'planning',
  plan jsonb DEFAULT '[]'::jsonb,
  current_step int NOT NULL DEFAULT 0,
  total_steps int NOT NULL DEFAULT 0,
  trace_id uuid,
  result_summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_agent_runs_user ON public.agent_runs(user_id, created_at DESC);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status) WHERE status IN ('planning','running');
CREATE INDEX idx_agent_runs_trace ON public.agent_runs(trace_id);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_select_own" ON public.agent_runs
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "agent_runs_insert_own" ON public.agent_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_runs_update_own" ON public.agent_runs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER agent_runs_set_updated_at
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agent memory: shared scratchpad per run
CREATE TABLE public.agent_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  written_by text NOT NULL,
  step_index int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_run ON public.agent_memory(run_id, created_at);
CREATE INDEX idx_agent_memory_key ON public.agent_memory(run_id, key);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memory_select_via_run" ON public.agent_memory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_runs
      WHERE id = agent_memory.run_id
        AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "agent_memory_insert_via_run" ON public.agent_memory
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_runs
      WHERE id = agent_memory.run_id AND user_id = auth.uid()
    )
  );