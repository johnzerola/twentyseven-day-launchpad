import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract YouTube channel/video ID from various URL formats
function parseYouTubeInput(input: string): { type: 'channel_id' | 'handle' | 'video' | 'query'; value: string } {
  const trimmed = input.trim();

  // youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
  const videoMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (videoMatch) return { type: 'video', value: videoMatch[1] };

  // youtube.com/channel/CHANNEL_ID
  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) return { type: 'channel_id', value: channelIdMatch[1] };

  // youtube.com/@handle
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };

  // Just @handle
  if (trimmed.startsWith('@')) return { type: 'handle', value: trimmed.slice(1) };

  // Raw channel ID
  if (trimmed.startsWith('UC') && trimmed.length >= 24 && !trimmed.includes(' ')) {
    return { type: 'channel_id', value: trimmed };
  }

  return { type: 'query', value: trimmed };
}

async function resolveHandle(handle: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`);
  const data = await res.json();
  return data.items?.[0]?.id || null;
}

async function getChannelInfo(channelId: string, apiKey: string) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`);
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;
  const subs = parseInt(ch.statistics.subscriberCount || '0');
  const totalViews = parseInt(ch.statistics.viewCount || '0');
  const videoCount = parseInt(ch.statistics.videoCount || '0');
  return {
    id: ch.id,
    name: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.medium?.url,
    subscribers: subs,
    totalViews,
    videoCount,
    avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
    description: ch.snippet.description?.slice(0, 200),
    country: ch.snippet.country || '',
    // TODO: monetization check via web scraping for 'is_monetization_enabled' in YouTube page source
    isMonetized: subs >= 1000 && totalViews >= 240000,
  };
}

async function getChannelVideos(channelId: string, apiKey: string, maxResults = 24) {
  // Get uploads playlist
  const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
  const chData = await chRes.json();
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];

  const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}&key=${apiKey}`);
  const plData = await plRes.json();
  if (!plData.items?.length) return [];

  const videoIds = plData.items.map((i: any) => i.contentDetails.videoId).join(',');
  const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${apiKey}`);
  const vData = await vRes.json();
  return vData.items || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, language, country, period, minViews, minLikes, minSubs, maxSubs } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!query?.trim()) throw new Error("Query is required");

    const parsed = parseYouTubeInput(query);
    let channelInfo: any = null;
    let videoItems: any[] = [];

    if (parsed.type === 'video') {
      // Fetch video + its channel
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${parsed.value}&key=${YOUTUBE_API_KEY}`);
      const vData = await vRes.json();
      if (vData.items?.length) {
        const video = vData.items[0];
        channelInfo = await getChannelInfo(video.snippet.channelId, YOUTUBE_API_KEY);
        // Get more videos from same channel
        videoItems = await getChannelVideos(video.snippet.channelId, YOUTUBE_API_KEY);
      }
    } else if (parsed.type === 'channel_id') {
      channelInfo = await getChannelInfo(parsed.value, YOUTUBE_API_KEY);
      if (channelInfo) videoItems = await getChannelVideos(parsed.value, YOUTUBE_API_KEY);
    } else if (parsed.type === 'handle') {
      const channelId = await resolveHandle(parsed.value, YOUTUBE_API_KEY);
      if (channelId) {
        channelInfo = await getChannelInfo(channelId, YOUTUBE_API_KEY);
        videoItems = await getChannelVideos(channelId, YOUTUBE_API_KEY);
      } else {
        throw new Error(`Canal @${parsed.value} não encontrado`);
      }
    } else {
      // Regular keyword search
      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(parsed.value)}&maxResults=24&order=viewCount&key=${YOUTUBE_API_KEY}`;
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
        return new Response(JSON.stringify({ results: [], channel: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const statsData = await statsRes.json();
      videoItems = statsData.items || [];
    }

    // Get channel stats for all videos
    const channelIds = [...new Set(videoItems.map((v: any) => v.snippet.channelId))] as string[];
    let channelMap: Record<string, any> = {};
    if (channelIds.length > 0) {
      const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`);
      const cData = await cRes.json();
      cData.items?.forEach((ch: any) => {
        channelMap[ch.id] = {
          subscribers: parseInt(ch.statistics.subscriberCount || '0'),
          totalViews: parseInt(ch.statistics.viewCount || '0'),
          videoCount: parseInt(ch.statistics.videoCount || '0'),
        };
      });
    }

    let videos = videoItems.map((v: any) => {
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

    // Apply filters
    if (minViews) videos = videos.filter((v: any) => v.views >= parseInt(minViews));
    if (minLikes) videos = videos.filter((v: any) => v.likes >= parseInt(minLikes));
    if (minSubs) videos = videos.filter((v: any) => v.subscribers >= parseInt(minSubs));
    if (maxSubs) videos = videos.filter((v: any) => v.subscribers <= parseInt(maxSubs));

    // Sort by views desc
    videos.sort((a: any, b: any) => b.views - a.views);

    return new Response(JSON.stringify({ results: videos, channel: channelInfo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-videos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
