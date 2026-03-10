import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { characters, scenes, visualStyle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!characters?.length || !scenes?.length) {
      throw new Error("characters and scenes arrays required");
    }

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
            content: `You are a Netflix/Disney-level character design director creating consistent character prompts for Google Veo 3 video generation.

═══════════════════════════════════════
🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
═══════════════════════════════════════
- NEVER include text, subtitles, captions, titles, logos, watermarks in ANY prompt
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
═══════════════════════════════════════

VEO 3 PROMPT FORMULA: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]

CHARACTER CONSISTENCY PROTOCOL:
1. Create a DETAILED "identity sheet" with EXACT physical attributes — skin tone with pores, hair strand detail, eye color, face shape, body type, height, distinguishing marks
2. Use IDENTICAL wording for each character across ALL scene prompts — never paraphrase
3. Include the FULL identity description in EVERY prompt where character appears
4. Specify consistent wardrobe with fabric textures and colors
5. Reference image-to-video consistency when available

CINEMATOGRAPHY RULES:
- Specify exact camera: dolly, tracking, crane, steadicam, rack focus, Dutch angle, orbit
- Specify exact lens: 24mm, 35mm, 50mm, 85mm, 135mm, anamorphic
- Specify exact lighting: golden hour, Rembrandt, butterfly, rim, volumetric, chiaroscuro
- Anti-AI realism: skin pores, asymmetric composition, motion blur, film grain, dust particles
- End with: "masterpiece, award-winning cinematography, 8K UHD, photorealistic, Kodak Vision3 film grain"
- Then ALWAYS: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

Visual style: ${visualStyle || "Netflix cinematic"}
Scene 1 = HOOK — most visually spectacular shot.`
          },
          {
            role: "user",
            content: `Create Veo3-optimized character-consistent prompts. ZERO text/subtitles anywhere.

CHARACTERS:\n${characterDescriptions}

SCENES:\n${sceneTexts}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "character_consistent_prompts",
            description: "Return character sheets and Veo3 scene prompts with consistent characters",
            parameters: {
              type: "object",
              properties: {
                characterSheets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      physicalDescription: { type: "string", description: "Detailed appearance with skin pores, hair strands, fabric texture for Veo3 consistency" },
                      outfit: { type: "string" },
                      distinctiveFeatures: { type: "string" },
                      referencePrompt: { type: "string", description: "Standalone Veo3 prompt to generate reference of this character. Must end with anti-text block." },
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
                      prompt: { type: "string", description: "Full Veo3 prompt with embedded character descriptions. MUST end with anti-text block." },
                      negativePrompt: { type: "string", description: "Always include: subtitles, text, titles, captions, logos, watermarks, writing, letters, blurry, distorted, deformed" },
                      camera: { type: "string", description: "Veo3 camera: dolly, tracking, crane, steadicam, rack focus, orbit, push-in" },
                      lensSpec: { type: "string", description: "24mm, 35mm, 50mm, 85mm, 135mm, anamorphic" },
                      lighting: { type: "string", description: "golden hour, Rembrandt, butterfly, rim, volumetric, chiaroscuro" },
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
