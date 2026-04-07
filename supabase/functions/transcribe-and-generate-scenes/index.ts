import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

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
    const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
    const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!GOOGLE_AI_API_KEY && !GOOGLE_AI_KEY && !LOVABLE_API_KEY) throw new Error("Nenhuma API key configurada.");

    // Helper: call Lovable AI Gateway (preferred) with Gemini direct fallback
    async function callAI(messages: {role: string; content: string}[], options: { tools?: any[]; tool_choice?: any; temperature?: number; max_tokens?: number } = {}): Promise<any> {
      const model = "google/gemini-2.5-flash";
      // Try Lovable Gateway first
      const gatewayKey = LOVABLE_API_KEY || GOOGLE_AI_API_KEY;
      if (gatewayKey) {
        try {
          const resp = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gatewayKey}` },
            body: JSON.stringify({
              model,
              messages,
              temperature: options.temperature ?? 0.7,
              max_completion_tokens: options.max_tokens || 16384,
              ...(options.tools ? { tools: options.tools, tool_choice: options.tool_choice || "auto" } : {}),
            }),
          });
          if (resp.ok) return await resp.json();
          const errText = await resp.text();
          console.warn(`Gateway failed (${resp.status}):`, errText.slice(0, 200));
          if (resp.status === 402) throw new Error("Créditos insuficientes no gateway.");
        } catch (e: any) {
          if (e.message?.includes("Créditos")) throw e;
          console.warn("Gateway error:", e.message);
        }
      }
      // Fallback: Gemini direct
      if (!GOOGLE_AI_KEY) throw new Error("Gateway indisponível e GOOGLE_AI_API_KEY não configurada.");
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: options.temperature ?? 0.7, ...(options.tools ? { responseMimeType: "application/json" } : {}) },
          ...(options.tools ? { tools: [{ functionDeclarations: options.tools.map((t: any) => t.function) }] } : {}),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini direct error: ${resp.status} - ${errText.slice(0, 200)}`);
      }
      const data = await resp.json();
      // Convert Gemini response to OpenAI-compatible format
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      if (part?.functionCall) {
        return { choices: [{ message: { tool_calls: [{ function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } }] } }] };
      }
      return { choices: [{ message: { content: part?.text || "" } }] };
    }

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
      const { audioUrl, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript, audioDurationSeconds } = body;
      if (!audioUrl) throw new Error("audioUrl obrigatório.");

      const cleanScript = (script || "").slice(0, 30000);
      const resolvedMime = audioMimeType || "audio/mp3";
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      const requestedAudioDuration = Number(audioDurationSeconds);
      const hasRequestedAudioDuration = Number.isFinite(requestedAudioDuration) && requestedAudioDuration > 0;

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

      // ── METHOD 2: Gemini transcription via Lovable AI Gateway (preferred) or direct Gemini ──
      if (!transcribeData && audioUrl) {
        const transcribePrompt = `You are a professional audio transcriber. Transcribe the audio precisely in its original language (${language || 'detect automatically'}).

OUTPUT FORMAT (strict JSON array):
[{"start": 0.0, "end": 3.5, "text": "First sentence here."}, ...]

RULES:
- Transcribe EVERY spoken word — do NOT skip or summarize
- Timestamps must be accurate per sentence
- Sequential, non-overlapping
- Cover the ENTIRE audio duration from start to finish
- Return ONLY the JSON array, no markdown, no explanation`;

        // Try Lovable AI Gateway with audio URL (multimodal)
        if (GOOGLE_AI_API_KEY) {
          try {
            console.log("Trying audio transcription via AI Gateway (multimodal)...");
            const gatewayResp = await fetch(GATEWAY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GOOGLE_AI_API_KEY}` },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{
                  role: "user",
                  content: [
                    { type: "text", text: transcribePrompt },
                    { type: "image_url", image_url: { url: audioUrl } },
                  ],
                }],
                temperature: 0.1,
                max_completion_tokens: 32768,
              }),
            });

            if (gatewayResp.ok) {
              const gData = await gatewayResp.json();
              const text = gData.choices?.[0]?.message?.content || "";
              if (text.includes('"start"') && text.includes('"end"')) {
                transcribeData = { choices: [{ message: { content: text } }] };
                console.log("AI Gateway audio transcription successful");
              } else {
                console.warn("AI Gateway returned non-transcript content, trying fallback...");
              }
            } else {
              const errText = await gatewayResp.text();
              console.warn("AI Gateway audio transcription failed:", gatewayResp.status, errText.slice(0, 300));
            }
          } catch (e: any) {
            console.warn("AI Gateway audio transcription error:", e.message);
          }
        }

        // Fallback: direct Gemini with Files API for large audio
        if (!transcribeData && GOOGLE_AI_KEY && audioUrl) {
          try {
            console.log("Trying direct Gemini transcription...");
            const audioFetchCtrl = new AbortController();
            const audioTimeout = setTimeout(() => audioFetchCtrl.abort(), 60000);
            const audioResp = await fetch(audioUrl, { signal: audioFetchCtrl.signal });
            clearTimeout(audioTimeout);
            if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);

            const audioBuffer = await audioResp.arrayBuffer();
            const audioBytes = new Uint8Array(audioBuffer);
            const fileSizeMB = audioBytes.length / 1024 / 1024;
            console.log(`Audio downloaded: ${fileSizeMB.toFixed(1)}MB for Gemini`);

            let geminiRequestBody: any;

            if (audioBytes.length > 20 * 1024 * 1024) {
              console.log("Using Google AI Files API for large audio...");
              const startUploadResp = await fetch(
                `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GOOGLE_AI_KEY}`,
                {
                  method: "POST",
                  headers: {
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": String(audioBytes.length),
                    "X-Goog-Upload-Header-Content-Type": resolvedMime,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ file: { display_name: "audio_transcription" } }),
                }
              );
              if (!startUploadResp.ok) throw new Error(`Files API start failed: ${startUploadResp.status}`);

              const uploadUrl = startUploadResp.headers.get("X-Goog-Upload-URL");
              if (!uploadUrl) throw new Error("No upload URL returned");

              const uploadResp = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                  "Content-Length": String(audioBytes.length),
                  "X-Goog-Upload-Offset": "0",
                  "X-Goog-Upload-Command": "upload, finalize",
                },
                body: audioBytes,
              });
              if (!uploadResp.ok) throw new Error(`Files API upload failed: ${uploadResp.status}`);

              const fileInfo = await uploadResp.json();
              const fileUri = fileInfo.file?.uri;
              if (!fileUri) throw new Error("No file URI returned");
              console.log(`File uploaded to Files API: ${fileUri}`);

              const fileName = fileInfo.file?.name;
              if (fileName) {
                for (let attempt = 0; attempt < 12; attempt++) {
                  const statusResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GOOGLE_AI_KEY}`);
                  if (statusResp.ok) {
                    const statusData = await statusResp.json();
                    if (statusData.state === "ACTIVE") { console.log("File is ACTIVE"); break; }
                    console.log(`File state: ${statusData.state}, waiting...`);
                  }
                  await new Promise(r => setTimeout(r, 5000));
                }
              }

              geminiRequestBody = {
                contents: [{ parts: [{ text: transcribePrompt }, { fileData: { mimeType: resolvedMime, fileUri } }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
              };
            } else {
              let base64Audio = "";
              const CHUNK_SIZE = 8192;
              for (let i = 0; i < audioBytes.length; i += CHUNK_SIZE) {
                base64Audio += String.fromCharCode(...audioBytes.subarray(i, i + CHUNK_SIZE));
              }
              base64Audio = btoa(base64Audio);

              geminiRequestBody = {
                contents: [{ parts: [{ text: transcribePrompt }, { inlineData: { mimeType: resolvedMime, data: base64Audio } }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
              };
            }

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_KEY}`;
            const geminiCtrl = new AbortController();
            const geminiTimeout = setTimeout(() => geminiCtrl.abort(), 180000);
            const geminiResp = await fetch(geminiUrl, {
              method: "POST", headers: { "Content-Type": "application/json" },
              signal: geminiCtrl.signal, body: JSON.stringify(geminiRequestBody),
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
          } catch (e: any) {
            console.warn("Gemini transcription error:", e.message);
          }
        }
      }

      // ── METHOD 3: Script-based fallback via Gemini direct (no real audio timestamps) ──
      // ── METHOD 3: Script-based fallback via AI Gateway ──
      if (!transcribeData) {
        if (!cleanScript.trim()) throw new Error("Transcrição falhou e nenhum roteiro disponível.");
        console.log("Using script-based fallback transcription via AI Gateway");
        const aiResult = await callAI([
          { role: "user", content: `Convert narration script to timestamps in ${language || 'Portuguese'}. Return ONLY a JSON array: [{"start":0.0,"end":3.5,"text":"..."}].${hasRequestedAudioDuration ? ` The full timeline MUST cover exactly ${requestedAudioDuration.toFixed(1)} seconds from start to finish.` : ' Use natural pacing around 150 wpm.'}\n\nSCRIPT:\n${cleanScript}` },
        ], { temperature: 0.1 });
        const text = aiResult.choices?.[0]?.message?.content || "";
        transcribeData = { choices: [{ message: { content: text } }] };
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

      const transcriptDuration = Number(transcriptBlocks[transcriptBlocks.length - 1].end) || 0;
      const shouldNormalizeToRequestedDuration = hasRequestedAudioDuration && (
        transcriptDuration <= 0 ||
        Math.abs(requestedAudioDuration - transcriptDuration) > Math.max(12, requestedAudioDuration * 0.08)
      );

      if (shouldNormalizeToRequestedDuration) {
        transcriptBlocks = normalizeTranscriptBlocksToDuration(transcriptBlocks, requestedAudioDuration);
      }

      const audioDuration = shouldNormalizeToRequestedDuration ? requestedAudioDuration : transcriptDuration;
      const fullText = transcriptBlocks.map((b: any) => b.text).join(" ");

      const CHUNK_SECONDS = audioDuration > 600 ? 90 : 120;
      const chunks = buildTranscriptChunks(transcriptBlocks, audioDuration, CHUNK_SECONDS);

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
          transcription: {
            fullText,
            wordCount: fullText.split(/\s+/).filter(Boolean).length,
            audioDuration,
            blocks: transcriptBlocks,
          },
          chunks: chunks.map((c, i) => ({ index: i, startTime: c.startTime, endTime: c.endTime, blockCount: c.blocks.length })),
          chunksData: chunks,
          scenes: [],
          metadata: {
            totalChunks: chunks.length,
            videoStyle,
            audioDuration,
            targetSceneSeconds: 8,
            transcriptBlocks: transcriptBlocks.length,
          },
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
      const totalChunks = chunksData.length;
      const { videoStyle, customStyleNotes, referenceImageUrls, characters, language, sceneBlueprintFromScript } = inputData;

      const TARGET_SCENE_SECONDS = 8;
      const sceneWindows = buildSceneWindows(chunk.blocks || [], chunk.startTime, chunk.endTime, TARGET_SCENE_SECONDS);
      const expectedScenes = sceneWindows.length;

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
          action: "em cena",
          expression: "neutra",
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

      const userStyleBlock = customStyleNotes ? `\n\n🎨 CREATOR'S VISUAL STYLE DESCRIPTION (HIGHEST PRIORITY — OVERRIDE EVERYTHING ELSE):\n"${customStyleNotes}"\nYou MUST follow these instructions literally. Every visualPrompt MUST start with this style description verbatim before any scene details.` : '';
      
      const systemPrompt = `You are a VISUAL DIRECTOR creating scene prompts from narrated audio.

═══ ART STYLE (MANDATORY IN EVERY PROMPT) ═══
Base style: ${selectedStyleGuide}
${userStyleBlock}${refImgContext}

CRITICAL: Every single visualPrompt MUST begin with the art style description. Example:
"${customStyleNotes || selectedStyleGuide} — [then scene details...]"

CRITICAL SYNCHRONIZATION RULES:
- Create EXACTLY one scene for each provided time window
- Each scene MUST illustrate ONLY what is spoken in that exact time window
- NEVER merge windows, skip windows, or extend a scene beyond its assigned timestamps
- Preserve the same ordering as the input windows
- If the narration changes, the visual must change with it
- visualPrompt must be specific to the narration, never generic filler
- Every prompt must end with: (no subtitles, no text, no titles, no captions, no logos, no watermarks)

PROMPT FORMAT: [ART STYLE FIRST], [SHOT + CAMERA], [LENS]. [FULL CHARACTER DESC]. [ACTION matching narration]. [ENVIRONMENT matching narration]. [LIGHTING]. [COLOR]. (no subtitles, no text)

CHARACTER RULES: NEVER use just names. ALWAYS full appearance description every time.
${characterBlock}

SYNC: Each visual MUST match what narrator says at THAT timestamp.
${sceneBlueprintFromScript?.length ? `BLUEPRINT:\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 1500)}` : ''}`;

      const chunkTimeline = sceneWindows
        .map((window) => `[SCENE ${window.index}] [${window.startTime.toFixed(1)}s-${window.endTime.toFixed(1)}s] ${window.text}`)
        .join("\n");

      const fallbackScenes = sceneWindows.map((window, i) =>
        buildFallbackScene(window, i + 1, chunk_index + i, fallbackCharacterText, fallbackCharacters, videoStyle)
      );

      let scenes = fallbackScenes;
      let fallbackUsed = true;

      try {
        // Use Lovable AI Gateway (with Gemini direct fallback via callAI)
        const userPrompt = `${systemPrompt}\n\nAUDIO CHUNK ${chunk_index + 1}/${totalChunks}\n\nTIME WINDOWS:\n${chunkTimeline}\n\nReturn EXACTLY ${expectedScenes} scenes in the SAME order as the windows above. Keep timestamps aligned to each window.\n\nRespond with a JSON object: {"scenes": [...]}`;
        
        const aiResult = await callAI(
          [{ role: "user", content: userPrompt }],
          {
            temperature: 0.7,
            max_tokens: 16384,
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "set_synced_scenes" } },
          }
        );

        let parsedScenes: any[] = [];
        const choice = aiResult.choices?.[0]?.message;

        // Try tool_calls (OpenAI format from gateway)
        if (choice?.tool_calls?.[0]?.function?.arguments) {
          try {
            const args = JSON.parse(choice.tool_calls[0].function.arguments);
            parsedScenes = Array.isArray(args?.scenes) ? args.scenes : [];
          } catch {}
        }

        // Fallback: try content as JSON
        if (parsedScenes.length === 0 && choice?.content) {
          try {
            const parsed = JSON.parse(choice.content);
            parsedScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : (Array.isArray(parsed) ? parsed : []);
          } catch {
            const text = choice.content;
            const arrStart = text.indexOf('[');
            const arrEnd = text.lastIndexOf(']');
            if (arrStart !== -1 && arrEnd > arrStart) {
              try { parsedScenes = JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch {}
            }
          }
        }

        if (parsedScenes.length > 0) {
          fallbackUsed = parsedScenes.length !== expectedScenes;
          scenes = sceneWindows.map((window, idx) =>
            coerceSceneToWindow(parsedScenes[idx], window, fallbackScenes[idx])
          );
        }
      } catch (err: any) {
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
        expectedScenes,
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
      const audioDuration = Number(resultData.transcription.audioDuration) || 0;
      const transcriptBlocks = Array.isArray(resultData.transcription.blocks) ? resultData.transcription.blocks : [];
      const videoStyle = inputData.videoStyle;

      const TRIGGER_FIX: Record<string, string> = {
        'gun': 'defensive stance', 'weapon': 'tactical equipment', 'knife': 'sharp tool',
        'blood': 'dark stain', 'dead': 'covered shape', 'corpse': 'white sheet form',
        'naked': 'draped in fabric', 'punch': 'aggressive motion', 'attack': 'confrontation',
      };
      const ANTI_TEXT = "(no subtitles, no text, no titles, no captions, no logos, no watermarks)";

      const normalizedSourceScenes = (Array.isArray(all_scenes) ? all_scenes : [])
        .filter((s: any) => typeof s?.visualPrompt === "string" && s.visualPrompt.trim().length > 0)
        .map((scene: any) => sanitizeScene(scene, ANTI_TEXT, TRIGGER_FIX))
        .map((scene: any) => {
          const start = Number(scene.startTime) || 0;
          const end = Number(scene.endTime) || start + 8;
          return {
            ...scene,
            startTime: start,
            endTime: end > start ? end : start + 8,
            sceneDurationSeconds: +Math.max(0.1, end > start ? end - start : 8).toFixed(1),
          };
        })
        .sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0));

      const timelineWindows = buildSceneWindows(transcriptBlocks, 0, audioDuration, 8);
      const fallbackCharacters = (inputData.characters || []).slice(0, 5).map((c: any) => {
        const a = c.appearance || {}; const ff = c.facial_features || {};
        return {
          name: c.name || "Personagem",
          visualDescription: `${a.skin_color || 'pele média'}, ${a.hair_color || 'cabelo escuro'} ${a.hair_style || 'curto'}, olhos ${ff.eye_color || a.eye_color || 'escuros'}`,
          action: "em cena",
          expression: "neutra",
        };
      });
      const fallbackCharacterText = fallbackCharacters.map((c: any) => `${c.name}: ${c.visualDescription}`).join(" | ");

      const usedSceneIndexes = new Set<number>();
      const alignedScenes = timelineWindows.map((window, idx) => {
        let bestSceneIndex = -1;
        let bestOverlap = 0;

        for (let i = 0; i < normalizedSourceScenes.length; i++) {
          if (usedSceneIndexes.has(i)) continue;
          const candidate = normalizedSourceScenes[i];
          const overlap = overlapSeconds(window.startTime, window.endTime, candidate.startTime, candidate.endTime);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestSceneIndex = i;
          }
        }

        const fallbackScene = buildFallbackScene(window, idx + 1, idx, fallbackCharacterText, fallbackCharacters, videoStyle);
        const minAcceptableOverlap = Math.max(1, (window.endTime - window.startTime) * 0.35);

        if (bestSceneIndex !== -1 && bestOverlap >= minAcceptableOverlap) {
          usedSceneIndexes.add(bestSceneIndex);
          return sanitizeScene(
            coerceSceneToWindow(normalizedSourceScenes[bestSceneIndex], window, fallbackScene),
            ANTI_TEXT,
            TRIGGER_FIX,
          );
        }

        return sanitizeScene(fallbackScene, ANTI_TEXT, TRIGGER_FIX);
      });

      if (alignedScenes.length === 0) return errResp("Nenhuma cena gerada.", 500);

      alignedScenes.forEach((scene: any, index: number) => {
        scene.sceneIndex = index + 1;
      });

      const finalResult = {
        ...resultData,
        scenes: alignedScenes,
        chunksData: undefined,
        metadata: {
          ...resultData.metadata,
          totalScenes: alignedScenes.length,
          minimumRequiredScenes: timelineWindows.length,
          coveredDuration: audioDuration,
          method: "timeline-windowed-v6",
          targetSceneSeconds: 8,
        },
      };

      await sb.from("processing_jobs").update({
        status: "completed",
        progress: 100,
        current_step: "Concluído!",
        result_data: finalResult,
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      return jsonResp({ scenes: alignedScenes, metadata: finalResult.metadata });
    }

    return errResp("Ação desconhecida: " + action, 400);
  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(e.message || "Erro desconhecido", 500);
  }
});

