import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const { script_id, youtube_url } = await req.json();
    if (!youtube_url) throw new Error("youtube_url is required");

    // Extract video ID
    const videoIdMatch = youtube_url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    const youtubeVideoId = videoIdMatch?.[1];
    if (!youtubeVideoId) throw new Error("Invalid YouTube URL");

    // Try to get video info via YouTube API
    const ytKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean);

    let videoTitle = null;
    let publishedAt = null;
    let views = null;
    let likes = null;
    let comments = null;

    for (const key of ytKeys) {
      try {
        const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${youtubeVideoId}&key=${key}`);
        const data = await resp.json();
        if (data.error?.errors?.[0]?.reason === "quotaExceeded") continue;
        if (data.items?.length > 0) {
          const v = data.items[0];
          videoTitle = v.snippet?.title;
          publishedAt = v.snippet?.publishedAt;
          views = parseInt(v.statistics?.viewCount || "0");
          likes = parseInt(v.statistics?.likeCount || "0");
          comments = parseInt(v.statistics?.commentCount || "0");
          break;
        }
      } catch { continue; }
    }

    // Create the link
    const { data: link, error: insertError } = await sb.from("script_performance_link").upsert({
      user_id: userId,
      script_id: script_id || null,
      youtube_video_id: youtubeVideoId,
      video_title: videoTitle,
      published_at: publishedAt,
      views_48h: views, // Initial snapshot
      likes,
      comments,
    }, { onConflict: "user_id,youtube_video_id" }).select().single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      success: true,
      link_id: link?.id,
      youtube_video_id: youtubeVideoId,
      video_title: videoTitle,
      initial_views: views,
      message: "Video linked. Metrics will be synced automatically.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("link-script-to-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
