import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, videoStyle, characters, audioDurationSeconds, sceneDurationSeconds, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script text required");

    // ========== Fetch Scene Knowledge ==========
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sceneKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("category,title,prompt_template,tags")
      .order("viral_score", { ascending: false }).limit(12);

    const knowledgeBlock = (sceneKnowledge || []).map((r: any) =>
      `[${r.category.toUpperCase()}] ${r.title}:\n${r.prompt_template}`
    ).join("\n\n");

    // ========== Parse script into sentences ==========
    const defaultSceneLen = sceneDurationSeconds || 8;
    const totalDuration = audioDurationSeconds || 0;
    const sentences = script.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
    const totalChars = sentences.reduce((sum: number, s: string) => sum + s.length, 0);

    const numScenes = totalDuration > 0
      ? Math.max(1, Math.ceil(totalDuration / defaultSceneLen))
      : Math.max(1, Math.ceil(sentences.length / 3));

    const scenes: { index: number; text: string }[] = [];
    const charsPerScene = Math.ceil(totalChars / numScenes);
    let currentText = '';
    let currentChars = 0;
    let idx = 0;

    for (const sentence of sentences) {
      currentText += (currentText ? ' ' : '') + sentence;
      currentChars += sentence.length;
      if (currentChars >= charsPerScene && idx < numScenes - 1) {
        scenes.push({ index: idx, text: currentText.trim() });
        idx++;
        currentText = '';
        currentChars = 0;
      }
    }
    if (currentText.trim()) scenes.push({ index: idx, text: currentText.trim() });

    // ========== Style guides ==========
    const styleGuides: Record<string, string> = {
      'cinematográfico': `Hyper-realistic cinematic photography shot on ARRI ALEXA 65 with Cooke Anamorphic lenses. Shallow DOF (f/1.4-2.8), natural film grain (ISO 800), volumetric god rays. Three-point lighting, chiaroscuro. Teal-orange color palette. Roger Deakins, Emmanuel Lubezki reference.`,
      '2d': `Premium 2D animation. Vibrant flat colors, clean vector linework, Kurzgesagt meets Studio Trigger. Bold outlines, parallax depth, smooth 24fps feel.`,
      '3d': `Pixar/DreamWorks feature-film 3D. SSS on skin, PBR materials, GI with ray-traced reflections. Hair simulation. 8K textures.`,
      'anime': `Top-tier anime (Ufotable/MAPPA). Dynamic sakuga poses, detailed backgrounds, professional cel-shading, rim lighting, particle systems.`,
      'wojak': 'Wojak/meme art style. Simple line drawings, emotional faces, minimalist backgrounds.',
      'stickmen': 'Stick figure animation. Simple black figures on clean backgrounds. Humor through simplicity.',
      'realista': `Photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, natural light, pore-level skin detail. No AI artifacts.`,
      'dark': `Dark cinematic. Crushed blacks, neon accents (cyan, magenta). Volumetric fog. Blade Runner 2049 meets Se7en. Noir shadow patterns.`,
      'whiteboard': 'Whiteboard animation. Hand-drawn black ink on white. Strategic color highlights. Educational clarity.',
      'comic': 'Premium graphic novel. Bold ink outlines, Ben-Day halftone, dynamic compositions, rich saturated colors.',
    };
    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    // ========== Character identity block with image refs ==========
    const characterBlock = characters?.length > 0
      ? `\n\nCHARACTER IDENTITY SHEETS (COPY VERBATIM into EVERY prompt where character appears):\n${characters.map((c: any, i: number) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          const refImg = c.imageUrl ? `\nREFERENCE IMAGE: ${c.imageUrl} — Match this appearance EXACTLY.` : '';
          return `═══ CHARACTER ${i + 1}: "${c.name}" ═══
