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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("audio-to-scenes v4 — chunked processing");
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const script = (formData.get("script") as string || "").slice(0, 3000);
    const videoStyle = formData.get("videoStyle") as string || "cinematográfico";
    const charactersJson = formData.get("characters") as string || "[]";
    const sceneDurationStr = formData.get("sceneDuration") as string || "8";
    const language = formData.get("language") as string || "português";
    const videoType = formData.get("videoType") as string || "long";
    const isShort = videoType === 'short' || videoType === 'shorts';

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs não configurado.");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado.");
    if (!audioFile) throw new Error("Arquivo de áudio obrigatório.");

    const sceneDuration = isShort ? Math.min(parseInt(sceneDurationStr) || 3, 4) : (parseInt(sceneDurationStr) || 8);
    let characters: any[] = [];
    try {
      const parsed = JSON.parse(charactersJson);
      characters = (Array.isArray(parsed) ? parsed : []).map((c: any) => {
        const { imageUrl, ...rest } = c;
        return rest;
      });
    } catch { /* ignore */ }
    console.log(`Input: script=${script.length}c, chars=${characters.length}, audio=${audioFile.size}b`);

    // ========== STEP 1: Transcribe ==========
    console.log("Step 1: Transcribing...");
    const sttFormData = new FormData();
    sttFormData.append("file", audioFile);
    sttFormData.append("model_id", "scribe_v2");
    sttFormData.append("tag_audio_events", "true");
    sttFormData.append("diarize", "false");

    const langMap: Record<string, string> = {
      'português': 'por', 'inglês': 'eng', 'english': 'eng',
      'espanhol': 'spa', 'alemão': 'deu', 'turco': 'tur',
      'japonês': 'jpn', 'polonês': 'pol',
    };
    const sttLang = langMap[language.toLowerCase()] || '';
    if (sttLang) sttFormData.append("language_code", sttLang);

    const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: sttFormData,
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      console.error("STT error:", sttResponse.status, errText);
      if (sttResponse.status === 401) throw new Error("ElevenLabs API key inválida.");
      if (sttResponse.status === 429) throw new Error("Rate limit ElevenLabs.");
      throw new Error(`Erro na transcrição: ${sttResponse.status}`);
    }

    const transcription = await sttResponse.json();
    const fullText = transcription.text || "";
    const words = transcription.words || [];
    if (!fullText.trim()) throw new Error("Áudio sem fala detectável.");

    const audioDuration = words.length > 0 ? words[words.length - 1].end : 0;
    console.log(`Transcribed: ${words.length} words, ${audioDuration.toFixed(1)}s`);

    // ========== STEP 2: Build transcript blocks ==========
    interface TranscriptBlock { text: string; startTime: number; endTime: number; }
    const blocks: TranscriptBlock[] = [];
    let currentBlock: any[] = [];
    let blockStart = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (currentBlock.length === 0) blockStart = word.start;
      currentBlock.push(word);

      const isEnd = /[.!?]$/.test(word.text);
      const hasPause = i < words.length - 1 && (words[i + 1].start - word.end) > 0.5;
      const tooLong = currentBlock.length >= 15;

      if (isEnd || hasPause || tooLong || i === words.length - 1) {
        blocks.push({
          text: currentBlock.map((w: any) => w.text).join(" "),
          startTime: blockStart,
          endTime: word.end,
        });
        currentBlock = [];
      }
    }

    // ========== STEP 3: Fetch scene knowledge ==========
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(8);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.prompt_template.slice(0, 200)}`
    ).join("\n").slice(0, 2000);

    // ========== STEP 4: Build style & character blocks ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney premium. ARRI ALEXA 65, Cooke Anamorphic. ACES color, Kodak Vision3. Shallow DOF f/1.4-2.8. Volumetric rays.',
      '2d': 'Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector, parallax depth, smooth 24fps.',
      '3d': 'Pixar/DreamWorks 3D. Subsurface scattering, PBR materials, global illumination, 8K textures.',
      'anime': 'Ufotable/MAPPA. Sakuga poses, Shinkai backgrounds, cel-shading, rim lighting.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light.',
      'dark': 'Dark noir. Crushed blacks, neon accents. Blade Runner 2049 meets Se7en.',
      'comic': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    const characterBlock = characters.length > 0
      ? `\nCHARACTERS:\n${characters.slice(0, 5).map((c: any, i: number) => {
          const a = c.appearance || {};
          const cl = c.clothing || {};
          return `"${c.name}": ${c.gender||'?'}, ${c.age||'?'}y, ${a.body_type||'average'}, ${a.skin_color||'medium'} skin, ${a.hair_color||'dark'} ${a.hair_style||'short'} hair, ${a.eye_color||'brown'} eyes, ${cl.shirt||'casual'}, ${cl.pants||'jeans'}`;
        }).join('\n')}\n`
      : '';

    // ========== STEP 5: Chunk transcript into ~90s segments ==========
    const CHUNK_DURATION = 90; // seconds per chunk
    interface Chunk { index: number; startTime: number; endTime: number; blocks: TranscriptBlock[]; }
    const chunks: Chunk[] = [];
    let chunkBlocks: TranscriptBlock[] = [];
    let chunkStart = 0;

    for (const block of blocks) {
      if (chunkBlocks.length > 0 && block.startTime - chunkStart >= CHUNK_DURATION) {
        chunks.push({
          index: chunks.length,
          startTime: chunkStart,
          endTime: chunkBlocks[chunkBlocks.length - 1].endTime,
          blocks: chunkBlocks,
        });
        chunkBlocks = [];
        chunkStart = block.startTime;
      }
      chunkBlocks.push(block);
    }
    if (chunkBlocks.length > 0) {
      chunks.push({
        index: chunks.length,
        startTime: chunkStart,
        endTime: chunkBlocks[chunkBlocks.length - 1].endTime,
        blocks: chunkBlocks,
      });
    }

    console.log(`Split into ${chunks.length} chunks for ${audioDuration.toFixed(1)}s audio`);

    // ========== STEP 6: Process each chunk with AI ==========
    const toolDef = {
      type: "function" as const,
      function: {
        name: "set_audio_scenes",
        description: "Divide audio chunk into scenes with contextual visual prompts",
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
                  visualPrompt: { type: "string" },
                  negativePrompt: { type: "string" },
                  cameraAngle: { type: "string" },
                  lensSpec: { type: "string" },
                  lightingSetup: { type: "string" },
                  audioDirection: { type: "string" },
                  mood: { type: "string" },
                  emotionalBeat: { type: "string" },
                  charactersInScene: { type: "array", items: { type: "string" } },
                  transitionNote: { type: "string" },
                  environment: {
                    type: "object",
                    description: "ENVIRONMENT IDENTITY SHEET for visual consistency",
                    properties: {
                      locationName: { type: "string" },
                      locationType: { type: "string" },
                      timeOfDay: { type: "string" },
                      weather: { type: "string" },
                      lightSource: { type: "string" },
                      shadowDirection: { type: "string" },
                      shadowIntensity: { type: "string" },
                      colorTemperature: { type: "string" },
                      dominantColors: { type: "array", items: { type: "string" } },
                      atmosphericElements: { type: "string" },
                      surfaceTextures: { type: "string" },
                      depthLayers: { type: "string" },
                      framingComposition: { type: "string" },
                      architecturalDetails: { type: "string" },
                      natureLandscape: { type: "string" },
                      propsDressing: { type: "string" },
                      continuityNotes: { type: "string" },
                    },
                    required: ["locationName", "locationType", "timeOfDay", "weather", "lightSource", "shadowDirection", "shadowIntensity", "colorTemperature", "dominantColors", "atmosphericElements", "surfaceTextures", "depthLayers", "framingComposition"],
                    additionalProperties: false,
                  },
                },
                required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "narrativeText", "narrativeSummary", "visualPrompt", "negativePrompt", "cameraAngle", "lensSpec", "lightingSetup", "mood", "emotionalBeat"],
                additionalProperties: false,
              },
            },
          },
          required: ["scenes"],
          additionalProperties: false,
        },
      },
    };

    const shortsTimingRules = `SHORTS TIMING RULES (CRITICAL):
