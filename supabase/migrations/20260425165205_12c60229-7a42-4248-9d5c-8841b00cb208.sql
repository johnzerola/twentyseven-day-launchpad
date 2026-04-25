-- Fix #1: Recriar a view sem SECURITY DEFINER (default é SECURITY INVOKER)
DROP VIEW IF EXISTS public.v_channel_top_performers;

CREATE VIEW public.v_channel_top_performers
WITH (security_invoker = true) AS
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

-- Fix #2: Substituir a policy "always true" de INSERT por uma com WITH CHECK específico
DROP POLICY IF EXISTS "Service role can insert audits" ON public.pre_upload_audits;

CREATE POLICY "Service role manages audits"
  ON public.pre_upload_audits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permitir que o usuário insira sua própria auditoria (usado se o frontend chamar direto)
CREATE POLICY "Users can insert their own audits"
  ON public.pre_upload_audits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);