import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ═══════════════════════════════════════════════════════════
// PATTERN EVOLUTION ENGINE
// Connects real video_performance data back to attention patterns,
// hook_library, and content_models to evolve them based on RESULTS
// Static patterns become self-improving with real-world validation
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    const results: any = {
      hooks_evolved: 0,
      patterns_updated: 0,
      new_insights: 0,
      attention_recalibrated: 0,
    };

    // 1) Fetch high-performing videos with AI feedback
    const { data: topVideos } = await sb.from("video_performance")
      .select("title, niche, hook_type, title_pattern, performance_grade, views_current, views_day7, ai_feedback, lessons_learned, predicted_viral_score, prediction_accuracy")
      .in("performance_grade", ["S", "A"])
      .not("ai_feedback", "is", null)
      .order("views_current", { ascending: false })
      .limit(30);

    // 2) Fetch low-performing videos for contrast
    const { data: lowVideos } = await sb.from("video_performance")
      .select("title, niche, hook_type, title_pattern, performance_grade, views_current, ai_feedback, lessons_learned")
      .in("performance_grade", ["D", "F"])
      .not("ai_feedback", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if ((!topVideos?.length) && (!lowVideos?.length)) {
      return new Response(JSON.stringify({ success: true, message: "No performance data to evolve from", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Update hook_library retention scores based on real results
    const hookUpdates: Record<string, { successes: number; failures: number }> = {};
    for (const v of (topVideos || [])) {
      const ht = v.hook_type;
      if (ht) {
        if (!hookUpdates[ht]) hookUpdates[ht] = { successes: 0, failures: 0 };
        hookUpdates[ht].successes++;
      }
    }
    for (const v of (lowVideos || [])) {
      const ht = v.hook_type;
      if (ht) {
        if (!hookUpdates[ht]) hookUpdates[ht] = { successes: 0, failures: 0 };
        hookUpdates[ht].failures++;
      }
    }

    for (const [hookType, data] of Object.entries(hookUpdates)) {
      const total = data.successes + data.failures;
      if (total < 2) continue;

      const successRate = data.successes / total;
      // Adjust retention scores: +0.5 for >70% success, -0.5 for <30% success
      let adjustment = 0;
      if (successRate > 0.7) adjustment = 0.5;
      else if (successRate < 0.3) adjustment = -0.5;

      if (adjustment !== 0) {
        const { data: hooks } = await sb.from("hook_library")
          .select("id, retention_score")
          .eq("hook_type", hookType)
          .limit(20);

        for (const hook of (hooks || [])) {
          const newScore = Math.max(1, Math.min(10, (hook.retention_score || 5) + adjustment));
          await sb.from("hook_library").update({ retention_score: newScore }).eq("id", hook.id);
          results.hooks_evolved++;
        }
      }
    }

    // 4) Update attention_engineering retention_impact based on niche performance
    const nichePerf: Record<string, { sCount: number; fCount: number }> = {};
    for (const v of (topVideos || [])) {
      const n = v.niche || 'general';
      if (!nichePerf[n]) nichePerf[n] = { sCount: 0, fCount: 0 };
      nichePerf[n].sCount++;
    }
    for (const v of (lowVideos || [])) {
      const n = v.niche || 'general';
      if (!nichePerf[n]) nichePerf[n] = { sCount: 0, fCount: 0 };
      nichePerf[n].fCount++;
    }

    // 5) Generate meta-insight with AI: what patterns are working NOW
    if (GOOGLE_AI_API_KEY && (topVideos?.length || 0) >= 3) {
      try {
        const topSummary = (topVideos || []).slice(0, 10).map(v => ({
          title: v.title,
          grade: v.performance_grade,
          views: v.views_current,
          hook: v.hook_type,
          pattern: v.title_pattern,
          niche: v.niche,
          lessons: v.lessons_learned,
          accuracy: v.prediction_accuracy,
        }));

        const lowSummary = (lowVideos || []).slice(0, 10).map(v => ({
          title: v.title,
          grade: v.performance_grade,
          views: v.views_current,
          hook: v.hook_type,
          niche: v.niche,
          lessons: v.lessons_learned,
        }));

        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Analise estes dados de performance REAL de vídeos do YouTube:

TOP PERFORMERS (Grade S/A):
${JSON.stringify(topSummary, null, 2)}

LOW PERFORMERS (Grade D/F):
${JSON.stringify(lowSummary, null, 2)}

Em formato JSON, retorne:
1. "working_patterns": array de padrões que estão FUNCIONANDO agora (hooks, estruturas, nichos)
2. "failing_patterns": array de padrões que estão FALHANDO
3. "hook_recommendations": quais tipos de hook priorizar
4. "niche_insights": quais nichos estão performando melhor
5. "calibration_notes": como calibrar melhor as previsões futuras
6. "new_attention_techniques": 2-3 novas técnicas de atenção baseadas nos padrões de sucesso`
            }],
          }),
        });

        if (aiRes.ok) {
          const d = await aiRes.json();
          const insight = d.choices?.[0]?.message?.content || '';
          if (insight) {
            await sb.from("ai_learning").insert({
              topic: "pattern_evolution",
              source: "evolve-patterns",
              insight: insight.slice(0, 4000),
            });
            results.new_insights++;
          }
        }
      } catch (e) { console.warn("Evolution AI error:", e); }
    }

    // 6) Update niche performance in ai_learning
    for (const [nicheName, perf] of Object.entries(nichePerf)) {
      const total = perf.sCount + perf.fCount;
      if (total >= 2) {
        await sb.from("ai_learning").insert({
          topic: `niche_evolution_${nicheName}`,
          source: "evolve-patterns",
          insight: JSON.stringify({
            niche: nicheName,
            success_rate: Math.round((perf.sCount / total) * 100),
            successes: perf.sCount,
            failures: perf.fCount,
            timestamp: new Date().toISOString(),
          }),
        }).then(() => {}, () => {});
        results.patterns_updated++;
      }
    }

    await sb.from("execution_logs").insert({
      function_name: "evolve-patterns",
      success: true,
      metadata: results,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evolve-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
