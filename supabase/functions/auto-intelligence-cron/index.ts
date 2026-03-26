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
    // ═══ DAILY TASKS (every day at 06:00 UTC) ═══
    if (schedule === "daily" || schedule === "weekly") {
      // 1. Sync real video metrics
      await invokeFunction("sync-video-metrics", {});

      // 2. Track video performance for all users
      await invokeFunction("track-video-performance", { mode: "check_all" });

      // 3. Daily data ingestion (Brave search + task queue)
      await invokeFunction("daily-data-ingestion", {});

      // 4. Light self-learning (scan trending + update patterns)
      await invokeFunction("self-learning-engine", { mode: "scan_trending", maxVideos: 5 });

      // 5. Daily backfill embeddings
      await invokeFunction("backfill-embeddings", { batchSize: 3 });

      // 6. Intelligence sync (user activity feed)
      await invokeFunction("intelligence-sync-engine", { mode: "user_activity_feed" });

      // 7. Ranking check for tracked videos
      await invokeFunction("track-video-performance", { mode: "check_rankings" });

      // 8. Backtesting — compare predictions vs reality
      await invokeFunction("backtest-scores", {});

      // 9. Pattern evolution — adjust hooks/patterns based on real results
      await invokeFunction("evolve-patterns", {});

      // 10. Velocity snapshots
      await invokeFunction("velocity-tracker", {});

      // 11. Self-learning worker — close feedback loop & calibrate weights
      await invokeFunction("self-learning-worker", {});

      // 12. Pre-viral detection — find videos about to explode
      await invokeFunction("pre-viral-detection", {});

      // 13. Extract user learnings from linked videos
      await invokeFunction("extract-user-learnings", {});
    }

    // ═══ MIDDAY VELOCITY CHECK (12:00 UTC) ═══
    if (schedule === "midday") {
      await invokeFunction("velocity-tracker", {});
      await invokeFunction("track-video-performance", { mode: "check_all" });

      // ★ NEW: Pre-viral detection on midday for faster detection
      await invokeFunction("pre-viral-detection", {});

      // ★ NEW: Self-learning worker for fresh calibration data
      await invokeFunction("self-learning-worker", {});
    }

    // ═══ WEEKLY TASKS (Sunday 02:00 UTC) ═══
    if (schedule === "weekly") {
      // Full self-learning cycle
      await invokeFunction("self-learning-engine", { mode: "full_cycle", maxVideos: 10 });

      // Intelligence sync — deep modes
      await invokeFunction("intelligence-sync-engine", { mode: "sync_viral_to_knowledge" });
      await invokeFunction("intelligence-sync-engine", { mode: "cross_pollinate" });

      // Backfill embeddings (larger batch)
      await invokeFunction("backfill-embeddings", { batchSize: 10 });

      // Deep research
      await invokeFunction("weekly-deep-research", {});

      // Detect emerging channels
      await invokeFunction("detect-emerging-channels", {});

      // Knowledge base health check
      const { data: embCount } = await sb.from("knowledge_embeddings")
        .select("id", { count: "exact", head: true });
      if ((embCount as any)?.length < 100 || !embCount) {
        await invokeFunction("backfill-embeddings", { batchSize: 20 });
      }

      // Title score calibration
      await invokeFunction("title-score", { mode: "calibrate" });

      // ★ NEW: Refresh materialized views for fresh aggregated data
      try {
        await sb.rpc("refresh_materialized_views");
        report.push({ function: "refresh_materialized_views", success: true });
      } catch (e) {
        report.push({ function: "refresh_materialized_views", success: false, error: (e as Error).message });
      }

      // ★ NEW: Update confirmed viral status on emerging_videos
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
