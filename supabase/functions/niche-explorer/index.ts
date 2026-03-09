import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Average RPM by country (USD)
const RPM_BY_COUNTRY: Record<string, number> = {
  US: 7.5, GB: 6.0, DE: 5.5, AU: 6.5, CA: 6.0,
  BR: 1.5, PT: 3.0, PL: 2.5, ES: 3.0, FR: 4.0,
  IN: 0.5, JP: 4.5, KR: 3.5, IT: 3.5, MX: 1.0,
};

// RPM multiplier by niche
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
    const { niche, country, language, maxResults } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const limit = Math.min(maxResults || 50, 50);

    // Search trending videos in this niche
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(niche || 'trending')}&maxResults=${limit}&order=viewCount&key=${YOUTUBE_API_KEY}`;
    if (country) searchUrl += `&regionCode=${country}`;
    if (language) searchUrl += `&relevanceLanguage=${language}`;
    // Last 30 days
    searchUrl += `&publishedAfter=${new Date(Date.now() - 30 * 86400000).toISOString()}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.error) throw new Error(searchData.error.message);

    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ channels: [], trending: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video stats
    const videoIds = searchData.items.map((i: any) => i.id.videoId).join(',');
    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
    const vData = await vRes.json();

    // Get channel stats
    const channelIds = [...new Set(vData.items?.map((v: any) => v.snippet.channelId) || [])] as string[];
    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`);
    const cData = await cRes.json();

    const chMap: Record<string, any> = {};
    cData.items?.forEach((ch: any) => {
      const subs = parseInt(ch.statistics.subscriberCount || '0');
      const totalViews = parseInt(ch.statistics.viewCount || '0');
      const videoCount = parseInt(ch.statistics.videoCount || '0');
      chMap[ch.id] = {
        id: ch.id,
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.medium?.url,
        subscribers: subs,
        totalViews,
        videoCount,
        avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
        country: ch.snippet.country || '',
      };
    });

    // Build trending videos with metrics
    const trending = (vData.items || []).map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || '0');
      const likes = parseInt(v.statistics?.likeCount || '0');
      const ch = chMap[v.snippet.channelId];
      const publishedMs = new Date(v.snippet.publishedAt).getTime();
      const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);

      return {
        id: v.id,
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        thumbnail: v.snippet.thumbnails?.medium?.url,
        views,
        likes,
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails?.duration || '',
        vph: Math.round(views / hoursAge),
        engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
        viewsPerSub: ch?.subscribers > 0 ? parseFloat((views / ch.subscribers).toFixed(2)) : 0,
        isOutlier: ch ? views >= ch.avgViews * 5 : false,
        channelSubs: ch?.subscribers || 0,
      };
    });

    // Group by channel and compute viral scores
    const channelGroups: Record<string, any[]> = {};
    trending.forEach((v: any) => {
      if (!channelGroups[v.channelId]) channelGroups[v.channelId] = [];
      channelGroups[v.channelId].push(v);
    });

    const baseRpm = RPM_BY_COUNTRY[country || 'BR'] || 1.5;
    const nicheKey = (niche || '').toLowerCase();
    const nicheMult = Object.entries(RPM_BY_NICHE).find(([k]) => nicheKey.includes(k))?.[1] || 1.0;
    const estimatedRpm = parseFloat((baseRpm * nicheMult).toFixed(2));

    const channels = Object.entries(channelGroups).map(([chId, videos]) => {
      const ch = chMap[chId];
      if (!ch) return null;
      const outlierCount = videos.filter((v: any) => v.isOutlier).length;
      const avgEngagement = videos.reduce((s: number, v: any) => s + v.engagementRate, 0) / videos.length;
      const avgVph = videos.reduce((s: number, v: any) => s + v.vph, 0) / videos.length;

      // Viral score: composite of outliers, engagement, VPH, views/sub
      const viralScore = Math.min(100, Math.round(
        (outlierCount * 20) +
        (avgEngagement * 5) +
        (Math.min(avgVph, 1000) / 10) +
        (ch.subscribers < 10000 ? 20 : ch.subscribers < 100000 ? 10 : 0)
      ));

      // Monetization check heuristic
      const isMonetized = ch.subscribers >= 1000 && ch.totalViews >= 4000 * 60;

      return {
        ...ch,
        outlierCount,
        avgEngagement: parseFloat(avgEngagement.toFixed(2)),
        avgVph: Math.round(avgVph),
        viralScore,
        isMonetized,
        estimatedRpm,
        estimatedMonthlyRevenue: Math.round((ch.avgViews * ch.videoCount * estimatedRpm) / 1000 / 12),
        videos: videos.slice(0, 3),
      };
    }).filter(Boolean).sort((a: any, b: any) => b.viralScore - a.viralScore);

    // Use AI to detect faceless-friendly niches and add insights
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `Given these YouTube channel names and their top video titles in the "${niche}" niche, classify each as "faceless" (no face on camera) or "camera" (person on camera). Return JSON array: [{"channelId":"...","faceless":true/false}]\n\nChannels:\n${channels.slice(0, 10).map((c: any) => `- ${c.name} (${c.id}): ${c.videos.map((v: any) => v.title).join(', ')}`).join('\n')}`
        }],
        tools: [{
          type: "function",
          function: {
            name: "classify_channels",
            description: "Classify channels as faceless or camera",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      channelId: { type: "string" },
                      faceless: { type: "boolean" }
                    },
                    required: ["channelId", "faceless"]
                  }
                }
              },
              required: ["classifications"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_channels" } }
      }),
    });

    if (aiRes.ok) {
      try {
        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const { classifications } = JSON.parse(toolCall.function.arguments);
        classifications.forEach((c: any) => {
          const ch = channels.find((ch: any) => ch?.id === c.channelId);
          if (ch) (ch as any).faceless = c.faceless;
        });
      } catch { /* ignore AI parse errors */ }
    }

    return new Response(JSON.stringify({
      channels,
      trending: trending.slice(0, 20),
      estimatedRpm,
      nicheInfo: { niche, country: country || 'BR', baseRpm, nicheMult },
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
