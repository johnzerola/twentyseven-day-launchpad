import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseYouTubeInput(input: string): { type: 'channel_id' | 'handle' | 'video' | 'query'; value: string } {
  const trimmed = input.trim();
  const videoMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (videoMatch) return { type: 'video', value: videoMatch[1] };
  const channelIdMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) return { type: 'channel_id', value: channelIdMatch[1] };
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  if (trimmed.startsWith('@')) return { type: 'handle', value: trimmed.slice(1) };
  if (trimmed.startsWith('UC') && trimmed.length >= 24 && !trimmed.includes(' ')) return { type: 'channel_id', value: trimmed };
  return { type: 'query', value: trimmed };
}

function getYouTubeKeys(): string[] {
  return [
    Deno.env.get("YOUTUBE_API_KEY"),
    Deno.env.get("YOUTUBE_API_KEY_2"),
    Deno.env.get("YOUTUBE_API_KEY_3"),
    Deno.env.get("YOUTUBE_API_KEY_4"),
  ].filter(Boolean) as string[];
}

let _ytKeys: string[] = [];
let _currentKeyIndex = 0;

function getCurrentKey(): string {
  if (!_ytKeys.length) throw new Error("No YouTube API keys configured");
  return _ytKeys[_currentKeyIndex % _ytKeys.length];
}

function switchKey(): boolean {
  if (_ytKeys.length <= 1) return false;
  _currentKeyIndex = (_currentKeyIndex + 1) % _ytKeys.length;
  console.log(`Switched to YouTube API key #${_currentKeyIndex + 1}`);
  return true;
}

async function fetchJSON(url: string): Promise<any> {
  const tried = new Set<number>();
  while (tried.size < _ytKeys.length) {
    tried.add(_currentKeyIndex);
    const curUrl = url.replace(/key=[^&]+/, `key=${getCurrentKey()}`);
    const res = await fetch(curUrl);
    const data = await res.json();
    if (data.error) {
      const reason = data.error.errors?.[0]?.reason;
      if (reason === "quotaExceeded" && switchKey() && !tried.has(_currentKeyIndex)) {
        continue; // try next key
      }
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data;
  }
  throw new Error("All YouTube API keys have exceeded their quota. Please try again tomorrow.");
}

async function resolveHandle(handle: string, apiKey: string): Promise<string | null> {
  const data = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`);
  return data.items?.[0]?.id || null;
}

async function getChannelInfo(channelId: string, apiKey: string) {
  const data = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${apiKey}`);
  const ch = data.items?.[0];
  if (!ch) return null;
  const subs = parseInt(ch.statistics.subscriberCount || '0');
  const totalViews = parseInt(ch.statistics.viewCount || '0');
  const videoCount = parseInt(ch.statistics.videoCount || '0');
  return {
    id: ch.id, name: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.medium?.url,
    subscribers: subs, totalViews, videoCount,
    avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
    description: ch.snippet.description?.slice(0, 200),
    country: ch.snippet.country || '',
    isMonetized: subs >= 1000 && totalViews >= 240000,
  };
}

async function getChannelVideos(channelId: string, apiKey: string, maxResults = 24) {
  const chData = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];
  const plData = await fetchJSON(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}&key=${apiKey}`);
  if (!plData.items?.length) return [];
  const videoIds = plData.items.map((i: any) => i.contentDetails.videoId).join(',');
  const vData = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${apiKey}`);
  return vData.items || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, language, country, period, minViews, minLikes, minSubs, maxSubs, niche, searchType } = await req.json();
    _ytKeys = getYouTubeKeys();
    if (!_ytKeys.length) throw new Error("YOUTUBE_API_KEY not configured");
    const YOUTUBE_API_KEY = getCurrentKey();
    if (!query?.trim()) throw new Error("Query is required");

    const parsed = parseYouTubeInput(query);
    let channelInfo: any = null;
    let videoItems: any[] = [];

    if (parsed.type === 'video') {
      const vData = await fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${parsed.value}&key=${YOUTUBE_API_KEY}`);
      if (vData.items?.length) {
        const video = vData.items[0];
        channelInfo = await getChannelInfo(video.snippet.channelId, YOUTUBE_API_KEY);
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
      // Keyword search — do 2 searches for broader coverage
      const fullQuery = niche ? `${parsed.value} ${niche}` : parsed.value;
      
      const buildSearchUrl = (q: string, order: string) => {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=50&order=${order}&key=${YOUTUBE_API_KEY}`;
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
        return url;
      };

      // Two searches: viewCount + relevance for better coverage
      const [searchByViews, searchByRelevance] = await Promise.all([
        fetchJSON(buildSearchUrl(fullQuery, 'viewCount')),
        fetchJSON(buildSearchUrl(fullQuery, 'relevance')),
      ]);

      // Deduplicate
      const seenIds = new Set<string>();
      const allItems: any[] = [];
      for (const items of [searchByViews.items || [], searchByRelevance.items || []]) {
        for (const item of items) {
          const vid = item.id?.videoId;
          if (vid && !seenIds.has(vid)) { seenIds.add(vid); allItems.push(item); }
        }
      }

      if (!allItems.length) {
        return new Response(JSON.stringify({ results: [], channel: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get stats in batches
      const videoIds = allItems.map((item: any) => item.id.videoId);
      const statsBatches = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        statsBatches.push(fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.slice(i, i + 50).join(',')}&key=${YOUTUBE_API_KEY}`));
      }
      const statsResults = await Promise.all(statsBatches);
      videoItems = statsResults.flatMap(r => r.items || []);
    }

    // Get channel stats for all videos
    const channelIds = [...new Set(videoItems.map((v: any) => v.snippet.channelId))] as string[];
    let channelMap: Record<string, any> = {};
    if (channelIds.length > 0) {
      const batches = [];
      for (let i = 0; i < channelIds.length; i += 50) {
        batches.push(fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.slice(i, i + 50).join(',')}&key=${YOUTUBE_API_KEY}`));
      }
      const results = await Promise.all(batches);
      for (const cData of results) {
        cData.items?.forEach((ch: any) => {
          channelMap[ch.id] = {
            subscribers: parseInt(ch.statistics.subscriberCount || '0'),
            totalViews: parseInt(ch.statistics.viewCount || '0'),
            videoCount: parseInt(ch.statistics.videoCount || '0'),
          };
        });
      }
    }

    let videos = videoItems.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || '0');
      const likes = parseInt(v.statistics?.likeCount || '0');
      const chStats = channelMap[v.snippet.channelId];
      const avgViews = chStats ? Math.floor(chStats.totalViews / Math.max(chStats.videoCount, 1)) : 0;
      const subscribers = chStats?.subscribers || 0;
      return {
        id: v.id, title: v.snippet.title,
        channelTitle: v.snippet.channelTitle, channelId: v.snippet.channelId,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
        views, likes, subscribers,
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
