import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { segments, characterDescription, videoStyle, characters } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build character block from structured data or description
    let characterBlock = '';
    if (characters?.length > 0) {
      characterBlock = characters.map((c: any, i: number) => {
        const a = c.appearance || {};
        const f = c.facial_features || {};
        const cl = c.clothing || {};
        return `CHARACTER ${i + 1} "${c.name}": ${c.gender || ''} ${c.age || ''}, ${a.body_type || 'average'} build, ${a.skin_color || 'medium'} skin with natural pores, ${a.hair_color || 'dark'} ${a.hair_style || 'short'} hair, ${a.eye_color || 'brown'} eyes, ${f.face_shape || 'oval'} face. Wearing ${cl.shirt || 'casual top'}, ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}.${c.imageUrl ? ` Reference: ${c.imageUrl}` : ''}`;
      }).join('\n');
    } else if (characterDescription) {
      characterBlock = `MAIN CHARACTER: ${characterDescription}`;
    }

    const segmentTexts = segments.map((s: any, i: number) => `[${i}] "${s.text}"`).join('\n');

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
            content: `You are a WORLD-CLASS visual director creating prompts for Google Veo 3 video generation.

═══════════════════════════════════════
🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
═══════════════════════════════════════
- NEVER include text, subtitles, captions, titles, logos, watermarks, writing of ANY kind
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
═══════════════════════════════════════

VEO 3 MASTER PROMPT FORMULA v2.0:
[SHOT_TYPE + CAMERA_MOTION], [LENS_SPEC] with [DOF_SETTING].
[CHARACTER — FULL identity VERBATIM if applicable].
[ACTION — cinematic description].
[ENVIRONMENT — specific, sensory, atmospheric].
[LIGHTING_SETUP — exact type + modifiers].
[ATMOSPHERIC — particles, fog, rain, dust, embers].
[COLOR_GRADE — film stock reference].
[ANTI_AI_REALISM — skin pores, motion blur, film grain, lens artifacts].
Quality: masterpiece, award-winning, 8K UHD, Kodak Vision3, ACES.
Audio: ambient + foley + music mood.
(anti-text block)

RULES:
1. 100-200 words per prompt. Use EXACT professional film terminology Veo3 understands: dolly-in, tracking shot, crane shot, steadicam, orbit shot, push-in, pull-out, rack focus, Dutch angle, POV, handheld.
2. Specify exact lens: 24mm wide, 35mm, 50mm, 85mm portrait, 135mm telephoto, or anamorphic.
3. Specify exact lighting: golden hour, Rembrandt, butterfly, split, rim/edge, volumetric/god rays, chiaroscuro, practical lights, neon glow.
4. Anti-AI realism in every prompt: natural skin pores, asymmetric composition, motion blur (180-degree shutter), lens breathing, chromatic aberration, Kodak Vision3 film grain, dust particles, subtle camera shake on handheld, environmental imperfections.
5. Quality tags before anti-text block: "masterpiece, award-winning cinematography, 8K UHD, photorealistic, Kodak Vision3 film grain, ACES color science"
6. Anti-text block at end: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"
7. Segment 0 = HOOK — MAGNETIC HOOK FORMULA: MYSTERY + SCALE + MOTION + DETAIL. Prefix with "HOOK SCENE —"
8. Include FULL character description VERBATIM in every prompt where character appears.
9. CAMERA VARIETY: Never repeat angles in consecutive segments. Use 5+ different shot types. Every 4th segment = pattern interrupt.
10. MULTI-MOMENT: For complex narratives, design 2-3 visual moments within 8s using "seamlessly transforms into" / "camera pushes through" transitions.
11. DOPAMINERGIC: First 3s of each scene must trigger curiosity. Camera ALWAYS moving. Each scene shows something novel.
12. AUDIO: Specify ambient sounds + foley SFX + music mood per scene.
13. ALL PROMPTS IN ENGLISH.

${characterBlock ? `\nCHARACTER IDENTITY (include verbatim in every prompt):\n${characterBlock}` : ''}
Visual style: ${videoStyle || 'Netflix cinematic'}`
          },
          {
            role: "user",
            content: `Generate Veo3 prompts for each narration segment. Segment 0 = HOOK (most stunning).
ZERO text/subtitles in any prompt.

Segments:\n${segmentTexts}`
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_veo3_prompts",
            description: "Return Veo3-optimized Netflix/Disney-grade prompts",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      veo3Prompt: { type: "string", description: "100-200 word prompt using Veo3 formula. MUST end with anti-text block." },
                      negativePrompt: { type: "string", description: "Always include ALL: subtitles, text, titles, captions, logos, watermarks, writing, letters, words, lower thirds, on-screen graphics, burned-in text, UI elements, blurry, distorted, deformed hands, extra fingers, six fingers, fused fingers, melted hands, mutated body parts, bad anatomy, disfigured, poorly drawn face, amateur, low quality, jpeg artifacts, oversaturated, underexposed" },
                      shotType: { type: "string", description: "ECU, CU, MCU, MS, MLS, FS, LS, ELS, OTS, bird's eye, worm's eye" },
                      cameraMovement: { type: "string", description: "dolly, tracking, crane, steadicam, slow pan, orbit, push-in, pull-out, rack focus" },
                      lensSpec: { type: "string", description: "24mm, 35mm, 50mm, 85mm, 135mm, anamorphic" },
                      lightingSetup: { type: "string", description: "golden hour, Rembrandt, butterfly, rim, volumetric, chiaroscuro" },
                      audioDirection: { type: "string", description: "Ambient sounds, foley, music mood" },
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

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-veo3-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
