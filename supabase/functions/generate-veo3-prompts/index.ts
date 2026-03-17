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

    const customStyleNotes = '';

    const styleGuides: Record<string, string> = {
      'cinematográfico': 'Netflix/Disney cinematic. Ultra-realistic, ARRI ALEXA, Kodak Vision3, film grain.',
      '2d': '2D flat animation, Kurzgesagt/Studio Trigger style. Vibrant flat colors, clean vector art, parallax depth, smooth 24fps. NO 3D, NO photorealistic.',
      '3d': 'Pixar/DreamWorks 3D. Stylized, subsurface scattering, PBR materials, global illumination.',
      'anime': 'Ufotable/MAPPA anime. Sakuga poses, Shinkai backgrounds, cel-shading, rim lighting.',
      'wojak': 'Wojak/meme internet art style. Simple drawn faces, exaggerated emotional expressions, flat colors, minimalist backgrounds, internet meme aesthetic.',
      'stickmen': 'Stick figure animation. Minimalist black lines, simple backgrounds, humor through simplicity.',
      'realista': 'Hyper-photorealistic. Sony A7R V, 85mm, 8K, natural light.',
      'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents. Blade Runner 2049 mood.',
      'whiteboard': 'Whiteboard animation. Black ink sketches on white, hand-drawn, educational.',
      'comic': 'Comic book / graphic novel. Bold ink outlines, halftone, dynamic panels, saturated colors.',
      'animal_chase': 'HYPER-REALISTIC WILDLIFE SURVIVAL. Shot like National Geographic meets Hollywood thriller. ARRI ALEXA Mini LF, 8K, 120fps slow-motion for chase sequences. Photorealistic animals with visible fur/feather detail, sweat, mud splashes. Dramatic volumetric lighting, golden hour or stormy skies. Handheld camera energy for chase POVs. Extreme close-ups on animal eyes showing fear/determination. Wide epic landscape shots showing the danger. Dust particles, water splashes, debris flying. Color grading: desaturated with punchy warm highlights. Sound design: heavy breathing, heartbeat, environmental chaos.',
    };

    const effectiveStyle = (videoStyle || 'cinematográfico').toLowerCase();
    const selectedStyleGuide = styleGuides[effectiveStyle] || styleGuides['cinematográfico'];

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
🎨 MANDATORY ART STYLE: ${selectedStyleGuide}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 ABSOLUTE PROHIBITION — ZERO TOLERANCE 🚫
- NEVER include text, subtitles, captions, titles, logos, watermarks, writing of ANY kind
- EVERY prompt MUST end with: "(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)"

VEO 3 PROMPT RULES:
1. 100-200 words per prompt. ALL prompts MUST be in the "${effectiveStyle}" art style.
2. For 2D/Wojak/meme styles: describe animated characters, flat colors, cartoon movements — NOT realistic cinematography
3. For anime: describe anime-specific movements, cel-shading, expressive eyes
4. For cinematic/realistic: use film terminology — dolly, tracking, crane, steadicam, lens specs
5. Always specify lighting and mood appropriate to the art style
6. Anti-text block at end of every prompt
7. Segment 0 = HOOK — most visually spectacular shot in the chosen style
8. Include FULL character description VERBATIM where characters appear
9. CAMERA VARIETY: Never repeat angles in consecutive segments
10. DOPAMINERGIC: First 3s of each scene must trigger curiosity
11. ALL PROMPTS IN ENGLISH

${characterBlock ? `\nCHARACTER IDENTITY (include verbatim in every prompt):\n${characterBlock}` : ''}
Visual style: ${selectedStyleGuide}`
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
