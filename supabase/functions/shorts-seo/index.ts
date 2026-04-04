import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ═══════════════════════════════════════════════════════════
// SHORTS-SPECIFIC SEO ENGINE
// YouTube Shorts algorithm is DIFFERENT from Longform:
// - No tags (ignored by Shorts shelf)
// - Hashtags matter (#shorts, #niche)  
// - First frame = "thumbnail"
// - Description under 100 chars for Shorts shelf
// - Trending sounds/formats matter
// - Swipe-away rate > click-through rate
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description = "", hashtags = [], niche = "general", language = "pt", keyword = "" } = await req.json();
    if (!title) throw new Error("title required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    // ═══ SHORTS-SPECIFIC SCORING ═══
    const scores: Record<string, { score: number; weight: number; tip: string }> = {};

    // 1. Title length (Shorts: 40-60 chars optimal — shorter than longform)
    const titleLen = title.length;
    scores.title_length = {
      score: titleLen >= 30 && titleLen <= 60 ? 10 : titleLen >= 20 && titleLen <= 70 ? 7 : 4,
      weight: 0.12,
      tip: titleLen > 60 ? "Encurte o título para <60 caracteres" : titleLen < 20 ? "Título muito curto, adicione contexto" : "✓ Tamanho ideal",
    };

    // 2. Hook in title (Shorts titles need IMMEDIATE hook)
    const hookPatterns = /^(como|por que|esse|esta|nunca|o que|quando|quem|top|the|how|why|this|never|what)/i;
    const hasHook = hookPatterns.test(title);
    scores.title_hook = {
      score: hasHook ? 9 : 5,
      weight: 0.15,
      tip: hasHook ? "✓ Título com gancho" : "Comece com uma palavra-gancho (Como, Por que, Nunca, Esse...)",
    };

    // 3. Emotional trigger
    const emotionals = ["chocante", "incrível", "nunca", "segredo", "proibido", "perigoso", "shocking", "never", "secret", "insane", "terrifying"];
    const emotionalHits = emotionals.filter(w => title.toLowerCase().includes(w));
    scores.emotional_trigger = {
      score: emotionalHits.length >= 2 ? 10 : emotionalHits.length === 1 ? 7 : 3,
      weight: 0.12,
      tip: emotionalHits.length === 0 ? "Adicione gatilho emocional ao título" : `✓ Gatilhos: ${emotionalHits.join(', ')}`,
    };

    // 4. Hashtags (Shorts need 3-5 relevant hashtags)
    const hashtagCount = hashtags.length;
    const hasShortTag = hashtags.some((h: string) => h.toLowerCase().includes("short"));
    scores.hashtags = {
      score: hashtagCount >= 3 && hashtagCount <= 5 && hasShortTag ? 10 
           : hashtagCount >= 2 && hashtagCount <= 7 ? 7 
           : hashtagCount >= 1 ? 4 : 1,
      weight: 0.15,
      tip: !hasShortTag ? "Adicione #shorts" : hashtagCount < 3 ? "Use 3-5 hashtags" : hashtagCount > 7 ? "Muitas hashtags (max 5)" : "✓ Hashtags OK",
    };

    // 5. Description (Shorts: keep under 100 chars for shelf display)
    const descLen = description.length;
    scores.description = {
      score: descLen > 0 && descLen <= 100 ? 10 : descLen > 100 && descLen <= 200 ? 7 : descLen === 0 ? 3 : 5,
      weight: 0.08,
      tip: descLen > 100 ? "Descrição muito longa para Shorts — primeiros 100 chars aparecem na shelf" : descLen === 0 ? "Adicione descrição curta" : "✓ Descrição ideal",
    };

    // 6. First frame hook (can't analyze without image, but check title for visual hook)
    const visualHook = /\d|🔥|😱|⚡|💀|🚨|❌|✅|👀/.test(title);
    scores.visual_hook = {
      score: visualHook ? 8 : 4,
      weight: 0.10,
      tip: visualHook ? "✓ Elementos visuais no título" : "Adicione emoji ou número para chamar atenção visual",
    };

    // 7. Keyword in title (for Shorts search)
    const kwLower = keyword.toLowerCase();
    const hasKw = kwLower && title.toLowerCase().includes(kwLower);
    scores.keyword = {
      score: hasKw ? 9 : kwLower ? 3 : 5,
      weight: 0.10,
      tip: kwLower && !hasKw ? `Palavra-chave "${keyword}" não está no título` : hasKw ? "✓ Keyword presente" : "Defina uma keyword-alvo",
    };

    // 8. Series potential (Parte X, #X, numbered)
    const isSeries = /parte|part|ep\.?|#\d|vol/i.test(title);
    scores.series_format = {
      score: isSeries ? 9 : 5,
      weight: 0.08,
      tip: isSeries ? "✓ Formato série — ótimo para Shorts" : "Considere formato série (Parte 1, Parte 2...)",
    };

    // 9. CTA potential
    const hasCTA = /(segu|follow|inscreva|subscribe|salva|save|comenta|comment)/i.test(description + title);
    scores.cta = {
      score: hasCTA ? 8 : 4,
      weight: 0.10,
      tip: hasCTA ? "✓ CTA presente" : "Adicione CTA na descrição (Segue pra mais, Salva esse vídeo)",
    };

    // Calculate total
    const totalScore = Math.round(
      Object.values(scores).reduce((sum, s) => sum + s.score * s.weight, 0) /
      Object.values(scores).reduce((sum, s) => sum + s.weight, 0) * 10
    ) / 10;

    const grade = totalScore >= 9 ? "A+" : totalScore >= 8 ? "A" : totalScore >= 7 ? "B+"
      : totalScore >= 6 ? "B" : totalScore >= 5 ? "C" : totalScore >= 4 ? "D" : "F";

    // AI suggestions for Shorts optimization
    let aiSuggestions: any = null;
    if (GOOGLE_AI_API_KEY) {
      const aiRes = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{
            role: "user",
            content: `Optimize this YouTube SHORT for the Shorts shelf algorithm.
Title: "${title}"
Niche: ${niche}
Language: ${language}
Current hashtags: ${hashtags.join(', ')}
Description: "${description}"

Return JSON:
{
  "optimized_title": "better title for Shorts (max 60 chars)",
  "suggested_hashtags": ["5 optimal hashtags including #shorts"],
  "optimal_description": "Short description under 100 chars",
  "first_frame_text": "text overlay for first frame (3-5 words max)",
  "hook_improvement": "how to make first 1 second more captivating",
  "series_suggestion": "how to turn this into a 10-part series"
}`
          }],
          response_format: { type: "json_object" },
        }),
      });
      if (aiRes.ok) {
        const d = await aiRes.json();
        try { aiSuggestions = JSON.parse(d.choices?.[0]?.message?.content || '{}'); } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      shorts_seo_score: totalScore,
      grade,
      scores,
      issues: Object.values(scores).filter(s => s.score < 6).map(s => s.tip),
      ai_suggestions: aiSuggestions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("shorts-seo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
