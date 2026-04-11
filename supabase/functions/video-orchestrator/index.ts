// ⚠️ DEPRECATED: This function duplicates generate-script + refine-script pipeline.
// Kept as thin redirect to avoid breaking existing client calls.
// New code should call generate-script directly.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ensemble model mapping — OPTIMIZED: all Gemini (no GPT-5 gateway costs)
const MODELS = {
  hookGen: "gemini-2.5-pro",              // Phase 0: Hook + retention loops (was openai/gpt-5)
  draftScript: "gemini-2.5-flash",        // Phase 1: Fast draft
  refineScript: "gemini-2.5-pro",         // Phase 2: Creative refinement + scene_blueprint
  factCheck: "gemini-2.5-flash",          // Phase 3: Fact-check (was openai/gpt-5-mini)
  sceneBreak: "gemini-2.5-flash-lite",    // Phase 4: Scene breakdown
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await _authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      video_id, video_title, video_tags, channel_id, niche,
      language = "pt", duration_minutes = 20, user_id,
    } = body;

    if (!video_title) throw new Error("video_title is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiH = { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" };
    const langLabel = language === "pt" ? "Portuguese (BR)" : language;
    const detectedNiche = niche || "general";
    const query = `${video_title} ${(video_tags || []).join(" ")}`.trim();

    // Credit check (ensemble costs 8 credits: 4 LLM phases + RAG)
    if (user_id) {
      const { data: hasCredits } = await sb.rpc("consume_credits", { _user_id: user_id, _amount: 8 });
      if (!hasCredits) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes (necessário: 8)" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const pipelineLog: any = { steps: [], meta: { name: "ensemble_rag_hook_longform_scene", version: "1.0", lang: language } };

    // ════════════════════════════════════════════════════════════
    // STEP 1: RAG_search (Brave + research_cache + DB context)
    // ════════════════════════════════════════════════════════════
    const step1Start = Date.now();
    const ragContext = await buildRag(sb, BRAVE_API_KEY, query, detectedNiche);

    // Parallel DB context fetch
    const [patternsRes, hooksRes, psychRes, knowledgeRes, charsRes, autoflowRes] = await Promise.all([
      sb.from("viral_patterns").select("pattern_name,pattern_json").eq("niche", detectedNiche).order("created_at", { ascending: false }).limit(5),
      sb.from("hook_library").select("hook_text,hook_type,retention_score").eq("niche", detectedNiche).order("retention_score", { ascending: false }).limit(10),
      sb.from("audience_psychology_patterns").select("trigger_type,description,example_hooks").order("retention_score", { ascending: false }).limit(5),
      sb.from("script_knowledge").select("title,content").order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("characters").select("name,visual_prompt,visual_attributes,reference_image_url,global_prompt_append").limit(20),
      sb.from("scene_prompt_knowledge").select("prompt_template,category,tags").eq("category", "autoflow-format").limit(3),
    ]);

    const dbCtx = {
      patterns: patternsRes.data || [],
      hooks: hooksRes.data || [],
      psychology: psychRes.data || [],
      knowledge: knowledgeRes.data || [],
      characters: charsRes.data || [],
      autoflowRules: autoflowRes.data || [],
    };

    pipelineLog.steps.push({ name: "RAG_search", engine: "brave", duration_ms: Date.now() - step1Start, results: ragContext ? "cached_or_fetched" : "empty" });

    // ═══ USER DNA INJECTION ═══
    let userDnaContext = '';
    if (user_id) {
      const { data: userMemory } = await sb
        .from('user_content_memory')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

      if (userMemory) {
        const mem = userMemory as any;
        userDnaContext = `
### 🧬 DNA DO CANAL DO USUÁRIO (ADAPTE O ROTEIRO):
- Duração que funciona: ${mem.preferred_duration_minutes || duration_minutes}min
- Estilo com mais retenção: ${mem.best_performing_style || 'geral'}
- Hook favorito do nicho: ${mem.preferred_hook_type || 'qualquer'}
- Retenção média atual: ${mem.avg_retention_pct || 'não calculado'}%
- Padrões identificados: ${JSON.stringify(mem.ai_identified_patterns || []).slice(0, 400)}
- Tópicos recentes (evitar repetir): ${(mem.last_topics_used || []).slice(0, 8).join(', ')}
INSTRUÇÃO CRÍTICA: Adapte CADA FASE do roteiro com base neste DNA. Personalize, não seja genérico.
`;
      }
    }

    // ════════════════════════════════════════════════════════════
    // STEP 2: HookGen (GPT-5 — Phase 0)
    // ════════════════════════════════════════════════════════════
    const step2Start = Date.now();
    const hooks = await callHookGen(aiH, ragContext + userDnaContext, dbCtx, detectedNiche, video_title, langLabel);

    const bestHook = hooks.length > 0
      ? hooks.sort((a: any, b: any) => (b.retention_score || 0) - (a.retention_score || 0))[0]
      : { hook_text: `Você não vai acreditar no que descobrimos sobre ${video_title}`, hook_type: "curiosity", retention_score: 7 };

    // Save hooks
    if (hooks.length > 0) {
      await sb.from("hook_library").insert(
        hooks.map((h: any) => ({
          hook_text: h.hook_text, hook_type: h.hook_type || "curiosity",
          niche: detectedNiche, retention_score: h.retention_score || 7,
        }))
      ).catch(() => {});
    }

    pipelineLog.steps.push({ name: "HookGen", engine: MODELS.hookGen, duration_ms: Date.now() - step2Start, hooks_count: hooks.length, best: bestHook.hook_text?.slice(0, 80) });

    // ════════════════════════════════════════════════════════════
    // STEP 3: LongForm — Phase 1 (Draft) + Phase 2 (Refine) + Phase 3 (Fact-check)
    // ════════════════════════════════════════════════════════════
    const step3Start = Date.now();

    // Phase 1: Fast draft (Gemini Flash)
    const draft = await callDraftScript(aiH, ragContext, dbCtx, bestHook, video_title, detectedNiche, duration_minutes, langLabel);
    pipelineLog.steps.push({ name: "LongForm_Draft", engine: MODELS.draftScript, duration_ms: Date.now() - step3Start, length: draft.length });

    // Phase 2: Creative refinement + scene_blueprint + characters (Gemini Pro)
    const step3bStart = Date.now();
    const refined = await callRefineScript(aiH, draft, dbCtx, bestHook, detectedNiche, duration_minutes, langLabel);
    pipelineLog.steps.push({ name: "LongForm_Refine", engine: MODELS.refineScript, duration_ms: Date.now() - step3bStart, has_blueprint: refined.scene_blueprint.length > 0, characters: refined.characters.length });

    // Phase 3: Fact-check (GPT-5-mini)
    const step3cStart = Date.now();
    const factChecked = await callFactCheck(aiH, refined.script, detectedNiche, langLabel);
    pipelineLog.steps.push({ name: "FactCheck", engine: MODELS.factCheck, duration_ms: Date.now() - step3cStart, issues: factChecked.issues_found });

    const finalScript = factChecked.corrected_script || refined.script;

    // ════════════════════════════════════════════════════════════
    // STEP 4: PostProcess — Save project, characters, scenes
    // ════════════════════════════════════════════════════════════
    const step4Start = Date.now();

    // Create video project
    const { data: project } = await sb.from("video_projects").insert({
      title: refined.title || `Ensemble: ${video_title.slice(0, 50)}`,
      script: finalScript,
      niche: detectedNiche,
      duration_seconds: duration_minutes * 60,
      status: "script",
      scene_blueprint_json: refined.scene_blueprint,
      intelligence_json: {
        source: "video-orchestrator-ensemble",
        pipeline: pipelineLog.meta,
        original_video: video_id || video_title,
        hook_used: bestHook,
        hooks_generated: hooks.length,
        fact_check: { issues: factChecked.issues_found, corrections: factChecked.corrections },
        rag_sources: ragContext ? "brave+db" : "db_only",
      },
      user_id: user_id || "00000000-0000-0000-0000-000000000000",
    }).select("id").single();

    if (!project) throw new Error("Failed to create video project");

    // Save characters with character_consistency_block
    if (refined.characters.length > 0) {
      await sb.from("characters").insert(
        refined.characters.map((c: any) => ({
          project_id: project.id,
          name: c.name,
          visual_prompt: c.visual_prompt || c.character_consistency_block || "",
          visual_attributes: c.visual_attributes || {},
          reference_image_url: c.reference_image_url || null,
          global_prompt_append: c.global_prompt_append || "",
        }))
      ).catch((e: any) => console.error("Characters insert error:", e));
    }

    // ════════════════════════════════════════════════════════════
    // STEP 5: SceneBreak — Break into ~40s scenes (COST OPTIMIZED from ~8s)
    // ════════════════════════════════════════════════════════════
    const step5Start = Date.now();
    const scenes = await callSceneBreakdown(aiH, sb, finalScript, detectedNiche, project.id, langLabel, refined.characters, dbCtx.autoflowRules);
    pipelineLog.steps.push({ name: "SceneBreak", engine: MODELS.sceneBreak, duration_ms: Date.now() - step5Start, scenes_count: scenes.length });

    // Queue AutoFlow prompt generation
    if (scenes.length > 0) {
      await sb.from("task_queue").insert({
        task_type: "generate_prompts",
        payload: { project_id: project.id },
        status: "pending",
        scheduled_at: new Date().toISOString(),
      });
    }

    pipelineLog.steps.push({ name: "PostProcess", duration_ms: Date.now() - step4Start, project_id: project.id });

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "video-orchestrator",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: 5,
      metadata: pipelineLog,
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      project_id: project.id,
      title: refined.title,
      hooks_generated: hooks.length,
      best_hook: bestHook,
      characters: refined.characters.length,
      scenes_created: scenes.length,
      fact_check: { issues: factChecked.issues_found },
      pipeline: pipelineLog.steps.map((s: any) => ({ name: s.name, engine: s.engine, ms: s.duration_ms })),
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

// ─── RAG: Brave Search + research_cache ─────────────────────
async function buildRag(sb: any, braveKey: string | undefined, query: string, niche: string): Promise<string> {
  const cacheKey = `orch_${query.slice(0, 80)}_${niche}`;
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
      result_json: results, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    }).catch(() => {});
    return JSON.stringify(results).slice(0, 3000);
  } catch (e) {
    console.error("Brave Search error:", e);
    return "";
  }
}

