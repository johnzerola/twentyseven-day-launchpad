import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Self Learning Engine V2
 * 
 * Modes:
 * - "scan_trending": Finds trending videos in tracked niches
 * - "analyze_outliers": Analyzes outlier videos with deeper pattern extraction
 * - "update_patterns": Cross-references existing data for new patterns
 * - "detect_decay": NEW — identifies stale/declining patterns
 * - "deep_discovery": NEW — uses Brave+Perplexity for external intelligence
 * - "cross_correlate": NEW — finds hidden connections between knowledge tables
 * - "full_cycle": Runs all modes sequentially
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "full_cycle", niche, maxVideos = 10 } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    const results: any = { learned: 0, errors: 0, details: [] };

    // ========== MODE: SCAN TRENDING ==========
    if (mode === "scan_trending" || mode === "full_cycle") {
      if (YOUTUBE_API_KEY) {
        try {
          const { data: niches } = await sb.from("niche_database")
            .select("name").eq("faceless_friendly", true)
            .order("rpm_estimate", { ascending: false }).limit(niche ? 1 : 5);

          const scanNiches = niche ? [niche] : (niches || []).map((n: any) => n.name);

          for (const n of scanNiches) {
            try {
              const searchRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(n)}&type=video&order=viewCount&maxResults=${Math.min(maxVideos, 10)}&publishedAfter=${new Date(Date.now() - 30 * 86400000).toISOString()}&key=${YOUTUBE_API_KEY}`
              );
              const searchData = await searchRes.json();
              const videoIds = (searchData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
              if (!videoIds.length) continue;

              const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
              const vData = await vRes.json();

              for (const video of (vData.items || [])) {
                const views = parseInt(video.statistics?.viewCount || '0');
                const likes = parseInt(video.statistics?.likeCount || '0');
                if (views < 200000) continue;

                const { data: exists } = await sb.from("viral_titles_db")
                  .select("id").eq("title", video.snippet.title).maybeSingle();
                
                if (!exists) {
                  const dur = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                  const seconds = dur ? (parseInt(dur[1]||'0')*3600 + parseInt(dur[2]||'0')*60 + parseInt(dur[3]||'0')) : 0;

                  await sb.from("viral_titles_db").insert({
                    title: video.snippet.title,
                    channel_name: video.snippet.channelTitle,
                    channel_id: video.snippet.channelId,
                    views, likes, niche: n,
                    published_at: video.snippet.publishedAt,
                    duration_seconds: seconds,
                  });
                  results.learned++;
                }
              }
            } catch (e) {
              console.error(`Scan niche "${n}" error:`, e);
              results.errors++;
            }
          }
        } catch (e) {
          console.error("scan_trending error:", e);
          results.errors++;
        }
      }
    }

    // ========== MODE: ANALYZE OUTLIERS (ENHANCED) ==========
    if (mode === "analyze_outliers" || mode === "full_cycle") {
      if (YOUTUBE_API_KEY) {
        try {
          const { data: channels } = await sb.from("channel_intelligence")
            .select("youtube_channel_id,channel_name,avg_views,niche,subscribers")
            .order("avg_views", { ascending: false }).limit(5);

          for (const ch of (channels || [])) {
            try {
              const searchRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.youtube_channel_id}&order=viewCount&maxResults=5&type=video&publishedAfter=${new Date(Date.now() - 60 * 86400000).toISOString()}&key=${YOUTUBE_API_KEY}`
              );
              const searchData = await searchRes.json();
              const videoIds = (searchData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
              if (!videoIds.length) continue;

              const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
              const vData = await vRes.json();

              const outliers = (vData.items || []).filter((v: any) => {
                const views = parseInt(v.statistics?.viewCount || '0');
                return views > (ch.avg_views || 0) * 3;
              });

              if (outliers.length > 0) {
                const outlierTitles = outliers.map((v: any) => `"${v.snippet.title}" (${parseInt(v.statistics?.viewCount||'0').toLocaleString()} views, likes: ${v.statistics?.likeCount || 0}, comments: ${v.statistics?.commentCount || 0})`).join("\n");

                const aiRes = await fetch(AI_URL, {
                  method: "POST", headers: aiHeaders,
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: "You are a viral video pattern analyst. Extract deep patterns from outlier videos including psychological triggers, narrative structures, and replicable formulas. Be very specific." },
                      { role: "user", content: `Channel "${ch.channel_name}" (${ch.niche}, avg ${ch.avg_views} views, ${ch.subscribers} subs) has these outlier videos:\n${outlierTitles}\n\nExtract: 1) Why each outlier broke out, 2) Replicable title formulas, 3) Emotional triggers used, 4) Hook technique, 5) Content angle that differentiated, 6) Specific retention techniques implied by the title/topic.` }
                    ],
                    tools: [{
                      type: "function",
                      function: {
                        name: "extract_deep_patterns",
                        parameters: {
                          type: "object",
                          properties: {
                            titlePatterns: { type: "array", items: { type: "string" } },
                            emotionalTriggers: { type: "array", items: { type: "string" } },
                            hookTechnique: { type: "string" },
                            contentAngle: { type: "string" },
                            whyOutlier: { type: "string" },
                            retentionTechniques: { type: "array", items: { type: "string" } },
                            replicableFormulas: { type: "array", items: { type: "object", properties: { formula: { type: "string" }, example: { type: "string" } }, required: ["formula", "example"], additionalProperties: false } },
                          },
                          required: ["titlePatterns", "emotionalTriggers", "hookTechnique", "contentAngle", "whyOutlier", "retentionTechniques", "replicableFormulas"],
                          additionalProperties: false,
                        }
                      }
                    }],
                    tool_choice: { type: "function", function: { name: "extract_deep_patterns" } },
                  }),
                });

                if (aiRes.ok) {
                  const aiData = await aiRes.json();
                  const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
                  if (tc) {
                    const patterns = JSON.parse(tc.function.arguments);
                    
                    await sb.from("script_knowledge").insert({
                      category: "outlier_pattern",
                      title: `Outlier V2: ${ch.channel_name} (${ch.niche})`,
                      content: `Hook: ${patterns.hookTechnique}\nAngle: ${patterns.contentAngle}\nWhy outlier: ${patterns.whyOutlier}\nTitle patterns: ${patterns.titlePatterns.join('; ')}\nTriggers: ${patterns.emotionalTriggers.join(', ')}\nRetention: ${patterns.retentionTechniques.join('; ')}`,
                      effectiveness_score: 9,
                      examples: JSON.stringify(outliers.map((v: any) => v.snippet.title).slice(0, 3)),
                    });

                    // Save replicable formulas as hooks
                    for (const f of (patterns.replicableFormulas || [])) {
                      await sb.from("hook_library").insert({
                        hook_text: f.formula,
                        hook_type: "formula",
                        retention_score: 9,
                        niche: ch.niche,
                        source_video: `outlier_${ch.channel_name}`,
                      });
                      results.learned++;
                    }

                    // Save retention techniques
                    for (const rt of (patterns.retentionTechniques || [])) {
                      await sb.from("script_knowledge").insert({
                        category: "retention_technique",
                        title: `Retention: ${rt.slice(0, 80)}`,
                        content: `Extracted from outlier analysis of ${ch.channel_name} (${ch.niche}). ${rt}`,
                        effectiveness_score: 8,
                      });
                      results.learned++;
                    }

                    results.learned++;
                    results.details.push({ type: "outlier_deep", channel: ch.channel_name, outliers: outliers.length, formulas: patterns.replicableFormulas?.length });
                  }
                } else { await aiRes.text(); }
              }
            } catch (e) {
              console.error(`Analyze outliers for ${ch.channel_name} error:`, e);
              results.errors++;
            }
          }
        } catch (e) {
          console.error("analyze_outliers error:", e);
          results.errors++;
        }
      }
    }

    // ========== MODE: DETECT DECAY — NEW ==========
    if (mode === "detect_decay" || mode === "full_cycle") {
      try {
        // Find patterns/hooks that haven't been validated recently
        const { data: oldPatterns } = await sb.from("viral_content_library")
          .select("id, category, content_json, effectiveness_score, created_at")
          .lt("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
          .gte("effectiveness_score", 7)
          .limit(20);

        if (oldPatterns && oldPatterns.length >= 5) {
          const patternList = oldPatterns.map((p: any) => {
            const cj = p.content_json as any;
            return `[${p.category}] ${cj.name || cj.formula || 'unknown'}: ${(cj.description || '').slice(0, 100)} (score: ${p.effectiveness_score}, age: ${Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)}d)`;
          }).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST", headers: aiHeaders,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You evaluate whether YouTube content patterns are still effective or have become outdated/saturated. Be honest and data-driven." },
                { role: "user", content: `Evaluate these patterns. Which are still effective in 2026 and which have decayed?\n\n${patternList}` }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "evaluate_decay",
                  parameters: {
                    type: "object",
                    properties: {
                      still_effective: { type: "array", items: { type: "string" } },
                      decayed: { type: "array", items: { type: "object", properties: { name: { type: "string" }, reason: { type: "string" }, new_score: { type: "number" } }, required: ["name", "reason", "new_score"], additionalProperties: false } },
                    },
                    required: ["still_effective", "decayed"],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "evaluate_decay" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const decay = JSON.parse(tc.function.arguments);
              
              for (const d of (decay.decayed || [])) {
                // Downgrade score of decayed patterns
                const match = oldPatterns.find((p: any) => {
                  const cj = p.content_json as any;
                  return (cj.name || cj.formula || '').includes(d.name);
                });
                if (match) {
                  await sb.from("viral_content_library").update({ effectiveness_score: d.new_score }).eq("id", match.id);
                  results.learned++;
                }
              }

              await sb.from("ai_learning").insert({
                topic: "pattern_decay_detection",
                insight: `Decay scan: ${decay.still_effective?.length || 0} still effective, ${decay.decayed?.length || 0} decayed. Decayed: ${(decay.decayed || []).map((d: any) => `${d.name} (→${d.new_score}): ${d.reason}`).join('; ')}`,
                source: "self-learning-engine-v2",
              });
              results.details.push({ type: "decay_detection", effective: decay.still_effective?.length, decayed: decay.decayed?.length });
            }
          } else { await aiRes.text(); }
        }
      } catch (e) {
        console.error("detect_decay error:", e);
        results.errors++;
      }
    }

    // ========== MODE: DEEP DISCOVERY (Brave + Perplexity) — NEW ==========
    if (mode === "deep_discovery" || mode === "full_cycle") {
      try {
        // Get top niches for targeted discovery
        const { data: topNiches } = await sb.from("niche_database")
          .select("name, rpm_estimate").order("rpm_estimate", { ascending: false }).limit(5);

        const discoveryQueries = [
          "YouTube viral breakout video this week 2026",
          "fastest growing faceless YouTube channels right now",
          "YouTube algorithm change latest update 2026",
          ...(topNiches || []).map(n => `"${n.name}" YouTube viral channel new 2026`),
        ];

        const braveInsights: string[] = [];

        if (BRAVE_API_KEY) {
          for (const q of discoveryQueries.slice(0, 8)) {
            try {
              const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "brave" });
              if (!allowed) break;

              const bRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5&freshness=pw`, {
                headers: { "X-Subscription-Token": BRAVE_API_KEY, Accept: "application/json" },
              });

              if (bRes.ok) {
                const bData = await bRes.json();
                for (const r of (bData.web?.results || []).slice(0, 3)) {
                  braveInsights.push(`[${q}] ${r.title}: ${r.description || ""}`);
                }
              }
            } catch (e) { console.error(`Brave discovery error:`, e); }
          }
        }

        // Use Perplexity for deep analysis of gaps
        if (PERPLEXITY_API_KEY && braveInsights.length > 5) {
          try {
            const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "perplexity" });
            if (allowed) {
              const pRes = await fetch("https://api.perplexity.ai/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "sonar",
                  messages: [
                    { role: "system", content: "You are a YouTube market intelligence analyst. Extract actionable insights from research data. Return JSON." },
                    { role: "user", content: `Based on these findings, identify the TOP 5 emerging opportunities and 5 new hook formulas:\n\n${braveInsights.join("\n")}\n\nReturn JSON: { opportunities: [{ niche, why_now, estimated_rpm, action }], hooks: [{ text, type, niche }] }` },
                  ],
                }),
              });

              if (pRes.ok) {
                const pData = await pRes.json();
                const content = pData.choices?.[0]?.message?.content || "";
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  
                  for (const opp of (parsed.opportunities || [])) {
                    const { data: exists } = await sb.from("niche_database").select("id").ilike("name", `%${opp.niche}%`).maybeSingle();
                    if (!exists && opp.niche) {
                      await sb.from("niche_database").insert({
                        name: opp.niche, rpm_estimate: opp.estimated_rpm || 3,
                        saturation: "baixa", difficulty: "médio", faceless_friendly: true,
                      });
                      results.learned++;
                    }
                  }

                  for (const h of (parsed.hooks || [])) {
                    await sb.from("hook_library").insert({
                      hook_text: h.text, hook_type: h.type || "discovery",
                      retention_score: 8, niche: h.niche || "general",
                      source_video: "deep_discovery_perplexity",
                    });
                    results.learned++;
                  }

                  results.details.push({ type: "deep_discovery", opportunities: parsed.opportunities?.length, hooks: parsed.hooks?.length });
                }
              } else { await pRes.text(); }
            }
          } catch (e) { console.error("Perplexity discovery error:", e); results.errors++; }
        }
      } catch (e) {
        console.error("deep_discovery error:", e);
        results.errors++;
      }
    }

    // ========== MODE: CROSS CORRELATE — NEW ==========
    if (mode === "cross_correlate" || mode === "full_cycle") {
      try {
        const [
          { data: topHooks },
          { data: topTriggers },
          { data: topTitles },
          { data: topBlueprints },
        ] = await Promise.all([
          sb.from("hook_library").select("hook_text, hook_type, retention_score, niche").order("retention_score", { ascending: false }).limit(30),
          sb.from("audience_psychology_patterns").select("trigger_type, description, retention_score, niches").order("retention_score", { ascending: false }).limit(20),
          sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern").order("views", { ascending: false }).limit(30),
          sb.from("video_blueprints").select("video_title, hook_type, psychological_triggers, narrative_style, views").order("views", { ascending: false }).limit(15),
        ]);

        if ((topHooks?.length || 0) + (topTriggers?.length || 0) > 10) {
          const correlationPrompt = `CROSS-CORRELATE these data sources to find hidden connections:

TOP HOOKS: ${(topHooks || []).slice(0, 15).map(h => `"${h.hook_text}" (${h.hook_type}, score: ${h.retention_score}, ${h.niche})`).join("\n")}

TOP PSYCHOLOGY TRIGGERS: ${(topTriggers || []).slice(0, 10).map(t => `${t.trigger_type}: ${t.description?.slice(0, 80)}`).join("\n")}

TOP VIRAL TITLES: ${(topTitles || []).slice(0, 15).map(t => `"${t.title}" (${t.views} views, ${t.niche})`).join("\n")}

BLUEPRINTS: ${(topBlueprints || []).slice(0, 8).map(b => `"${b.video_title}" hook:${b.hook_type}, style:${b.narrative_style}`).join("\n")}

Find: 1) Which hook+trigger combinations are most powerful, 2) Patterns that work across multiple niches, 3) Gaps — triggers without good hooks, hooks without psychological backing`;

          const aiRes = await fetch(AI_URL, {
            method: "POST", headers: aiHeaders,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You find hidden correlations between viral content data. Generate actionable insights and new hybrid formulas." },
                { role: "user", content: correlationPrompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "save_correlations",
                  parameters: {
                    type: "object",
                    properties: {
                      powerCombinations: { type: "array", items: { type: "object", properties: { hook_type: { type: "string" }, trigger: { type: "string" }, why_powerful: { type: "string" }, example_title: { type: "string" } }, required: ["hook_type", "trigger", "why_powerful", "example_title"], additionalProperties: false } },
                      crossNichePatterns: { type: "array", items: { type: "object", properties: { pattern: { type: "string" }, niches: { type: "array", items: { type: "string" } }, formula: { type: "string" } }, required: ["pattern", "niches", "formula"], additionalProperties: false } },
                      gaps: { type: "array", items: { type: "object", properties: { gap_type: { type: "string" }, description: { type: "string" }, suggested_fix: { type: "string" } }, required: ["gap_type", "description", "suggested_fix"], additionalProperties: false } },
                    },
                    required: ["powerCombinations", "crossNichePatterns", "gaps"],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "save_correlations" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const corr = JSON.parse(tc.function.arguments);

              // Save power combinations as viral content
              for (const combo of (corr.powerCombinations || []).slice(0, 5)) {
                await sb.from("viral_content_library").insert({
                  category: "power_combination",
                  content_json: combo,
                  effectiveness_score: 9,
                  language: "pt",
                  niches: ["todos"],
                });
                results.learned++;
              }

              // Save cross-niche patterns
              for (const pattern of (corr.crossNichePatterns || []).slice(0, 5)) {
                await sb.from("script_knowledge").insert({
                  category: "cross_niche_pattern",
                  title: `Cross-Niche: ${pattern.pattern.slice(0, 80)}`,
                  content: `Pattern: ${pattern.pattern}\nFormula: ${pattern.formula}\nWorks in: ${pattern.niches.join(', ')}`,
                  effectiveness_score: 9,
                });
                results.learned++;
              }

              // Save gaps for future filling
              for (const gap of (corr.gaps || []).slice(0, 5)) {
                await sb.from("ai_learning").insert({
                  topic: "knowledge_gap",
                  insight: `[${gap.gap_type}] ${gap.description}. Fix: ${gap.suggested_fix}`,
                  source: "cross_correlate_v2",
                });
                results.learned++;
              }

              results.details.push({ type: "cross_correlate", combos: corr.powerCombinations?.length, patterns: corr.crossNichePatterns?.length, gaps: corr.gaps?.length });
            }
          } else { await aiRes.text(); }
        }
      } catch (e) {
        console.error("cross_correlate error:", e);
        results.errors++;
      }
    }

    // ========== MODE: UPDATE PATTERNS ==========
    if (mode === "update_patterns" || mode === "full_cycle") {
      try {
        const { data: titles } = await sb.from("viral_titles_db")
          .select("title,views,niche,title_pattern,emotional_triggers")
          .order("views", { ascending: false }).limit(50);

        const unanalyzed = (titles || []).filter((t: any) => !t.title_pattern);
        
        if (unanalyzed.length >= 5) {
          const titleList = unanalyzed.slice(0, 20).map((t: any) => `"${t.title}" (${t.views?.toLocaleString()} views, ${t.niche})`).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST", headers: aiHeaders,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Analyze viral YouTube titles and extract copywriting patterns." },
                { role: "user", content: `Classify these viral titles by pattern:\n${titleList}` }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "classify_titles",
                  parameters: {
                    type: "object",
                    properties: {
                      classifications: { type: "array", items: { type: "object", properties: { title: { type: "string" }, pattern: { type: "string" }, triggers: { type: "array", items: { type: "string" } }, whyViral: { type: "string" } }, required: ["title", "pattern", "triggers", "whyViral"], additionalProperties: false } },
                      newPatterns: { type: "array", items: { type: "object", properties: { patternName: { type: "string" }, description: { type: "string" }, formula: { type: "string" }, exampleTitles: { type: "array", items: { type: "string" } } }, required: ["patternName", "description", "formula", "exampleTitles"], additionalProperties: false } }
                    },
                    required: ["classifications", "newPatterns"],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "classify_titles" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const data = JSON.parse(tc.function.arguments);

              for (const c of (data.classifications || [])) {
                await sb.from("viral_titles_db")
                  .update({ title_pattern: c.pattern, why_viral: c.whyViral, emotional_triggers: c.triggers })
                  .eq("title", c.title);
                results.learned++;
              }

              for (const p of (data.newPatterns || [])) {
                await sb.from("viral_content_library").insert({
                  category: "title_pattern",
                  content_json: { name: p.patternName, description: p.description, formula: p.formula, examples: p.exampleTitles, source: "self_learning_v2" },
                  effectiveness_score: 8, language: "pt", niches: ["todos"],
                });
                results.learned++;
              }
            }
          } else { await aiRes.text(); }
        }

        // Cross-reference blueprints for missing triggers
        const { data: psychPatterns } = await sb.from("audience_psychology_patterns")
          .select("trigger_type").limit(200);
        const existingTriggers = new Set((psychPatterns || []).map((p: any) => p.trigger_type));

        const { data: blueprints } = await sb.from("video_blueprints")
          .select("psychological_triggers,hook_type,video_title,views")
          .order("views", { ascending: false }).limit(20);

        for (const bp of (blueprints || [])) {
          for (const trigger of (bp.psychological_triggers || [])) {
            const key = trigger.toLowerCase().replace(/\s+/g, '_');
            if (!existingTriggers.has(key)) {
              await sb.from("audience_psychology_patterns").insert({
                trigger_type: key,
                description: `Auto-detected from "${bp.video_title}" (${bp.views?.toLocaleString()} views). Hook: ${bp.hook_type || 'unknown'}.`,
                example_titles: [bp.video_title],
                retention_score: 7,
                source: "self-learning-engine-v2",
              });
              existingTriggers.add(key);
              results.learned++;
            }
          }
        }
      } catch (e) {
        console.error("update_patterns error:", e);
        results.errors++;
      }
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "self-learning-engine",
      success: results.errors === 0,
      duration_ms: null,
      api_calls_made: results.learned,
      metadata: { mode, version: "v2", learned: results.learned, errors: results.errors, details: results.details.slice(0, 20) },
      error_message: results.errors > 0 ? `${results.errors} errors during learning cycle` : null,
    });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-learning-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
