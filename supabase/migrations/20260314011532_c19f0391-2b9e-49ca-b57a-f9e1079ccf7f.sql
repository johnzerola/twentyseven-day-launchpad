
-- Fix ab_tests RLS: allow authenticated users to INSERT, UPDATE, DELETE
CREATE POLICY "Authenticated can insert ab_tests"
  ON public.ab_tests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update ab_tests"
  ON public.ab_tests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete ab_tests"
  ON public.ab_tests FOR DELETE
  TO authenticated
  USING (true);
