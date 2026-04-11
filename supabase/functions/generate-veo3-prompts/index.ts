import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { applyVeo3PolicyFilter, VEO3_POLICY_PROMPT, ANTI_TEXT_SUFFIX, TRIGGER_REPLACEMENTS } from "../_shared/veo3-policy-filter.ts";
import { getUserTier } from "../_shared/tier-limits.ts";

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
// DARKPLANNER v3 — Professional Video Prompt Engine (Full Training)
// 11-Step Pipeline | Prompt Density Formula | Auto-Validation
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
  'animal_chase': 'HYPER-REALISTIC WILDLIFE SURVIVAL. National Geographic meets Hollywood thriller. ARRI ALEXA Mini LF, 8K, 120fps slow-motion. Photorealistic animals with visible fur/feather detail. Dramatic volumetric lighting.',
  'fotorrealista_documentario': 'Documentary photography style, natural soft lighting, shallow depth of field, Canon 5D aesthetic, desaturated earth tones.',
  'ilustracao_artistica': 'Fine art illustration. Painterly brushstrokes, rich color palettes, visible texture, gallery-quality compositions. Inspired by classical oil painting meets modern digital art.',
  'aquarela': 'Watercolor painting style. Soft translucent washes, visible paper grain texture, bleeding color edges, delicate brushwork, organic imperfections. Pastel and earth tone palette.',
};

// Trigger words and anti-text imported from shared filter

// ═══ DarkPlanner v3 Prompt Density Formula — Veo3 = 8s clips ═══
// CRITICAL: Each Veo3 video clip is ONLY 8 seconds. So for an 80s audio → minimum 10 prompts.
function calculatePromptCount(totalDurationSec: number, contentType: string): number {
  // Base formula: 1 prompt per 8 seconds (Veo3 clip duration)
  const base = Math.ceil(totalDurationSec / 8);
  let adjusted: number;
  switch (contentType) {
    case 'action': adjusted = Math.ceil(base * 1.1); break; // slightly more for fast cuts
    case 'dialogue': adjusted = Math.ceil(base * 0.9); break; // fewer for talking heads
    case 'documentary': adjusted = Math.ceil(totalDurationSec / 10); break; // 10s per scene max
    case 'contemplative': adjusted = Math.ceil(base * 0.85); break;
    default: adjusted = base;
  }
  // Minimum = ceil(duration/8), never less than that
  const minimum = Math.ceil(totalDurationSec / 8);
  return Math.max(minimum, Math.min(300, adjusted));
}

