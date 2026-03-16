import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * IDEA ENGINE V2
 * 
 * Flow: tema → gerar 20 ideias → ranquear → top N
 * Each idea gets: curiosity_score, viral_potential, competition_score, novelty_score → idea_score
 * Uses real data from prediction_vs_result and score_calibration to improve rankings
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, channelName, existingIdeas, count = 5 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ Gather intelligence from multiple sources ═══
    // Extract individual keywords from niche for broader matching
    const nicheKeywords = (niche || "").split(/[,\/\s]+/).filter((w: string) => w.length > 3);
    const nicheFilter = nicheKeywords.length > 0 ? nicheKeywords[0] : (niche || "");

    const [viralRes, channelRes, emergingRes, calibRes, learningRes, hookRes] = await Promise.all([
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern")
        .or(nicheKeywords.map((k: string) => `niche.ilike.%${k}%`).join(',') || `niche.ilike.%${niche || ""}%`)
        .order("views", { ascending: false }).limit(20),
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, style, viral_patterns")
        .or(nicheKeywords.map((k: string) => `niche.ilike.%${k}%`).join(',') || `niche.ilike.%${niche || ""}%`)
        .limit(10),
      sb.from("emerging_videos").select("title, views, pre_viral_score, velocity_score, niche")
        .eq("status", "pre_viral").order("pre_viral_score", { ascending: false }).limit(10),
      sb.from("score_calibration").select("score_type, niche, avg_error, bias_correction")
        .eq("score_type", "viral_probability").limit(10),
      sb.from("ai_learning").select("insight")
        .in("topic", ["calibration_meta", "backtest_meta_analysis"])
        .order("created_at", { ascending: false }).limit(3),
      sb.from("hook_library").select("hook_text, hook_type, retention_score")
        .or(nicheKeywords.map((k: string) => `niche.ilike.%${k}%`).join(',') || `niche.ilike.%${niche || ""}%`)
        .order("retention_score", { ascending: false }).limit(10),
    ]);

    const viralExamples = (viralRes.data || []).map(v => 
      `"${v.title}" (${(v.views/1000).toFixed(0)}K views, triggers: ${(v.emotional_triggers || []).join(', ')})`
    ).join('\n');

    const channelPatterns = (channelRes.data || []).map(c =>
      `${c.channel_name}: estilo ${c.style}, ${(c.avg_views/1000).toFixed(0)}K avg views`
    ).join('\n');

    const emergingTrends = (emergingRes.data || []).map(e =>
      `"${e.title}" (${e.views} views, pre-viral score: ${e.pre_viral_score}, velocity: ${e.velocity_score})`
    ).join('\n');

    const calibrationContext = (calibRes.data || []).map(c =>
      `Nicho ${c.niche}: erro médio ${c.avg_error}%, bias ${c.bias_correction > 0 ? '+' : ''}${c.bias_correction}`
    ).join('\n');

    const learningInsights = (learningRes.data || []).map(l => l.insight?.slice(0, 200)).join('\n');

    const topHooks = (hookRes.data || []).map(h => `[${h.hook_type}] "${h.hook_text}" (score: ${h.retention_score})`).join('\n');

    const existingList = (existingIdeas || []).map((i: string) => `- ${i}`).join('\n');

    // ═══ Generate 20 ideas with full scoring ═══
    const prompt = `Você é um estrategista de YouTube especializado em canais faceless de alto crescimento.

CONTEXTO:
- Nicho: ${niche || 'geral'}
${channelName ? `- Canal do usuário: ${channelName}` : ''}
${existingList ? `- Ideias que o usuário JÁ tem (NÃO repetir):\n${existingList}` : ''}

DADOS DE MERCADO (títulos virais REAIS com views confirmados):
${viralExamples || 'Nenhum dado disponível'}

CANAIS DE REFERÊNCIA:
${channelPatterns || 'Nenhum dado disponível'}

${emergingTrends ? `VÍDEOS PRÉ-VIRAIS DETECTADOS (tendências emergentes):\n${emergingTrends}\n` : ''}

${topHooks ? `HOOKS DE ALTA PERFORMANCE:\n${topHooks}\n` : ''}

${calibrationContext ? `CALIBRAÇÃO DO MODELO (erros conhecidos):\n${calibrationContext}\n` : ''}

${learningInsights ? `APRENDIZADOS RECENTES DO SISTEMA:\n${learningInsights}\n` : ''}

IMPORTANTE: Seus scores devem ser CALIBRADOS com base nos dados reais acima. NÃO invente scores otimistas sem base.

Gere EXATAMENTE 20 ideias de vídeo ÚNICAS e ranqueie cada uma com scores de 0-100:
- curiosity_score: quão curioso o público ficaria (baseado nos hooks que funcionam)
- viral_potential: probabilidade de viralizar (baseado nos dados reais de views)
- competition_score: quão saturado é o tópico (0=muito saturado, 100=oceano azul)
- novelty_score: quão original é a ideia

Calcule: idea_score = (curiosity * 0.3) + (viral_potential * 0.3) + (competition * 0.2) + (novelty * 0.2)

Ordene por idea_score decrescente.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "return_ranked_ideas",
            description: "Return ranked video ideas with scores",
            parameters: {
              type: "object",
              properties: {
                ideas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      concept: { type: "string" },
                      hook: { type: "string" },
                      priority: { type: "string", enum: ["alta", "média", "baixa"] },
                      curiosity_score: { type: "number" },
                      viral_potential: { type: "number" },
                      competition_score: { type: "number" },
                      novelty_score: { type: "number" },
                      idea_score: { type: "number" },
                    },
                    required: ["title", "concept", "hook", "priority", "curiosity_score", "viral_potential", "competition_score", "novelty_score", "idea_score"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["ideas"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_ranked_ideas" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let allIdeas: any[] = [];
    if (toolCall) {
      try {
        allIdeas = JSON.parse(toolCall.function.arguments).ideas || [];
      } catch (e) {
        console.error("Failed to parse tool_call arguments:", e);
      }
    }
    
    // Fallback: try to parse from message content if no tool_calls
    if (allIdeas.length === 0) {
      const content = aiData.choices?.[0]?.message?.content || "";
      console.log("No tool_calls found, trying content fallback. Content length:", content.length);
      if (content) {
        try {
          // Try to find JSON array in the content
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) allIdeas = parsed;
          } else {
            // Try to find JSON object with ideas key
            const objMatch = content.match(/\{[\s\S]*"ideas"[\s\S]*\}/);
            if (objMatch) {
              const parsed = JSON.parse(objMatch[0]);
              allIdeas = parsed.ideas || [];
            }
          }
        } catch (e2) {
          console.error("Content fallback parsing failed:", e2);
        }
      }
    }

    // Sort by idea_score descending and return top N
    allIdeas.sort((a: any, b: any) => (b.idea_score || 0) - (a.idea_score || 0));
    const topIdeas = allIdeas.slice(0, count);

    return new Response(JSON.stringify({ 
      ideas: topIdeas,
      total_generated: allIdeas.length,
      all_ideas: allIdeas,  // Full ranked list available
      viral_count: viralRes.data?.length || 0, 
      channel_count: channelRes.data?.length || 0,
      emerging_count: emergingRes.data?.length || 0,
      data_sources: {
        viral_titles: viralRes.data?.length || 0,
        channels: channelRes.data?.length || 0,
        emerging_videos: emergingRes.data?.length || 0,
        calibration_data: calibRes.data?.length || 0,
        learning_insights: learningRes.data?.length || 0,
        hooks: hookRes.data?.length || 0,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ideas error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
