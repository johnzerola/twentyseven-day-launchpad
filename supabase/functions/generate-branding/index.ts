import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, style, language, targetAudience } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a world-class YouTube branding expert who has created brands for channels with 10M+ subscribers. You understand color psychology, typography, thumbnail design, and SEO. Generate creative, memorable, and SEO-optimized branding. Always include detailed Midjourney/Canva prompts.`
          },
          {
            role: "user",
            content: `Create COMPLETE YouTube channel branding for:
Niche: ${niche || 'general'}
Style: ${style || 'modern/cinematic'}
Language: ${language || 'Portuguese'}
Target audience: ${targetAudience || 'general'}

Requirements:
- 3 unique channel name options with taglines and reasoning
- 5 professional channel descriptions (SEO-optimized)
- Detailed Midjourney prompts for LOGO and BANNER for each channel name
- 5 color palettes with hex codes and usage (primary, secondary, accent, bg, text)
- Thumbnail style guide with specific examples
- 10 content pillars/series ideas
- 20+ SEO tags
- 3 sub-niche suggestions with potential`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_branding",
            description: "Generate complete YouTube channel branding",
            parameters: {
              type: "object",
              properties: {
                channelNames: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      tagline: { type: "string" },
                      reason: { type: "string" },
                      logoPrompt: { type: "string", description: "Detailed Midjourney prompt for the logo" },
                      bannerPrompt: { type: "string", description: "Detailed Midjourney prompt for the YouTube banner (2560x1440)" }
                    },
                    required: ["name", "tagline", "reason", "logoPrompt", "bannerPrompt"]
                  }
                },
                descriptions: {
                  type: "array",
                  items: { type: "string" }
                },
                seoTags: {
                  type: "array",
                  items: { type: "string" }
                },
                colorPalettes: {
                  type: "array",
                  description: "One palette per channel name option",
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hex: { type: "string" },
                        usage: { type: "string" }
                      },
                      required: ["hex", "usage"]
                    }
                  }
                },
                bannerConcepts: {
                  type: "array",
                  items: { type: "string" }
                },
                thumbnailStyle: { type: "string", description: "Detailed thumbnail style guide with specific examples" },
                contentPillars: {
                  type: "array",
                  items: { type: "string" }
                },
                subNiches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      potential: { type: "string" },
                      competition: { type: "string" }
                    },
                    required: ["name", "potential", "competition"]
                  }
                }
              },
              required: ["channelNames", "descriptions", "seoTags", "colorPalettes", "bannerConcepts", "thumbnailStyle", "contentPillars"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_branding" } }
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI branding generation failed");
    }

    const aiData = await aiRes.json();
    let branding;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      branding = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse branding response");
    }

    return new Response(JSON.stringify(branding), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-branding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