- Each scene MUST be between 2 and 4 seconds long. NEVER longer than 4s.
- Target approximately ${sceneDuration} seconds per scene (2-3s ideal for Shorts)
- Generate AT LEAST one scene every 2-3 seconds of audio. MORE scenes = BETTER.
- For a 15s audio, generate 5-7 scenes. For 30s, generate 8-12 scenes.
- RAPID FIRE cuts. Every cut = new visual, new angle, new context.
- Scene 1 (0-2s) = SCROLL-STOPPING HOOK — most visually spectacular shot`;

    const longTimingRules = `TIMING RULES:
- Each scene MUST be between 5 and 10 seconds long. NEVER shorter than 5s or longer than 10s.
- Target approximately ${sceneDuration} seconds per scene, but adjust between 5-10s based on narrative pacing
- You MUST generate ONE scene for approximately every ${sceneDuration} seconds of audio.`;

    const semanticMappingBlock = isShort ? `
SEMANTIC VISUAL MAPPING — CRITICAL FOR SHORTS:
EVERY scene MUST visually represent EXACTLY what the narrator says at that moment.
DO NOT create generic shots. MAP narration to CONCRETE visuals:
- If narrator says "Egypt" → show pyramids, hieroglyphics, pharaohs, archaeological digs
- If narrator says "school" → show classroom, students, textbooks
- If narrator says "documentary" → show person watching TV, screen glow on face
- Each scene = a DIFFERENT visual context. Mix: landscapes, close-ups, people reacting, dramatic reveals.
- NEVER repeat similar angles in consecutive scenes.` : '';

    const systemPrompt = `You are a WORLD-CLASS VISUAL DIRECTOR creating ${isShort ? 'VIRAL SHORT-FORM (9:16)' : 'Netflix-grade'} video scenes from narrated audio.

