import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENCY = parseInt(Deno.env.get("TASK_WORKER_CONCURRENCY") || "2");
const BACKOFF_BASE_MS = 5000;

// ═══════════════════════════════════════════════════════════════════
// ECONOMY CONFIG — Global daily limits for background tasks
// ═══════════════════════════════════════════════════════════════════
const MAX_TASK_WORKER_RUNS_PER_DAY = 10; // Was unlimited

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ═══════════════════════════════════════════════════════════════
  // THROTTLE — Limit total runs per day
  // ═══════════════════════════════════════════════════════════════
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayLogs } = await sb.from("execution_logs")
    .select("id")
    .eq("function_name", "task-worker")
    .eq("success", true)
    .gte("created_at", `${today}T00:00:00Z`);

  if ((todayLogs?.length || 0) >= MAX_TASK_WORKER_RUNS_PER_DAY) {
    return new Response(JSON.stringify({
      success: true,
      throttled: true,
      reason: `Task worker daily limit reached (${todayLogs?.length}/${MAX_TASK_WORKER_RUNS_PER_DAY})`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callFn = async (fnName: string, payload: any) => {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(payload || {}),
    });
    return await resp.json();
  };

  try {
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
      await sb.from("task_queue")
        .update({ status: "running", started_at: new Date().toISOString(), attempts: task.attempts + 1 })
        .eq("id", task.id);

      try {
        let result: any = null;

        switch (task.task_type) {
          case "detect_emerging_channels":
            result = await callFn("detect-emerging-channels", task.payload);
            break;
          case "weekly_deep_research":
            result = await callFn("weekly-deep-research", task.payload);
            break;
          case "auto_enrich_videos":
            result = await callFn("auto-enrich-worker", task.payload);
            break;
          case "self_learning":
            result = await callFn("self-learning-engine", task.payload);
            break;
          case "orchestrate_video":
            result = await callFn("video-orchestrator", task.payload);
            break;
          case "generate_prompts":
            result = await callFn("generate-synced-prompts", task.payload);
            break;
          case "reverse_engineer":
            result = await callFn("reverse-engineer-video", task.payload);
            break;
          case "viral_score_recalc":
            result = await callFn("monetiza-score", { ...task.payload, action: "recalculate_batch" });
            break;
          case "autoflow_execute":
            result = await callFn("generate-veo3-video", task.payload);
            break;
          case "daily_ingestion":
            result = await callFn("daily-data-ingestion", task.payload);
            break;
          case "viral_score_scan":
            result = await callFn("viral-score-worker", { action: "scan", ...(task.payload || {}) });
            break;
          default:
            result = { warning: `Unknown task_type: ${task.task_type}` };
            break;
        }

        await sb.from("task_queue")
          .update({ status: "done", result, completed_at: new Date().toISOString() })
          .eq("id", task.id);

        results.push({ id: task.id, task_type: task.task_type, status: "done" });
      } catch (e: any) {
        const attempts = task.attempts + 1;
        const shouldRetry = attempts < (task.max_attempts || 3);

        if (shouldRetry) {
          const backoff = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
          await sb.from("task_queue")
            .update({ status: "pending", error_message: e.message, scheduled_at: new Date(Date.now() + backoff).toISOString() })
            .eq("id", task.id);
          results.push({ id: task.id, task_type: task.task_type, status: "retry" });
        } else {
          await sb.from("task_queue")
            .update({ status: "failed", error_message: e.message, completed_at: new Date().toISOString() })
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
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, processed: results, economy_mode: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    await sb.from("execution_logs").insert({
      function_name: "task-worker",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    }).catch(() => {});
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
