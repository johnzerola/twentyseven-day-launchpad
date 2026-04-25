import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// ═══════════════════════════════════════════════════════════
// BACKTESTING ENGINE
// Compares predicted viral_probability vs actual performance
// Feeds accuracy data back to improve future predictions
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    // Find videos with predictions but not yet backtested (need 7+ days of data)
    const { data: videos } = await sb.from("video_performance")
      .select("id, title, youtube_video_id, views_current, views_day7, performance_grade, predicted_viral_score, predicted_attention_score, niche, hook_type, title_pattern, ai_feedback, created_at")
      .gt("predicted_viral_score", 0)
      .is("backtested_at", null)
      .not("views_day7", "is", null)
      .limit(20);

    if (!videos?.length) {
      return new Response(JSON.stringify({ success: true, message: "No videos ready for backtesting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any = { backtested: 0, accuracy_improvements: [], avg_accuracy: 0 };
    let totalAccuracy = 0;

    for (const vid of videos) {
      // Calculate actual performance tier (0-100 scale to match viral_probability)
      const views7d = vid.views_day7 || vid.views_current || 0;
      let actualScore = 0;
      
      // Map grade to score
      const gradeScores: Record<string, number> = { S: 95, A: 80, B: 65, C: 45, D: 25, F: 10 };
      actualScore = gradeScores[vid.performance_grade] || 30;

      // Factor in raw views for more granularity
      if (views7d > 1000000) actualScore = Math.max(actualScore, 95);
      else if (views7d > 100000) actualScore = Math.max(actualScore, 80);
      else if (views7d > 10000) actualScore = Math.max(actualScore, 60);
      else if (views7d > 1000) actualScore = Math.max(actualScore, 40);

      const predicted = vid.predicted_viral_score || 50;
      const diff = Math.abs(predicted - actualScore);
      const accuracy = Math.max(0, 100 - diff);

      // Determine what was over/under predicted
      const direction = predicted > actualScore ? "over_predicted" : predicted < actualScore ? "under_predicted" : "accurate";

      await sb.from("video_performance").update({
        prediction_accuracy: accuracy,
        backtested_at: new Date().toISOString(),
      }).eq("id", vid.id);

      totalAccuracy += accuracy;
      results.backtested++;

      // Generate correction insight for AI learning
      const insight = {
        video_title: vid.title,
        niche: vid.niche || "unknown",
        hook_type: vid.hook_type,
        title_pattern: vid.title_pattern,
        predicted_score: predicted,
        actual_score: actualScore,
        accuracy_pct: accuracy,
        direction,
        views_7d: views7d,
        grade: vid.performance_grade,
        correction: direction === "over_predicted"
          ? `Score previsto (${predicted}) foi ${diff} pontos ACIMA da realidade (${actualScore}). Calibrar para baixo em nichos similares.`
          : direction === "under_predicted"
          ? `Score previsto (${predicted}) foi ${diff} pontos ABAIXO da realidade (${actualScore}). O nicho/hook performou MELHOR que o esperado.`
          : `Previsão precisa (${predicted} ≈ ${actualScore}).`,
      };

      await sb.from("ai_learning").insert({
        topic: `backtest_${vid.niche || 'general'}_${direction}`,
        source: "backtest-scores",
        insight: JSON.stringify(insight),
      }).then(() => {}, () => {});

      results.accuracy_improvements.push({
        title: vid.title?.slice(0, 50),
        predicted,
        actual: actualScore,
        accuracy,
        direction,
      });
    }

    results.avg_accuracy = results.backtested > 0
      ? Math.round(totalAccuracy / results.backtested)
      : 0;

    // Generate meta-insight: overall prediction model quality
    if (GOOGLE_AI_API_KEY && results.backtested >= 3) {
      try {
        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Analise estes resultados de backtesting do nosso modelo de previsão de viralização:\n\n${JSON.stringify(results.accuracy_improvements, null, 2)}\n\nAccuracy média: ${results.avg_accuracy}%\n\nEm 2-3 frases: O que o modelo está errando? Que padrões de nicho/hook/título são mais difíceis de prever? Como calibrar melhor?`
            }],
          }),
        });
        if (aiRes.ok) {
          const d = await aiRes.json();
          const metaInsight = d.choices?.[0]?.message?.content || '';
          if (metaInsight) {
            await sb.from("ai_learning").insert({
              topic: "backtest_meta_analysis",
              source: "backtest-scores",
              insight: `[Accuracy: ${results.avg_accuracy}%] ${metaInsight}`,
            }).then(() => {}, () => {});
          }
        }
      } catch (e) { console.warn("Meta-analysis error:", e); }
    }

    await sb.from("execution_logs").insert({
      function_name: "backtest-scores",
      success: true,
      metadata: { backtested: results.backtested, avg_accuracy: results.avg_accuracy },
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backtest-scores error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
