import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts
const BREAKOUT_THRESHOLD = 0.70; // normalized 0-1 scale

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const { maxVideos = 10, niche, hours = 72 } = await req.json().catch(() => ({}));
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" };
    const results = {
      enriched: 0, breakouts: 0, hooks_generated: 0, patterns_saved: 0,
      scripts_generated: 0, prompts_queued: 0, errors: 0, details: [] as any[],
    };

    // Step 1: Get recent trending videos (published within N hours)
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    const niches = niche ? [niche] : await getTopNiches(sb);

    for (const n of niches) {
      try {
        // Fetch trending videos from YouTube
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(n)}&type=video&order=viewCount&maxResults=${Math.min(maxVideos, 10)}&publishedAfter=${since}&key=${YOUTUBE_API_KEY}`
        );
        const searchData = await searchRes.json();
        const videoIds = (searchData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
        if (!videoIds.length) continue;

        // Fetch full video stats
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
        const vData = await vRes.json();

        for (const video of (vData.items || [])) {
          try {
            const views = parseInt(video.statistics?.viewCount || "0");
            const likes = parseInt(video.statistics?.likeCount || "0");
            const comments = parseInt(video.statistics?.commentCount || "0");
            const videoId = video.id;
            const title = video.snippet?.title || "";
            const channelId = video.snippet?.channelId || "";
            const channelTitle = video.snippet?.channelTitle || "";
            const publishedAt = video.snippet?.publishedAt || new Date().toISOString();
            const dur = video.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const durationSec = dur ? (parseInt(dur[1] || "0") * 3600 + parseInt(dur[2] || "0") * 60 + parseInt(dur[3] || "0")) : 0;
            const isLongForm = durationSec > 480;

            // Step 2: Enrich — thumbnail features via AI vision
            const thumbnailUrl = video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url;
            let thumbnailCtr = 0.05;
            if (thumbnailUrl) {
              thumbnailCtr = await enrichThumbnail(sb, aiH, videoId, thumbnailUrl, title);
            }

            // Step 3: Compute viral score using weighted formula
            const channelMedian = await getChannelMedianViews(sb, channelId, YOUTUBE_API_KEY);
            const hoursSincePublish = Math.max((Date.now() - new Date(publishedAt).getTime()) / 3600_000, 1);

            const viralScore = computeViralScore({
              views, likes, comments, durationSec,
              channelMedian, hoursSincePublish, thumbnailCtr,
            });
            results.enriched++;

            // Step 4: Upsert emerging channel
            const { data: existing } = await sb.from("emerging_channels")
              .select("id,viral_score").eq("channel_id", channelId).maybeSingle();

            const meta = { views, likes, comments, engagement: views > 0 ? ((likes + comments) / views * 100) : 0, title, duration_sec: durationSec, viral_score_raw: viralScore };

            if (existing) {
              if (viralScore > (existing.viral_score || 0)) {
                await sb.from("emerging_channels").update({
                  viral_score: Math.round(viralScore * 100),
                  sample_video_id: videoId, channel_title: channelTitle,
                  last_checked: new Date().toISOString(), meta,
                }).eq("id", existing.id);
              }
            } else {
              await sb.from("emerging_channels").insert({
                channel_id: channelId, channel_title: channelTitle, niche: n,
                viral_score: Math.round(viralScore * 100),
                sample_video_id: videoId, meta,
              });
            }

            // Step 5: If breakout → full pipeline
            if (viralScore >= BREAKOUT_THRESHOLD) {
              results.breakouts++;

              // 5a. Reverse engineer the video
              const pattern = await reverseEngineerVideo(sb, aiH, video, n, meta.engagement);
              if (pattern) {
                results.patterns_saved++;
                results.details.push({ type: "breakout", title, score: viralScore, pattern: pattern.pattern_name });

                // 5b. Generate hooks using RAG context (Brave Search + DB)
                const ragContext = await buildRagContext(sb, BRAVE_API_KEY, title, n);
                const hooks = await generateHooks(sb, aiH, pattern, n, title, ragContext);
                results.hooks_generated += hooks.length;

                // 5c. Select best hook and generate full script (long-form only)
                if (isLongForm) {
                  const bestHook = hooks.length > 0
                    ? hooks.sort((a: any, b: any) => (b.retention_score || 0) - (a.retention_score || 0))[0]
                    : { hook_text: pattern.hook_text, hook_type: pattern.hook_type };

                  const scriptResult = await generateBreakoutScript(sb, aiH, pattern, bestHook, n, title, durationSec, ragContext);
                  if (scriptResult) {
                    results.scripts_generated++;

                    // 5d. Break script into scenes
                    const scenes = await breakdownScenes(sb, aiH, scriptResult.script, n, scriptResult.projectId);
                    if (scenes.length > 0) {
                      // 5e. Queue prompt generation
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
                } else {
                  results.details.push({ type: "breakout_short", title, score: viralScore });
                }
              }
            }
          } catch (e) {
            console.error("Error processing video:", e);
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
    }).then(() => {}, () => {});

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

// ─── Viral Score: Weighted Formula ──────────────────────────
// Returns normalized 0-1 score
interface ScoreInput {
  views: number; likes: number; comments: number; durationSec: number;
  channelMedian: number; hoursSincePublish: number; thumbnailCtr: number;
}

function computeViralScore(input: ScoreInput): number {
  const { views, likes, comments, durationSec, channelMedian, hoursSincePublish, thumbnailCtr } = input;

  // 1. Views ratio vs channel median (w=0.30)
  const viewsRatio = views / Math.max(channelMedian, 1);
  const normViewsRatio = Math.tanh(viewsRatio / 4); // compress outliers

  // 2. Velocity: views per hour (w=0.20)
  const viewsPerHour = views / hoursSincePublish;
  const normVelocity = Math.tanh(viewsPerHour / 1000);

  // 3. Estimated retention proxy: AVD ~25% fallback (w=0.20)
  const estAvd = durationSec * 0.25;
  const avdRatio = estAvd / Math.max(1, durationSec);
  const normAVD = Math.min(1, avdRatio * 2);

  // 4. Comment rate (w=0.10)
  const commentRate = comments / Math.max(1, views);
  const normComment = Math.tanh(commentRate * 100);

  // 5. Like rate (w=0.10)
  const likeRate = likes / Math.max(1, views);
  const normLike = Math.tanh(likeRate * 100);

  // 6. Novelty placeholder (w=0.06)
  const novelty = 0.05;

  // 7. Thumbnail CTR estimate (w=0.04)
  const normThumb = Math.min(1, thumbnailCtr / 10);

  const W = { w1: 0.30, w2: 0.20, w3: 0.20, w4: 0.10, w5: 0.10, w6: 0.06, w7: 0.04 };
  const score = W.w1 * normViewsRatio + W.w2 * normVelocity + W.w3 * normAVD +
    W.w4 * normComment + W.w5 * normLike + W.w6 * novelty + W.w7 * normThumb;

  return Math.round(score * 100) / 100;
}

// ─── Channel Median Views ───────────────────────────────────
async function getChannelMedianViews(sb: any, channelId: string, ytKey: string): Promise<number> {
  // Try to get from emerging_channels meta first
  const { data: ch } = await sb.from("emerging_channels")
    .select("meta").eq("channel_id", channelId).maybeSingle();
  if (ch?.meta?.median_views) return ch.meta.median_views;

  // Fetch last 10 videos from channel via YouTube API
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&key=${ytKey}`
    );
    const data = await res.json();
    const ids = (data.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
    if (!ids.length) return 1;

    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}&key=${ytKey}`);
    const vData = await vRes.json();
    const viewCounts = (vData.items || []).map((v: any) => parseInt(v.statistics?.viewCount || "0")).sort((a: number, b: number) => a - b);
    if (!viewCounts.length) return 1;

    return viewCounts[Math.floor(viewCounts.length / 2)] || 1;
  } catch {
    return 1;
  }
}

// ─── Top Niches ─────────────────────────────────────────────
async function getTopNiches(sb: any): Promise<string[]> {
  const { data } = await sb.from("niche_database")
    .select("name").eq("faceless_friendly", true)
    .order("rpm_estimate", { ascending: false }).limit(5);
  return (data || []).map((n: any) => n.name);
}

// ─── Thumbnail Enrichment ───────────────────────────────────
async function enrichThumbnail(sb: any, aiH: any, videoId: string, thumbnailUrl: string, title: string): Promise<number> {
  const { data: exists } = await sb.from("thumbnail_features")
    .select("id,ctr_estimate").eq("video_id", videoId).maybeSingle();
  if (exists) return exists.ctr_estimate || 0.05;

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Analyze YouTube thumbnail for viral potential. Extract visual features." },
          { role: "user", content: `Thumbnail URL: ${thumbnailUrl}\nVideo title: "${title}"\n\nAnalyze this thumbnail's visual characteristics.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_thumbnail_features",
            description: "Extract visual features from a YouTube thumbnail",
            parameters: {
              type: "object",
              properties: {
                face_count: { type: "integer" },
                emotion_tags: { type: "array", items: { type: "string" } },
                text_overlay: { type: "boolean" },
                dominant_colors: { type: "array", items: { type: "string" } },
                avg_contrast: { type: "number" },
                ctr_estimate: { type: "number", description: "Estimated CTR 0-10" },
              },
              required: ["face_count", "emotion_tags", "text_overlay", "dominant_colors", "avg_contrast", "ctr_estimate"],
              additionalProperties: false,
            },
          },
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
          video_id: videoId, face_count: f.face_count || 0,
          emotion_tags: f.emotion_tags || [], text_overlay: f.text_overlay || false,
          dominant_colors: f.dominant_colors || [], avg_contrast: f.avg_contrast || 0,
          ctr_estimate: f.ctr_estimate || 0, source_url: thumbnailUrl,
        });
        return f.ctr_estimate || 0.05;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("enrichThumbnail error:", e); }
  return 0.05;
}