// ─── Phase 0: HookGen (GPT-5) ──────────────────────────────
async function callHookGen(aiH: any, ragContext: string, dbCtx: any, niche: string, title: string, lang: string): Promise<any[]> {
  const existingHooks = (dbCtx.hooks || []).map((h: any) => `- [${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score})`).join("\n");
  const triggers = (dbCtx.psychology || []).map((p: any) => `- ${p.trigger_type}: ${p.description}`).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: MODELS.hookGen,
        messages: [
          { role: "system", content: `You are an elite YouTube hook generator and retention strategist. Create 10 viral hooks in ${lang}. Each must:\n- Grab attention in first 3 seconds\n- Use psychological triggers (curiosity gap, shock, authority, FOMO)\n- Include retention loop hints (what keeps viewer watching)\n- Predict CTR based on pattern analysis` },
          { role: "user", content: `Generate 10 hooks for niche "${niche}" inspired by "${title}".\n\nWEB CONTEXT:\n${ragContext}\n\nTOP HOOKS:\n${existingHooks}\n\nTRIGGERS:\n${triggers}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_hooks",
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
                      retention_score: { type: "number" },
                      predicted_ctr: { type: "number" },
                      retention_loop_hint: { type: "string" },
                    },
                    required: ["hook_text", "hook_type", "retention_score", "predicted_ctr"],
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
  } catch (e) { console.error("HookGen error:", e); }
  return [];
}

// ─── Phase 1: Draft Script (Gemini Flash — fast) ────────────
async function callDraftScript(aiH: any, ragContext: string, dbCtx: any, hook: any, title: string, niche: string, durationMin: number, lang: string): Promise<string> {
  const knowledgeCtx = (dbCtx.knowledge || []).map((k: any) => `- ${k.title}: ${k.content.slice(0, 120)}`).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: MODELS.draftScript,
        messages: [
          { role: "system", content: `Generate a ${durationMin}-minute YouTube script draft in ${lang}. Start with the hook. Include segment markers [INTRO], [DEV1], [DEV2], [CLIMAX], [CONCLUSION]. Write naturally, not AI-sounding. Include mini-cliffhangers every 10-15 seconds.` },
          { role: "user", content: `Draft script for "${title}" in "${niche}".\nDuration: ~${durationMin} min\nHOOK: "${hook.hook_text}"\n\nCONTEXT:\n${ragContext}\n\nKNOWLEDGE:\n${knowledgeCtx}` },
        ],
      }),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      return data.choices?.[0]?.message?.content || "";
    } else { await aiRes.text(); }
  } catch (e) { console.error("DraftScript error:", e); }
  return "";
}

// ─── Phase 2: Refine Script + Characters (Gemini Pro) ───────
async function callRefineScript(
  aiH: any, draft: string, dbCtx: any, hook: any,
  niche: string, durationMin: number, lang: string,
): Promise<{ title: string; script: string; scene_blueprint: any[]; characters: any[] }> {
  const patternCtx = (dbCtx.patterns || []).slice(0, 3).map((p: any) => {
    const pj = p.pattern_json || {};
    return `- ${p.pattern_name}: ${pj.storytelling_structure || ""} / Retention: ${(pj.retention_techniques || []).join(", ")}`;
  }).join("\n");

  // Existing characters for consistency
  const existingChars = (dbCtx.characters || []).map((c: any) => `- ${c.name}: ${c.visual_prompt?.slice(0, 100)}`).join("\n");

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: MODELS.refineScript,
        messages: [
          { role: "system", content: `You are a senior scriptwriter and creative director. Refine this draft into a polished ${durationMin}-minute faceless YouTube script in ${lang}. Requirements:\n- Enhance emotional impact and pacing\n- Add nested curiosity loops\n- Ensure anti-AI-slop natural language\n- Generate a scene_blueprint array for visual production\n- Extract/create characters with character_consistency_block (physical appearance, clothing, accessories for visual AI consistency)\n- Score the quality 1-10\n\nExisting characters for reference:\n${existingChars || "none"}` },
          { role: "user", content: `Refine this draft:\n\n${draft.slice(0, 6000)}\n\nNiche: ${niche}\nVIRAL PATTERNS:\n${patternCtx}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_refined_script",
            description: "Save the refined script with characters and blueprint",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                script: { type: "string" },
                quality_score: { type: "number" },
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
                characters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      visual_prompt: { type: "string", description: "Full character_consistency_block: physical appearance, clothing, accessories" },
                      visual_attributes: { type: "object", description: "Structured attributes: hair, eyes, skin, build, clothing" },
                      global_prompt_append: { type: "string", description: "Text to append to every scene prompt featuring this character" },
                    },
                    required: ["name", "visual_prompt"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "script", "scene_blueprint", "characters"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_refined_script" } },
      }),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const parsed = JSON.parse(tc.function.arguments);
        return {
          title: parsed.title || "",
          script: parsed.script || draft,
          scene_blueprint: parsed.scene_blueprint || [],
          characters: parsed.characters || [],
        };
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("RefineScript error:", e); }
  return { title: "", script: draft, scene_blueprint: [], characters: [] };
}

