import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER TRAINING v2 — Professional Video Prompt Engine
// Based on expert system for DarkPlanner Tools + Veo 3
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. Ultra-realistic, shot on ARRI ALEXA 65, Cooke Anamorphic S7/i lenses, Kodak Vision3 500T film emulation, ACES color science. Shallow DOF f/1.4-2.8, creamy bokeh. Lifted blacks, subtle halation. Reference: Roger Deakins, Bradford Young.',
  '2d': '2D flat animation, Kurzgesagt/Studio Trigger style. Vibrant flat colors, clean vector art, bold outlines, parallax depth layers, smooth 24fps. NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks/Illumination 3D. Subsurface scattering on skin, PBR materials, global illumination, ray-traced reflections. Strand-based hair, 8K textures.',
  'anime': 'Ufotable/MAPPA/WIT Studio anime. Dynamic sakuga key poses, Makoto Shinkai-level backgrounds, professional cel-shading, rim lighting, volumetric particle systems.',
  'wojak': 'Wojak/meme internet art style. Simple drawn faces, exaggerated emotional expressions, flat colors, minimalist backgrounds, internet meme aesthetic.',
  'stickmen': 'Stick figure animation. Minimalist black lines, simple backgrounds, humor through simplicity.',
  'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K resolution, natural available light, pore-level skin detail, strand-level hair. Documentary-grade realism.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accent lighting (cyan, magenta, amber). Dense volumetric fog. Blade Runner 2049 meets Se7en. Wet reflective surfaces.',
  'whiteboard': 'Whiteboard animation. Black ink sketches on white, hand-drawn, strategic color highlights. Educational clarity.',
  'comic': 'Premium graphic novel / Marvel comic art. Bold ink outlines, Ben-Day halftone dots, dynamic panel compositions, saturated colors.',
  'animal_chase': 'HYPER-REALISTIC WILDLIFE SURVIVAL. National Geographic meets Hollywood thriller. ARRI ALEXA Mini LF, 8K, 120fps slow-motion for chase sequences. Photorealistic animals with visible fur/feather detail. Dramatic volumetric lighting, golden hour or stormy skies. Handheld camera energy for chase POVs.',
  'fotorrealista_documentario': 'Documentary photography style, natural soft lighting, shallow depth of field, Canon 5D aesthetic, desaturated color palette with emphasis on earth tones.',
};

// ═══ POLICY COMPLIANCE — Content Adaptation Rules ═══
const POLICY_COMPLIANCE_BLOCK = `
═══ POLICY COMPLIANCE — ZERO TOLERANCE ═══
NEVER include in any prompt:
- Explicit violence (punches, kicks, injuries shown)
- Visible weapons (guns, knives, rifles, blades)
- Blood/gore (visible blood, open wounds)
- Graphic death (bodies, corpses, death scenes)
- Nudity/sexual content
- Drug use being shown
- Child abuse of any kind

TRIGGER WORDS TO AVOID: gun, weapon, pistol, rifle, knife, blade, sword, blood, bleeding, wound, injury, gore, dead, corpse, body, cadaver, dying, naked, nude, sex, sexual, punch, kick, hit, attack, assault, beat, drugs, cocaine, heroin, needle, injection, child abuse, minor, inappropriate

HOW TO ADAPT SENSITIVE CONTENT:
- Violence → Show TENSION/CONSEQUENCE: "aggressive body language, clenched fists at sides, high tension atmosphere, no physical contact shown"
- Weapons → Show IMPLICATION: "defensive stance, hand at holster, intense focused expression, no weapons visible in frame"
- Death → Show AFTERMATH/MEMORIAL: "white sheet covering shape on ground, police tape, grief visible on face, respectful framing"
- Accidents → Show RESPONSE: "damaged vehicle, emergency lights flashing, paramedics arriving, no injuries visible"
`;

// ═══ MOVEMENT RULES ═══
const MOVEMENT_RULES = `
═══ MANDATORY MOVEMENT IN EVERY PROMPT ═══
Every prompt MUST describe at least 2 types of movement:

CHARACTER MOVEMENT (when character present):
- walking, running, sitting down, standing up, turning head
- raising arms, reaching for, breathing heavily, trembling, crying
- hands moving methodically, shoulders slumping, leaning on surface

CAMERA MOVEMENT (always required):
- camera slowly pushing in, camera pulling back revealing
- camera circling around, camera panning left/right
- static camera with subject moving, tracking shot following
- crane shot ascending, dolly shot approaching, orbit shot

ENVIRONMENT MOVEMENT (add atmosphere):
- wind blowing curtains/hair, leaves falling, water flowing
- smoke rising, dust particles floating, flames flickering
- rain drops, light shifting, shadows moving
`;

