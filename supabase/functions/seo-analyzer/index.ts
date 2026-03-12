import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// VidIQ-style scoring weights
const WEIGHTS = {
  title_length: 0.08,        // 50-70 chars optimal
  title_keywords: 0.15,      // keyword in first 50% of title
  title_emotional: 0.10,     // emotional trigger words
  title_numbers: 0.05,       // numbers in title
  description_length: 0.08,  // 200+ words
  description_keywords: 0.10, // keyword density 1-3%
  description_links: 0.05,   // timestamps, links, CTAs
  tags_count: 0.08,          // 10-15 tags
  tags_relevance: 0.10,      // tags match title/description
  thumbnail_text: 0.06,      // text overlay present
  competition: 0.08,         // keyword competition level
  trending: 0.07,            // keyword trending direction
};

function scoreTitleLength(len: number): number {
  if (len >= 50 && len <= 70) return 10;
  if (len >= 40 && len <= 80) return 8;
  if (len >= 30 && len <= 90) return 6;
  return 4;
}

function scoreDescriptionLength(len: number): number {
  if (len >= 300) return 10;
  if (len >= 200) return 8;
  if (len >= 100) return 6;
  if (len >= 50) return 4;
  return 2;
}

function scoreTagsCount(count: number): number {
  if (count >= 10 && count <= 15) return 10;
  if (count >= 5 && count <= 20) return 7;
  if (count >= 1) return 4;
  return 1;
}

