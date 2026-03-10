import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScanParams {
  mode: "emerging" | "escapees" | "cluster" | "micro-niche-drill";
  niche: string;
  country?: string;
  language?: string;
  maxVideos?: number;
  maxChannelAgeDays?: number;
  minSubs?: number;
  maxSubs?: number;
  minViews?: number;
  maxViews?: number;
  maxChannelVideos?: number;
  minVideoViews?: number;
  minEngagement?: number;
  minViralScore?: number;
  sortBy?: string;
}

async function fetchJSON(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

function daysSince(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function buildChannelData(cData: any, vData: any) {
  const channelMap: Record<string, any> = {};
  for (const ch of (cData.items || [])) {
    const subs = parseInt(ch.statistics.subscriberCount || "0");
    const totalViews = parseInt(ch.statistics.viewCount || "0");
    const videoCount = parseInt(ch.statistics.videoCount || "0");
    const createdAt = ch.snippet.publishedAt;
    const ageDays = daysSince(createdAt);

    channelMap[ch.id] = {
      id: ch.id,
      name: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url,
      description: ch.snippet.description?.slice(0, 300) || "",
      subscribers: subs,
      totalViews,
      videoCount,
      avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
      country: ch.snippet.country || "",
      createdAt,
      ageDays: Math.round(ageDays),
      keywords: ch.brandingSettings?.channel?.keywords || "",
      isMonetized: subs >= 1000 && totalViews >= 240000,
    };
  }

  const channelVideos: Record<string, any[]> = {};
  for (const v of (vData.items || [])) {
    const chId = v.snippet.channelId;
    if (!channelVideos[chId]) channelVideos[chId] = [];
    const views = parseInt(v.statistics?.viewCount || "0");
    const likes = parseInt(v.statistics?.likeCount || "0");
    const comments = parseInt(v.statistics?.commentCount || "0");
    const publishedMs = new Date(v.snippet.publishedAt).getTime();
    const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);
    const hoursAgeActual = (Date.now() - publishedMs) / 3600000;
    const viewVelocity72h = hoursAgeActual <= 72 ? views : Math.round(views * (72 / hoursAgeActual));

    channelVideos[chId].push({
      id: v.id,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      views, likes, comments,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails?.duration || "",
      vph: Math.round(views / hoursAge),
      engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
      commentEngagement: views > 0 ? parseFloat(((comments / views) * 100).toFixed(3)) : 0,
      likeRatio: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
      viewVelocity72h,
    });
  }

  return { channelMap, channelVideos };
}

function enrichChannels(channelMap: Record<string, any>, channelVideos: Record<string, any[]>) {
  return Object.entries(channelMap).map(([chId, ch]) => {
    const videos = (channelVideos[chId] || []).sort((a: any, b: any) => b.views - a.views);
    const totalVideoViews = videos.reduce((s: number, v: any) => s + v.views, 0);
    const avgVideoViews = videos.length > 0 ? Math.round(totalVideoViews / videos.length) : 0;
    const maxVideoViews = videos.length > 0 ? Math.max(...videos.map((v: any) => v.views)) : 0;
    const avgVph = videos.length > 0 ? Math.round(videos.reduce((s: number, v: any) => s + v.vph, 0) / videos.length) : 0;

    const viewsPerSub = ch.subscribers > 0 ? parseFloat((totalVideoViews / ch.subscribers).toFixed(2)) : 0;
    const avgEngagement = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.engagementRate, 0) / videos.length).toFixed(2)) : 0;
    const avgCommentEngagement = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.commentEngagement, 0) / videos.length).toFixed(3)) : 0;
    const avgLikeRatio = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.likeRatio, 0) / videos.length).toFixed(2)) : 0;
    const avgViewVelocity72h = videos.length > 0 ? Math.round(videos.reduce((s: number, v: any) => s + v.viewVelocity72h, 0) / videos.length) : 0;

    const publishDates = videos.map((v: any) => new Date(v.publishedAt).getTime()).sort((a: number, b: number) => b - a);
    let uploadFrequencyDays = 0;
    if (publishDates.length >= 2) {
      const intervals = [];
      for (let i = 0; i < publishDates.length - 1; i++) {
        intervals.push((publishDates[i] - publishDates[i + 1]) / 86400000);
      }
      uploadFrequencyDays = parseFloat((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1));
    }

    const efficiencyScore = ch.subscribers > 0 
      ? Math.min(100, Math.round((maxVideoViews / Math.max(ch.subscribers, 1)) * 10))
      : 0;
    const growthVelocity = ch.subscribers > 0 
      ? Math.round((avgVideoViews / ch.subscribers) * 100)
      : 0;

    const vsViewsPerSub = Math.min(30, viewsPerSub * 3);
    const vsVelocity = Math.min(20, (avgViewVelocity72h / 10000) * 20);
    const vsEngagement = Math.min(20, avgCommentEngagement * 200);
    const vsLikeRatio = Math.min(15, avgLikeRatio * 3);
    const vsUploadFreq = uploadFrequencyDays > 0 && uploadFrequencyDays <= 7
      ? 15 : uploadFrequencyDays <= 14 ? 10 : uploadFrequencyDays <= 30 ? 5 : 0;

    const viralScore = Math.min(100, Math.round(vsViewsPerSub + vsVelocity + vsEngagement + vsLikeRatio + vsUploadFreq));
    const growthPotentialScore = Math.min(100, Math.round((efficiencyScore * 0.4) + (viralScore * 0.4) + (growthVelocity > 200 ? 20 : growthVelocity > 100 ? 10 : 0)));
    const algorithmBoostProbability = Math.min(100, Math.round(viralScore * 0.6 + (avgViewVelocity72h > 50000 ? 40 : avgViewVelocity72h > 10000 ? 20 : 0)));

    const outlierVideos = videos.filter((v: any) => ch.avgViews > 0 && v.views >= ch.avgViews * 3);

    return {
      ...ch,
      videos: videos.slice(0, 5),
      recentVideoCount: videos.length,
      avgVideoViews, maxVideoViews, avgVph, viewsPerSub, efficiencyScore,
      outlierCount: outlierVideos.length, growthVelocity,
      avgEngagement, avgCommentEngagement, avgLikeRatio, avgViewVelocity72h,
      uploadFrequencyDays, viralScore, growthPotentialScore, algorithmBoostProbability,
      isEmerging: ch.videoCount <= 10 && ch.ageDays <= 90,
      isAlgorithmEscapee: growthVelocity >= 500 && ch.videoCount <= 20,
    };
  });
}

