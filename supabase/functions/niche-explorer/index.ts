import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Real RPM averages by country (USD) — 2024/2025 updated values
const RPM_BY_COUNTRY: Record<string, { rpm: number; minMonths: number; avgMonths: number; currency: string; minPayout: number }> = {
  US: { rpm: 7.5, minMonths: 3, avgMonths: 6, currency: "USD", minPayout: 100 },
  GB: { rpm: 6.0, minMonths: 3, avgMonths: 7, currency: "GBP", minPayout: 60 },
  DE: { rpm: 5.5, minMonths: 4, avgMonths: 8, currency: "EUR", minPayout: 70 },
  AU: { rpm: 6.5, minMonths: 3, avgMonths: 7, currency: "AUD", minPayout: 100 },
  CA: { rpm: 6.0, minMonths: 3, avgMonths: 7, currency: "CAD", minPayout: 100 },
  BR: { rpm: 1.5, minMonths: 6, avgMonths: 12, currency: "BRL", minPayout: 100 },
  PT: { rpm: 3.0, minMonths: 5, avgMonths: 10, currency: "EUR", minPayout: 70 },
  PL: { rpm: 2.5, minMonths: 5, avgMonths: 10, currency: "PLN", minPayout: 300 },
  ES: { rpm: 3.0, minMonths: 5, avgMonths: 9, currency: "EUR", minPayout: 70 },
  FR: { rpm: 4.0, minMonths: 4, avgMonths: 8, currency: "EUR", minPayout: 70 },
  IN: { rpm: 0.5, minMonths: 8, avgMonths: 18, currency: "INR", minPayout: 8000 },
  JP: { rpm: 4.5, minMonths: 4, avgMonths: 8, currency: "JPY", minPayout: 8000 },
  KR: { rpm: 3.5, minMonths: 5, avgMonths: 9, currency: "KRW", minPayout: 100000 },
  IT: { rpm: 3.5, minMonths: 5, avgMonths: 9, currency: "EUR", minPayout: 70 },
  MX: { rpm: 1.0, minMonths: 7, avgMonths: 14, currency: "MXN", minPayout: 1500 },
};

