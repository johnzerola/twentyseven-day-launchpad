
-- Remove all high-frequency jobs that waste API quota
SELECT cron.unschedule(11);
SELECT cron.unschedule(12);
SELECT cron.unschedule(18);
SELECT cron.unschedule(19);
SELECT cron.unschedule(20);
SELECT cron.unschedule(21);
SELECT cron.unschedule(30);

-- Recreate all as WEEKLY (Sunday) with staggered times
SELECT cron.schedule('weekly-task-worker', '0 2 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/task-worker',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"time": "now"}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-data-ingestion', '0 3 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/daily-data-ingestion',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"time": "now"}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-detect-emerging', '0 4 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/detect-emerging-channels',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"time": "now"}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-build-viral-titles', '0 5 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/build-viral-titles-db',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"niche": null, "maxResults": 50}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-viral-score', '0 6 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/viral-score-worker',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"action": "scan", "limit": 50}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-auto-enrich', '0 7 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/auto-enrich-worker',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"limit": 30}'::jsonb
) AS request_id;$$);

SELECT cron.schedule('weekly-intelligence-sync', '0 8 * * 0',
$$SELECT net.http_post(
  url:='https://nwnjopqxcqpvcelswvyt.supabase.co/functions/v1/intelligence-sync-engine',
  headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bmpvcHF4Y3FwdmNlbHN3dnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzkwNTcsImV4cCI6MjA4ODY1NTA1N30.V__u_U9l_HJ6Fjeh02aXGt6w_kfwFs12dqWdxPJW3dg"}'::jsonb,
  body:='{"mode": "full"}'::jsonb
) AS request_id;$$);
