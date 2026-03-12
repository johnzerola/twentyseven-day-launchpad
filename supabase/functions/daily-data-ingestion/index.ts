import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const results: any[] = [];
  let apiCallsMade = 0;

  try {
    // 1) Get niches to scan from niche_database
    const { data: niches } = await sb
      .from("niche_database")
      .select("name, country, language")
      .limit(10);

    const queries = (niches || []).map(n => ({
      query: `${n.name} YouTube channel`,
      niche: n.name,
      country: n.country || "US",
    }));

    // 2) For each query, check cache then call Brave Search
    for (const q of queries) {
      const cacheKey = `daily_brave_${q.niche}_${new Date().toISOString().slice(0, 10)}`;

      // Check cache
      const { data: cached } = await sb
        .from("research_cache")
        .select("result_json")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        results.push({ niche: q.niche, cached: true });
        continue;
      }

      // Check API limit
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "brave" });
      if (!allowed) {
        results.push({ niche: q.niche, skipped: true, reason: "daily_limit_reached" });
        continue;
      }

      // Call Brave Search
      const braveKey = Deno.env.get("BRAVE_API_KEY");
      if (!braveKey) {
        results.push({ niche: q.niche, skipped: true, reason: "no_api_key" });
        continue;
      }

      try {
        const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q.query)}&count=10`;
        const resp = await fetch(braveUrl, {
          headers: { "X-Subscription-Token": braveKey, Accept: "application/json" },
        });
        const data = await resp.json();
        apiCallsMade++;

        // Cache for 7 days
        const ttl = new Date(Date.now() + 7 * 24 * 3600000).toISOString();
        await sb.from("research_cache").upsert({
          cache_key: cacheKey,
          source: "brave",
          result_json: data,
          expires_at: ttl,
          query: q.query,
          ttl: ttl,
        }, { onConflict: "cache_key" });

        results.push({ niche: q.niche, success: true, results_count: data?.web?.results?.length || 0 });
      } catch (e) {
        results.push({ niche: q.niche, error: e.message });
      }
    }

    // 3) Enqueue tasks for all daily intelligence engines
    const today = new Date().toISOString().slice(0, 10);
    const dailyTasks = [
      { task_type: "detect_emerging_channels", payload: { date: today } },
      { task_type: "find_outliers", payload: { date: today, niches: (niches || []).map(n => n.name).slice(0, 5) } },
      { task_type: "build_viral_titles", payload: { date: today, niches: (niches || []).map(n => n.name).slice(0, 3) } },
    ];

    for (const task of dailyTasks) {
      const idempKey = `${task.task_type}_${today}`;
      await sb.from("task_queue").upsert({
        task_type: task.task_type,
        payload: task.payload,
        status: "pending",
        idempotency_key: idempKey,
      }, { onConflict: "idempotency_key" });
    }

    await sb.from("execution_logs").insert({
      function_name: "daily-data-ingestion",
      duration_ms: Date.now() - startTime,
      success: true,
      api_calls_made: apiCallsMade,
      metadata: { niches_processed: results.length, results },
    });

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await sb.from("execution_logs").insert({
      function_name: "daily-data-ingestion",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
