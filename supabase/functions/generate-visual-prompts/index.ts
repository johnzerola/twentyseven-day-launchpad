import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT, ANTI_TEXT_SUFFIX } from "../_shared/veo3-policy-filter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER v3 — Visual Prompts Engine (Full Training + Veo3 Policy)
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. ARRI ALEXA 65, Cooke Anamorphic lenses, Kodak Vision3 500T film emulation, ACES color science. Dramatic lighting, shallow DOF f/1.4-2.8, creamy bokeh. Lifted blacks, subtle halation. Volumetric god rays, atmospheric haze.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector shapes, bold outlines, parallax depth layers, smooth 24fps feel. NO 3D, NO photorealistic.',
  '3d': '3D render. Stylized characters, subsurface scattering, PBR materials, global illumination, strand-based hair, 8K textures.',
  'anime': 'Anime/manga style. Dynamic sakuga poses, beautiful backgrounds, cel-shading, rim lighting, volumetric particles, dramatic speed lines.',
  'wojak': 'Wojak/meme internet art style. Simple drawn faces with strong emotional expressions, flat colors, minimalist backgrounds, internet culture aesthetic.',
  'stickmen': 'Stick figure art. Minimalist black line drawings, simple backgrounds, humor through simplicity and timing.',
  'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM lens, 8K resolution, natural available light, pore-level skin detail, strand-level hair. Zero AI artifacts. Documentary-grade realism.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents (cyan, magenta, amber). Dense volumetric fog. Noir shadow patterns, wet reflective surfaces.',
  'whiteboard': 'Whiteboard animation. Hand-drawn black ink on white surface, strategic color highlights, educational clarity, smooth drawing reveal.',
  'comic': 'Comic book / graphic novel. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, saturated colors, dramatic perspective.',
  'fotorrealista_documentario': 'Documentary photography, natural soft lighting, shallow depth of field, desaturated earth tones, Canon 5D aesthetic.',
  'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes, gallery-quality compositions. Classical oil painting meets modern digital art.',
  'aquarela': 'Watercolor painting. Soft translucent washes, visible paper grain, bleeding color edges, delicate brushwork, organic imperfections.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { segments, videoStyle, customStyleNotes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!segments?.length) throw new Error("Segments array required");

    const styleKey = (videoStyle || 'cinematográfico').toLowerCase();
    const selectedStyle = styleGuides[styleKey] || styleGuides['cinematográfico'];
    const segmentTexts = segments.map((s: any, i: number) => `Segment ${i + 1}: "${s.text}"`).join("\n");

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

🚫 ZERO TOLERANCE: NEVER include text/subtitles/logos. End EVERY prompt with: "${ANTI_TEXT}"

═══ TRIGGER WORDS — NEVER USE: gun, weapon, knife, blood, dead, corpse, naked, punch, kick, attack, drugs, needle
Use adaptation techniques instead (tension/implication/aftermath).

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
   ❌ "Person in a room"
   ✅ "Person in modest kitchen with chipped tile counter, old appliances, warm afternoon light through curtained window, dust motes floating"

5. Style modifiers + anti-text at END of every prompt.
6. ALL PROMPTS IN ENGLISH.
7. FORMAT: NO numbering, NO scene titles, NO "CENA 1:". Just raw prompt text.`
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

    // ═══ DarkPlanner v3 Auto-Validation & Post-Processing ═══
    const warnings: string[] = [];
    const autoFixes: string[] = [];

    for (const p of parsed.prompts) {
      // 1. Trigger word scanner + auto-fix
      const { fixed, warnings: twWarnings } = scanAndFixTriggerWords(p.visualPrompt || '');
      if (twWarnings.length > 0) {
        p.visualPrompt = fixed;
        autoFixes.push(...twWarnings.map(w => `Seg ${p.segmentIndex}: ${w}`));
      }

      // 2. Ensure anti-text suffix
      if (p.visualPrompt && !p.visualPrompt.includes("no subtitles")) {
        p.visualPrompt += ` ${ANTI_TEXT}`;
      }

      // 3. Validate word count
      const wordCount = (p.visualPrompt || '').split(/\s+/).length;
      if (wordCount < 100) {
        warnings.push(`Segment ${p.segmentIndex}: Only ${wordCount} words (150-250 recommended)`);
      }

      // 4. Remove leaked numbering/titles
      if (p.visualPrompt) {
        p.visualPrompt = p.visualPrompt.replace(/^(Scene|Cena|Prompt|Segmento)\s*\d+\s*[:—-]\s*/i, '');
      }
    }

    return new Response(JSON.stringify({
      prompts: parsed.prompts,
      metadata: {
        system: "DarkPlanner Visual Prompts v3",
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
