import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { video_title, niche, emotion, style, count } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch existing thumbnail patterns for the niche
    const { data: existing } = await sb
      .from("thumbnail_prompt_library")
      .select("*")
      .ilike("niche", `%${niche || ""}%`)
      .order("effectiveness_score", { ascending: false })
      .limit(5);

    const referencePatterns = (existing || []).map((t: any) =>
      `Style: ${t.style}, Emotion: ${t.emotion_target}, CTR: ${t.expected_ctr_pct}%`
    ).join("\n");

    // Fetch viral mechanics for thumbnails
    const { data: mechanics } = await sb
      .from("viral_mechanics_library")
      .select("mechanic_name, how_to_apply, avg_ctr_boost_pct")
      .eq("category", "thumbnail_ctr")
      .order("effectiveness_score", { ascending: false })
      .limit(5);

    const prompt = `Generate ${count || 3} high-CTR YouTube thumbnail concepts for:
Title: "${video_title}"
Niche: ${niche || "general"}
Target emotion: ${emotion || "curiosity"}
Style preference: ${style || "auto"}

Reference patterns from our database:
${referencePatterns || "None yet"}

Thumbnail CTR mechanics:
${(mechanics || []).map((m: any) => `- ${m.mechanic_name}: ${m.how_to_apply} (+${m.avg_ctr_boost_pct}% CTR)`).join("\n")}

For each variant, provide: Midjourney prompt, DALL-E 3 prompt, composition description, color palette, expected CTR boost.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a YouTube thumbnail expert. Output ONLY via the tool call." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_thumbnails",
            description: "Generate thumbnail prompt variants",
            parameters: {
              type: "object",
              properties: {
                variants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      style: { type: "string" },
                      midjourney_prompt: { type: "string" },
                      dalle_prompt: { type: "string" },
                      composition: { type: "string" },
                      color_palette: { type: "array", items: { type: "string" } },
                      emotion_target: { type: "string" },
                      expected_ctr_boost: { type: "number" },
                      face_required: { type: "boolean" },
                    },
                    required: ["style", "midjourney_prompt", "dalle_prompt", "composition", "color_palette", "emotion_target"],
                  },
                },
              },
              required: ["variants"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_thumbnails" } },
      }),
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No thumbnails generated");

    const result = JSON.parse(tc.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      video_title,
      niche,
      variants: result.variants || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-thumbnail-prompt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
