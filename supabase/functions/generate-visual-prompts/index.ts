import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER VISUAL PROMPTS v3 — Full DarkPlanner Training Applied
// Prompt length: 150-250 words | Movement trio | Policy compliance
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. ARRI ALEXA 65, Cooke Anamorphic lenses, Kodak Vision3 500T film emulation, ACES color science. Dramatic lighting, shallow DOF f/1.4-2.8, creamy bokeh. Lifted blacks, subtle halation. Volumetric god rays, atmospheric haze. Reference: Roger Deakins, Bradford Young.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector shapes, bold outlines, parallax depth layers, smooth 24fps feel. NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D render. Stylized characters, subsurface scattering, PBR materials, global illumination, strand-based hair, 8K textures.',
  'anime': 'Anime/manga style. Ufotable/MAPPA/WIT Studio quality, dynamic sakuga poses, Makoto Shinkai backgrounds, cel-shading, rim lighting, volumetric particles, dramatic speed lines.',
  'wojak': 'Wojak/meme internet art style. Simple drawn faces with strong emotional expressions, flat colors, minimalist backgrounds, internet culture aesthetic.',
  'stickmen': 'Stick figure art. Minimalist black line drawings, simple backgrounds, humor through simplicity and timing.',
  'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM lens, 8K resolution, natural available light, pore-level skin detail, strand-level hair. Zero AI artifacts. Documentary-grade realism.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents (cyan, magenta, amber). Dense volumetric fog. Blade Runner 2049 meets Se7en. Noir shadow patterns, wet reflective surfaces.',
  'whiteboard': 'Whiteboard animation. Hand-drawn black ink on white surface, strategic color highlights, educational clarity, smooth drawing reveal.',
  'comic': 'Comic book / graphic novel. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, saturated colors, dramatic perspective.',
  'fotorrealista_documentario': 'Documentary photography, natural soft lighting, shallow depth of field, desaturated earth tones, Canon 5D aesthetic.',
};

