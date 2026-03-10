import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script is required");

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
            content: `You are a script analyst. Extract ALL characters/people mentioned or implied in a video script. For each character, provide detailed visual descriptions suitable for AI image generation. If a character's appearance isn't explicitly described, infer reasonable details from context (age, gender, style, etc). Language for output: ${language || 'português'}.`,
          },
          {
            role: "user",
            content: `Extract all characters from this script. For narrators, create a fitting visual persona.\n\nSCRIPT:\n${script.slice(0, 8000)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extracted_characters",
            description: "Return the list of characters found in the script",
            parameters: {
              type: "object",
              properties: {
                characters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Character name or role" },
                      description: { type: "string", description: "Role in the story (e.g. Protagonista, Narrador, Vilão)" },
                      appearance: { type: "string", description: "Detailed physical appearance: age, gender, ethnicity, hair, face, body type, distinguishing features" },
                      clothing: { type: "string", description: "Detailed outfit/clothing description with colors and style" },
                    },
                    required: ["name", "description", "appearance", "clothing"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["characters"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extracted_characters" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${res.status}`);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-characters error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
