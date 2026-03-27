import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResp(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado.");

    const body = await req.json();

    // ═══ MODE: Poll for job result ═══
    if (body.action === "poll" && body.job_id) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: job, error } = await sb.from("processing_jobs")
        .select("status, progress, current_step, result_data, error_message")
        .eq("id", body.job_id)
        .single();
      
      if (error || !job) return errResp("Job não encontrado", 404);
      return jsonResp(job);
    }

    // ═══ MODE: Start async job ═══
    const { audioUrl, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = body;
    if (!audioUrl) throw new Error("audioUrl obrigatório.");

    // Get user ID from auth header
    const authHeader = req.headers.get("Authorization");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    let userId = "anonymous";
    if (authHeader) {
      const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) userId = user.id;
    }

    // Create job record
    const { data: job, error: jobError } = await sb.from("processing_jobs").insert({
      user_id: userId,
      job_type: "transcribe_and_generate_scenes",
      status: "processing",
      progress: 0,
      current_step: "Iniciando pipeline...",
      input_data: { audioUrl, audioMimeType, script: (script || "").slice(0, 30000), videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript },
    }).select().single();

    if (jobError || !job) return errResp("Falha ao criar job: " + (jobError?.message || ""), 500);

    // Start background processing (non-blocking)
    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processJob(job.id, sb, LOVABLE_API_KEY).catch(async (err) => {
        console.error(`Job ${job.id} failed:`, err);
        await sb.from("processing_jobs").update({
          status: "failed",
          error_message: err.message?.slice(0, 500) || "Erro desconhecido",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
      })
    );

    // Return immediately with job ID
    return jsonResp({ job_id: job.id, status: "processing" });

  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(e.message || "Erro desconhecido", 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// BACKGROUND PROCESSING
// ═══════════════════════════════════════════════════════════════════

async function processJob(jobId: string, sb: any, lovableApiKey: string) {
  const updateJob = async (fields: any) => {
    await sb.from("processing_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);
  };

  try {
    const { data: job } = await sb.from("processing_jobs").select("input_data").eq("id", jobId).single();
    if (!job) throw new Error("Job not found");

    const { audioUrl, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = job.input_data as any;
    const cleanScript = (script || "").slice(0, 30000);
    const resolvedMime = audioMimeType || "audio/mp3";

    console.log(`Job ${jobId}: starting pipeline`);

    // ═══ PHASE 1: Transcribe ═══
    await updateJob({ progress: 10, current_step: "Transcrevendo áudio..." });

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    async function retryFetch(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
      for (let i = 0; i <= maxRetries; i++) {
        const resp = await fetch(url, opts);
        if (resp.ok || (resp.status !== 502 && resp.status !== 503 && resp.status !== 500)) return resp;
        const t = await resp.text();
        console.warn(`Retry ${i+1}/${maxRetries}: ${resp.status} ${t.slice(0,200)}`);
        if (i < maxRetries) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        if (i === maxRetries) return new Response(t, { status: resp.status });
      }
      throw new Error("Unreachable");
    }

    let transcribeData: any = null;

    // Strategy A: Google AI with audio URL (no download needed!)
    if (GOOGLE_AI_KEY && audioUrl) {
      console.log("Using Google AI with audio URL...");
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
        const geminiResp = await retryFetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: `You are a professional audio transcriber. Transcribe the audio precisely in its original language (${language || 'detect automatically'}).

OUTPUT FORMAT (strict JSON array):
[{"start": 0.0, "end": 3.5, "text": "First sentence here."}, ...]

RULES:
- Transcribe EVERY spoken word
- Estimate timestamps accurately per sentence
- Sequential, non-overlapping
- Return ONLY the JSON array` },
              { fileData: { mimeType: resolvedMime, fileUri: audioUrl } }
            ]}],
            generationConfig: { temperature: 0.1 },
          }),
        });
        if (geminiResp.ok) {
          const gData = await geminiResp.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          transcribeData = { choices: [{ message: { content: text } }] };
          console.log("Google AI transcription OK, length:", text.length);
        } else {
          console.warn("Google AI URL failed:", geminiResp.status);
        }
      } catch (e: any) {
        console.warn("Google AI error:", e.message);
      }
    }

    // Strategy B: Lovable Gateway fallback (script-based timestamps)
    if (!transcribeData) {
      console.log("Falling back to script-based timestamp estimation...");
      if (!cleanScript.trim()) throw new Error("Transcrição falhou e nenhum roteiro disponível.");

      const resp = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `Convert narration script to timestamps at ~150 wpm in ${language || 'Portuguese'}. Return JSON array: [{"start":0.0,"end":3.5,"text":"..."}]` },
            { role: "user", content: cleanScript },
          ],
        }),
      });
      if (!resp.ok) {
        const status = resp.status;
        if (status === 429) throw new Error("Rate limit. Tente novamente.");
        if (status === 402) throw new Error("Créditos insuficientes.");
        throw new Error(`Erro na transcrição: ${status}`);
      }
      transcribeData = await resp.json();
    }

    await updateJob({ progress: 30, current_step: "Analisando transcrição..." });

    // Parse transcript
    let transcriptText = transcribeData.choices?.[0]?.message?.content || "";
    let transcriptBlocks = repairAndParseJsonArray(transcriptText);

    if (!transcriptBlocks.length && transcriptText.trim()) {
      const sentences = transcriptText.replace(/```[\s\S]*?```/g, '').replace(/[\[\]{}]/g, '').trim()
        .split(/[.!?\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 5);
      if (sentences.length > 0) {
        const estDuration = Math.max(60, sentences.length * 4);
        const perSentence = estDuration / sentences.length;
        transcriptBlocks = sentences.map((s: string, i: number) => ({
          start: +(i * perSentence).toFixed(1),
          end: +((i + 1) * perSentence).toFixed(1),
          text: s,
        }));
      }
    }

    if (!transcriptBlocks.length) throw new Error("Áudio sem fala detectável.");

    const audioDuration = transcriptBlocks[transcriptBlocks.length - 1].end;
    const fullText = transcriptBlocks.map((b: any) => b.text).join(" ");
    console.log(`Transcribed: ${transcriptBlocks.length} blocks, ${audioDuration.toFixed(1)}s`);

    // ═══ PHASE 2: Knowledge + Context ═══
    await updateJob({ progress: 35, current_step: "Preparando contexto visual..." });

    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(5);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.prompt_template.slice(0, 150)}`
    ).join("\n").slice(0, 1200);

    // Build style context
    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney premium. ARRI ALEXA 65, Cooke Anamorphic. ACES color, Kodak Vision3. Shallow DOF f/1.4-2.8.',
      '2d': 'Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector art, parallax depth, smooth 24fps.',
      '3d': 'Pixar/DreamWorks 3D. Subsurface scattering, PBR materials, global illumination.',
      'anime': 'Ufotable/MAPPA. Sakuga poses, Shinkai backgrounds, cel-shading, rim lighting.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light.',
      'dark': 'Dark noir. Crushed blacks, neon accents. Blade Runner 2049 meets Se7en.',
      'comic': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
      'hq': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
      'wojak': 'Wojak/meme internet art. Simple drawn faces, exaggerated expressions, flat colors.',
      'stickmen': 'Stick figure animation. Minimalist black line drawings, simple backgrounds.',
      'whiteboard': 'Whiteboard animation. Hand-drawn sketches on white. Black ink, educational.',
      'animal_chase': 'HYPER-REALISTIC WILDLIFE. National Geographic meets Hollywood thriller. ARRI ALEXA Mini LF, 8K.',
      'fotorrealista_documentario': 'Documentary photography, natural soft lighting, Canon 5D aesthetic.',
      'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes.',
      'aquarela': 'Watercolor painting. Soft translucent washes, visible paper grain.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];
    const extraStyle = customStyleNotes ? `\nUSER STYLE: ${customStyleNotes}` : '';
    const refImgContext = referenceImageUrls?.length ? `\nREFERENCE IMAGES: ${referenceImageUrls.length} uploaded. Match that art style.` : '';

    const characterBlock = characters?.length > 0
      ? `\n🎭 CHARACTERS:\n${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {}; const cl = c.clothing || {}; const ff = c.facial_features || {};
          return `━━━ "${c.name}" ━━━\nRole: ${c.role || 'character'} | Gender: ${c.gender || '?'} | Age: ${c.age || '?'}\nBUILD: ${a.body_type || 'average'}, ${a.height || 'medium height'}\nSKIN: ${a.skin_color || 'medium'}\nHAIR: ${a.hair_color || 'dark'} ${a.hair_style || 'short'}\nEYES: ${ff.eye_color || a.eye_color || 'dark'}, ${ff.eye_shape || 'normal'}\nFACE: ${ff.face_shape || 'oval'}, ${ff.eyebrows || 'normal'} brows, ${ff.nose || 'straight'} nose\nFACIAL HAIR: ${ff.facial_hair || ff.beard || 'none'}\nCLOTHING: ${cl.shirt || cl.top || 'casual top'}, ${cl.pants || cl.bottom || 'jeans'}, ${cl.shoes || 'standard'}\nACCESSORIES: ${cl.accessories || 'none'}`;
        }).join('\n\n')}\n`
      : '';

    // ═══ PHASE 3: Generate scenes in chunks ═══
    await updateJob({ progress: 40, current_step: "Gerando cenas visuais..." });

    const minimumScenes = Math.ceil(audioDuration / 8);
    const CHUNK_SECONDS = audioDuration > 600 ? 90 : 120;
    const TARGET_SCENE_SECONDS = 8;
    const MAX_SCENES_PER_CHUNK = Math.ceil(CHUNK_SECONDS / TARGET_SCENE_SECONDS) + 2;

    const toolDef = {
      type: "function" as const,
      function: {
        name: "set_synced_scenes",
        description: "Create visual scenes synchronized with audio narration timestamps",
        parameters: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sceneIndex: { type: "number" },
                  sceneDurationSeconds: { type: "number" },
                  startTime: { type: "number" },
                  endTime: { type: "number" },
                  narrativeText: { type: "string" },
                  narrativeSummary: { type: "string" },
                  visualPrompt: { type: "string", description: "80-150 word cinematic prompt with FULL character descriptions" },
                  negativePrompt: { type: "string" },
                  cameraAngle: { type: "string" },
                  lensSpec: { type: "string" },
                  lightingSetup: { type: "string" },
                  colorGrading: { type: "string" },
                  audioDirection: { type: "string" },
                  mood: { type: "string" },
                  emotionalBeat: { type: "string" },
                  charactersInScene: { type: "array", items: { type: "object", properties: { name: { type: "string" }, visualDescription: { type: "string" }, action: { type: "string" }, expression: { type: "string" } }, required: ["name", "visualDescription"] } },
                  environmentDetails: { type: "string" },
                  transitionNote: { type: "string" },
                },
                required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "narrativeText", "visualPrompt", "cameraAngle", "mood", "charactersInScene"],
                additionalProperties: false,
              },
            },
          },
          required: ["scenes"],
          additionalProperties: false,
        },
      },
    };

    const systemPrompt = `You are a VISUAL DIRECTOR creating video scenes from narrated audio.
