
-- Remove tables from Realtime publication (no IF EXISTS needed — safe to run)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.video_performance;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.processing_jobs;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END;
$$;