// ─── Brave Search RAG Context ───────────────────────────────
async function buildRagContext(sb: any, braveKey: string | undefined, title: string, niche: string): Promise<string> {
  const query = `${title} ${niche} context`;
  const cacheKey = `rag_${query.slice(0, 100)}`;

  // Check cache first
  const { data: cached } = await sb.from("research_cache")
    .select("result_json").eq("cache_key", cacheKey)
    .gte("expires_at", new Date().toISOString()).maybeSingle();
  if (cached?.result_json) return JSON.stringify(cached.result_json).slice(0, 2000);

  if (!braveKey) return "";

  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { "X-Subscription-Token": braveKey },
    });
    const j = await res.json();
    const results = (j?.web?.results || j?.organic || []).slice(0, 5).map((r: any) => ({
      title: r.title, description: r.description || r.snippet || "",
    }));

    // Cache for 24h
    await sb.from("research_cache").insert({
      cache_key: cacheKey, query, source: "brave",
      result_json: results, expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }).then(() => {}, () => {});

    return JSON.stringify(results).slice(0, 2000);
  } catch (e) {
    console.error("Brave Search error:", e);
    return "";
  }
}

// ─── Reverse Engineer Video ─────────────────────────────────
async function reverseEngineerVideo(sb: any, aiH: any, video: any, niche: string, engagement: number): Promise<any> {
  const title = video.snippet?.title || "";
  const description = (video.snippet?.description || "").slice(0, 500);
  const views = parseInt(video.statistics?.viewCount || "0");

  const { data: existingPatterns } = await sb.from("viral_patterns")
    .select("pattern_name").eq("niche", niche).limit(10);
  const knownPatterns = (existingPatterns || []).map((p: any) => p.pattern_name).join(", ");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a viral video reverse-engineering expert. Analyze breakout videos and extract replicable patterns." },
          { role: "user", content: `BREAKOUT VIDEO:\nTitle: "${title}"\nViews: ${views.toLocaleString()}\nEngagement: ${engagement.toFixed(1)}%\nNiche: ${niche}\nDescription: ${description}\n\nKnown patterns: ${knownPatterns || "none yet"}\n\nReverse engineer this video. Extract the viral pattern.` },
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
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_viral_pattern" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const p = JSON.parse(tc.function.arguments);

        // Save pattern + hook + knowledge in parallel
        await Promise.all([
          sb.from("viral_patterns").insert({ pattern_name: p.pattern_name, pattern_json: p, niche }),
          sb.from("hook_library").insert({ hook_text: p.hook_text, hook_type: p.hook_type, niche, retention_score: 8 }),
          sb.from("script_knowledge").insert({
            category: "reverse_engineered",
            title: `Pattern: ${p.pattern_name} (${niche})`,
            content: `Structure: ${p.storytelling_structure}. Pacing: ${p.pacing}. Why viral: ${p.why_viral}. Formula: ${p.replication_formula}. Retention: ${p.retention_techniques.join("; ")}.`,
            effectiveness_score: 9,
            examples: JSON.stringify([title]),
          }),
        ]);

        // Save video segments (hook detection)
        await sb.from("video_segments").insert({
          video_id: video.id, start_seconds: 0, end_seconds: 8,
          segment_type: "hook", metric: 1.0,
          meta: { hook_type: p.hook_type, hook_text: p.hook_text },
        }).then(() => {}, () => {});

        return p;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("reverseEngineerVideo error:", e); }
  return null;
}

