import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, language } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!script?.trim()) throw new Error("Script is required");

    const systemPrompt = `You are an expert character designer for cinematic video production. Extract ALL characters/people mentioned or implied in a video script. For each character, provide EXTREMELY detailed visual descriptions suitable for AI image generation consistency across multiple scenes.

Rules:
- If a character's appearance isn't explicitly described, infer reasonable details from context
- For narrators, create a fitting visual persona
- Be very specific about facial features, body type, clothing items
- Include personality traits that affect visual portrayal
- Language for name/description fields: ${language || 'português'}
- Physical descriptions MUST be in English for AI image generation consistency

Respond ONLY in valid JSON with this exact structure:
{
  "characters": [
    {
      "name": "string",
      "gender": "male|female|non-binary",
      "age": number,
      "role": "string (e.g. Protagonista, Narrador, Vilão, Mentor)",
      "appearance": {
        "skin_color": "string",
        "hair_color": "string",
        "hair_style": "string",
        "eye_color": "string",
        "body_type": "string",
        "height": "string"
      },
      "facial_features": {
        "eyebrows": "string",
        "nose": "string",
        "mouth": "string",
        "ears": "string",
        "face_shape": "string"
      },
      "clothing": {
        "shirt": "string",
        "pants": "string",
        "shoes": "string",
        "accessories": "string"
      },
      "personality": ["trait1", "trait2", "trait3"]
    }
  ]
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nExtract all characters from this script with full visual detail.\n\nSCRIPT:\n${script.slice(0, 10000)}` }] },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText);
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("No content in Gemini response");

    const result = JSON.parse(content);
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
