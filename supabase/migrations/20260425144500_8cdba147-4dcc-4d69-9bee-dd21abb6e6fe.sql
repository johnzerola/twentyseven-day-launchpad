CREATE OR REPLACE FUNCTION public.get_autopilot_cron_runs(_limit int DEFAULT 20)
RETURNS TABLE (
  jobname text,
  runid bigint,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  duration_ms numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobname::text,
    r.runid,
    r.status::text,
    r.return_message::text,
    r.start_time,
    r.end_time,
    EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000 AS duration_ms
  FROM cron.job j
  JOIN cron.job_run_details r ON r.jobid = j.jobid
  WHERE j.jobname IN ('autopilot-scheduler-daily','autopilot-recover-30min')
  ORDER BY r.start_time DESC
  LIMIT GREATEST(_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.get_autopilot_cron_runs(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_autopilot_cron_runs(int) TO authenticated;