// ═══ ENVIRONMENT DETAIL RULES ═══
const ENVIRONMENT_RULES = `
═══ ENVIRONMENT DETAIL — PREVENT WHITE/BUGGY BACKGROUNDS ═══
NEVER write vague environment descriptions. ALWAYS include:
1. Specific location with materials (e.g., "modest kitchen with chipped tile counter and old appliances")
2. What's visible through windows/doors
3. Lighting source and direction
4. Textures and surfaces
5. Small props/details that make it feel REAL

❌ WRONG: "[Character] standing talking on phone"
✅ RIGHT: "[Character] standing in modest kitchen with chipped tile counter, old refrigerator visible, window showing houses outside, talking on phone, late afternoon light through window"
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { segments, characterDescription, videoStyle, characters } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ═══ Build Character Identity Sheets (DarkPlanner format) ═══
    let characterBlock = '';
    if (characters?.length > 0) {
      characterBlock = characters.map((c: any, i: number) => {
        const a = c.appearance || {};
        const f = c.facial_features || {};
        const cl = c.clothing || {};
        // DarkPlanner format: 150-200 words, ALWAYS end with "waist up"
        return `[${c.name}]: ${c.gender || 'person'} age ${c.age || 'unknown'}, ${a.body_type || 'average'} build, ${a.skin_color || 'medium'} skin tone with natural pores and micro-imperfections, ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair with individual strand detail, ${a.eye_color || 'brown'} eyes showing ${f.eyebrows || 'natural'} expression, ${f.face_shape || 'oval'} face with ${f.nose || 'straight'} nose, wearing ${cl.shirt || 'casual top'} and ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}, natural skin texture with visible pores${c.imageUrl ? `, reference: ${c.imageUrl}` : ''}, waist up`;
      }).join('\n\n');
    } else if (characterDescription) {
      characterBlock = `[MainCharacter]: ${characterDescription}, waist up`;
    }

    const effectiveStyle = (videoStyle || 'cinematográfico').toLowerCase();
    const selectedStyleGuide = styleGuides[effectiveStyle] || styleGuides['cinematográfico'];

    const segmentTexts = segments.map((s: any, i: number) => `[${i}] "${s.text}"`).join('\n');

    // Calculate recommended prompt count based on DarkPlanner formula
    const estimatedDuration = segments.length * 40; // rough estimate
    const promptNote = `Generating ${segments.length} prompts for approximately ${Math.round(estimatedDuration / 60)} minutes of content.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a WORLD-CLASS visual director creating prompts for Google Veo 3 video generation, trained on the DarkPlanner professional prompt system.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
- NEVER include text, subtitles, captions, titles, logos, watermarks, writing of ANY kind
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

${POLICY_COMPLIANCE_BLOCK}

${MOVEMENT_RULES}

${ENVIRONMENT_RULES}

═══ DARKPLANNER PROMPT MASTERY RULES ═══

1. PROMPT LENGTH: 150-250 words per prompt (MINIMUM 150). Long, detailed prompts produce better Veo3 results.

2. CHARACTER CONSISTENCY PROTOCOL (MOST IMPORTANT RULE):
   - Character descriptions MUST be COPIED WORD-FOR-WORD from the identity sheet below
   - NEVER paraphrase, summarize, or vary the description
   - ❌ WRONG: "wearing yellow dress" → ❌ "in her yellow outfit" → ❌ "dressed in blue"
   - ✅ RIGHT: Copy the EXACT same wording every single time
   - This ensures Veo3 generates the SAME person across all prompts

3. MAXIMUM 2 CHARACTERS PER PROMPT:
   - Using >2 [Names] causes inconsistency and quality drop
   - If scene needs 3+ characters: split into multiple prompts
   - Option A: [Person1] speaking, others blurred in background
   - Option B: Shot-reverse-shot between pairs
   - Option C: Wide group shot WITHOUT [Names], describe by position

