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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado.");

    const body = await req.json();
    const { audioBase64, audioUrl, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = body;

    if (!audioBase64 && !audioUrl) throw new Error("Áudio obrigatório.");
    const cleanScript = (script || "").slice(0, 30000);

    console.log("transcribe-and-generate-scenes: starting pipeline");

    // ========== PHASE 0: Resolve audio data ==========
    // If audioUrl provided, download and convert to base64 in chunks to save memory
    let resolvedBase64 = audioBase64 || "";
    const resolvedMime = audioMimeType || "audio/mp3";

    if (audioUrl && !audioBase64) {
      console.log("Downloading audio from storage URL...");
      const audioResp = await fetch(audioUrl);
      if (!audioResp.ok) throw new Error(`Erro ao baixar áudio: ${audioResp.status}`);
      const audioBuffer = new Uint8Array(await audioResp.arrayBuffer());
      console.log(`Audio downloaded: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);
      
      // Convert to base64 in chunks to avoid stack overflow
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        binary += String.fromCharCode(...audioBuffer.subarray(i, i + chunkSize));
      }
      resolvedBase64 = btoa(binary);
      // Free the buffer immediately
      binary = '';
    }

    // ========== PHASE 1: Transcribe with Gemini Flash ==========
    console.log("Phase 1: Transcribing audio...");

    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    // Helper: retry fetch with backoff
    async function retryFetch(url: string, opts: RequestInit, maxRetries = 3): Promise<Response> {
      for (let i = 0; i <= maxRetries; i++) {
        const resp = await fetch(url, opts);
        if (resp.ok || (resp.status !== 502 && resp.status !== 503 && resp.status !== 500)) return resp;
        const t = await resp.text();
        console.warn(`Retry ${i+1}/${maxRetries}: ${resp.status} ${t.slice(0,200)}`);
        if (i < maxRetries) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        if (i === maxRetries) {
          return new Response(t, { status: resp.status });
        }
      }
      throw new Error("Unreachable");
    }

    let transcribeData: any = null;

    // Strategy A: Use Google AI native API with fileUri if URL available (no base64 needed!)
    if (GOOGLE_AI_KEY && audioUrl) {
      console.log("Using Google AI with audio URL (memory-efficient)...");
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
        const geminiResp = await retryFetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `You are a professional audio transcriber. Transcribe the audio precisely in its original language (${language || 'detect automatically'}).

OUTPUT FORMAT (strict JSON array):
[
  {"start": 0.0, "end": 3.5, "text": "First sentence here."},
  {"start": 3.6, "end": 7.2, "text": "Second sentence here."}
]

RULES:
- Transcribe EVERY spoken word
- Estimate timestamps as accurately as possible per sentence
- Each entry should be one complete sentence or natural phrase
- Start times should be sequential and non-overlapping
- Return ONLY the JSON array, no other text` },
                { fileData: { mimeType: resolvedMime, fileUri: audioUrl } }
              ]
            }],
            generationConfig: { temperature: 0.1 },
          }),
        });
        if (geminiResp.ok) {
          const gData = await geminiResp.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          transcribeData = { choices: [{ message: { content: text } }] };
          console.log("Google AI URL transcription OK, length:", text.length);
          // Free base64 since transcription succeeded without it
          resolvedBase64 = '';
        } else {
          const errText = await geminiResp.text();
          console.warn("Google AI URL failed, will try inlineData:", geminiResp.status, errText.slice(0, 200));
        }
      } catch (e: any) {
        console.warn("Google AI URL error:", e.message);
      }
    }

    // Strategy A2: Google AI with inlineData (base64)
    if (!transcribeData && GOOGLE_AI_KEY && resolvedBase64) {
      console.log("Using Google AI native API with inlineData...");
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
        const geminiResp = await retryFetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `You are a professional audio transcriber. Transcribe the audio precisely in its original language (${language || 'detect automatically'}).

OUTPUT FORMAT (strict JSON array):
[
  {"start": 0.0, "end": 3.5, "text": "First sentence here."},
  {"start": 3.6, "end": 7.2, "text": "Second sentence here."}
]

RULES:
- Transcribe EVERY spoken word
- Estimate timestamps as accurately as possible per sentence
- Each entry should be one complete sentence or natural phrase
- Start times should be sequential and non-overlapping
- Return ONLY the JSON array, no other text` },
                { inlineData: { mimeType: resolvedMime, data: resolvedBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.1 },
          }),
        });
        if (geminiResp.ok) {
          const gData = await geminiResp.json();
          const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          transcribeData = { choices: [{ message: { content: text } }] };
          console.log("Google AI inlineData transcription OK, length:", text.length);
        } else {
          const errText = await geminiResp.text();
          console.warn("Google AI inlineData failed:", geminiResp.status, errText.slice(0, 300));
        }
      } catch (e: any) {
        console.warn("Google AI inlineData error:", e.message);
      }
    }

    // Strategy B: Fallback — generate timestamps from script text using Lovable Gateway
    // The gateway doesn't support audio input via image_url, so we use the script text
    // to estimate timestamps based on word count and natural pacing
    if (!transcribeData) {
      console.log("Falling back to Lovable Gateway for script-based timestamp estimation...");
      
      if (!cleanScript.trim()) {
        throw new Error("Transcrição falhou e nenhum roteiro disponível para fallback.");
      }

      const transcribeResponse = await retryFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional script-to-timestamp converter. Given a narration script, estimate realistic timestamps for each sentence as if being narrated at a natural pace (~150 words per minute in ${language || 'Portuguese'}).

OUTPUT FORMAT (strict JSON array):
[
  {"start": 0.0, "end": 3.5, "text": "First sentence here."},
  {"start": 3.6, "end": 7.2, "text": "Second sentence here."}
]

RULES:
- Break the script into natural sentences/phrases
- Estimate timestamps based on word count and natural reading pace
- Each entry should be one complete sentence or natural phrase
- Start times should be sequential and non-overlapping
- Account for natural pauses between paragraphs (0.5-1s)
- Return ONLY the JSON array, no other text`
            },
            {
              role: "user",
              content: `Convert this narration script into timestamped blocks:\n\n${cleanScript}`
            }
          ],
        }),
      });

      if (!transcribeResponse.ok) {
        const t = await transcribeResponse.text();
        console.error("Transcription fallback error:", transcribeResponse.status, t.slice(0, 300));
        if (transcribeResponse.status === 429) throw new Error("Rate limit. Tente novamente em alguns segundos.");
        if (transcribeResponse.status === 402) throw new Error("Créditos insuficientes. Adicione créditos ao workspace.");
        throw new Error(`Erro na transcrição: ${transcribeResponse.status}`);
      }

      transcribeData = await transcribeResponse.json();
      console.log("Script-based timestamp estimation completed via Lovable Gateway");
    }

    // Free base64 after all transcription strategies
    resolvedBase64 = '';
    let transcriptText = transcribeData.choices?.[0]?.message?.content || "";
    console.log("Raw transcription (first 500):", transcriptText.slice(0, 500));

    // ---- Robust JSON parser with repair for truncated responses ----
    function repairAndParseJsonArray(raw: string): any[] {
      // Clean markdown wrappers
      let cleaned = raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      
      // Extract JSON array portion
      const arrStart = cleaned.indexOf('[');
      if (arrStart === -1) return [];
      cleaned = cleaned.slice(arrStart);
      
      // Try direct parse first
      try { return JSON.parse(cleaned); } catch {}
      
      // Strategy: extract individual objects with regex (handles truncated JSON)
      const objects: any[] = [];
      const objRegex = /\{[^{}]*?"start"\s*:\s*([\d.]+)[^{}]*?"end"\s*:\s*([\d.]+)[^{}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = objRegex.exec(cleaned)) !== null) {
        objects.push({
          start: parseFloat(m[1]),
          end: parseFloat(m[2]),
          text: m[3].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim(),
        });
      }
      if (objects.length > 0) {
        console.log(`JSON repair: extracted ${objects.length} blocks via regex`);
        return objects;
      }
      
      // Last resort: try to close truncated JSON
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) {
        const truncated = cleaned.slice(0, lastBrace + 1) + ']';
        try { return JSON.parse(truncated); } catch {}
      }
      
      return [];
    }

    // Parse transcript JSON
    let transcriptBlocks: { start: number; end: number; text: string }[] = [];
    
    // Strategy 1: Robust JSON parse with repair
    transcriptBlocks = repairAndParseJsonArray(transcriptText);

    // Strategy 2: Split plain text as fallback
    if (!transcriptBlocks.length && transcriptText.trim()) {
      console.log("Falling back to plain text splitting");
      const plainText = transcriptText.replace(/```[\s\S]*?```/g, '').replace(/[\[\]{}]/g, '').trim();
      // Extract sentences from any readable text
      const sentences = plainText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 5);
      if (sentences.length > 0) {
        const estDuration = Math.max(60, sentences.length * 4); // ~4s per sentence
        const perSentence = estDuration / sentences.length;
        transcriptBlocks = sentences.map((s, i) => ({
          start: +(i * perSentence).toFixed(1),
          end: +((i + 1) * perSentence).toFixed(1),
          text: s,
        }));
        console.log(`Plain text fallback: ${transcriptBlocks.length} blocks, ~${estDuration}s`);
      }
    }

    if (!transcriptBlocks.length) throw new Error("Áudio sem fala detectável. Verifique se o áudio contém narração.");

    const audioDuration = transcriptBlocks[transcriptBlocks.length - 1].end;
    const fullText = transcriptBlocks.map(b => b.text).join(" ");
    console.log(`Transcribed: ${transcriptBlocks.length} blocks, ${audioDuration.toFixed(1)}s, ${fullText.length} chars`);

    // ========== PHASE 2: Fetch knowledge base ==========
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(5);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.prompt_template.slice(0, 150)}`
    ).join("\n").slice(0, 1200);

    // ========== PHASE 3: Build context ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney premium. ARRI ALEXA 65, Cooke Anamorphic. ACES color, Kodak Vision3. Shallow DOF f/1.4-2.8.',
      '2d': 'Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector art, parallax depth, smooth 24fps. NO 3D, NO photorealistic.',
      '3d': 'Pixar/DreamWorks 3D. Subsurface scattering, PBR materials, global illumination.',
      'anime': 'Ufotable/MAPPA. Sakuga poses, Shinkai backgrounds, cel-shading, rim lighting.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light.',
      'dark': 'Dark noir. Crushed blacks, neon accents. Blade Runner 2049 meets Se7en.',
      'comic': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
      'hq': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
      'wojak': 'Wojak/meme internet art style. Simple drawn faces with exaggerated emotional expressions, flat colors, minimalist backgrounds, internet meme aesthetic.',
      'stickmen': 'Stick figure animation. Minimalist black line drawings, simple backgrounds, hand-drawn feel.',
      'whiteboard': 'Whiteboard animation. Hand-drawn sketches on white. Black ink, educational, clean lines.',
      'animal_chase': 'HYPER-REALISTIC WILDLIFE SURVIVAL. National Geographic meets Hollywood thriller. ARRI ALEXA Mini LF, 8K, 120fps slow-motion. Photorealistic animals.',
      'fotorrealista_documentario': 'Documentary photography, natural soft lighting, shallow depth of field, Canon 5D aesthetic, desaturated earth tones.',
      'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes, gallery-quality compositions.',
      'aquarela': 'Watercolor painting. Soft translucent washes, visible paper grain, bleeding color edges, delicate brushwork.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];
    const extraStyle = customStyleNotes ? `\nUSER STYLE INSTRUCTIONS: ${customStyleNotes}` : '';
    const refImgContext = referenceImageUrls?.length ? `\nREFERENCE IMAGES: ${referenceImageUrls.length} reference images uploaded. Match that exact art style, color palette, and character design.` : '';

    const characterBlock = characters?.length > 0
      ? `\n🎭 CHARACTER SHEETS (MANDATORY — reproduce EXACTLY in every scene they appear):
