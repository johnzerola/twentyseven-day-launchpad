import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const styleGuides: Record<string, string> = {
  'cinematográfico': 'Ultra-realistic cinematic. Camera angles like a movie. Dramatic lighting, shallow DOF, film grain.',
  '2d': '2D flat animation, Kurzgesagt-style. Vibrant flat colors, clean vector shapes, parallax depth, NO 3D, NO photorealistic.',
  '3d': 'Pixar/DreamWorks 3D render. Stylized characters, subsurface scattering, global illumination.',
  'anime': 'Anime/manga style. Ufotable/MAPPA quality, cel-shading, expressive faces, dynamic poses.',
  'wojak': 'Wojak/meme internet art style. Simple drawn faces with strong emotional expressions, flat colors, minimalist backgrounds.',
  'stickmen': 'Stick figure art. Minimalist black line drawings, simple backgrounds, humor through simplicity.',
  'realista': 'Hyper-photorealistic. Natural lighting, 8K detail, lifelike.',
  'dark': 'Dark noir/cyberpunk. Crushed blacks, neon accents, atmospheric fog, Blade Runner mood.',
  'whiteboard': 'Whiteboard animation. Hand-drawn sketches, black ink on white, educational.',
  'comic': 'Comic book / graphic novel. Bold ink outlines, halftone, dynamic panels, saturated colors.',
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
            description: "Set visual prompts for each script segment matching the chosen art style",
            parameters: {
              type: "object",
              properties: {
                prompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      segmentIndex: { type: "number" },
                      visualPrompt: { type: "string" }
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
            content: `You are a visual director creating prompts for AI image generation. You MUST follow the chosen art style EXACTLY.

═══════════════════════════════════════
🎨 MANDATORY ART STYLE: ${selectedStyle}
${customStyleNotes ? `✨ CREATOR'S EXTRA INSTRUCTIONS: ${customStyleNotes}` : ''}
═══════════════════════════════════════

RULES:
- EVERY prompt MUST match the art style above — do NOT default to photorealistic/cinematic unless that's the chosen style
- For 2D styles: describe flat colors, clean lines, animation-style characters
- For Wojak/meme: describe simple drawn faces, emotional expressions, internet meme look
- For anime: describe anime aesthetic, cel-shading, expressive eyes
- Describe composition, mood, and visual elements matching the narration
- Make each scene visually distinct from the others
- Keep each prompt to 1-3 sentences, max 80 words
- Write prompts in English for best AI image generation results
- Always START the prompt with the art style descriptor`
          },
          {
            role: "user",
            content: `Generate visual prompts in "${styleKey}" style for these ${segments.length} narration segments:\n\n${segmentTexts}`
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
