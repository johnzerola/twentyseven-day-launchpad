import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AUTO-INTELLIGENCE CRON V3
 * 
 * Single entry point that orchestrates ALL auto-feeding tasks.
 * Called by pg_cron — no manual intervention needed.
 * 
 * Schedule:
 *   - Daily 06:00 UTC: light tasks (performance, backtesting, learning, calibration)
 *   - Daily 12:00 UTC: mid-day velocity + pre-viral detection
 *   - Sunday 02:00 UTC: weekly deep (full cycle, research, evolution)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // OPTIMIZED: Everything runs ONCE per day to save AI credits
  const { schedule = "daily" } = await req.json().catch(() => ({}));
  const report: any[] = [];

  async function invokeFunction(name: string, body: any = {}) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      report.push({ function: name, success: res.ok, status: res.status, data: JSON.stringify(data).slice(0, 200) });
      return { ok: res.ok, data };
    } catch (e) {
      report.push({ function: name, success: false, error: (e as Error).message });
      return { ok: false, data: null };
    }
  }

  try {
    // ═══ SINGLE DAILY RUN (06:00 UTC) — all tasks consolidated ═══
    
    // 1. Sync real video metrics (no AI)
    await invokeFunction("sync-video-metrics", {});

    // 2. Track video performance
    await invokeFunction("track-video-performance", { mode: "check_all" });

    // 3. Daily data ingestion (Brave search + task queue)
    await invokeFunction("daily-data-ingestion", {});

    // 4. Light self-learning
    await invokeFunction("self-learning-engine", { mode: "scan_trending", maxVideos: 3 });

    // 5. Backfill embeddings
    await invokeFunction("backfill-embeddings", { batchSize: 3 });

    // 6. Intelligence sync
    await invokeFunction("intelligence-sync-engine", { mode: "user_activity_feed" });

    // 7. Backtesting
    await invokeFunction("backtest-scores", {});

    // 8. Velocity snapshot (1x/day instead of 2x)
    await invokeFunction("velocity-tracker", {});

    // 9. Self-learning engine (merged from worker — single canonical entry point)
    await invokeFunction("self-learning-engine", { mode: "worker_cycle" });

    // 10. Pre-viral detection (1x/day instead of 2x)
    await invokeFunction("pre-viral-detection", {});

    // ═══ WEEKLY EXTRAS (Sunday only) ═══
    const isWeekly = schedule === "weekly" || new Date().getUTCDay() === 0;

    // ═══ WEEKLY TASKS (Sunday 02:00 UTC) ═══
    if (isWeekly) {
      await invokeFunction("self-learning-engine", { mode: "full_cycle", maxVideos: 5 });
      await invokeFunction("intelligence-sync-engine", { mode: "sync_viral_to_knowledge" });
      await invokeFunction("weekly-deep-research", {});
      await invokeFunction("detect-emerging-channels", {});
      await invokeFunction("weekly-channel-rescan", {});
      await invokeFunction("viral-score-worker", {});
      await invokeFunction("niche-benchmark", {});
      await invokeFunction("generate-adaptive-plan", { mode: "all_users" });

      try {
        await sb.rpc("refresh_materialized_views");
        report.push({ function: "refresh_materialized_views", success: true });
      } catch (e) {
        report.push({ function: "refresh_materialized_views", success: false, error: (e as Error).message });
      }

      await sb.from("emerging_videos")
        .update({ status: "confirmed_viral", confirmed_viral_at: new Date().toISOString() })
        .eq("status", "pre_viral")
        .gt("views", 100000);
    }

    await sb.from("execution_logs").insert({
      function_name: "auto-intelligence-cron",
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: { schedule, tasks_run: report.length, report },
    });

    return new Response(JSON.stringify({ success: true, schedule, tasks: report.length, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await sb.from("execution_logs").insert({
      function_name: "auto-intelligence-cron",
      success: false,
      duration_ms: Date.now() - startTime,
      error_message: (e as Error).message,
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
