import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, language, country, period, minViews, minLikes, minSubs, maxSubs } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!query?.trim()) throw new Error("Query is required");

    // Build search URL
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=24&order=viewCount&key=${YOUTUBE_API_KEY}`;
    if (language) url += `&relevanceLanguage=${language}`;
    if (country) url += `&regionCode=${country}`;

    if (period) {
      const now = new Date();
      let publishedAfter = '';
      switch (period) {
        case 'today': publishedAfter = new Date(now.getTime() - 86400000).toISOString(); break;
        case 'week': publishedAfter = new Date(now.getTime() - 7 * 86400000).toISOString(); break;
        case 'month': publishedAfter = new Date(now.getTime() - 30 * 86400000).toISOString(); break;
        case 'year': publishedAfter = new Date(now.getTime() - 365 * 86400000).toISOString(); break;
      }
      if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;
    }

    const searchRes = await fetch(url);
    const searchData = await searchRes.json();
    if (searchData.error) throw new Error(searchData.error.message);
    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video stats
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    const statsData = await statsRes.json();

    // Get channel stats for outlier detection
    const channelIds = [...new Set(statsData.items?.map((v: any) => v.snippet.channelId) || [])] as string[];
    const channelStatsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`
    );
    const channelStatsData = await channelStatsRes.json();
    const channelMap: Record<string, any> = {};
    channelStatsData.items?.forEach((ch: any) => {
      channelMap[ch.id] = {
        subscribers: parseInt(ch.statistics.subscriberCount || '0'),
        totalViews: parseInt(ch.statistics.viewCount || '0'),
        videoCount: parseInt(ch.statistics.videoCount || '0'),
      };
    });

    let videos = (statsData.items || []).map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || '0');
      const likes = parseInt(v.statistics?.likeCount || '0');
      const chStats = channelMap[v.snippet.channelId];
      const avgViews = chStats ? Math.floor(chStats.totalViews / Math.max(chStats.videoCount, 1)) : 0;
      const subscribers = chStats?.subscribers || 0;

      return {
        id: v.id,
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        channelId: v.snippet.channelId,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
        views,
        likes,
        subscribers,
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails?.duration || '',
        isOutlier: views >= avgViews * 5,
        engagementRate: views > 0 ? ((likes / views) * 100).toFixed(2) : '0',
        viewsPerSub: subscribers > 0 ? (views / subscribers).toFixed(2) : '0',
      };
    });

    // Apply client-side filters
    if (minViews) videos = videos.filter((v: any) => v.views >= parseInt(minViews));
    if (minLikes) videos = videos.filter((v: any) => v.likes >= parseInt(minLikes));
    if (minSubs) videos = videos.filter((v: any) => v.subscribers >= parseInt(minSubs));
    if (maxSubs) videos = videos.filter((v: any) => v.subscribers <= parseInt(maxSubs));

    return new Response(JSON.stringify({ results: videos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-videos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
