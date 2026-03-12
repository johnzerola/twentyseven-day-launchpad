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
    const { audioBase64, audioMimeType, script, videoStyle, customStyleNotes, characters, language, niche, sceneBlueprintFromScript } = body;

    if (!audioBase64) throw new Error("Áudio obrigatório.");
    const cleanScript = (script || "").slice(0, 5000);

    console.log("transcribe-and-generate-scenes: starting pipeline");

    // ========== PHASE 1: Transcribe with Gemini Flash ==========
    console.log("Phase 1: Transcribing audio with Gemini...");

    const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a professional audio transcriber. Transcribe the audio precisely in its original language (${language || 'detect automatically'}).

OUTPUT FORMAT (strict JSON array):
[
  {"start": 0.0, "end": 3.5, "text": "First sentence here."},
  {"start": 3.6, "end": 7.2, "text": "Second sentence here."},
  ...
]

RULES:
- Transcribe EVERY spoken word
- Estimate timestamps as accurately as possible per sentence
- Each entry should be one complete sentence or natural phrase
- Start times should be sequential and non-overlapping
- Return ONLY the JSON array, no other text`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio with timestamps per sentence. Return ONLY a JSON array." },
              {
                type: "image_url",
                image_url: { url: `data:${audioMimeType};base64,${audioBase64}` }
              }
            ]
          }
        ],
      }),
    });

    if (!transcribeResponse.ok) {
      const t = await transcribeResponse.text();
      console.error("Transcription error:", transcribeResponse.status, t.slice(0, 300));
      if (transcribeResponse.status === 429) throw new Error("Rate limit. Tente novamente em alguns segundos.");
      if (transcribeResponse.status === 402) throw new Error("Créditos insuficientes. Adicione créditos ao workspace.");
      throw new Error(`Erro na transcrição: ${transcribeResponse.status}`);
    }

    const transcribeData = await transcribeResponse.json();
    let transcriptText = transcribeData.choices?.[0]?.message?.content || "";

    // Parse transcript JSON
    const jsonMatch = transcriptText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Falha ao transcrever áudio. Tente novamente.");

    let transcriptBlocks: { start: number; end: number; text: string }[];
    try {
      transcriptBlocks = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Erro ao processar transcrição. Tente novamente.");
    }

    if (!transcriptBlocks.length) throw new Error("Áudio sem fala detectável.");

    const audioDuration = transcriptBlocks[transcriptBlocks.length - 1].end;
    const fullText = transcriptBlocks.map(b => b.text).join(" ");
    console.log(`Transcribed: ${transcriptBlocks.length} blocks, ${audioDuration.toFixed(1)}s, ${fullText.length} chars`);

    // ========== PHASE 2: Fetch knowledge base ==========
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(8);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}: ${r.prompt_template.slice(0, 200)}`
    ).join("\n").slice(0, 2000);

    // ========== PHASE 3: Build context ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney premium. ARRI ALEXA 65, Cooke Anamorphic. ACES color, Kodak Vision3. Shallow DOF f/1.4-2.8. Volumetric rays.',
      '2d': 'Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector, parallax depth, smooth 24fps.',
      '3d': 'Pixar/DreamWorks 3D. Subsurface scattering, PBR materials, global illumination, 8K textures.',
      'anime': 'Ufotable/MAPPA. Sakuga poses, Shinkai backgrounds, cel-shading, rim lighting.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light.',
      'dark': 'Dark noir. Crushed blacks, neon accents. Blade Runner 2049 meets Se7en.',
      'comic': 'Premium graphic novel. Bold ink, halftone, dynamic panels, saturated colors.',
      'wojak': 'Wojak/meme style. Simple drawn faces with strong emotional expressions. Internet culture aesthetic.',
      'stickmen': 'Stick figure style. Minimalist black line art on white/simple backgrounds. Humor through simplicity.',
      'whiteboard': 'Whiteboard animation. Hand-drawn sketches being drawn in real-time. Educational, clean.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];
    const extraStyle = customStyleNotes ? `\nUSER STYLE INSTRUCTIONS: ${customStyleNotes}` : '';

    const characterBlock = characters?.length > 0
      ? `\nCHARACTERS (include in scenes where they appear):\n${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {};
          const cl = c.clothing || {};
          const ff = c.facial_features || {};
          return `"${c.name}": ${c.gender||'?'}, ${c.age||'?'}y, ${c.role||'character'}, ${a.body_type||'average'} build, ${a.skin_color||'medium'} skin, ${a.hair_color||'dark'} ${a.hair_style||'short'} hair, ${a.eye_color||'brown'} eyes, ${ff.face_shape||'oval'} face, wearing ${cl.shirt||'casual'} and ${cl.pants||'jeans'}, ${cl.shoes||'sneakers'}. Personality: ${(c.personality||[]).join(', ')}`;
        }).join('\n')}\n`
      : '';

    const transcriptForPrompt = transcriptBlocks
      .map(b => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`)
      .join("\n");

    // ========== PHASE 4: Generate scenes with Gemini Pro ==========
    console.log("Phase 3: Generating synced scenes with Gemini Pro...");

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
                  narrativeText: { type: "string", description: "The exact narration text during this scene" },
                  narrativeSummary: { type: "string", description: "Brief summary of what's being said" },
                  visualPrompt: { type: "string", description: "Detailed visual prompt for image/video generation" },
                  negativePrompt: { type: "string" },
                  cameraAngle: { type: "string" },
                  lensSpec: { type: "string" },
                  lightingSetup: { type: "string" },
                  audioDirection: { type: "string" },
                  mood: { type: "string" },
                  emotionalBeat: { type: "string" },
                  charactersInScene: { type: "array", items: { type: "string" } },
                  transitionNote: { type: "string" },
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

    const systemPrompt = `You are a WORLD-CLASS VISUAL DIRECTOR creating Netflix-grade video scenes from narrated audio.
You have the FULL TRANSCRIPTION with exact timestamps. Your job is to create visual scenes that PERFECTLY MATCH what is being said at each moment.

CRITICAL TIMING RULES:
- Each scene MUST be between 5 and 10 seconds long
- Cover the ENTIRE audio from 0.0s to ${audioDuration.toFixed(1)}s — NO GAPS
- startTime/endTime MUST align with the transcript timestamps
- You decide the optimal duration for each scene based on narrative pacing

VISUAL CONTENT RULES:
- EVERY visual prompt MUST directly illustrate what the narrator is saying at THAT EXACT MOMENT
- Create VARIETY: if narrator talks about pyramids, show different angles/perspectives across scenes (aerial drone, close-up stones, wide landscape, person studying them, documentary screen, etc.)
- NEVER repeat the same visual concept in consecutive scenes
- End every prompt with: (no subtitles, no text, no titles, no captions, no logos, no watermarks)
- Use 5+ different camera angles — never repeat consecutively

VISUAL STYLE: ${selectedStyleGuide}${extraStyle}
${characterBlock}
KNOWLEDGE BASE:
${knowledgeBlock}

PROMPT FORMULA: [Cinematography/Camera] + [Subject matching narration] + [Action/Movement] + [Environment/Setting] + [Lighting/Mood] + [Style details] + anti-text block
Quality: masterpiece, award-winning, 8K UHD

${sceneBlueprintFromScript?.length ? `SCRIPT BLUEPRINT (use as reference for scene intent):\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 2000)}` : ''}`;

    // Split into chunks if audio > 120s to avoid token limits
    const CHUNK_SECONDS = 120;
    const chunks: { blocks: typeof transcriptBlocks; startTime: number; endTime: number }[] = [];

    if (audioDuration <= CHUNK_SECONDS) {
      chunks.push({ blocks: transcriptBlocks, startTime: 0, endTime: audioDuration });
    } else {
      let currentChunkBlocks: typeof transcriptBlocks = [];
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

    console.log(`Processing ${chunks.length} chunk(s) for ${audioDuration.toFixed(1)}s audio`);

    // Process chunks in parallel
    const chunkResults = await Promise.all(chunks.map(async (chunk, ci) => {
      const chunkTranscript = chunk.blocks
        .map(b => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`)
        .join("\n");

      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(2, Math.ceil(chunkDuration / 8));

      console.log(`Chunk ${ci + 1}: ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s, ~${expectedScenes} scenes`);

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            tools: [toolDef],
            tool_choice: { type: "function", function: { name: "set_synced_scenes" } },
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `TRANSCRIPTION WITH TIMESTAMPS (${chunk.startTime.toFixed(1)}s to ${chunk.endTime.toFixed(1)}s):

${chunkTranscript}

${cleanScript ? `FULL SCRIPT CONTEXT (for thematic reference):\n${cleanScript.slice(0, 2000)}` : ''}

Generate ~${expectedScenes} scenes covering this ENTIRE segment. Each scene 5-10s. Visual style: ${videoStyle}. Language context: ${language}.
The visual content of each scene MUST match what is being narrated at that timestamp.`
              }
            ],
          }),
        });

        if (!resp.ok) {
          const t = await resp.text();
          console.error(`Chunk ${ci + 1} error: ${resp.status}`, t.slice(0, 200));
          if (resp.status === 429) throw new Error("Rate limit. Tente novamente.");
          if (resp.status === 402) throw new Error("Créditos insuficientes.");
          return [];
        }

        const data = await resp.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          console.log(`Chunk ${ci + 1}: ${parsed.scenes?.length || 0} scenes`);
          return parsed.scenes || [];
        }
        return [];
      } catch (err: any) {
        console.error(`Chunk ${ci + 1} failed:`, err.message);
        throw err; // Propagate rate limit / credit errors
      }
    }));

    // ========== PHASE 5: Merge and validate ==========
    const allScenes = chunkResults.flat();
    allScenes.sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0));

    // Enforce duration bounds and re-index
    for (const s of allScenes) {
      const dur = (s.endTime || 0) - (s.startTime || 0);
      s.sceneDurationSeconds = Math.max(5, Math.min(10, Math.round(dur)));
    }
    allScenes.forEach((s: any, i: number) => { s.sceneIndex = i + 1; });

    console.log(`DONE: ${allScenes.length} scenes, ${audioDuration.toFixed(1)}s audio`);

    return new Response(JSON.stringify({
      transcription: {
        fullText,
        wordCount: fullText.split(/\s+/).length,
        audioDuration,
        blocks: transcriptBlocks,
      },
      scenes: allScenes,
      metadata: {
        totalScenes: allScenes.length,
        totalDuration: audioDuration,
        videoStyle,
        customStyleNotes: !!customStyleNotes,
        charactersCount: characters?.length || 0,
        chunksProcessed: chunks.length,
        method: "gemini-transcription-synced",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(e.message || "Erro desconhecido", e.message?.includes('402') ? 402 : e.message?.includes('429') ? 429 : 500);
  }
});