// ─── Generate Hooks with RAG ────────────────────────────────
async function generateHooks(sb: any, aiH: any, pattern: any, niche: string, originalTitle: string, ragContext: string): Promise<any[]> {
  const { data: hooks } = await sb.from("hook_library")
    .select("hook_text,hook_type,retention_score")
    .eq("niche", niche).order("retention_score", { ascending: false }).limit(10);

  const { data: psychPatterns } = await sb.from("audience_psychology_patterns")
    .select("trigger_type,description")
    .order("retention_score", { ascending: false }).limit(5);

  const context = `
EXISTING HOOKS (${niche}):
${(hooks || []).map((h: any) => `- [${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score})`).join("\n")}

PSYCHOLOGY TRIGGERS:
${(psychPatterns || []).map((p: any) => `- ${p.trigger_type}: ${p.description}`).join("\n")}

WEB CONTEXT:
${ragContext}

REVERSE-ENGINEERED PATTERN:
${JSON.stringify(pattern, null, 2)}
  `.trim();

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Generate 5 viral hooks inspired by the pattern. Each hook must be unique, attention-grabbing, and optimized for YouTube retention. Write in Portuguese (BR)." },
          { role: "user", content: `Generate 5 hooks for "${niche}".\nOriginal: "${originalTitle}"\n\n${context}` },
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
                      predicted_ctr: { type: "number" },
                    },
                    required: ["hook_text", "hook_type", "retention_score"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["hooks"],
              additionalProperties: false,
            },
          },
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
        // Batch insert all hooks
        if (generatedHooks.length > 0) {
          await sb.from("hook_library").insert(
            generatedHooks.map((h: any) => ({
              hook_text: h.hook_text, hook_type: h.hook_type,
              niche, retention_score: h.retention_score || 7,
            }))
          );
        }
        return generatedHooks;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("generateHooks error:", e); }
  return [];
}

