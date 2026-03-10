import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, videoStyle, characters, audioDurationSeconds, sceneDurationSeconds, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!script?.trim()) throw new Error("Script text required");

    const sceneLen = sceneDurationSeconds || 8;
    const totalDuration = audioDurationSeconds || 0;

    const sentences = script.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
    const totalChars = sentences.reduce((sum: number, s: string) => sum + s.length, 0);

    const numScenes = totalDuration > 0
      ? Math.max(1, Math.ceil(totalDuration / sceneLen))
      : Math.max(1, Math.ceil(sentences.length / 3));

    const scenes: { index: number; text: string; startTime: number; endTime: number }[] = [];
    const charsPerScene = Math.ceil(totalChars / numScenes);
    let currentSceneText = '';
    let currentSceneChars = 0;
    let sceneIndex = 0;

    for (const sentence of sentences) {
      currentSceneText += (currentSceneText ? ' ' : '') + sentence;
      currentSceneChars += sentence.length;

      if (currentSceneChars >= charsPerScene && sceneIndex < numScenes - 1) {
        scenes.push({
          index: sceneIndex,
          text: currentSceneText.trim(),
          startTime: sceneIndex * sceneLen,
          endTime: (sceneIndex + 1) * sceneLen,
        });
        sceneIndex++;
        currentSceneText = '';
        currentSceneChars = 0;
      }
    }

    if (currentSceneText.trim()) {
      scenes.push({
        index: sceneIndex,
        text: currentSceneText.trim(),
        startTime: sceneIndex * sceneLen,
        endTime: totalDuration > 0 ? totalDuration : (sceneIndex + 1) * sceneLen,
      });
    }

    const styleGuides: Record<string, string> = {
      'cinematográfico': `Hyper-realistic cinematic photography shot on ARRI ALEXA 65 with Cooke Anamorphic lenses. 
Characteristics: Shallow depth of field (f/1.4-2.8), natural film grain (ISO 800), organic lens flares, volumetric god rays through atmospheric haze. 
Lighting: Three-point lighting with motivated practical sources. Key light through windows/doorways creating dramatic chiaroscuro. Rim lighting separating subjects from background. Color temperature shifts between warm tungsten (3200K) and cool daylight (5600K).
Color grading: Teal and orange color palette reminiscent of David Fincher. Rich blacks, lifted shadows with subtle blue tint. Skin tones preserved warm and natural.
Composition: Rule of thirds with leading lines. Negative space for dramatic tension. Foreground elements for depth layers. 
Reference directors: Roger Deakins, Emmanuel Lubezki, Bradford Young cinematography.`,
      
      '2d': `Premium 2D animation. Vibrant flat colors, clean vector linework, expressive character animation. Kurzgesagt meets Studio Trigger quality. Bold outlines, geometric design language, parallax depth layers, smooth 24fps motion feel. Rich color palettes with complementary accent colors. Professional motion design with easing curves.`,
      
      '3d': `Pixar/DreamWorks feature-film quality 3D rendering. Subsurface scattering on skin, physically-based materials (PBR), global illumination with ray-traced reflections. Volumetric atmospheric effects. Hair/fur simulation detail. Professional 3-point studio lighting with HDRI environments. Depth of field with bokeh. 8K texture resolution.`,
      
      'anime': `Top-tier anime production quality (Ufotable/MAPPA level). Dynamic sakuga-quality poses with motion blur. Detailed background art with atmospheric perspective. Professional cel-shading with multiple shadow layers. Rim lighting effects, particle systems, lens flares. Expressive eyes with light reflections. Detailed hair physics. Dramatic speed lines for action.`,
      
      'wojak': 'Wojak/meme art style. Simple line drawings with emotional faces. Minimalist backgrounds. Characters express emotions through exaggerated facial features. Internet culture aesthetic. Clean white backgrounds.',
      
      'stickmen': 'Stick figure animation style. Simple black stick figures on clean colored backgrounds. Humor through simplicity. Expressive despite minimal detail. Professional whiteboard feel.',
      
      'realista': `Photorealistic digital photography. Shot on Sony A7R V with 85mm f/1.2 GM lens. 8K resolution, natural available light with subtle fill. Accurate skin texture with pore-level detail. EXIF-accurate depth of field. Color science matching real camera profiles. No AI artifacts — indistinguishable from DSLR photograph.`,
      
      'dark': `Dark cinematic aesthetic. Deep crushed blacks, neon accent lighting (cyan, magenta, amber). Volumetric fog and atmospheric haze. Rain-slicked surfaces with reflections. Blade Runner 2049 meets Se7en. High contrast ratio (1000:1). Motivated practical lighting — neon signs, screen glow, street lamps. Noir shadow patterns.`,
      
      'whiteboard': 'Professional whiteboard animation. Hand-drawn black ink illustrations on pristine white surface. Appearing stroke-by-stroke. Occasional strategic color highlights (red, blue, green). Educational clarity. Dan Roam visual thinking style.',
      
      'comic': 'Premium graphic novel art. Bold ink outlines with varied line weight. Ben-Day dot halftone shading. Dynamic compositions with dramatic foreshortening. Rich saturated colors. Professional hand-lettering style. Jim Lee meets Alex Ross quality.',
    };

    const selectedStyleGuide = styleGuides[videoStyle?.toLowerCase()] || styleGuides['cinematográfico'];

    // Build detailed character identity cards
    const characterBlock = characters?.length > 0
      ? `\n\nCHARACTER IDENTITY SHEETS (CRITICAL — Copy-paste these descriptions VERBATIM into EVERY prompt where the character appears. NEVER paraphrase or simplify. Consistency is NON-NEGOTIABLE):\n${characters.map((c: any, i: number) => {
          const a = c.appearance || {};
          const f = c.facial_features || {};
          const cl = c.clothing || {};
          return `
