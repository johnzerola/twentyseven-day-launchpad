import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keywords, maxResults = 50, minMultiplier = 5, maxSubs = 50000, minSubs = 500, publishedAfterDays = 30 } = await req.json();
    
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const publishedAfter = new Date(Date.now() - publishedAfterDays * 86400000).toISOString();
    
    // Search for viral videos in the niche
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keywords)}&type=video&publishedAfter=${publishedAfter}&order=viewCount&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ outliers: [], total_searched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video statistics
    const videoIds = searchData.items.map((v: any) => v.id.videoId).filter(Boolean).join(",");
    const videoStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videoStatsRes = await fetch(videoStatsUrl);
    const videoStatsData = await videoStatsRes.json();
    
    const videoViewsMap = new Map<string, number>();
    for (const v of videoStatsData.items || []) {
      videoViewsMap.set(v.id, parseInt(v.statistics.viewCount || "0"));
    }

    // Get unique channel IDs
    const channelIds = [...new Set(searchData.items.map((v: any) => v.snippet.channelId))];
    
    // Batch fetch channel stats (max 50 per request)
    const channelStatsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds.join(",")}&key=${YOUTUBE_API_KEY}`;
    const channelStatsRes = await fetch(channelStatsUrl);
    const channelStatsData = await channelStatsRes.json();
    
    const channelMap = new Map<string, { subs: number; name: string; thumbnail: string }>();
    for (const ch of channelStatsData.items || []) {
      channelMap.set(ch.id, {
        subs: parseInt(ch.statistics.subscriberCount || "0"),
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.default?.url || "",
      });
    }

    // Find outliers: small channels with viral videos
    const outliers: any[] = [];
    for (const video of searchData.items) {
      const channelId = video.snippet.channelId;
      const videoId = video.id.videoId;
      const channel = channelMap.get(channelId);
      const views = videoViewsMap.get(videoId) || 0;
      
      if (!channel) continue;
      
      const { subs, name, thumbnail } = channel;
      if (subs < minSubs || subs > maxSubs) continue;
      
      const multiplier = subs > 0 ? views / subs : 0;
      if (multiplier < minMultiplier) continue;
      
      outliers.push({
        video_title: video.snippet.title,
        video_url: `https://youtube.com/watch?v=${videoId}`,
        channel_name: name,
        channel_id: channelId,
        subscribers: subs,
        views,
        multiplier: Math.round(multiplier * 100) / 100,
        niche: keywords,
        thumbnail_url: video.snippet.thumbnails?.high?.url || thumbnail,
        published_at: video.snippet.publishedAt,
      });
    }

    // Sort by multiplier (most viral relative to size)
    outliers.sort((a, b) => b.multiplier - a.multiplier);

    // Save to DB if user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: claims } = await sb.auth.getUser();
        if (claims?.user?.id && outliers.length > 0) {
          const rows = outliers.slice(0, 20).map(o => ({
            user_id: claims.user!.id,
            video_title: o.video_title,
            video_url: o.video_url,
            channel_name: o.channel_name,
            channel_id: o.channel_id,
            subscribers: o.subscribers,
            views: o.views,
            multiplier: o.multiplier,
            niche: o.niche,
            thumbnail_url: o.thumbnail_url,
            published_at: o.published_at,
          }));
          await sb.from("outlier_channels").insert(rows);
        }
      } catch (e) {
        console.error("Error saving outliers:", e);
      }
    }

    return new Response(JSON.stringify({ 
      outliers: outliers.slice(0, 20), 
      total_searched: searchData.items.length,
      total_outliers: outliers.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-outliers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
