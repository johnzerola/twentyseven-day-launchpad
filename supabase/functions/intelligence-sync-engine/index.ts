import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

/**
 * Intelligence Sync Engine
 * 
 * Bidirectional sync between viral_titles_db ↔ knowledge bases.
 * Auto-feeds from user activity (tracked channels, explored niches, saved searches).
 * 
 * Modes:
 * - "sync_viral_to_knowledge": Extract patterns from viral_titles_db → script_knowledge, hook_library, audience_psychology_patterns
 * - "sync_channels_to_intel": Convert tracked_channels + user_channels → channel_intelligence enrichment
 * - "sync_niches_to_db": Expand niche_database from saved_niche_analyses patterns
 * - "cross_pollinate": Full cross-reference between ALL knowledge tables
 * - "user_activity_feed": Learn from user's recent actions (searches, tracks, scripts)
 * - "full": Run everything
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const { mode = "full", userId } = await req.json().catch(() => ({}));
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" };
    const results = { synced: 0, enriched: 0, newRecords: 0, errors: 0, details: [] as any[] };

    // ========== MODE: SYNC VIRAL → KNOWLEDGE ==========
    if (mode === "sync_viral_to_knowledge" || mode === "full") {
      try {
        // Get viral titles that haven't been processed into knowledge yet
        const { data: viralTitles } = await sb.from("viral_titles_db")
          .select("*")
          .order("views", { ascending: false })
          .limit(100);

        // Get existing hooks to avoid duplicates
        const { data: existingHooks } = await sb.from("hook_library")
          .select("hook_text").limit(500);
        const hookSet = new Set((existingHooks || []).map((h: any) => h.hook_text?.toLowerCase().trim()));

        // Get existing script knowledge
        const { data: existingKnowledge } = await sb.from("script_knowledge")
          .select("title").limit(500);
        const knowledgeSet = new Set((existingKnowledge || []).map((k: any) => k.title?.toLowerCase().trim()));

        // Group viral titles by niche for batch analysis
        const nicheGroups: Record<string, any[]> = {};
        (viralTitles || []).forEach((t: any) => {
          const n = t.niche || "general";
          if (!nicheGroups[n]) nicheGroups[n] = [];
          nicheGroups[n].push(t);
        });

        for (const [niche, titles] of Object.entries(nicheGroups)) {
          if (titles.length < 3) continue;

          const titleList = titles.slice(0, 25).map((t: any) =>
            `"${t.title}" (${t.views?.toLocaleString()} views, ${t.channel_name}, triggers: ${(t.emotional_triggers || []).join(",")}, pattern: ${t.title_pattern || "unknown"})`
          ).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST", headers: aiH,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Extract reusable knowledge from viral YouTube titles. Generate hooks, script techniques, and psychology patterns. Be specific and actionable. All text in Portuguese (BR)." },
                { role: "user", content: `Niche: "${niche}"\n\nViral titles:\n${titleList}\n\nExtract: 1) 5 reusable hooks, 2) 3 script techniques, 3) 3 psychology patterns, 4) 5 new hook templates for this niche.` }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "extract_knowledge",
                  parameters: {
                    type: "object",
                    properties: {
                      hooks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            text: { type: "string" },
                            type: { type: "string", enum: ["curiosity", "shock", "urgency", "contrarian", "story", "challenge", "authority", "fear"] },
                            retentionScore: { type: "number" },
                          },
                          required: ["text", "type", "retentionScore"], additionalProperties: false,
                        }
                      },
                      scriptTechniques: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            content: { type: "string" },
                            category: { type: "string" },
                            effectivenessScore: { type: "number" },
                          },
                          required: ["title", "content", "category", "effectivenessScore"], additionalProperties: false,
                        }
                      },
                      psychologyPatterns: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            triggerType: { type: "string" },
                            description: { type: "string" },
                            exampleHooks: { type: "array", items: { type: "string" } },
                            retentionScore: { type: "number" },
                            storytellingPattern: { type: "string" },
                          },
                          required: ["triggerType", "description", "exampleHooks", "retentionScore", "storytellingPattern"], additionalProperties: false,
                        }
                      },
                      nicheInsights: {
                        type: "object",
                        properties: {
                          topEmotionalTrigger: { type: "string" },
                          bestTitleLength: { type: "number" },
                          commonWords: { type: "array", items: { type: "string" } },
                          avgViewsTop10: { type: "number" },
                        },
                        required: ["topEmotionalTrigger", "bestTitleLength", "commonWords", "avgViewsTop10"], additionalProperties: false,
                      }
                    },
                    required: ["hooks", "scriptTechniques", "psychologyPatterns", "nicheInsights"],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "extract_knowledge" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const knowledge = JSON.parse(tc.function.arguments);

              // Insert hooks
              for (const h of (knowledge.hooks || [])) {
                if (!hookSet.has(h.text?.toLowerCase().trim())) {
                  await sb.from("hook_library").insert({
                    hook_text: h.text, hook_type: h.type,
                    retention_score: h.retentionScore, niche,
                    source_video: `sync_engine_${niche}`,
                  });
                  hookSet.add(h.text?.toLowerCase().trim());
                  results.newRecords++;
                }
              }

              // Insert script techniques
              for (const s of (knowledge.scriptTechniques || [])) {
                if (!knowledgeSet.has(s.title?.toLowerCase().trim())) {
                  await sb.from("script_knowledge").insert({
                    title: s.title, content: s.content,
                    category: s.category, effectiveness_score: s.effectivenessScore,
                    examples: JSON.stringify(titles.slice(0, 3).map((t: any) => t.title)),
                  });
                  knowledgeSet.add(s.title?.toLowerCase().trim());
                  results.newRecords++;
                }
              }

              // Insert psychology patterns
              for (const p of (knowledge.psychologyPatterns || [])) {
                const { data: exists } = await sb.from("audience_psychology_patterns")
                  .select("id").eq("trigger_type", p.triggerType).maybeSingle();
                if (!exists) {
                  await sb.from("audience_psychology_patterns").insert({
                    trigger_type: p.triggerType, description: p.description,
                    example_hooks: p.exampleHooks, retention_score: p.retentionScore,
                    storytelling_pattern: p.storytellingPattern, niches: [niche],
                    source: "intelligence_sync_engine",
                  });
                  results.newRecords++;
                }
              }

              // Save niche insights to ai_learning
              if (knowledge.nicheInsights) {
                await sb.from("ai_learning").insert({
                  topic: `niche_insights_${niche}`,
                  insight: `Top trigger: ${knowledge.nicheInsights.topEmotionalTrigger}. Best title length: ${knowledge.nicheInsights.bestTitleLength} chars. Common words: ${knowledge.nicheInsights.commonWords.join(", ")}. Avg views top 10: ${knowledge.nicheInsights.avgViewsTop10}.`,
                  source: "intelligence_sync_engine",
                });
                results.newRecords++;
              }

              results.synced++;
              results.details.push({ type: "viral_to_knowledge", niche, hooks: knowledge.hooks?.length, techniques: knowledge.scriptTechniques?.length });
            }
          } else { await aiRes.text(); }
        }
      } catch (e) {
        console.error("sync_viral_to_knowledge error:", e);
        results.errors++;
      }
    }

    // ========== MODE: SYNC CHANNELS → INTEL ==========
    if (mode === "sync_channels_to_intel" || mode === "full") {
      try {
        // Get tracked channels that aren't in channel_intelligence yet
        const { data: tracked } = await sb.from("tracked_channels")
          .select("youtube_channel_id, channel_name, subscribers")
          .order("created_at", { ascending: false })
          .limit(20);

        const { data: userChannels } = await sb.from("user_channels")
          .select("youtube_channel_id, channel_name, subscribers, niche, analysis_json")
          .limit(20);

        const allChannels = [...(tracked || []), ...(userChannels || [])];
        const seenIds = new Set<string>();

        for (const ch of allChannels) {
          if (seenIds.has(ch.youtube_channel_id)) continue;
          seenIds.add(ch.youtube_channel_id);

          // Check if already in channel_intelligence
          const { data: exists } = await sb.from("channel_intelligence")
            .select("id").eq("youtube_channel_id", ch.youtube_channel_id).maybeSingle();
          if (exists) continue;

          // Enrich via YouTube API
          if (!YOUTUBE_API_KEY) continue;

          try {
            const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${ch.youtube_channel_id}&key=${YOUTUBE_API_KEY}`);
            const chData = await chRes.json();
            const channel = chData.items?.[0];
            if (!channel) continue;

            const subs = parseInt(channel.statistics?.subscriberCount || "0");
            const totalViews = parseInt(channel.statistics?.viewCount || "0");
            const videoCount = parseInt(channel.statistics?.videoCount || "0");
            const avgViews = videoCount > 0 ? Math.floor(totalViews / videoCount) : 0;

            // Get recent videos for pattern analysis
            const vidRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${ch.youtube_channel_id}&type=video&order=date&maxResults=5&key=${YOUTUBE_API_KEY}`);
            const vidData = await vidRes.json();
            const videoIds = (vidData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);

            let topVideos: any[] = [];
            if (videoIds.length) {
              const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
              const vData = await vRes.json();
              topVideos = (vData.items || []).map((v: any) => ({
                title: v.snippet?.title, views: parseInt(v.statistics?.viewCount || "0"),
                likes: parseInt(v.statistics?.likeCount || "0"),
              }));
            }

            await sb.from("channel_intelligence").insert({
              youtube_channel_id: ch.youtube_channel_id,
              channel_name: ch.channel_name || channel.snippet?.title,
              subscribers: subs, avg_views: avgViews,
              niche: (ch as any).niche || "general",
              style: "auto_detected", growth_rate: subs > 100000 ? "fast" : subs > 10000 ? "steady" : "emerging",
              is_faceless: true, is_monetized: subs >= 1000,
              top_videos: topVideos, viral_patterns: {},
              country: channel.snippet?.country || "US",
              language: "auto",
            });

            results.enriched++;
            results.details.push({ type: "channel_to_intel", name: ch.channel_name });
          } catch (e) {
            console.error(`Channel enrich error for ${ch.channel_name}:`, e);
            results.errors++;
          }
        }
      } catch (e) {
        console.error("sync_channels_to_intel error:", e);
        results.errors++;
      }
    }

    // ========== MODE: USER ACTIVITY FEED ==========
    if (mode === "user_activity_feed" || mode === "full") {
      try {
        // Learn from recent saved searches
        const { data: recentSearches } = await sb.from("saved_searches")
          .select("query, tab, results_json, filters_json")
          .order("created_at", { ascending: false })
          .limit(10);

        // Learn from recent niche analyses
        const { data: recentAnalyses } = await sb.from("saved_niche_analyses")
          .select("niche, country, analysis_json, score")
          .order("created_at", { ascending: false })
          .limit(10);

        // Extract trending search patterns
        const searchTopics = (recentSearches || []).map((s: any) => s.query);
        const analyzedNiches = (recentAnalyses || []).map((a: any) => ({ niche: a.niche, country: a.country, score: a.score }));

        if (searchTopics.length + analyzedNiches.length > 0) {
          // Save activity insights to ai_learning
          await sb.from("ai_learning").insert({
            topic: "user_activity_trends",
            insight: `Recent searches: ${searchTopics.join(", ")}. Analyzed niches: ${analyzedNiches.map((n: any) => `${n.niche} (${n.country}, score: ${n.score})`).join(", ")}. Timestamp: ${new Date().toISOString()}`,
            source: "intelligence_sync_engine",
          });
          results.newRecords++;

          // Auto-expand niche_database with high-scoring user-analyzed niches
          for (const analysis of analyzedNiches) {
            if (analysis.score >= 60) {
              const { data: exists } = await sb.from("niche_database")
                .select("id").ilike("name", `%${analysis.niche}%`).maybeSingle();
              if (!exists) {
                const analysisData = analysis.analysis_json as any;
                await sb.from("niche_database").insert({
                  name: analysis.niche,
                  country: analysis.country || "BR",
                  rpm_estimate: analysisData?.analysis?.estimatedRpm || 2,
                  difficulty: analysisData?.analysis?.difficulty || "médio",
                  saturation: analysisData?.analysis?.saturation === "Alta" ? "alta" : analysisData?.analysis?.saturation === "Baixa" ? "baixa" : "média",
                  faceless_friendly: (analysisData?.analysis?.facelessViability || 0) > 50,
                  sub_niches: JSON.stringify((analysisData?.analysis?.subNiches || []).map((s: any) => s.name)),
                  language: "pt",
                });
                results.newRecords++;
                results.details.push({ type: "auto_niche_expand", niche: analysis.niche, score: analysis.score });
              }
            }
          }
        }

        // Feed viral_titles_db from high-performing videos found in user searches
        for (const search of (recentSearches || [])) {
          const searchResults = search.results_json as any[];
          if (!Array.isArray(searchResults)) continue;

          for (const video of searchResults) {
            if (!video.title || !video.views || video.views < 300000) continue;

            const { data: exists } = await sb.from("viral_titles_db")
              .select("id").eq("title", video.title).maybeSingle();
            if (!exists) {
              await sb.from("viral_titles_db").insert({
                title: video.title,
                views: video.views,
                likes: video.likes || 0,
                channel_name: video.channelTitle || video.channelName || "",
                channel_id: video.channelId || "",
                niche: search.query,
                published_at: video.publishedAt,
              });
              results.newRecords++;
              results.details.push({ type: "auto_viral_title", title: video.title?.slice(0, 50) });
            }
          }
        }
      } catch (e) {
        console.error("user_activity_feed error:", e);
        results.errors++;
      }
    }

    // ========== MODE: CROSS POLLINATE ==========
    if (mode === "cross_pollinate" || mode === "full") {
      try {
        // Take channel_intelligence patterns → viral_content_library
        const { data: intelChannels } = await sb.from("channel_intelligence")
          .select("channel_name, niche, viral_patterns, style, growth_rate, avg_views")
          .order("avg_views", { ascending: false })
          .limit(30);

        const patternsToSave: any[] = [];
        for (const ch of (intelChannels || [])) {
          const patterns = ch.viral_patterns as any;
          if (patterns && typeof patterns === "object" && Object.keys(patterns).length > 0) {
            patternsToSave.push({
              channel: ch.channel_name, niche: ch.niche,
              patterns, style: ch.style, growth: ch.growth_rate,
            });
          }
        }

        if (patternsToSave.length >= 3) {
          const batchData = patternsToSave.slice(0, 10).map((p: any) =>
            `${p.channel} (${p.niche}, ${p.growth}): style=${p.style}, patterns=${JSON.stringify(p.patterns).slice(0, 200)}`
          ).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST", headers: aiH,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Synthesize viral content patterns from multiple channels into reusable templates. Be specific." },
                { role: "user", content: `Cross-reference these channel patterns:\n${batchData}\n\nGenerate 3 reusable viral content templates.` }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "generate_templates",
                  parameters: {
                    type: "object",
                    properties: {
                      templates: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            description: { type: "string" },
                            hookFormula: { type: "string" },
                            structureFormula: { type: "string" },
                            niches: { type: "array", items: { type: "string" } },
                            effectiveness: { type: "number" },
                          },
                          required: ["name", "description", "hookFormula", "structureFormula", "niches", "effectiveness"],
                          additionalProperties: false,
                        }
                      }
                    },
                    required: ["templates"], additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "generate_templates" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const { templates } = JSON.parse(tc.function.arguments);
              for (const t of (templates || [])) {
                await sb.from("viral_content_library").insert({
                  category: "cross_pollinated_template",
                  content_json: { name: t.name, description: t.description, hookFormula: t.hookFormula, structureFormula: t.structureFormula, source: "intelligence_sync_engine" },
                  effectiveness_score: t.effectiveness,
                  language: "pt",
                  niches: t.niches,
                });
                results.newRecords++;
              }
              results.details.push({ type: "cross_pollinate", templates: templates?.length });
            }
          } else { await aiRes.text(); }
        }

        // Sync hook_library insights → audience_psychology_patterns
        const { data: topHooks } = await sb.from("hook_library")
          .select("hook_text, hook_type, retention_score, niche")
          .order("retention_score", { ascending: false })
          .limit(50);

        // Group hooks by type and find gaps in psychology patterns
        const hookTypes: Record<string, number> = {};
        (topHooks || []).forEach((h: any) => {
          const type = h.hook_type || "unknown";
          hookTypes[type] = (hookTypes[type] || 0) + 1;
        });

        const { data: existingPsych } = await sb.from("audience_psychology_patterns")
          .select("trigger_type").limit(100);
        const psychSet = new Set((existingPsych || []).map((p: any) => p.trigger_type));

        // Map hook types to psychology triggers
        const hookToPsych: Record<string, string> = {
          curiosity: "information_gap", shock: "shock_value", urgency: "fomo_urgency",
          contrarian: "contrarian_effect", story: "narrative_transport",
          challenge: "achievement_drive", authority: "social_proof", fear: "loss_aversion",
        };

        for (const [hookType, count] of Object.entries(hookTypes)) {
          const psychType = hookToPsych[hookType];
          if (psychType && !psychSet.has(psychType) && count >= 2) {
            const relevantHooks = (topHooks || []).filter((h: any) => h.hook_type === hookType).slice(0, 5);
            await sb.from("audience_psychology_patterns").insert({
              trigger_type: psychType,
              description: `Auto-detected from ${count} hooks of type "${hookType}". Avg retention: ${(relevantHooks.reduce((s: number, h: any) => s + (h.retention_score || 7), 0) / relevantHooks.length).toFixed(1)}`,
              example_hooks: relevantHooks.map((h: any) => h.hook_text),
              retention_score: Math.round(relevantHooks.reduce((s: number, h: any) => s + (h.retention_score || 7), 0) / relevantHooks.length),
              niches: [...new Set(relevantHooks.map((h: any) => h.niche).filter(Boolean))],
              source: "intelligence_sync_engine",
            });
            results.newRecords++;
          }
        }
      } catch (e) {
        console.error("cross_pollinate error:", e);
        results.errors++;
      }
    }

    // Log execution (never break the request if logging fails)
    const { error: logError } = await sb.from("execution_logs").insert({
      function_name: "intelligence-sync-engine",
      success: results.errors === 0,
      duration_ms: Date.now() - startTime,
      api_calls_made: results.synced + results.enriched,
      metadata: { mode, ...results },
    });
    if (logError) console.error("execution_logs insert error:", logError);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("intelligence-sync-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