═══ CHARACTER ${i + 1}: "${c.name}" ═══
Gender: ${c.gender || 'unknown'} | Age: ${c.age || 'unknown'}
BODY: ${a.body_type || 'average'} build, ${a.height || 'average height'}, ${a.skin_color || 'medium'} skin tone
HAIR: ${a.hair_color || 'dark'} colored ${a.hair_style || 'short'} hairstyle
EYES: ${a.eye_color || 'brown'} eyes, ${f.eyebrows || 'natural'} eyebrows
FACE: ${f.face_shape || 'oval'} face shape, ${f.nose || 'straight'} nose, ${f.mouth || 'natural'} mouth/lips, ${f.ears || 'normal'} ears
OUTFIT: ${cl.shirt || 'casual top'}, ${cl.pants || 'casual bottoms'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, wearing ${cl.accessories}` : ''}
PERSONALITY/EXPRESSION: ${(c.personality || ['neutral']).join(', ')} — reflect this in body language and micro-expressions`;
        }).join('\n')}\n\n⚠️ RULE: When a character appears, include their FULL description (body, hair, eyes, face, outfit) in the prompt. NEVER say just "the character" or use only their name without the visual description.`
      : '';

    const sceneTexts = scenes.map(s =>
      `Scene ${s.index + 1} [${formatTime(s.startTime)}-${formatTime(s.endTime)}]: "${s.text}"`
    ).join('\n\n');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        tools: [{
          type: "function",
          function: {
            name: "set_synced_prompts",
            description: "Generate synchronized visual prompts for each scene",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneIndex: { type: "number" },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                      visualPrompt: { type: "string", description: "Ultra-detailed visual prompt (80-150 words) in English for professional image/video generation. Must include full character descriptions when characters appear." },
                      cameraAngle: { type: "string", description: "Specific cinematographic shot: extreme close-up, medium close-up, over-the-shoulder, wide establishing, low-angle hero shot, dutch angle, tracking dolly, crane shot, Steadicam follow, POV first-person, bird's-eye overhead" },
                      mood: { type: "string", description: "Emotional atmosphere with lighting descriptor: e.g. 'tense suspense with cold blue backlighting', 'warm nostalgic with golden hour glow'" },
                      charactersInScene: { type: "array", items: { type: "string" }, description: "Names of characters appearing" },
                      transitionNote: { type: "string", description: "Professional transition: match cut, J-cut, whip pan, dissolve, smash cut, iris wipe" },
                    },
                    required: ["sceneIndex", "startTime", "endTime", "visualPrompt", "cameraAngle", "mood"],
                    additionalProperties: false
                  }
                }
              },
              required: ["scenes"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "set_synced_prompts" } },
        messages: [
          {
            role: "system",
            content: `You are a WORLD-CLASS visual director who has worked on Marvel, Christopher Nolan, and Denis Villeneuve productions. You create prompts that produce BREATHTAKING, PHOTOREALISTIC, CINEMA-QUALITY images.

