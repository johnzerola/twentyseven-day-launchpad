import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Expanded VidIQ-style scoring — 18 factors
const WEIGHTS = {
  // Title (40%)
  title_length: 0.06,
  title_keywords: 0.10,
  title_emotional: 0.08,
  title_numbers: 0.04,
  title_power_words: 0.04,
  title_question: 0.03,
  title_brackets: 0.03,
  title_readability: 0.02,
  // Description (25%)
  description_length: 0.06,
  description_keywords: 0.07,
  description_links: 0.04,
  description_first_line: 0.04,
  description_hashtags: 0.04,
  // Tags (15%)
  tags_count: 0.06,
  tags_relevance: 0.06,
  tags_long_tail: 0.03,
  // Market (20%)
  competition: 0.08,
  trending: 0.07,
  search_intent: 0.05,
};

type Factor = { score: number; weight: number; label: string; tip: string; category: string };

function scoreTitleLength(len: number): { score: number; tip: string } {
  if (len >= 45 && len <= 65) return { score: 10, tip: "✅ Comprimento ideal" };
  if (len >= 35 && len <= 75) return { score: 8, tip: "Bom, mas tente 45-65 caracteres" };
  if (len >= 25 && len <= 85) return { score: 5, tip: len < 45 ? "Título curto demais — adicione contexto" : "Título longo — pode ser cortado no YouTube" };
  return { score: 3, tip: len < 25 ? "Muito curto — pouco informativo" : "Muito longo — será truncado" };
}

function scoreDescLength(words: number): { score: number; tip: string } {
  if (words >= 300) return { score: 10, tip: "✅ Descrição robusta" };
  if (words >= 200) return { score: 8, tip: "Boa, tente chegar a 300+ palavras" };
  if (words >= 100) return { score: 5, tip: "Adicione mais contexto, links e timestamps" };
  if (words >= 50) return { score: 3, tip: "Descrição muito curta — perde SEO" };
  return { score: 1, tip: "Descrição quase vazia — grande perda de ranking" };
}

function scoreTagsCount(count: number): { score: number; tip: string } {
  if (count >= 10 && count <= 15) return { score: 10, tip: "✅ Quantidade ideal de tags" };
  if (count >= 6 && count <= 20) return { score: 7, tip: "Bom, ideal é 10-15 tags" };
  if (count >= 1) return { score: 4, tip: "Poucas tags — adicione variações da keyword" };
  return { score: 1, tip: "Sem tags — grande perda de discoverability" };
}

const POWER_WORDS: Record<string, string[]> = {
  en: ["ultimate", "proven", "exclusive", "breaking", "insider", "hack", "strategy", "free", "new", "top", "fast", "easy", "complete", "guide", "truth", "real", "official", "first", "last"],
  pt: ["definitivo", "comprovado", "exclusivo", "urgente", "hack", "estratégia", "grátis", "novo", "top", "rápido", "fácil", "completo", "guia", "verdade", "real", "oficial", "primeiro", "último", "segredo", "revelado"],
};

