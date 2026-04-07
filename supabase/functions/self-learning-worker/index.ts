import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const AI_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * SELF-LEARNING WORKER
 * 
 * Closes the feedback loop:
 * 1. Finds published videos with predictions
 * 2. Fetches real YouTube data
 * 3. Compares prediction vs reality
 * 4. Updates calibration weights for future scoring
 * 5. Refreshes materialized views
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || 
                   Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");

    const results: any = { compared: 0, calibrated: 0, views_refreshed: false, errors: [] };

    // ═══ STEP 1: Find videos with predictions but no real data yet ═══
    const { data: trackedVideos } = await sb.from("video_performance")
      .select("id, youtube_video_id, title, niche, hook_type, title_pattern, predicted_viral_score, predicted_attention_score, project_id, user_id, views_day7, views_current, likes, comments, ctr_percent, avg_retention_percent, created_at")
      .gt("predicted_viral_score", 0)
      .order("created_at", { ascending: false })
      .limit(30);

    // Also check prediction_vs_result for uncalibrated entries
    const { data: uncalibrated } = await sb.from("prediction_vs_result")
      .select("*")
      .is("calibrated_at", null)
      .gt("real_views", 0)
      .limit(20);

    // ═══ STEP 2: Fetch fresh YouTube data for tracked videos ═══
    if (YT_KEY && trackedVideos?.length) {
      const videoIds = trackedVideos
        .map(v => v.youtube_video_id)
        .filter(Boolean);

      if (videoIds.length > 0) {
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
        if (allowed) {
          const ytRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(",")}&key=${YT_KEY}`
          );
          const ytData = await ytRes.json();

          for (const item of (ytData.items || [])) {
            const views = parseInt(item.statistics?.viewCount || '0');
            const likes = parseInt(item.statistics?.likeCount || '0');
            const comments = parseInt(item.statistics?.commentCount || '0');
            const tracked = trackedVideos.find(v => v.youtube_video_id === item.id);
            if (!tracked) continue;

            const publishedAt = new Date(item.snippet?.publishedAt || tracked.created_at);
            const hoursLive = (Date.now() - publishedAt.getTime()) / 3600000;
            const viewsPerHour = hoursLive > 0 ? views / hoursLive : 0;
            const engagementRate = views > 0 ? (likes + comments) / views : 0;

            // Upsert into prediction_vs_result
            const predicted = tracked.predicted_viral_score || 50;
            
            // Map real performance to 0-100 scale
            let realScore = 30;
            if (views > 1000000) realScore = 95;
            else if (views > 500000) realScore = 85;
            else if (views > 100000) realScore = 75;
            else if (views > 50000) realScore = 65;
            else if (views > 10000) realScore = 55;
            else if (views > 5000) realScore = 45;
            else if (views > 1000) realScore = 35;

            const errorScore = Math.abs(predicted - realScore);
            const errorBreakdown = {
              predicted_viral: predicted,
              real_score: realScore,
              real_views: views,
              direction: predicted > realScore ? "over" : "under",
              error_pct: predicted > 0 ? Math.round((errorScore / predicted) * 100) : 0,
            };

            await sb.from("prediction_vs_result").upsert({
              video_id: item.id,
              user_id: tracked.user_id,
              project_id: tracked.project_id,
              predicted_viral_score: predicted,
              predicted_attention_score: tracked.predicted_attention_score || 0,
              real_views: views,
              real_likes: likes,
              real_comments: comments,
              real_view_velocity: Math.round(viewsPerHour * 100) / 100,
              real_engagement_rate: Math.round(engagementRate * 10000) / 10000,
              real_ctr: tracked.ctr_percent,
              real_retention: tracked.avg_retention_percent,
              prediction_error_score: errorScore,
              error_breakdown: errorBreakdown,
              niche: tracked.niche,
              hook_type: tracked.hook_type,
              title_pattern: tracked.title_pattern,
              updated_at: new Date().toISOString(),
            }, { onConflict: "video_id" });

            results.compared++;
          }
        }
      }
    }

    // ═══ STEP 3: Calibrate weights with DECAY-WEIGHTED averaging ═══
    // Recent data points matter more than old ones
    const { data: errorData } = await sb.from("prediction_vs_result")
      .select("niche, predicted_viral_score, prediction_error_score, error_breakdown, hook_type, created_at")
      .gt("real_views", 0)
      .order("created_at", { ascending: false })
      .limit(300);

    if (errorData && errorData.length >= 5) {
      const nicheErrors: Record<string, { errors: { value: number; weight: number }[], overCount: number, underCount: number, count: number, hookErrors: Record<string, number[]> }> = {};
      const now = Date.now();

      for (const row of errorData) {
        const n = row.niche || 'general';
        if (!nicheErrors[n]) nicheErrors[n] = { errors: [], overCount: 0, underCount: 0, count: 0, hookErrors: {} };

        // Decay weight: recent data weighs more (half-life = 14 days)
        const ageMs = now - new Date(row.created_at).getTime();
        const ageDays = ageMs / 86400000;
        const weight = Math.pow(0.5, ageDays / 14); // Exponential decay

        nicheErrors[n].errors.push({ value: row.prediction_error_score || 0, weight });
        nicheErrors[n].count++;
        const breakdown = row.error_breakdown as any;
        if (breakdown?.direction === 'over') nicheErrors[n].overCount++;
        else nicheErrors[n].underCount++;

        // Track per-hook-type errors for granular calibration
        const hookType = row.hook_type || 'unknown';
        if (!nicheErrors[n].hookErrors[hookType]) nicheErrors[n].hookErrors[hookType] = [];
        nicheErrors[n].hookErrors[hookType].push(row.prediction_error_score || 0);
      }

      for (const [niche, data] of Object.entries(nicheErrors)) {
        if (data.count < 3) continue;

        // Weighted average error (recent data weighs more)
        const totalWeight = data.errors.reduce((s, e) => s + e.weight, 0);
        const avgError = data.errors.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;

        const biasDirection = data.overCount > data.underCount ? -1 : 1;
        const biasAmount = Math.round(avgError * 0.3 * biasDirection * 100) / 100;
        const confidence = Math.min(data.count / 20, 1);
        const weightAdj = avgError > 30 ? 0.7 : avgError > 20 ? 0.85 : avgError > 10 ? 0.95 : 1.0;

        // Per-hook-type calibration data
        const hookCalibration: Record<string, { avg_error: number; count: number }> = {};
        for (const [hookType, errors] of Object.entries(data.hookErrors)) {
          if (errors.length >= 2) {
            hookCalibration[hookType] = {
              avg_error: Math.round((errors.reduce((s, e) => s + e, 0) / errors.length) * 100) / 100,
              count: errors.length,
            };
          }
        }

        await sb.from("score_calibration").upsert({
          score_type: "viral_probability",
          niche,
          weight_adjustment: weightAdj,
          bias_correction: biasAmount,
          confidence: Math.round(confidence * 100) / 100,
          samples_count: data.count,
          avg_error: Math.round(avgError * 100) / 100,
          last_calibrated_at: new Date().toISOString(),
          metadata: {
            over_predictions: data.overCount,
            under_predictions: data.underCount,
            decay_half_life_days: 14,
            hook_calibration: hookCalibration,
          },
        }, { onConflict: "score_type,niche" });

        results.calibrated++;
      }

      // Mark calibrated entries
      if (uncalibrated?.length) {
        for (const entry of uncalibrated) {
          await sb.from("prediction_vs_result")
            .update({ calibrated_at: new Date().toISOString() })
            .eq("id", entry.id);
        }
      }

      // ═══ STEP 3.5: HOOK-LEVEL FEEDBACK — Feed winning/losing hooks back ═══
      try {
        const { data: recentLinks } = await sb.from("script_performance_link")
          .select("hook_text, hook_type, niche, avg_retention_pct, views_7d, ctr_pct")
          .not("hook_text", "is", null)
          .gt("avg_retention_pct", 0)
          .order("created_at", { ascending: false })
          .limit(50);

        for (const link of (recentLinks || [])) {
          if (link.avg_retention_pct >= 55) {
            // High performer → upsert to hook_library
            await sb.from("hook_library").upsert({
              hook_text: (link.hook_text || '').slice(0, 500),
              hook_type: link.hook_type || 'unknown',
              niche: link.niche || 'general',
              retention_score: Math.min(10, Math.round(link.avg_retention_pct / 8)),
              source: 'real_performance_data',
            }, { onConflict: 'hook_text' }).catch(() => {});
          }
        }
        results.hooks_updated = (recentLinks || []).filter((l: any) => l.avg_retention_pct >= 55).length;
      } catch (e) { console.warn("Hook feedback error:", e); }

      // Generate AI meta-insight about calibration
      if (GOOGLE_AI_API_KEY && results.calibrated >= 2) {
        try {
          const summary = Object.entries(nicheErrors).map(([n, d]) => 
            `${n}: ${d.count} samples, avg error ${(d.errors.reduce((a,b)=>a+b,0)/d.errors.length).toFixed(1)}, ${d.overCount} over / ${d.underCount} under`
          ).join("\n");

          const aiRes = await fetch(AI_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{
                role: "user",
                content: `Analise estes dados de calibração do modelo de previsão de viralização:\n\n${summary}\n\nEm 2-3 frases: Que nichos estamos errando mais? O modelo tende a superestimar ou subestimar? Como recalibrar?`
              }],
            }),
          });
          if (aiRes.ok) {
            const d = await aiRes.json();
            const insight = d.choices?.[0]?.message?.content;
            if (insight) {
              try {
                await sb.from("ai_learning").insert({
                  topic: "calibration_meta",
                  source: "self-learning-worker",
                  insight: `[Calibrated ${results.calibrated} niches] ${insight}`,
                });
              } catch (_) { /* ignore */ }
            }
          }
        } catch (e) { console.warn("Calibration insight error:", e); }
      }
    }

    // ═══ STEP 4: Refresh materialized views ═══
    try {
      await sb.rpc("refresh_materialized_views");
      results.views_refreshed = true;
    } catch (e) { 
      console.warn("MV refresh error:", e); 
    }

    // ═══ Log ═══
    try {
      await sb.from("execution_logs").insert({
        function_name: "self-learning-worker",
        success: true,
        metadata: results,
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-learning-worker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
