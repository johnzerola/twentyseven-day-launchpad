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
            content: `You are a world-class YouTube strategist and branding expert who has built channels from 0 to 10M+ subscribers. You understand the YouTube algorithm (2025-2026), color psychology, typography, thumbnail design, SEO, and monetization. Generate actionable, data-driven strategies. Always respond with real competitor analysis, real keyword research, and actionable monetization roadmaps. Language: ${language || 'Portuguese'}.`
          },
          {
            role: "user",
            content: `Create a COMPLETE YouTube channel strategy for the niche: "${niche || 'general'}"
Style: ${style || 'modern/cinematic'}
Target audience: ${targetAudience || 'general'}

Generate ALL of the following:

1. CHANNEL NAMES: 3 unique channel name options with taglines, reasoning, and detailed Midjourney prompts for logo, banner, and thumbnail
2. COLOR PALETTES: 5 colors per name (primary bg, card, accent, CTA, text) with hex codes
3. CONTENT PILLARS: 4 content pillar categories with percentage distribution, emoji icon, and description
4. SEO KEYWORDS: 10 real keywords for this niche with estimated monthly search volume, SEO difficulty (Baixa/Média/Alta/Muito Alta), and estimated CPC in USD
5. CONTENT CALENDAR: 4 weeks of content (3 video titles per week) optimized for the algorithm
6. COMPETITOR AUDIT: 3 real YouTube competitors in this niche with subscriber count, estimated RPM, 2 strengths, 2 weaknesses, and 1 opportunity gap
7. MONETIZATION STRATEGY: 4 phases (Infoproduto weeks 1-2, Afiliados weeks 3-4, AdSense month 2-3, Escala month 4+) with specific descriptions and revenue estimates
8. OPPORTUNITY GAP: A specific gap analysis showing what competitors are NOT doing that a new channel could exploit

Be specific, use REAL data where possible, and make everything actionable.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_full_strategy",
            description: "Generate complete YouTube channel strategy with branding, SEO, competitors, calendar, and monetization",
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
                      logoPrompt: { type: "string" },
                      bannerPrompt: { type: "string" },
                      thumbnailPrompt: { type: "string" }
                    },
                    required: ["name", "tagline", "reason", "logoPrompt", "bannerPrompt", "thumbnailPrompt"]
                  }
                },
                colorPalettes: {
                  type: "array",
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
                contentPillars: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      percentage: { type: "number" },
                      icon: { type: "string" },
                      description: { type: "string" }
                    },
                    required: ["name", "percentage", "icon", "description"]
                  }
                },
                keywords: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      keyword: { type: "string" },
                      volume: { type: "string" },
                      difficulty: { type: "string" },
                      cpc: { type: "string" }
                    },
                    required: ["keyword", "volume", "difficulty", "cpc"]
                  }
                },
                contentCalendar: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "number" },
                      videos: { type: "array", items: { type: "string" } }
                    },
                    required: ["week", "videos"]
                  }
                },
                competitorAudit: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      subs: { type: "string" },
                      rpm: { type: "string" },
                      strengths: { type: "array", items: { type: "string" } },
                      weaknesses: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "subs", "rpm", "strengths", "weaknesses"]
                  }
                },
                monetizationStrategy: {
                  type: "object",
                  properties: {
                    phase1: {
                      type: "object",
                      properties: { label: { type: "string" }, description: { type: "string" }, estimatedRevenue: { type: "string" } },
                      required: ["label", "description", "estimatedRevenue"]
                    },
                    phase2: {
                      type: "object",
                      properties: { label: { type: "string" }, description: { type: "string" }, estimatedRevenue: { type: "string" } },
                      required: ["label", "description", "estimatedRevenue"]
                    },
                    phase3: {
                      type: "object",
                      properties: { label: { type: "string" }, description: { type: "string" }, estimatedRevenue: { type: "string" } },
                      required: ["label", "description", "estimatedRevenue"]
                    },
                    phase4: {
                      type: "object",
                      properties: { label: { type: "string" }, description: { type: "string" }, estimatedRevenue: { type: "string" } },
                      required: ["label", "description", "estimatedRevenue"]
                    }
                  },
                  required: ["phase1", "phase2", "phase3", "phase4"]
                },
                opportunityGap: { type: "string" }
              },
              required: ["channelNames", "colorPalettes", "contentPillars", "keywords", "contentCalendar", "competitorAudit", "monetizationStrategy", "opportunityGap"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_full_strategy" } }
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
      throw new Error("AI strategy generation failed");
    }

    const aiData = await aiRes.json();
    let strategy;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      strategy = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse strategy response");
    }

    return new Response(JSON.stringify(strategy), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-branding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
