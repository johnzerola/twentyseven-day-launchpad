import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BREAKOUT_THRESHOLD = 8;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const { maxVideos = 10, niche } = await req.json().catch(() => ({}));
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const results = { enriched: 0, breakouts: 0, hooks_generated: 0, patterns_saved: 0, scripts_generated: 0, prompts_queued: 0, errors: 0, details: [] as any[] };

    // Step 1: Get recent trending videos (published within 72h)
    const since = new Date(Date.now() - 72 * 3600000).toISOString();
    const niches = niche ? [niche] : await getTopNiches(sb);

    for (const n of niches) {
      try {
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(n)}&type=video&order=viewCount&maxResults=${Math.min(maxVideos, 10)}&publishedAfter=${since}&key=${YOUTUBE_API_KEY}`
        );
        const searchData = await searchRes.json();
        const videoIds = (searchData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
        if (!videoIds.length) continue;

        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
        const vData = await vRes.json();

        for (const video of (vData.items || [])) {
          try {
            const views = parseInt(video.statistics?.viewCount || '0');
            const likes = parseInt(video.statistics?.likeCount || '0');
            const comments = parseInt(video.statistics?.commentCount || '0');
            const videoId = video.id;
            const title = video.snippet?.title || '';
            const channelId = video.snippet?.channelId || '';
            const channelTitle = video.snippet?.channelTitle || '';

            // Step 2: Enrich — extract thumbnail features via AI vision
            const thumbnailUrl = video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url;
            if (thumbnailUrl) {
              await enrichThumbnail(sb, aiH, videoId, thumbnailUrl, title);
            }

            // Step 3: Compute viral score
            const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
            const dur = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const seconds = dur ? (parseInt(dur[1]||'0')*3600 + parseInt(dur[2]||'0')*60 + parseInt(dur[3]||'0')) : 0;
            const isLongForm = seconds > 480;

            const viralScore = computeViralScore(views, engagementRate, isLongForm);
            results.enriched++;

            // Step 4: Upsert emerging channel
            const { data: existing } = await sb.from("emerging_channels")
              .select("id,viral_score").eq("channel_id", channelId).maybeSingle();

            if (existing) {
              if (viralScore > (existing.viral_score || 0)) {
                await sb.from("emerging_channels").update({
                  viral_score: viralScore,
                  sample_video_id: videoId,
                  last_checked: new Date().toISOString(),
                  meta: { views, likes, engagement: engagementRate, title },
                }).eq("id", existing.id);
              }
            } else {
              await sb.from("emerging_channels").insert({
                channel_id: channelId,
                channel_title: channelTitle,
                niche: n,
                viral_score: viralScore,
                sample_video_id: videoId,
                meta: { views, likes, engagement: engagementRate, title },
              });
            }

            // Step 5: If breakout → full pipeline: reverse engineer → script → scenes → queue prompts
            if (viralScore >= BREAKOUT_THRESHOLD && isLongForm) {
              results.breakouts++;

              // 5a. Reverse engineer the video
              const pattern = await reverseEngineerVideo(sb, aiH, video, n, engagementRate);
              if (pattern) {
                results.patterns_saved++;
                results.details.push({ type: "breakout", title, score: viralScore, pattern: pattern.pattern_name });

                // 5b. Generate hooks using RAG context
                const hooks = await generateHooks(sb, aiH, pattern, n, title);
                results.hooks_generated += hooks.length;

                // 5c. Select best hook and generate full script
                const bestHook = hooks.length > 0
                  ? hooks.sort((a: any, b: any) => (b.retention_score || 0) - (a.retention_score || 0))[0]
                  : { hook_text: pattern.hook_text, hook_type: pattern.hook_type };

                const scriptResult = await generateBreakoutScript(sb, aiH, pattern, bestHook, n, title, seconds);
                if (scriptResult) {
                  results.scripts_generated++;

                  // 5d. Break script into scenes
                  const scenes = await breakdownScenes(sb, aiH, scriptResult.script, n, scriptResult.projectId);
                  if (scenes.length > 0) {
                    // 5e. Queue prompt generation via task_queue
                    await sb.from("task_queue").insert({
                      task_type: "generate_prompts",
                      payload: { project_id: scriptResult.projectId },
                      status: "pending",
                      scheduled_at: new Date().toISOString(),
                    });
                    results.prompts_queued++;
                    results.details.push({ type: "auto_pipeline", title, project_id: scriptResult.projectId, scenes: scenes.length });
                  }
                }
              }
            } else if (viralScore >= BREAKOUT_THRESHOLD) {
              results.breakouts++;
              const pattern = await reverseEngineerVideo(sb, aiH, video, n, engagementRate);
              if (pattern) {
                results.patterns_saved++;
                const hooks = await generateHooks(sb, aiH, pattern, n, title);
                results.hooks_generated += hooks.length;
                results.details.push({ type: "breakout_short", title, score: viralScore });
              }
            }
          } catch (e) {
            console.error(`Error processing video:`, e);
            results.errors++;
          }
        }
      } catch (e) {
        console.error(`Error scanning niche "${n}":`, e);
        results.errors++;
      }
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "auto-enrich-worker",
      success: results.errors === 0,
      duration_ms: Date.now() - startTime,
      api_calls_made: results.enriched,
      metadata: results,
    }).catch(() => {});

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-enrich-worker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helpers ──────────────────────────────────────────────

async function getTopNiches(sb: any): Promise<string[]> {
  const { data } = await sb.from("niche_database")
    .select("name").eq("faceless_friendly", true)
    .order("rpm_estimate", { ascending: false }).limit(5);
  return (data || []).map((n: any) => n.name);
}

function computeViralScore(views: number, engagementRate: number, isLongForm: boolean): number {
  let score = 0;
  if (views > 5000000) score += 3;
  else if (views > 1000000) score += 2.5;
  else if (views > 500000) score += 2;
  else if (views > 100000) score += 1.5;
  else if (views > 50000) score += 1;

  if (engagementRate > 10) score += 3;
  else if (engagementRate > 5) score += 2;
  else if (engagementRate > 2) score += 1.5;
  else if (engagementRate > 1) score += 1;

  if (isLongForm) score += 1;

  // Velocity bonus (views in 72h)
  if (views > 1000000) score += 1;

  return Math.min(score, 10);
}

async function enrichThumbnail(sb: any, aiH: any, videoId: string, thumbnailUrl: string, title: string) {
  // Check if already analyzed
  const { data: exists } = await sb.from("thumbnail_features")
    .select("id").eq("video_id", videoId).maybeSingle();
  if (exists) return;

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Analyze YouTube thumbnail for viral potential. Extract visual features." },
          { role: "user", content: `Thumbnail URL: ${thumbnailUrl}\nVideo title: "${title}"\n\nAnalyze this thumbnail's visual characteristics.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_thumbnail_features",
            description: "Extract visual features from a YouTube thumbnail",
            parameters: {
              type: "object",
              properties: {
                face_count: { type: "integer", description: "Number of faces visible" },
                emotion_tags: { type: "array", items: { type: "string" }, description: "Emotions expressed" },
                text_overlay: { type: "boolean", description: "Whether text is overlaid" },
                dominant_colors: { type: "array", items: { type: "string" }, description: "Top 3 dominant colors" },
                avg_contrast: { type: "number", description: "Estimated contrast 0-10" },
                ctr_estimate: { type: "number", description: "Estimated CTR score 0-10" },
              },
              required: ["face_count", "emotion_tags", "text_overlay", "dominant_colors", "avg_contrast", "ctr_estimate"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_thumbnail_features" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const f = JSON.parse(tc.function.arguments);
        await sb.from("thumbnail_features").insert({
          video_id: videoId,
          face_count: f.face_count || 0,
          emotion_tags: f.emotion_tags || [],
          text_overlay: f.text_overlay || false,
          dominant_colors: f.dominant_colors || [],
          avg_contrast: f.avg_contrast || 0,
          ctr_estimate: f.ctr_estimate || 0,
          source_url: thumbnailUrl,
        });
      }
    } else {
      await aiRes.text();
    }
  } catch (e) {
    console.error("enrichThumbnail error:", e);
  }
}

