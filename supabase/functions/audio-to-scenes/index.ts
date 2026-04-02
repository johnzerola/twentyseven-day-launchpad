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

interface TranscriptBlock { text: string; startTime: number; endTime: number; }
interface Chunk { index: number; startTime: number; endTime: number; blocks: TranscriptBlock[]; }

// ========== AI CALL WITH RETRY + FALLBACK ==========
async function callAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  toolDef: any,
  attempt = 0,
): Promise<any[]> {
  const models = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];
  const model = attempt >= 2 ? models[1] : models[0];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: 16384,
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: "set_audio_scenes" } },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`AI error (${model}, attempt ${attempt}): ${response.status}`, t.slice(0, 300));
      if (attempt < 3) return callAI(apiKey, systemPrompt, userPrompt, toolDef, attempt + 1);
      return [];
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error(`No tool call in response (${model}, attempt ${attempt})`);
      if (attempt < 3) return callAI(apiKey, systemPrompt, userPrompt, toolDef, attempt + 1);
      return [];
    }

    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const scenes = parsed.scenes || [];
      if (scenes.length === 0 && attempt < 3) {
        console.warn(`Empty scenes, retrying (attempt ${attempt})`);
        return callAI(apiKey, systemPrompt, userPrompt, toolDef, attempt + 1);
      }
      return scenes;
    } catch (parseErr) {
      console.error(`JSON parse error (attempt ${attempt}):`, (parseErr as Error).message);
      if (attempt < 3) return callAI(apiKey, systemPrompt, userPrompt, toolDef, attempt + 1);
      return [];
    }
  } catch (err) {
    console.error(`Network error (attempt ${attempt}):`, err);
    if (attempt < 3) return callAI(apiKey, systemPrompt, userPrompt, toolDef, attempt + 1);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("audio-to-scenes v5 — small chunks, max_tokens fix");
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
    console.log(`Input: script=${script.length}c, chars=${characters.length}, audio=${audioFile.size}b, sceneDur=${sceneDuration}s`);

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
      .order("viral_score", { ascending: false }).limit(5);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.prompt_template.slice(0, 120)}`
    ).join("\n").slice(0, 800);

    // ========== STEP 4: Build style & character blocks ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney cinematic. ARRI ALEXA 65, Cooke Anamorphic lenses, Kodak Vision3 500T film emulation, ACES color science. Dramatic lighting, shallow DOF f/1.4-2.8, creamy bokeh. Lifted blacks, subtle halation. Volumetric god rays, atmospheric haze.',
      '2d': '2D FLAT ANIMATION, Kurzgesagt-style. CRITICAL: This MUST look like a 2D animated cartoon — vibrant flat colors, clean vector shapes, bold outlines, smooth color fills, parallax depth layers, NO photorealism, NO 3D rendering. Characters are simplified 2D illustrated figures with flat shading. Backgrounds are colorful flat-design landscapes. Think motion graphics meets animated infographic. Smooth 24fps cel animation feel.',
      '3d': '3D CARTOON RENDER, Pixar/Dreamworks style. CRITICAL: This MUST look like a 3D animated movie — stylized cartoon characters with big expressive eyes, smooth plastic-like skin, subsurface scattering, PBR materials, global illumination, strand-based hair, 8K textures. Environments are colorful, stylized 3D worlds. NOT photorealistic — cartoon proportions and colors.',
      'anime': 'ANIME/MANGA style, Ufotable/MAPPA quality. CRITICAL: This MUST look like Japanese anime — dynamic sakuga action poses, beautiful painted backgrounds (Makoto Shinkai style), cel-shading, rim lighting, volumetric particles, dramatic speed lines, large expressive eyes, sharp linework.',
      'wojak': 'WOJAK/MEME internet art style. CRITICAL: This MUST look like hand-drawn internet meme art — simple drawn faces with strong emotional expressions (Wojak, Doomer, Bloomer archetypes), flat colors, minimalist backgrounds, internet culture aesthetic. Expressive stick-figure-like characters.',
      'stickmen': 'STICK FIGURE animation style. CRITICAL: This MUST look like minimalist stick figure drawings — simple black line drawings on white/simple backgrounds, humor through simplicity and timing, clean geometric shapes, hand-drawn feel.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM lens, 8K resolution, natural available light, pore-level skin detail, strand-level hair. Zero AI artifacts. Documentary-grade realism.',
      'dark': 'Dark noir/cyberpunk aesthetic. Crushed blacks, neon accents (cyan, magenta, amber). Dense volumetric fog. Noir shadow patterns, wet reflective surfaces. Blade Runner 2049 meets Se7en.',
      'whiteboard': 'WHITEBOARD ANIMATION style. CRITICAL: This MUST look like a whiteboard video — hand-drawn black ink illustrations on a white surface, strategic color highlights, educational clarity, smooth drawing reveal animation. Think RSA Animate / TED-Ed.',
      'comic': 'COMIC BOOK / GRAPHIC NOVEL style. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, saturated colors, dramatic perspective, action lines. Marvel/DC aesthetic.',
      'lego': 'LEGO WORLD style. CRITICAL: Everything MUST be made of LEGO bricks — characters are LEGO minifigures, environments built from colored LEGO blocks, plastic texture, stop-motion animation feel, bright saturated colors.',
      'minecraft': 'MINECRAFT STYLE. CRITICAL: Everything MUST be pixelated and blocky — cubic voxel world, 16x16 pixel textures, block-based characters and environments, Minecraft game aesthetic, pixelated sky and terrain.',
      'disney_toon': 'CLASSIC DISNEY ANIMATION style. CRITICAL: This MUST look like traditional Disney 2D animation — fluid character movement, charismatic expressive characters, warm color palettes, magical sparkle effects, smooth hand-drawn animation quality. Think Aladdin, Lion King, Tangled.',
      'documentary_bbc': 'BBC/NATIONAL GEOGRAPHIC documentary cinematography. CRITICAL: Sweeping aerial shots, macro close-ups, natural soft lighting, shallow DOF, desaturated earth tones, Canon C500 aesthetic, authoritative visual storytelling.',
      'gtav': 'GRAND THEFT AUTO V game aesthetic. CRITICAL: GTA art style — high saturation, urban landscapes, action-movie angles, lens flares, HDR-style lighting, street-level camera work, gritty urban environments.',
      'expressionism': 'EXPRESSIONIST ART style. CRITICAL: Bold brushstrokes, distorted perspectives, vivid non-naturalistic colors, emotional intensity, gallery-quality compositions. Van Gogh meets Munch meets Kandinsky.',
      'animal_chase': 'HYPER-REALISTIC ANIMAL DOCUMENTARY + HOLLYWOOD ACTION. National Geographic meets Jurassic Park. 120fps slow-motion, extreme close-ups on animal eyes showing reflection, volumetric dust/water particles, dramatic golden hour lighting, cinematic pursuit sequences.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    const characterBlock = characters.length > 0
      ? `\nCHARACTERS:\n${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {};
          const cl = c.clothing || {};
          return `"${c.name}": ${c.gender||'?'}, ${c.age||'?'}y, ${a.body_type||'average'}, ${a.skin_color||'medium'} skin, ${a.hair_color||'dark'} ${a.hair_style||'short'} hair, ${cl.shirt||'casual'}`;
        }).join('\n')}\n`
      : '';

    // ========== STEP 5: Chunk transcript into SMALL ~40s segments ==========
    // CRITICAL: smaller chunks = more scenes per chunk = better coverage
    const CHUNK_DURATION = isShort ? 30 : 40; // seconds per chunk (smaller = more reliable)
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

    const expectedTotalScenes = Math.ceil(audioDuration / sceneDuration);
    console.log(`Split into ${chunks.length} chunks for ${audioDuration.toFixed(1)}s audio. Expected ~${expectedTotalScenes} total scenes.`);

    // ========== STEP 6: Simplified tool definition (less tokens per scene) ==========
    const toolDef = {
      type: "function" as const,
      function: {
        name: "set_audio_scenes",
        description: "Generate scenes for this audio chunk",
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
                  narrativeText: { type: "string", description: "Exact transcript text for this scene" },
                  narrativeSummary: { type: "string", description: "1-line summary" },
                  visualPrompt: { type: "string", description: "150-250 word visual prompt" },
                  negativePrompt: { type: "string" },
                  cameraAngle: { type: "string" },
                  lensSpec: { type: "string" },
                  lightingSetup: { type: "string" },
                  mood: { type: "string" },
                  emotionalBeat: { type: "string" },
                  audioDirection: { type: "string" },
                  charactersInScene: { type: "array", items: { type: "string" } },
                  transitionNote: { type: "string" },
                  environment: {
                    type: "object",
                    properties: {
                      locationName: { type: "string" },
                      locationType: { type: "string" },
                      timeOfDay: { type: "string" },
                      weather: { type: "string" },
                      lightSource: { type: "string" },
                      colorTemperature: { type: "string" },
                      dominantColors: { type: "array", items: { type: "string" } },
                      atmosphericElements: { type: "string" },
                      framingComposition: { type: "string" },
                    },
                    required: ["locationName", "locationType", "timeOfDay", "colorTemperature", "dominantColors", "framingComposition"],
                  },
                },
                required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "narrativeText", "visualPrompt", "cameraAngle", "mood"],
              },
            },
          },
          required: ["scenes"],
        },
      },
    };

    // ========== STEP 7: Build system prompt (compact) ==========
    const shortsTimingRules = `SHORTS TIMING (CRITICAL):
