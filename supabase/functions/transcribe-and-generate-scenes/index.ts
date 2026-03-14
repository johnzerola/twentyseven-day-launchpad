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
    const { audioBase64, audioMimeType, script, videoStyle, customStyleNotes, referenceImageUrls, characters, language, niche, sceneBlueprintFromScript } = body;

    if (!audioBase64) throw new Error("Áudio obrigatório.");
    const cleanScript = (script || "").slice(0, 5000);

    console.log("transcribe-and-generate-scenes: starting pipeline");

    // ========== PHASE 1: Transcribe with Gemini Flash ==========
    console.log("Phase 1: Transcribing audio...");

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
  {"start": 3.6, "end": 7.2, "text": "Second sentence here."}
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
    console.log("Raw transcription (first 500):", transcriptText.slice(0, 500));

    // Parse transcript JSON
    let transcriptBlocks: { start: number; end: number; text: string }[] = [];
    
    // Strategy 1: Extract JSON array
    const jsonMatch = transcriptText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try { transcriptBlocks = JSON.parse(jsonMatch[0]); } catch (e) {
        console.error("JSON parse failed:", e);
      }
    }

    // Strategy 2: Clean markdown then parse
    if (!transcriptBlocks.length && transcriptText.trim()) {
      const cleaned = transcriptText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) transcriptBlocks = parsed;
      } catch {
        // Strategy 3: Split plain text
        console.log("Falling back to plain text splitting");
        const sentences = transcriptText.replace(/```[\s\S]*?```/g, '').trim()
          .split(/[.!?]+/).filter(s => s.trim().length > 3);
        if (sentences.length > 0) {
          const estDuration = 60;
          const perSentence = estDuration / sentences.length;
          transcriptBlocks = sentences.map((s, i) => ({
            start: +(i * perSentence).toFixed(1),
            end: +((i + 1) * perSentence).toFixed(1),
            text: s.trim(),
          }));
        }
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
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];
    const extraStyle = customStyleNotes ? `\nUSER STYLE INSTRUCTIONS: ${customStyleNotes}` : '';
    const refImgContext = referenceImageUrls?.length ? `\nREFERENCE IMAGES: ${referenceImageUrls.length} reference images uploaded. Match that exact art style, color palette, and character design.` : '';

    const characterBlock = characters?.length > 0
      ? `\nCHARACTERS:\n${characters.slice(0, 5).map((c: any) => {
          const a = c.appearance || {};
          const cl = c.clothing || {};
          const ff = c.facial_features || {};
          return `"${c.name}": ${c.gender||'?'}, ${c.age||'?'}y, ${c.role||'character'}, ${a.body_type||'average'} build, ${a.skin_color||'medium'} skin, ${a.hair_color||'dark'} ${a.hair_style||'short'} hair, wearing ${cl.shirt||'casual'} and ${cl.pants||'jeans'}`;
        }).join('\n')}\n`
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
                },
                required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "narrativeText", "visualPrompt", "cameraAngle", "mood"],
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
You have a TRANSCRIPTION with timestamps. Create visual scenes that MATCH what is being said.

🎨 MANDATORY ART STYLE:
${selectedStyleGuide}
${extraStyle}${refImgContext}

TIMING RULES:
- Each scene: 5-10 seconds
- HOOK scene (first): 8s
- Cover the ENTIRE audio — NO GAPS
- startTime/endTime MUST align with transcript timestamps

PROMPT FORMAT: [SHOT_TYPE + CAMERA_MOTION], [LENS]. [CHARACTER]. [ACTION]. [ENVIRONMENT]. [LIGHTING]. [ATMOSPHERE]. Style: ${videoStyle}. (no subtitles, no text, no titles, no captions, no logos, no watermarks)

SYNC RULES:
- EVERY visual prompt MUST illustrate what the narrator says at THAT moment
- Concrete → show them. Abstract → visual metaphors
- NEVER show generic visuals disconnected from narration
- CAMERA VARIETY: Never repeat angles consecutively
${characterBlock}
PROMPT QUALITY: 80-150 words per prompt.

${sceneBlueprintFromScript?.length ? `SCRIPT BLUEPRINT:\n${JSON.stringify(sceneBlueprintFromScript).slice(0, 1500)}` : ''}`;

    // Split into chunks — 180s each for longer segments
    const CHUNK_SECONDS = 180;
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

    // Process chunks SEQUENTIALLY to avoid rate limits and timeout
    const allScenes: any[] = [];
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const chunkTranscript = chunk.blocks
        .map(b => `[${b.start.toFixed(1)}s-${b.end.toFixed(1)}s] ${b.text}`)
        .join("\n");

      const chunkDuration = chunk.endTime - chunk.startTime;
      const expectedScenes = Math.max(2, Math.ceil(chunkDuration / 8));

      console.log(`Chunk ${ci + 1}/${chunks.length}: ${chunk.startTime.toFixed(1)}s-${chunk.endTime.toFixed(1)}s, ~${expectedScenes} scenes`);

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

${cleanScript ? `SCRIPT CONTEXT:\n${cleanScript.slice(0, 1500)}` : ''}

Generate ~${expectedScenes} scenes for this segment. Each scene 5-10s. Style: ${videoStyle}. Language: ${language}.
Visual content MUST match what is narrated at each timestamp.`
              }
            ],
          }),
        });

        if (!resp.ok) {
          const t = await resp.text();
          console.error(`Chunk ${ci + 1} error: ${resp.status}`, t.slice(0, 200));
          if (resp.status === 429) throw new Error("Rate limit. Tente novamente em alguns segundos.");
          if (resp.status === 402) throw new Error("Créditos insuficientes.");
          continue; // Skip failed chunk but continue others
        }

        const data = await resp.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          const scenes = parsed.scenes || [];
          console.log(`Chunk ${ci + 1}: ${scenes.length} scenes generated`);
          allScenes.push(...scenes);
        }
      } catch (err: any) {
        console.error(`Chunk ${ci + 1} failed:`, err.message);
        if (err.message?.includes('Rate limit') || err.message?.includes('Créditos')) throw err;
        // Continue with other chunks on non-critical errors
      }

      // Small delay between chunks to avoid rate limits
      if (ci < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // ========== PHASE 5: Merge and validate ==========
    allScenes.sort((a: any, b: any) => (a.startTime || 0) - (b.startTime || 0));

    for (const s of allScenes) {
      const dur = (s.endTime || 0) - (s.startTime || 0);
      s.sceneDurationSeconds = Math.max(5, Math.min(10, Math.round(dur)));
    }
    allScenes.forEach((s: any, i: number) => { s.sceneIndex = i + 1; });

    if (allScenes.length === 0) throw new Error("Nenhuma cena gerada. Tente novamente.");

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
        method: "gemini-flash-sequential",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-and-generate-scenes error:", e);
    return errResp(e.message || "Erro desconhecido", e.message?.includes('402') ? 402 : e.message?.includes('429') ? 429 : 500);
  }
});
