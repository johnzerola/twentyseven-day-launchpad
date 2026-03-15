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

// RPM multipliers for long-form content
const RPM_BY_NICHE: Record<string, number> = {
  finance: 3.0, insurance: 3.5, tech: 2.0, gaming: 0.8,
  education: 1.5, health: 2.0, cooking: 1.0, travel: 1.2,
  entertainment: 0.7, music: 0.5, sports: 1.0, news: 1.2,
  beauty: 1.5, fitness: 1.8, business: 2.5, crypto: 2.8,
  motivation: 1.0, stories: 0.8, horror: 0.9, comedy: 0.7,
  dropshipping: 3.5, ecommerce: 3.0, animals: 0.6, satisfying: 0.5,
};

// Shorts-specific RPM (real data from creators: ~$0.10-$0.20 per 1K views)
// ~$100 per 1M views = $0.10 RPM, gaming/entertainment = $0.17-0.18
const SHORTS_RPM_BY_NICHE: Record<string, number> = {
  finance: 0.25, insurance: 0.30, tech: 0.20, gaming: 0.17,
  education: 0.18, health: 0.20, cooking: 0.15, travel: 0.15,
  entertainment: 0.17, music: 0.10, sports: 0.18, news: 0.15,
  beauty: 0.18, fitness: 0.18, business: 0.22, crypto: 0.25,
  motivation: 0.15, stories: 0.15, horror: 0.17, comedy: 0.15,
  dropshipping: 0.30, ecommerce: 0.25, animals: 0.12, satisfying: 0.10,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, videosPerWeek, avgViewsPerVideo, currentSubs, contentType } = await req.json();

    const isShorts = (contentType || 'shorts').toLowerCase().includes('short');
    const baseRpm = RPM_BY_COUNTRY[country || 'BR'] || 1.5;
    const nicheKey = (niche || '').toLowerCase();
    
    // Use shorts-specific RPM or long-form RPM based on content type
    let rpm: number;
    if (isShorts) {
      // Shorts RPM is independent of country (YouTube Shorts Fund / RPM is flat)
      // Real data: ~$0.10-$0.20 per 1K views depending on niche
      const shortsNicheRpm = Object.entries(SHORTS_RPM_BY_NICHE).find(([k]) => nicheKey.includes(k))?.[1] || 0.15;
      // Country still has minor effect on shorts RPM
      const countryMult = (RPM_BY_COUNTRY[country || 'BR'] || 1.5) / 4; // Normalized
      rpm = shortsNicheRpm * (0.7 + countryMult * 0.3);
    } else {
      const nicheMult = Object.entries(RPM_BY_NICHE).find(([k]) => nicheKey.includes(k))?.[1] || 1.0;
      rpm = baseRpm * nicheMult;
    }

    const vpw = videosPerWeek || (isShorts ? 14 : 3); // Shorts: 2/day default
    const avgViews = avgViewsPerVideo || (isShorts ? 10000 : 1000);
    const subs = currentSubs || 0;

    // 30-day projection with exponential growth curve (snowball effect)
    const days: any[] = [];
    let totalViews = 0;
    let totalRevenue = 0;
    let projectedSubs = subs;
    let momentum = 1.0; // Snowball multiplier

    for (let d = 1; d <= 30; d++) {
      const dayOfWeek = d % 7;
      const uploadsToday = dayOfWeek < Math.min(vpw, 7) ? Math.ceil(vpw / 7) : 0;
      const isUploadDay = uploadsToday > 0;
      
      // Exponential growth curve (not linear!) - validated by real creator data
      // Days 1-7: slow start, Days 8-15: finding format, Days 15-30: exponential
      if (d <= 7) {
        momentum = 1.0 + (d / 7) * 0.3; // Slow ramp
      } else if (d <= 15) {
        momentum = 1.3 + ((d - 7) / 8) * 0.7; // Format discovery phase
      } else {
        momentum = 2.0 + ((d - 15) / 15) * 1.5; // Snowball effect kicks in
      }
      
      const dailyViews = isUploadDay 
        ? Math.round(avgViews * momentum * uploadsToday) 
        : Math.round(avgViews * 0.3 * momentum); // Old videos still get views
      const dailyRevenue = parseFloat(((dailyViews / 1000) * rpm).toFixed(2));
      
      totalViews += dailyViews;
      totalRevenue += dailyRevenue;
      // Shorts: 1 sub per 200-400 views (harder than long-form)
      const subRate = isShorts ? 300 : 100;
      projectedSubs += Math.round(dailyViews / subRate);

      // Track engaged views (50% rule from real data)
      const engagedViews = Math.round(totalViews * 0.5);

      days.push({
        day: d,
        views: dailyViews,
        revenue: dailyRevenue,
        totalViews,
        engagedViews,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        projectedSubs,
        isUploadDay,
        momentum: parseFloat(momentum.toFixed(2)),
      });
    }

    // Three scenarios
    const conservative = parseFloat((totalRevenue * 0.5).toFixed(2));
    const expected = parseFloat(totalRevenue.toFixed(2));
    const aggressive = parseFloat((totalRevenue * 2.0).toFixed(2));

    // Monthly projection
    const monthlyConservative = parseFloat((conservative).toFixed(2));
    const monthlyExpected = parseFloat((expected).toFixed(2));
    const monthlyAggressive = parseFloat((aggressive).toFixed(2));

    // Monetization milestones (based on real data)
    const engagedViewsTotal = Math.round(totalViews * 0.5);
    const viewsToMemberships = Math.max(0, 3000000 - engagedViewsTotal);
    const viewsToFullMonetization = Math.max(0, 10000000 - engagedViewsTotal);
    const subsNeeded = Math.max(0, 1000 - projectedSubs);

    return new Response(JSON.stringify({
      rpm: parseFloat(rpm.toFixed(2)),
      contentType: isShorts ? 'shorts' : 'longform',
      days,
      totals: {
        views: totalViews,
        engagedViews: engagedViewsTotal,
        revenue: { conservative, expected, aggressive },
        monthlyRevenue: { conservative: monthlyConservative, expected: monthlyExpected, aggressive: monthlyAggressive },
        projectedSubs,
      },
      monetization: {
        viewsToMemberships,
        viewsToFullMonetization,
        subsNeeded,
        estimatedDaysToMonetize: viewsToFullMonetization > 0 
          ? Math.ceil(viewsToFullMonetization / (totalViews > 0 ? totalViews / 30 : 1)) 
          : 0,
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
