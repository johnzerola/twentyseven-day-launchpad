import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * MonetizaScore V2 — Contextual Decision Engine
 * 
 * 5 scores with strategy-dependent weights:
 *   1. YPP Speed        — how fast this accelerates monetization milestones
 *   2. Revenue Quality   — RPM, watch-time, long-term revenue potential
 *   3. Originality/Safety — risk for faceless/dark channels
 *   4. Packaging Strength — title+thumb+hook synergy
 *   5. Operational Feasibility — effort vs. output for the channel's stage
 * 
 * Weights shift based on: strategy, channel maturity, faceless flag.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      niche, channelId, videoId, scriptScore,
      strategy, // 'shorts-sprint' | 'longform-first' | 'hybrid'
      isFaceless, // boolean
      packagingScore, // 0-100 from packaging-score engine (optional)
      originalityScore, // 0-100 from originality-safety-score engine (optional)
    } = await req.json();

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ========== 1. YPP SPEED SCORE (0-100) ==========
    let yppSpeed = 50;
    let yppDetails: any = {};

    if (channelId) {
      const { data: ch } = await sb.from("channel_intelligence")
        .select("subscribers,avg_views,growth_rate,upload_frequency,is_monetized")
        .eq("youtube_channel_id", channelId).maybeSingle();

      if (ch) {
        // Already monetized = max YPP speed
        if (ch.is_monetized) {
          yppSpeed = 100;
          yppDetails.monetized = true;
        } else {
          const subProgress = Math.min(100, (ch.subscribers / 1000) * 100);
          // Estimate watch hours from avg_views (rough: 1 view ≈ 3 min for shorts, 8 min for longs)
          const avgWatchMin = strategy === 'shorts-sprint' ? 0.5 : 8;
          const estimatedMonthlyHours = (ch.avg_views * avgWatchMin * 4) / 60; // weekly * 4
          const watchProgress = Math.min(100, (estimatedMonthlyHours / 4000) * 100);

          const growthMap: Record<string, number> = { explosive: 30, rapid: 20, fast: 15, steady: 5, slow: 0 };
          const growthBonus = growthMap[(ch.growth_rate || 'steady').toLowerCase()] || 5;

          yppSpeed = Math.min(100, Math.round((subProgress * 0.5 + watchProgress * 0.4) + growthBonus));
          yppDetails = { subscribers: ch.subscribers, subProgress: Math.round(subProgress), watchProgress: Math.round(watchProgress), growthBonus };
        }
      }
    }

    // ========== 2. REVENUE QUALITY SCORE (0-100) ==========
    let revenueQuality = 50;
    let revenueDetails: any = {};

    if (niche) {
      const { data: nicheData } = await sb.from("niche_database")
        .select("*").ilike("name", `%${niche}%`).limit(1).maybeSingle();

      if (nicheData) {
        const rpmScore = Math.min(100, ((nicheData.rpm_estimate || 0) / 30) * 100);
        const growthMap: Record<string, number> = { explosive: 95, rapid: 80, fast: 70, steady: 50, slow: 30, declining: 10 };
        const growthScore = growthMap[(nicheData.growth_rate || 'steady').toLowerCase()] || 50;
        const satMap: Record<string, number> = { baixa: 90, low: 90, média: 60, medium: 60, alta: 30, high: 30 };
        const competitionScore = satMap[(nicheData.saturation || 'média').toLowerCase()] || 50;

        revenueQuality = Math.round(rpmScore * 0.50 + growthScore * 0.30 + competitionScore * 0.20);
        revenueDetails = { rpm: nicheData.rpm_estimate, saturation: nicheData.saturation, rpmScore, growthScore, competitionScore };
      }
    }

    // ========== 3. ORIGINALITY/SAFETY SCORE (0-100) ==========
    // Use pre-computed score from originality-safety-score engine if available
    let origSafety = typeof originalityScore === 'number' ? originalityScore : 60;
    let origDetails: any = { source: typeof originalityScore === 'number' ? 'engine' : 'default' };

    // ========== 4. PACKAGING STRENGTH SCORE (0-100) ==========
    // Use pre-computed score from packaging-score engine if available
    let packaging = typeof packagingScore === 'number' ? packagingScore : 50;
    let packagingDetails: any = { source: typeof packagingScore === 'number' ? 'engine' : 'default' };

    // ========== 5. OPERATIONAL FEASIBILITY SCORE (0-100) ==========
    let operational = 50;
    let operationalDetails: any = {};

    if (channelId) {
      const { data: ch } = await sb.from("channel_intelligence")
        .select("upload_frequency,subscribers,avg_views")
        .eq("youtube_channel_id", channelId).maybeSingle();

      if (ch) {
        // Upload frequency consistency
        const freqMap: Record<string, number> = { daily: 95, '2-3x/week': 85, weekly: 70, biweekly: 45, monthly: 25 };
        const freqScore = freqMap[(ch.upload_frequency || 'weekly').toLowerCase()] || 50;

        // Channel maturity (bigger channels = more operational capacity)
        const maturityScore = Math.min(100, Math.log10(Math.max(ch.subscribers, 1)) * 20);

        operational = Math.round(freqScore * 0.60 + maturityScore * 0.40);
        operationalDetails = { uploadFrequency: ch.upload_frequency, freqScore, maturityScore: Math.round(maturityScore) };
      }
    }

    // Video reference bonus
    let videoBonus = 0;
    if (videoId) {
      const { data: bp } = await sb.from("video_blueprints")
        .select("scores").eq("video_id", videoId).maybeSingle();
      if (bp) {
        const scores = bp.scores as any || {};
        videoBonus = Math.round(((scores.virality || 0) + (scores.replicability || 0)) / 2 * 0.1);
      }
    }

    // Script score integration
    const effectiveScriptScore = typeof scriptScore === 'number' ? scriptScore : 50;

    // ========== CONTEXTUAL WEIGHT ENGINE ==========
    const effectiveStrategy = (strategy || 'hybrid').toLowerCase();
    const effectiveFaceless = isFaceless !== false; // default true for this product

    let weights: Record<string, number>;

    if (effectiveStrategy === 'shorts-sprint') {
      weights = {
        yppSpeed: 0.30,
        revenueQuality: 0.10,
        origSafety: effectiveFaceless ? 0.20 : 0.10,
        packaging: 0.25,
        operational: effectiveFaceless ? 0.15 : 0.25,
      };
    } else if (effectiveStrategy === 'longform-first') {
      weights = {
        yppSpeed: 0.10,
        revenueQuality: 0.30,
        origSafety: effectiveFaceless ? 0.25 : 0.15,
        packaging: 0.25,
        operational: effectiveFaceless ? 0.10 : 0.20,
      };
    } else {
      // hybrid (default)
      weights = {
        yppSpeed: 0.20,
        revenueQuality: 0.20,
        origSafety: effectiveFaceless ? 0.22 : 0.12,
        packaging: 0.23,
        operational: effectiveFaceless ? 0.15 : 0.25,
      };
    }

    // Normalize weights to sum = 1.0
    const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const k of Object.keys(weights)) {
      weights[k] = weights[k] / wSum;
    }

    // Blend script score into packaging and operational (it contributes to both)
    const blendedPackaging = Math.round(packaging * 0.6 + effectiveScriptScore * 0.4);
    const blendedOperational = Math.min(100, operational + videoBonus);

    // ========== COMPOSITE MONETIZA SCORE V2 ==========
    const monetizaScore = Math.round(
      yppSpeed * weights.yppSpeed +
      revenueQuality * weights.revenueQuality +
      origSafety * weights.origSafety +
      blendedPackaging * weights.packaging +
      blendedOperational * weights.operational
    );

    // Viral probability
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

    // Identify weakest components for improvement
    const components = [
      { name: "YPP Speed", score: yppSpeed, key: "yppSpeed" },
      { name: "Revenue Quality", score: revenueQuality, key: "revenueQuality" },
      { name: "Originalidade/Segurança", score: origSafety, key: "origSafety" },
      { name: "Packaging (Título+Thumb+Hook)", score: blendedPackaging, key: "packaging" },
      { name: "Viabilidade Operacional", score: blendedOperational, key: "operational" },
    ];
    const sorted = [...components].sort((a, b) => a.score - b.score);
    const weakest = sorted[0];
    const secondWeakest = sorted[1];
    const improvementFocus = `Foco primário: ${weakest.name} (${weakest.score}/100). Secundário: ${secondWeakest.name} (${secondWeakest.score}/100).`;

    return new Response(JSON.stringify({
      monetizaScore,
      version: "v2",
      strategy: effectiveStrategy,
      isFaceless: effectiveFaceless,
      viralProbability,
      recommendedAction,
      improvementFocus,
      breakdown: {
        yppSpeed: { score: yppSpeed, weight: weights.yppSpeed, details: yppDetails },
        revenueQuality: { score: revenueQuality, weight: weights.revenueQuality, details: revenueDetails },
        originalitySafety: { score: origSafety, weight: weights.origSafety, details: origDetails },
        packaging: { score: blendedPackaging, weight: weights.packaging, details: { raw: packaging, scriptBlend: effectiveScriptScore, ...packagingDetails } },
        operational: { score: blendedOperational, weight: weights.operational, details: { raw: operational, videoBonus, ...operationalDetails } },
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
