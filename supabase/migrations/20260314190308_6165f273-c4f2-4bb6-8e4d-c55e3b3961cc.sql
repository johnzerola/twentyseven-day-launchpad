
-- Fix search_path for new functions
CREATE OR REPLACE FUNCTION public.calculate_velocity_score(_views_per_hour numeric, _engagement_rate numeric, _growth_acceleration numeric) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$ SELECT ROUND((LEAST(_views_per_hour / 100.0, 100) * 0.5) + (LEAST(_engagement_rate * 100, 100) * 0.3) + (LEAST(_growth_acceleration, 100) * 0.2), 2) $$;

CREATE OR REPLACE FUNCTION public.calculate_pre_viral_score(_view_ratio numeric, _velocity_score numeric, _engagement_rate numeric, _recency_factor numeric) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$ SELECT ROUND((LEAST(_view_ratio, 100) * 0.4) + (LEAST(_velocity_score, 100) * 0.3) + (LEAST(_engagement_rate * 100, 100) * 0.2) + (LEAST(_recency_factor, 100) * 0.1), 2) $$;
