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
            content: `You are an expert character designer for cinematic video production. Extract ALL characters/people mentioned or implied in a video script. For each character, provide EXTREMELY detailed visual descriptions in structured JSON format suitable for AI image generation consistency across multiple scenes.

Rules:
- If a character's appearance isn't explicitly described, infer reasonable details from context
- For narrators, create a fitting visual persona
- Be very specific about facial features, body type, clothing items
- Include personality traits that affect visual portrayal
- Language for name/description fields: ${language || 'português'}
- Physical descriptions MUST be in English for AI image generation consistency`,
          },
          {
            role: "user",
            content: `Extract all characters from this script with full visual detail.\n\nSCRIPT:\n${script.slice(0, 10000)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extracted_characters",
            description: "Return the list of characters found in the script with detailed visual attributes",
            parameters: {
              type: "object",
              properties: {
                characters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Character name or role" },
                      gender: { type: "string", enum: ["male", "female", "non-binary"], description: "Character gender" },
                      age: { type: "number", description: "Character age" },
                      role: { type: "string", description: "Role in the story (e.g. Protagonista, Narrador, Vilão, Mentor)" },
                      appearance: {
                        type: "object",
                        properties: {
                          skin_color: { type: "string", description: "e.g. light, tan, olive, brown, dark brown, pale" },
                          hair_color: { type: "string", description: "e.g. dark brown, black, blonde, red, gray, white" },
                          hair_style: { type: "string", description: "e.g. short cropped, long wavy, buzz cut, braided, slicked back" },
                          eye_color: { type: "string", description: "e.g. brown, blue, green, hazel, dark brown" },
                          body_type: { type: "string", description: "e.g. athletic, slim, muscular, stocky, average" },
                          height: { type: "string", description: "e.g. 1.75m, tall, short, average height" },
                        },
                        required: ["skin_color", "hair_color", "hair_style", "eye_color", "body_type", "height"],
                        additionalProperties: false,
                      },
                      facial_features: {
                        type: "object",
                        properties: {
                          eyebrows: { type: "string", description: "e.g. thick arched, thin straight, bushy" },
                          nose: { type: "string", description: "e.g. straight medium, wide, pointed, Roman" },
                          mouth: { type: "string", description: "e.g. thin lips, full lips, medium" },
                          ears: { type: "string", description: "e.g. normal size, small, slightly protruding" },
                          face_shape: { type: "string", description: "e.g. angular jaw, round, oval, square, heart-shaped" },
                        },
                        required: ["eyebrows", "nose", "mouth", "ears", "face_shape"],
                        additionalProperties: false,
                      },
                      clothing: {
                        type: "object",
                        properties: {
                          shirt: { type: "string", description: "e.g. dark green military jacket, white dress shirt" },
                          pants: { type: "string", description: "e.g. black jeans, khaki trousers, dark suit pants" },
                          shoes: { type: "string", description: "e.g. brown leather boots, white sneakers, black dress shoes" },
                          accessories: { type: "string", description: "e.g. silver watch, round glasses, gold chain, none" },
                        },
                        required: ["shirt", "pants", "shoes", "accessories"],
                        additionalProperties: false,
                      },
                      personality: {
                        type: "array",
                        items: { type: "string" },
                        description: "3-5 personality traits e.g. brave, curious, determined, mysterious, calm",
                      },
                    },
                    required: ["name", "gender", "age", "role", "appearance", "facial_features", "clothing", "personality"],
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