function applyFilters(channels: any[], params: ScanParams) {
  const { mode, minSubs = 0, maxSubs, minViews = 0, maxViews, maxChannelVideos, minVideoViews, minEngagement, minViralScore, maxVideos, maxChannelAgeDays } = params;

  // Mode-specific filters FIRST
  if (mode === "emerging") {
    const maxVids = maxVideos || 10;
    const maxAge = maxChannelAgeDays || 90;
    channels = channels.filter(ch => ch.videoCount <= maxVids && ch.ageDays <= maxAge);
  } else if (mode === "escapees") {
    channels = channels.filter(ch => ch.growthVelocity >= 200);
  }

  // Common filters — ALL respected strictly
  if (minSubs > 0) channels = channels.filter(ch => ch.subscribers >= minSubs);
  if (maxSubs) channels = channels.filter(ch => ch.subscribers <= maxSubs);
  if (minViews > 0) channels = channels.filter(ch => ch.maxVideoViews >= minViews);
  if (maxViews) channels = channels.filter(ch => ch.maxVideoViews <= maxViews);
  if (maxChannelVideos) channels = channels.filter(ch => ch.videoCount <= maxChannelVideos);
  if (minVideoViews) channels = channels.filter(ch => ch.maxVideoViews >= minVideoViews);
  if (minEngagement && minEngagement > 0) channels = channels.filter(ch => ch.avgEngagement >= minEngagement);
  if (minViralScore && minViralScore > 0) channels = channels.filter(ch => ch.viralScore >= minViralScore);

  return channels;
}

