import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// YOUTUBE SUGGEST KEYWORDS
// Uses YouTube Suggest API (FREE, no quota) for:
// - Keyword volume estimation
// - Keyword difficulty scoring  
// - Related/trending keyword discovery
// - Competitor keyword gap analysis
// ═══════════════════════════════════════════════════════════

async function getYouTubeSuggestions(query: string, lang: string = "en"): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&hl=${lang}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  const text = await res.text();
  
  // Parse JSONP response
  const match = text.match(/\[.*\]/s);
  if (!match) return [];
  
  try {
    const parsed = JSON.parse(match[0]);
    // YouTube suggest returns [query, [[suggestion1, 0], [suggestion2, 0], ...]]
    if (Array.isArray(parsed[1])) {
      return parsed[1].map((item: any) => (Array.isArray(item) ? item[0] : item)).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

function estimateVolume(suggestions: string[], keyword: string): { volume: string; score: number } {
  // Heuristic: more suggestions = higher volume
  // If the exact keyword appears in suggestions = very searched
  const exactMatch = suggestions.some(s => s.toLowerCase() === keyword.toLowerCase());
  const partialMatches = suggestions.filter(s => s.toLowerCase().includes(keyword.toLowerCase())).length;
  
  if (exactMatch && suggestions.length >= 8) return { volume: "very_high", score: 9 };
  if (suggestions.length >= 8) return { volume: "high", score: 7 };
  if (suggestions.length >= 5) return { volume: "medium", score: 5 };
  if (suggestions.length >= 2) return { volume: "low", score: 3 };
  return { volume: "very_low", score: 1 };
}

function estimateDifficulty(suggestions: string[]): { difficulty: string; score: number } {
  // More specific/long-tail suggestions = lower difficulty
  const avgLength = suggestions.reduce((s, q) => s + q.split(' ').length, 0) / Math.max(suggestions.length, 1);
  
  if (avgLength >= 5) return { difficulty: "low", score: 2 }; // Long-tail = easy
  if (avgLength >= 3) return { difficulty: "medium", score: 5 };
  return { difficulty: "high", score: 8 }; // Short queries = competitive
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, language = "en", mode = "full", niche } = await req.json();
    if (!keyword) throw new Error("keyword required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const lang = language.startsWith("pt") ? "pt" : language.startsWith("es") ? "es" : "en";

    // Check cache
    const cacheKey = `yt_suggest_${keyword}_${lang}`;
    const { data: cached } = await sb.from("research_cache")
      .select("result_json").eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({ success: true, ...cached.result_json, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get suggestions for main keyword + alphabet expansion
    const [mainSuggestions, ...alphabetResults] = await Promise.all([
      getYouTubeSuggestions(keyword, lang),
      // Alphabet soup technique: keyword + a, keyword + b, etc.
      ...['a', 'e', 'i', 'o', 'u', 'como', 'porque', 'melhor', 'top'].slice(0, 6).map(letter =>
        getYouTubeSuggestions(`${keyword} ${letter}`, lang)
      ),
    ]);

    const allSuggestions = [...new Set([...mainSuggestions, ...alphabetResults.flat()])];

    // Estimate metrics
    const volumeEstimate = estimateVolume(mainSuggestions, keyword);
    const difficultyEstimate = estimateDifficulty(mainSuggestions);
    
    // Opportunity score: high volume + low difficulty = high opportunity
    const opportunityScore = Math.round(((volumeEstimate.score * 0.6) + ((10 - difficultyEstimate.score) * 0.4)) * 10) / 10;

    // Categorize suggestions
    const longTail = allSuggestions.filter(s => s.split(' ').length >= 4);
    const questions = allSuggestions.filter(s => /^(how|what|why|when|como|porque|o que|quando|qual)/i.test(s));
    const trending = allSuggestions.filter(s => /2026|2025|novo|new|latest|último/i.test(s));

    const result = {
      keyword,
      language: lang,
      suggestions: mainSuggestions,
      all_related: allSuggestions,
      long_tail_keywords: longTail,
      question_keywords: questions,
      trending_keywords: trending,
      volume_estimate: volumeEstimate,
      difficulty_estimate: difficultyEstimate,
      opportunity_score: opportunityScore,
      total_suggestions: allSuggestions.length,
      seo_recommendation: opportunityScore >= 7
        ? "EXCELLENT — High volume, low competition. Target this keyword."
        : opportunityScore >= 5
        ? "GOOD — Decent opportunity. Consider long-tail variations."
        : opportunityScore >= 3
        ? "MODERATE — High competition. Use long-tail keywords instead."
        : "DIFFICULT — Very competitive. Find alternative angles.",
    };

    // Cache for 24h
    await sb.from("research_cache").upsert({
      cache_key: cacheKey,
      source: "youtube_suggest",
      query: keyword,
      result_json: result,
      expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    }, { onConflict: "cache_key" }).catch(() => {});

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
