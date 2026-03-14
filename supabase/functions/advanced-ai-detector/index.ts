import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * ADVANCED AI DETECTOR — ML-Like Multi-Dimensional Analysis
 * 
 * Replaces the superficial 13-regex approach with a multi-layered
 * analysis that mirrors what YouTube's classifier looks for:
 * 
 * Layer 1: Statistical text analysis (no AI needed)
 * Layer 2: Pattern matching (expanded regex + heuristics)
 * Layer 3: AI classifier (Gemini evaluates "humanness")
 * 
 * Returns a composite score 0-100 (0 = definitely AI, 100 = definitely human)
 */

// ═══ LAYER 1: STATISTICAL ANALYSIS ═══
function statisticalAnalysis(text: string) {
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  
  const metrics: any = {};
  
  // 1. Vocabulary richness (Type-Token Ratio)
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúçñ]/gi, '')));
  metrics.ttr = uniqueWords.size / Math.max(words.length, 1);
  // AI text tends to have lower TTR (more repetitive vocabulary)
  metrics.ttr_score = metrics.ttr > 0.6 ? 20 : metrics.ttr > 0.45 ? 15 : metrics.ttr > 0.35 ? 10 : 5;

  // 2. Sentence length variance
  const sentLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
  const sentVariance = sentLengths.reduce((sum, len) => sum + Math.pow(len - avgSentLen, 2), 0) / Math.max(sentLengths.length, 1);
  const sentStdDev = Math.sqrt(sentVariance);
  // AI text has very uniform sentence lengths; human text varies wildly
  metrics.sentence_variance = sentStdDev;
  metrics.variance_score = sentStdDev > 12 ? 20 : sentStdDev > 8 ? 15 : sentStdDev > 5 ? 10 : 5;

  // 3. Paragraph length variation
  const paraLengths = paragraphs.map(p => p.split(/\s+/).length);
  const paraVariance = paraLengths.length > 1 
    ? Math.sqrt(paraLengths.reduce((sum, len) => {
        const avg = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
        return sum + Math.pow(len - avg, 2);
      }, 0) / paraLengths.length)
    : 0;
  metrics.para_variance_score = paraVariance > 20 ? 15 : paraVariance > 10 ? 10 : 5;

  // 4. Conversational markers (humans use these, AI avoids them)
  const conversationalMarkers = [
    /\b(tipo|sabe|né|tá|pô|mano|cara|velho|olha|bom|enfim|sei lá)\b/gi,
    /\b(basicamente|literalmente|obviamente)\b/gi,
    /\.{3}/g, // ellipsis
    /[!?]{2,}/g, // multiple punctuation
    /\b(eu acho|na real|sinceramente|pra ser honesto|entre nós)\b/gi,
    /\b(anyway|like|you know|basically|honestly|literally)\b/gi,
  ];
  let conversationalCount = 0;
  for (const marker of conversationalMarkers) {
    const matches = text.match(marker);
    if (matches) conversationalCount += matches.length;
  }
  const conversationalDensity = conversationalCount / (words.length / 100);
  metrics.conversational_score = conversationalDensity > 3 ? 20 : conversationalDensity > 1.5 ? 15 : conversationalDensity > 0.5 ? 10 : 3;

  // 5. Specific data points (numbers, dates, names — humans reference specifics)
  const specificPatterns = [
    /\d{1,3}[.,]\d{3}/g, // formatted numbers
    /\d+%/g, // percentages
    /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    /\b\d{4}\b/g, // years
    /\$[\d,.]+/g, // money
    /R\$[\d,.]+/g,
  ];
  let specificCount = 0;
  for (const p of specificPatterns) {
    const m = text.match(p);
    if (m) specificCount += m.length;
  }
  const specificDensity = specificCount / (words.length / 100);
  metrics.specificity_score = specificDensity > 2 ? 15 : specificDensity > 1 ? 10 : specificDensity > 0.3 ? 7 : 3;

  // Total Layer 1 score (max ~90, realistic max ~75)
  metrics.total = metrics.ttr_score + metrics.variance_score + metrics.para_variance_score + metrics.conversational_score + metrics.specificity_score;
  
  return metrics;
}

