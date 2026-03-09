import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelInput } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    let channelId = channelInput.trim();
    const urlMatch = channelInput.match(/youtube\.com\/(channel\/|c\/|@)([^\/\?]+)/);
    if (urlMatch) {
      if (urlMatch[1] === 'channel/') {
        channelId = urlMatch[2];
      } else {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(urlMatch[2])}&maxResults=1&key=${YOUTUBE_API_KEY}`);
        const data = await res.json();
        channelId = data.items?.[0]?.snippet?.channelId || channelId;
      }
    } else if (channelInput.startsWith('@')) {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelInput)}&maxResults=1&key=${YOUTUBE_API_KEY}`);
      const data = await res.json();
      channelId = data.items?.[0]?.snippet?.channelId || channelId;
    }

    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`);
    const chData = await chRes.json();
    if (!chData.items?.length) {
      return new Response(JSON.stringify({ error: "Canal não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ch = chData.items[0];
    return new Response(JSON.stringify({
      channelId: ch.id,
      name: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url,
      subscribers: parseInt(ch.statistics.subscriberCount || '0'),
      views: parseInt(ch.statistics.viewCount || '0'),
      videos: parseInt(ch.statistics.videoCount || '0'),
      country: ch.snippet.country,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-channel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