// ═══ HELPERS ═══
type TranscriptChunk = { blocks: any[]; startTime: number; endTime: number };
type SceneWindow = { index: number; startTime: number; endTime: number; text: string; summary: string; blocks: any[] };

function buildTranscriptChunks(blocks: any[], audioDuration: number, chunkSeconds: number): TranscriptChunk[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  if (audioDuration <= chunkSeconds) {
    chunks.push({ blocks, startTime: 0, endTime: audioDuration });
    return chunks;
  }

  let currentChunkBlocks: any[] = [];
  let chunkStart = 0;

  for (const block of blocks) {
    if (currentChunkBlocks.length > 0 && block.start - chunkStart >= chunkSeconds) {
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

  return chunks;
}

function buildSceneWindows(blocks: any[], rangeStart: number, rangeEnd: number, targetSeconds: number): SceneWindow[] {
  const windows: SceneWindow[] = [];
  const safeEnd = Math.max(rangeEnd, rangeStart + 0.1);
  let cursor = rangeStart;
  let index = 1;

  while (cursor < safeEnd - 0.05) {
    const windowEnd = Math.min(cursor + targetSeconds, safeEnd);
    const overlapping = (blocks || []).filter((b: any) => Number(b.start) < windowEnd && Number(b.end) > cursor);
    const text = overlapping.map((b: any) => b.text).join(" ").replace(/\s+/g, " ").trim() || "Continuação da narração.";

    windows.push({
      index,
      startTime: +cursor.toFixed(1),
      endTime: +windowEnd.toFixed(1),
      text,
      summary: summarizeText(text, 18),
      blocks: overlapping,
    });

    cursor = windowEnd;
    index += 1;
  }

  if (windows.length === 0) {
    windows.push({
      index: 1,
      startTime: +rangeStart.toFixed(1),
      endTime: +safeEnd.toFixed(1),
      text: "Continuação da narração.",
      summary: "Continuação da narração.",
      blocks: [],
    });
  }

  return windows;
}

function summarizeText(text: string, words = 18): string {
  return text.split(/\s+/).filter(Boolean).slice(0, words).join(" ");
}

function buildFallbackScene(
  window: SceneWindow,
  sceneIndex: number,
  variationSeed: number,
  fallbackCharacterText: string,
  fallbackCharacters: any[],
  videoStyle: string,
) {
  const cameraAngles = ["wide establishing shot", "medium shot", "close-up", "low-angle shot", "over-the-shoulder shot", "tracking shot"];
  const moods = ["dramático", "tenso", "cinematográfico", "misterioso", "épico", "emocional"];
  const cameraAngle = cameraAngles[Math.abs(variationSeed) % cameraAngles.length];
  const mood = moods[Math.abs(variationSeed) % moods.length];
  const duration = +(window.endTime - window.startTime).toFixed(1);
  const narration = window.text || "Continuação da narração.";

  return {
    sceneIndex,
    sceneDurationSeconds: duration,
    startTime: window.startTime,
    endTime: window.endTime,
    narrativeText: narration,
    narrativeSummary: window.summary || summarizeText(narration, 18),
    visualPrompt: `${cameraAngle}, 35mm cinematic. Visualize exactly what is narrated here: ${narration}. ${fallbackCharacterText ? `Characters: ${fallbackCharacterText}. ` : ''}Rich environmental detail, cinematic lighting, action synchronized to narration. Style: ${videoStyle}. (no subtitles, no text, no titles, no captions, no logos, no watermarks)`,
    negativePrompt: "no subtitles, no text, no titles, no captions, no logos, no watermarks",
    cameraAngle,
    lensSpec: "35mm",
    lightingSetup: "cinematic soft key light",
    colorGrading: "teal-orange",
    audioDirection: `Sync exactly to narration from ${window.startTime.toFixed(1)}s to ${window.endTime.toFixed(1)}s.`,
    mood,
    emotionalBeat: "narrative progression",
    charactersInScene: fallbackCharacters,
    environmentDetails: "Ambiente coerente com a narração deste trecho",
    transitionNote: "Corte limpo",
  };
}

function coerceSceneToWindow(scene: any, window: SceneWindow, fallbackScene: any) {
  const duration = +(window.endTime - window.startTime).toFixed(1);
  return {
    ...fallbackScene,
    ...(scene || {}),
    sceneIndex: fallbackScene.sceneIndex,
    startTime: window.startTime,
    endTime: window.endTime,
    sceneDurationSeconds: duration,
    narrativeText: window.text || fallbackScene.narrativeText,
    narrativeSummary: scene?.narrativeSummary?.trim?.() || window.summary || fallbackScene.narrativeSummary,
    visualPrompt: scene?.visualPrompt?.trim?.() || fallbackScene.visualPrompt,
    negativePrompt: scene?.negativePrompt?.trim?.() || fallbackScene.negativePrompt,
    cameraAngle: scene?.cameraAngle?.trim?.() || fallbackScene.cameraAngle,
    lensSpec: scene?.lensSpec?.trim?.() || fallbackScene.lensSpec,
    lightingSetup: scene?.lightingSetup?.trim?.() || fallbackScene.lightingSetup,
    colorGrading: scene?.colorGrading?.trim?.() || fallbackScene.colorGrading,
    audioDirection: scene?.audioDirection?.trim?.() || fallbackScene.audioDirection,
    mood: scene?.mood?.trim?.() || fallbackScene.mood,
    emotionalBeat: scene?.emotionalBeat?.trim?.() || fallbackScene.emotionalBeat,
    charactersInScene: Array.isArray(scene?.charactersInScene) && scene.charactersInScene.length > 0
      ? scene.charactersInScene
      : fallbackScene.charactersInScene,
    environmentDetails: scene?.environmentDetails?.trim?.() || fallbackScene.environmentDetails,
    transitionNote: scene?.transitionNote?.trim?.() || fallbackScene.transitionNote,
  };
}

function overlapSeconds(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function sanitizeScene(scene: any, antiText: string, triggerFix: Record<string, string>) {
  const sanitized = { ...scene };
  let prompt = typeof sanitized.visualPrompt === 'string' ? sanitized.visualPrompt.trim() : '';

  for (const [triggerWord, replacement] of Object.entries(triggerFix)) {
    prompt = prompt.replace(new RegExp(`\\b${triggerWord}\\b`, 'gi'), replacement);
  }

  prompt = prompt.replace(/^(Scene|Cena|Prompt)\s*\d+\s*[:—-]\s*/i, '').trim();
  if (!/no subtitles|no text|no titles|no captions|no logos|no watermarks/i.test(prompt)) {
    prompt = `${prompt} ${antiText}`.trim();
  }

  sanitized.visualPrompt = prompt || antiText;
  sanitized.negativePrompt = sanitized.negativePrompt || "no subtitles, no text, no logos, no watermarks";
  return sanitized;
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

function normalizeTranscriptBlocksToDuration(blocks: any[], targetDuration: number) {
  if (!Array.isArray(blocks) || blocks.length === 0 || !Number.isFinite(targetDuration) || targetDuration <= 0) {
    return blocks;
  }

  const currentDuration = Number(blocks[blocks.length - 1]?.end) || 0;
  if (currentDuration <= 0) {
    const segmentDuration = targetDuration / blocks.length;
    return blocks.map((block: any, index: number) => ({
      ...block,
      start: +(index * segmentDuration).toFixed(1),
      end: +Math.min(targetDuration, (index + 1) * segmentDuration).toFixed(1),
    }));
  }

  const scale = targetDuration / currentDuration;
  return blocks.map((block: any, index: number) => {
    const scaledStart = +(Math.max(0, (Number(block.start) || 0) * scale)).toFixed(1);
    const rawEnd = (Number(block.end) || Number(block.start) || 0) * scale;
    const scaledEnd = +Math.min(targetDuration, Math.max(rawEnd, scaledStart + 0.1)).toFixed(1);

    return {
      ...block,
      start: scaledStart,
      end: index === blocks.length - 1 ? +targetDuration.toFixed(1) : scaledEnd,
    };
  });
}