4. PROMPT STRUCTURE (DarkPlanner Template):
   WITH CHARACTER: [Name] [specific action with movement verbs], [detailed body movement], [facial expression/emotion], [interaction with environment/objects], [clothing — COPY EXACTLY from definition], camera [movement: zoom in/out, pan, push, pull, circle, static], [visible environment elements], [specific lighting], [atmosphere/mood], [style modifiers]
   WITHOUT CHARACTER: [Specific location/object], [detailed visual elements], [lighting conditions], [time of day], [weather/atmosphere], camera [movement], [perspective/angle], [texture and details], [dominant colors], [mood/feeling], [style modifiers]

5. SEGMENT 0 = HOOK — Most visually spectacular shot. Must combine MYSTERY + SCALE + MOTION + DETAIL.

6. CAMERA VARIETY: Never repeat camera angles in consecutive segments. Mandatory rotation.

7. DOPAMINERGIC: First 3s of each scene must trigger curiosity.

8. ALL PROMPTS IN ENGLISH.

9. Style modifiers from the art style MUST appear at the END of EVERY prompt, before the anti-text block.

${characterBlock ? `\n═══ CHARACTER IDENTITY SHEETS — COPY VERBATIM IN EVERY PROMPT ═══\n${characterBlock}\n\n⚠️ ABSOLUTE RULE: Include FULL character description block in EVERY prompt they appear in. Use IDENTICAL wording — never paraphrase. Always end character description with "waist up".` : ''}`
          },
          {
            role: "user",
            content: `Generate Veo3 prompts for each narration segment. ${promptNote}
Segment 0 = HOOK (most stunning).
ZERO text/subtitles in any prompt.
Each prompt = 150-250 words with mandatory movement (character + camera + environment).
Character descriptions COPIED EXACTLY from identity sheets.
Max 2 characters per prompt.

Segments:\n${segmentTexts}`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_veo3_prompts",
            description: "Return Veo3-optimized prompts following DarkPlanner professional system",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      veo3Prompt: { type: "string", description: "150-250 word prompt using DarkPlanner template. Include mandatory movement (character + camera + environment). Character descriptions COPIED VERBATIM. MUST end with anti-text block and style modifiers." },
                      negativePrompt: { type: "string", description: "Always include ALL: subtitles, text, titles, captions, logos, watermarks, writing, letters, words, lower thirds, on-screen graphics, burned-in text, UI elements, blurry, distorted, deformed hands, extra fingers, six fingers, fused fingers, melted hands, mutated body parts, bad anatomy, disfigured, poorly drawn face, amateur, low quality, jpeg artifacts, oversaturated, underexposed" },
                      shotType: { type: "string", description: "ECU, CU, MCU, MS, MLS, FS, LS, ELS, OTS, bird's eye, worm's eye" },
                      cameraMovement: { type: "string", description: "dolly, tracking, crane, steadicam, slow pan, orbit, push-in, pull-out, rack focus" },
                      lensSpec: { type: "string", description: "24mm, 35mm, 50mm, 85mm, 135mm, anamorphic" },
                      lightingSetup: { type: "string", description: "golden hour, Rembrandt, butterfly, rim, volumetric, chiaroscuro" },
                      audioDirection: { type: "string", description: "Ambient sounds, foley, music mood" },
                      charactersInPrompt: { type: "array", items: { type: "string" }, description: "Names of characters in this prompt (max 2)" },
                      movementDescription: { type: "string", description: "Summary of all movement types: character action + camera move + environment motion" },
                    },
                    required: ["segmentIndex", "veo3Prompt", "negativePrompt", "shotType", "cameraMovement", "lensSpec", "lightingSetup"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["prompts"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_veo3_prompts" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");
    const parsed = JSON.parse(toolCall.function.arguments);

    // ═══ Post-Processing Validation (DarkPlanner Auto-Validation) ═══
    const validationWarnings: string[] = [];
    for (const prompt of parsed.prompts) {
      // Check prompt length
      const wordCount = prompt.veo3Prompt.split(/\s+/).length;
      if (wordCount < 100) {
        validationWarnings.push(`Prompt ${prompt.segmentIndex}: Only ${wordCount} words (minimum 150 recommended)`);
      }
      // Ensure anti-text suffix
      if (!prompt.veo3Prompt.includes("no subtitles")) {
        prompt.veo3Prompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
    }

    return new Response(JSON.stringify({
      ...parsed,
      metadata: {
        system: "DarkPlanner Training v2",
        style: effectiveStyle,
        totalPrompts: parsed.prompts.length,
        charactersUsed: characters?.length || 0,
        validationWarnings,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-veo3-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