${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {};
          const cl = c.clothing || {};
          const ff = c.facial_features || {};
          const per = c.personality || {};
          const lines = [
            `━━━ "${c.name}" ━━━`,
            `Role: ${c.role || 'character'} | Gender: ${c.gender || '?'} | Age: ${c.age || '?'}`,
            `BUILD: ${a.body_type || 'average'} build, ${a.height || 'medium height'}`,
            `SKIN: ${a.skin_color || 'medium'} skin tone`,
            `HAIR: ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair`,
            `EYES: ${ff.eye_color || a.eye_color || 'dark'} eyes, ${ff.eye_shape || 'normal'} shape`,
            `FACE: ${ff.face_shape || 'oval'} face, ${ff.eyebrows || 'normal'} eyebrows, ${ff.nose || 'straight'} nose, ${ff.mouth || 'normal'} mouth, ${ff.jaw || 'defined'} jaw`,
            `FACIAL HAIR: ${ff.facial_hair || ff.beard || 'none'}`,
            `DISTINCTIVE: ${ff.scars || ff.marks || a.distinctive_features || 'none'}`,
            `SHIRT/TOP: ${cl.shirt || cl.top || 'casual top'}`,
            `PANTS/BOTTOM: ${cl.pants || cl.bottom || 'jeans'}`,
            `SHOES: ${cl.shoes || 'standard'}`,
            `ACCESSORIES: ${cl.accessories || cl.hat || 'none'}`,
            c.reference_image_url ? `REF IMAGE: ${c.reference_image_url}` : '',
          ].filter(Boolean);
          return lines.join('\n');
        }).join('\n\n')}\n`
      : '';

    // ========== PHASE 4: Generate scenes ==========
    // Use Gemini Flash for speed (not Pro) to avoid timeout on long audio
    console.log("Phase 4: Generating synced scenes with Gemini Flash...");

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
                  narrativeText: { type: "string", description: "Exact narration text for this time window" },
                  narrativeSummary: { type: "string", description: "1-sentence summary of what happens" },
                  visualPrompt: { type: "string", description: "80-150 word cinematic prompt. MUST include FULL physical description of every character present: skin tone, hair color+style, eye color, facial features, exact clothing. Never use character names alone." },
                  negativePrompt: { type: "string" },
                  cameraAngle: { type: "string" },
                  lensSpec: { type: "string", description: "e.g. 85mm f/1.4, 24mm wide, 50mm anamorphic" },
                  lightingSetup: { type: "string", description: "e.g. golden hour rim light, neon underexposed, studio 3-point" },
                  colorGrading: { type: "string", description: "e.g. teal-orange, desaturated cold, warm vintage" },
                  audioDirection: { type: "string" },
                  mood: { type: "string" },
                  emotionalBeat: { type: "string" },
                  charactersInScene: { type: "array", items: { type: "object", properties: { name: { type: "string" }, visualDescription: { type: "string", description: "FULL appearance: skin, hair, eyes, face shape, clothing, accessories" }, action: { type: "string" }, expression: { type: "string" } }, required: ["name", "visualDescription"] } },
                  environmentDetails: { type: "string", description: "Detailed setting: location, props, weather, textures" },
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

    // Calculate minimum scenes for full coverage
    const minimumScenes = Math.ceil(audioDuration / 8);
    
    const systemPrompt = `You are a VISUAL DIRECTOR creating video scenes from narrated audio.
