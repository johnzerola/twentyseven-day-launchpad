import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { characters, scenes, visualStyle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!characters?.length || !scenes?.length) {
      throw new Error("characters and scenes arrays required");
    }

    const characterDescriptions = characters.map((c: any, i: number) =>
      `Character ${i + 1}: "${c.name}" - ${c.description}. Appearance: ${c.appearance || 'not specified'}. Outfit: ${c.outfit || 'not specified'}.`
    ).join("\n");

    const sceneTexts = scenes.map((s: any, i: number) =>
      `Scene ${i + 1}: "${s.text}"`
    ).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a visual prompt engineer specialized in creating consistent character descriptions for AI video generation (Veo3, Runway, Kling). 
Your job is to ensure CHARACTER CONSISTENCY across all scenes by:
1. Creating a detailed "character sheet" with exact physical attributes
2. Rewriting each scene prompt to include the character's exact appearance
3. Maintaining the same clothing, hairstyle, body type, and distinctive features

Visual style for all scenes: ${visualStyle || "cinematic documentary"}

CRITICAL RULES:
- Every scene prompt MUST reference characters by their exact physical description, not just name
- Include lighting, camera angle, and composition suggestions
- Maintain emotional continuity between scenes`
          },
          {
            role: "user",
            content: `Create consistent character prompts for these characters and scenes:

CHARACTERS:
${characterDescriptions}

SCENES:
${sceneTexts}

Generate optimized prompts for each scene maintaining character consistency.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "character_consistent_prompts",
            description: "Return character sheets and scene prompts with consistent characters",
            parameters: {
              type: "object",
              properties: {
                characterSheets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      physicalDescription: { type: "string", description: "Detailed physical appearance for consistency" },
                      outfit: { type: "string" },
                      distinctiveFeatures: { type: "string" },
                      referencePrompt: { type: "string", description: "A standalone prompt to generate a reference image of this character" },
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
                      prompt: { type: "string", description: "Full scene prompt with embedded character descriptions" },
                      camera: { type: "string", description: "Camera angle and movement" },
                      lighting: { type: "string" },
                      mood: { type: "string" },
                    },
                    required: ["sceneIndex", "prompt", "camera", "lighting", "mood"],
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
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-character-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
