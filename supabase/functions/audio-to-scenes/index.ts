import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const script = formData.get("script") as string || "";
    const videoStyle = formData.get("videoStyle") as string || "cinematográfico";
    const charactersJson = formData.get("characters") as string || "[]";
    const sceneDurationStr = formData.get("sceneDuration") as string || "8";
    const language = formData.get("language") as string || "português";

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ElevenLabs não configurado. Conecte o ElevenLabs primeiro.");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado.");
    if (!audioFile) throw new Error("Arquivo de áudio obrigatório.");

    const sceneDuration = parseInt(sceneDurationStr) || 8;
    let characters: any[] = [];
    try { characters = JSON.parse(charactersJson); } catch { /* ignore */ }

    // ========== STEP 1: Transcribe with ElevenLabs STT ==========
    console.log("Step 1: Transcribing audio with ElevenLabs Scribe v2...");
    const sttFormData = new FormData();
    sttFormData.append("file", audioFile);
    sttFormData.append("model_id", "scribe_v2");
    sttFormData.append("tag_audio_events", "true");
    sttFormData.append("diarize", "false");

    // Detect language for STT
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
      console.error("ElevenLabs STT error:", sttResponse.status, errText);
      if (sttResponse.status === 401) throw new Error("ElevenLabs API key inválida.");
      if (sttResponse.status === 429) throw new Error("Rate limit ElevenLabs. Tente novamente.");
      throw new Error(`Erro na transcrição: ${sttResponse.status}`);
    }

    const transcription = await sttResponse.json();
    const fullText = transcription.text || "";
    const words = transcription.words || [];
    const audioEvents = transcription.audio_events || [];

    if (!fullText.trim()) throw new Error("Áudio sem fala detectável.");

    // Calculate total audio duration from last word
    const audioDuration = words.length > 0 ? words[words.length - 1].end : 0;
    console.log(`Transcription complete: ${words.length} words, ${audioDuration.toFixed(1)}s duration`);

    // ========== STEP 2: Fetch scene knowledge from DB ==========
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(10);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}:\n${r.prompt_template.slice(0, 300)}`
    ).join("\n\n").slice(0, 4000);

    // ========== STEP 3: Build word-timestamped transcript blocks ==========
    // Group words into sentence-like blocks using punctuation and pauses
    interface TranscriptBlock {
      text: string;
      startTime: number;
      endTime: number;
      words: typeof words;
    }

    const blocks: TranscriptBlock[] = [];
    let currentBlock: typeof words = [];
    let blockStart = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (currentBlock.length === 0) blockStart = word.start;
      currentBlock.push(word);

      // Split on: sentence-ending punctuation, long pauses (>0.5s), or every ~15 words
      const isEndOfSentence = /[.!?]$/.test(word.text);
      const hasLongPause = i < words.length - 1 && (words[i + 1].start - word.end) > 0.5;
      const isTooLong = currentBlock.length >= 15;

      if (isEndOfSentence || hasLongPause || isTooLong || i === words.length - 1) {
        blocks.push({
          text: currentBlock.map((w: any) => w.text).join(" "),
          startTime: blockStart,
          endTime: word.end,
          words: [...currentBlock],
        });
        currentBlock = [];
      }
    }

    // ========== STEP 4: AI Semantic Scene Division + Contextual Prompts ==========
    console.log("Step 3: AI analyzing narrative for semantic scene division...");

    // Build the transcript with timestamps for the AI
    const timestampedTranscript = blocks.map((b, i) =>
      `[${b.startTime.toFixed(1)}s - ${b.endTime.toFixed(1)}s] ${b.text}`
    ).join("\n");

    // Style guides
    const styleGuides: Record<string, string> = {
      'cinematográfico': `Netflix/Disney premium. ARRI ALEXA 65, Cooke Anamorphic lenses. ACES color, Kodak Vision3 film emulation. Shallow DOF f/1.4-2.8. Volumetric god rays, atmospheric haze. Roger Deakins reference.`,
      '2d': `Kurzgesagt meets Studio Trigger. Vibrant flat colors, clean vector linework, parallax depth layers, smooth 24fps.`,
      '3d': `Pixar/DreamWorks 3D. Subsurface scattering, PBR materials, global illumination, strand-based hair, 8K textures.`,
      'anime': `Ufotable/MAPPA quality. Sakuga key poses, Makoto Shinkai backgrounds, cel-shading, rim lighting, volumetric particles.`,
      'realista': `Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light, pore-level detail. Zero AI artifacts.`,
      'dark': `Dark noir. Crushed blacks, neon accent lighting. Blade Runner 2049 meets Se7en. Wet reflective surfaces, silhouettes.`,
      'comic': `Premium graphic novel. Bold ink outlines, Ben-Day halftone, dynamic panel compositions, rich saturated colors.`,
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    // Character block
    const characterBlock = characters.length > 0
      ? `\nCHARACTER SHEETS:\n${characters.map((c: any, i: number) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          return `CHARACTER ${i + 1} "${c.name}": ${c.gender || 'unknown'}, ${c.age || '?'} years, ${a.body_type || 'average'} build, ${a.skin_color || 'medium'} skin, ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair, ${a.eye_color || 'brown'} eyes, wearing ${cl.shirt || 'casual'}, ${cl.pants || 'jeans'}${c.imageUrl ? `. REFERENCE IMAGE: ${c.imageUrl}` : ''}`;
        }).join('\n')}\nINCLUDE FULL DESCRIPTION in every prompt where character appears.\n`
      : '';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        tools: [{
          type: "function",
          function: {
            name: "set_audio_scenes",
            description: "Semantically divide transcribed audio into scenes with deeply contextual visual prompts",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      sceneDurationSeconds: { type: "number", description: "Duration 6-10 seconds based on narrative weight" },
                      startTime: { type: "number", description: "Start time in seconds matching the audio transcript timestamps" },
                      endTime: { type: "number", description: "End time in seconds matching the audio transcript timestamps" },
                      narrativeText: { type: "string", description: "The exact transcript text that this scene covers" },
                      narrativeSummary: { type: "string", description: "One sentence summary of what is being narrated in this segment" },
                      visualPrompt: { type: "string", description: "100-200 word Veo3 prompt. MUST be DEEPLY CONTEXTUAL to what is being narrated — if narration says 'person was abandoned', show a person being left alone; if 'car restoration' show dirty car being cleaned. Structure: [Cinematography] + [Subject matching narration] + [Action matching narration] + [Environment] + [Style]. End with: (no subtitles, no text, no titles, no captions, no logos, no watermarks)" },
                      negativePrompt: { type: "string" },
                      cameraAngle: { type: "string" },
                      lensSpec: { type: "string" },
                      lightingSetup: { type: "string" },
                      audioDirection: { type: "string", description: "Ambient sounds and foley that complement the narration" },
                      mood: { type: "string" },
                      emotionalBeat: { type: "string", description: "The emotional purpose: hook, tension-build, revelation, climax, resolution, etc." },
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
        }],
        tool_choice: { type: "function", function: { name: "set_audio_scenes" } },
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS VISUAL DIRECTOR who creates Netflix/Disney-grade video scenes from narrated audio.

YOUR UNIQUE SKILL: You LISTEN to what is being said in the narration and create visual scenes that PERFECTLY ILLUSTRATE the narrative.

═══════════════════════════════════════
🎯 CONTEXTUAL PROMPT RULES — THIS IS WHAT MAKES YOU SPECIAL
═══════════════════════════════════════

EVERY visual prompt MUST directly illustrate what the narrator is saying at that moment:

EXAMPLES OF CORRECT CONTEXTUAL PROMPTS:
- Narration: "He was abandoned as a child" → Scene: A small child standing alone in the rain outside a closed door, tears on cheeks, dim streetlight casting long shadows, 85mm lens, shallow DOF, Rembrandt lighting...
- Narration: "The car was a complete wreck" → Scene: Extreme close-up of rusted car hood with peeling paint, cracked headlights, spider web cracks in windshield, dust particles in sunlight beam, macro lens 100mm...
- Narration: "She built a million dollar empire" → Scene: Dolly shot revealing luxury office with city skyline, woman in power suit standing at floor-to-ceiling window, golden hour light, confident posture...
- Narration: "The market crashed overnight" → Scene: Multiple trading screens showing red graphs plummeting, cold blue monitor glow on trader's face, hand gripping desk edge, shaky cam...

NEVER create generic prompts. EVERY scene must tell the EXACT story being narrated.

═══════════════════════════════════════
🚫 ABSOLUTE PROHIBITION
═══════════════════════════════════════
- NO subtitles, NO text, NO titles, NO captions, NO logos, NO watermarks
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

VISUAL STYLE: ${selectedStyleGuide}
${characterBlock}

CINEMATIC KNOWLEDGE BASE:
${knowledgeBlock}

SCENE DIVISION RULES:
1. Divide based on NARRATIVE MEANING, not arbitrary time splits
2. Each scene = ${sceneDuration}-second video clip (vary 6-10s based on emotional weight)
3. Scene boundaries should align with topic changes, emotional shifts, or natural pauses in narration
4. Scene 1 = HOOK — the most visually spectacular shot
5. Match startTime/endTime to the actual transcript timestamps provided
6. Use 5+ different camera angles across scenes — never repeat consecutively

PROMPT FORMULA: [Cinematography] + [Subject matching narration] + [Action matching narration] + [Environment] + [Style & Ambiance] + anti-text block

Quality tags for each prompt: "masterpiece, award-winning cinematography, 8K UHD, photorealistic, Kodak Vision3 film grain, ACES color science"`
          },
          {
            role: "user",
            content: `TRANSCRIBED AUDIO (${audioDuration.toFixed(1)} seconds total):

${timestampedTranscript}

${script ? `\nFULL SCRIPT FOR CONTEXT:\n${script.slice(0, 2000)}` : ''}

TASK: Analyze this narration semantically. Identify natural scene boundaries based on:
- Topic/subject changes
- Emotional shifts
- Natural pauses in speech
- Narrative arc beats (hook, setup, conflict, climax, resolution)

For EACH scene, create a visual prompt that PRECISELY illustrates what is being narrated at that moment.
Target scene duration: ~${sceneDuration} seconds (vary 6-10s based on narrative weight).
Video style: ${videoStyle}
Total audio: ${audioDuration.toFixed(1)}s → approximately ${Math.ceil(audioDuration / sceneDuration)} scenes.

CRITICAL: Prompts must be DEEPLY SPECIFIC to the narration content. NOT generic.`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI scene analysis error:", response.status, t);
      if (response.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (response.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error("Erro na análise de cenas.");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Nenhuma resposta de cenas gerada.");

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log(`Generated ${parsed.scenes?.length || 0} contextual scenes`);

    return new Response(JSON.stringify({
      transcription: {
        fullText,
        wordCount: words.length,
        audioDuration,
        blocks: blocks.map(b => ({ text: b.text, startTime: b.startTime, endTime: b.endTime })),
      },
      scenes: parsed.scenes,
      metadata: {
        totalScenes: parsed.scenes?.length || 0,
        totalDuration: audioDuration,
        videoStyle,
        charactersCount: characters.length,
        method: "audio-transcription-semantic-analysis",
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

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
