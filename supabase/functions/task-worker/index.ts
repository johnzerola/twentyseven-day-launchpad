import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENCY = parseInt(Deno.env.get("TASK_WORKER_CONCURRENCY") || "2");
const BACKOFF_BASE_MS = 5000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  try {
    // Fetch pending tasks (limit by concurrency)
    const { data: tasks } = await sb
      .from("task_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_CONCURRENCY);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No pending tasks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const task of tasks) {
      // Mark as running
      await sb.from("task_queue")
        .update({ status: "running", started_at: new Date().toISOString(), attempts: task.attempts + 1 })
        .eq("id", task.id);

      try {
        let result: any = null;

        // Route task to appropriate handler
        switch (task.task_type) {
          case "detect_emerging_channels":
            // Call the detect-emerging-channels function
            const detectResp = await fetch(`${supabaseUrl}/functions/v1/detect-emerging-channels`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await detectResp.json();
            break;

          case "weekly_deep_research":
            const weeklyResp = await fetch(`${supabaseUrl}/functions/v1/weekly-deep-research`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await weeklyResp.json();
            break;

          case "auto_enrich_videos":
            const enrichResp = await fetch(`${supabaseUrl}/functions/v1/auto-enrich-worker`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await enrichResp.json();
            break;

          case "self_learning":
            const learnResp = await fetch(`${supabaseUrl}/functions/v1/self-learning-engine`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await learnResp.json();
            break;

          case "orchestrate_video":
            const orchResp = await fetch(`${supabaseUrl}/functions/v1/video-orchestrator`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await orchResp.json();
            break;

          case "generate_prompts":
            const promptsResp = await fetch(`${supabaseUrl}/functions/v1/generate-synced-prompts`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await promptsResp.json();
            break;

          case "reverse_engineer":
            const reverseResp = await fetch(`${supabaseUrl}/functions/v1/reverse-engineer-video`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await reverseResp.json();
            break;

          case "viral_score_recalc":
            const scoreResp = await fetch(`${supabaseUrl}/functions/v1/monetiza-score`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ ...task.payload, action: "recalculate_batch" }),
            });
            result = await scoreResp.json();
            break;

          case "autoflow_execute":
            const autoflowResp = await fetch(`${supabaseUrl}/functions/v1/generate-veo3-video`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await autoflowResp.json();
            break;

          case "daily_ingestion":
            const ingestResp = await fetch(`${supabaseUrl}/functions/v1/daily-data-ingestion`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify(task.payload || {}),
            });
            result = await ingestResp.json();
            break;

          default:
            result = { warning: `Unknown task_type: ${task.task_type}` };

        // Mark done
        await sb.from("task_queue")
          .update({
            status: "done",
            result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", task.id);

        results.push({ id: task.id, task_type: task.task_type, status: "done" });

      } catch (e) {
        const attempts = task.attempts + 1;
        const shouldRetry = attempts < (task.max_attempts || 3);

        if (shouldRetry) {
          // Schedule retry with exponential backoff
          const backoff = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
          const nextSchedule = new Date(Date.now() + backoff).toISOString();

          await sb.from("task_queue")
            .update({
              status: "pending",
              error_message: e.message,
              scheduled_at: nextSchedule,
            })
            .eq("id", task.id);

          results.push({ id: task.id, task_type: task.task_type, status: "retry", next_attempt: nextSchedule });
        } else {
          await sb.from("task_queue")
            .update({
              status: "failed",
              error_message: e.message,
              completed_at: new Date().toISOString(),
            })
            .eq("id", task.id);

          results.push({ id: task.id, task_type: task.task_type, status: "failed", error: e.message });
        }
      }
    }

    await sb.from("execution_logs").insert({
      function_name: "task-worker",
      duration_ms: Date.now() - startTime,
      success: true,
      metadata: { tasks_processed: results.length, results },
    });

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await sb.from("execution_logs").insert({
      function_name: "task-worker",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