function sortChannels(channels: any[], mode: string, sortBy?: string) {
  const sortKey = sortBy || (mode === "escapees" ? "growthVelocity" : "viralScore");
  return channels.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params: ScanParams = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const { mode, niche, country = "", language = "" } = params;
    if (!niche?.trim()) throw new Error("Niche is required");

    // Step 1: Search for recent videos
    const after30d = new Date(Date.now() - 30 * 86400000).toISOString();
    const after90d = new Date(Date.now() - 90 * 86400000).toISOString();
    const publishedAfter = mode === "escapees" ? after30d : after90d;

    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(niche)}&maxResults=50&order=viewCount&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;
    if (country) searchUrl += `&regionCode=${country}`;
    if (language) searchUrl += `&relevanceLanguage=${language}`;

    const searchData = await fetchJSON(searchUrl);
    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ channels: [], videos: [], clusters: [], meta: { total: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get video stats
    const videoIds = searchData.items.map((i: any) => i.id.videoId).filter(Boolean);
    const vData = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);

    // Step 3: Get unique channel details
    const channelIds = [...new Set((vData.items || []).map((v: any) => v.snippet.channelId))] as string[];
    const cData = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings,contentDetails&id=${channelIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`);

    // Step 4: Build & enrich
    const { channelMap, channelVideos } = buildChannelData(cData, vData);
    let channels = enrichChannels(channelMap, channelVideos);

    // Step 5: Apply ALL filters strictly
    channels = applyFilters(channels, params);

    // Step 6: Sort
    channels = sortChannels(channels, mode, params.sortBy);

    // Step 7: AI clustering (cluster mode)
    let clusters: any[] = [];
    if ((mode === "cluster" || mode === "micro-niche-drill") && LOVABLE_API_KEY && channels.length >= 2) {
      try {
        const channelSummary = channels.slice(0, 20).map(ch =>
          `ID:${ch.id} | ${ch.name} (${ch.subscribers} subs, ${ch.videoCount} vids, avg ${ch.avgViews} views, viral:${ch.viralScore}, keywords: ${ch.keywords?.slice(0, 100)}). Top: ${ch.videos.slice(0, 2).map((v: any) => `"${v.title}"`).join(", ")}`
        ).join("\n");

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube niche analyst. Analyze channels and group them into micro-niche clusters. For each cluster, include the channel IDs that belong to it. Also suggest 3-5 specific video topics someone could create in that micro-niche. Respond in Portuguese (BR)." },
              { role: "user", content: `Agrupe estes canais do nicho "${niche}" em micro-nichos distintos. Use os IDs exatos dos canais:\n\n${channelSummary}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "channel_clusters",
                description: "Return channel clusters with channel IDs",
                parameters: {
                  type: "object",
                  properties: {
                    clusters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Micro-niche name" },
                          description: { type: "string", description: "What defines this cluster" },
                          opportunity: { type: "string", enum: ["Alta", "Média", "Baixa"] },
                          channelIds: { type: "array", items: { type: "string" }, description: "YouTube channel IDs from the provided list" },
                          suggestedTopics: { type: "array", items: { type: "string" }, description: "Specific video topic ideas for this micro-niche" },
                          searchQuery: { type: "string", description: "A YouTube search query to find more channels in this micro-niche" },
                        },
                        required: ["name", "description", "opportunity", "channelIds", "suggestedTopics", "searchQuery"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["clusters"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "channel_clusters" } },
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            clusters = parsed.clusters || [];
          }
        }
      } catch (e) {
        console.error("AI clustering error:", e);
      }
    }

    // Step 8: For micro-niche-drill, do an extra search for each cluster
    if (mode === "micro-niche-drill" && clusters.length > 0 && YOUTUBE_API_KEY) {
      for (const cluster of clusters) {
        if (!cluster.searchQuery) continue;
        try {
          let drillUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cluster.searchQuery)}&maxResults=10&key=${YOUTUBE_API_KEY}`;
          if (country) drillUrl += `&regionCode=${country}`;
          if (language) drillUrl += `&relevanceLanguage=${language}`;
          
          const drillData = await fetchJSON(drillUrl);
          const drillChannelIds = (drillData.items || []).map((i: any) => i.snippet.channelId || i.id.channelId).filter(Boolean);
          
          if (drillChannelIds.length > 0) {
            const newIds = drillChannelIds.filter((id: string) => !channelIds.includes(id));
            if (newIds.length > 0) {
              const extraCData = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${newIds.slice(0, 10).join(",")}&key=${YOUTUBE_API_KEY}`);
              
              const drillChannels = (extraCData.items || []).map((ch: any) => {
                const subs = parseInt(ch.statistics.subscriberCount || "0");
                const totalViews = parseInt(ch.statistics.viewCount || "0");
                const videoCount = parseInt(ch.statistics.videoCount || "0");
                return {
                  id: ch.id,
                  name: ch.snippet.title,
                  thumbnail: ch.snippet.thumbnails?.medium?.url,
                  subscribers: subs,
                  totalViews,
                  videoCount,
                  avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
                };
              });
              
              cluster.discoveredChannels = drillChannels;
              // Also add IDs to channelIds for dedup
              cluster.channelIds = [...new Set([...(cluster.channelIds || []), ...newIds])];
            }
          }
        } catch (e) {
          console.error(`Drill error for cluster ${cluster.name}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({
      channels: channels.slice(0, 30),
      clusters,
      meta: {
        mode, niche, country,
        totalFound: channels.length,
        emergingCount: channels.filter(ch => ch.isEmerging).length,
        escapeeCount: channels.filter(ch => ch.isAlgorithmEscapee).length,
        filtersApplied: {
          minSubs: params.minSubs, maxSubs: params.maxSubs,
          minViews: params.minViews, maxViews: params.maxViews,
          maxChannelVideos: params.maxChannelVideos, minVideoViews: params.minVideoViews,
          minEngagement: params.minEngagement, minViralScore: params.minViralScore,
        },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dubspy-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
