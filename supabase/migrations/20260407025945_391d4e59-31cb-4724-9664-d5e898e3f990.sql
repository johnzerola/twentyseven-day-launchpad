-- Materialized view: benchmark por nicho + formato + idioma
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_niche_benchmarks AS
SELECT
  COALESCE(cd.niche, 'unknown') AS niche,
  CASE
    WHEN cd.duration_seconds IS NOT NULL AND cd.duration_seconds <= 60 THEN 'short'
    WHEN cd.duration_seconds IS NOT NULL AND cd.duration_seconds <= 600 THEN 'medium'
    ELSE 'long'
  END AS format,
  COALESCE(cd.language, 'en') AS language,
  ROUND(AVG(cd.estimated_retention)::numeric, 1) AS avg_retention,
  ROUND(AVG(cd.views)::numeric, 0) AS avg_views,
  ROUND(AVG(cd.viral_score)::numeric, 1) AS avg_viral_score,
  ROUND(AVG(cd.hook_strength)::numeric, 1) AS avg_hook_strength,
  ROUND(AVG(cd.attention_score)::numeric, 1) AS avg_attention_score,
  MAX(cd.estimated_retention) AS top_retention,
  MAX(cd.views) AS top_views,
  COUNT(*) AS sample_count
FROM public.content_dna cd
WHERE cd.views > 1000
GROUP BY 
  COALESCE(cd.niche, 'unknown'),
  CASE
    WHEN cd.duration_seconds IS NOT NULL AND cd.duration_seconds <= 60 THEN 'short'
    WHEN cd.duration_seconds IS NOT NULL AND cd.duration_seconds <= 600 THEN 'medium'
    ELSE 'long'
  END,
  COALESCE(cd.language, 'en')
HAVING COUNT(*) >= 3;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_niche_benchmarks_lookup
ON public.mv_niche_benchmarks (niche, format, language);

-- Update refresh function to include new view
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$ 
BEGIN 
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_niche_benchmarks;
  REFRESH MATERIALIZED VIEW public.mv_top_hooks_by_niche; 
  REFRESH MATERIALIZED VIEW public.mv_top_titles_by_views; 
  REFRESH MATERIALIZED VIEW public.mv_avg_scores_by_niche; 
END; 
$$;

-- View to track real CTR/retention per output type (titles, hooks, thumbnails)
CREATE TABLE IF NOT EXISTS public.output_performance_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  output_type TEXT NOT NULL, -- 'title', 'hook', 'thumbnail', 'script'
  output_content TEXT,
  script_id UUID,
  youtube_video_id TEXT,
  predicted_ctr NUMERIC,
  predicted_retention NUMERIC,
  actual_ctr NUMERIC,
  actual_retention NUMERIC,
  actual_views INTEGER,
  prediction_error_ctr NUMERIC GENERATED ALWAYS AS (
    CASE WHEN predicted_ctr IS NOT NULL AND actual_ctr IS NOT NULL 
    THEN ABS(predicted_ctr - actual_ctr) ELSE NULL END
  ) STORED,
  prediction_error_retention NUMERIC GENERATED ALWAYS AS (
    CASE WHEN predicted_retention IS NOT NULL AND actual_retention IS NOT NULL 
    THEN ABS(predicted_retention - actual_retention) ELSE NULL END
  ) STORED,
  niche TEXT,
  format TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.output_performance_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
ON public.output_performance_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
ON public.output_performance_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
ON public.output_performance_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_output_feedback_user ON public.output_performance_feedback(user_id);
CREATE INDEX idx_output_feedback_type ON public.output_performance_feedback(output_type);
CREATE INDEX idx_output_feedback_niche ON public.output_performance_feedback(niche, format, language);