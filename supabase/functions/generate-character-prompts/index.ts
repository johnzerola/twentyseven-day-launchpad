import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. Ultra-realistic, film grain, dramatic lighting, Kodak Vision3.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector, character design sheets in flat art style. NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D. Stylized 3D characters, subsurface scattering, PBR materials.',
  'anime': 'Anime/manga style. Ufotable/MAPPA. Cel-shading, expressive eyes, dynamic poses.',
  'wojak': 'Wojak/meme art style. Simple drawn faces, exaggerated emotions, internet meme aesthetic, flat colors, minimal detail.',
  'stickmen': 'Stick figure style. Minimalist black line art, simple colored backgrounds.',
  'realista': 'Hyper-photorealistic. Natural lighting, 8K, lifelike humans.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon, atmospheric.',
  'whiteboard': 'Whiteboard sketch style. Black ink on white, hand-drawn look.',
  'comic': 'Comic book art. Bold ink outlines, halftone, saturated colors.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { characters, scenes, visualStyle, videoStyle, customStyleNotes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!characters?.length || !scenes?.length) {
      throw new Error("characters and scenes arrays required");
    }

    const effectiveStyle = videoStyle || visualStyle || 'cinematográfico';
    const styleKey = effectiveStyle.toLowerCase();
    const selectedStyleGuide = styleGuides[styleKey] || styleGuides['cinematográfico'];

    const characterDescriptions = characters.map((c: any, i: number) =>
      `Character ${i + 1}: "${c.name}" - ${c.description}. Appearance: ${c.appearance || 'not specified'}. Outfit: ${c.outfit || 'not specified'}.`
    ).join("\n");

    const sceneTexts = scenes.map((s: any, i: number) =>
      `Scene ${i + 1}: "${s.text}"`
    ).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a character design director creating consistent character prompts for video generation.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
- NEVER include text, subtitles, captions, titles, logos, watermarks in ANY prompt
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

CHARACTER CONSISTENCY PROTOCOL:
1. Create a DETAILED "identity sheet" matching the ${styleKey} art style
2. For 2D/Wojak/meme styles: describe the character's drawn style, line thickness, color palette
3. For anime: describe anime-specific features (eye style, hair highlights, cel-shading)
4. For realistic/cinematic: include physical details like skin pores, hair strands
5. Use IDENTICAL wording for each character across ALL scene prompts
6. Include the FULL identity description in EVERY prompt where character appears

IMPORTANT: All character designs and scene prompts MUST be in ${styleKey} style. Do NOT mix styles.`
          },
          {
            role: "user",
            content: `Create character-consistent prompts in "${styleKey}" style. ZERO text/subtitles anywhere.

CHARACTERS:\n${characterDescriptions}

SCENES:\n${sceneTexts}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "character_consistent_prompts",
            description: "Return character sheets and scene prompts with consistent characters in the chosen art style",
            parameters: {
              type: "object",
              properties: {
                characterSheets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      physicalDescription: { type: "string", description: "Detailed appearance in the chosen art style for consistency" },
                      outfit: { type: "string" },
                      distinctiveFeatures: { type: "string" },
                      referencePrompt: { type: "string", description: "Standalone prompt to generate reference of this character in the chosen style. Must end with anti-text block." },
                    },
                    required: ["name", "physicalDescription", "outfit", "distinctiveFeatures", "referencePrompt"],
                    additionalProperties: false,
                  },
                },
                scenePrompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      prompt: { type: "string", description: "Full prompt with embedded character descriptions in the chosen art style. MUST end with anti-text block." },
                      negativePrompt: { type: "string", description: "Always include: subtitles, text, titles, captions, logos, watermarks, writing, letters, blurry, distorted, deformed" },
                      camera: { type: "string" },
                      lensSpec: { type: "string" },
                      lighting: { type: "string" },
                      mood: { type: "string" },
                    },
                    required: ["sceneIndex", "prompt", "negativePrompt", "camera", "lensSpec", "lighting", "mood"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["characterSheets", "scenePrompts"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "character_consistent_prompts" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-character-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