async function reverseEngineerVideo(sb: any, aiH: any, video: any, niche: string, engagement: number): Promise<any> {
  const title = video.snippet?.title || '';
  const description = (video.snippet?.description || '').slice(0, 500);
  const views = parseInt(video.statistics?.viewCount || '0');
  const videoId = video.id;

  // Get existing patterns for context
  const { data: existingPatterns } = await sb.from("viral_patterns")
    .select("pattern_name").eq("niche", niche).limit(10);
  const knownPatterns = (existingPatterns || []).map((p: any) => p.pattern_name).join(', ');

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a viral video reverse-engineering expert. Analyze breakout videos and extract replicable patterns." },
          { role: "user", content: `BREAKOUT VIDEO:\nTitle: "${title}"\nViews: ${views.toLocaleString()}\nEngagement: ${engagement.toFixed(1)}%\nNiche: ${niche}\nDescription: ${description}\n\nKnown patterns in this niche: ${knownPatterns || 'none yet'}\n\nReverse engineer this video. Extract the viral pattern.` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_viral_pattern",
            description: "Save a reverse-engineered viral pattern",
            parameters: {
              type: "object",
              properties: {
                pattern_name: { type: "string" },
                hook_type: { type: "string" },
                hook_text: { type: "string" },
                storytelling_structure: { type: "string" },
                emotional_triggers: { type: "array", items: { type: "string" } },
                pacing: { type: "string" },
                retention_techniques: { type: "array", items: { type: "string" } },
                why_viral: { type: "string" },
                replication_formula: { type: "string" },
              },
              required: ["pattern_name", "hook_type", "hook_text", "storytelling_structure", "emotional_triggers", "pacing", "retention_techniques", "why_viral", "replication_formula"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_viral_pattern" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const p = JSON.parse(tc.function.arguments);

        // Save to viral_patterns
        await sb.from("viral_patterns").insert({
          pattern_name: p.pattern_name,
          pattern_json: p,
          niche,
        });

        // Save hook to hook_library
        await sb.from("hook_library").insert({
          hook_text: p.hook_text,
          hook_type: p.hook_type,
          niche,
          retention_score: 8,
        });

        // Also enrich script_knowledge
        await sb.from("script_knowledge").insert({
          category: "reverse_engineered",
          title: `Pattern: ${p.pattern_name} (${niche})`,
          content: `Structure: ${p.storytelling_structure}. Pacing: ${p.pacing}. Why viral: ${p.why_viral}. Formula: ${p.replication_formula}. Retention: ${p.retention_techniques.join('; ')}.`,
          effectiveness_score: 9,
          examples: JSON.stringify([title]),
        });

        return p;
      }
    } else {
      await aiRes.text();
    }
  } catch (e) {
    console.error("reverseEngineerVideo error:", e);
  }
  return null;
}

