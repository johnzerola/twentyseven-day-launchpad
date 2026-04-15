import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enhanceWithCritic } from "../_shared/squad-runner.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Packaging Score Engine
 * Evaluates the synergy of title + thumbnail + hook + niche fit as one unit.
 * Returns 0-100 composite score with per-dimension breakdown.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, thumbnailPrompt, hookText, niche, videoType, language } = await req.json();
    if (!title && !hookText) throw new Error("At least title or hookText is required");

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const prompt = `You are a YouTube packaging analyst specializing in faceless/dark channels.
Analyze this content package as a UNIT and score each dimension 0-100.

TITLE: ${title || '(not provided)'}
THUMBNAIL CONCEPT: ${thumbnailPrompt || '(not provided)'}
HOOK (first 30s): ${hookText || '(not provided)'}
NICHE: ${niche || 'general'}
VIDEO TYPE: ${videoType || 'long'}
LANGUAGE: ${language || 'pt-BR'}

Score these 5 dimensions:

1. **title_thumb_synergy** (0-100): Does the title create curiosity that the thumbnail visually amplifies? Do they work as a pair or feel disconnected?
2. **promise_delivery** (0-100): Does the hook (first 30s) deliver on the promise made by title+thumbnail? Will viewers feel satisfied or baited?
3. **curiosity_gap** (0-100): How strong is the information gap? Does the package make you NEED to watch?
4. **niche_fit** (0-100): How well does this package fit the expectations and conventions of the ${niche || 'general'} niche while still standing out?
5. **scroll_stop_power** (0-100): In a feed of 20 thumbnails, would this one make you stop scrolling? Consider visual contrast, emotional trigger, text readability at small size.

Also provide:
- **composite_score**: weighted average (synergy 25%, promise 20%, curiosity 25%, niche_fit 15%, scroll_stop 15%)
- **ctr_estimate**: estimated CTR range as string (e.g. "4-7%") based on niche benchmarks
- **traffic_fit**: which traffic source this package is best for: "browse", "search", "suggested", or "shorts_feed"
- **weaknesses**: array of 2-3 specific weaknesses
- **improvements**: array of 2-3 actionable improvements
- **verdict**: one of "🟢 PUBLICAR", "🟡 OTIMIZAR", "🔴 REFORMULAR"

Return ONLY valid JSON, no markdown.`;

    const AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GOOGLE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
    const aiData = await resp.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    
    const result = JSON.parse(jsonMatch[0]);
    result.confidence_source = 'ai_estimate';
    result.calibration_note = '⚠️ Scores são estimativas da IA sem calibração empírica — use como referência, não como previsão.';

    // ═══ SQUAD ENHANCEMENT: Second opinion on packaging ═══
    let squadEnhanced = null;
    try {
      const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || '';
      const criticResult = await enhanceWithCritic(
        GOOGLE_AI_API_KEY, LOVABLE_KEY,
        JSON.stringify(result, null, 2),
        { title, thumbnailPrompt, hookText, niche, type: 'packaging' },
        `Você é um segundo avaliador de packaging YouTube. Revise a análise:
1. Os scores estão justos? Ajuste se necessário com justificativa
2. As melhorias sugeridas são realmente acionáveis?
3. Adicione: 3 variações de título alternativas que melhorariam o CTR
4. Sugira um conceito de thumbnail alternativo
5. Dê o veredicto final: publicar, otimizar ou reformular?
Responda em português.`
      );
      squadEnhanced = criticResult.enhanced || null;
    } catch (e) { console.warn("Squad enhancement skipped:", (e as Error).message); }

    result.squad_enhanced = squadEnhanced;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("packaging-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