Gender: ${c.gender || 'unknown'} | Age: ${c.age || 'unknown'}
BODY: ${a.body_type || 'average'} build, ${a.height || 'average'}, ${a.skin_color || 'medium'} skin
HAIR: ${a.hair_color || 'dark'} ${a.hair_style || 'short'}
EYES: ${a.eye_color || 'brown'}, ${f.eyebrows || 'natural'} eyebrows
FACE: ${f.face_shape || 'oval'}, ${f.nose || 'straight'} nose, ${f.mouth || 'natural'} mouth
OUTFIT: ${cl.shirt || 'casual'}, ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}${refImg}`;
        }).join('\n\n')}\n\n⚠️ RULE: Include FULL character description in EVERY prompt they appear in.`
      : '';

    const sceneTexts = scenes.map(s => `Scene ${s.index + 1}: "${s.text}"`).join('\n\n');

    // ========== AI Generation with dynamic duration ==========
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
            name: "set_synced_prompts",
            description: "Generate synchronized visual prompts with dynamic duration per scene",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      sceneDurationSeconds: { type: "number", description: "Dynamic duration 5-15s based on narrative weight. Hook scenes (first 1-2): 8-10s. Action: 5-6s. Emotional/descriptive: 10-15s. Transitions: 5s." },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                      visualPrompt: { type: "string", description: "Ultra-detailed 80-150 word visual prompt in English. Include full character descriptions." },
                      cameraAngle: { type: "string" },
                      mood: { type: "string" },
                      charactersInScene: { type: "array", items: { type: "string" } },
                      transitionNote: { type: "string" },
                    },
                    required: ["sceneIndex", "sceneDurationSeconds", "startTime", "endTime", "visualPrompt", "cameraAngle", "mood"],
                    additionalProperties: false
                  }
                }
              },
              required: ["scenes"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "set_synced_prompts" } },
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS visual director (Marvel, Nolan, Villeneuve productions).

MASTER VISUAL STYLE:
${selectedStyleGuide}
${characterBlock}

🎓 CINEMATIC KNOWLEDGE BASE:
${knowledgeBlock}

YOUR COMMANDMENTS:

1. DYNAMIC SCENE DURATION: Assign 5-15 seconds per scene based on narrative weight:
   - HOOK SCENE (Scene 1): 8-10s — MOST visually striking, impossible-to-ignore opening. Ultra-premium quality.
   - Action/transition scenes: 5-6s
   - Emotional/descriptive scenes: 10-15s
   - Calculate startTime/endTime cumulatively from sceneDurationSeconds

2. SCENE 1 SPECIAL TREATMENT: This is the HOOK. It MUST be the most visually spectacular, award-winning shot. Add "HOOK SCENE — ultra-premium, award-winning opening shot, maximum visual impact" to the prompt.

3. PROMPT LENGTH: 80-150 words each. Structure: Subject → Action → Environment → Lighting → Camera → Atmosphere → Color → Mood keywords.

4. CHARACTER CONSISTENCY: Include FULL identity sheet in EVERY prompt where they appear.

5. CINEMATOGRAPHIC VARIETY: Never repeat camera angles in consecutive scenes. Use 5+ different shot types.

6. QUALITY TAGS: End every prompt with "masterpiece, award-winning cinematography, 8K UHD, photorealistic, film grain"

7. ANTI-AI: Natural skin with pores, asymmetric compositions, motion blur, dust particles, lens aberration.

8. ALL PROMPTS IN ENGLISH.`
          },
          {
            role: "user",
            content: `Generate ${scenes.length} CINEMA-QUALITY visual prompts with DYNAMIC DURATION per scene.
Total audio duration: ${totalDuration > 0 ? `${totalDuration}s` : 'estimate from text'}
Default scene length: ~${defaultSceneLen}s (but vary 5-15s based on content)
Video style: ${videoStyle || 'cinematográfico'}
Language: ${language || 'português'}

CRITICAL: Scene 1 is the HOOK — make it the most visually stunning shot possible.
Assign sceneDurationSeconds dynamically. Calculate startTime/endTime cumulatively.

SCENES:\n\n${sceneTexts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Synced prompts error:", response.status, t);
      if (response.status === 429) return errResp("Rate limit.", 429);
      if (response.status === 402) return errResp("Créditos insuficientes.", 402);
      throw new Error("Failed to generate synced prompts");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      scenes: parsed.scenes,
      metadata: {
        totalScenes: scenes.length,
        totalDuration: totalDuration || parsed.scenes.reduce((s: number, sc: any) => s + (sc.sceneDurationSeconds || defaultSceneLen), 0),
        videoStyle: videoStyle || 'cinematográfico',
        charactersCount: characters?.length || 0,
        dynamicTiming: true,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-synced-prompts error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
