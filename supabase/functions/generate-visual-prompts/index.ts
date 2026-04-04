import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT, ANTI_TEXT_SUFFIX } from "../_shared/veo3-policy-filter.ts";
import { verifyAuth, isAuthError, corsHeaders } from "../_shared/auth.ts";
import { PROMPT_ANATOMY_CHECKLIST, CAMERA_SHOT_VARIETY_RULES, SCENE_COVERAGE_STRATEGY, buildConditionalTraining, validatePromptAnatomy } from "../_shared/video-production-training.ts";

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER v3 — Visual Prompts Engine (Full Training + Veo3 Policy)
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. ARRI ALEXA 65, Cooke Anamorphic lenses, Kodak Vision3 500T film emulation, ACES color science. Dramatic lighting, shallow DOF f/1.4-2.8, creamy bokeh. Lifted blacks, subtle halation. Volumetric god rays, atmospheric haze.',
  '2d': '2D FLAT ANIMATION, Kurzgesagt-style. CRITICAL: This MUST look like a 2D animated cartoon — vibrant flat colors, clean vector shapes, bold outlines, smooth color fills, parallax depth layers, NO photorealism, NO 3D rendering. Characters are simplified 2D illustrated figures with flat shading. Backgrounds are colorful flat-design landscapes. Smooth 24fps cel animation feel.',
  '3d': '3D CARTOON RENDER, Pixar/Dreamworks style. Stylized cartoon characters with big expressive eyes, smooth plastic-like skin, subsurface scattering, PBR materials, global illumination, strand-based hair, 8K textures. NOT photorealistic — cartoon proportions.',
  'anime': 'ANIME/MANGA style, Ufotable/MAPPA quality. Dynamic sakuga action poses, beautiful painted backgrounds (Makoto Shinkai style), cel-shading, rim lighting, volumetric particles, dramatic speed lines, large expressive eyes.',
  'wojak': 'WOJAK/MEME internet art style. Simple drawn faces with strong emotional expressions, flat colors, minimalist backgrounds, internet culture aesthetic.',
  'stickmen': 'STICK FIGURE animation style. Minimalist black line drawings on white/simple backgrounds, humor through simplicity and timing.',
  'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM lens, 8K resolution, natural available light, pore-level skin detail, strand-level hair. Zero AI artifacts. Documentary-grade realism.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents (cyan, magenta, amber). Dense volumetric fog. Noir shadow patterns, wet reflective surfaces.',
  'whiteboard': 'WHITEBOARD ANIMATION. Hand-drawn black ink on white surface, strategic color highlights, educational clarity, smooth drawing reveal.',
  'comic': 'COMIC BOOK / GRAPHIC NOVEL. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, saturated colors, dramatic perspective.',
  'lego': 'LEGO WORLD. Everything made of LEGO bricks — characters are LEGO minifigures, environments from colored blocks, plastic texture, stop-motion feel.',
  'minecraft': 'MINECRAFT STYLE. Pixelated blocky voxel world, 16x16 textures, block-based characters and environments, game aesthetic.',
  'disney_toon': 'CLASSIC DISNEY ANIMATION. Fluid character movement, charismatic expressive characters, warm palettes, magical sparkle effects, hand-drawn quality.',
  'documentary_bbc': 'BBC/National Geographic documentary. Sweeping aerials, macro close-ups, natural soft lighting, earth tones, Canon C500 aesthetic.',
  'gtav': 'GTA V game aesthetic. High saturation, urban landscapes, action-movie angles, lens flares, HDR lighting, gritty urban environments.',
  'expressionism': 'EXPRESSIONIST ART. Bold brushstrokes, distorted perspectives, vivid non-naturalistic colors, emotional intensity. Van Gogh meets Munch.',
  'animal_chase': 'HYPER-REALISTIC ANIMAL DOCUMENTARY + HOLLYWOOD. 120fps slow-motion, extreme close-ups on animal eyes, volumetric dust/water, dramatic golden hour, cinematic pursuits.',
  'fotorrealista_documentario': 'Documentary photography, natural soft lighting, shallow depth of field, desaturated earth tones, Canon 5D aesthetic.',
  'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes, gallery-quality compositions.',
  'aquarela': 'Watercolor painting. Soft translucent washes, visible paper grain, bleeding color edges, delicate brushwork.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
    const auth = await verifyAuth(req);
    if (isAuthError(auth)) return auth;

    const { segments, videoStyle, customStyleNotes } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!segments?.length) throw new Error("Segments array required");

    const styleKey = (videoStyle || 'cinematográfico').toLowerCase();
    const selectedStyle = styleGuides[styleKey] || styleGuides['cinematográfico'];
    const segmentTexts = segments.map((s: any, i: number) => `Segment ${i + 1}: "${s.text}"`).join("\n");
    const allSegmentText = segments.map((s: any) => s.text || '').join(' ');
    const conditionalTraining = buildConditionalTraining(allSegmentText);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        tools: [{
          type: "function",
          function: {
            name: "set_visual_prompts",
            description: "Set visual prompts for each script segment (DarkPlanner v3 format)",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      visualPrompt: { type: "string", description: "150-250 word visual prompt. DarkPlanner v3: movement trio, environment detail, style modifiers, anti-text suffix. NO numbering/titles." }
                    },
                    required: ["segmentIndex", "visualPrompt"],
                    additionalProperties: false
                  }
                }
              },
              required: ["prompts"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "set_visual_prompts" } },
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS visual director trained on the DarkPlanner Professional System v3.