async function generateHooks(sb: any, aiH: any, pattern: any, niche: string, originalTitle: string): Promise<any[]> {
  // Build RAG context from existing patterns + hook library
  const { data: hooks } = await sb.from("hook_library")
    .select("hook_text,hook_type,retention_score")
    .eq("niche", niche).order("retention_score", { ascending: false }).limit(10);

  const { data: psychPatterns } = await sb.from("audience_psychology_patterns")
    .select("trigger_type,description")
    .order("retention_score", { ascending: false }).limit(5);

  const ragContext = `
EXISTING HIGH-PERFORMING HOOKS (${niche}):
${(hooks || []).map((h: any) => `- [${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score})`).join('\n')}

PSYCHOLOGY TRIGGERS:
${(psychPatterns || []).map((p: any) => `- ${p.trigger_type}: ${p.description}`).join('\n')}

REVERSE-ENGINEERED PATTERN:
${JSON.stringify(pattern, null, 2)}
  `.trim();

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Generate 5 viral hooks inspired by the pattern. Each hook must be unique, attention-grabbing, and optimized for retention." },
          { role: "user", content: `Based on this context, generate 5 new hooks for the niche "${niche}".\n\nOriginal video: "${originalTitle}"\n\n${ragContext}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_hooks",
            description: "Save generated hooks",
            parameters: {
              type: "object",
              properties: {
                hooks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      hook_text: { type: "string" },
                      hook_type: { type: "string" },
                      retention_score: { type: "number" },
                    },
                    required: ["hook_text", "hook_type", "retention_score"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["hooks"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "save_hooks" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const data = JSON.parse(tc.function.arguments);
        const generatedHooks = data.hooks || [];

        for (const h of generatedHooks) {
          await sb.from("hook_library").insert({
            hook_text: h.hook_text,
            hook_type: h.hook_type,
            niche,
            retention_score: h.retention_score || 7,
          });
        }
        return generatedHooks;
      }
    } else {
      await aiRes.text();
    }
  } catch (e) {
    console.error("generateHooks error:", e);
  }
  return [];
}
