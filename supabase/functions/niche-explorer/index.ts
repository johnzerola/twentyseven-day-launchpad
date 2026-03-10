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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, language } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const region = country || "BR";
    const lang = language || "pt";
    const baseRpm = RPM_BY_COUNTRY[region] || 1.5;

    // 1. Search top videos in this niche (last 30 days, sorted by view count)
    const after = new Date(Date.now() - 30 * 86400000).toISOString();
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(niche)}&maxResults=50&order=viewCount&regionCode=${region}&relevanceLanguage=${lang}&publishedAfter=${after}&key=${YOUTUBE_API_KEY}`;
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

    // 3. Get unique channel stats
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
        views,
        likes,
        comments,
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

    // 6. AI Deep Analysis — real intelligence from a YouTube CEO perspective
    const topChannelsSummary = channels.slice(0, 15).map((c: any) => 
      `${c.name} (${c.subscribers} subs, ${c.videoCount} vids, avg ${c.avgViews} views/vid, ${c.outlierCount} outliers, engagement ${c.avgEngagement}%, ${c.faceless ? 'faceless' : 'camera'}, ${c.isMonetized ? 'monetized' : 'not monetized'}). Top videos: ${c.videos.slice(0, 3).map((v: any) => `"${v.title}" (${v.views} views, ${v.vph} v/h)`).join("; ")}`
    ).join("\n");

    const topTrendingSummary = trending.slice(0, 20).map((v: any) => 
      `"${v.title}" by ${v.channelTitle} — ${v.views} views in ${Math.round((Date.now() - new Date(v.publishedAt).getTime()) / 86400000)}d, ${v.vph} v/h, ${v.engagementRate}% eng, ${v.viewsPerSub}x subs, outlier: ${v.isOutlier}`
    ).join("\n");

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
            content: `You are a YouTube CEO with 25 years of experience, 500+ monetized channels across 40+ niches. You've tested every monetization strategy, algorithm hack, and growth pattern. You give brutally honest, data-driven analysis.

Your analysis must be:
- Based ONLY on the real data provided (channels, views, engagement, outliers)
- Specific to this niche in this country
- Actionable with exact strategies
- Include revenue projections based on real RPM data
- Identify patterns that 99% of creators miss
- Portuguese (Brazilian) language`
          },
          {
            role: "user",
            content: `Analyze the "${niche}" niche in ${region} (base RPM: $${baseRpm}).

REAL DATA FROM YOUTUBE API:
=== TOP CHANNELS ===
${topChannelsSummary || "No channels found"}

=== TOP TRENDING VIDEOS (last 30 days) ===
${topTrendingSummary || "No trending videos found"}

=== STATS ===
Total channels analyzed: ${channels.length}
Total trending videos: ${trending.length}
Average engagement rate: ${(trending.reduce((s: number, v: any) => s + v.engagementRate, 0) / Math.max(1, trending.length)).toFixed(2)}%
Outlier videos (3x+ avg): ${trending.filter((v: any) => v.isOutlier).length}
Super outliers (10x+): ${trending.filter((v: any) => v.isSuperOutlier).length}
Monetized channels: ${channels.filter((c: any) => c.isMonetized).length} of ${channels.length}
Avg subscribers: ${Math.round(channels.reduce((s: number, c: any) => s + (c as any).subscribers, 0) / Math.max(1, channels.length))}
Avg views/video: ${Math.round(channels.reduce((s: number, c: any) => s + (c as any).avgViews, 0) / Math.max(1, channels.length))}

