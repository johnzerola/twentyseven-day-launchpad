import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER CHARACTER IDENTITY SYSTEM v2
// Professional character consistency for Veo3 generation
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. Ultra-realistic, film grain, dramatic lighting, Kodak Vision3. Skin with natural pores, micro-imperfections, strand-level hair detail.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector, character design sheets in flat art style. NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D. Stylized 3D characters, subsurface scattering, PBR materials.',
  'anime': 'Anime/manga style. Ufotable/MAPPA. Cel-shading, expressive eyes, dynamic poses.',
  'wojak': 'Wojak/meme art style. Simple drawn faces, exaggerated emotions, internet meme aesthetic, flat colors, minimal detail.',
  'stickmen': 'Stick figure style. Minimalist black line art, simple colored backgrounds.',
  'realista': 'Hyper-photorealistic. Natural lighting, 8K, lifelike humans, pore-level detail.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon, atmospheric.',
  'whiteboard': 'Whiteboard sketch style. Black ink on white, hand-drawn look.',
  'comic': 'Comic book art. Bold ink outlines, halftone, saturated colors.',
  'fotorrealista_documentario': 'Documentary photography style, natural soft lighting, shallow depth of field, Canon 5D aesthetic.',
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
            content: `You are a character design director creating consistent character prompts for video generation, trained on the DarkPlanner professional system.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
- NEVER include text, subtitles, captions, titles, logos, watermarks in ANY prompt
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

═══ DARKPLANNER CHARACTER IDENTITY SHEET TEMPLATE ═══
Each character definition MUST follow this EXACT format (150-200 words, ALWAYS end with "waist up"):

[Name]: [ethnicity/nationality] [gender] age [exact age], [body type] body [showing trait], [skin tone] skin tone, [hair color/length/style], [eye color] eyes showing [expression], wearing [SPECIFIC clothing with fabric, color, pattern], [shoes], [accessories], [distinctive marks/features], [expression/posture], [style modifiers matching art style], waist up

CRITICAL RULES:
1. Maximum 200 words per character definition
2. ALWAYS end with "waist up" (DarkPlanner framing requirement)
3. Include style modifiers at the end matching the chosen art style
4. Be HYPER-SPECIFIC: NOT "nice clothes" → "faded yellow cotton dress with floral pattern"
5. Include physical details that ensure consistency: skin tone, specific hair style, eye expression
6. Include distinguishing marks: scars, jewelry, tattoos, glasses, etc.
7. For realistic styles: mention natural skin pores, weathered hands, specific aging details
8. For 2D/Wojak/meme: describe drawn style, line thickness, color palette specific to the style
9. For anime: describe anime-specific features (eye style, hair highlights, cel-shading)

═══ SCENE PROMPT RULES (DarkPlanner) ═══
1. 150-250 words per scene prompt
2. Character clothing/appearance description MUST be COPIED WORD-FOR-WORD from identity sheet
   ❌ WRONG: Prompt 1 "wearing yellow dress" → Prompt 2 "in her yellow outfit"
   ✅ RIGHT: IDENTICAL text in EVERY prompt
3. Maximum 2 characters per prompt (split if more needed)
4. Every prompt MUST have movement described:
   - Character movement: walking, turning, reaching, etc.
   - Camera movement: pushing in, pulling back, panning, etc.
   - Environment movement: wind, particles, water, etc.
5. Detailed environment to prevent white/buggy backgrounds
6. Style modifiers at end of every prompt

EXAMPLE (Photorealistic):
[Maria]: Brazilian woman age 45, full-figured maternal body showing years of hard work, medium brown skin tone, short black hair with gray streaks pulled back in simple bun, deep brown eyes showing fatigue and determination, wearing faded yellow cotton house dress with floral pattern and brown worn leather sandals, simple gold wedding band on left hand, weathered hands with calluses from domestic work, standing in modest kitchen, warm maternal expression despite visible exhaustion, photorealistic documentary photography style, natural soft window lighting, shallow depth of field, Canon 5D aesthetic, waist up

IMPORTANT: All character designs and scene prompts MUST be in ${styleKey} style. Do NOT mix styles.`
          },
          {
            role: "user",
            content: `Create character-consistent prompts in "${styleKey}" style following DarkPlanner system.
ZERO text/subtitles anywhere.
Each character definition = 150-200 words ending with "waist up".
Each scene prompt = 150-250 words with mandatory movement.
Character descriptions COPIED VERBATIM across all prompts.
Max 2 characters per prompt.

CHARACTERS:\n${characterDescriptions}

SCENES:\n${sceneTexts}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "character_consistent_prompts",
            description: "Return DarkPlanner character sheets (150-200w, ending 'waist up') and scene prompts (150-250w) with consistent characters",
            parameters: {
              type: "object",
              properties: {
                characterSheets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      physicalDescription: { type: "string", description: "150-200 word detailed appearance in DarkPlanner format. MUST end with 'waist up'." },
                      outfit: { type: "string", description: "Exact clothing description to be COPIED VERBATIM in every prompt" },
                      distinctiveFeatures: { type: "string", description: "Unique marks, accessories, posture" },
                      referencePrompt: { type: "string", description: "Standalone prompt to generate reference of this character. 150-200 words. MUST end with 'waist up' and anti-text block." },
                      styleModifiers: { type: "string", description: "Art style modifiers appended to every use" },
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
                      prompt: { type: "string", description: "150-250 word prompt with embedded character descriptions COPIED VERBATIM. Mandatory movement (character + camera + environment). Detailed environment. MUST end with anti-text block." },
                      negativePrompt: { type: "string", description: "Always include: subtitles, text, titles, captions, logos, watermarks, writing, letters, blurry, distorted, deformed" },
                      camera: { type: "string" },
                      lensSpec: { type: "string" },
                      lighting: { type: "string" },
                      mood: { type: "string" },
                      charactersPresent: { type: "array", items: { type: "string" }, description: "Max 2 character names per prompt" },
                      movementTypes: { type: "string", description: "Character movement + camera movement + environment movement" },
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

    // ═══ Post-Processing: DarkPlanner Auto-Validation ═══
    const warnings: string[] = [];

    // Validate character sheets
    for (const sheet of result.characterSheets || []) {
      if (!sheet.referencePrompt?.toLowerCase().includes("waist up")) {
        sheet.referencePrompt = (sheet.referencePrompt || '') + ", waist up";
        warnings.push(`Character "${sheet.name}": Added missing "waist up" ending`);
      }
      const words = (sheet.physicalDescription || '').split(/\s+/).length;
      if (words < 80) {
        warnings.push(`Character "${sheet.name}": Description only ${words} words (150-200 recommended)`);
      }
    }

    // Validate scene prompts
    for (const scene of result.scenePrompts || []) {
      if (!scene.prompt?.includes("no subtitles")) {
        scene.prompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
    }

    return new Response(JSON.stringify({
      ...result,
      metadata: {
        system: "DarkPlanner Character System v2",
        style: styleKey,
        validationWarnings: warnings,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-character-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
