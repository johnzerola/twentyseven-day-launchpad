
-- ═══════════════════════════════════════════════════════════════
-- SECURITY HARDENING MIGRATION v2
-- ═══════════════════════════════════════════════════════════════

-- 1. STORAGE
DROP POLICY IF EXISTS "Users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

CREATE POLICY "Users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. user_subscriptions: remove UPDATE
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

-- 3. INTERNAL TABLES: remove public SELECT
DROP POLICY IF EXISTS "Authenticated can read task_queue" ON public.task_queue;
DROP POLICY IF EXISTS "Authenticated can read execution_logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Anyone can read execution_logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Authenticated can read api_config" ON public.api_config;
DROP POLICY IF EXISTS "Anyone can read api_config" ON public.api_config;
DROP POLICY IF EXISTS "Public can read api_config" ON public.api_config;
DROP POLICY IF EXISTS "Authenticated can read api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "Anyone can read api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "Public can read api_usage" ON public.api_usage;

-- 4. MATERIALIZED VIEWS: revoke public access
REVOKE SELECT ON public.mv_niche_benchmarks FROM anon, authenticated;
REVOKE SELECT ON public.mv_avg_scores_by_niche FROM anon, authenticated;
REVOKE SELECT ON public.mv_top_hooks_by_niche FROM anon, authenticated;
REVOKE SELECT ON public.mv_top_titles_by_views FROM anon, authenticated;

-- Security definer function (generic JSONB return to avoid column mismatch)
CREATE OR REPLACE FUNCTION public.get_niche_benchmarks(_niche text DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM public.mv_niche_benchmarks t
  WHERE (_niche IS NULL OR t.niche = _niche);
$$;

-- 5. OAUTH STATE TOKENS
CREATE POLICY "Users can insert own state tokens"
ON public.oauth_state_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own state tokens"
ON public.oauth_state_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own state tokens"
ON public.oauth_state_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.oauth_state_tokens WHERE expires_at < now();
END;
$$;

-- 6. FIX handle_new_user (starter + 100)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_subscriptions (user_id, tier, credits_remaining, credits_monthly_limit, max_devices)
  VALUES (NEW.id, 'starter', 100, 100, 1);

  RETURN NEW;
END;
$$;
