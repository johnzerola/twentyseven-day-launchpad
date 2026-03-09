import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RPM_BY_COUNTRY: Record<string, number> = {
  US: 7.5, GB: 6.0, DE: 5.5, AU: 6.5, CA: 6.0,
  BR: 1.5, PT: 3.0, PL: 2.5, ES: 3.0, FR: 4.0,
  IN: 0.5, JP: 4.5, KR: 3.5, IT: 3.5, MX: 1.0,
};

const RPM_BY_NICHE: Record<string, number> = {
  finance: 3.0, insurance: 3.5, tech: 2.0, gaming: 0.8,
  education: 1.5, health: 2.0, cooking: 1.0, travel: 1.2,
  entertainment: 0.7, music: 0.5, sports: 1.0, news: 1.2,
  beauty: 1.5, fitness: 1.8, business: 2.5, crypto: 2.8,
  motivation: 1.0, stories: 0.8, horror: 0.9, comedy: 0.7,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, videosPerWeek, avgViewsPerVideo, currentSubs } = await req.json();

    const baseRpm = RPM_BY_COUNTRY[country || 'BR'] || 1.5;
    const nicheKey = (niche || '').toLowerCase();
    const nicheMult = Object.entries(RPM_BY_NICHE).find(([k]) => nicheKey.includes(k))?.[1] || 1.0;
    const rpm = baseRpm * nicheMult;

    const vpw = videosPerWeek || 3;
    const avgViews = avgViewsPerVideo || 1000;
    const subs = currentSubs || 0;

    // 27-day projection with growth curve
    const days: any[] = [];
    let totalViews = 0;
    let totalRevenue = 0;
    let projectedSubs = subs;

    for (let d = 1; d <= 27; d++) {
      // Views grow as channel gains traction (algorithmic boost after consistency)
      const dayOfWeek = d % 7;
      const isUploadDay = dayOfWeek < vpw;
      const growthMult = 1 + (d / 27) * 0.5; // 50% growth over 27 days
      const dailyViews = isUploadDay ? Math.round(avgViews * growthMult) : Math.round(avgViews * 0.3 * growthMult);
      const dailyRevenue = parseFloat(((dailyViews / 1000) * rpm).toFixed(2));
      
      totalViews += dailyViews;
      totalRevenue += dailyRevenue;
      // Rough sub growth: 1 sub per 100 views for small channels
      projectedSubs += Math.round(dailyViews / 100);

      days.push({
        day: d,
        views: dailyViews,
        revenue: dailyRevenue,
        totalViews,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        projectedSubs,
        isUploadDay,
      });
    }

    // Three scenarios
    const conservative = parseFloat((totalRevenue * 0.5).toFixed(2));
    const expected = parseFloat(totalRevenue.toFixed(2));
    const aggressive = parseFloat((totalRevenue * 2.0).toFixed(2));

    // Monthly projection (extrapolate)
    const monthlyConservative = parseFloat((conservative * 30 / 27).toFixed(2));
    const monthlyExpected = parseFloat((expected * 30 / 27).toFixed(2));
    const monthlyAggressive = parseFloat((aggressive * 30 / 27).toFixed(2));

    return new Response(JSON.stringify({
      rpm: parseFloat(rpm.toFixed(2)),
      baseRpm,
      nicheMult,
      days,
      totals: {
        views: totalViews,
        revenue: { conservative, expected, aggressive },
        monthlyRevenue: { conservative: monthlyConservative, expected: monthlyExpected, aggressive: monthlyAggressive },
        projectedSubs,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-revenue error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