const EMOTIONAL_WORDS = {
  en: ["shocking", "unbelievable", "secret", "hidden", "exposed", "never", "worst", "best", "ultimate", "insane", "incredible", "terrifying", "amazing", "dangerous", "forbidden", "mysterious", "powerful", "epic", "brutal", "mind-blowing"],
  pt: ["chocante", "inacreditável", "segredo", "escondido", "exposto", "nunca", "pior", "melhor", "definitivo", "incrível", "terrível", "perigoso", "proibido", "misterioso", "poderoso", "épico", "brutal", "impressionante", "surpreendente", "assustador"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { 
      title, description = "", tags = [], keyword = "", 
      language = "en", video_id, niche = "general",
      include_suggestions = true 
    } = await req.json();
    
    if (!title) throw new Error("title required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lang = language.startsWith("pt") ? "pt" : "en";
    const emotionalWords = EMOTIONAL_WORDS[lang] || EMOTIONAL_WORDS.en;
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // 1. Title Analysis
    const titleLengthScore = scoreTitleLength(title.length);
    
    const titleHasKeyword = keywordLower && titleLower.includes(keywordLower);
    const keywordInFirstHalf = keywordLower && titleLower.indexOf(keywordLower) < title.length / 2;
    const titleKeywordScore = !keywordLower ? 5 : (keywordInFirstHalf ? 10 : titleHasKeyword ? 7 : 2);
    
    const emotionalCount = emotionalWords.filter(w => titleLower.includes(w)).length;
    const titleEmotionalScore = Math.min(emotionalCount * 3 + 2, 10);
    
    const hasNumbers = /\d+/.test(title);
    const titleNumberScore = hasNumbers ? 8 : 4;

    // 2. Description Analysis
    const descWords = description.split(/\s+/).filter(Boolean).length;
    const descLengthScore = scoreDescriptionLength(descWords);
    
    let descKeywordScore = 5;
    if (keywordLower && descWords > 0) {
      const keywordCount = (descLower.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
      const density = (keywordCount / descWords) * 100;
      descKeywordScore = density >= 1 && density <= 3 ? 10 : density > 0 ? 6 : 2;
    }
    
    const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
    const hasLinks = /https?:\/\//.test(description);
    const hasCTA = /(subscribe|inscreva|like|curtir|comment|coment)/i.test(description);
    const descLinksScore = [hasTimestamps, hasLinks, hasCTA].filter(Boolean).length * 3 + 1;

    // 3. Tags Analysis
    const tagsCountScore = scoreTagsCount(tags.length);
    const tagsRelevanceScore = tags.length > 0 && keywordLower 
      ? Math.min(tags.filter((t: string) => t.toLowerCase().includes(keywordLower) || keywordLower.includes(t.toLowerCase())).length * 2 + 2, 10)
      : 5;

    // 4. Competition check via existing data
    let competitionScore = 5;
    let trendScore = 5;
    if (keywordLower) {
      const { data: kwData } = await sb.from("youtube_keywords")
        .select("competition, trend")
        .ilike("keyword", `%${keywordLower}%`)
        .limit(1)
        .maybeSingle();
      
      if (kwData) {
        competitionScore = kwData.competition === "low" ? 10 : kwData.competition === "medium" ? 6 : 3;
        trendScore = kwData.trend === "exploding" ? 10 : kwData.trend === "rising" ? 8 : kwData.trend === "stable" ? 5 : 3;
      }
    }

    // Calculate weighted total
    const scores = {
      title_length: { score: titleLengthScore, weight: WEIGHTS.title_length },
      title_keywords: { score: titleKeywordScore, weight: WEIGHTS.title_keywords },
      title_emotional: { score: titleEmotionalScore, weight: WEIGHTS.title_emotional },
      title_numbers: { score: titleNumberScore, weight: WEIGHTS.title_numbers },
      description_length: { score: descLengthScore, weight: WEIGHTS.description_length },
      description_keywords: { score: descKeywordScore, weight: WEIGHTS.description_keywords },
      description_links: { score: Math.min(descLinksScore, 10), weight: WEIGHTS.description_links },
      tags_count: { score: tagsCountScore, weight: WEIGHTS.tags_count },
      tags_relevance: { score: tagsRelevanceScore, weight: WEIGHTS.tags_relevance },
      competition: { score: competitionScore, weight: WEIGHTS.competition },
      trending: { score: trendScore, weight: WEIGHTS.trending },
    };

    const totalScore = Math.round(
      Object.values(scores).reduce((sum, s) => sum + s.score * s.weight, 0) / 
      Object.values(scores).reduce((sum, s) => sum + s.weight, 0) * 10
    ) / 10;

    // Grade
    const grade = totalScore >= 9 ? "A+" : totalScore >= 8 ? "A" : totalScore >= 7 ? "B+" : 
                  totalScore >= 6 ? "B" : totalScore >= 5 ? "C" : totalScore >= 4 ? "D" : "F";

    // Generate improvement suggestions
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (titleLengthScore < 8) issues.push(lang === "pt" ? `Título tem ${title.length} chars (ideal: 50-70)` : `Title is ${title.length} chars (ideal: 50-70)`);
    if (titleKeywordScore < 7) issues.push(lang === "pt" ? "Palavra-chave não está no início do título" : "Keyword not in first half of title");
    if (titleEmotionalScore < 5) issues.push(lang === "pt" ? "Título sem gatilhos emocionais" : "Title lacks emotional triggers");
    if (!hasNumbers) suggestions.push(lang === "pt" ? "Adicione números ao título (ex: '7 segredos', 'em 24h')" : "Add numbers to title (e.g., '7 secrets', 'in 24h')");
    if (descLengthScore < 6) issues.push(lang === "pt" ? `Descrição curta (${descWords} palavras, ideal: 200+)` : `Description too short (${descWords} words, ideal: 200+)`);
    if (!hasTimestamps) suggestions.push(lang === "pt" ? "Adicione timestamps na descrição" : "Add timestamps to description");
    if (tagsCountScore < 7) issues.push(lang === "pt" ? `Poucas tags (${tags.length}, ideal: 10-15)` : `Too few tags (${tags.length}, ideal: 10-15)`);

    // AI-powered title alternatives
    let aiSuggestions: any = null;
    if (include_suggestions) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Fetch top hooks and patterns from knowledge base
        const [{ data: hooks }, { data: patterns }] = await Promise.all([
          sb.from("hook_library").select("hook_text, hook_type, retention_score").order("retention_score", { ascending: false }).limit(10),
          sb.from("viral_titles_db").select("title, views").ilike("niche", `%${niche}%`).order("views", { ascending: false }).limit(10),
        ]);

        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `You are a YouTube SEO expert. Analyze this video metadata and provide optimization suggestions.

CURRENT TITLE: "${title}"
KEYWORD: "${keyword}"
NICHE: "${niche}"
LANGUAGE: ${language}
TAGS: ${tags.join(", ")}
DESCRIPTION (first 200 chars): "${description.slice(0, 200)}"

TOP VIRAL TITLES IN THIS NICHE:
${(patterns || []).map((p: any) => `- "${p.title}" (${p.views} views)`).join("\n")}

TOP HOOKS:
${(hooks || []).map((h: any) => `- "${h.hook_text}" (${h.retention_score}/10)`).join("\n")}

Provide JSON: { 
  alternative_titles: [5 optimized titles], 
  suggested_tags: [15 optimal tags],
  description_template: "optimized description template with timestamps",
  hook_suggestion: "best hook for first 3 seconds",
  seo_keywords: [5 related keywords to target],
  estimated_ctr_improvement: "percentage"
}`
            }],
            response_format: { type: "json_object" },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          try { aiSuggestions = JSON.parse(aiData.choices?.[0]?.message?.content || "{}"); } catch {}
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      seo_score: totalScore,
      grade,
      scores,
      issues,
      suggestions,
      ai_suggestions: aiSuggestions,
      metadata: {
        title_length: title.length,
        description_words: descWords,
        tags_count: tags.length,
        has_timestamps: hasTimestamps,
        has_links: hasLinks,
        has_cta: hasCTA,
        emotional_triggers_found: emotionalWords.filter(w => titleLower.includes(w)),
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
