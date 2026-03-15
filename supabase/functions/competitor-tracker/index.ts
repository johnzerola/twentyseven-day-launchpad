import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchYouTube(query: string, apiKey: string, maxResults = 10): Promise<any[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=${maxResults}&q=${encodeURIComponent(query)}&publishedAfter=${new Date(Date.now() - 7 * 86400000).toISOString()}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.items || [];
}

async function getVideoStats(videoIds: string[], apiKey: string): Promise<any[]> {
  if (!videoIds.length) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.items || [];
}

async function getChannelStats(channelIds: string[], apiKey: string): Promise<any[]> {
  if (!channelIds.length) return [];
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.items || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, user_id, channel_id } = await req.json().catch(() => ({}));

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get YouTube API keys (rotate)
    const ytKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean) as string[];

    if (!ytKeys.length) throw new Error("No YouTube API keys configured");
    const ytKey = ytKeys[Math.floor(Math.random() * ytKeys.length)];

    // Determine niche to track
    let targetNiche = niche;
    if (!targetNiche && channel_id) {
      const { data: channel } = await sb.from("user_channels").select("niche").eq("id", channel_id).maybeSingle();
      targetNiche = channel?.niche;
    }
    if (!targetNiche) {
      // Get most common niche from user's channels
      const { data: channels } = await sb.from("user_channels").select("niche").eq("user_id", user_id).limit(5);
      if (channels?.length) {
        const nicheCount: Record<string, number> = {};
        channels.forEach((c: any) => { if (c.niche) nicheCount[c.niche] = (nicheCount[c.niche] || 0) + 1; });
        targetNiche = Object.entries(nicheCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "general";
      }
    }

    if (!targetNiche) {
      return new Response(JSON.stringify({ error: "No niche specified" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search for recent viral videos in this niche
    const searchResults = await searchYouTube(`${targetNiche} 2026`, ytKey, 15);
    if (!searchResults.length) {
      return new Response(JSON.stringify({ success: true, competitors: [], alerts: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const videoIds = searchResults.map((r: any) => r.id?.videoId).filter(Boolean);
    const channelIds = [...new Set(searchResults.map((r: any) => r.snippet?.channelId).filter(Boolean))];

    // Get detailed stats
    const [videoStats, channelStats] = await Promise.all([
      getVideoStats(videoIds, ytKey),
      getChannelStats(channelIds as string[], ytKey),
    ]);

    const channelSubsMap: Record<string, number> = {};
    channelStats.forEach((c: any) => {
      channelSubsMap[c.id] = parseInt(c.statistics?.subscriberCount || "0");
    });

    // Build competitor analysis
    const competitors = videoStats.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const comments = parseInt(v.statistics?.commentCount || "0");
      const channelId = v.snippet?.channelId;
      const subs = channelSubsMap[channelId] || 0;
      const multiplier = subs > 0 ? Math.round(views / subs * 100) / 100 : 0;
      const publishedAt = v.snippet?.publishedAt;
      const hoursAgo = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / 3600000 : 999;
      const viewsPerHour = hoursAgo > 0 ? Math.round(views / hoursAgo) : 0;

      return {
        video_id: v.id,
        title: v.snippet?.title,
        channel_name: v.snippet?.channelTitle,
        channel_id: channelId,
        views,
        likes,
        comments,
        subscribers: subs,
        multiplier,
        views_per_hour: viewsPerHour,
        published_at: publishedAt,
        thumbnail: v.snippet?.thumbnails?.high?.url,
        engagement_rate: views > 0 ? Math.round((likes + comments) / views * 10000) / 100 : 0,
        is_outlier: multiplier > 3,
        is_trending: viewsPerHour > 500,
      };
    }).sort((a: any, b: any) => b.views_per_hour - a.views_per_hour);

    // Generate alerts for outlier/trending videos
    const alerts = competitors
      .filter((c: any) => c.is_outlier || c.is_trending)
      .slice(0, 5)
      .map((c: any) => ({
        type: c.is_trending ? "trending" : "outlier",
        title: c.title,
        channel: c.channel_name,
        views: c.views,
        multiplier: c.multiplier,
        views_per_hour: c.views_per_hour,
        video_id: c.video_id,
        message: c.is_trending
          ? `🔥 "${c.title}" está em alta com ${c.views_per_hour} views/hora!`
          : `⚡ "${c.title}" é um outlier com ${c.multiplier}x o tamanho do canal!`,
      }));

    // Save trending videos to emerging_videos for future reference
    for (const alert of alerts) {
      const comp = competitors.find((c: any) => c.video_id === alert.video_id);
      if (!comp) continue;
      await sb.from("emerging_videos").upsert({
        video_id: comp.video_id,
        title: comp.title,
        channel_id: comp.channel_id,
        channel_name: comp.channel_name,
        views: comp.views,
        likes: comp.likes,
        comments: comp.comments,
        subscribers: comp.subscribers,
        views_per_hour: comp.views_per_hour,
        engagement_rate: comp.engagement_rate,
        view_ratio: comp.multiplier,
        niche: targetNiche,
        status: comp.is_trending ? "trending" : "outlier",
        published_at: comp.published_at,
        thumbnail_url: comp.thumbnail,
      }, { onConflict: "video_id" });
    }

    return new Response(JSON.stringify({
      success: true,
      niche: targetNiche,
      total_analyzed: competitors.length,
      competitors: competitors.slice(0, 15),
      alerts,
      summary: {
        avg_views: Math.round(competitors.reduce((s: number, c: any) => s + c.views, 0) / competitors.length),
        avg_engagement: Math.round(competitors.reduce((s: number, c: any) => s + c.engagement_rate, 0) / competitors.length * 100) / 100,
        outlier_count: competitors.filter((c: any) => c.is_outlier).length,
        trending_count: competitors.filter((c: any) => c.is_trending).length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("competitor-tracker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
