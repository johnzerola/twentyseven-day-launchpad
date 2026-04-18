import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSpan } from "../_shared/tracer.ts";
import { callEdgeFn } from "../_shared/call-fn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trace-id, x-parent-span-id",
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
  const rootSpan = await startSpan(req, "task-worker", { input: { trigger: "cron" } });

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
    try {
      return await callEdgeFn(fnName, payload, { parentSpan: rootSpan });
    } catch (e: any) {
      return { error: e.message };
    }
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
    let totalFailed = 0;

    for (const task of tasks) {
      const taskStart = Date.now();
      await sb.from("task_queue")
        .update({ status: "running", started_at: new Date().toISOString(), attempts: task.attempts + 1 })
        .eq("id", task.id);

      // Log progress for each task
      await sb.from("execution_logs").insert({
        function_name: `task-worker:${task.task_type}`,
        success: true,
        metadata: { phase: "started", task_id: task.id, attempt: task.attempts + 1 },
      }).catch(() => {});

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
          case "smart_knowledge":
            result = await callFn("smart-knowledge-retrieval", task.payload);
            break;
          case "calibrate_knowledge":
            result = await callFn("calibrate-knowledge", task.payload);
            break;
          default:
            result = { warning: `Unknown task_type: ${task.task_type}` };
            break;
        }

        // Check if the called function returned an error
        const hasError = result?.error || result?.status === 'error';
        if (hasError) {
          throw new Error(result.error || result.message || 'Function returned error');
        }

        await sb.from("task_queue")
          .update({ status: "done", result, completed_at: new Date().toISOString() })
          .eq("id", task.id);

        await sb.from("execution_logs").insert({
          function_name: `task-worker:${task.task_type}`,
          success: true,
          duration_ms: Date.now() - taskStart,
          metadata: { phase: "completed", task_id: task.id },
        }).catch(() => {});

        results.push({ id: task.id, task_type: task.task_type, status: "done" });
      } catch (e: any) {
        const attempts = task.attempts + 1;
        const shouldRetry = attempts < (task.max_attempts || 3);
        totalFailed++;

        // Log failure with full context
        await sb.from("execution_logs").insert({
          function_name: `task-worker:${task.task_type}`,
          success: false,
          duration_ms: Date.now() - taskStart,
          error_message: e.message?.slice(0, 500),
          metadata: {
            phase: shouldRetry ? "retry_scheduled" : "permanently_failed",
            task_id: task.id,
            attempt: attempts,
            max_attempts: task.max_attempts || 3,
            payload_preview: JSON.stringify(task.payload || {}).slice(0, 200),
          },
        }).catch(() => {});

        if (shouldRetry) {
          const backoff = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
          await sb.from("task_queue")
            .update({ status: "pending", error_message: e.message, scheduled_at: new Date(Date.now() + backoff).toISOString() })
            .eq("id", task.id);
          results.push({ id: task.id, task_type: task.task_type, status: "retry", next_attempt_in_ms: backoff });
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
      success: totalFailed === 0,
      error_message: totalFailed > 0 ? `${totalFailed}/${results.length} tasks failed` : null,
      metadata: { tasks_processed: results.length, failed: totalFailed, results },
    }).catch(() => {});

    await rootSpan.end(totalFailed === 0 ? "success" : "error", { processed: results.length, failed: totalFailed }, totalFailed > 0 ? `${totalFailed} tasks failed` : undefined, { tasks_processed: results.length });
    return new Response(JSON.stringify({ success: true, processed: results, trace_id: rootSpan.traceId, economy_mode: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": rootSpan.traceId },
    });

  } catch (e: any) {
    await sb.from("execution_logs").insert({
      function_name: "task-worker",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    }).catch(() => {});
    await rootSpan.end("error", null, e.message);
    return new Response(JSON.stringify({ error: e.message, trace_id: rootSpan.traceId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": rootSpan.traceId },
    });
  }
});
