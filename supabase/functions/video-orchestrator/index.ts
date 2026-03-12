import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    const body = await req.json();
    const { video_id, video_title, video_tags, channel_id, niche, language = "pt", duration_minutes = 15, user_id } = body;

    if (!video_title) throw new Error("video_title is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // Credit check if user_id provided
    if (user_id) {
      const { data: hasCredits } = await sb.rpc("consume_credits", { _user_id: user_id, _amount: 5 });
      if (!hasCredits) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const detectedNiche = niche || "general";
    const query = `${video_title} ${(video_tags || []).join(" ")}`.trim();

    // ── Phase 1: Build RAG Context (Brave Search + DB) ──────────
    const ragContext = await buildRag(sb, BRAVE_API_KEY, query, detectedNiche);

    // Fetch existing patterns + hooks for RAG enrichment
    const [patternsRes, hooksRes, psychRes, knowledgeRes] = await Promise.all([
      sb.from("viral_patterns").select("pattern_name,pattern_json").eq("niche", detectedNiche).order("created_at", { ascending: false }).limit(5),
      sb.from("hook_library").select("hook_text,hook_type,retention_score").eq("niche", detectedNiche).order("retention_score", { ascending: false }).limit(10),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks").order("retention_score", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("title,content").order("effectiveness_score", { ascending: false }).limit(5),
    ]);

    const dbContext = {
      patterns: (patternsRes.data || []),
      hooks: (hooksRes.data || []),
      psychology: (psychRes.data || []),
      knowledge: (knowledgeRes.data || []),
    };

    // ── Phase 2: HookGen (10 hooks via Gemini Flash) ────────────
    const hooks = await callHookGen(aiH, ragContext, dbContext, detectedNiche, video_title, language);

    // Select best hook by predicted retention
    const bestHook = hooks.length > 0
      ? hooks.sort((a: any, b: any) => (b.retention_score || b.predicted_ctr || 0) - (a.retention_score || a.predicted_ctr || 0))[0]
      : { hook_text: `Você não vai acreditar no que descobrimos sobre ${video_title}`, hook_type: "curiosity" };

    // Save hooks to hook_library
    if (hooks.length > 0) {
      await sb.from("hook_library").insert(
        hooks.map((h: any) => ({
          hook_text: h.hook_text || h.hook, hook_type: h.hook_type || h.type || "curiosity",
          niche: detectedNiche, retention_score: h.retention_score || 7,
        }))
      ).catch(() => {});
    }

    // ── Phase 3: LongForm Script (Gemini Pro for quality) ───────
    const scriptData = await callLongForm(aiH, ragContext, dbContext, bestHook, video_title, detectedNiche, duration_minutes, language);

    // Create video project
    const { data: project } = await sb.from("video_projects").insert({
      title: scriptData.title || `Orquestrado: ${video_title.slice(0, 50)}`,
      script: scriptData.script,
      niche: detectedNiche,
      duration_seconds: duration_minutes * 60,
      status: "script",
      scene_blueprint_json: scriptData.scene_blueprint || [],
      intelligence_json: {
        source: "video-orchestrator",
        original_video: video_id || video_title,
        hook_used: bestHook,
        hooks_generated: hooks.length,
        rag_sources: ragContext ? "brave+db" : "db_only",
      },
      user_id: user_id || "00000000-0000-0000-0000-000000000000",
    }).select("id").single();

    if (!project) throw new Error("Failed to create video project");

    // ── Phase 4: Scene Breakdown (Gemini Flash-Lite for speed) ──
    const scenes = await callSceneBreakdown(aiH, sb, scriptData.script, detectedNiche, project.id, language);

    // Queue prompt generation
    if (scenes.length > 0) {
      await sb.from("task_queue").insert({
        task_type: "generate_prompts",
        payload: { project_id: project.id },
        status: "pending",
        scheduled_at: new Date().toISOString(),
      });
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "video-orchestrator",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 3, // RAG + HookGen + LongForm + SceneBreak
      metadata: {
        project_id: project.id,
        hooks_generated: hooks.length,
        scenes_created: scenes.length,
        hook_selected: bestHook.hook_text,
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      project_id: project.id,
      title: scriptData.title,
      hooks_generated: hooks.length,
      best_hook: bestHook,
      scenes_created: scenes.length,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("video-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Build RAG Context (Brave Search + research_cache) ──────
async function buildRag(sb: any, braveKey: string | undefined, query: string, niche: string): Promise<string> {
  const cacheKey = `orch_${query.slice(0, 80)}_${niche}`;

  // Check cache first (24h TTL)
  const { data: cached } = await sb.from("research_cache")
    .select("result_json").eq("cache_key", cacheKey)
    .gte("expires_at", new Date().toISOString()).maybeSingle();
  if (cached?.result_json) return JSON.stringify(cached.result_json).slice(0, 3000);

  if (!braveKey) return "";

  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { "X-Subscription-Token": braveKey },
    });
    const j = await res.json();
    const results = (j?.web?.results || j?.organic || []).slice(0, 5).map((r: any) => ({
      title: r.title, snippet: r.description || r.snippet || "",
    }));

    await sb.from("research_cache").insert({
      cache_key: cacheKey, query, source: "brave",
      result_json: results, expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
    }).catch(() => {});

    return JSON.stringify(results).slice(0, 3000);
  } catch (e) {
    console.error("Brave Search error:", e);
    return "";
  }
}

// ─── Phase 2: HookGen (10 hooks) ───────────────────────────
async function callHookGen(aiH: any, ragContext: string, dbContext: any, niche: string, title: string, lang: string): Promise<any[]> {
  const existingHooks = (dbContext.hooks || []).map((h: any) => `- [${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score})`).join("\n");
  const triggers = (dbContext.psychology || []).map((p: any) => `- ${p.trigger_type}: ${p.description}`).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are an elite YouTube hook generator. Create 10 viral hooks in ${lang === "pt" ? "Portuguese (BR)" : lang}. Each hook must grab attention in the first 3 seconds. Use psychological triggers.` },
          { role: "user", content: `Generate 10 hooks for niche "${niche}" inspired by "${title}".\n\nWEB CONTEXT:\n${ragContext}\n\nEXISTING HIGH-PERFORMING HOOKS:\n${existingHooks}\n\nPSYCHOLOGY TRIGGERS:\n${triggers}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_hooks",
            description: "Return 10 generated hooks",
            parameters: {
              type: "object",
              properties: {
                hooks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      hook_text: { type: "string" },
                      hook_type: { type: "string", enum: ["curiosity", "shock", "authority", "urgency", "contrast", "story", "question", "statistic"] },
                      retention_score: { type: "number", description: "Predicted retention 1-10" },
                      predicted_ctr: { type: "number", description: "Predicted CTR 0-1" },
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
      const data = await aiRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) return JSON.parse(tc.function.arguments).hooks || [];
    } else { await aiRes.text(); }
  } catch (e) { console.error("callHookGen error:", e); }
  return [];
}

// ─── Phase 3: LongForm Script ──────────────────────────────
async function callLongForm(
  aiH: any, ragContext: string, dbContext: any, bestHook: any,
  title: string, niche: string, durationMin: number, lang: string,
): Promise<{ title: string; script: string; scene_blueprint: any[] }> {
  const knowledgeCtx = (dbContext.knowledge || []).map((k: any) => `- ${k.title}: ${k.content.slice(0, 150)}`).join("\n");
  const patternCtx = (dbContext.patterns || []).slice(0, 3).map((p: any) => {
    const pj = p.pattern_json || {};
    return `- ${p.pattern_name}: ${pj.storytelling_structure || ""} / ${pj.pacing || ""}`;
  }).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: `You are an elite YouTube scriptwriter. Generate a ${durationMin}-minute faceless video script in ${lang === "pt" ? "Portuguese (BR)" : lang}. Requirements:\n- Start with the provided hook\n- High retention with nested curiosity loops\n- Mini-cliffhangers every 8-15 seconds\n- Natural, anti-AI-slop language\n- Clear segment markers [INTRO], [DEVELOPMENT], [CLIMAX], [CONCLUSION]\n- Also provide a scene_blueprint array for visual production` },
          { role: "user", content: `Create a script inspired by "${title}" in "${niche}".\nDuration: ~${durationMin} min\n\nHOOK TO USE: [${bestHook.hook_type}] "${bestHook.hook_text}"\n\nWEB CONTEXT:\n${ragContext}\n\nVIRAL PATTERNS:\n${patternCtx}\n\nSCRIPT KNOWLEDGE:\n${knowledgeCtx}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_script",
            description: "Save the complete script with scene blueprint",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Viral video title" },
                script: { type: "string", description: "Full script with segment markers" },
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
                      character_consistency_block: { type: "string" },
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
      const data = await aiRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) return JSON.parse(tc.function.arguments);
    } else { await aiRes.text(); }
  } catch (e) { console.error("callLongForm error:", e); }

  return { title: `Script: ${title}`, script: "", scene_blueprint: [] };
}

// ─── Phase 4: Scene Breakdown & Save ────────────────────────
async function callSceneBreakdown(aiH: any, sb: any, script: string, niche: string, projectId: string, lang: string): Promise<any[]> {
  if (!script) return [];

  // Get scene prompt knowledge for visual reference
  const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
    .select("prompt_template,category").order("viral_score", { ascending: false }).limit(5);
  const sceneRef = (sceneKnowledge || []).map((s: any) => `[${s.category}] ${s.prompt_template.slice(0, 100)}`).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Break this script into ~8-second visual scenes for a faceless YouTube video. Each scene needs narration (TTS text), visual AI prompt, camera movement, and lighting. Use cinematic quality.\n\nVISUAL REFERENCE:\n${sceneRef}` },
          { role: "user", content: `Break into 8-20 scenes:\n\n${script.slice(0, 5000)}` },
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
                      eight_second_clip_intent: { type: "string" },
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
      const data = await aiRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const parsed = JSON.parse(tc.function.arguments);
        const scenes = parsed.scenes || [];

        if (scenes.length > 0) {
          await sb.from("scenes").insert(
            scenes.map((s: any, i: number) => ({
              project_id: projectId, sequence_order: i + 1,
              tts_text: s.tts_text, veo3_prompt: s.visual_prompt,
              duration_sec: s.duration_sec || 8, camera_movement: s.camera_movement,
              lighting: s.lighting, emotional_intent: s.emotional_intent, status: "pending",
            }))
          );
          await sb.from("video_projects").update({ status: "scenes" }).eq("id", projectId);
        }

        console.log(`Orchestrator: saved ${scenes.length} scenes for project ${projectId}`);
        return scenes;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("callSceneBreakdown error:", e); }

  // Fallback: naive paragraph split
  const paras = script.split("\n\n").filter(Boolean).slice(0, 20);
  if (paras.length > 0) {
    await sb.from("scenes").insert(
      paras.map((p, i) => ({
        project_id: projectId, sequence_order: i + 1,
        tts_text: p.slice(0, 300), veo3_prompt: `Cinematic scene for: ${p.slice(0, 100)}`,
        duration_sec: 8, camera_movement: "slow push", lighting: "dramatic",
        emotional_intent: "engagement", status: "pending",
      }))
    );
    await sb.from("video_projects").update({ status: "scenes" }).eq("id", projectId);
    return paras.map((p, i) => ({ tts_text: p.slice(0, 300), duration_sec: 8 }));
  }

  return [];
}