// ─── Phase 3: Fact-Check (GPT-5-mini) ──────────────────────
async function callFactCheck(aiH: any, script: string, niche: string, lang: string): Promise<{ corrected_script: string | null; issues_found: number; corrections: string[] }> {
  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: MODELS.factCheck,
        messages: [
          { role: "system", content: `You are a fact-checker for YouTube scripts in ${lang}. Check for:\n- Factual errors (dates, names, statistics)\n- Logical inconsistencies\n- Misleading claims\n- Grammar/spelling issues\nReturn corrections. Only modify if real errors found. Preserve the author's style.` },
          { role: "user", content: `Fact-check this ${niche} script:\n\n${script.slice(0, 5000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "fact_check_result",
            parameters: {
              type: "object",
              properties: {
                issues_found: { type: "integer" },
                corrections: { type: "array", items: { type: "string" } },
                corrected_script: { type: "string", description: "Full corrected script, or null if no corrections needed" },
                confidence: { type: "number", description: "Confidence in corrections 0-1" },
              },
              required: ["issues_found", "corrections"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fact_check_result" } },
      }),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      const tc = data.choices?.[0]?.message?.tool_calls?.[0];
      if (tc) {
        const parsed = JSON.parse(tc.function.arguments);
        return {
          corrected_script: parsed.corrected_script || null,
          issues_found: parsed.issues_found || 0,
          corrections: parsed.corrections || [],
        };
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("FactCheck error:", e); }
  return { corrected_script: null, issues_found: 0, corrections: [] };
}

// ─── Phase 4: Scene Breakdown with AutoFlow format ──────────
async function callSceneBreakdown(
  aiH: any, sb: any, script: string, niche: string,
  projectId: string, lang: string, characters: any[], autoflowRules: any[],
): Promise<any[]> {
  if (!script) return [];

  const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
    .select("prompt_template,category").order("viral_score", { ascending: false }).limit(5);
  const sceneRef = (sceneKnowledge || []).map((s: any) => `[${s.category}] ${s.prompt_template.slice(0, 100)}`).join("\n");

  // Build character consistency injection
  const charBlock = characters.map((c: any) => `CHARACTER "${c.name}": ${c.visual_prompt || c.character_consistency_block || ""}${c.reference_image_url ? ` [REF: ${c.reference_image_url}]` : ""}`).join("\n");

  // AutoFlow format rules
  const autoflowFormat = (autoflowRules || []).map((r: any) => r.prompt_template).join("\n") ||
    "Output format per scene: [V#-S#] {image_prompt} ||| [V#-S#] {video_prompt} — one line per scene, technical camera vocabulary (lens, lighting, angle), no headers.";

  try {
    const aiRes = await fetch(AI_URL, {
      method: "POST", headers: aiH,
      body: JSON.stringify({
        model: MODELS.sceneBreak,
        messages: [
          { role: "system", content: `Break this script into ~40-second visual scenes for a faceless YouTube video. Each scene groups multiple Veo3 clips (~8s each) under one visual theme. Each scene needs:\n- TTS narration text (~40s worth)\n- Visual AI prompt (cinematic, detailed)\n- Camera movement and lens\n- Lighting\n- Emotional intent\n- Scene duration (30-50s)\n\nCHARACTER CONSISTENCY (inject into every scene featuring them):\n${charBlock || "No named characters"}\n\nAUTOFLOW FORMAT RULES:\n${autoflowFormat}\n\nVISUAL REFERENCE:\n${sceneRef}` },
          { role: "user", content: `Break into scenes (each ~40s, grouping 4-5 Veo3 clips per scene):\n\n${script.slice(0, 6000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_scenes",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tts_text: { type: "string" },
                      visual_prompt: { type: "string", description: "Detailed visual prompt with character consistency merged" },
                      duration_sec: { type: "integer" },
                      camera_movement: { type: "string" },
                      lighting: { type: "string" },
                      emotional_intent: { type: "string" },
                      eight_second_clip_intent: { type: "string" },
                      character_ref: { type: "string", description: "Character name if present in scene" },
                      autoflow_line: { type: "string", description: "AutoFlow formatted line: [V#-S#] prompt" },
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
              tts_text: s.tts_text,
              veo3_prompt: s.visual_prompt,
              duration_sec: Math.min(s.duration_sec || 8, 8), // Veo3 max 8s
              camera_movement: s.camera_movement,
              lighting: s.lighting,
              emotional_intent: s.emotional_intent,
              character_ref: s.character_ref || null,
              status: "pending",
            }))
          );
          await sb.from("video_projects").update({ status: "scenes" }).eq("id", projectId);
        }

        console.log(`Ensemble: saved ${scenes.length} scenes for project ${projectId}`);
        return scenes;
      }
    } else { await aiRes.text(); }
  } catch (e) { console.error("SceneBreak error:", e); }

  // Fallback: naive split
  const paras = script.split("\n\n").filter(Boolean).slice(0, 30);
  if (paras.length > 0) {
    await sb.from("scenes").insert(
      paras.map((p, i) => ({
        project_id: projectId, sequence_order: i + 1,
        tts_text: p.slice(0, 300), veo3_prompt: `Cinematic: ${p.slice(0, 100)}`,
        duration_sec: 8, camera_movement: "slow push", lighting: "dramatic",
        emotional_intent: "engagement", status: "pending",
      }))
    );
    await sb.from("video_projects").update({ status: "scenes" }).eq("id", projectId);
    return paras.map((p) => ({ tts_text: p.slice(0, 300), duration_sec: 8 }));
  }
  return [];
}
