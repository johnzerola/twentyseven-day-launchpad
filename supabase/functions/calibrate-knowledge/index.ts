import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * CALIBRATE KNOWLEDGE — Auto-Evolution Feedback Loop
 * 
 * Compares AI predictions (script scores) vs real video performance (tracker data)
 * and adjusts effectiveness_score in the knowledge base accordingly.
 * 
 * Flow:
 * 1. Fetch scripts that have both AI scores AND real performance data
 * 2. Compare predicted retention/virality vs actual
 * 3. Identify which techniques/hooks actually worked
 * 4. Update effectiveness_score in knowledge tables
 * 5. Store calibration insights in ai_learning
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const startTime = Date.now();

    // ═══ STEP 1: Fetch videos with both predictions AND real data ═══
    const { data: blueprints } = await sb.from("video_blueprints")
      .select("video_id,video_title,scores,hook_type,narrative_style,visual_style,niche,views,likes")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!blueprints || blueprints.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No blueprints to calibrate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ STEP 2: Analyze prediction accuracy ═══
    const calibrationInsights: any[] = [];
    const hookPerformance: Record<string, { predicted: number[]; actual: number[] }> = {};
    const stylePerformance: Record<string, { predicted: number[]; actual: number[] }> = {};

    for (const bp of blueprints) {
      const scores = bp.scores as any;
      if (!scores?.virality || !bp.views) continue;

      const predictedVirality = scores.virality || 50;
      const actualViews = bp.views || 0;

      // Normalize actual performance (rough heuristic)
      const actualScore = Math.min(100, Math.log10(Math.max(actualViews, 1)) * 15);

      const accuracy = 100 - Math.abs(predictedVirality - actualScore);

      // Track hook type performance
      if (bp.hook_type) {
        if (!hookPerformance[bp.hook_type]) hookPerformance[bp.hook_type] = { predicted: [], actual: [] };
        hookPerformance[bp.hook_type].predicted.push(predictedVirality);
        hookPerformance[bp.hook_type].actual.push(actualScore);
      }

      // Track visual style performance  
      if (bp.visual_style) {
        if (!stylePerformance[bp.visual_style]) stylePerformance[bp.visual_style] = { predicted: [], actual: [] };
        stylePerformance[bp.visual_style].predicted.push(predictedVirality);
        stylePerformance[bp.visual_style].actual.push(actualScore);
      }

      if (accuracy < 50) {
        calibrationInsights.push({
          video: bp.video_title,
          predicted: predictedVirality,
          actual: Math.round(actualScore),
          gap: Math.round(predictedVirality - actualScore),
          hook_type: bp.hook_type,
          niche: bp.niche,
        });
      }
    }

    // ═══ STEP 3: Generate calibration corrections via AI ═══
    let corrections: string[] = [];
    if (calibrationInsights.length > 0) {
      try {
        const aiRes = await _ai({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "You are a video analytics calibration engine. Analyze prediction vs reality data and output 3-5 calibration corrections as a JSON array of strings. Each correction should be actionable and specific. Output ONLY the JSON array." },
              { role: "user", content: `Calibration data (${calibrationInsights.length} videos with >50% prediction error):\n${JSON.stringify(calibrationInsights.slice(0, 10), null, 2)}\n\nHook performance: ${JSON.stringify(hookPerformance)}\nStyle performance: ${JSON.stringify(stylePerformance)}` },
            ],
          });

        if (aiRes.ok) {
          const data = await aiRes.json();
          const content = data.choices?.[0]?.message?.content || '';
          const arrMatch = content.match(/\[[\s\S]*\]/);
          if (arrMatch) {
            corrections = JSON.parse(arrMatch[0]);
          }
        }
      } catch (e) {
        console.warn("AI calibration failed:", e);
      }
    }

    // ═══ STEP 4: Store calibration results ═══
    if (corrections.length > 0) {
      await sb.from("ai_learning").insert({
        source: "calibrate-knowledge",
        topic: "auto_calibration",
        insight: JSON.stringify({
          corrections,
          videos_analyzed: blueprints.length,
          errors_found: calibrationInsights.length,
          hook_stats: Object.entries(hookPerformance).map(([hook, data]) => ({
            hook,
            avg_predicted: Math.round(data.predicted.reduce((a, b) => a + b, 0) / data.predicted.length),
            avg_actual: Math.round(data.actual.reduce((a, b) => a + b, 0) / data.actual.length),
            samples: data.predicted.length,
          })),
          calibrated_at: new Date().toISOString(),
        }),
      });
    }

    // ═══ STEP 5: Update hook effectiveness scores based on real data ═══
    for (const [hookType, data] of Object.entries(hookPerformance)) {
      if (data.actual.length >= 3) {
        const avgActual = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;
        const newScore = Math.max(1, Math.min(10, Math.round(avgActual / 10)));
        
        // Update hooks of this type
        await sb.from("hook_library")
          .update({ retention_score: newScore })
          .eq("hook_type", hookType)
          .lt("retention_score", newScore + 2)
          .gt("retention_score", newScore - 2);
      }
    }

    const durationMs = Date.now() - startTime;

    await sb.from("execution_logs").insert({
      function_name: "calibrate-knowledge",
      duration_ms: durationMs,
      success: true,
      metadata: {
        videos_analyzed: blueprints.length,
        errors_found: calibrationInsights.length,
        corrections_generated: corrections.length,
        hooks_calibrated: Object.keys(hookPerformance).length,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      videos_analyzed: blueprints.length,
      prediction_errors: calibrationInsights.length,
      corrections,
      hooks_calibrated: Object.keys(hookPerformance).length,
      duration_ms: durationMs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calibrate-knowledge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
