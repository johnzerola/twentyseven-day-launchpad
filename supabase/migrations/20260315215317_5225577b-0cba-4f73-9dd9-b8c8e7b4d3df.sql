
-- 1. FIX user_subscriptions: Drop ALL remaining write policies
DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.user_subscriptions;

-- Recreate: ONLY SELECT allowed for users
CREATE POLICY "Users can read own subscription"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. FIX ab_tests: Add user_id and ownership policies
ALTER TABLE public.ab_tests ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated can delete ab_tests" ON public.ab_tests;
DROP POLICY IF EXISTS "Authenticated can insert ab_tests" ON public.ab_tests;
DROP POLICY IF EXISTS "Authenticated can read ab_tests" ON public.ab_tests;
DROP POLICY IF EXISTS "Authenticated can update ab_tests" ON public.ab_tests;
DROP POLICY IF EXISTS "Users manage own ab_tests" ON public.ab_tests;

CREATE POLICY "Users manage own ab_tests"
  ON public.ab_tests FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