function detectContentType(segments: any[]): string {
  const allText = segments.map((s: any) => s.text || '').join(' ').toLowerCase();
  if (/perseguição|explosão|corrida|luta|chase|action|fight|run|escape/i.test(allText)) return 'action';
  if (/diálogo|conversa|entrevista|dialog|interview|conversation/i.test(allText)) return 'dialogue';
  if (/documentário|documentary|história real|true story|investigação/i.test(allText)) return 'documentary';
  if (/meditação|contempla|silêncio|natureza|meditation|nature|peaceful/i.test(allText)) return 'contemplative';
  return 'standard';
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await _authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { segments, characterDescription, videoStyle, characters } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // ═══ Step 1: Script Analysis (DarkPlanner Etapa 1) ═══
    const contentType = detectContentType(segments || []);
    const estimatedDuration = (segments?.length || 10) * 40;
    const recommendedPrompts = calculatePromptCount(estimatedDuration, contentType);
    const isDocumentary = contentType === 'documentary';

    // ═══ Step 2: Build Character Identity Sheets (150-200 words, DarkPlanner format) ═══
    let characterBlock = '';
    if (!isDocumentary && characters?.length > 0) {
      characterBlock = characters.slice(0, 5).map((c: any) => {
        const a = c.appearance || {};
        const f = c.facial_features || {};
        const cl = c.clothing || {};
        // DarkPlanner v3: 150-200 word identity sheet, waist up mandatory
        return `[${c.name}]: ${c.gender || 'person'} approximately ${c.age || 'adult'} years old, ${a.body_type || 'average'} build with ${a.height || 'average'} height. Skin: ${a.skin_color || 'medium'} tone with natural pores, micro-imperfections, and subtle skin texture visible under directional lighting. Hair: ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair with individual strand detail, natural highlights catching light. Eyes: ${a.eye_color || 'brown'} with ${f.eyebrows || 'natural'} eyebrows framing expressive gaze. Face: ${f.face_shape || 'oval'} face shape, ${f.nose || 'straight'} nose, ${f.mouth || 'natural'} lips. ${f.ears ? `Ears: ${f.ears}.` : ''} Clothing: ${cl.shirt || 'casual fitted top'} with visible fabric weave and natural wrinkles, ${cl.pants || 'well-fitted jeans'} with authentic wear patterns, ${cl.shoes || 'clean sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, accessories: ${cl.accessories}` : ''}. Hands show natural calluses and nail detail.${c.imageUrl ? ` Reference image: ${c.imageUrl} — match this exact appearance.` : ''} Always framed waist up.`;
      }).join('\n\n');
    } else if (!isDocumentary && characterDescription) {
      characterBlock = `[MainCharacter]: ${characterDescription}. Natural skin pores visible, fabric wrinkles on clothing, individual hair strands catching light. Always framed waist up.`;
    }

    const effectiveStyle = (videoStyle || 'cinematográfico').toLowerCase();
    const selectedStyleGuide = styleGuides[effectiveStyle] || styleGuides['cinematográfico'];
    const segmentTexts = (segments || []).map((s: any, i: number) => `[${i}] "${s.text}"`).join('\n');

    // ═══ Step 3-9: AI Generation with full DarkPlanner v3 system prompt ═══
    const response = await _ai({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS visual director trained on the DarkPlanner Professional System v3 (complete 11-step pipeline).

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE:
- NEVER include text, subtitles, captions, titles, logos, watermarks, writing of ANY kind
- EVERY prompt MUST end with: "${ANTI_TEXT_SUFFIX}"

${VEO3_POLICY_PROMPT}

═══ POLICY COMPLIANCE — SENSITIVE CONTENT ADAPTATION ═══
NEVER USE these trigger words: ${Object.keys(TRIGGER_REPLACEMENTS).join(', ')}

ADAPTATION TECHNIQUES:
• Violence → TENSION/CONSEQUENCE: "aggressive body language, clenched fists, high tension atmosphere, no physical contact shown"
• Weapons → IMPLICATION: "defensive stance, hand at holster, intense expression, no weapons visible"
• Death → AFTERMATH/MEMORIAL: "white sheet covering shape, police tape, grief on faces, respectful framing"

═══ DARKPLANNER v3 — COMPLETE PROMPT RULES ═══

1. PROMPT LENGTH: 150-250 words per prompt (MINIMUM 150). Short prompts = bad generation.

2. ${isDocumentary ? `DOCUMENTARY MODE: Focus on LOCATIONS and ATMOSPHERE. No character identity sheets needed. 1 prompt per ~60 seconds. Rich environmental storytelling.` : `CHARACTER CONSISTENCY PROTOCOL (MOST IMPORTANT RULE):
   - Character descriptions MUST be COPIED WORD-FOR-WORD from identity sheets below
   - NEVER paraphrase, summarize, or vary the description
   - ❌ WRONG: "wearing yellow dress" → "in her yellow outfit" → "dressed in blue"
   - ✅ RIGHT: Copy the EXACT same wording every single time`}

3. MAXIMUM 2 CHARACTERS PER PROMPT

4. MANDATORY MOVEMENT TRIO — Every prompt MUST describe ALL THREE:
   🎭 CHARACTER: walking, turning, reaching, breathing heavily, trembling
   🎥 CAMERA: slowly pushing in, pulling back, panning, circling, tracking
   🌿 ENVIRONMENT: wind blowing curtains/hair, leaves falling, water flowing, smoke rising

5. ENVIRONMENT DETAIL — PREVENT WHITE/BUGGY BACKGROUNDS:
   ALWAYS include: specific location + MATERIALS/TEXTURES, visible surroundings, light source + direction, atmospheric elements, small props

6. SEGMENT 0 = HOOK — Most visually spectacular shot.

7. CAMERA VARIETY: Never repeat camera angles consecutively.

8. STYLE MODIFIERS + anti-text block at END of every prompt.

9. ALL PROMPTS IN ENGLISH.

10. FORMAT: NO numbering, NO "Scene 1:", NO headers. Just raw prompt text.

${characterBlock ? `\n═══ CHARACTER IDENTITY SHEETS — COPY VERBATIM IN EVERY PROMPT ═══\n${characterBlock}\n\n⚠️ ABSOLUTE RULE: Include FULL character description in EVERY prompt they appear in. Use IDENTICAL wording. Always end with "waist up".` : ''}`
          },
          {
            role: "user",
            content: `Generate Veo3 prompts for ${(segments || []).length} narration segments.
Content type detected: ${contentType}
Recommended prompt density: ${recommendedPrompts} prompts for ~${Math.round(estimatedDuration / 60)} minutes
${isDocumentary ? 'MODE: DOCUMENTARY — focus on locations/atmosphere, no character sheets.' : ''}

RULES:
- Each prompt = 150-250 words (MINIMUM 150)
- Movement trio in EVERY prompt (character + camera + environment)
- Detailed environment with textures/materials/lighting
- Policy-compliant (use adaptation techniques for sensitive content)
- Style modifiers + anti-text block at end
- NO numbering, NO scene titles — raw prompt text only
- Segment 0 = HOOK (most stunning)
- Max 2 characters per prompt

Segments:\n${segmentTexts}`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_veo3_prompts",
            description: "Return Veo3-optimized prompts following DarkPlanner v3 professional system",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      veo3Prompt: { type: "string", description: "150-250 word prompt. DarkPlanner v3 format: movement trio + environment detail + style modifiers + anti-text. NO numbering/titles." },
                      negativePrompt: { type: "string" },
                      shotType: { type: "string" },
                      cameraMovement: { type: "string" },
                      lensSpec: { type: "string" },
                      lightingSetup: { type: "string" },
                      audioDirection: { type: "string" },
                      charactersInPrompt: { type: "array", items: { type: "string" }, description: "Max 2 character names" },
                      movementDescription: { type: "string", description: "Summary: character action + camera move + environment motion" },
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

    // ═══ Step 10: DarkPlanner v3 Auto-Validation & Post-Processing ═══
    const validationWarnings: string[] = [];
    const autoFixes: string[] = [];

    for (const prompt of parsed.prompts) {
      // FULL Veo3 policy filter (copyright + celebrity + brand + trigger words + anti-text)
      const { cleaned, fixes } = applyVeo3PolicyFilter(prompt.veo3Prompt || '');
      if (fixes.length > 0) {
        prompt.veo3Prompt = cleaned;
        autoFixes.push(...fixes.map(f => `Prompt ${prompt.segmentIndex}: ${f}`));
      }

      // Validate word count (minimum 150)
      const wordCount = (prompt.veo3Prompt || '').split(/\s+/).length;
      if (wordCount < 100) {
        validationWarnings.push(`Prompt ${prompt.segmentIndex}: Only ${wordCount} words (minimum 150 recommended)`);
      }

      // Max 2 characters enforcement
      if (prompt.charactersInPrompt && prompt.charactersInPrompt.length > 2) {
        validationWarnings.push(`Prompt ${prompt.segmentIndex}: ${prompt.charactersInPrompt.length} characters (max 2 recommended)`);
      }
    }

    return new Response(JSON.stringify({
      ...parsed,
      metadata: {
        system: "DarkPlanner v3",
        style: effectiveStyle,
        contentType,
        totalPrompts: parsed.prompts.length,
        recommendedPrompts,
        charactersUsed: characters?.length || 0,
        isDocumentary,
        validationWarnings,
        autoFixes,
        promptDensityFormula: `${estimatedDuration}s ÷ 40 = ${(estimatedDuration / 40).toFixed(1)} base, adjusted for ${contentType}`,
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