// ═══ POLICY COMPLIANCE — TRIGGER WORDS & ADAPTATIONS ═══
const POLICY_RULES = `
═══ POLICY COMPLIANCE — SENSITIVE CONTENT ADAPTATION (MANDATORY) ═══

🚫 TRIGGER WORDS — NEVER USE IN ANY PROMPT:
gun, weapon, pistol, rifle, knife, blade, sword, blood, bleeding, wound, injury, gore, visceral,
dead, corpse, body, cadaver, dying, naked, nude, sex, sexual, breast, genitals,
punch, kick, hit, attack, assault, beat, drugs, cocaine, heroin, needle, injection,
child abuse, minor, inappropriate

ADAPTATION TECHNIQUES (use these instead):
• VIOLENCE → TENSION/CONSEQUENCE:
  ❌ "punching victim, blood spattering"
  ✅ "aggressive body language, clenched fists at sides, high tension atmosphere, no physical contact shown, aftermath implied by expressions"

• WEAPONS → IMPLICATION:
  ❌ "pointing gun at suspect"
  ✅ "defensive stance, hand at holster, intense focused expression, no weapons visible in frame"

• DEATH → MEMORIAL/AFTERMATH:
  ❌ "dead body lying on ground"
  ✅ "white sheet covering shape on ground, police tape cordoning area, grief visible on face, respectful framing showing aftermath"

• ACCIDENTS → EMERGENCY RESPONSE:
  ❌ "car crash with injured people bleeding"
  ✅ "damaged vehicle with shattered glass on ground, emergency lights flashing, paramedics arriving, no injuries visible, focus on emergency response"

• RITUAL/SACRIFICE → CULTURAL RESPECT:
  ❌ "cutting animal's throat with knife"
  ✅ "holding animal respectfully in ceremonial gesture, cultural ritual documented respectfully, focus on spiritual moment not graphic action"
`;

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
            description: "Set visual prompts for each script segment matching the chosen art style (DarkPlanner v3 format)",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      visualPrompt: { type: "string", description: "150-250 word visual prompt following DarkPlanner v3 format. MANDATORY: movement trio (character+camera+environment), detailed environment with materials/textures, policy-compliant content, style modifiers, anti-text block at end." }
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
            content: `You are a WORLD-CLASS visual director creating prompts for AI video generation, trained on the DarkPlanner Professional System v3.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyle}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE:
- NEVER include text, subtitles, captions, logos, watermarks in ANY prompt
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

${POLICY_RULES}

═══ DARKPLANNER v3 PROMPT RULES ═══

1. PROMPT LENGTH: 150-250 words per prompt (MINIMUM 150 words). 
   Short prompts = bad/buggy generation. Detailed prompts = professional quality.

2. STYLE FIDELITY — MATCH THE ART STYLE EXACTLY:
   - For 2D styles: describe flat colors, clean lines, animation-style characters, vector art
   - For Wojak/meme: describe simple drawn faces, emotional expressions, internet meme look
   - For anime: describe anime aesthetic, cel-shading, expressive eyes, dynamic poses
   - For photorealistic: describe skin pores, fabric textures, natural imperfections
   - START every prompt with the art style descriptor

3. MANDATORY MOVEMENT TRIO — Every prompt MUST describe ALL THREE:
   🎭 CHARACTER MOVEMENT: walking, turning, reaching, breathing heavily, trembling, sitting down, standing up, raising arms, crying, running
   🎥 CAMERA MOVEMENT: slowly pushing in, pulling back, panning left/right, circling around, tracking shot, crane rising, dolly forward, static with subject moving
   🌿 ENVIRONMENT MOVEMENT: wind blowing curtains/hair, leaves falling, water flowing, smoke rising, dust motes floating, flames flickering, rain falling, clouds moving

4. ENVIRONMENT DETAIL — PREVENT WHITE/BUGGY BACKGROUNDS (CRITICAL):
   NEVER write vague descriptions. ALWAYS include ALL of:
   - Specific location with MATERIALS and TEXTURES (chipped tile, worn wood, rusted metal)
   - VISIBLE SURROUNDINGS (what's behind, beside, above the subject)
   - LIGHT SOURCE and DIRECTION (afternoon sun through window, fluorescent overhead, moonlight from left)
   - ATMOSPHERIC ELEMENTS (dust particles, fog, steam, heat haze, floating embers)
   - SMALL PROPS that add realism (potted plants, stacked papers, peeling paint, water stains)
   
   ❌ WRONG: "Person in a room"
   ❌ WRONG: "Man standing talking"
   ✅ RIGHT: "Person in modest kitchen with chipped tile counter, old appliances, worn wooden table with fruit bowl, warm afternoon light streaming through small curtained window, dust motes floating in light beam, cracked linoleum floor, faded calendar on wall"

5. STYLE MODIFIERS — Every prompt MUST end with style modifiers matching the art style, THEN the anti-text block.

6. ALL PROMPTS IN ENGLISH for best AI generation results.

7. FORMAT: NO numbering, NO scene titles, NO "CENA 1:" headers. Just the prompt text.`
          },
          {
            role: "user",
            content: `Generate visual prompts in "${styleKey}" style for these ${segments.length} narration segments.
RULES:
- Each prompt = 150-250 words (MINIMUM 150)
- Movement trio in EVERY prompt (character + camera + environment)
- Detailed environment with textures/materials/lighting
- Policy-compliant (no violence/weapons/blood — use adaptation techniques)
- Style modifiers + anti-text block at end

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

    // ═══ Post-Processing: DarkPlanner v3 Auto-Validation ═══
    const warnings: string[] = [];
    for (const p of parsed.prompts) {
      // Ensure anti-text suffix
      if (p.visualPrompt && !p.visualPrompt.includes("no subtitles")) {
        p.visualPrompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
      // Validate word count
      const wordCount = (p.visualPrompt || '').split(/\s+/).length;
      if (wordCount < 100) {
        warnings.push(`Segment ${p.segmentIndex}: Only ${wordCount} words (150-250 recommended)`);
      }
      // Check for policy trigger words
      const triggerWords = ['gun', 'weapon', 'pistol', 'knife', 'blood', 'wound', 'dead', 'corpse', 'naked', 'nude', 'punch', 'kick', 'attack'];
      const promptLower = (p.visualPrompt || '').toLowerCase();
      for (const tw of triggerWords) {
        if (promptLower.includes(tw)) {
          warnings.push(`Segment ${p.segmentIndex}: Policy trigger word "${tw}" detected — review needed`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      prompts: parsed.prompts,
      metadata: {
        system: "DarkPlanner Visual Prompts v3",
        style: styleKey,
        validationWarnings: warnings,
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
