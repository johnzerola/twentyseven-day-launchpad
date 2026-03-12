import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEARCH_DOMAINS = [
  {
    domain: "youtube_algorithm",
    prompt: `Research the latest YouTube algorithm changes and strategies for 2025-2026. Focus on:
1. CTR optimization tactics that are working NOW
2. Audience retention engineering techniques
3. New ranking signals YouTube is using
4. How the recommendation system has changed recently
5. Upload frequency and scheduling strategies that maximize reach
6. Shorts vs long-form algorithm differences
Return structured JSON with: { insights: [{ title, content, priority (1-10), category }] }`,
    target_table: "youtube_knowledge",
  },
  {
    domain: "viral_storytelling",
    prompt: `Research the most effective storytelling techniques used in viral YouTube videos right now. Focus on:
1. Curiosity gap techniques that keep viewers watching
2. Open loop strategies used by top creators
3. Emotional escalation patterns in high-retention videos
4. Hook formulas with proven 80%+ 30-second retention
5. Narrative structures that generate the most engagement
6. Dopamine trigger patterns in successful video scripts
Return structured JSON with: { techniques: [{ title, content, category (hook/structure/technique/psychology), effectiveness_score (1-10), examples }] }`,
    target_table: "script_knowledge",
  },
  {
    domain: "content_formats",
    prompt: `Research the most viral content formats on YouTube right now. Focus on:
1. Which video formats are getting the most views in 2025-2026
2. Emerging content formats that are growing fast
3. Documentary-style formats that work for faceless channels
4. Storytelling formats with highest audience retention
5. Format innovations that are disrupting traditional YouTube
Return structured JSON with: { formats: [{ name, structure, hooks (array of example hooks), retention_tips, avg_retention, best_niches (array) }] }`,
    target_table: "viral_content_library",
  },
  {
    domain: "niche_opportunities",
    prompt: `Research the most profitable and underserved YouTube niches right now. Focus on:
1. Niches with high RPM that are not yet saturated
2. Emerging niches showing explosive growth
3. Faceless-friendly niches with the best monetization potential
4. Geographic opportunities (which countries/languages are underserved)
5. Sub-niche opportunities within established niches
Return structured JSON with: { niches: [{ name, rpm_estimate, saturation (low/medium/high), growth_rate, faceless_friendly (boolean), best_countries (array), sub_niches (array) }] }`,
    target_table: "niche_database",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

  try {
    // Get context from existing data
    const { data: topNiches } = await sb
      .from("niche_database")
      .select("name, country, rpm_estimate")
      .order("rpm_estimate", { ascending: false })
      .limit(5);

    const { data: emerging } = await sb
      .from("emerging_channels")
      .select("channel_title, niche, viral_score")
      .order("viral_score", { ascending: false })
      .limit(10);

    const emergingContext = (emerging || [])
      .map(e => `${e.channel_title} (${e.niche}, score: ${e.viral_score})`)
      .join(", ");

    const nicheContext = (topNiches || [])
      .map(n => `${n.name} (RPM: $${n.rpm_estimate}, ${n.country})`)
      .join(", ");

    const results: any[] = [];
    let apiCalls = 0;

    for (const domain of RESEARCH_DOMAINS) {
      const dateKey = new Date().toISOString().slice(0, 10);
      const cacheKey = `weekly_${domain.domain}_${dateKey}`;

      // Check cache (7 day TTL for weekly research)
      const { data: cached } = await sb
        .from("research_cache")
        .select("result_json")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        results.push({ domain: domain.domain, cached: true });
        continue;
      }

      // Try Perplexity first for deep research (better web grounding)
      let researchResult: any = null;

      if (PERPLEXITY_API_KEY) {
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "perplexity" });
        if (allowed) {
          try {
            const contextPrompt = `Context — Top niches: ${nicheContext}. Emerging channels: ${emergingContext || "none yet"}.\n\n${domain.prompt}`;
            
            const pResp = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "sonar-pro",
                messages: [
                  { role: "system", content: "You are a YouTube market intelligence analyst. Return structured JSON reports based on real, current data. Be specific with numbers and examples." },
                  { role: "user", content: contextPrompt },
                ],
              }),
            });

            if (pResp.ok) {
              const pData = await pResp.json();
              researchResult = {
                content: pData.choices?.[0]?.message?.content || "",
                citations: pData.citations || [],
                source: "perplexity_sonar_pro",
              };
              apiCalls++;
            }
          } catch (e) {
            console.error(`Perplexity error for ${domain.domain}:`, e.message);
          }
        }
      }

      // Fallback to Lovable AI Gateway (Gemini)
      if (!researchResult && LOVABLE_API_KEY) {
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "gemini" });
        if (allowed) {
          try {
            const contextPrompt = `Context — Top niches: ${nicheContext}. Emerging channels: ${emergingContext || "none yet"}.\n\n${domain.prompt}`;

            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You are a YouTube market intelligence analyst. Return structured JSON reports." },
                  { role: "user", content: contextPrompt },
                ],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              researchResult = {
                content: aiData.choices?.[0]?.message?.content || "",
                source: "gemini_flash",
              };
              apiCalls++;
            }
          } catch (e) {
            console.error(`Gemini error for ${domain.domain}:`, e.message);
          }
        }
      }

      if (!researchResult) {
        results.push({ domain: domain.domain, skipped: true, reason: "no_api_available" });
        continue;
      }

      // Cache for 7 days
      const ttl = new Date(Date.now() + 7 * 24 * 3600000).toISOString();
      await sb.from("research_cache").upsert({
        cache_key: cacheKey,
        source: researchResult.source,
        result_json: {
          report: researchResult.content,
          citations: researchResult.citations || [],
          domain: domain.domain,
          generated_at: new Date().toISOString(),
        },
        expires_at: ttl,
        query: `weekly_deep_research_${domain.domain}`,
        ttl: ttl,
      }, { onConflict: "cache_key" });

      // Try to parse and insert into target knowledge tables
      try {
        const jsonMatch = researchResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          await ingestResearchData(sb, domain, parsed);
        }
      } catch {
        // Parsing failed — research is still cached for manual review
      }

      results.push({ domain: domain.domain, success: true, source: researchResult.source });
    }

    await sb.from("execution_logs").insert({
      function_name: "weekly-deep-research",
      duration_ms: Date.now() - startTime,
      success: true,
      api_calls_made: apiCalls,
      metadata: { results, domains_processed: RESEARCH_DOMAINS.length },
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

async function ingestResearchData(sb: any, domain: any, parsed: any) {
  try {
    if (domain.target_table === "youtube_knowledge" && parsed.insights) {
      for (const insight of parsed.insights.slice(0, 10)) {
        await sb.from("youtube_knowledge").insert({
          category: insight.category || "auto-research",
          title: insight.title || "Untitled Insight",
          content: insight.content || "",
          priority: insight.priority || 5,
          source: "weekly-deep-research",
          tags: JSON.stringify(["auto-research", domain.domain]),
        });
      }
    }

    if (domain.target_table === "script_knowledge" && parsed.techniques) {
      for (const tech of parsed.techniques.slice(0, 10)) {
        await sb.from("script_knowledge").insert({
          category: tech.category || "auto-research",
          title: tech.title || "Untitled Technique",
          content: tech.content || "",
          effectiveness_score: tech.effectiveness_score || 7,
          examples: JSON.stringify(tech.examples || []),
        });
      }
    }

    if (domain.target_table === "viral_content_library" && parsed.formats) {
      for (const fmt of parsed.formats.slice(0, 5)) {
        await sb.from("viral_content_library").insert({
          category: "content_format",
          content_json: fmt,
          language: "en",
          niches: fmt.best_niches || [],
          effectiveness_score: 8,
        });
      }
    }
  } catch (e) {
    console.error("Ingestion error:", e.message);
  }
}
