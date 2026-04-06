import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ANTI_SLOP_FOR_THUMBNAILS } from "../_shared/anti-slop-rules.ts";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  return await callGeminiOpenAICompat(apiKey, body);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { video_title, niche, emotion, style, count, script_context, generate_image, variant_index } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ MODE 2: Generate actual image from a prompt ═══
    if (generate_image && variant_index !== undefined) {
      const dalle_prompt = script_context || video_title; // reuse field for the prompt
      
      const imagePrompt = `Generate a HIGH-CTR YouTube thumbnail image.
Style: Bold, eye-catching, professional YouTube thumbnail.
${ANTI_SLOP_FOR_THUMBNAILS}

PROMPT: ${dalle_prompt}

RULES:
- 16:9 aspect ratio composition
- Maximum 3 focal elements
- EXTREME contrast colors
- Clear emotional expression if face present
- NO text overlay (text will be added in post-production)
- Professional lighting, cinematic quality
- Must be readable at 120x67px (mobile size)`;

      const imageResponse = await _ai({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      });

      if (!imageResponse.ok) {
        if (imageResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (imageResponse.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`Image generation failed: ${imageResponse.status}`);
      }

      const imageData = await imageResponse.json();
      const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl) throw new Error("No image generated");

      return new Response(JSON.stringify({ success: true, imageUrl, variant_index }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ MODE 1: Generate prompt variants (original behavior) ═══
    if (!video_title?.trim()) throw new Error("video_title required");

    const { data: existing } = await sb
      .from("thumbnail_prompt_library")
      .select("*")
      .ilike("niche", `%${niche || ""}%`)
      .order("effectiveness_score", { ascending: false })
      .limit(5);

    const referencePatterns = (existing || []).map((t: any) =>
      `Style: ${t.style}, Emotion: ${t.emotion_target}, CTR: ${t.expected_ctr_pct}%`
    ).join("\n");

    const { data: mechanics } = await sb
      .from("viral_mechanics_library")
      .select("mechanic_name, how_to_apply, avg_ctr_boost_pct")
      .eq("category", "thumbnail_ctr")
      .order("effectiveness_score", { ascending: false })
      .limit(5);

    const scriptBlock = script_context
      ? `\n\nSCRIPT CONTEXT:\n${script_context.slice(0, 1500)}`
      : '';

    const prompt = `Generate ${count || 3} high-CTR YouTube thumbnail concepts for:
Title: "${video_title}"
Niche: ${niche || "general"}
Target emotion: ${emotion || "curiosity"}
Style: ${style || "auto"}
${scriptBlock}

Reference patterns:\n${referencePatterns || "None"}

CTR mechanics:\n${(mechanics || []).map((m: any) => `- ${m.mechanic_name}: ${m.how_to_apply} (+${m.avg_ctr_boost_pct}% CTR)`).join("\n")}

${ANTI_SLOP_FOR_THUMBNAILS}

For each variant: Midjourney prompt, DALL-E 3 prompt, composition, color palette, CTR boost estimate.
IMPORTANT: CTR boost is an AI ESTIMATE without empirical calibration.`;

    const aiResp = await _ai({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `You are a YouTube thumbnail DIRECTOR OF ART.

═══ REGRA DOS 3 ELEMENTOS ═══
- Elemento 1 (Foco): Rosto/objeto, 40% da tela, emoção EXTREMA
- Elemento 2 (Contexto): Objeto, cenário, ou seta vermelha
- Elemento 3 (Contraste): Fundo limpo, máximo contraste

═══ CORES COMPLEMENTARES ═══
- Azul Marinho vs Laranja Neon
- Vermelho Sangue vs Cyan/Turquesa
- Roxo Profundo vs Amarelo Elétrico
NUNCA paleta monocromática.

═══ PÓS-PRODUÇÃO (incluir em cada variante) ═══
Drop Shadow, Optical Glow, Radial Blur, Curves, Motion Blur, Inner Shadow.

Output ONLY via tool call.` },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_thumbnails",
          description: "Generate thumbnail variants with post-production instructions",
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
                    complementary_contrast: { type: "string" },
                    emotion_target: { type: "string" },
                    expected_ctr_boost: { type: "number" },
                    face_required: { type: "boolean" },
                    post_production_instructions: { type: "string" },
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
    });

    if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
    const aiData = await aiResp.json();
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("No thumbnails generated");

    const result = JSON.parse(tc.function.arguments);
    const labeledVariants = (result.variants || []).map((v: any) => ({
      ...v,
      estimated_ctr_boost_ai: v.expected_ctr_boost,
      ctr_boost_source: 'ai_estimate_uncalibrated',
    }));

    return new Response(JSON.stringify({
      success: true, video_title, niche,
      confidence_source: 'ai_estimate',
      variants: labeledVariants,
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