You have a TRANSCRIPTION with timestamps. Create visual scenes that MATCH what is being said.

🎨 MANDATORY ART STYLE:
${selectedStyleGuide}
${extraStyle}${refImgContext}

⚠️ CRITICAL TIMING — Veo3 GENERATES 8-SECOND CLIPS:
- Each scene MUST be exactly 8 seconds (Veo3 clip length)
- For ${audioDuration.toFixed(0)}s audio → MINIMUM ${minimumScenes} scenes required
- HOOK scene (first): 8s — most visually spectacular
- Cover the ENTIRE audio — NO GAPS — every second must have a scene
- startTime/endTime MUST align with transcript timestamps
- Scene visuals MUST match what the narrator says at THAT EXACT timestamp

PROMPT FORMAT: [SHOT_TYPE + CAMERA_MOTION], [LENS]. [FULL CHARACTER DESCRIPTION — skin, hair, eyes, face, clothing]. [ACTION + EXPRESSION]. [ENVIRONMENT + PROPS]. [LIGHTING]. [COLOR GRADING]. Style: ${videoStyle}. (no subtitles, no text, no titles, no captions, no logos, no watermarks)

🚨 CHARACTER CONSISTENCY RULES (CRITICAL):
- NEVER use just a character name in visualPrompt. ALWAYS describe their FULL appearance every single time.
- Include: skin tone, hair (color + style + length), eye color + shape, face shape, eyebrows, nose, mouth, jawline, facial hair, clothing (top, bottom, shoes, accessories), body build.
- Copy the CHARACTER SHEET descriptions VERBATIM into each scene's visualPrompt and charactersInScene.visualDescription.
- If a character has a scar, tattoo, or distinctive mark, it MUST appear in EVERY scene.
- Clothing must stay consistent unless the narrative describes a change.
${characterBlock}

