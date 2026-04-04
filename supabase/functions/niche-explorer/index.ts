import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const YPP_REQUIREMENTS = { subs: 1000, watchHours: 4000, shortsViews: 10000000 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, language } = await req.json();
    const ytKeys: string[] = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean) as string[];
    let ytKeyIndex = 0;
    const getYtKey = () => ytKeys[ytKeyIndex % ytKeys.length] || "";
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!ytKeys.length) throw new Error("YOUTUBE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const region = country || "BR";
    const lang = language || "pt";
    const countryData = RPM_BY_COUNTRY[region] || RPM_BY_COUNTRY.BR;
    let baseRpm = countryData.rpm;

    // === STEP 0: AI generates multiple search queries for deeper discovery ===
    const queryGenRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Generate 4 different YouTube search queries to find channels and videos in a niche. Include the main query, a sub-niche query, a trending angle, and a competitor discovery query. Return JSON array of strings only." },
          { role: "user", content: `Niche: "${niche}", region: ${region}, language: ${lang}. Return 4 search queries as JSON array.` },
        ],
      }),
    });
    
    let searchQueries = [niche];
    if (queryGenRes.ok) {
      try {
        const qData = await queryGenRes.json();
        const content = qData.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        if (Array.isArray(parsed) && parsed.length > 0) searchQueries = parsed.slice(0, 4);
      } catch { /* use default */ }
    }

    // === STEP 1: Query internal databases in parallel ===
    const [nicheDbRes, intelRes, viralRes] = await Promise.all([
      sb.from("niche_database").select("*").ilike("name", `%${niche}%`).limit(5),
      sb.from("channel_intelligence")
        .select("channel_name, youtube_channel_id, subscribers, avg_views, niche, style, growth_rate, rpm_estimate, language, country, viral_patterns, upload_frequency, is_faceless, visual_style_notes")
        .or(`niche.ilike.%${niche}%,sub_niche.ilike.%${niche}%`)
        .order("avg_views", { ascending: false })
        .limit(15),
      sb.from("viral_titles_db")
        .select("title, views, likes, channel_name, channel_id, niche, country, why_viral, title_pattern, emotional_triggers, seo_score, published_at")
        .ilike("niche", `%${niche}%`)
        .order("views", { ascending: false })
        .limit(30),
    ]);

    const nicheDbRows = nicheDbRes.data || [];
    const intelChannels = intelRes.data || [];
    const viralTitles = viralRes.data || [];

    let nicheDbContext = "";
    if (nicheDbRows.length) {
      const bestMatch = nicheDbRows[0];
      if (bestMatch.rpm_estimate && bestMatch.rpm_estimate > 0) baseRpm = bestMatch.rpm_estimate;
      nicheDbContext = nicheDbRows.map((n: any) => 
        `Nicho "${n.name}": RPM=$${n.rpm_estimate}, saturação=${n.saturation}, dificuldade=${n.difficulty}, faceless=${n.faceless_friendly}, sub-nichos=${JSON.stringify(n.sub_niches)}`
      ).join("\n");
    }

    let intelContext = "";
    let directCompetitors: any[] = [];
    if (intelChannels.length) {
      directCompetitors = intelChannels.slice(0, 5).map((c: any) => ({
        id: c.youtube_channel_id, name: c.channel_name, subscribers: c.subscribers,
        avgViews: c.avg_views, style: c.style, growthRate: c.growth_rate,
        rpmEstimate: c.rpm_estimate, uploadFrequency: c.upload_frequency, isFaceless: c.is_faceless,
      }));
      intelContext = intelChannels.map((c: any) =>
        `[DB] ${c.channel_name}: ${c.subscribers} subs, avg ${c.avg_views} views, style=${c.style}, growth=${c.growth_rate}, RPM=$${c.rpm_estimate}, freq=${c.upload_frequency}, faceless=${c.is_faceless}`
      ).join("\n");
    }

    // Build viral titles context
    const viralContext = viralTitles.length > 0 
      ? viralTitles.map((t: any) => 
          `"${t.title}" by ${t.channel_name} — ${t.views} views, pattern: ${t.title_pattern}, triggers: ${(t.emotional_triggers || []).join(",")} | why: ${t.why_viral || ''}`
        ).join("\n")
      : "";

    // Viral pattern analysis
    const viralPatterns: Record<string, number> = {};
    const viralTriggers: Record<string, number> = {};
    viralTitles.forEach((t: any) => {
      if (t.title_pattern) viralPatterns[t.title_pattern] = (viralPatterns[t.title_pattern] || 0) + 1;
      (t.emotional_triggers || []).forEach((tr: string) => {
        viralTriggers[tr] = (viralTriggers[tr] || 0) + 1;
      });
    });
    const topPatterns = Object.entries(viralPatterns).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topTriggers = Object.entries(viralTriggers).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // === STEP 2: Multiple YouTube searches in parallel ===
    const daysBack = 14 + Math.floor(Math.random() * 46);
    const after = new Date(Date.now() - daysBack * 86400000).toISOString();

    let allSearchItems: any[] = [];
    const seenVideoIds = new Set<string>();

    // Try YouTube search with key fallback
    for (let keyAttempt = 0; keyAttempt < ytKeys.length && allSearchItems.length === 0; keyAttempt++) {
      const currentKey = getYtKey();
      const ytSearches = await Promise.all(
        searchQueries.slice(0, 3).map((q: string, i: number) => {
          const order = ["viewCount", "relevance", "date"][i % 3];
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=40&order=${order}&regionCode=${region}&relevanceLanguage=${lang}&publishedAfter=${after}&key=${currentKey}`;
          return fetch(url).then(r => r.json()).catch(() => ({ items: [] }));
        })
      );

      ytSearches.forEach((sd: any) => {
        if (sd.error?.errors?.[0]?.reason === "quotaExceeded") {
          console.log(`YouTube key #${ytKeyIndex + 1} quota exceeded, switching...`);
          ytKeyIndex++;
          return;
        }
        (sd.items || []).forEach((item: any) => {
          const vid = item.id?.videoId;
          if (vid && !seenVideoIds.has(vid)) {
            seenVideoIds.add(vid);
            allSearchItems.push(item);
          }
        });
      });

      if (allSearchItems.length === 0 && keyAttempt < ytKeys.length - 1) {
        ytKeyIndex++;
        console.log(`Retrying with YouTube key #${ytKeyIndex + 1}`);
      }
    }

    // If no YouTube results, still generate analysis from internal databases
    if (!allSearchItems.length) {
      // We have viralTitles, intelChannels, nicheDbRows — generate analysis from those
      if (viralTitles.length > 0 || intelChannels.length > 0 || nicheDbRows.length > 0) {
        console.log(`No YouTube results, generating analysis from internal DB (${viralTitles.length} titles, ${intelChannels.length} channels, ${nicheDbRows.length} niches)`);
        // Skip to AI analysis with internal data only
      } else {
        return new Response(JSON.stringify({
          channels: [], trending: [], analysis: null, viralDbData: { titles: viralTitles, topPatterns, topTriggers },
          directCompetitors, meta: { niche, country: region, baseRpm, totalChannels: 0, totalVideos: 0, timestamp: Date.now(), countryData: { ...countryData, ypp: YPP_REQUIREMENTS }, searchQueries },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === STEP 3: Get video + channel stats (only if we have YouTube results) ===
    let trending: any[] = [];
    let channels: any[] = [];
    const chMap: Record<string, any> = {};

    if (allSearchItems.length > 0) {
      const currentKey = getYtKey();
      const videoIds = allSearchItems.map((i: any) => i.id.videoId).filter(Boolean).join(",");
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${currentKey}`);
      const vData = await vRes.json();

      const channelIds = [...new Set((vData.items || []).map((v: any) => v.snippet.channelId))] as string[];
      const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelIds.slice(0, 50).join(",")}&key=${currentKey}`);
      const cData = await cRes.json();

      (cData.items || []).forEach((ch: any) => {
        const subs = parseInt(ch.statistics.subscriberCount || "0");
        const totalViews = parseInt(ch.statistics.viewCount || "0");
        const videoCount = parseInt(ch.statistics.videoCount || "0");
        chMap[ch.id] = {
          id: ch.id, name: ch.snippet.title,
          thumbnail: ch.snippet.thumbnails?.medium?.url,
          description: ch.snippet.description?.slice(0, 200) || "",
          subscribers: subs, totalViews, videoCount,
          avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
          country: ch.snippet.country || "",
          keywords: ch.brandingSettings?.channel?.keywords || "",
          createdAt: ch.snippet.publishedAt,
        };
      });

      // Build trending videos
      trending = (vData.items || []).map((v: any) => {
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");
        const ch = chMap[v.snippet.channelId];
        const publishedMs = new Date(v.snippet.publishedAt).getTime();
        const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);
        const daysAge = hoursAge / 24;

        return {
          id: v.id, title: v.snippet.title, channelTitle: v.snippet.channelTitle,
          channelId: v.snippet.channelId, thumbnail: v.snippet.thumbnails?.medium?.url,
          views, likes, comments, publishedAt: v.snippet.publishedAt,
          duration: v.contentDetails?.duration || "",
          vph: Math.round(views / hoursAge), vpd: Math.round(views / Math.max(1, daysAge)),
          engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
          commentRate: views > 0 ? parseFloat(((comments / views) * 100).toFixed(3)) : 0,
          viewsPerSub: ch?.subscribers > 0 ? parseFloat((views / ch.subscribers).toFixed(2)) : 0,
          isOutlier: ch ? views >= ch.avgViews * 3 : false,
          isSuperOutlier: ch ? views >= ch.avgViews * 10 : false,
          channelSubs: ch?.subscribers || 0,
        };
      });

      // Group by channel
      const channelGroups: Record<string, any[]> = {};
      trending.forEach((v: any) => {
        if (!channelGroups[v.channelId]) channelGroups[v.channelId] = [];
        channelGroups[v.channelId].push(v);
      });

      channels = Object.entries(channelGroups).map(([chId, videos]) => {
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
    } // end if allSearchItems.length > 0

    // === STEP 4: AI Analysis with ALL data ===
    const topChannelsSummary = channels.slice(0, 15).map((c: any) => 
      `${c.name} (${c.subscribers} subs, ${c.videoCount} vids, avg ${c.avgViews} views/vid, ${c.outlierCount} outliers, engagement ${c.avgEngagement}%, ${c.isMonetized ? 'monetized' : 'not monetized'}, country: ${c.country}). Top: ${c.videos.slice(0, 3).map((v: any) => `"${v.title}" (${v.views} views, ${v.vph} v/h)`).join("; ")}`
    ).join("\n");

    const topTrendingSummary = trending.slice(0, 20).map((v: any) => 
      `"${v.title}" by ${v.channelTitle} — ${v.views} views in ${Math.round((Date.now() - new Date(v.publishedAt).getTime()) / 86400000)}d, ${v.vph} v/h, ${v.engagementRate}% eng, ${v.viewsPerSub}x subs, outlier: ${v.isOutlier}`
    ).join("\n");

    const monetizedCount = channels.filter((c: any) => c.isMonetized).length;
    const avgSubs = channels.length > 0 ? Math.round(channels.reduce((s: number, c: any) => s + (c as any).subscribers, 0) / channels.length) : 0;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a YouTube monetization expert. Analyze ONLY the real data provided. Be brutally honest.

CRITICAL RULES:
- Revenue projections MUST be realistic for ${region} (RPM: $${baseRpm})
- Monetization timeline MUST reflect that in ${region}, channels typically take ${countryData.avgMonths} months (range: ${countryData.minMonths}-${Math.round(countryData.avgMonths * 1.5)} months)
- YPP requires ${YPP_REQUIREMENTS.subs} subscribers + ${YPP_REQUIREMENTS.watchHours} watch hours
- Revenue projections: Month 1-3 should show $0 for most niches (not monetized yet)
- Base content strategy on ACTUAL patterns from trending videos AND viral database
- Cross-reference with internal databases when available
- All text in Portuguese (BR)`
          },
          {
            role: "user",
            content: `Analyze "${niche}" niche in ${region} (RPM: $${baseRpm}, avg monetization: ${countryData.avgMonths} months).

REAL YOUTUBE API DATA (${new Date().toISOString()}, ${searchQueries.length} searches performed):
=== TOP CHANNELS (${channels.length} found via API) ===
${topChannelsSummary || "No channels found"}

=== TRENDING VIDEOS (last ${daysBack} days) ===
${topTrendingSummary || "No trending"}

=== VIRAL DATABASE — ${viralTitles.length} PROVEN VIRAL TITLES IN THIS NICHE ===
${viralContext || "No viral titles in database for this niche"}

Top viral patterns: ${topPatterns.map(([p, c]) => `${p} (${c}x)`).join(", ") || "none"}
Top emotional triggers: ${topTriggers.map(([t, c]) => `${t} (${c}x)`).join(", ") || "none"}

=== INTERNAL DATABASE — NICHE DATA ===
${nicheDbContext || "No internal niche data"}

=== INTERNAL DATABASE — ${intelChannels.length} ANALYZED CHANNELS ===
${intelContext || "No internal channel data"}

=== STATS ===
Channels via API: ${channels.length} | Videos: ${trending.length}
Channels in DB: ${intelChannels.length} | Viral titles in DB: ${viralTitles.length}
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
                monthsToMonetize: { type: "number" },
                monthsToFirstPayout: { type: "number" },
                
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
                      milestone: { type: "string" },
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
                      type: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      example: { type: "string" },
                      effectiveness: { type: "number" },
                    },
                    required: ["type", "name", "description", "example", "effectiveness"],
                    additionalProperties: false,
                  },
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
                      strength: { type: "string" },
                      weakness: { type: "string" },
                      strategyToCompete: { type: "string" },
                    },
                    required: ["channelId", "strength", "weakness", "strategyToCompete"],
                    additionalProperties: false,
                  },
                },

                viralTitleFormulas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      formula: { type: "string", description: "Title formula pattern e.g. 'Number + Shocking Fact + Niche'" },
                      example: { type: "string" },
                      avgViews: { type: "string" },
                      emotionalTrigger: { type: "string" },
                    },
                    required: ["formula", "example", "avgViews", "emotionalTrigger"],
                    additionalProperties: false,
                  },
                  description: "5-8 proven title formulas from the viral database and trending data"
                },

                hiddenChannels: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      whyInteresting: { type: "string" },
                      whatToCopy: { type: "string" },
                      estimatedRpm: { type: "number" },
                    },
                    required: ["name", "whyInteresting", "whatToCopy"],
                    additionalProperties: false,
                  },
                  description: "Interesting channels discovered that are worth watching/copying strategies from"
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
                "viralTitleFormulas", "hiddenChannels",
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
      directCompetitors,
      viralDbData: {
        titles: viralTitles.slice(0, 15),
        topPatterns,
        topTriggers,
        totalInDb: viralTitles.length,
      },
      meta: {
        niche, country: region, baseRpm, totalChannels: channels.length,
        totalVideos: trending.length, timestamp: Date.now(),
        countryData: { ...countryData, ypp: YPP_REQUIREMENTS },
        nicheDbMatches: nicheDbRows.length,
        intelChannelMatches: intelChannels.length,
        searchQueries,
        viralTitlesInDb: viralTitles.length,
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
