import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertBudget, logCost } from "../_shared/cost-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

// ============ RESEARCH DOMAINS ============
const RESEARCH_DOMAINS = [
  {
    id: "youtube_algorithm_2026",
    prompt: `Research the latest YouTube algorithm changes and strategies for 2025-2026. Focus on:
1. CTR optimization tactics working NOW
2. Audience retention engineering (first 30s, mid-roll, end screen)
3. New ranking signals (satisfaction surveys, long click, rewatches)
4. Shorts vs long-form algorithm differences
5. Multi-language content strategy (dubbing, subtitles boost)
6. How YouTube rewards consistency vs quality
Return JSON: { insights: [{ title, content, priority (1-10), category }] }`,
    target: "youtube_knowledge",
  },
  {
    id: "viral_storytelling_2026",
    prompt: `Research the most effective storytelling techniques in viral YouTube videos RIGHT NOW. Focus on:
1. Curiosity gap hooks with 80%+ 30-second retention
2. Open loop nesting (3+ loops simultaneously)
3. Emotional escalation arcs (anger→resolution, fear→safety)
4. Cold open/in medias res patterns
5. "Promise-Proof-Payoff" structure
6. Dopamine interval engineering (reward every 45-90 seconds)
7. Confession/vulnerability narratives
Return JSON: { techniques: [{ title, content, category, effectiveness_score (1-10), examples }] }`,
    target: "script_knowledge",
  },
  {
    id: "psychology_triggers_deep",
    prompt: `Research the most powerful psychological triggers in viral YouTube content. Include:
1. Curiosity gap — irresistible information gaps
2. Emotional conflict / moral dilemma hooks
3. Mystery & suspense — structured reveals for maximum dopamine
4. Unexpected twist patterns that cause rewatching
5. Transformation (before/after) virality
6. Social proof & FOMO tactics
7. Revenge/justice narratives (billions of views)
8. Cognitive dissonance hooks
9. Tribal identity triggers
10. Nostalgia weaponization
Return JSON: { triggers: [{ name, description, how_to_apply, score (1-10), example_titles, best_niches }] }`,
    target: "psychology",
  },
  {
    id: "niche_opportunities_2026",
    prompt: `Research the most profitable and underserved YouTube niches RIGHT NOW. Include:
1. High RPM niches not yet saturated
2. Emerging niches with explosive growth (last 6 months)
3. Faceless-friendly niches with best monetization
4. Geographic opportunities (Portuguese, Spanish, Hindi markets)
5. Sub-niche gold mines within established niches
6. AI-content-friendly niches
7. Niches with strong brand deal potential
Return JSON: { niches: [{ name, rpm_estimate, saturation, growth_rate, faceless_friendly, best_countries, sub_niches, why_now }] }`,
    target: "niche_database",
  },
  {
    id: "content_formats_trending",
    prompt: `Research the most viral content formats on YouTube in 2025-2026. Focus on:
1. Documentary-style formats for faceless channels
2. "Iceberg" tier-list deep-dives
3. POV animated stories formats
4. True crime / mystery investigation formats
5. AI-enhanced visual storytelling formats
6. Compilation / ranking formats that maximize watch time
7. "What if" scenario formats
Return JSON: { formats: [{ name, structure, hooks, retention_tips, avg_retention, best_niches }] }`,
    target: "viral_content_library",
  },
  {
    id: "hook_formulas_2026",
    prompt: `Research the most effective YouTube video hook formulas being used RIGHT NOW by top creators. Analyze:
1. Question hooks ("What if X could Y?")
2. Shocking stat hooks ("99% of people don't know...")
3. Story hooks ("3 years ago, I discovered...")
4. Challenge hooks ("I tried X for 30 days...")
5. Contrarian hooks ("Everything you know about X is wrong")
6. Mystery hooks ("Nobody can explain why X...")
7. Urgency hooks ("Before it's too late...")
8. Authority hooks ("After analyzing 1000 videos...")
Return JSON: { hooks: [{ text, type, retention_score (1-10), niche, source_inspiration }] }`,
    target: "hook_library",
  },
  {
    id: "thumbnail_seo_2026",
    prompt: `Research the latest YouTube thumbnail and SEO best practices. Include:
1. Thumbnail design patterns with highest CTR
2. Color psychology in thumbnails
3. Face vs no-face thumbnail performance
4. Text overlay best practices
5. SEO tag strategies that actually work in 2026
6. Description optimization for discovery
7. Title length and keyword placement
Return JSON: { insights: [{ title, content, priority (1-10), category }] }`,
    target: "youtube_knowledge",
  },
  {
    id: "monetization_strategies",
    prompt: `Research the most effective YouTube monetization strategies beyond AdSense. Include:
1. Sponsorship rates by niche and subscriber count
2. Affiliate marketing integration in videos
3. Digital product sales from YouTube traffic
4. Membership/Patreon conversion rates
5. Licensing and syndication opportunities
6. YouTube Shopping and merch strategies
7. Cross-platform monetization (TikTok, Instagram)
Return JSON: { strategies: [{ name, description, revenue_potential, difficulty, best_niches, tips }] }`,
    target: "viral_content_library",
  },
];