- Each scene: 2-4 seconds. NEVER longer than 4s.
- Generate AT LEAST one scene every 2-3s of audio.
- Scene 1 = SCROLL-STOPPING HOOK.`;

    const longTimingRules = `TIMING (CRITICAL):
- Each scene MUST be ${sceneDuration}s (range: 5-10s). NEVER shorter than 5s or longer than 10s.
- Generate EXACTLY ONE scene per ${sceneDuration} seconds of audio. THIS IS MANDATORY.
- For a 40s chunk you MUST generate ${Math.ceil(40 / sceneDuration)} scenes. NO EXCEPTIONS.`;

    const systemPrompt = `You are a WORLD-CLASS VISUAL DIRECTOR creating ${isShort ? 'VIRAL SHORT-FORM (9:16)' : 'Netflix-grade'} video scenes.

${isShort ? shortsTimingRules : longTimingRules}

ABSOLUTE RULES:
1. Cover the ENTIRE transcript — from first word to last word. NO GAPS.
2. startTime/endTime MUST match actual transcript timestamps.
3. Every visual prompt MUST directly illustrate what the narrator says.
4. End every prompt with: (no subtitles, no text, no titles, no captions, no logos, no watermarks)
5. Use 5+ different camera angles — never repeat consecutively.

STYLE: ${selectedStyleGuide}
${characterBlock}
${knowledgeBlock ? `KNOWLEDGE:\n${knowledgeBlock}` : ''}

