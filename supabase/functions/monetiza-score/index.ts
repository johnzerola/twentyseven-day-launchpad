import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * MonetizaScore Engine
 * Composite decision engine: niche(0.25) + channel(0.25) + video(0.25) + script(0.25)
 * Returns 0-100 score with actionable recommendation.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, channelId, videoId, scriptScore } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ========== 1. NICHE SCORE (0-100) ==========
    let nicheScore = 50; // default
    let nicheDetails: any = {};

    if (niche) {
      const { data: nicheData } = await sb.from("niche_database")
        .select("*").ilike("name", `%${niche}%`).limit(1).maybeSingle();

      if (nicheData) {
        // Growth rate scoring
        const growthMap: Record<string, number> = { explosive: 95, rapid: 80, fast: 70, steady: 50, slow: 30, declining: 10 };
        const growthScore = growthMap[(nicheData.growth_rate || 'steady').toLowerCase()] || 50;

        // Competition (inverse of saturation)
        const satMap: Record<string, number> = { baixa: 90, low: 90, média: 60, medium: 60, alta: 30, high: 30 };
        const competitionScore = satMap[(nicheData.saturation || 'média').toLowerCase()] || 50;

        // RPM monetization potential
        const rpmScore = Math.min(100, ((nicheData.rpm_estimate || 0) / 30) * 100);

        nicheScore = Math.round(growthScore * 0.40 + competitionScore * 0.35 + rpmScore * 0.25);
        nicheDetails = { name: nicheData.name, rpm: nicheData.rpm_estimate, saturation: nicheData.saturation, growthScore, competitionScore, rpmScore };
      }
    }

    // ========== 2. CHANNEL SCORE (0-100) ==========
    let channelScore = 50;
    let channelDetails: any = {};

    if (channelId) {
      // Check channel_intelligence
      const { data: ch } = await sb.from("channel_intelligence")
        .select("*").eq("youtube_channel_id", channelId).maybeSingle();

      if (ch) {
        const growthMap: Record<string, number> = { explosive: 95, rapid: 80, fast: 70, steady: 50, slow: 30 };
        const growthScore = growthMap[(ch.growth_rate || 'steady').toLowerCase()] || 50;

        // View velocity: avg_views relative to subscribers
        const viewVelocity = ch.subscribers > 0 ? Math.min(100, (ch.avg_views / ch.subscribers) * 100) : 50;

        // Upload frequency scoring
        const freqMap: Record<string, number> = { daily: 95, '2-3x/week': 80, weekly: 65, biweekly: 45, monthly: 25 };
        const freqScore = freqMap[(ch.upload_frequency || 'weekly').toLowerCase()] || 50;

        channelScore = Math.round(growthScore * 0.40 + viewVelocity * 0.35 + freqScore * 0.25);
        channelDetails = { name: ch.channel_name, subscribers: ch.subscribers, avgViews: ch.avg_views, growthScore, viewVelocity, freqScore };
      }

      // Also check emerging_channels for bonus
      const { data: emerging } = await sb.from("emerging_channels")
        .select("viral_score").eq("channel_id", channelId).maybeSingle();
      if (emerging?.viral_score && emerging.viral_score > 70) {
        channelScore = Math.min(100, channelScore + 15); // Bonus for emerging channel
        channelDetails.emergingBonus = true;
      }
    }

    // ========== 3. VIDEO SCORE (0-100) ==========
    let videoScore = 50;
    let videoDetails: any = {};

    if (videoId) {
      const { data: bp } = await sb.from("video_blueprints")
        .select("*").eq("video_id", videoId).maybeSingle();

      if (bp) {
        const scores = bp.scores as any || {};
        const virality = scores.virality || 50;
        const replicability = scores.replicability || 50;
        const monetization = scores.monetization || 50;

        videoScore = Math.round(virality * 0.40 + replicability * 0.35 + monetization * 0.25);
        videoDetails = { title: bp.video_title, views: bp.views, virality, replicability, monetization };
      } else {
        // Check outlier_channels for video performance
        const { data: outlier } = await sb.from("outlier_channels")
          .select("*").ilike("video_url", `%${videoId}%`).maybeSingle();
        if (outlier) {
          const multiplier = outlier.multiplier || 1;
          videoScore = Math.min(100, Math.round(multiplier * 10));
          videoDetails = { title: outlier.video_title, multiplier, views: outlier.views };
        }
      }
    }

    // ========== 4. SCRIPT SCORE (0-100) ==========
    // Can be passed directly from score-script engine or default
    const effectiveScriptScore = typeof scriptScore === 'number' ? scriptScore : 50;

    // ========== COMPOSITE MONETIZA SCORE ==========
    const monetizaScore = Math.round(
      nicheScore * 0.25 +
      channelScore * 0.25 +
      videoScore * 0.25 +
      effectiveScriptScore * 0.25
    );

    // Viral probability estimation
    let viralProbability: string;
    if (monetizaScore >= 85) viralProbability = "very_high";
    else if (monetizaScore >= 70) viralProbability = "high";
    else if (monetizaScore >= 50) viralProbability = "medium";
    else viralProbability = "low";

    // Recommended action
    let recommendedAction: string;
    if (monetizaScore >= 75) {
      recommendedAction = "🟢 PRODUZIR AGORA — Alta probabilidade de viralização e monetização rápida. Prioridade máxima.";
    } else if (monetizaScore >= 50) {
      recommendedAction = "🟡 OTIMIZAR — Potencial moderado. Melhore os componentes mais fracos antes de produzir.";
    } else {
      recommendedAction = "🔴 DESCARTAR / REFORMULAR — Probabilidade baixa de sucesso. Escolha outro nicho, tópico ou melhore o roteiro.";
    }

    // Identify weakest component for improvement suggestion
    const components = [
      { name: "Nicho", score: nicheScore },
      { name: "Canal", score: channelScore },
      { name: "Vídeo Referência", score: videoScore },
      { name: "Roteiro", score: effectiveScriptScore },
    ];
    const weakest = components.sort((a, b) => a.score - b.score)[0];
    const improvementFocus = `Foco de melhoria: ${weakest.name} (score: ${weakest.score}/100)`;

    return new Response(JSON.stringify({
      monetizaScore,
      viralProbability,
      recommendedAction,
      improvementFocus,
      breakdown: {
        niche: { score: nicheScore, weight: 0.25, details: nicheDetails },
        channel: { score: channelScore, weight: 0.25, details: channelDetails },
        video: { score: videoScore, weight: 0.25, details: videoDetails },
        script: { score: effectiveScriptScore, weight: 0.25 },
      },
      thresholds: {
        produce: "≥ 75",
        optimize: "50-74",
        discard: "< 50",
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monetiza-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
