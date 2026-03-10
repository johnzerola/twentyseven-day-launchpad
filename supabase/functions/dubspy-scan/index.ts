import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScanParams {
  mode: "emerging" | "escapees" | "cluster";
  niche: string;
  country?: string;
  language?: string;
  // Emerging filters
  maxVideos?: number;       // e.g. 5, 10
  maxChannelAgeDays?: number; // e.g. 30, 90
  minSubGrowthPercent?: number; // for escapees
  // Common filters
  minViews?: number;
  maxViews?: number;
  minSubs?: number;
  maxSubs?: number;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params: ScanParams = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const { mode, niche, country = "", language = "", maxVideos, maxChannelAgeDays, minSubs = 0, maxSubs, minViews = 0, maxViews } = params;

    if (!niche?.trim()) throw new Error("Niche is required");

    // Step 1: Search for recent videos in this niche
    const after30d = new Date(Date.now() - 30 * 86400000).toISOString();
    const after90d = new Date(Date.now() - 90 * 86400000).toISOString();
    const publishedAfter = mode === "escapees" ? after30d : after90d;

    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(niche)}&maxResults=50&order=viewCount&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;
    if (country) searchUrl += `&regionCode=${country}`;
    if (language) searchUrl += `&relevanceLanguage=${language}`;

    const searchData = await fetchJSON(searchUrl);
    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ channels: [], videos: [], meta: { total: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get video stats
    const videoIds = searchData.items.map((i: any) => i.id.videoId).filter(Boolean);
    const vData = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);

    // Step 3: Get unique channel details
    const channelIds = [...new Set((vData.items || []).map((v: any) => v.snippet.channelId))] as string[];
    const cData = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings,contentDetails&id=${channelIds.slice(0, 50).join(",")}&key=${YOUTUBE_API_KEY}`);

    // Build channel map with full details
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

    // Step 4: Map videos to channels
    const channelVideos: Record<string, any[]> = {};
    for (const v of (vData.items || [])) {
      const chId = v.snippet.channelId;
      if (!channelVideos[chId]) channelVideos[chId] = [];
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const comments = parseInt(v.statistics?.commentCount || "0");
      const publishedMs = new Date(v.snippet.publishedAt).getTime();
      const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);

      channelVideos[chId].push({
        id: v.id,
        title: v.snippet.title,
        thumbnail: v.snippet.thumbnails?.medium?.url,
        views,
        likes,
        comments,
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails?.duration || "",
        vph: Math.round(views / hoursAge),
        engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
      });
    }

    // Step 5: Build enriched channel list with filters
    let channels = Object.entries(channelMap).map(([chId, ch]) => {
      const videos = (channelVideos[chId] || []).sort((a: any, b: any) => b.views - a.views);
      const totalVideoViews = videos.reduce((s: number, v: any) => s + v.views, 0);
      const avgVideoViews = videos.length > 0 ? Math.round(totalVideoViews / videos.length) : 0;
      const maxVideoViews = videos.length > 0 ? Math.max(...videos.map((v: any) => v.views)) : 0;
      const avgVph = videos.length > 0 ? Math.round(videos.reduce((s: number, v: any) => s + v.vph, 0) / videos.length) : 0;

      // Growth indicator: views per subscriber ratio (higher = growing fast)
      const viewsPerSub = ch.subscribers > 0 ? parseFloat((totalVideoViews / ch.subscribers).toFixed(2)) : 0;
      
      // Efficiency score: how much views relative to channel size
      const efficiencyScore = ch.subscribers > 0 
        ? Math.min(100, Math.round((maxVideoViews / Math.max(ch.subscribers, 1)) * 10))
        : 0;

      // Outlier videos from this channel
      const outlierVideos = videos.filter((v: any) => ch.avgViews > 0 && v.views >= ch.avgViews * 3);

      // Growth velocity: estimated % growth based on recent video performance
      const growthVelocity = ch.subscribers > 0 
        ? Math.round((avgVideoViews / ch.subscribers) * 100)
        : 0;

      return {
        ...ch,
        videos: videos.slice(0, 5),
        recentVideoCount: videos.length,
        avgVideoViews,
        maxVideoViews,
        avgVph,
        viewsPerSub,
        efficiencyScore,
        outlierCount: outlierVideos.length,
        growthVelocity,
        isEmerging: ch.videoCount <= 10 && ch.ageDays <= 90,
        isAlgorithmEscapee: growthVelocity >= 500 && ch.videoCount <= 20,
      };
    });

    // Step 6: Apply mode-specific filters
    if (mode === "emerging") {
      const maxVids = maxVideos || 10;
      const maxAge = maxChannelAgeDays || 90;
      channels = channels.filter(ch => 
        ch.videoCount <= maxVids && 
        ch.ageDays <= maxAge
      );
    } else if (mode === "escapees") {
      channels = channels.filter(ch => ch.growthVelocity >= 200);
    }

    // Apply common filters
    if (minSubs > 0) channels = channels.filter(ch => ch.subscribers >= minSubs);
    if (maxSubs) channels = channels.filter(ch => ch.subscribers <= maxSubs);
    if (minViews > 0) channels = channels.filter(ch => ch.maxVideoViews >= minViews);
    if (maxViews) channels = channels.filter(ch => ch.maxVideoViews <= maxViews);

    // Step 7: Sort by relevance
    if (mode === "emerging") {
      channels.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    } else if (mode === "escapees") {
      channels.sort((a, b) => b.growthVelocity - a.growthVelocity);
    } else {
      channels.sort((a, b) => b.maxVideoViews - a.maxVideoViews);
    }

    // Step 8: AI clustering (only in cluster mode)
    let clusters: any[] = [];
    if (mode === "cluster" && LOVABLE_API_KEY && channels.length >= 3) {
      try {
        const channelSummary = channels.slice(0, 20).map(ch =>
          `${ch.name} (${ch.subscribers} subs, ${ch.videoCount} vids, ${ch.avgViews} avg views, keywords: ${ch.keywords?.slice(0, 100)}). Top: ${ch.videos.slice(0, 2).map((v: any) => `"${v.title}"`).join(", ")}`
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
              { role: "system", content: "You are a YouTube niche analyst. Analyze these channels and group them into micro-niche clusters. Respond in Portuguese (BR)." },
              { role: "user", content: `Agrupe estes canais do nicho "${niche}" em micro-nichos:\n\n${channelSummary}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "channel_clusters",
                description: "Return channel clusters",
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
                          channelIds: { type: "array", items: { type: "string" } },
                          suggestedTopics: { type: "array", items: { type: "string" } },
                        },
                        required: ["name", "description", "opportunity", "channelIds", "suggestedTopics"],
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

    return new Response(JSON.stringify({
      channels: channels.slice(0, 30),
      clusters,
      meta: {
        mode,
        niche,
        country,
        totalFound: channels.length,
        emergingCount: channels.filter(ch => ch.isEmerging).length,
        escapeeCount: channels.filter(ch => ch.isAlgorithmEscapee).length,
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
