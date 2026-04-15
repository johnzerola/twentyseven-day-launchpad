
-- Security definer function to check squad_steps ownership via squad_runs
CREATE OR REPLACE FUNCTION public.owns_squad_step(_run_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_runs
    WHERE id = _run_id AND user_id = auth.uid()
  )
$$;

-- Ensure RLS is enabled
ALTER TABLE public.squad_steps ENABLE ROW LEVEL SECURITY;

-- Scoped policies using the helper function
CREATE POLICY "Users can view their squad steps"
ON public.squad_steps FOR SELECT TO authenticated
USING (public.owns_squad_step(run_id));

CREATE POLICY "Users can insert their squad steps"
ON public.squad_steps FOR INSERT TO authenticated
WITH CHECK (public.owns_squad_step(run_id));

CREATE POLICY "Users can update their squad steps"
ON public.squad_steps FOR UPDATE TO authenticated
USING (public.owns_squad_step(run_id));

CREATE POLICY "Users can delete their squad steps"
ON public.squad_steps FOR DELETE TO authenticated
USING (public.owns_squad_step(run_id));