// ═══ LAYER 2: PATTERN MATCHING (Expanded) ═══
function patternAnalysis(text: string) {
  const penalties: { pattern: string; count: number; weight: number }[] = [];
  
  const slopPatterns: [RegExp, string, number][] = [
    // Portuguese AI-slop
    [/neste (vasto|incrível|fascinante)/gi, "opener_cliche_pt", 3],
    [/mergulh(e|emos|ando) (neste|nesta|no|na)/gi, "dive_in_pt", 3],
    [/é (crucial|fundamental|essencial|importante) (notar|destacar|mencionar|ressaltar)/gi, "importance_flag_pt", 2],
    [/jornada (incrível|fascinante|extraordinária|emocionante)/gi, "journey_cliche_pt", 3],
    [/no mundo (acelerado|dinâmico|moderno|atual|digital)/gi, "world_cliche_pt", 2],
    [/desbloqueie? o (potencial|poder|segredo)/gi, "unlock_cliche_pt", 3],
    [/sem mais delongas/gi, "without_delay_pt", 2],
    [/apertem os cintos/gi, "buckle_up_pt", 2],
    [/prepare-se para/gi, "prepare_yourself_pt", 1],
    [/isso vai mudar (tudo|sua vida|o jogo)/gi, "change_everything_pt", 2],
    [/vamos explorar/gi, "lets_explore_pt", 2],
    [/é um (verdadeiro|autêntico) (tesouro|diamante)/gi, "treasure_cliche_pt", 3],
    [/no (cenário|panorama|contexto) (atual|moderno|contemporâneo)/gi, "landscape_pt", 2],
    [/em última análise/gi, "ultimately_pt", 2],
    [/vale (a pena|ressaltar|destacar)/gi, "worth_noting_pt", 1],
    
    // English AI-slop
    [/buckle up/gi, "buckle_up_en", 2],
    [/let's dive (in|into|deep)/gi, "dive_in_en", 3],
    [/without further ado/gi, "without_ado_en", 2],
    [/in (this|today's) (fast-paced|ever-changing|dynamic)/gi, "world_cliche_en", 2],
    [/it's (crucial|important|essential) to (note|mention|highlight)/gi, "importance_en", 2],
    [/unlock (the|your) (potential|power|secret)/gi, "unlock_en", 3],
    [/game.?changer/gi, "gamechanger_en", 2],
    [/at the end of the day/gi, "end_of_day_en", 1],
    [/in (conclusion|summary)/gi, "conclusion_marker", 1],
    
    // Structural AI patterns
    [/\n(Primeiramente|Em primeiro lugar|Para começar),/gi, "list_opener_formal", 2],
    [/\n(Em segundo lugar|Além disso|Adicionalmente),/gi, "list_continuation_formal", 1],
    [/\n(Por fim|Finalmente|Em conclusão),/gi, "list_closer_formal", 2],
  ];

  let totalPenalty = 0;
  for (const [pattern, name, weight] of slopPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      penalties.push({ pattern: name, count: matches.length, weight });
      totalPenalty += matches.length * weight;
    }
  }

  // Superlative density (AI overuses superlatives)
  const superlatives = text.match(/(incrível|impressionante|fantástic[oa]|extraordinári[oa]|surpreendente|maravilhos[oa]|espetacular|magnífico|sensacional|phenomenal|amazing|incredible|fantastic|extraordinary|remarkable)/gi) || [];
  const words = text.split(/\s+/).length;
  const supDensity = (superlatives.length / words) * 1000;
  if (supDensity > 5) {
    penalties.push({ pattern: "superlative_density", count: superlatives.length, weight: 2 });
    totalPenalty += Math.floor(supDensity - 5) * 2;
  }

  // Repetitive sentence starters
  const starters = text.split(/[.!?]\s+/).map(s => s.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  const starterCounts: Record<string, number> = {};
  for (const s of starters) { starterCounts[s] = (starterCounts[s] || 0) + 1; }
  const repetitiveStarters = Object.entries(starterCounts).filter(([_, c]) => c >= 3);
  if (repetitiveStarters.length > 0) {
    penalties.push({ pattern: "repetitive_starters", count: repetitiveStarters.length, weight: 3 });
    totalPenalty += repetitiveStarters.length * 3;
  }

  // Score: 0 penalty = 100 (very human), high penalty = low score
  const layer2Score = Math.max(0, 100 - totalPenalty * 3);
  
  return { penalties, totalPenalty, score: layer2Score };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, language = "pt" } = await req.json();
    if (!text?.trim()) throw new Error("Text is required");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Layer 1: Statistical
    const layer1 = statisticalAnalysis(text);
    
    // Layer 2: Pattern
    const layer2 = patternAnalysis(text);

    // Layer 3: AI Classifier
    let layer3Score = 50; // default if AI fails
    let aiAnalysis: any = null;

    try {
      const aiRes = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { 
              role: "system", 
              content: `You are a YouTube content authenticity classifier. Your job is to determine if text was written by a human or AI. Score 0-100 where 0=definitely AI-generated, 100=definitely human-written.

SIGNALS OF AI TEXT:
- Uniform sentence length and structure
- Generic superlatives without specific data
- "Perfect" grammar with no personality
- Listicle structure (First... Second... Third...)
- Cliché openers ("In today's world", "Let's dive in")
- Conclusions that merely summarize
- No genuine emotion, humor, or personality
- Wikipedia/blog tone instead of conversational

SIGNALS OF HUMAN TEXT:
- Variable sentence lengths (short punchy + long flowing)
- Specific references (dates, numbers, names, places)
- Conversational fillers (right?, you know, basically)
- Imperfect grammar that sounds natural
- Genuine emotional reactions (anger, humor, surprise)
- Personal anecdotes or unique perspectives
- Unexpected word choices
- Cultural references` 
            },
            { role: "user", content: `Analyze this ${language === 'pt' ? 'Portuguese' : 'English'} YouTube script text (${text.split(/\s+/).length} words) and score its human authenticity:\n\n${text.slice(0, 6000)}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "classify_text",
              parameters: {
                type: "object",
                properties: {
                  human_score: { type: "number", description: "0-100 human authenticity score" },
                  confidence: { type: "number", description: "0-100 confidence in assessment" },
                  ai_signals: { type: "array", items: { type: "string" }, description: "Specific AI signals found" },
                  human_signals: { type: "array", items: { type: "string" }, description: "Specific human signals found" },
                  youtube_risk: { type: "string", description: "Risk level of YouTube penalizing this: low/medium/high/critical" },
                  rewrite_suggestions: { type: "array", items: { type: "string" }, description: "Top 3 specific edits to make it more human" },
                },
                required: ["human_score", "confidence", "ai_signals", "human_signals", "youtube_risk", "rewrite_suggestions"],
                additionalProperties: false,
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "classify_text" } },
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (tc) {
          aiAnalysis = JSON.parse(tc.function.arguments);
          layer3Score = aiAnalysis.human_score;
        }
      }
    } catch (e) {
      console.error("AI classifier error:", e);
    }

    // ═══ COMPOSITE SCORE ═══
    // Weighted: Layer1 (30%) + Layer2 (30%) + Layer3 (40%)
    const compositeScore = Math.round(
      (layer1.total / 90 * 100) * 0.30 +
      layer2.score * 0.30 +
      layer3Score * 0.40
    );

    const riskLevel = compositeScore >= 75 ? "low" : compositeScore >= 50 ? "medium" : compositeScore >= 30 ? "high" : "critical";

    return new Response(JSON.stringify({
      composite_score: compositeScore,
      risk_level: riskLevel,
      youtube_risk: aiAnalysis?.youtube_risk || riskLevel,
      layer1_statistical: {
        score: Math.round(layer1.total / 90 * 100),
        ttr: layer1.ttr,
        sentence_variance: layer1.sentence_variance,
        details: layer1,
      },
      layer2_patterns: {
        score: layer2.score,
        penalties_found: layer2.penalties.length,
        total_penalty: layer2.totalPenalty,
        details: layer2.penalties,
      },
      layer3_ai_classifier: {
        score: layer3Score,
        confidence: aiAnalysis?.confidence || 0,
        ai_signals: aiAnalysis?.ai_signals || [],
        human_signals: aiAnalysis?.human_signals || [],
        rewrite_suggestions: aiAnalysis?.rewrite_suggestions || [],
      },
      verdict: compositeScore >= 75 
        ? "✅ Texto parece autêntico e humano" 
        : compositeScore >= 50 
        ? "⚠️ Texto tem traços de IA — precisa de edição humana" 
        : "🚫 Alto risco de ser classificado como AI spam pelo YouTube",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("advanced-ai-detector error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