// ============ BRAVE SEARCH QUERIES FOR OUTLIER DISCOVERY ============
const BRAVE_OUTLIER_QUERIES = [
  "YouTube viral video 2026 most viewed this week",
  "fastest growing YouTube channels 2026",
  "YouTube faceless channel viral millions views",
  "YouTube algorithm update 2026",
  "most viral YouTube shorts 2026",
  "YouTube documentary channel growth strategy",
  "YouTube horror story channel viral",
  "YouTube true crime channel new viral",
  "YouTube curiosidades canal viral portugues",
  "YouTube AI generated content viral",
  "YouTube storytelling animated channel viral",
  "underrated YouTube niches 2026 high RPM",
  "YouTube retention strategy secrets creators",
  "YouTube outlier video small channel millions views",
  "YouTube trending topics this month viral potential",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");

  try {
    const { mode = "full" } = await req.json().catch(() => ({}));

    // Get existing context for enrichment
    const [{ data: topNiches }, { data: emerging }, { data: existingHooks }] = await Promise.all([
      sb.from("niche_database").select("name, country, rpm_estimate").order("rpm_estimate", { ascending: false }).limit(10),
      sb.from("emerging_channels").select("channel_title, niche, viral_score").order("viral_score", { ascending: false }).limit(10),
      sb.from("hook_library").select("hook_text").limit(500),
    ]);

    const hookSet = new Set((existingHooks || []).map((h: any) => h.hook_text?.toLowerCase().trim()));
    const nicheContext = (topNiches || []).map(n => `${n.name} (RPM: $${n.rpm_estimate}, ${n.country})`).join(", ");
    const emergingContext = (emerging || []).map(e => `${e.channel_title} (${e.niche}, score: ${e.viral_score})`).join(", ");

    const results: any[] = [];
    let apiCalls = 0;
    let newRecords = 0;

    // ========== PHASE 1: BRAVE SEARCH — OUTLIER DISCOVERY ==========
    if (BRAVE_API_KEY && (mode === "full" || mode === "brave_outliers")) {
      console.log("Phase 1: Brave Search outlier discovery...");
      const braveInsights: string[] = [];

      for (const query of BRAVE_OUTLIER_QUERIES) {
        try {
          const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "brave" });
          if (!allowed) { console.log("Brave quota reached"); break; }

          const bRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pw`, {
            headers: { "X-Subscription-Token": BRAVE_API_KEY, Accept: "application/json" },
          });

          if (bRes.ok) {
            const bData = await bRes.json();
            const webResults = bData.web?.results || [];
            apiCalls++;

            for (const r of webResults.slice(0, 5)) {
              braveInsights.push(`[${query}] ${r.title}: ${r.description || ""} (${r.url})`);
            }

            // Cache raw results
            const cacheKey = `brave_outlier_${query.replace(/\s+/g, "_").slice(0, 50)}_${new Date().toISOString().slice(0, 10)}`;
            await sb.from("research_cache").upsert({
              cache_key: cacheKey,
              source: "brave_search",
              result_json: { query, results: webResults.slice(0, 10) },
              expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
              query,
            }, { onConflict: "cache_key" });
          }
        } catch (e) {
          console.error(`Brave error for "${query}":`, e.message);
        }
      }

      // Synthesize Brave findings into knowledge via AI
      if (braveInsights.length > 10 && GOOGLE_AI_API_KEY) {
        console.log(`Synthesizing ${braveInsights.length} Brave findings...`);
        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube intelligence analyst. Extract viral patterns, outlier channels, trending niches, and actionable hooks from web research data. All output in Portuguese (BR) where applicable. Return ONLY the JSON." },
              { role: "user", content: `Analyze these web research findings about viral YouTube content:\n\n${braveInsights.slice(0, 60).join("\n")}\n\nExtract and return JSON with:\n{\n  "outlier_channels": [{ "name": string, "niche": string, "why_outlier": string, "estimated_subs": number }],\n  "trending_niches": [{ "name": string, "growth_signal": string, "rpm_estimate": number, "faceless_friendly": boolean }],\n  "viral_hooks": [{ "text": string, "type": string, "retention_score": number, "niche": string }],\n  "algorithm_insights": [{ "title": string, "content": string, "priority": number }],\n  "content_patterns": [{ "name": string, "description": string, "effectiveness": number, "niches": [string] }]\n}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "save_brave_insights",
                parameters: {
                  type: "object",
                  properties: {
                    outlier_channels: { type: "array", items: { type: "object", properties: { name: { type: "string" }, niche: { type: "string" }, why_outlier: { type: "string" }, estimated_subs: { type: "number" } }, required: ["name", "niche", "why_outlier", "estimated_subs"], additionalProperties: false } },
                    trending_niches: { type: "array", items: { type: "object", properties: { name: { type: "string" }, growth_signal: { type: "string" }, rpm_estimate: { type: "number" }, faceless_friendly: { type: "boolean" } }, required: ["name", "growth_signal", "rpm_estimate", "faceless_friendly"], additionalProperties: false } },
                    viral_hooks: { type: "array", items: { type: "object", properties: { text: { type: "string" }, type: { type: "string" }, retention_score: { type: "number" }, niche: { type: "string" } }, required: ["text", "type", "retention_score", "niche"], additionalProperties: false } },
                    algorithm_insights: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, priority: { type: "number" } }, required: ["title", "content", "priority"], additionalProperties: false } },
                    content_patterns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, effectiveness: { type: "number" }, niches: { type: "array", items: { type: "string" } } }, required: ["name", "description", "effectiveness", "niches"], additionalProperties: false } },
                  },
                  required: ["outlier_channels", "trending_niches", "viral_hooks", "algorithm_insights", "content_patterns"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "save_brave_insights" } },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (tc) {
            const insights = JSON.parse(tc.function.arguments);
            apiCalls++;

            // Save hooks
            for (const h of (insights.viral_hooks || [])) {
              if (!hookSet.has(h.text?.toLowerCase().trim())) {
                await sb.from("hook_library").insert({ hook_text: h.text, hook_type: h.type, retention_score: h.retention_score, niche: h.niche, source_video: "brave_deep_research" });
                hookSet.add(h.text?.toLowerCase().trim());
                newRecords++;
              }
            }

            // Save niches
            for (const n of (insights.trending_niches || [])) {
              const { data: exists } = await sb.from("niche_database").select("id").ilike("name", `%${n.name}%`).maybeSingle();
              if (!exists) {
                await sb.from("niche_database").insert({ name: n.name, rpm_estimate: n.rpm_estimate, faceless_friendly: n.faceless_friendly, saturation: "baixa", difficulty: "médio" });
                newRecords++;
              }
            }

            // Save algorithm insights
            for (const a of (insights.algorithm_insights || [])) {
              await sb.from("youtube_knowledge").insert({ title: a.title, content: a.content, priority: a.priority, category: "algorithm_update", source: "brave_deep_research", tags: JSON.stringify(["brave", "auto-research"]) });
              newRecords++;
            }

            // Save content patterns
            for (const p of (insights.content_patterns || [])) {
              await sb.from("viral_content_library").insert({ category: "content_pattern", content_json: { name: p.name, description: p.description, source: "brave_deep_research" }, effectiveness_score: p.effectiveness, language: "pt", niches: p.niches });
              newRecords++;
            }

            // Save AI learning about outliers
            if (insights.outlier_channels?.length) {
              await sb.from("ai_learning").insert({ topic: "outlier_channels_discovered", insight: insights.outlier_channels.map((c: any) => `${c.name} (${c.niche}): ${c.why_outlier}`).join("; "), source: "brave_deep_research" });
              newRecords++;
            }

            results.push({ phase: "brave_outliers", hooks: insights.viral_hooks?.length, niches: insights.trending_niches?.length, insights: insights.algorithm_insights?.length, patterns: insights.content_patterns?.length, outliers: insights.outlier_channels?.length });
          }
        } else { await aiRes.text(); }
      }
    }

    // ========== PHASE 2: PERPLEXITY DEEP RESEARCH ==========
    if (PERPLEXITY_API_KEY && (mode === "full" || mode === "perplexity_deep")) {
      // ⭐ Budget guard — Perplexity is the most expensive provider in this function
      const blocked = await assertBudget("perplexity");
      if (blocked) {
        console.warn("[WEEKLY-RESEARCH] Perplexity blocked by budget guard, skipping deep research phase");
      } else {
        console.log("Phase 2: Perplexity deep research...");

      for (const domain of RESEARCH_DOMAINS) {
        const dateKey = new Date().toISOString().slice(0, 10);
        const cacheKey = `weekly_${domain.id}_${dateKey}`;

        const { data: cached } = await sb.from("research_cache").select("result_json").eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
        if (cached) { results.push({ domain: domain.id, cached: true }); continue; }

        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "perplexity" });
        if (!allowed) { results.push({ domain: domain.id, skipped: true, reason: "quota" }); continue; }

        try {
          const contextPrompt = `Context — Top niches: ${nicheContext}. Emerging: ${emergingContext || "N/A"}.\n\n${domain.prompt}`;
          const pResp = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                { role: "system", content: "You are a YouTube market intelligence analyst. Return structured JSON reports based on real, current data. Be specific with numbers and examples. Include Portuguese (BR) translations where relevant." },
                { role: "user", content: contextPrompt },
              ],
            }),
          });

          if (pResp.ok) {
            const pData = await pResp.json();
            const content = pData.choices?.[0]?.message?.content || "";
            apiCalls++;

            // Cache for 7 days
            const ttl = new Date(Date.now() + 7 * 86400000).toISOString();
            await sb.from("research_cache").upsert({
              cache_key: cacheKey, source: "perplexity_sonar_pro",
              result_json: { report: content, citations: pData.citations || [], domain: domain.id, generated_at: new Date().toISOString() },
              expires_at: ttl, query: `weekly_${domain.id}`, ttl,
            }, { onConflict: "cache_key" });

            // Parse and ingest
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const count = await ingestResearchData(sb, domain, parsed, hookSet);
                newRecords += count;
              }
            } catch { /* parsing failed, data still cached */ }

            results.push({ domain: domain.id, success: true, source: "perplexity" });
            // Log Perplexity sonar-pro cost (~$0.015/call)
            logCost({ provider: "perplexity", functionName: "weekly-deep-research", estimateKey: "perplexity-sonar-pro", metadata: { domain: domain.id } }).then(() => {}, () => {});
          } else { await pResp.text(); results.push({ domain: domain.id, error: "perplexity_failed" }); }
        } catch (e) {
          console.error(`Perplexity error for ${domain.id}:`, e.message);
          results.push({ domain: domain.id, error: e.message });
        }
      }
      } // close budget-guard else
    }

    // ========== PHASE 3: GEMINI FALLBACK FOR UNCOVERED DOMAINS ==========
    if (GOOGLE_AI_API_KEY && (mode === "full" || mode === "gemini_fallback")) {
      console.log("Phase 3: Gemini fallback for uncovered domains...");
      const coveredDomains = new Set(results.filter(r => r.success || r.cached).map(r => r.domain));

      for (const domain of RESEARCH_DOMAINS) {
        if (coveredDomains.has(domain.id)) continue;

        const dateKey = new Date().toISOString().slice(0, 10);
        const cacheKey = `weekly_${domain.id}_${dateKey}`;

        const { data: cached } = await sb.from("research_cache").select("result_json").eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
        if (cached) continue;

        try {
          const contextPrompt = `Context — Top niches: ${nicheContext}. Emerging: ${emergingContext || "N/A"}.\n\n${domain.prompt}`;
          const aiResp = await fetch(AI_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a YouTube market intelligence analyst. Return structured JSON reports. Be specific." },
                { role: "user", content: contextPrompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            apiCalls++;

            const ttl = new Date(Date.now() + 7 * 86400000).toISOString();
            await sb.from("research_cache").upsert({
              cache_key: cacheKey, source: "gemini_flash",
              result_json: { report: content, domain: domain.id, generated_at: new Date().toISOString() },
              expires_at: ttl, query: `weekly_${domain.id}`, ttl,
            }, { onConflict: "cache_key" });

            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const count = await ingestResearchData(sb, domain, parsed, hookSet);
                newRecords += count;
              }
            } catch { /* parsing failed */ }

            results.push({ domain: domain.id, success: true, source: "gemini" });
          } else { await aiResp.text(); }
        } catch (e) {
          console.error(`Gemini error for ${domain.id}:`, e.message);
        }
      }
    }

    // ========== LOG EXECUTION ==========
    const duration = Date.now() - startTime;
    await sb.from("execution_logs").insert({
      function_name: "weekly-deep-research",
      duration_ms: duration,
      success: true,
      api_calls_made: apiCalls,
      metadata: { mode, results, newRecords, domains: RESEARCH_DOMAINS.length },
    });

    console.log(`weekly-deep-research completed in ${duration}ms. API calls: ${apiCalls}, new records: ${newRecords}`);

    return new Response(JSON.stringify({ success: true, results, apiCalls, newRecords, duration_ms: duration }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-deep-research error:", e);
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

// ============ INGESTION LOGIC ============
async function ingestResearchData(sb: any, domain: any, parsed: any, hookSet: Set<string>): Promise<number> {
  let count = 0;
  try {
    // YouTube knowledge
    if (domain.target === "youtube_knowledge" && parsed.insights) {
      for (const i of parsed.insights.slice(0, 15)) {
        await sb.from("youtube_knowledge").insert({
          category: i.category || "auto-research", title: i.title || "Untitled",
          content: i.content || "", priority: i.priority || 5,
          source: "weekly-deep-research", tags: JSON.stringify(["auto-research", domain.id]),
        });
        count++;
      }
    }

    // Script knowledge (techniques + structures)
    if (domain.target === "script_knowledge") {
      for (const t of (parsed.techniques || parsed.structures || []).slice(0, 15)) {
        await sb.from("script_knowledge").insert({
          category: t.category || "auto-research", title: t.title || "Untitled",
          content: `${t.content || ""}${t.when_to_use ? `\n\nQuando usar: ${t.when_to_use}` : ""}`,
          effectiveness_score: t.effectiveness_score || 7,
          examples: JSON.stringify(t.examples || []),
        });
        count++;
      }
    }

    // Psychology triggers
    if (domain.target === "psychology" && parsed.triggers) {
      for (const t of parsed.triggers.slice(0, 12)) {
        await sb.from("audience_psychology_patterns").insert({
          trigger_type: t.name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
          description: `${t.description || ""}\n\nComo aplicar: ${t.how_to_apply || ""}`,
          example_hooks: t.example_titles || [],
          retention_score: t.score || 7,
          niches: t.best_niches || [],
          source: "weekly-deep-research",
        });
        count++;

        // Also save to viral_content_library
        await sb.from("viral_content_library").insert({
          category: "psychology_triggers",
          content_json: { name: t.name, description: t.description, how_to_apply: t.how_to_apply, example_titles: t.example_titles, best_for_niches: t.best_niches },
          language: "pt", niches: t.best_niches || [], effectiveness_score: t.score || 8,
        });
        count++;
      }
    }

    // Niche database
    if (domain.target === "niche_database" && parsed.niches) {
      for (const n of parsed.niches.slice(0, 12)) {
        const { data: exists } = await sb.from("niche_database").select("id").ilike("name", `%${n.name}%`).maybeSingle();
        if (!exists) {
          await sb.from("niche_database").insert({
            name: n.name, rpm_estimate: n.rpm_estimate || 0,
            saturation: n.saturation === "high" ? "alta" : n.saturation === "low" ? "baixa" : "média",
            difficulty: n.saturation === "high" ? "difícil" : n.saturation === "low" ? "fácil" : "médio",
            faceless_friendly: n.faceless_friendly ?? true,
            sub_niches: JSON.stringify(n.sub_niches || []),
          });
          count++;
        }
      }
    }

    // Viral content library (formats)
    if (domain.target === "viral_content_library" && (parsed.formats || parsed.strategies)) {
      for (const f of (parsed.formats || parsed.strategies || []).slice(0, 10)) {
        await sb.from("viral_content_library").insert({
          category: parsed.formats ? "content_format" : "monetization_strategy",
          content_json: f, language: "pt",
          niches: f.best_niches || f.best_for_niches || [],
          effectiveness_score: f.effectiveness || 8,
        });
        count++;
      }
    }

    // Hook library
    if (domain.target === "hook_library" && parsed.hooks) {
      for (const h of parsed.hooks.slice(0, 20)) {
        if (!hookSet.has(h.text?.toLowerCase().trim())) {
          await sb.from("hook_library").insert({
            hook_text: h.text, hook_type: h.type,
            retention_score: h.retention_score || 7,
            niche: h.niche, source_video: h.source_inspiration || "deep_research",
          });
          hookSet.add(h.text?.toLowerCase().trim());
          count++;
        }
      }
    }
  } catch (e) {
    console.error(`Ingestion error for ${domain.id}:`, e.message);
  }
  return count;
}