// ─── Generate Breakout Script ───────────────────────────────
async function generateBreakoutScript(
  sb: any, aiH: any, pattern: any, bestHook: any,
  niche: string, originalTitle: string, durationSec: number, ragContext: string,
): Promise<{ script: string; projectId: string } | null> {
  const { data: knowledge } = await sb.from("script_knowledge")
    .select("title,content").order("effectiveness_score", { ascending: false }).limit(5);

  const scriptRag = `
VIRAL PATTERN: ${pattern.pattern_name}
Structure: ${pattern.storytelling_structure}
Pacing: ${pattern.pacing}
Retention: ${(pattern.retention_techniques || []).join(", ")}
Formula: ${pattern.replication_formula}

BEST HOOK: [${bestHook.hook_type}] "${bestHook.hook_text}"

WEB CONTEXT: ${ragContext}

SCRIPT KNOWLEDGE:
${(knowledge || []).map((k: any) => `- ${k.title}: ${k.content.slice(0, 150)}`).join("\n")}
  `.trim();

  const targetMin = Math.max(Math.min(Math.round(durationSec / 60), 15), 8);

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are an elite YouTube scriptwriter. Generate a ${targetMin}-minute faceless video script in Portuguese (BR). Use the provided viral pattern. High retention, nested curiosity loops, anti-AI-slop natural language. Start with the provided hook. Include mini-cliffhangers every 8-15 seconds.` },
          { role: "user", content: `Script inspired by "${originalTitle}" in "${niche}".\nDuration: ~${targetMin} min\n\n${scriptRag}\n\nWrite full script with [INTRO], [DEVELOPMENT], [CLIMAX], [CONCLUSION].` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_script",
            description: "Save the generated script",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                script: { type: "string" },
                scene_blueprint: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segment: { type: "string" },
                      narration: { type: "string" },
                      visual_description: { type: "string" },
                      duration_sec: { type: "integer" },
                      emotional_intent: { type: "string" },
                    },
                    required: ["segment", "narration", "visual_description", "duration_sec", "emotional_intent"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "script", "scene_blueprint"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_script" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const data = JSON.parse(tc.function.arguments);
        const { data: project } = await sb.from("video_projects").insert({
          title: data.title || `Auto: ${originalTitle.slice(0, 50)}`,
          script: data.script, niche,
          duration_seconds: targetMin * 60, status: "script",
          scene_blueprint_json: data.scene_blueprint || [],
          intelligence_json: { source: "auto-enrich-worker", pattern: pattern.pattern_name, original: originalTitle, rag_used: !!ragContext },
          user_id: "00000000-0000-0000-0000-000000000000",
        }).select("id").single();

        if (project) {
          console.log(`Created auto-project "${data.title}" (${project.id})`);
          return { script: data.script, projectId: project.id };
        }
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("generateBreakoutScript error:", e); }
  return null;
}

// ─── Scene Breakdown ────────────────────────────────────────
async function breakdownScenes(sb: any, aiH: any, script: string, niche: string, projectId: string): Promise<any[]> {
  try {
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("prompt_template,category").order("viral_score", { ascending: false }).limit(5);
    const sceneRef = (sceneKnowledge || []).map((s: any) => `[${s.category}] ${s.prompt_template.slice(0, 100)}`).join("\n");

    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Break this script into visual scenes for a faceless YouTube video. Each scene ~8s. Include narration, visual prompt, camera, lighting.\n\nVISUAL REFERENCE:\n${sceneRef}` },
          { role: "user", content: `Break into 8-15 scenes:\n\n${script.slice(0, 4000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_scenes",
            description: "Save scene breakdown",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tts_text: { type: "string" },
                      visual_prompt: { type: "string" },
                      duration_sec: { type: "integer" },
                      camera_movement: { type: "string" },
                      lighting: { type: "string" },
                      emotional_intent: { type: "string" },
                    },
                    required: ["tts_text", "visual_prompt", "duration_sec", "camera_movement", "lighting", "emotional_intent"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["scenes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_scenes" } },
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const data = JSON.parse(tc.function.arguments);
        const scenes = data.scenes || [];

        // Batch insert scenes
        if (scenes.length > 0) {
          await sb.from("scenes").insert(
            scenes.map((s: any, i: number) => ({
              project_id: projectId, sequence_order: i + 1,
              tts_text: s.tts_text, veo3_prompt: s.visual_prompt,
              duration_sec: s.duration_sec || 8, camera_movement: s.camera_movement,
              lighting: s.lighting, emotional_intent: s.emotional_intent, status: "pending",
            }))
          );
        }

        await sb.from("video_projects").update({ status: "scenes" }).eq("id", projectId);
        console.log(`Saved ${scenes.length} scenes for project ${projectId}`);
        return scenes;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("breakdownScenes error:", e); }
  return [];
}
