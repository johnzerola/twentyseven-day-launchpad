import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AUTO-INTELLIGENCE CRON
 * 
 * Single entry point that orchestrates ALL auto-feeding tasks.
 * Called by pg_cron — no manual intervention needed.
 * 
 * Schedule: Sunday 02:00 UTC (weekly deep), Daily 06:00 UTC (light)
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
      report.push({ function: name, success: false, error: e.message });
      return { ok: false, data: null };
    }
  }

  try {
    // ═══ DAILY TASKS (every day at 06:00 UTC) ═══
    if (schedule === "daily" || schedule === "weekly") {
      // 1. Track video performance for all users
      await invokeFunction("track-video-performance", { mode: "check_all" });

      // 2. Daily data ingestion (Brave search + task queue)
      await invokeFunction("daily-data-ingestion", {});

      // 3. Light self-learning (just scan trending + update patterns)
      await invokeFunction("self-learning-engine", { mode: "scan_trending", maxVideos: 5 });
    }

    // ═══ WEEKLY TASKS (Sunday 02:00 UTC) ═══
    if (schedule === "weekly") {
      // 4. Full self-learning cycle
      await invokeFunction("self-learning-engine", { mode: "full_cycle", maxVideos: 10 });

      // 5. Intelligence sync
      await invokeFunction("intelligence-sync-engine", { mode: "sync_viral_to_knowledge" });
      await invokeFunction("intelligence-sync-engine", { mode: "cross_pollinate" });

      // 6. Backfill embeddings for RAG
      await invokeFunction("backfill-embeddings", { batchSize: 5 });

      // 7. Deep research
      await invokeFunction("weekly-deep-research", {});

      // 8. Detect emerging channels
      await invokeFunction("detect-emerging-channels", {});

      // 9. Check rankings for tracked videos
      await invokeFunction("track-video-performance", { mode: "check_rankings" });
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
      error_message: e.message,
    });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
