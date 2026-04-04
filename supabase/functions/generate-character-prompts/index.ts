import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER CHARACTER IDENTITY SYSTEM v3
// Full DarkPlanner Training Applied — Policy Compliance + Verbatim Copy
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. Ultra-realistic, ARRI ALEXA 65, Kodak Vision3 film grain, dramatic lighting. Skin with natural pores, micro-imperfections, strand-level hair detail. Reference: Roger Deakins cinematography.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector linework, character design sheets in flat art style. NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D. Stylized 3D characters, subsurface scattering, PBR materials, global illumination, strand-based hair.',
  'anime': 'Anime/manga style. Ufotable/MAPPA/WIT Studio. Dynamic sakuga poses, Makoto Shinkai backgrounds, cel-shading, expressive eyes, rim lighting.',
  'wojak': 'Wojak/meme art style. Simple drawn faces, exaggerated emotions, internet meme aesthetic, flat colors, minimal detail.',
  'stickmen': 'Stick figure style. Minimalist black line art, simple colored backgrounds, humor through simplicity.',
  'realista': 'Hyper-photorealistic. Sony A7R V, 85mm f/1.2 GM, 8K, pore-level detail, strand-level hair. Zero AI artifacts.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accent lighting, dense volumetric fog, Blade Runner 2049 aesthetic.',
  'whiteboard': 'Whiteboard sketch style. Black ink on white, hand-drawn look, strategic color highlights.',
  'comic': 'Premium graphic novel. Bold ink outlines, Ben-Day halftone dots, dynamic compositions, rich saturated colors.',
  'fotorrealista_documentario': 'Documentary photography style, natural soft lighting, shallow depth of field, Canon 5D aesthetic, desaturated earth tones.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { characters, scenes, visualStyle, videoStyle, customStyleNotes } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

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

    const res = await _ai({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS character design director creating consistent character prompts for video generation, trained on the DarkPlanner Professional System v3.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
- NEVER include text, subtitles, captions, titles, logos, watermarks in ANY prompt
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

═══ POLICY COMPLIANCE — SENSITIVE CONTENT ADAPTATION ═══
🚫 TRIGGER WORDS — NEVER USE IN ANY PROMPT:
gun, weapon, pistol, rifle, knife, blade, sword, blood, bleeding, wound, injury, gore,
dead, corpse, naked, nude, sex, sexual, punch, kick, hit, attack, assault, drugs

ADAPTATION TECHNIQUES:
• VIOLENCE → TENSION: "aggressive body language, clenched fists, high tension, no physical contact shown"
• WEAPONS → IMPLICATION: "defensive stance, hand at holster, no weapons visible in frame"
• DEATH → AFTERMATH: "covered shape on ground, grief visible, respectful framing"
• INJURIES → AFTERMATH: "disheveled appearance, exhaustion visible, aftermath implied by expressions"
═══════════════════════════════════════

═══ DARKPLANNER CHARACTER IDENTITY SHEET v3 (MANDATORY FORMAT) ═══

Each character definition MUST follow this EXACT template (150-200 words, ALWAYS end with "waist up"):

[Name]: [ethnicity/nationality] [gender] age [exact age], [body type] body [showing trait], [skin tone] skin tone with [skin texture detail], [hair color/length/style] with [hair detail], [eye color] eyes showing [expression], [eyebrow shape], [face shape] face, [nose type] nose, [mouth/lip description], wearing [SPECIFIC clothing — fabric, color, pattern, condition], [shoes with condition], [accessories — jewelry, glasses, watch, etc.], [distinctive marks — scars, tattoos, moles, wrinkles], [expression/posture], [style modifiers matching art style], waist up

CRITICAL RULES:
1. Maximum 200 words per character definition
2. ALWAYS end with "waist up" (DarkPlanner framing requirement)
3. Include style modifiers at the end matching the chosen art style
4. Be HYPER-SPECIFIC — NOT "nice clothes" → "faded yellow cotton dress with small floral pattern"
5. Include physical details for CONSISTENCY: exact skin tone, specific hair style, eye expression
6. Include DISTINGUISHING MARKS: scars, jewelry, tattoos, glasses, wrinkles, calluses
7. For realistic styles: mention natural skin pores, weathered hands, specific aging details
8. For 2D/Wojak/meme: describe drawn style, line thickness, color palette
9. For anime: describe anime-specific features (eye style, hair highlights, cel-shading)
10. Recommend MAX 3-5 characters for best quality and consistency

═══ SCENE PROMPT RULES (DarkPlanner v3) ═══

1. 150-250 words per scene prompt (MINIMUM 150 words)

2. CHARACTER CLOTHING/APPEARANCE MUST BE COPIED WORD-FOR-WORD from identity sheet:
   ❌ WRONG: Prompt 1 "wearing yellow dress" → Prompt 2 "in her yellow outfit"
   ✅ RIGHT: IDENTICAL text in EVERY prompt — CTRL+C / CTRL+V always
   This is the MOST IMPORTANT rule. Paraphrasing = different person in Veo3.

3. Maximum 2 characters per prompt:
   - If scene has 3+ people, SPLIT into multiple prompts:
     Prompt A: [Person1] speaking, others blurred in background
     Prompt B: [Person2] reacting, shot-reverse-shot
     Prompt C: Wide group shot WITHOUT [Names], only physical descriptions

4. MANDATORY MOVEMENT TRIO in every prompt:
   🎭 CHARACTER: walking, turning, reaching, breathing, trembling, sitting, gesturing
   🎥 CAMERA: pushing in, pulling back, panning, circling, tracking, crane, static
   🌿 ENVIRONMENT: wind, particles, water, smoke, light shifting, curtains moving, leaves

5. DETAILED ENVIRONMENT (prevent white/buggy backgrounds):
   - Specific location with materials and textures
   - Visible surroundings, props, set dressing
   - Light source and direction
   - Atmospheric elements (dust, fog, steam, particles)
   ❌ WRONG: "[Maria] standing talking"
   ✅ RIGHT: "[Maria] standing in modest kitchen with chipped tile counter, old refrigerator visible, window showing houses outside, afternoon light through curtain, dust motes in light beam"

6. Style modifiers at end of every prompt, then anti-text block

EXAMPLE (Photorealistic Documentary):
[Maria]: Brazilian woman age 45, full-figured maternal body showing years of hard work, medium brown skin tone with natural pores and sun spots, short black hair with gray streaks pulled back in simple bun with loose strands framing face, deep brown eyes showing fatigue and determination, well-defined arched eyebrows, oval face with laugh lines, medium straight nose, thin lips slightly pursed, wearing faded yellow cotton house dress with small floral pattern and brown worn leather sandals with scuffed soles, simple gold wedding band on left hand, small gold stud earrings, weathered hands with calluses from domestic work, standing in modest kitchen, warm maternal expression despite visible exhaustion, photorealistic documentary photography style, natural soft window lighting, shallow depth of field, Canon 5D aesthetic, desaturated earth tones, waist up

IMPORTANT: All character designs and scene prompts MUST be in ${styleKey} style. Do NOT mix styles.`
          },
          {
            role: "user",
            content: `Create character-consistent prompts in "${styleKey}" style following DarkPlanner v3.

RULES:
- ZERO text/subtitles anywhere
- Each character definition = 150-200 words ending with "waist up"
- Each scene prompt = 150-250 words with mandatory movement trio
- Character descriptions COPIED VERBATIM across all prompts — NEVER paraphrase
- Max 2 characters per prompt — split if more needed
- Detailed environment in every prompt (prevent buggy backgrounds)
- Policy-compliant: no violence/weapons/blood — use adaptation techniques

CHARACTERS:\n${characterDescriptions}

SCENES:\n${sceneTexts}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "character_consistent_prompts",
            description: "Return DarkPlanner v3 character sheets (150-200w, ending 'waist up') and scene prompts (150-250w) with consistent characters",
            parameters: {
              type: "object",
              properties: {
                characterSheets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      physicalDescription: { type: "string", description: "150-200 word detailed appearance in DarkPlanner v3 format. MUST end with 'waist up'." },
                      outfit: { type: "string", description: "Exact clothing description to be COPIED VERBATIM in every prompt — never paraphrase" },
                      distinctiveFeatures: { type: "string", description: "Unique marks, accessories, posture, scars, tattoos, jewelry" },
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
                      prompt: { type: "string", description: "150-250 word prompt with embedded character descriptions COPIED VERBATIM. Mandatory movement trio. Detailed environment. MUST end with anti-text block." },
                      negativePrompt: { type: "string", description: "Always include: subtitles, text, titles, captions, logos, watermarks, writing, letters, blurry, distorted, deformed, gun, weapon, blood" },
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

    // ═══ Post-Processing: DarkPlanner v3 Auto-Validation ═══
    const warnings: string[] = [];

    // Validate character sheets
    for (const sheet of result.characterSheets || []) {
      if (!sheet.referencePrompt?.toLowerCase().includes("waist up")) {
        sheet.referencePrompt = (sheet.referencePrompt || '') + ", waist up";
        warnings.push(`Character "${sheet.name}": Added missing "waist up" ending`);
      }
      if (!sheet.physicalDescription?.toLowerCase().includes("waist up")) {
        sheet.physicalDescription = (sheet.physicalDescription || '') + ", waist up";
        warnings.push(`Character "${sheet.name}": Added missing "waist up" to physical description`);
      }
      const words = (sheet.physicalDescription || '').split(/\s+/).length;
      if (words < 100) {
        warnings.push(`Character "${sheet.name}": Description only ${words} words (150-200 recommended)`);
      }
      // Anti-text on reference prompt
      if (sheet.referencePrompt && !sheet.referencePrompt.includes("no subtitles")) {
        sheet.referencePrompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
    }

    // Validate scene prompts
    const triggerWords = ['gun', 'weapon', 'pistol', 'knife', 'blood', 'wound', 'dead', 'corpse', 'naked', 'nude', 'punch', 'kick', 'attack'];
    for (const scene of result.scenePrompts || []) {
      // Anti-text block
      if (!scene.prompt?.includes("no subtitles")) {
        scene.prompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
      // Word count validation
      const wordCount = (scene.prompt || '').split(/\s+/).length;
      if (wordCount < 100) {
        warnings.push(`Scene ${scene.sceneIndex}: Only ${wordCount} words (150-250 recommended)`);
      }
      // Max 2 characters check
      if (scene.charactersPresent && scene.charactersPresent.length > 2) {
        warnings.push(`Scene ${scene.sceneIndex}: ${scene.charactersPresent.length} characters detected (max 2 recommended)`);
      }
      // Policy compliance check
      const promptLower = (scene.prompt || '').toLowerCase();
      for (const tw of triggerWords) {
        if (promptLower.includes(tw)) {
          warnings.push(`Scene ${scene.sceneIndex}: Policy trigger word "${tw}" detected — review needed`);
        }
      }
    }

    return new Response(JSON.stringify({
      ...result,
      metadata: {
        system: "DarkPlanner Character System v3",
        style: styleKey,
        validationWarnings: warnings,
        characterCount: result.characterSheets?.length || 0,
        sceneCount: result.scenePrompts?.length || 0,
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