${isShort ? shortsTimingRules : longTimingRules}
- Cover the ENTIRE transcript chunk — from first word to last word
- startTime and endTime MUST match actual transcript timestamps precisely

VISUAL RULES:
- EVERY visual prompt MUST directly illustrate what the narrator says at that moment
- NEVER create generic prompts — be DEEPLY SPECIFIC to the narration
- End every prompt with: (no subtitles, no text, no titles, no captions, no logos, no watermarks)
- Use 5+ different camera angles — never repeat consecutively
${semanticMappingBlock}

VISUAL STYLE: ${selectedStyleGuide}
${characterBlock}
KNOWLEDGE: ${knowledgeBlock}

PROMPT FORMULA: [Cinematography] + [Subject matching narration] + [Action] + [Environment] + [Style] + anti-text block
Quality: masterpiece, award-winning, 8K UHD, photorealistic

═══ ENVIRONMENT IDENTITY SHEET — MANDATORY FOR EVERY SCENE ═══
Generate a complete "environment" object for EACH scene with:
- locationName: SPECIFIC place (not generic), e.g. "dimly lit medieval dungeon with iron chains"
- locationType: interior/exterior/underwater/aerial/underground/space
- timeOfDay: PRECISE ("golden hour 6:30pm", "midnight", "overcast noon")
- weather: atmospheric conditions ("light rain with mist", "dense fog", "clear starry sky")
- lightSource: primary light with direction ("low sun from west", "single candle from below")
- shadowDirection & shadowIntensity: where/how shadows fall
- colorTemperature: Kelvin + feeling ("2700K warm amber", "7500K cold blue")
- dominantColors: 3-5 colors defining the palette
- atmosphericElements: particles/effects ("dust motes in beams", "embers floating")
- surfaceTextures: key textures ("wet cobblestone", "mossy stone walls")
- depthLayers: Z-depth ("FG: blur | MID: sharp subject | BG: haze")
- framingComposition: composition rule ("rule of thirds left", "centered symmetry")
- continuityNotes: how this connects to adjacent scenes visually

⚠️ CONTINUITY: Same location across scenes = IDENTICAL environment fields. Track time/shadow/light changes progressively.`;

    // ========== Process ALL chunks in PARALLEL to avoid timeout ==========
    const chunkPromises = chunks.map(async (chunk) => {
      const chunkTranscript = chunk.blocks
        .map(b => `[${b.startTime.toFixed(1)}s-${b.endTime.toFixed(1)}s] ${b.text}`)
        .join("\n").slice(0, 30000);

      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(2, Math.ceil(chunkDuration / sceneDuration));

      console.log(`Processing chunk ${chunk.index + 1}/${chunks.length}: ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s (${chunkDuration.toFixed(1)}s, expect ~${expectedScenes} scenes)`);

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "set_audio_scenes" } },
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `CHUNK ${chunk.index + 1} of ${chunks.length} — Audio segment [${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s]:

${chunkTranscript}

Generate EXACTLY ${expectedScenes} scenes (one every ~${sceneDuration}s). Cover ALL text above. Scene startTime/endTime must match transcript timestamps. Style: ${videoStyle}.`
              }
            ],
          }),
        });

        if (!response.ok) {
          const t = await response.text();
          console.error(`Chunk ${chunk.index + 1} AI error: ${response.status}`, t.slice(0, 200));
          return [];
        }

        const data = await response.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          const scenes = parsed.scenes || [];
          console.log(`Chunk ${chunk.index + 1}: generated ${scenes.length} scenes`);
          return scenes;
        }
        return [];
      } catch (err) {
        console.error(`Chunk ${chunk.index + 1} failed:`, err);
        return [];
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    const allScenes: any[] = chunkResults.flat();

    // ========== STEP 7: Merge, validate timing & re-index ==========
    allScenes.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    const minDur = isShort ? 1.5 : 5;
    const maxDur = isShort ? 4 : 10;
    for (let i = 0; i < allScenes.length; i++) {
      const s = allScenes[i];
      const dur = (s.endTime || 0) - (s.startTime || 0);
      if (dur < minDur) s.sceneDurationSeconds = minDur;
      else if (dur > maxDur) s.sceneDurationSeconds = maxDur;
      else s.sceneDurationSeconds = Math.round(dur * 10) / 10;
    }
    allScenes.forEach((s, i) => { s.sceneIndex = i + 1; });

    console.log(`TOTAL: ${allScenes.length} scenes covering ${audioDuration.toFixed(1)}s`);

    return new Response(JSON.stringify({
      transcription: {
        fullText,
        wordCount: words.length,
        audioDuration,
        blocks: blocks.map(b => ({ text: b.text, startTime: b.startTime, endTime: b.endTime })),
      },
      scenes: allScenes,
      metadata: {
        totalScenes: allScenes.length,
        totalDuration: audioDuration,
        videoStyle,
        charactersCount: characters.length,
        chunksProcessed: chunks.length,
        method: "chunked-semantic-analysis",
        veo3Optimized: true,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audio-to-scenes error:", e);
    return errResp(e instanceof Error ? e.message : "Erro desconhecido", 500);
  }
});
