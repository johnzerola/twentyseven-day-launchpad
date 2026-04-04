import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  return await callGeminiOpenAICompat(apiKey, body);
};

/**
 * Originality & Safety Score Engine
 * 5-dimension score for faceless/dark channels to avoid demonetization.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scriptText, title, niche, videoType, style, language } = await req.json();
    if (!scriptText) throw new Error("scriptText is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch similar content for saturation check
    let saturationContext = "";
    if (niche) {
      const { data: similar } = await sb.from("content_dna")
        .select("video_title, niche, views, viral_score")
        .ilike("niche", `%${niche}%`)
        .order("views", { ascending: false })
        .limit(10);
      if (similar?.length) {
        saturationContext = `\n\nEXISTING CONTENT IN NICHE (${niche}):\n` +
          similar.map(v => `• "${v.video_title}" — ${v.views?.toLocaleString()} views, viral: ${v.viral_score}`).join("\n");
      }
    }

    const prompt = `You are a YouTube monetization safety analyst for faceless/AI-generated channels.
Your job is to evaluate content BEFORE production to prevent demonetization, repetition claims, and low-value flags.

SCRIPT (first 2000 chars):
${scriptText.slice(0, 2000)}

TITLE: ${title || '(none)'}
NICHE: ${niche || 'general'}
STYLE: ${style || 'cinematic'}
VIDEO TYPE: ${videoType || 'long'}
LANGUAGE: ${language || 'pt-BR'}
${saturationContext}

Score each dimension 0-100:

1. **originality** (0-100): What does this video bring that competitors DON'T? Is there a unique angle, exclusive data, novel narrative structure, or original character? Score 80+ only if truly differentiated.

2. **provenance** (0-100): Are central facts verifiable? Does the script cite or reference real sources? A script with "scientists discovered" without specifics scores low. Named studies, dates, locations score high.

3. **repetition_risk** (0-100, INVERTED — 100 = safe, 0 = high risk): How similar is this to already-saturated content in the niche? If 50 channels already covered this exact angle, score low. Novel angle on popular topic scores higher.

4. **editorial_risk** (0-100, INVERTED — 100 = safe, 0 = risky): Does the script contain unverifiable claims, potentially defamatory content, medical/legal advice, or sensationalized violence? Clean content scores 90+.

5. **asset_risk** (0-100, INVERTED — 100 = safe, 0 = risky): For a faceless channel using AI visuals and TTS: could the visual style be flagged as "reused content"? Does it use distinctive enough character design? Generic stock-like visuals score low.

Also provide:
- **composite_score**: weighted average (originality 30%, provenance 15%, repetition_risk 25%, editorial_risk 15%, asset_risk 15%)
- **monetization_safe**: boolean — true if composite >= 60 and no single dimension below 30
- **red_flags**: array of specific risks found
- **improvements**: array of actionable fixes
- **verdict**: "🟢 SEGURO", "🟡 ATENÇÃO", or "🔴 RISCO ALTO"

Return ONLY valid JSON.`;

    const resp = await _ai({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
    });

    if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
    const aiData = await resp.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    
    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("originality-safety-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
