import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getKeys() {
  const k1 = Deno.env.get("YOUTUBE_API_KEY") || "";
  const k2 = Deno.env.get("YOUTUBE_API_KEY_2") || "";
  return [k1, k2].filter(Boolean);
}

async function ytFetch(url: string, keys: string[]): Promise<any> {
  let lastData: any = null;
  for (const key of keys) {
    const res = await fetch(url.replace("__KEY__", key));
    const data = await res.json();
    if (data.error?.errors?.[0]?.reason === "quotaExceeded") {
      console.log("Quota exceeded, trying next key...");
      lastData = data;
      continue;
    }
    return data;
  }
  // If we get here, return last response instead of throwing (might have useful data)
  if (lastData) {
    console.error("All keys quota exceeded");
    throw new Error("Quota da API do YouTube excedida. Tente novamente em alguns minutos.");
  }
  throw new Error("Nenhuma chave YouTube configurada");
}

async function resolveHandle(handle: string, keys: string[]): Promise<string | null> {
  // Try forHandle first
  const data = await ytFetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=__KEY__`,
    keys
  );
  if (data.items?.length) return data.items[0].id;

  // Fallback: search API
  console.log(`forHandle failed for "${handle}", trying search fallback...`);
  const searchData = await ytFetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent("@" + handle)}&maxResults=1&key=__KEY__`,
    keys
  );
  return searchData.items?.[0]?.snippet?.channelId || null;
}

function formatChannel(ch: any) {
  return {
    channelId: ch.id,
    name: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails?.medium?.url,
    subscribers: parseInt(ch.statistics?.subscriberCount || '0'),
    views: parseInt(ch.statistics?.viewCount || '0'),
    videos: parseInt(ch.statistics?.videoCount || '0'),
    country: ch.snippet.country,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelInput } = await req.json();
    const keys = getKeys();
    if (!keys.length) throw new Error("YOUTUBE_API_KEY not configured");

    let input = channelInput.trim();
    let channelId: string | null = null;

    // Extract from URL
    const urlMatch = input.match(/youtube\.com\/(channel\/|c\/|@)([^\/\?\s]+)/);
    if (urlMatch) {
      if (urlMatch[1] === 'channel/') {
        channelId = urlMatch[2];
      } else {
        const handle = urlMatch[2].replace(/^@/, '');
        channelId = await resolveHandle(handle, keys);
      }
    } else if (input.startsWith('@')) {
      const handle = input.slice(1).trim();
      channelId = await resolveHandle(handle, keys);
    } else if (/^UC[\w-]{22}$/.test(input)) {
      channelId = input;
    } else {
      // Treat as search query
      const searchData = await ytFetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(input)}&maxResults=1&key=__KEY__`,
        keys
      );
      channelId = searchData.items?.[0]?.snippet?.channelId || null;
    }

    if (!channelId) {
      return new Response(JSON.stringify({ error: "Canal não encontrado. Verifique o link ou nome do canal." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chData = await ytFetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=__KEY__`,
      keys
    );
    if (!chData.items?.length) {
      return new Response(JSON.stringify({ error: "Canal não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(formatChannel(chData.items[0])), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-channel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
