import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    // Get top niches for deep analysis
    const { data: niches } = await sb
      .from("niche_database")
      .select("name, country, rpm_estimate")
      .order("rpm_estimate", { ascending: false })
      .limit(3);

    // Get recent emerging channels for context
    const { data: emerging } = await sb
      .from("emerging_channels")
      .select("channel_title, niche, viral_score")
      .order("viral_score", { ascending: false })
      .limit(10);

    const results: any[] = [];
    let apiCalls = 0;

    for (const niche of (niches || [])) {
      const cacheKey = `weekly_deep_${niche.name}_${new Date().toISOString().slice(0, 10)}`;

      // Check cache (30 day TTL)
      const { data: cached } = await sb
        .from("research_cache")
        .select("result_json")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        results.push({ niche: niche.name, cached: true });
        continue;
      }

      // Check API limit
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "gemini" });
      if (!allowed) {
        results.push({ niche: niche.name, skipped: true, reason: "limit" });
        continue;
      }

      // Use Lovable AI Gateway (Gemini) for deep research
      if (!LOVABLE_API_KEY) {
        results.push({ niche: niche.name, skipped: true, reason: "no_api_key" });
        continue;
      }

      try {
        const emergingContext = (emerging || [])
          .filter(e => e.niche === niche.name)
          .map(e => `${e.channel_title} (score: ${e.viral_score})`)
          .join(", ");

        const prompt = `Analyze the YouTube niche "${niche.name}" (country: ${niche.country}, est. RPM: $${niche.rpm_estimate}). 
Recent emerging channels: ${emergingContext || "none detected yet"}.

Provide a comprehensive weekly report covering:
1. Current market saturation level (low/medium/high)
2. Top 3 content angles that are working NOW
3. Monetization opportunities beyond AdSense
4. Predicted trends for next 30 days
5. Recommended video topics (5 specific ideas)
6. Risk factors and threats

Format as structured JSON.`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube market analyst. Return structured JSON reports." },
              { role: "user", content: prompt },
            ],
          }),
        });

        const aiData = await aiResp.json();
        apiCalls++;

        const report = aiData.choices?.[0]?.message?.content || "No analysis generated";

        // Cache for 30 days
        const ttl = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
        await sb.from("research_cache").upsert({
          cache_key: cacheKey,
          source: "gemini_weekly",
          result_json: { report, niche: niche.name, generated_at: new Date().toISOString() },
          expires_at: ttl,
          query: `weekly_deep_research_${niche.name}`,
          ttl: ttl,
        }, { onConflict: "cache_key" });

        results.push({ niche: niche.name, success: true });
      } catch (e) {
        results.push({ niche: niche.name, error: e.message });
      }
    }

    await sb.from("execution_logs").insert({
      function_name: "weekly-deep-research",
      duration_ms: Date.now() - startTime,
      success: true,
      api_calls_made: apiCalls,
      metadata: { results },
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await sb.from("execution_logs").insert({
      function_name: "weekly-deep-research",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