MANDATORY ART STYLE: ${selectedStyleGuide}${extraStyle}${refImgContext}

⚠️ TIMING: Veo3 clips = 8 seconds. For ${audioDuration.toFixed(0)}s audio → MINIMUM ${minimumScenes} scenes.
PROMPT FORMAT: [SHOT + CAMERA], [LENS]. [FULL CHARACTER DESC]. [ACTION]. [ENVIRONMENT]. [LIGHTING]. [COLOR]. Style: ${videoStyle}. (no subtitles, no text)

CHARACTER RULES: NEVER use just names. ALWAYS full appearance description every time.
${characterBlock}

SYNC: Each visual MUST match what narrator says at THAT timestamp. Never generic visuals.
${sceneBlueprintFromScript?.length ? `BLUEPRINT:\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 1500)}` : ''}`;

    // Build chunks
    const chunks: { blocks: any[]; startTime: number; endTime: number }[] = [];
    if (audioDuration <= CHUNK_SECONDS) {
      chunks.push({ blocks: transcriptBlocks, startTime: 0, endTime: audioDuration });
    } else {
      let currentChunkBlocks: any[] = [];
      let chunkStart = 0;
      for (const block of transcriptBlocks) {
        if (currentChunkBlocks.length > 0 && block.start - chunkStart >= CHUNK_SECONDS) {
          chunks.push({ blocks: currentChunkBlocks, startTime: chunkStart, endTime: currentChunkBlocks[currentChunkBlocks.length - 1].end });
          currentChunkBlocks = [];
          chunkStart = block.start;
        }
        currentChunkBlocks.push(block);
      }
      if (currentChunkBlocks.length > 0) {
        chunks.push({ blocks: currentChunkBlocks, startTime: chunkStart, endTime: currentChunkBlocks[currentChunkBlocks.length - 1].end });
      }
    }

    const fallbackCharacters = (characters || []).slice(0, 5).map((c: any) => {
      const a = c.appearance || {}; const cl = c.clothing || {}; const ff = c.facial_features || {};
      return {
        name: c.name || "Personagem",
        visualDescription: `${a.skin_color || 'pele média'}, ${a.hair_color || 'cabelo escuro'} ${a.hair_style || 'curto'}, olhos ${ff.eye_color || a.eye_color || 'escuros'}`,
        action: "em cena",
        expression: "neutra",
      };
    });
    const fallbackCharacterText = fallbackCharacters.map((c: any) => `${c.name}: ${c.visualDescription}`).join(" | ");

    const buildFallbackScenes = (chunk: any, expectedScenes: number, ci: number) => {
      const cameraAngles = ["wide establishing shot", "medium shot", "close-up", "low-angle shot", "over-the-shoulder shot", "tracking shot"];
      const moods = ["dramático", "tenso", "cinematográfico", "misterioso", "épico", "emocional"];
      const chunkDuration = Math.max(1, chunk.endTime - chunk.startTime);
      const sceneSpan = Math.max(5, chunkDuration / expectedScenes);

      return Array.from({ length: expectedScenes }).map((_, i) => {
        const startTime = +(chunk.startTime + i * sceneSpan).toFixed(1);
        const endTime = +Math.min(chunk.endTime, chunk.startTime + (i + 1) * sceneSpan).toFixed(1);
        const overlapping = chunk.blocks.filter((b: any) => b.start < endTime && b.end > startTime);
        const narrativeText = overlapping.map((b: any) => b.text).join(" ").trim() || "Continuação da narração.";
        const cameraAngle = cameraAngles[(i + ci) % cameraAngles.length];
        const mood = moods[(i + ci) % moods.length];
        return {
          __fallback: true, sceneIndex: i + 1,
          sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(endTime - startTime))),
          startTime, endTime, narrativeText,
          narrativeSummary: narrativeText.split(/\s+/).slice(0, 18).join(" "),
          visualPrompt: `${cameraAngle}, 35mm cinematic. ${narrativeText}. ${fallbackCharacterText ? `Characters: ${fallbackCharacterText}. ` : ''}cinematic soft light. teal-orange. Style: ${videoStyle}. (no subtitles, no text)`,
          negativePrompt: "no subtitles, no text, no logos",
          cameraAngle, lensSpec: "35mm", lightingSetup: "cinematic soft key light",
          colorGrading: "teal-orange", audioDirection: "sync", mood,
          emotionalBeat: "narrative progression",
          charactersInScene: fallbackCharacters,
          environmentDetails: "Ambiente coerente com a narração",
          transitionNote: "Corte limpo",
        };
      });
    };

    const generateChunkScenes = async (chunk: any, ci: number) => {
      const chunkTranscript = chunk.blocks.map((b: any) => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`).join("\n");
      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(2, Math.min(MAX_SCENES_PER_CHUNK, Math.ceil(chunkDuration / TARGET_SCENE_SECONDS)));
      const fallbackScenes = buildFallbackScenes(chunk, expectedScenes, ci);

      try {
        const resp = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "set_synced_scenes" } },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `TRANSCRIPTION (${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s):\n${chunkTranscript}\n\nGenerate EXACTLY ${expectedScenes} scenes (8s each). Style: ${videoStyle}. Language: ${language}.` },
            ],
          }),
        }, 1);

        if (!resp.ok) {
          if (resp.status === 402) throw new Error("Créditos insuficientes.");
          return fallbackScenes;
        }

        const data = await resp.json();
        const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '';
        let parsedScenes: any[] = [];
        try {
          const parsed = JSON.parse(args);
          parsedScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
        } catch {
          const arrStart = args.indexOf('[');
          const arrEnd = args.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd > arrStart) {
            try { parsedScenes = JSON.parse(args.slice(arrStart, arrEnd + 1)); } catch {}
          }
        }

        if (!parsedScenes.length) return fallbackScenes;

        const normalized = parsedScenes.slice(0, expectedScenes).map((s: any, idx: number) => {
          const fb = fallbackScenes[Math.min(idx, fallbackScenes.length - 1)];
          const startTime = Number.isFinite(Number(s.startTime)) ? Number(s.startTime) : fb.startTime;
          const endTimeRaw = Number.isFinite(Number(s.endTime)) ? Number(s.endTime) : fb.endTime;
          const endTime = endTimeRaw > startTime ? endTimeRaw : fb.endTime;
          return {
            ...fb, ...s, __fallback: false, startTime, endTime,
            visualPrompt: s.visualPrompt?.trim() || fb.visualPrompt,
            charactersInScene: Array.isArray(s.charactersInScene) && s.charactersInScene.length > 0 ? s.charactersInScene : fb.charactersInScene,
            sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(endTime - startTime))),
          };
        });

        while (normalized.length < expectedScenes) normalized.push({ ...fallbackScenes[normalized.length], __fallback: true });
        return normalized;
      } catch (err: any) {
        if (err?.message?.includes("Créditos")) throw err;
        return fallbackScenes;
      }
    };

    // Process chunks sequentially to stay within CPU budget
    const allScenes: any[] = [];
    let fallbackChunks = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const pct = 40 + Math.round((ci / chunks.length) * 45);
      await updateJob({ progress: pct, current_step: `Gerando cenas (${ci + 1}/${chunks.length})...` });

      try {
        const scenes = await generateChunkScenes(chunks[ci], ci);
        if (scenes.some((s: any) => s.__fallback)) fallbackChunks++;
        allScenes.push(...scenes);
      } catch (err: any) {
        if (err?.message?.includes("Créditos")) throw err;
        console.error(`Chunk ${ci + 1} failed:`, err?.message);
      }
    }

    // ═══ PHASE 4: Post-process ═══
    await updateJob({ progress: 90, current_step: "Finalizando e validando..." });

    const TRIGGER_FIX: Record<string, string> = {
      'gun': 'defensive stance', 'weapon': 'tactical equipment', 'knife': 'sharp tool',
      'blood': 'dark stain', 'dead': 'covered shape', 'corpse': 'white sheet form',
      'naked': 'draped in fabric', 'punch': 'aggressive motion', 'attack': 'confrontation',
    };
    const ANTI_TEXT = "(no subtitles, no text, no titles, no captions, no logos, no watermarks)";

    const sanitizedScenes = allScenes
      .filter((s: any) => typeof s?.visualPrompt === "string" && s.visualPrompt.trim().length > 0)
      .map(({ __fallback, ...scene }: any) => {
        if (typeof scene.visualPrompt === 'string') {
          for (const [tw, repl] of Object.entries(TRIGGER_FIX)) {
            scene.visualPrompt = scene.visualPrompt.replace(new RegExp(`\\b${tw}\\b`, 'gi'), repl);
          }
          if (!scene.visualPrompt.includes("no subtitles")) scene.visualPrompt += ` ${ANTI_TEXT}`;
          scene.visualPrompt = scene.visualPrompt.replace(/^(Scene|Cena|Prompt)\s*\d+\s*[:—-]\s*/i, '');
        }
        return scene;
      });

    sanitizedScenes.sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0));

    for (const s of sanitizedScenes) {
      const start = Number(s.startTime) || 0;
      const end = Number(s.endTime) || start + 8;
      s.startTime = start;
      s.endTime = end > start ? end : start + 8;
      s.sceneDurationSeconds = Math.max(5, Math.min(10, Math.round(Math.max(0.1, s.endTime - s.startTime))));
    }
    sanitizedScenes.forEach((s: any, i: number) => { s.sceneIndex = i + 1; });

    // Fill gaps
    const minimumRequiredScenes = Math.ceil(audioDuration / 8);
    if (sanitizedScenes.length < minimumRequiredScenes) {
      const lastEnd = sanitizedScenes.length > 0 ? sanitizedScenes[sanitizedScenes.length - 1].endTime : 0;
      if (lastEnd < audioDuration - 2) {
        const gapScenes = Math.ceil((audioDuration - lastEnd) / 8);
        for (let g = 0; g < gapScenes; g++) {
          const gStart = lastEnd + g * 8;
          const gEnd = Math.min(lastEnd + (g + 1) * 8, audioDuration);
          const overlapping = transcriptBlocks.filter((b: any) => b.start < gEnd && b.end > gStart);
          const gapText = overlapping.map((b: any) => b.text).join(' ').trim() || 'Continuação.';
          sanitizedScenes.push({
            sceneIndex: sanitizedScenes.length + 1, sceneDurationSeconds: 8,
            startTime: +gStart.toFixed(1), endTime: +gEnd.toFixed(1),
            narrativeText: gapText, narrativeSummary: gapText.split(/\s+/).slice(0, 15).join(' '),
            visualPrompt: `Cinematic wide shot: ${gapText.slice(0, 200)}. ${selectedStyleGuide.split('.')[0]}. ${ANTI_TEXT}`,
            negativePrompt: "no subtitles", cameraAngle: "wide establishing shot",
            mood: "cinematográfico", charactersInScene: fallbackCharacters,
          });
        }
      }
    }

    if (sanitizedScenes.length === 0) throw new Error("Nenhuma cena gerada.");

    const MAX_BLOCKS = 300;
    const responseBlocks = transcriptBlocks.slice(0, MAX_BLOCKS);

    const resultData = {
      transcription: { fullText, wordCount: fullText.split(/\s+/).length, audioDuration, blocks: responseBlocks },
      scenes: sanitizedScenes,
      metadata: {
        totalScenes: sanitizedScenes.length, minimumRequiredScenes,
        totalDuration: audioDuration, veo3ClipDuration: 8, videoStyle,
        chunksProcessed: chunks.length, fallbackUsed: fallbackChunks > 0, fallbackChunks,
        transcriptBlocksTotal: transcriptBlocks.length,
        method: "async-gemini-flash-v4",
      },
    };

    await updateJob({
      status: "completed",
      progress: 100,
      current_step: "Concluído!",
      result_data: resultData,
      completed_at: new Date().toISOString(),
    });

    console.log(`Job ${jobId}: DONE — ${sanitizedScenes.length} scenes, ${audioDuration.toFixed(1)}s`);

  } catch (err: any) {
    console.error(`Job ${jobId} error:`, err);
    await updateJob({
      status: "failed",
      error_message: err.message?.slice(0, 500) || "Erro desconhecido",
      completed_at: new Date().toISOString(),
    });
  }
}

// ═══ JSON REPAIR HELPER ═══

function repairAndParseJsonArray(raw: string): any[] {
  let cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  const arrStart = cleaned.indexOf('[');
  if (arrStart === -1) return [];
  cleaned = cleaned.slice(arrStart);
  try { return JSON.parse(cleaned); } catch {}

  const objects: any[] = [];
  const objRegex = /\{[^{}]*?"start"\s*:\s*([\d.]+)[^{}]*?"end"\s*:\s*([\d.]+)[^{}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = objRegex.exec(cleaned)) !== null) {
    objects.push({ start: parseFloat(m[1]), end: parseFloat(m[2]), text: m[3].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim() });
  }
  if (objects.length > 0) return objects;

  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace > 0) {
    try { return JSON.parse(cleaned.slice(0, lastBrace + 1) + ']'); } catch {}
  }
  return [];
}