const EMOTIONAL_WORDS: Record<string, string[]> = {
  en: ["shocking", "unbelievable", "secret", "hidden", "exposed", "never", "worst", "best", "insane", "incredible", "terrifying", "amazing", "dangerous", "forbidden", "mysterious", "powerful", "epic", "brutal", "mind-blowing", "heartbreaking", "devastating", "unreal"],
  pt: ["chocante", "inacreditável", "segredo", "escondido", "exposto", "nunca", "pior", "melhor", "incrível", "terrível", "perigoso", "proibido", "misterioso", "poderoso", "épico", "brutal", "impressionante", "surpreendente", "assustador", "devastador", "irreal", "absurdo"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      title, description = "", tags = [], keyword = "",
      language = "en", niche = "general",
      include_suggestions = true,
    } = await req.json();

    if (!title) throw new Error("title required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lang = language.startsWith("pt") ? "pt" : "en";
    const emotionalWords = EMOTIONAL_WORDS[lang] || EMOTIONAL_WORDS.en;
    const powerWords = POWER_WORDS[lang] || POWER_WORDS.en;
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // ======= TITLE ANALYSIS =======
    const tLen = scoreTitleLength(title.length);

    const titleHasKeyword = keywordLower && titleLower.includes(keywordLower);
    const keywordInFirstHalf = keywordLower && titleLower.indexOf(keywordLower) < title.length / 2;
    const titleKeyword = !keywordLower
      ? { score: 5, tip: lang === "pt" ? "Defina uma keyword principal" : "Set a main keyword" }
      : keywordInFirstHalf
        ? { score: 10, tip: "✅ Keyword no início do título" }
        : titleHasKeyword
          ? { score: 7, tip: "Mova a keyword para o início do título" }
          : { score: 2, tip: "Keyword ausente no título — muito prejudicial" };

    const emotionalFound = emotionalWords.filter(w => titleLower.includes(w));
    const emotionalCount = emotionalFound.length;
    const titleEmotional = {
      score: Math.min(emotionalCount * 3 + 2, 10),
      tip: emotionalCount >= 2 ? "✅ Fortes gatilhos emocionais" : emotionalCount === 1 ? "Bom, tente adicionar mais um gatilho" : "Sem gatilhos emocionais — adicione curiosidade ou urgência",
    };

    const hasNumbers = /\d+/.test(title);
    const titleNumbers = {
      score: hasNumbers ? 9 : 4,
      tip: hasNumbers ? "✅ Números aumentam CTR" : "Adicione números (ex: '7 segredos', 'em 24h')",
    };

    const powerFound = powerWords.filter(w => titleLower.includes(w));
    const titlePower = {
      score: Math.min(powerFound.length * 4 + 2, 10),
      tip: powerFound.length >= 2 ? "✅ Power words fortes" : powerFound.length === 1 ? `Bom: "${powerFound[0]}"` : "Adicione power words (Definitivo, Exclusivo, Revelado...)",
    };

    const isQuestion = /[?？]/.test(title);
    const titleQuestion = {
      score: isQuestion ? 9 : 5,
      tip: isQuestion ? "✅ Perguntas geram curiosidade" : "Considere formato de pergunta para aumentar engajamento",
    };

    const hasBrackets = /[\[\(]/.test(title);
    const titleBrackets = {
      score: hasBrackets ? 9 : 4,
      tip: hasBrackets ? "✅ Brackets chamam atenção" : "Adicione [2026] ou (REAL) para +33% CTR",
    };

    // Readability — Flesch-like simplicity
    const avgWordLen = title.split(/\s+/).reduce((a, w) => a + w.length, 0) / (title.split(/\s+/).length || 1);
    const titleReadability = {
      score: avgWordLen <= 5 ? 10 : avgWordLen <= 7 ? 7 : 4,
      tip: avgWordLen <= 5 ? "✅ Título fácil de ler" : "Use palavras mais curtas e diretas",
    };

    // ======= DESCRIPTION ANALYSIS =======
    const descWords = description.split(/\s+/).filter(Boolean).length;
    const dLen = scoreDescLength(descWords);

    let descKeyword = { score: 5, tip: "Defina uma keyword para análise" };
    if (keywordLower && descWords > 0) {
      const keywordCount = (descLower.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
      const density = (keywordCount / descWords) * 100;
      descKeyword = density >= 1 && density <= 3
        ? { score: 10, tip: `✅ Densidade ${density.toFixed(1)}% (ideal)` }
        : density > 3
          ? { score: 5, tip: `Densidade ${density.toFixed(1)}% — pode parecer spam` }
          : density > 0
            ? { score: 6, tip: `Densidade ${density.toFixed(1)}% — repita a keyword mais vezes` }
            : { score: 2, tip: "Keyword ausente na descrição" };
    }

    const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
    const hasLinks = /https?:\/\//.test(description);
    const hasCTA = /(subscribe|inscreva|like|curtir|comment|coment|share|compartilh)/i.test(description);
    const linksScore = [hasTimestamps, hasLinks, hasCTA].filter(Boolean).length;
    const descLinks = {
      score: Math.min(linksScore * 3 + 1, 10),
      tip: linksScore >= 3 ? "✅ Timestamps + Links + CTA" : `Faltam: ${[!hasTimestamps && "timestamps", !hasLinks && "links", !hasCTA && "CTA"].filter(Boolean).join(", ")}`,
    };

    // First line of description — most important for search
    const firstLine = description.split('\n')[0] || "";
    const firstLineHasKW = keywordLower && firstLine.toLowerCase().includes(keywordLower);
    const descFirstLine = {
      score: firstLineHasKW ? 10 : firstLine.length > 30 ? 5 : 2,
      tip: firstLineHasKW ? "✅ Keyword na primeira linha" : "Coloque a keyword principal na primeira frase da descrição",
    };

    const hashtagCount = (description.match(/#\w+/g) || []).length;
    const descHashtags = {
      score: hashtagCount >= 3 && hashtagCount <= 5 ? 10 : hashtagCount >= 1 ? 6 : 2,
      tip: hashtagCount >= 3 ? "✅ Hashtags bem usadas" : hashtagCount >= 1 ? "Adicione 3-5 hashtags no final" : "Sem hashtags — adicione 3-5 relevantes",
    };

    // ======= TAGS ANALYSIS =======
    const tCount = scoreTagsCount(tags.length);

    const tagsLower = tags.map((t: string) => t.toLowerCase());
    const tagsRelevance = tags.length > 0 && keywordLower
      ? { score: Math.min(tagsLower.filter((t: string) => t.includes(keywordLower) || keywordLower.includes(t)).length * 2 + 2, 10), tip: "Relevância das tags com a keyword" }
      : { score: 5, tip: "Defina keyword para avaliar relevância" };

    const longTailTags = tags.filter((t: string) => t.split(/\s+/).length >= 3);
    const tagsLongTail = {
      score: longTailTags.length >= 3 ? 10 : longTailTags.length >= 1 ? 6 : 2,
      tip: longTailTags.length >= 3 ? "✅ Boas tags long-tail" : "Adicione tags de 3+ palavras (ex: 'como ganhar dinheiro online')",
    };

    // ======= MARKET ANALYSIS =======
    let competitionData = { score: 5, tip: "Sem dados de competição" };
    let trendData = { score: 5, tip: "Sem dados de tendência" };
    let searchIntent = { score: 5, tip: "Defina keyword para análise de intenção" };

    if (keywordLower) {
      // Check YouTube suggest for search volume proxy
      try {
        const suggestRes = await fetch(`https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(keywordLower)}&hl=${lang}`);
        const suggestText = await suggestRes.text();
        const suggestMatch = suggestText.match(/\[.*\]/s);
        if (suggestMatch) {
          const parsed = JSON.parse(suggestMatch[0]);
          const suggestions = parsed[1]?.map((s: any) => s[0]) || [];
          const exactMatch = suggestions.some((s: string) => s.toLowerCase() === keywordLower);
          searchIntent = {
            score: exactMatch ? 10 : suggestions.length >= 5 ? 8 : suggestions.length >= 2 ? 6 : 3,
            tip: exactMatch ? "✅ Keyword com alto volume de busca" : suggestions.length >= 5 ? "Keyword popular — boa demanda" : "Keyword com pouca busca — considere variações",
          };
        }
      } catch { /* non-blocking */ }

      // Check internal data
      const { data: viralData } = await sb.from("viral_titles_db")
        .select("title, views")
        .ilike("title", `%${keywordLower.split(" ")[0]}%`)
        .order("views", { ascending: false })
        .limit(5);

      if (viralData?.length) {
        const avgViews = viralData.reduce((a: number, v: any) => a + (v.views || 0), 0) / viralData.length;
        competitionData = {
          score: avgViews > 1_000_000 ? 4 : avgViews > 500_000 ? 6 : avgViews > 100_000 ? 8 : 9,
          tip: avgViews > 1_000_000 ? "Alta competição — diferencie-se" : avgViews > 100_000 ? "Competição moderada — boas chances" : "Baixa competição — ótima oportunidade",
        };
      }

      // Check niche velocity for trends
      const { data: velData } = await sb.from("niche_velocity")
        .select("growth_velocity, opportunity_window")
        .ilike("niche", `%${niche}%`)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (velData) {
        const vel = velData.growth_velocity || 0;
        trendData = {
          score: vel > 50 ? 10 : vel > 20 ? 8 : vel > 0 ? 6 : 3,
          tip: vel > 50 ? "🔥 Nicho em explosão!" : vel > 20 ? "📈 Tendência de crescimento" : vel > 0 ? "Nicho estável" : "Nicho em declínio — cuidado",
        };
      }
    }

    // ======= BUILD SCORES OBJECT =======
    const scores: Record<string, Factor> = {
      title_length:       { ...tLen, weight: WEIGHTS.title_length, label: "Comprimento do Título", category: "title" },
      title_keywords:     { ...titleKeyword, weight: WEIGHTS.title_keywords, label: "Keyword no Título", category: "title" },
      title_emotional:    { ...titleEmotional, weight: WEIGHTS.title_emotional, label: "Gatilhos Emocionais", category: "title" },
      title_numbers:      { ...titleNumbers, weight: WEIGHTS.title_numbers, label: "Números no Título", category: "title" },
      title_power_words:  { ...titlePower, weight: WEIGHTS.title_power_words, label: "Power Words", category: "title" },
      title_question:     { ...titleQuestion, weight: WEIGHTS.title_question, label: "Formato Pergunta", category: "title" },
      title_brackets:     { ...titleBrackets, weight: WEIGHTS.title_brackets, label: "Brackets/Parênteses", category: "title" },
      title_readability:  { ...titleReadability, weight: WEIGHTS.title_readability, label: "Legibilidade", category: "title" },
      description_length: { ...dLen, weight: WEIGHTS.description_length, label: "Tamanho da Descrição", category: "description" },
      description_keywords: { ...descKeyword, weight: WEIGHTS.description_keywords, label: "Keywords na Descrição", category: "description" },
      description_links:  { ...descLinks, weight: WEIGHTS.description_links, label: "Links, Timestamps & CTA", category: "description" },
      description_first_line: { ...descFirstLine, weight: WEIGHTS.description_first_line, label: "Primeira Linha", category: "description" },
      description_hashtags: { ...descHashtags, weight: WEIGHTS.description_hashtags, label: "Hashtags", category: "description" },
      tags_count:         { ...tCount, weight: WEIGHTS.tags_count, label: "Quantidade de Tags", category: "tags" },
      tags_relevance:     { ...tagsRelevance, weight: WEIGHTS.tags_relevance, label: "Relevância das Tags", category: "tags" },
      tags_long_tail:     { ...tagsLongTail, weight: WEIGHTS.tags_long_tail, label: "Tags Long-tail", category: "tags" },
      competition:        { ...competitionData, weight: WEIGHTS.competition, label: "Nível de Competição", category: "market" },
      trending:           { ...trendData, weight: WEIGHTS.trending, label: "Tendência do Nicho", category: "market" },
      search_intent:      { ...searchIntent, weight: WEIGHTS.search_intent, label: "Intenção de Busca", category: "market" },
    };

    const totalWeight = Object.values(scores).reduce((s, f) => s + f.weight, 0);
    const totalScore = Math.round(
      Object.values(scores).reduce((s, f) => s + f.score * f.weight, 0) / totalWeight * 10
    ) / 10;

    const grade = totalScore >= 9 ? "A+" : totalScore >= 8 ? "A" : totalScore >= 7 ? "B+" :
                  totalScore >= 6 ? "B" : totalScore >= 5 ? "C" : totalScore >= 4 ? "D" : "F";

    // Category sub-scores
    const categoryScores: Record<string, number> = {};
    for (const cat of ["title", "description", "tags", "market"]) {
      const catFactors = Object.values(scores).filter(f => f.category === cat);
      const catWeight = catFactors.reduce((s, f) => s + f.weight, 0);
      categoryScores[cat] = catWeight > 0
        ? Math.round(catFactors.reduce((s, f) => s + f.score * f.weight, 0) / catWeight * 10) / 10
        : 5;
    }

    // Top issues (worst factors)
    const issues = Object.entries(scores)
      .filter(([, f]) => f.score < 7)
      .sort(([, a], [, b]) => (a.score * a.weight) - (b.score * b.weight))
      .slice(0, 5)
      .map(([, f]) => `${f.label}: ${f.tip}`);

    // AI suggestions
    let aiSuggestions: any = null;
    if (include_suggestions) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const [{ data: hooks }, { data: viralTitles }] = await Promise.all([
          sb.from("hook_library").select("hook_text, hook_type, retention_score").order("retention_score", { ascending: false }).limit(8),
          sb.from("viral_titles_db").select("title, views").ilike("niche", `%${niche}%`).order("views", { ascending: false }).limit(8),
        ]);

        const prompt = `You are a YouTube SEO expert. Analyze and provide SPECIFIC optimization suggestions.

CURRENT TITLE: "${title}"
KEYWORD: "${keyword}"
NICHE: "${niche}"
LANGUAGE: ${language}
CURRENT SEO SCORE: ${totalScore}/10 (Grade: ${grade})
TAGS: ${tags.join(", ")}
DESCRIPTION (first 300 chars): "${description.slice(0, 300)}"

WORST FACTORS:
${issues.join("\n")}

TOP VIRAL TITLES IN THIS NICHE:
${(viralTitles || []).map((p: any) => `- "${p.title}" (${(p.views || 0).toLocaleString()} views)`).join("\n")}

TOP HOOKS:
${(hooks || []).map((h: any) => `- "${h.hook_text}" (${h.retention_score}/10)`).join("\n")}

IMPORTANT: All suggestions must be in ${language === "pt" ? "Portuguese" : "English"}.`;

        try {
          const aiRes = await fetch(AI_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "user", content: prompt }],
              tools: [{
                type: "function",
                function: {
                  name: "seo_suggestions",
                  description: "Return SEO optimization suggestions",
                  parameters: {
                    type: "object",
                    properties: {
                      alternative_titles: { type: "array", items: { type: "object", properties: { title: { type: "string" }, estimated_ctr: { type: "number" }, why_better: { type: "string" } }, required: ["title", "estimated_ctr", "why_better"] }, description: "5 optimized title alternatives" },
                      suggested_tags: { type: "array", items: { type: "string" }, description: "15 optimal tags" },
                      description_template: { type: "string", description: "Optimized description template with timestamps, links, CTAs" },
                      hook_suggestion: { type: "string", description: "Best hook for first 3 seconds" },
                      seo_keywords: { type: "array", items: { type: "string" }, description: "5 related keywords to target" },
                      quick_wins: { type: "array", items: { type: "string" }, description: "3 quick actions to improve score immediately" },
                    },
                    required: ["alternative_titles", "suggested_tags", "description_template", "hook_suggestion", "seo_keywords", "quick_wins"],
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "seo_suggestions" } },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              try { aiSuggestions = JSON.parse(toolCall.function.arguments); } catch {}
            }
          }
        } catch (e) {
          console.error("AI suggestion error:", e);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      seo_score: totalScore,
      grade,
      scores,
      category_scores: categoryScores,
      issues,
      ai_suggestions: aiSuggestions,
      metadata: {
        title_length: title.length,
        description_words: descWords,
        tags_count: tags.length,
        has_timestamps: hasTimestamps,
        has_links: hasLinks,
        has_cta: hasCTA,
        hashtag_count: hashtagCount,
        emotional_triggers_found: emotionalFound,
        power_words_found: powerFound,
        long_tail_tags: longTailTags.length,
        is_question: isQuestion,
        has_brackets: hasBrackets,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-analyzer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
