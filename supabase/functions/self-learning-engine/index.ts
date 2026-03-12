import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Self Learning Engine
 * 
 * Modes:
 * - "scan_trending": Finds trending videos in tracked niches and learns from them
 * - "analyze_outliers": Analyzes outlier videos from user channels
 * - "update_patterns": Cross-references existing data to discover new patterns
 * - "full_cycle": Runs all modes sequentially
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "full_cycle", niche, maxVideos = 10 } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    const results: any = { learned: 0, errors: 0, details: [] };

    // ========== MODE: SCAN TRENDING ==========
    if (mode === "scan_trending" || mode === "full_cycle") {
      try {
        // Get niches to scan from niche_database
        const { data: niches } = await sb.from("niche_database")
          .select("name")
          .eq("faceless_friendly", true)
          .order("rpm_estimate", { ascending: false })
          .limit(niche ? 1 : 5);

        const scanNiches = niche ? [niche] : (niches || []).map((n: any) => n.name);

        for (const n of scanNiches) {
          try {
            // Search for trending videos in this niche
            const searchRes = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(n)}&type=video&order=viewCount&maxResults=${Math.min(maxVideos, 10)}&publishedAfter=${new Date(Date.now() - 30 * 86400000).toISOString()}&key=${YOUTUBE_API_KEY}`
            );
            const searchData = await searchRes.json();
            const videoIds = (searchData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
            if (!videoIds.length) continue;

            // Get stats
            const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
            const vData = await vRes.json();

            for (const video of (vData.items || [])) {
              const views = parseInt(video.statistics?.viewCount || '0');
              const likes = parseInt(video.statistics?.likeCount || '0');
              if (views < 200000) continue; // Only learn from high-performing videos

              // Check if already in viral_titles_db
              const { data: exists } = await sb.from("viral_titles_db")
                .select("id").eq("title", video.snippet.title).maybeSingle();
              
              if (!exists) {
                const dur = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                const seconds = dur ? (parseInt(dur[1]||'0')*3600 + parseInt(dur[2]||'0')*60 + parseInt(dur[3]||'0')) : 0;

                await sb.from("viral_titles_db").insert({
                  title: video.snippet.title,
                  channel_name: video.snippet.channelTitle,
                  channel_id: video.snippet.channelId,
                  views, likes,
                  niche: n,
                  published_at: video.snippet.publishedAt,
                  duration_seconds: seconds,
                });
                results.learned++;
                results.details.push({ type: "viral_title", title: video.snippet.title, views });
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

    // ========== MODE: ANALYZE OUTLIERS ==========
    if (mode === "analyze_outliers" || mode === "full_cycle") {
      try {
        // Get channels from channel_intelligence with recent outlier patterns
        const { data: channels } = await sb.from("channel_intelligence")
          .select("youtube_channel_id,channel_name,avg_views,niche")
          .order("avg_views", { ascending: false })
          .limit(5);

        for (const ch of (channels || [])) {
          try {
            // Find recent videos with views > 3x avg
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
              // Use AI to extract patterns from outliers
              const outlierTitles = outliers.map((v: any) => `"${v.snippet.title}" (${parseInt(v.statistics?.viewCount||'0').toLocaleString()} views)`).join("\n");

              const aiRes = await fetch(AI_URL, {
                method: "POST",
                headers: aiHeaders,
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "Extract viral patterns from outlier videos. Be specific and actionable." },
                    { role: "user", content: `Channel "${ch.channel_name}" (${ch.niche}, avg ${ch.avg_views} views) has these outlier videos:\n${outlierTitles}\n\nExtract the viral patterns.` }
                  ],
                  tools: [{
                    type: "function",
                    function: {
                      name: "extract_patterns",
                      description: "Extract viral patterns from outlier videos",
                      parameters: {
                        type: "object",
                        properties: {
                          titlePatterns: { type: "array", items: { type: "string" } },
                          emotionalTriggers: { type: "array", items: { type: "string" } },
                          hookTechnique: { type: "string" },
                          contentAngle: { type: "string" },
                          whyOutlier: { type: "string" },
                        },
                        required: ["titlePatterns", "emotionalTriggers", "hookTechnique", "contentAngle", "whyOutlier"],
                        additionalProperties: false,
                      }
                    }
                  }],
                  tool_choice: { type: "function", function: { name: "extract_patterns" } },
                }),
              });

              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
                if (tc) {
                  const patterns = JSON.parse(tc.function.arguments);
                  
                  // Save to script_knowledge
                  await sb.from("script_knowledge").insert({
                    category: "outlier_pattern",
                    title: `Outlier Pattern: ${ch.channel_name} (${ch.niche})`,
                    content: `Hook: ${patterns.hookTechnique}. Angle: ${patterns.contentAngle}. Why outlier: ${patterns.whyOutlier}. Title patterns: ${patterns.titlePatterns.join('; ')}. Triggers: ${patterns.emotionalTriggers.join(', ')}.`,
                    effectiveness_score: 9,
                    examples: JSON.stringify(outliers.map((v: any) => v.snippet.title).slice(0, 3)),
                  });
                  results.learned++;
                  results.details.push({ type: "outlier_pattern", channel: ch.channel_name, outliers: outliers.length });
                }
              } else {
                await aiRes.text(); // consume
              }
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

    // ========== MODE: UPDATE PATTERNS ==========
    if (mode === "update_patterns" || mode === "full_cycle") {
      try {
        // Cross-reference viral_titles_db to find new title patterns
        const { data: titles } = await sb.from("viral_titles_db")
          .select("title,views,niche,title_pattern,emotional_triggers")
          .order("views", { ascending: false })
          .limit(50);

        // Find titles without patterns
        const unanalyzed = (titles || []).filter((t: any) => !t.title_pattern);
        
        if (unanalyzed.length >= 5) {
          const titleList = unanalyzed.slice(0, 20).map((t: any) => `"${t.title}" (${t.views?.toLocaleString()} views, ${t.niche})`).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST",
            headers: aiHeaders,
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Analyze viral YouTube titles and extract copywriting patterns. Return structured data." },
                { role: "user", content: `Classify these viral titles by pattern:\n${titleList}` }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "classify_titles",
                  description: "Classify viral titles by copywriting pattern",
                  parameters: {
                    type: "object",
                    properties: {
                      classifications: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            pattern: { type: "string" },
                            triggers: { type: "array", items: { type: "string" } },
                            whyViral: { type: "string" },
                          },
                          required: ["title", "pattern", "triggers", "whyViral"],
                          additionalProperties: false,
                        }
                      },
                      newPatterns: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            patternName: { type: "string" },
                            description: { type: "string" },
                            formula: { type: "string" },
                            exampleTitles: { type: "array", items: { type: "string" } },
                          },
                          required: ["patternName", "description", "formula", "exampleTitles"],
                          additionalProperties: false,
                        }
                      }
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

              // Update viral_titles_db with patterns
              for (const c of (data.classifications || [])) {
                await sb.from("viral_titles_db")
                  .update({ title_pattern: c.pattern, why_viral: c.whyViral, emotional_triggers: c.triggers })
                  .eq("title", c.title);
                results.learned++;
              }

              // Save new patterns to viral_content_library
              for (const p of (data.newPatterns || [])) {
                await sb.from("viral_content_library").insert({
                  category: "title_pattern",
                  content_json: {
                    name: p.patternName,
                    description: p.description,
                    formula: p.formula,
                    examples: p.exampleTitles,
                    source: "self_learning_engine",
                    detected_at: new Date().toISOString(),
                  },
                  effectiveness_score: 8,
                  language: "pt",
                  niches: ["todos"],
                });
                results.learned++;
                results.details.push({ type: "new_pattern", name: p.patternName });
              }
            }
          } else {
            await aiRes.text();
          }
        }

        // Cross-reference audience_psychology_patterns — find underrepresented triggers
        const { data: psychPatterns } = await sb.from("audience_psychology_patterns")
          .select("trigger_type,retention_score").order("retention_score", { ascending: false });

        const existingTriggers = new Set((psychPatterns || []).map((p: any) => p.trigger_type));

        // Get emotions from blueprints that aren't in psychology patterns
        const { data: blueprints } = await sb.from("video_blueprints")
          .select("psychological_triggers,hook_type,video_title,views")
          .order("views", { ascending: false })
          .limit(20);

        const newTriggers: string[] = [];
        for (const bp of (blueprints || [])) {
          for (const trigger of (bp.psychological_triggers || [])) {
            const key = trigger.toLowerCase().replace(/\s+/g, '_');
            if (!existingTriggers.has(key) && !newTriggers.includes(key)) {
              newTriggers.push(key);
              await sb.from("audience_psychology_patterns").insert({
                trigger_type: key,
                description: `Auto-detected from "${bp.video_title}" (${bp.views?.toLocaleString()} views). Hook type: ${bp.hook_type || 'unknown'}.`,
                example_titles: [bp.video_title],
                retention_score: 7,
                source: "self_learning_engine",
              });
              results.learned++;
              results.details.push({ type: "new_trigger", trigger: key });
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
      metadata: { mode, learned: results.learned, errors: results.errors, details: results.details.slice(0, 20) },
      error_message: results.errors > 0 ? `${results.errors} errors during learning cycle` : null,
    }).then(() => {}).catch(() => {});

    console.log(`Self-Learning Engine: mode=${mode}, learned=${results.learned}, errors=${results.errors}`);

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