Provide a comprehensive niche intelligence report.`
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
                score: { type: "number", description: "Monetiza27 Score (0-100) based on real data" },
                verdict: { type: "string", description: "One-line verdict in Portuguese" },
                verdictEmoji: { type: "string", description: "🟢, 🟡, or 🔴" },
                estimatedRpm: { type: "number", description: "Estimated RPM for this niche+country" },
                difficulty: { type: "string", enum: ["Fácil", "Médio", "Difícil", "Muito Difícil"] },
                saturation: { type: "string", enum: ["Baixa", "Média", "Alta", "Muito Alta"] },
                growthTrend: { type: "string", enum: ["Explodindo", "Crescendo", "Estável", "Saturando", "Declinando"] },
                facelessViability: { type: "number", description: "0-100 how viable faceless is" },
                monetizationSpeed: { type: "string", enum: ["Ultra Rápida", "Rápida", "Média", "Lenta"] },
                audienceSize: { type: "string", description: "e.g. 5M+, 50M+" },
                
                radarMetrics: {
                  type: "object",
                  properties: {
                    rpm: { type: "number", description: "0-100" },
                    growth: { type: "number", description: "0-100" },
                    ease: { type: "number", description: "0-100 how easy to enter" },
                    faceless: { type: "number", description: "0-100" },
                    monetizationSpeed: { type: "number", description: "0-100" },
                    virality: { type: "number", description: "0-100 based on outlier data" },
                  },
                  required: ["rpm", "growth", "ease", "faceless", "monetizationSpeed", "virality"],
                  additionalProperties: false,
                },

                revenueSplit: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      percent: { type: "number" },
                    },
                    required: ["source", "percent"],
                    additionalProperties: false,
                  },
                  description: "Revenue sources breakdown"
                },

                revenueProjection: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      month: { type: "number" },
                      views: { type: "number" },
                      revenue: { type: "number" },
                      subs: { type: "number" },
                    },
                    required: ["month", "views", "revenue", "subs"],
                    additionalProperties: false,
                  },
                  description: "Revenue projection for months 1,3,6,12,18,24"
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
                    required: ["name", "opportunity", "reason"],
                    additionalProperties: false,
                  },
                },

                hookPatterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pattern: { type: "string", description: "Hook pattern name" },
                      example: { type: "string", description: "Example from the data" },
                      effectiveness: { type: "number", description: "0-100" },
                    },
                    required: ["pattern", "example", "effectiveness"],
                    additionalProperties: false,
                  },
                  description: "Hook/title patterns detected in viral videos"
                },

                titleFormulas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      formula: { type: "string" },
                      example: { type: "string" },
                      estimatedCtr: { type: "number" },
                    },
                    required: ["formula", "example", "estimatedCtr"],
                    additionalProperties: false,
                  },
                  description: "Reverse-engineered title formulas from top performers"
                },

                retentionBlueprint: {
                  type: "object",
                  properties: {
                    idealLength: { type: "string" },
                    hookWindow: { type: "string" },
                    openLoopStrategy: { type: "string" },
                    patternInterrupts: { type: "string" },
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
                      channelId: { type: "string" },
                      faceless: { type: "boolean" },
                      contentStyle: { type: "string" },
                      uploadFrequency: { type: "string" },
                    },
                    required: ["channelId", "faceless", "contentStyle", "uploadFrequency"],
                    additionalProperties: false,
                  },
                },

                actionPlan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "string" },
                      action: { type: "string" },
                      goal: { type: "string" },
                    },
                    required: ["week", "action", "goal"],
                    additionalProperties: false,
                  },
                  description: "27-day action plan to enter this niche"
                },

                warnings: {
                  type: "array",
                  items: { type: "string" },
                  description: "Risks and warnings"
                },

                opportunities: {
                  type: "array",
                  items: { type: "string" },
                  description: "Hidden opportunities most creators miss"
                },

                deepInsight: { type: "string", description: "A paragraph of brutally honest CEO-level insight about this niche, in Portuguese" },
              },
              required: [
                "score", "verdict", "verdictEmoji", "estimatedRpm", "difficulty", "saturation",
                "growthTrend", "facelessViability", "monetizationSpeed", "audienceSize",
                "radarMetrics", "revenueSplit", "revenueProjection", "subNiches",
                "hookPatterns", "titleFormulas", "retentionBlueprint",
                "channelClassifications", "actionPlan", "warnings", "opportunities", "deepInsight"
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
          // Apply faceless classifications
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
      meta: { niche, country: region, baseRpm, totalChannels: channels.length, totalVideos: trending.length },
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
