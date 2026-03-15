import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, language } = await req.json().catch(() => ({}));
    
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Aggregate channel_intelligence data for this niche
    let query = sb.from("channel_intelligence").select("*");
    if (niche) query = query.ilike("niche", `%${niche}%`);
    if (language) query = query.eq("language", language);
    const { data: channels } = await query.limit(200);

    if (!channels?.length) {
      return new Response(JSON.stringify({ error: "No channels found for this niche" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate benchmarks
    const subs = channels.map(c => c.subscribers).sort((a, b) => a - b);
    const views = channels.map(c => c.avg_views).sort((a, b) => a - b);
    const rpms = channels.filter(c => c.rpm_estimate > 0).map(c => c.rpm_estimate);
    
    const percentile = (arr: number[], p: number) => {
      const idx = Math.ceil(arr.length * p / 100) - 1;
      return arr[Math.max(0, idx)] || 0;
    };

    const facelessCount = channels.filter(c => c.is_faceless).length;
    const monetizedCount = channels.filter(c => c.is_monetized).length;
    const growthDistribution: Record<string, number> = {};
    channels.forEach(c => {
      growthDistribution[c.growth_rate] = (growthDistribution[c.growth_rate] || 0) + 1;
    });

    // Get top video styles and patterns
    const styleDistribution: Record<string, number> = {};
    channels.forEach(c => {
      styleDistribution[c.style] = (styleDistribution[c.style] || 0) + 1;
    });

    // Extract top performing videos across all channels in niche
    const allTopVideos = channels.flatMap(c => {
      const vids = Array.isArray(c.top_videos) ? c.top_videos : [];
      return vids.map((v: any) => ({ ...v, channel: c.channel_name, subs: c.subscribers }));
    }).sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 20);

    // Viral threshold: what views count makes a video "viral" in this niche
    const avgViewsMedian = percentile(views, 50);
    const viralThreshold = avgViewsMedian * 3; // 3x median = viral

    // Upload frequency analysis
    const freqDistribution: Record<string, number> = {};
    channels.forEach(c => {
      if (c.upload_frequency) {
        freqDistribution[c.upload_frequency] = (freqDistribution[c.upload_frequency] || 0) + 1;
      }
    });

    // Get content_dna scores for this niche
    let dnaQuery = sb.from("content_dna").select("viral_score, attention_score, curiosity_score, dopamine_score, estimated_retention, hook_type, story_structure, pacing");
    if (niche) dnaQuery = dnaQuery.ilike("niche", `%${niche}%`);
    const { data: dnaRows } = await dnaQuery.limit(200);

    const avgScores = {
      viral_score: 0,
      attention_score: 0,
      curiosity_score: 0,
      dopamine_score: 0,
      estimated_retention: 0,
    };

    if (dnaRows?.length) {
      const len = dnaRows.length;
      dnaRows.forEach((d: any) => {
        avgScores.viral_score += (d.viral_score || 0) / len;
        avgScores.attention_score += (d.attention_score || 0) / len;
        avgScores.curiosity_score += (d.curiosity_score || 0) / len;
        avgScores.dopamine_score += (d.dopamine_score || 0) / len;
        avgScores.estimated_retention += (d.estimated_retention || 0) / len;
      });

      // Round
      Object.keys(avgScores).forEach(k => {
        (avgScores as any)[k] = Math.round((avgScores as any)[k] * 10) / 10;
      });
    }

    // Best hook types in this niche
    const hookTypeCount: Record<string, number> = {};
    (dnaRows || []).forEach((d: any) => {
      if (d.hook_type) hookTypeCount[d.hook_type] = (hookTypeCount[d.hook_type] || 0) + 1;
    });

    const benchmark = {
      niche: niche || "all",
      language: language || "all",
      total_channels_analyzed: channels.length,
      
      subscribers: {
        min: subs[0],
        p25: percentile(subs, 25),
        median: percentile(subs, 50),
        p75: percentile(subs, 75),
        max: subs[subs.length - 1],
        avg: Math.round(subs.reduce((a, b) => a + b, 0) / subs.length),
      },

      views: {
        min: views[0],
        p25: percentile(views, 25),
        median: percentile(views, 50),
        p75: percentile(views, 75),
        max: views[views.length - 1],
        avg: Math.round(views.reduce((a, b) => a + b, 0) / views.length),
        viral_threshold: Math.round(viralThreshold),
      },

      rpm: rpms.length > 0 ? {
        min: Math.min(...rpms),
        avg: Math.round(rpms.reduce((a, b) => a + b, 0) / rpms.length * 100) / 100,
        max: Math.max(...rpms),
      } : null,

      demographics: {
        faceless_percentage: Math.round(facelessCount / channels.length * 100),
        monetized_percentage: Math.round(monetizedCount / channels.length * 100),
      },

      growth_distribution: growthDistribution,
      style_distribution: styleDistribution,
      upload_frequency: freqDistribution,

      content_dna_benchmarks: dnaRows?.length ? {
        samples: dnaRows.length,
        avg_scores: avgScores,
        top_hook_types: Object.entries(hookTypeCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count, percentage: Math.round(count / dnaRows.length * 100) })),
      } : null,

      top_viral_videos: allTopVideos.slice(0, 10).map((v: any) => ({
        title: v.title,
        views: v.views,
        channel: v.channel,
        channel_subs: v.subs,
        multiplier: v.subs > 0 ? Math.round(v.views / v.subs * 100) / 100 : null,
      })),

      recommendations: {
        target_views_for_growth: Math.round(percentile(views, 75)),
        min_subs_to_compete: Math.round(percentile(subs, 25)),
        best_style: Object.entries(styleDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || "cinematic",
        faceless_viable: facelessCount / channels.length > 0.3,
        estimated_monthly_revenue_at_median: rpms.length > 0
          ? Math.round(percentile(views, 50) * 30 * (rpms.reduce((a, b) => a + b, 0) / rpms.length) / 1000)
          : null,
      },
    };

    return new Response(JSON.stringify({ success: true, benchmark }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("niche-benchmark error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