PROMPT FORMULA: [Camera+Lens] + [Subject matching narration] + [Action] + [Environment] + [Lighting] + anti-text block
Quality keywords: masterpiece, award-winning, 8K UHD`;

    // ========== STEP 8: Process chunks SEQUENTIALLY (avoid rate limits) ==========
    // Process in batches of 3 parallel requests
    const BATCH_SIZE = 3;
    const allScenes: any[] = [];

    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (chunks ${batchStart + 1}-${batchStart + batch.length})`);

      const batchPromises = batch.map(async (chunk) => {
        const chunkTranscript = chunk.blocks
          .map(b => `[${b.startTime.toFixed(1)}s-${b.endTime.toFixed(1)}s] ${b.text}`)
          .join("\n").slice(0, 15000);

        const chunkDuration = chunk.endTime - chunk.startTime;
        const expectedScenes = Math.max(2, Math.ceil(chunkDuration / sceneDuration));

        console.log(`  Chunk ${chunk.index + 1}: ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s (${chunkDuration.toFixed(1)}s, expect ${expectedScenes} scenes)`);

        const userPrompt = `CHUNK ${chunk.index + 1} of ${chunks.length} — Audio [${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s] (${chunkDuration.toFixed(1)}s):

${chunkTranscript}

YOU MUST generate EXACTLY ${expectedScenes} scenes. Each scene ~${sceneDuration}s. Cover ALL text. Style: ${videoStyle}.
IMPORTANT: If you generate fewer than ${expectedScenes} scenes, the video will have visual gaps. Generate ALL ${expectedScenes}.`;

        const scenes = await callAI(LOVABLE_API_KEY!, systemPrompt, userPrompt, toolDef);
        console.log(`  Chunk ${chunk.index + 1}: got ${scenes.length} scenes (expected ${expectedScenes})`);
        return scenes;
      });

      const batchResults = await Promise.all(batchPromises);
      for (const scenes of batchResults) {
        allScenes.push(...scenes);
      }
    }

    // ========== STEP 9: Validate, fix timing & re-index ==========
    allScenes.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    const minDur = isShort ? 1.5 : 5;
    const maxDur = isShort ? 4 : 10;
    for (const s of allScenes) {
      const dur = (s.endTime || 0) - (s.startTime || 0);
      if (dur < minDur) s.sceneDurationSeconds = minDur;
      else if (dur > maxDur) s.sceneDurationSeconds = maxDur;
      else s.sceneDurationSeconds = Math.round(dur * 10) / 10;
    }
    allScenes.forEach((s, i) => { s.sceneIndex = i + 1; });

    // Check coverage — if we're missing more than 20% of expected scenes, log warning
    const coverageRatio = allScenes.length / expectedTotalScenes;
    if (coverageRatio < 0.8) {
      console.warn(`⚠️ LOW COVERAGE: got ${allScenes.length} scenes, expected ~${expectedTotalScenes} (${(coverageRatio * 100).toFixed(0)}%)`);
    }

    console.log(`✅ TOTAL: ${allScenes.length} scenes covering ${audioDuration.toFixed(1)}s (expected ~${expectedTotalScenes})`);

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
        expectedScenes: expectedTotalScenes,
        totalDuration: audioDuration,
        videoStyle,
        charactersCount: characters.length,
        chunksProcessed: chunks.length,
        coveragePercent: Math.round(coverageRatio * 100),
        method: "v5-small-chunks-max-tokens",
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