// YPP requirements by country (all same: 1000 subs + 4000 watch hours OR 10M Shorts views)
const YPP_REQUIREMENTS = {
  subs: 1000,
  watchHours: 4000,
  shortsViews: 10000000,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, language } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const region = country || "BR";
    const lang = language || "pt";
    const countryData = RPM_BY_COUNTRY[region] || RPM_BY_COUNTRY.BR;
    let baseRpm = countryData.rpm;

    // === DEEP IA: Query channel_intelligence + niche_database ===
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get real RPM/saturation from niche_database
    const { data: nicheDbRows } = await sb.from("niche_database")
      .select("*")
      .ilike("name", `%${niche}%`)
      .limit(5);
    
    let nicheDbContext = "";
    if (nicheDbRows?.length) {
      const bestMatch = nicheDbRows[0];
      if (bestMatch.rpm_estimate && bestMatch.rpm_estimate > 0) baseRpm = bestMatch.rpm_estimate;
      nicheDbContext = nicheDbRows.map((n: any) => 
        `Nicho "${n.name}": RPM=$${n.rpm_estimate}, saturação=${n.saturation}, dificuldade=${n.difficulty}, faceless=${n.faceless_friendly}, sub-nichos=${JSON.stringify(n.sub_niches)}`
      ).join("\n");
    }

    // Get top channels from channel_intelligence for this niche
    const { data: intelChannels } = await sb.from("channel_intelligence")
      .select("channel_name, youtube_channel_id, subscribers, avg_views, niche, style, growth_rate, rpm_estimate, language, country, viral_patterns, upload_frequency")
      .or(`niche.ilike.%${niche}%,sub_niche.ilike.%${niche}%`)
      .order("avg_views", { ascending: false })
      .limit(10);

    let intelContext = "";
    let directCompetitors: any[] = [];
    if (intelChannels?.length) {
      directCompetitors = intelChannels.slice(0, 5).map((c: any) => ({
        id: c.youtube_channel_id,
        name: c.channel_name,
        subscribers: c.subscribers,
        avgViews: c.avg_views,
        style: c.style,
        growthRate: c.growth_rate,
        rpmEstimate: c.rpm_estimate,
        uploadFrequency: c.upload_frequency,
      }));
      intelContext = intelChannels.map((c: any) =>
        `[DB] ${c.channel_name}: ${c.subscribers} subs, avg ${c.avg_views} views, style=${c.style}, growth=${c.growth_rate}, RPM=$${c.rpm_estimate}, freq=${c.upload_frequency}`
      ).join("\n");
    }

    // Use random order parameter to get different results each time
    const orderOptions = ["viewCount", "relevance", "date"];
    const randomOrder = orderOptions[Math.floor(Math.random() * orderOptions.length)];
    
    // Vary the search window (14-60 days) for freshness
    const daysBack = 14 + Math.floor(Math.random() * 46);
    const after = new Date(Date.now() - daysBack * 86400000).toISOString();

    // 1. Search videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(niche)}&maxResults=50&order=${randomOrder}&regionCode=${region}&relevanceLanguage=${lang}&publishedAfter=${after}&key=${YOUTUBE_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.error) throw new Error(searchData.error.message);

    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ channels: [], trending: [], analysis: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get video stats
    const videoIds = searchData.items.map((i: any) => i.id.videoId).filter(Boolean).join(",");
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
    const vData = await vRes.json();

    // 3. Get channel stats
    const channelIds = [...new Set((vData.items || []).map((v: any) => v.snippet.channelId))] as string[];
    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`);
    const cData = await cRes.json();

    const chMap: Record<string, any> = {};
    (cData.items || []).forEach((ch: any) => {
      const subs = parseInt(ch.statistics.subscriberCount || "0");
      const totalViews = parseInt(ch.statistics.viewCount || "0");
      const videoCount = parseInt(ch.statistics.videoCount || "0");
      chMap[ch.id] = {
        id: ch.id,
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.medium?.url,
        description: ch.snippet.description?.slice(0, 200) || "",
        subscribers: subs,
        totalViews,
        videoCount,
        avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
        country: ch.snippet.country || "",
        keywords: ch.brandingSettings?.channel?.keywords || "",
        createdAt: ch.snippet.publishedAt,
      };
    });

    // 4. Build trending videos
    const trending = (vData.items || []).map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const comments = parseInt(v.statistics?.commentCount || "0");
      const ch = chMap[v.snippet.channelId];
      const publishedMs = new Date(v.snippet.publishedAt).getTime();
      const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);
      const daysAge = hoursAge / 24;

      return {
        id: v.id,
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        thumbnail: v.snippet.thumbnails?.medium?.url,
        views, likes, comments,
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails?.duration || "",
        vph: Math.round(views / hoursAge),
        vpd: Math.round(views / Math.max(1, daysAge)),
        engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
        commentRate: views > 0 ? parseFloat(((comments / views) * 100).toFixed(3)) : 0,
        viewsPerSub: ch?.subscribers > 0 ? parseFloat((views / ch.subscribers).toFixed(2)) : 0,
        isOutlier: ch ? views >= ch.avgViews * 3 : false,
        isSuperOutlier: ch ? views >= ch.avgViews * 10 : false,
        channelSubs: ch?.subscribers || 0,
      };
    });

    // 5. Group by channel
    const channelGroups: Record<string, any[]> = {};
    trending.forEach((v: any) => {
      if (!channelGroups[v.channelId]) channelGroups[v.channelId] = [];
      channelGroups[v.channelId].push(v);
    });

    const channels = Object.entries(channelGroups).map(([chId, videos]) => {
      const ch = chMap[chId];
      if (!ch) return null;
      const outlierCount = videos.filter((v: any) => v.isOutlier).length;
      const superOutlierCount = videos.filter((v: any) => v.isSuperOutlier).length;
      const avgEngagement = videos.reduce((s: number, v: any) => s + v.engagementRate, 0) / videos.length;
      const avgVph = videos.reduce((s: number, v: any) => s + v.vph, 0) / videos.length;
      const maxViews = Math.max(...videos.map((v: any) => v.views));

      const viralScore = Math.min(100, Math.round(
        (outlierCount * 15) + (superOutlierCount * 25) +
        (avgEngagement * 5) + (Math.min(avgVph, 2000) / 20) +
        (ch.subscribers < 10000 ? 20 : ch.subscribers < 100000 ? 10 : 5)
      ));

      const isMonetized = ch.subscribers >= 1000 && ch.totalViews >= 240000;

      return {
        ...ch, outlierCount, superOutlierCount,
        avgEngagement: parseFloat(avgEngagement.toFixed(2)),
        avgVph: Math.round(avgVph), viralScore, isMonetized, maxViews,
        videos: videos.sort((a: any, b: any) => b.views - a.views).slice(0, 5),
      };
    }).filter(Boolean).sort((a: any, b: any) => b.viralScore - a.viralScore);

    // 6. AI Analysis
    const topChannelsSummary = channels.slice(0, 15).map((c: any) => 
      `${c.name} (${c.subscribers} subs, ${c.videoCount} vids, avg ${c.avgViews} views/vid, ${c.outlierCount} outliers, engagement ${c.avgEngagement}%, ${c.isMonetized ? 'monetized' : 'not monetized'}, country: ${c.country}). Top videos: ${c.videos.slice(0, 3).map((v: any) => `"${v.title}" (${v.views} views, ${v.vph} v/h)`).join("; ")}`
    ).join("\n");

    const topTrendingSummary = trending.slice(0, 20).map((v: any) => 
      `"${v.title}" by ${v.channelTitle} — ${v.views} views in ${Math.round((Date.now() - new Date(v.publishedAt).getTime()) / 86400000)}d, ${v.vph} v/h, ${v.engagementRate}% eng, ${v.viewsPerSub}x subs, outlier: ${v.isOutlier}`
    ).join("\n");

    const monetizedCount = channels.filter((c: any) => c.isMonetized).length;
    const avgSubs = channels.length > 0 ? Math.round(channels.reduce((s: number, c: any) => s + (c as any).subscribers, 0) / channels.length) : 0;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a YouTube monetization expert. Analyze ONLY the real data provided. Be brutally honest.

CRITICAL RULES:
- Revenue projections MUST be realistic for ${region} (RPM: $${baseRpm})
- Monetization timeline MUST reflect that in ${region}, channels typically take ${countryData.avgMonths} months to monetize (range: ${countryData.minMonths}-${countryData.avgMonths * 1.5} months)
- YPP requires ${YPP_REQUIREMENTS.subs} subscribers + ${YPP_REQUIREMENTS.watchHours} watch hours
- Revenue projections: Month 1-3 should show $0 for most niches (not monetized yet)
- Base your content strategy on ACTUAL patterns you see in the trending video titles provided
- All text in Portuguese (BR)`
          },
          {
            role: "user",
            content: `Analyze "${niche}" niche in ${region} (RPM: $${baseRpm}, avg monetization: ${countryData.avgMonths} months).

REAL YOUTUBE API DATA (${new Date().toISOString()}):
=== TOP CHANNELS ===
${topChannelsSummary || "No channels found"}

=== TRENDING VIDEOS (last ${daysBack} days) ===
${topTrendingSummary || "No trending"}

=== STATS ===
Channels: ${channels.length} | Videos: ${trending.length}
Avg engagement: ${(trending.reduce((s: number, v: any) => s + v.engagementRate, 0) / Math.max(1, trending.length)).toFixed(2)}%
Outliers (3x+): ${trending.filter((v: any) => v.isOutlier).length} | Super (10x+): ${trending.filter((v: any) => v.isSuperOutlier).length}
Monetized: ${monetizedCount}/${channels.length} | Avg subs: ${avgSubs}

Provide intelligence report with REALISTIC monetization projections for ${region}.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "niche_intelligence_report",
            description: "Return comprehensive niche analysis",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score 0-100" },
                verdict: { type: "string" },
                verdictEmoji: { type: "string" },
                estimatedRpm: { type: "number" },
                difficulty: { type: "string", enum: ["Fácil", "Médio", "Difícil", "Muito Difícil"] },
                saturation: { type: "string", enum: ["Baixa", "Média", "Alta", "Muito Alta"] },
                growthTrend: { type: "string", enum: ["Explodindo", "Crescendo", "Estável", "Saturando", "Declinando"] },
                facelessViability: { type: "number" },
                monetizationSpeed: { type: "string", enum: ["Ultra Rápida", "Rápida", "Média", "Lenta"] },
                audienceSize: { type: "string" },
                monthsToMonetize: { type: "number", description: "Realistic months to reach YPP for this niche+country" },
                monthsToFirstPayout: { type: "number", description: "Months until first AdSense payout" },
                
                radarMetrics: {
                  type: "object",
                  properties: {
                    rpm: { type: "number" }, growth: { type: "number" },
                    ease: { type: "number" }, faceless: { type: "number" },
                    monetizationSpeed: { type: "number" }, virality: { type: "number" },
                  },
                  required: ["rpm", "growth", "ease", "faceless", "monetizationSpeed", "virality"],
                  additionalProperties: false,
                },

                revenueSplit: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { source: { type: "string" }, percent: { type: "number" } },
                    required: ["source", "percent"], additionalProperties: false,
                  },
                },

                revenueProjection: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      month: { type: "number" }, views: { type: "number" },
                      revenue: { type: "number" }, subs: { type: "number" },
                      milestone: { type: "string", description: "Key milestone at this month, e.g. 'YPP eligible', 'First payout', empty if none" },
                    },
                    required: ["month", "views", "revenue", "subs", "milestone"],
                    additionalProperties: false,
                  },
                  description: "Months 1,2,3,6,9,12,18,24 with REALISTIC revenue ($0 before monetization)"
                },

                subNiches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      opportunity: { type: "string", enum: ["Alta", "Média", "Baixa"] },
                      reason: { type: "string" },
                    },
                    required: ["name", "opportunity", "reason"], additionalProperties: false,
                  },
                },

                contentStrategy: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "Strategy type: 'hook_pattern', 'title_formula', 'content_gap', 'viral_format'" },
                      name: { type: "string" },
                      description: { type: "string" },
                      example: { type: "string", description: "Real example from the data" },
                      effectiveness: { type: "number", description: "0-100" },
                    },
                    required: ["type", "name", "description", "example", "effectiveness"],
                    additionalProperties: false,
                  },
                  description: "Actionable content strategies based on real patterns in the data"
                },

                retentionBlueprint: {
                  type: "object",
                  properties: {
                    idealLength: { type: "string" }, hookWindow: { type: "string" },
                    openLoopStrategy: { type: "string" }, patternInterrupts: { type: "string" },
                    endScreenStrategy: { type: "string" },
                  },
                  required: ["idealLength", "hookWindow", "openLoopStrategy", "patternInterrupts", "endScreenStrategy"],
                  additionalProperties: false,
                },

                channelClassifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      channelId: { type: "string" }, faceless: { type: "boolean" },
                      contentStyle: { type: "string" }, uploadFrequency: { type: "string" },
                    },
                    required: ["channelId", "faceless", "contentStyle", "uploadFrequency"],
                    additionalProperties: false,
                  },
                },

                competitorInsights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      channelId: { type: "string" },
                      strength: { type: "string", description: "What this competitor does well" },
                      weakness: { type: "string", description: "Where they leave opportunity" },
                      strategyToCompete: { type: "string", description: "How to compete with this channel" },
                    },
                    required: ["channelId", "strength", "weakness", "strategyToCompete"],
                    additionalProperties: false,
                  },
                  description: "Top 5 competitor analysis"
                },

                warnings: { type: "array", items: { type: "string" } },
                opportunities: { type: "array", items: { type: "string" } },
                deepInsight: { type: "string" },
              },
              required: [
                "score", "verdict", "verdictEmoji", "estimatedRpm", "difficulty", "saturation",
                "growthTrend", "facelessViability", "monetizationSpeed", "audienceSize",
                "monthsToMonetize", "monthsToFirstPayout",
                "radarMetrics", "revenueSplit", "revenueProjection", "subNiches",
                "contentStrategy", "retentionBlueprint",
                "channelClassifications", "competitorInsights",
                "warnings", "opportunities", "deepInsight"
              ],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "niche_intelligence_report" } },
      }),
    });

    let analysis = null;
    if (aiResponse.ok) {
      try {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          analysis = JSON.parse(toolCall.function.arguments);
          (analysis.channelClassifications || []).forEach((c: any) => {
            const ch = channels.find((ch: any) => (ch as any).id === c.channelId);
            if (ch) {
              (ch as any).faceless = c.faceless;
              (ch as any).contentStyle = c.contentStyle;
              (ch as any).uploadFrequency = c.uploadFrequency;
            }
          });
        }
      } catch (e) {
        console.error("AI parse error:", e);
      }
    } else {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
    }

    return new Response(JSON.stringify({
      channels,
      trending: trending.slice(0, 30),
      analysis,
      meta: {
        niche, country: region, baseRpm, totalChannels: channels.length,
        totalVideos: trending.length, timestamp: Date.now(),
        countryData: { ...countryData, ypp: YPP_REQUIREMENTS },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("niche-explorer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