SYNC RULES — NARRATION-TO-VISUAL MATCHING (CRITICAL):
- EVERY visual prompt MUST illustrate what the narrator says at THAT EXACT moment
- Read the transcript text for each time window and create a visual that REPRESENTS it
- Concrete objects/places mentioned → SHOW them directly
- Abstract concepts → Visual metaphors (fear → growing shadows, power → rising crane shot)
- Emotions mentioned → Color temperature (sad → cool blues, exciting → warm oranges)
- NEVER show generic stock visuals disconnected from narration
- If narrator describes a person → show that person with matching description
- If narrator describes a place → show that exact environment
- If narrator tells a story → illustrate the KEY MOMENT of what happened
- CAMERA VARIETY: Never repeat angles consecutively

PROMPT QUALITY: 100-180 words per prompt. Include lens, lighting, color grading, environment textures.
Each prompt must be semantically connected to the narration at that timestamp.

${sceneBlueprintFromScript?.length ? `SCRIPT BLUEPRINT:\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 1500)}` : ''}`;

    // Split into chunks — adaptive sizing to keep requests fast enough
    // CRITICAL: Veo3 clips = 8 seconds max. Scenes MUST be 8s to ensure full coverage.
    // For 80s audio → 10 scenes minimum (80/8 = 10)
    const CHUNK_SECONDS = audioDuration > 600 ? 90 : 120;
    const TARGET_SCENE_SECONDS = 8; // Veo3 clip duration — always 8s
    const MAX_SCENES_PER_CHUNK = Math.ceil(CHUNK_SECONDS / TARGET_SCENE_SECONDS) + 2; // ~17 scenes per chunk

    const chunks: { blocks: typeof transcriptBlocks; startTime: number; endTime: number }[] = [];

    if (audioDuration <= CHUNK_SECONDS) {
      chunks.push({ blocks: transcriptBlocks, startTime: 0, endTime: audioDuration });
    } else {
      let currentChunkBlocks: typeof transcriptBlocks = [];
      let chunkStart = 0;
      for (const block of transcriptBlocks) {
        if (currentChunkBlocks.length > 0 && block.start - chunkStart >= CHUNK_SECONDS) {
          chunks.push({
            blocks: currentChunkBlocks,
            startTime: chunkStart,
            endTime: currentChunkBlocks[currentChunkBlocks.length - 1].end,
          });
          currentChunkBlocks = [];
          chunkStart = block.start;
        }
        currentChunkBlocks.push(block);
      }
      if (currentChunkBlocks.length > 0) {
        chunks.push({
          blocks: currentChunkBlocks,
          startTime: chunkStart,
          endTime: currentChunkBlocks[currentChunkBlocks.length - 1].end,
        });
      }
    }

    console.log(`Processing ${chunks.length} chunk(s) for ${audioDuration.toFixed(1)}s audio`);

    const fallbackCharacters = (characters || []).slice(0, 5).map((c: any) => {
      const a = c.appearance || {};
      const cl = c.clothing || {};
      const ff = c.facial_features || {};
      return {
        name: c.name || "Personagem",
        visualDescription: `${a.skin_color || 'pele média'}, ${a.hair_color || 'cabelo escuro'} ${a.hair_style || 'curto'}, olhos ${ff.eye_color || a.eye_color || 'escuros'}, rosto ${ff.face_shape || 'oval'}, sobrancelhas ${ff.eyebrows || 'naturais'}, nariz ${ff.nose || 'reto'}, boca ${ff.mouth || 'natural'}, roupa: ${cl.shirt || cl.top || 'top casual'}, ${cl.pants || cl.bottom || 'calça casual'}, ${cl.shoes || 'calçado padrão'}, acessórios: ${cl.accessories || 'nenhum'}`,
        action: "em cena",
        expression: "neutra",
      };
    });

    const fallbackCharacterText = fallbackCharacters
      .map((c: any) => `${c.name}: ${c.visualDescription}`)
      .join(" | ");

    const parseScenesFromToolArgs = (rawArgs: string): any[] => {
      if (!rawArgs) return [];
      try {
        const parsed = JSON.parse(rawArgs);
        return Array.isArray(parsed?.scenes) ? parsed.scenes : [];
      } catch {
        const arrStart = rawArgs.indexOf('[');
        const arrEnd = rawArgs.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
          try {
            const recovered = JSON.parse(rawArgs.slice(arrStart, arrEnd + 1));
            return Array.isArray(recovered) ? recovered : [];
          } catch {
            return [];
          }
        }
        return [];
      }
    };

    const buildFallbackScenes = (
      chunk: { blocks: typeof transcriptBlocks; startTime: number; endTime: number },
      expectedScenes: number,
      chunkIndex: number
    ) => {
      const cameraAngles = [
        "wide establishing shot",
        "medium shot",
        "close-up",
        "low-angle shot",
        "over-the-shoulder shot",
        "tracking shot",
      ];
      const moods = ["dramático", "tenso", "cinematográfico", "misterioso", "épico", "emocional"];
      const chunkDuration = Math.max(1, chunk.endTime - chunk.startTime);
      const sceneSpan = Math.max(5, chunkDuration / expectedScenes);

      return Array.from({ length: expectedScenes }).map((_, i) => {
        const startTime = +(chunk.startTime + i * sceneSpan).toFixed(1);
        const endTime = +Math.min(chunk.endTime, chunk.startTime + (i + 1) * sceneSpan).toFixed(1);
        const overlapping = chunk.blocks.filter((b) => b.start < endTime && b.end > startTime);
        const narrativeText = overlapping.map((b) => b.text).join(" ").trim() || "Continuação da narração.";
        const narrativeSummary = narrativeText.split(/\s+/).slice(0, 18).join(" ");

        const cameraAngle = cameraAngles[(i + chunkIndex) % cameraAngles.length];
        const mood = moods[(i + chunkIndex) % moods.length];
        const lensSpec = "35mm cinematic";
        const lightingSetup = "cinematic soft key light with contrast fill";
        const colorGrading = "teal-orange cinematic grade";
        const environmentDetails = "Ambiente coerente com a narração, com textura realista e profundidade.";

        return {
          __fallback: true,
          sceneIndex: i + 1,
          sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(endTime - startTime))),
          startTime,
          endTime,
          narrativeText,
          narrativeSummary,
          visualPrompt: `${cameraAngle}, ${lensSpec}. ${narrativeText}. ${fallbackCharacterText ? `Personagens: ${fallbackCharacterText}. ` : ''}${environmentDetails} ${lightingSetup}. ${colorGrading}. Style: ${videoStyle}. (no subtitles, no text, no titles, no captions, no logos, no watermarks)`,
          negativePrompt: "no subtitles, no text, no logos, no watermarks, no artifacts",
          cameraAngle,
          lensSpec,
          lightingSetup,
          colorGrading,
          audioDirection: "sync with narration pacing",
          mood,
          emotionalBeat: "narrative progression",
          charactersInScene: fallbackCharacters,
          environmentDetails,
          transitionNote: "Corte limpo para próxima cena",
        };
      });
    };

    const generateChunkScenes = async (
      chunk: { blocks: typeof transcriptBlocks; startTime: number; endTime: number },
      ci: number
    ) => {
      const chunkTranscript = chunk.blocks
        .map((b) => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`)
        .join("\n");

      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(
        2,
        Math.min(MAX_SCENES_PER_CHUNK, Math.ceil(chunkDuration / TARGET_SCENE_SECONDS))
      );
      const fallbackScenes = buildFallbackScenes(chunk, expectedScenes, ci);

      console.log(
        `Chunk ${ci + 1}/${chunks.length}: ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s, ${expectedScenes} scenes`
      );

      try {
        const resp = await retryFetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              tools: [toolDef],
              tool_choice: { type: "function", function: { name: "set_synced_scenes" } },
              messages: [
                { role: "system", content: systemPrompt },
                {
                  role: "user",
                  content: `TRANSCRIPTION (${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s):

${chunkTranscript}

${cleanScript ? `SCRIPT CONTEXT:\n${cleanScript.slice(0, 1200)}` : ''}

Generate EXACTLY ${expectedScenes} scenes for this segment. Each scene 5-10s. Style: ${videoStyle}. Language: ${language}.
Visual content MUST match what is narrated at each timestamp.`,
                },
              ],
            }),
          },
          1
        );

        if (!resp.ok) {
          const t = await resp.text();
          console.error(`Chunk ${ci + 1} error: ${resp.status}`, t.slice(0, 200));
          if (resp.status === 402) throw new Error("Créditos insuficientes.");
          return fallbackScenes;
        }

        const data = await resp.json();
        const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '';
        const parsedScenes = parseScenesFromToolArgs(args);

        if (!parsedScenes.length) {
          console.warn(`Chunk ${ci + 1}: empty AI scenes, using fallback`);
          return fallbackScenes;
        }

        const normalized = parsedScenes
          .filter((s: any) => s && typeof s === "object")
          .slice(0, expectedScenes)
          .map((s: any, idx: number) => {
            const fb = fallbackScenes[Math.min(idx, fallbackScenes.length - 1)];
            const startCandidate = Number(s.startTime);
            const endCandidate = Number(s.endTime);
            const startTime = Number.isFinite(startCandidate) ? startCandidate : fb.startTime;
            const endTimeRaw = Number.isFinite(endCandidate) ? endCandidate : fb.endTime;
            const endTime = endTimeRaw > startTime ? endTimeRaw : fb.endTime;

            const visualPrompt =
              typeof s.visualPrompt === "string" && s.visualPrompt.trim().length > 0
                ? s.visualPrompt.trim()
                : fb.visualPrompt;

            const charactersInScene =
              Array.isArray(s.charactersInScene) && s.charactersInScene.length > 0
                ? s.charactersInScene
                : fb.charactersInScene;

            return {
              ...fb,
              ...s,
              __fallback: false,
              startTime,
              endTime,
              visualPrompt,
              charactersInScene,
              sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(endTime - startTime))),
            };
          });

        while (normalized.length < expectedScenes) {
          normalized.push({ ...fallbackScenes[normalized.length], __fallback: true });
        }

        console.log(`Chunk ${ci + 1}: ${normalized.length} scenes generated`);
        return normalized;
      } catch (err: any) {
        if (err?.message?.includes("Créditos")) throw err;
        console.warn(`Chunk ${ci + 1} fallback mode:`, err?.message || err);
        return fallbackScenes;
      }
    };

    // Process chunks in parallel
    const settled = await Promise.allSettled(chunks.map((chunk, ci) => generateChunkScenes(chunk, ci)));

    const allScenes: any[] = [];
    let criticalError: Error | null = null;
    let fallbackChunks = 0;

    settled.forEach((result, ci) => {
      if (result.status === "fulfilled") {
        if (result.value.some((s: any) => s.__fallback)) fallbackChunks += 1;
        allScenes.push(...result.value);
      } else {
        const msg = result.reason?.message || `Chunk ${ci + 1} failed`;
        console.error(`Chunk ${ci + 1} failed:`, msg);
        if (!criticalError && msg.includes("Créditos")) {
          criticalError = result.reason;
        }
      }
    });

    if (criticalError) throw criticalError;

    // ========== PHASE 5: Merge, validate, DarkPlanner v3 post-processing ==========
    const TRIGGER_FIX: Record<string, string> = {
      'gun': 'defensive stance', 'weapon': 'tactical equipment', 'knife': 'sharp tool',
      'blood': 'dark stain', 'dead': 'covered shape', 'corpse': 'white sheet form',
      'naked': 'draped in fabric', 'punch': 'aggressive motion', 'attack': 'confrontation',
    };
    const ANTI_TEXT = "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";

    const sanitizedScenes = allScenes
      .filter((s: any) => typeof s?.visualPrompt === "string" && s.visualPrompt.trim().length > 0)
      .map(({ __fallback, ...scene }: any) => {
        // DarkPlanner v3: trigger word auto-fix
        if (typeof scene.visualPrompt === 'string') {
          for (const [tw, repl] of Object.entries(TRIGGER_FIX)) {
            const re = new RegExp(`\\b${tw}\\b`, 'gi');
            scene.visualPrompt = scene.visualPrompt.replace(re, repl);
          }
          if (!scene.visualPrompt.includes("no subtitles")) {
            scene.visualPrompt += ` ${ANTI_TEXT}`;
          }
          scene.visualPrompt = scene.visualPrompt.replace(/^(Scene|Cena|Prompt)\s*\d+\s*[:—-]\s*/i, '');
        }
        return scene;
      });

    sanitizedScenes.sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0));

    for (const s of sanitizedScenes) {
      const start = Number(s.startTime) || 0;
      const end = Number(s.endTime) || start + 6;
      const dur = Math.max(5, Math.min(10, Math.round(Math.max(0.1, end - start))));
      s.startTime = start;
      s.endTime = end > start ? end : start + 6;
      s.sceneDurationSeconds = dur;
    }
    sanitizedScenes.forEach((s: any, i: number) => {
      s.sceneIndex = i + 1;
    });

    if (sanitizedScenes.length === 0) {
      throw new Error("Nenhuma cena gerada. Tente novamente.");
    }

    const MAX_BLOCKS_IN_RESPONSE = 300;
    const responseBlocks = transcriptBlocks.length > MAX_BLOCKS_IN_RESPONSE
      ? transcriptBlocks.slice(0, MAX_BLOCKS_IN_RESPONSE)
      : transcriptBlocks;

    console.log(`DONE: ${sanitizedScenes.length} scenes, ${audioDuration.toFixed(1)}s audio`);

    return new Response(JSON.stringify({
      transcription: {
        fullText,
        wordCount: fullText.split(/\s+/).length,
        audioDuration,
        blocks: responseBlocks,
      },
      scenes: sanitizedScenes,
      metadata: {
        totalScenes: sanitizedScenes.length,
        totalDuration: audioDuration,
        videoStyle,
        customStyleNotes: !!customStyleNotes,
        charactersCount: characters?.length || 0,
        chunksProcessed: chunks.length,
        fallbackUsed: fallbackChunks > 0,
        fallbackChunks,
        transcriptBlocksTotal: transcriptBlocks.length,
        transcriptBlocksReturned: responseBlocks.length,
        method: "gemini-flash-adaptive-parallel",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(
      e.message || "Erro desconhecido",
      e.message?.includes('402') ? 402 : e.message?.includes('429') ? 429 : 500
    );
  }
});