MASTER VISUAL STYLE:
${selectedStyleGuide}
${characterBlock}

YOUR COMMANDMENTS:

1. PROMPT LENGTH: Each visualPrompt MUST be 80-150 words. Short prompts = amateur results. Be EXHAUSTIVELY descriptive.

2. PROMPT STRUCTURE (follow this order in EVERY prompt):
   a) SUBJECT: Who/what is in frame, with COMPLETE physical description
   b) ACTION: What they're doing, body language, micro-expressions
   c) ENVIRONMENT: Specific location with architectural/natural details
   d) LIGHTING: Exact light sources, direction, color temperature, shadows
   e) CAMERA: Lens mm, aperture, focus distance, camera movement
   f) ATMOSPHERE: Particles (dust, rain, fog), time of day, weather
   g) COLOR PALETTE: Dominant and accent colors, grading style
   h) MOOD KEYWORDS: 3-5 emotion/quality tags at the end

3. CHARACTER CONSISTENCY: When characters appear, include their COMPLETE identity sheet description (skin, hair, eyes, face shape, outfit). NEVER abbreviate.

4. VISUAL CONTINUITY: 
   - Maintain consistent time-of-day lighting across consecutive scenes
   - Keep color grading consistent (same LUT/palette throughout)
   - Environment details must be geographically consistent
   - Character clothing doesn't change unless narratively justified

5. CINEMATOGRAPHIC VARIETY:
   - NEVER repeat the same camera angle in consecutive scenes
   - Alternate between: wide establishing → medium → close-up → detail → wide
   - Use at least 5 different shot types across all scenes
   - Include at least one dramatic low-angle and one high-angle shot

6. TECHNICAL QUALITY TAGS: End every prompt with quality boosters:
   "masterpiece, award-winning cinematography, 8K UHD, photorealistic, ray-traced global illumination, film grain"

7. ANTI-AI-LOOK: Avoid these AI tells:
   - No "glowing" skin or unrealistic smoothness
   - No over-saturated neon colors unless style demands it
   - No symmetrical compositions (break symmetry deliberately)
   - Include imperfections: dust particles, lens aberration, motion blur
   - Natural skin texture with pores, blemishes, subsurface scattering

8. ALL PROMPTS IN ENGLISH for optimal AI image generation quality.`
          },
          {
            role: "user",
            content: `Generate ${scenes.length} CINEMA-QUALITY synchronized visual prompts.
Total duration: ${totalDuration > 0 ? `${totalDuration}s (from audio)` : 'estimated from text'}
Scene duration: ~${sceneLen}s each
Video style: ${videoStyle || 'cinematográfico'}
Language of narration: ${language || 'português'}

IMPORTANT: Each prompt must be 80-150 words with EXHAUSTIVE detail. Think of each prompt as a shot list for a $200M film production.

SCENES TO VISUALIZE:

${sceneTexts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Synced prompts error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate synced prompts");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      scenes: parsed.scenes,
      metadata: {
        totalScenes: scenes.length,
        totalDuration: totalDuration || scenes.length * sceneLen,
        sceneDuration: sceneLen,
        videoStyle: videoStyle || 'cinematográfico',
        charactersCount: characters?.length || 0,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-synced-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
