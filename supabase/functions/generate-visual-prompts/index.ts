import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// DARKPLANNER VISUAL PROMPTS — Upgraded with professional training
// ═══════════════════════════════════════════════════════════════

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Netflix/Disney cinematic. ARRI ALEXA, Kodak Vision3, film grain, dramatic lighting, shallow DOF f/1.4-2.8.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector shapes, parallax depth layers, NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D render. Stylized characters, subsurface scattering, global illumination.',
  'anime': 'Anime/manga style. Ufotable/MAPPA quality, cel-shading, expressive faces, dynamic poses.',
  'wojak': 'Wojak/meme internet art style. Simple drawn faces with strong emotional expressions, flat colors, minimalist backgrounds.',
  'stickmen': 'Stick figure art. Minimalist black line drawings, simple backgrounds, humor through simplicity.',
  'realista': 'Hyper-photorealistic. Natural lighting, 8K detail, lifelike, Canon 5D/Sony A7R aesthetic.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents, atmospheric fog, Blade Runner mood.',
  'whiteboard': 'Whiteboard animation. Hand-drawn sketches, black ink on white, educational.',
  'comic': 'Comic book / graphic novel. Bold ink outlines, halftone, dynamic panels, saturated colors.',
  'fotorrealista_documentario': 'Documentary photography, natural soft lighting, shallow depth of field, desaturated earth tones.',
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
            description: "Set visual prompts for each script segment matching the chosen art style (DarkPlanner format)",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      visualPrompt: { type: "string", description: "80-150 word visual prompt with mandatory movement (camera + environment). Detailed environment to prevent buggy backgrounds. End with style modifiers and anti-text block." }
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
            content: `You are a visual director creating prompts for AI image generation, trained on the DarkPlanner professional system. You MUST follow the chosen art style EXACTLY.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyle}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

🚫 NEVER include text, subtitles, captions, logos, watermarks in ANY prompt.

DARKPLANNER RULES:
- EVERY prompt MUST match the art style above — do NOT default to photorealistic unless chosen
- For 2D styles: describe flat colors, clean lines, animation-style characters
- For Wojak/meme: describe simple drawn faces, emotional expressions, internet meme look
- For anime: describe anime aesthetic, cel-shading, expressive eyes
- Each prompt: 80-150 words (more detailed than before for better AI generation)
- Write in English for best AI image generation results
- START every prompt with the art style descriptor

═══ MANDATORY MOVEMENT ═══
Every prompt MUST describe at least 1 type of movement:
- Camera: slowly pushing in, pulling back, panning, tracking
- Environment: wind, particles, water, smoke, light shifting

═══ ENVIRONMENT DETAIL (prevent white/buggy backgrounds) ═══
NEVER write vague descriptions. ALWAYS include:
- Specific location with materials and textures
- Lighting source and direction
- Atmospheric elements (particles, fog, weather)
❌ WRONG: "Person in a room"
✅ RIGHT: "Person in modest kitchen with chipped tile counter, old appliances, warm afternoon light through small window, dust motes floating"

═══ STYLE MODIFIERS ═══
Every prompt MUST end with style modifiers matching the art style, then:
(no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)`
          },
          {
            role: "user",
            content: `Generate visual prompts in "${styleKey}" style for these ${segments.length} narration segments. Each prompt = 80-150 words with movement and detailed environment.\n\n${segmentTexts}`
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

    // Post-process: ensure anti-text suffix
    for (const p of parsed.prompts) {
      if (p.visualPrompt && !p.visualPrompt.includes("no subtitles")) {
        p.visualPrompt += " (no subtitles, no text, no titles, no captions, no logos, no watermarks, no on-screen graphics, no writing)";
      }
    }

    return new Response(JSON.stringify({ prompts: parsed.prompts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-visual-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
