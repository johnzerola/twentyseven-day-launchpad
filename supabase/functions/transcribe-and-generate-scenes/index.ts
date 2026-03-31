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
    const action = body.action || "start";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ ACTION: poll ═══
    if (action === "poll" && body.job_id) {
      const { data: job, error } = await sb.from("processing_jobs")
        .select("status, progress, current_step, result_data, error_message")
        .eq("id", body.job_id).single();
      if (error || !job) return errResp("Job não encontrado", 404);
      return jsonResp(job);
    }

    // ═══ ACTION: start — transcribe only, return chunks ═══
    if (action === "start") {
      const { audioUrl, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = body;
      if (!audioUrl) throw new Error("audioUrl obrigatório.");

      const cleanScript = (script || "").slice(0, 30000);
      const resolvedMime = audioMimeType || "audio/mp3";
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

      // Transcribe — Strategy: ElevenLabs STT (best, handles any size) → Gemini (small files) → script fallback
      let transcribeData: any = null;

      // ── METHOD 1: ElevenLabs Scribe v2 (preferred — real word-level timestamps) ──
      if (ELEVENLABS_API_KEY && audioUrl) {
        try {
          console.log("Downloading audio for ElevenLabs STT...");
          const audioFetchCtrl = new AbortController();
          const audioTimeout = setTimeout(() => audioFetchCtrl.abort(), 60000);
          const audioResp = await fetch(audioUrl, { signal: audioFetchCtrl.signal });
          clearTimeout(audioTimeout);
          if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);

          const audioBlob = await audioResp.blob();
          console.log(`Audio downloaded: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB, sending to ElevenLabs...`);

          const langMap: Record<string, string> = {
            'português': 'por', 'inglês': 'eng', 'english': 'eng',
            'espanhol': 'spa', 'alemão': 'deu', 'turco': 'tur',
            'japonês': 'jpn', 'polonês': 'pol',
          };
          const sttLang = langMap[(language || '').toLowerCase()] || '';

          const sttFormData = new FormData();
          sttFormData.append("file", audioBlob, "audio.mp3");
          sttFormData.append("model_id", "scribe_v2");
          sttFormData.append("tag_audio_events", "true");
          sttFormData.append("diarize", "false");
          if (sttLang) sttFormData.append("language_code", sttLang);

          const sttCtrl = new AbortController();
          const sttTimeout = setTimeout(() => sttCtrl.abort(), 120000);
          const sttResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
            body: sttFormData,
            signal: sttCtrl.signal,
          });
          clearTimeout(sttTimeout);

          if (sttResponse.ok) {
            const sttResult = await sttResponse.json();
            const words = sttResult.words || [];
            const fullText = sttResult.text || "";

            if (fullText.trim() && words.length > 0) {
              // Build sentence-level blocks from word timestamps
              const blocks: { start: number; end: number; text: string }[] = [];
              let currentWords: any[] = [];
              let blockStart = 0;

              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (currentWords.length === 0) blockStart = word.start;
                currentWords.push(word);

                const isEnd = /[.!?]$/.test(word.text);
                const hasPause = i < words.length - 1 && (words[i + 1].start - word.end) > 0.5;
                const tooLong = currentWords.length >= 15;

                if (isEnd || hasPause || tooLong || i === words.length - 1) {
                  blocks.push({
                    start: +blockStart.toFixed(1),
                    end: +word.end.toFixed(1),
                    text: currentWords.map((w: any) => w.text).join(" "),
                  });
                  currentWords = [];
                }
              }

              // Format as expected by the rest of the pipeline
              const jsonContent = JSON.stringify(blocks);
              transcribeData = { choices: [{ message: { content: jsonContent } }] };
              console.log(`ElevenLabs STT success: ${words.length} words, ${blocks.length} blocks, ${words[words.length - 1].end.toFixed(1)}s`);
            } else {
              console.warn("ElevenLabs returned empty transcription");
            }
          } else {
            const errText = await sttResponse.text();
            console.warn("ElevenLabs STT failed:", sttResponse.status, errText.slice(0, 200));
          }
        } catch (e: any) {
          console.warn("ElevenLabs STT error:", e.message);
        }
      }

      // ── METHOD 2: Gemini (for small files <20MB only) ──
      if (!transcribeData && GOOGLE_AI_KEY && audioUrl) {
        try {
          console.log("Trying Gemini transcription...");
          const audioFetchCtrl = new AbortController();
          const audioTimeout = setTimeout(() => audioFetchCtrl.abort(), 30000);
          const audioResp = await fetch(audioUrl, { signal: audioFetchCtrl.signal });
          clearTimeout(audioTimeout);
          if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);

          const audioBuffer = await audioResp.arrayBuffer();
          const audioBytes = new Uint8Array(audioBuffer);

          if (audioBytes.length > 20 * 1024 * 1024) {
            console.warn("Audio too large for Gemini inline, skipping");
          } else {
            let base64Audio = "";
            const CHUNK_SIZE = 8192;
            for (let i = 0; i < audioBytes.length; i += CHUNK_SIZE) {
              base64Audio += String.fromCharCode(...audioBytes.subarray(i, i + CHUNK_SIZE));
            }
            base64Audio = btoa(base64Audio);

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
            const geminiCtrl = new AbortController();
            const geminiTimeout = setTimeout(() => geminiCtrl.abort(), 120000);

            const geminiResp = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: geminiCtrl.signal,
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
                  { inlineData: { mimeType: resolvedMime, data: base64Audio } }
                ]}],
                generationConfig: { temperature: 0.1 },
              }),
            });
            clearTimeout(geminiTimeout);

            if (geminiResp.ok) {
              const gData = await geminiResp.json();
              const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              transcribeData = { choices: [{ message: { content: text } }] };
              console.log("Gemini transcription successful");
            } else {
              const errText = await geminiResp.text();
              console.warn("Gemini transcription failed:", geminiResp.status, errText.slice(0, 200));
            }
          }
        } catch (e: any) {
          console.warn("Gemini transcription error:", e.message);
        }
      }

      // ── METHOD 3: Script-based fallback (no real audio timestamps) ──
      if (!transcribeData) {
        if (!cleanScript.trim()) throw new Error("Transcrição falhou e nenhum roteiro disponível.");
        console.log("Using script-based fallback transcription");
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `Convert narration script to timestamps at ~150 wpm in ${language || 'Portuguese'}. Return JSON array: [{"start":0.0,"end":3.5,"text":"..."}]` },
              { role: "user", content: cleanScript },
            ],
          }),
        });
        if (!resp.ok) {
          if (resp.status === 429) throw new Error("Rate limit. Tente novamente.");
          if (resp.status === 402) throw new Error("Créditos insuficientes.");
          throw new Error(`Erro na transcrição: ${resp.status}`);
        }
        transcribeData = await resp.json();
      }

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

      // Build chunks
      const CHUNK_SECONDS = audioDuration > 600 ? 90 : 120;
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

      // Store job with chunks for frontend to iterate
      const authHeader = req.headers.get("Authorization");
      let userId = "anonymous";
      if (authHeader) {
        const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
        if (user) userId = user.id;
      }

      const { data: job, error: jobError } = await sb.from("processing_jobs").insert({
        user_id: userId,
        job_type: "transcribe_and_generate_scenes",
        status: "transcribed",
        progress: 30,
        current_step: "Transcrição concluída",
        input_data: { videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript },
        result_data: {
          transcription: { fullText, wordCount: fullText.split(/\s+/).length, audioDuration, blocks: transcriptBlocks.slice(0, 300) },
          chunks: chunks.map((c, i) => ({ index: i, startTime: c.startTime, endTime: c.endTime, blockCount: c.blocks.length })),
          chunksData: chunks,
          scenes: [],
          metadata: { totalChunks: chunks.length, videoStyle, audioDuration },
        },
      }).select().single();

      if (jobError || !job) return errResp("Falha ao criar job: " + (jobError?.message || ""), 500);

      return jsonResp({
        job_id: job.id,
        status: "transcribed",
        totalChunks: chunks.length,
        audioDuration,
        transcriptBlockCount: transcriptBlocks.length,
      });
    }

    // ═══ ACTION: generate_chunk — process ONE chunk, return scenes ═══
    if (action === "generate_chunk") {
      const { job_id, chunk_index } = body;
      if (!job_id || chunk_index === undefined) return errResp("job_id e chunk_index obrigatórios", 400);

      const { data: job, error: jobErr } = await sb.from("processing_jobs")
        .select("result_data, input_data")
        .eq("id", job_id).single();
      if (jobErr || !job) return errResp("Job não encontrado", 404);

      const resultData = job.result_data as any;
      const inputData = job.input_data as any;
      const chunksData = resultData.chunksData;
      if (!chunksData || chunk_index >= chunksData.length) return errResp("Chunk inválido", 400);

      const chunk = chunksData[chunk_index];
      const audioDuration = resultData.transcription.audioDuration;
      const totalChunks = chunksData.length;
      const { videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = inputData;

      const TARGET_SCENE_SECONDS = 8;
      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(2, Math.ceil(chunkDuration / TARGET_SCENE_SECONDS));
      const minimumScenes = Math.ceil(audioDuration / 8);

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

      const fallbackCharacters = (characters || []).slice(0, 5).map((c: any) => {
        const a = c.appearance || {}; const ff = c.facial_features || {};
        return {
          name: c.name || "Personagem",
          visualDescription: `${a.skin_color || 'pele média'}, ${a.hair_color || 'cabelo escuro'} ${a.hair_style || 'curto'}, olhos ${ff.eye_color || a.eye_color || 'escuros'}`,
          action: "em cena", expression: "neutra",
        };
      });
      const fallbackCharacterText = fallbackCharacters.map((c: any) => `${c.name}: ${c.visualDescription}`).join(" | ");

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
                    visualPrompt: { type: "string" },
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
                },
              },
            },
            required: ["scenes"],
          },
        },
      };

      const systemPrompt = `You are a VISUAL DIRECTOR creating video scenes from narrated audio.
MANDATORY ART STYLE: ${selectedStyleGuide}${extraStyle}${refImgContext}

⚠️ TIMING: Veo3 clips = 8 seconds. Generate EXACTLY ${expectedScenes} scenes for this chunk.
PROMPT FORMAT: [SHOT + CAMERA], [LENS]. [FULL CHARACTER DESC]. [ACTION]. [ENVIRONMENT]. [LIGHTING]. [COLOR]. Style: ${videoStyle}. (no subtitles, no text)

CHARACTER RULES: NEVER use just names. ALWAYS full appearance description every time.
${characterBlock}

SYNC: Each visual MUST match what narrator says at THAT timestamp.
${sceneBlueprintFromScript?.length ? `BLUEPRINT:\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 1500)}` : ''}`;

      const chunkTranscript = chunk.blocks.map((b: any) => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`).join("\n");

      // Build fallback scenes
      const cameraAngles = ["wide establishing shot", "medium shot", "close-up", "low-angle shot", "over-the-shoulder shot", "tracking shot"];
      const moods = ["dramático", "tenso", "cinematográfico", "misterioso", "épico", "emocional"];
      const sceneSpan = Math.max(5, chunkDuration / expectedScenes);
      const fallbackScenes = Array.from({ length: expectedScenes }).map((_, i) => {
        const st = +(chunk.startTime + i * sceneSpan).toFixed(1);
        const et = +Math.min(chunk.endTime, chunk.startTime + (i + 1) * sceneSpan).toFixed(1);
        const overlapping = chunk.blocks.filter((b: any) => b.start < et && b.end > st);
        const narrativeText = overlapping.map((b: any) => b.text).join(" ").trim() || "Continuação da narração.";
        const cameraAngle = cameraAngles[(i + chunk_index) % cameraAngles.length];
        const mood = moods[(i + chunk_index) % moods.length];
        return {
          sceneIndex: i + 1, sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(et - st))),
          startTime: st, endTime: et, narrativeText,
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

      let scenes = fallbackScenes;
      let fallbackUsed = true;

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "set_synced_scenes" } },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `TRANSCRIPTION (${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s):\n${chunkTranscript}\n\nGenerate EXACTLY ${expectedScenes} scenes (8s each). Style: ${videoStyle}. Language: ${language}.` },
            ],
          }),
        });

        if (resp.ok) {
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

          if (parsedScenes.length > 0) {
            fallbackUsed = false;
            scenes = parsedScenes.slice(0, expectedScenes).map((s: any, idx: number) => {
              const fb = fallbackScenes[Math.min(idx, fallbackScenes.length - 1)];
              const st = Number.isFinite(Number(s.startTime)) ? Number(s.startTime) : fb.startTime;
              const etRaw = Number.isFinite(Number(s.endTime)) ? Number(s.endTime) : fb.endTime;
              const et = etRaw > st ? etRaw : fb.endTime;
              return {
                ...fb, ...s, startTime: st, endTime: et,
                visualPrompt: s.visualPrompt?.trim() || fb.visualPrompt,
                charactersInScene: Array.isArray(s.charactersInScene) && s.charactersInScene.length > 0 ? s.charactersInScene : fb.charactersInScene,
                sceneDurationSeconds: Math.max(5, Math.min(10, Math.round(et - st))),
              };
            });
            while (scenes.length < expectedScenes) scenes.push(fallbackScenes[scenes.length]);
          }
        } else if (resp.status === 402) {
          return errResp("Créditos insuficientes.", 402);
        }
      } catch (err: any) {
        if (err?.message?.includes("Créditos")) return errResp("Créditos insuficientes.", 402);
        console.error(`Chunk ${chunk_index} generation error:`, err.message);
      }

      // Update job progress
      const pct = 30 + Math.round(((chunk_index + 1) / totalChunks) * 65);
      await sb.from("processing_jobs").update({
        progress: pct,
        current_step: `Cenas geradas (${chunk_index + 1}/${totalChunks})`,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      return jsonResp({
        scenes,
        chunk_index,
        fallbackUsed,
        progress: pct,
      });
    }

    // ═══ ACTION: finalize — post-process all scenes ═══
    if (action === "finalize") {
      const { job_id, all_scenes } = body;
      if (!job_id || !all_scenes) return errResp("job_id e all_scenes obrigatórios", 400);

      const { data: job } = await sb.from("processing_jobs")
        .select("result_data, input_data")
        .eq("id", job_id).single();
      if (!job) return errResp("Job não encontrado", 404);

      const resultData = job.result_data as any;
      const inputData = job.input_data as any;
      const audioDuration = resultData.transcription.audioDuration;
      const transcriptBlocks = resultData.transcription.blocks;
      const videoStyle = inputData.videoStyle;

      // Post-process
      const TRIGGER_FIX: Record<string, string> = {
        'gun': 'defensive stance', 'weapon': 'tactical equipment', 'knife': 'sharp tool',
        'blood': 'dark stain', 'dead': 'covered shape', 'corpse': 'white sheet form',
        'naked': 'draped in fabric', 'punch': 'aggressive motion', 'attack': 'confrontation',
      };
      const ANTI_TEXT = "(no subtitles, no text, no titles, no captions, no logos, no watermarks)";

      const sanitizedScenes = all_scenes
        .filter((s: any) => typeof s?.visualPrompt === "string" && s.visualPrompt.trim().length > 0)
        .map((scene: any) => {
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
        s.sceneDurationSeconds = Math.max(5, Math.min(10, Math.round(s.endTime - s.startTime)));
      }
      sanitizedScenes.forEach((s: any, i: number) => { s.sceneIndex = i + 1; });

      // Fill gaps
      const minimumRequiredScenes = Math.ceil(audioDuration / 8);
      const styleGuides: Record<string, string> = {
        'cinematográfico': 'Netflix/Disney premium.',
        'dark': 'Dark noir. Crushed blacks.',
      };
      const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || 'Cinematic premium.';

      const fallbackCharacters = (inputData.characters || []).slice(0, 5).map((c: any) => {
        const a = c.appearance || {}; const ff = c.facial_features || {};
        return { name: c.name || "Personagem", visualDescription: `${a.skin_color || 'pele média'}, ${a.hair_color || 'cabelo escuro'}`, action: "em cena", expression: "neutra" };
      });

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
              visualPrompt: `Cinematic wide shot: ${gapText.slice(0, 200)}. ${selectedStyleGuide} ${ANTI_TEXT}`,
              negativePrompt: "no subtitles", cameraAngle: "wide establishing shot",
              mood: "cinematográfico", charactersInScene: fallbackCharacters,
            });
          }
        }
      }

      if (sanitizedScenes.length === 0) return errResp("Nenhuma cena gerada.", 500);

      const finalResult = {
        ...resultData,
        scenes: sanitizedScenes,
        chunksData: undefined,
        metadata: {
          ...resultData.metadata,
          totalScenes: sanitizedScenes.length,
          minimumRequiredScenes,
          method: "frontend-orchestrated-v5",
        },
      };

      await sb.from("processing_jobs").update({
        status: "completed",
        progress: 100,
        current_step: "Concluído!",
        result_data: finalResult,
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      return jsonResp({ scenes: sanitizedScenes, metadata: finalResult.metadata });
    }

    return errResp("Ação desconhecida: " + action, 400);
  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(e.message || "Erro desconhecido", 500);
  }
});

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