🎨 MANDATORY ART STYLE: ${selectedStyle}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}

🚫 ZERO TOLERANCE: NEVER include text/subtitles/logos. End EVERY prompt with: "${ANTI_TEXT_SUFFIX}"

${VEO3_POLICY_PROMPT}

═══ DARKPLANNER v3 RULES ═══

1. PROMPT LENGTH: 150-250 words (MINIMUM 150). Detailed = better generation.
2. STYLE FIDELITY: START every prompt with the art style descriptor. Match exactly.
3. MANDATORY MOVEMENT TRIO — Every prompt:
   🎭 CHARACTER: walking, turning, reaching, trembling, breathing heavily
   🎥 CAMERA: pushing in, pulling back, panning, circling, tracking, crane
   🌿 ENVIRONMENT: wind blowing, leaves falling, water flowing, smoke rising, dust floating
4. ENVIRONMENT DETAIL — PREVENT WHITE BACKGROUNDS:
   - Specific location with MATERIALS/TEXTURES
   - VISIBLE SURROUNDINGS
   - LIGHT SOURCE + DIRECTION
   - ATMOSPHERIC ELEMENTS
   - SMALL PROPS for realism
5. Style modifiers + anti-text at END of every prompt.
6. ALL PROMPTS IN ENGLISH.
7. FORMAT: NO numbering, NO scene titles. Just raw prompt text.`
          },
          {
            role: "user",
            content: `Generate visual prompts in "${styleKey}" style for ${segments.length} segments.
Each prompt = 150-250 words. Movement trio mandatory. No numbering/titles.

SEGMENTS:\n\n${segmentTexts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Visual prompts error:", response.status, t);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      throw new Error("Failed to generate visual prompts");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    const parsed = JSON.parse(toolCall.function.arguments);

    // ═══ DarkPlanner v3 Auto-Validation + Veo3 Policy Filter ═══
    const warnings: string[] = [];
    const autoFixes: string[] = [];

    for (const p of parsed.prompts) {
      // FULL Veo3 policy filter (copyright + celebrity + brand + trigger words + anti-text)
      const { cleaned, fixes } = applyVeo3PolicyFilter(p.visualPrompt || '');
      if (fixes.length > 0) {
        p.visualPrompt = cleaned;
        autoFixes.push(...fixes.map(f => `Seg ${p.segmentIndex}: ${f}`));
      }

      // Validate word count
      const wordCount = (p.visualPrompt || '').split(/\s+/).length;
      if (wordCount < 100) {
        warnings.push(`Segment ${p.segmentIndex}: Only ${wordCount} words (150-250 recommended)`);
      }
    }

    // ═══ Video Production Training v2.0: Prompt Anatomy Validation ═══
    const anatomyWarnings = validatePromptAnatomy(
      parsed.prompts.map((p: any) => ({ visualPrompt: p.visualPrompt, sceneIndex: p.segmentIndex }))
    );
    warnings.push(...anatomyWarnings);

    return new Response(JSON.stringify({
      prompts: parsed.prompts,
      metadata: {
        system: "DarkPlanner Visual Prompts v3 + Video Production Training v2.0",
        style: styleKey,
        validationWarnings: warnings,
        autoFixes,
        promptCount: parsed.prompts.length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-visual-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
