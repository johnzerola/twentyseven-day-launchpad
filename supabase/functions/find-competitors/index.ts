import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelId, topVideoTitles, subscribers, country } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const regionCode = country || "US";
    const maxSubsThreshold = (subscribers || 100000) * 2;

    // Extract keywords from top video titles
    const stopWords = new Set(["the","a","an","is","it","to","of","in","for","on","at","and","or","but","with","this","that","how","why","what","who","do","does","did","are","was","were","be","been","have","has","had","will","would","can","could","should","may","might","must","de","da","do","dos","das","um","uma","no","na","nos","nas","por","para","com","como","que","se","não","mais","ou","em","o","e","os","as","é","el","la","los","las","un","una","del","en","con","por","es","que","se","su","al"]);
    
    const keywords = (topVideoTitles || [])
      .join(" ")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w: string) => w.length > 3 && !stopWords.has(w));

    // Get top 5 most frequent keywords
    const freq: Record<string, number> = {};
    for (const w of keywords) freq[w] = (freq[w] || 0) + 1;
    const topKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);

    if (topKeywords.length === 0) {
      return new Response(JSON.stringify({ competitors: [], keywords: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search YouTube for videos matching these keywords in the target country
    const searchQueries = [
      topKeywords.slice(0, 3).join(" "),
      topKeywords.slice(1, 4).join(" "),
    ];

    const channelMap: Record<string, {
      channelId: string;
      channelName: string;
      thumbnail: string;
      videoCount: number;
      topVideos: { title: string; views: number; videoId: string }[];
    }> = {};

    for (const query of searchQueries) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&regionCode=${regionCode}&maxResults=25&order=viewCount&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      if (!searchData.items) continue;

      for (const item of searchData.items) {
        const cId = item.snippet.channelId;
        if (cId === channelId) continue; // skip user's own channel
        if (!channelMap[cId]) {
          channelMap[cId] = {
            channelId: cId,
            channelName: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || "",
            videoCount: 0,
            topVideos: [],
          };
        }
        channelMap[cId].videoCount++;
        channelMap[cId].topVideos.push({
          title: item.snippet.title,
          views: 0, // will fill later
          videoId: item.id.videoId,
        });
      }
    }

    // Get video stats for top videos
    const allVideoIds = Object.values(channelMap)
      .flatMap(c => c.topVideos.map(v => v.videoId))
      .slice(0, 50);

    if (allVideoIds.length > 0) {
      // Batch in groups of 50
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${allVideoIds.join(",")}&key=${YOUTUBE_API_KEY}`
      );
      const vData = await vRes.json();
      const viewsMap: Record<string, number> = {};
      for (const v of (vData.items || [])) {
        viewsMap[v.id] = parseInt(v.statistics?.viewCount || "0");
      }
      // Apply views back
      for (const ch of Object.values(channelMap)) {
        for (const tv of ch.topVideos) {
          tv.views = viewsMap[tv.videoId] || 0;
        }
        ch.topVideos.sort((a, b) => b.views - a.views);
      }
    }

    // Get channel details for the discovered channels (batch)
    const discoveredIds = Object.keys(channelMap).slice(0, 25);
    const competitors: any[] = [];

    if (discoveredIds.length > 0) {
      const chRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${discoveredIds.join(",")}&key=${YOUTUBE_API_KEY}`
      );
      const chData = await chRes.json();

      for (const ch of (chData.items || [])) {
        const subs = parseInt(ch.statistics?.subscriberCount || "0");
        const totalViews = parseInt(ch.statistics?.viewCount || "0");
        const videoCount = parseInt(ch.statistics?.videoCount || "0");
        const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;

        // Filter: only channels smaller than threshold
        if (subs > maxSubsThreshold) continue;
        if (subs < 100) continue; // too small

        const entry = channelMap[ch.id];
        const bestVideo = entry?.topVideos[0];
        const multiplier = avgViews > 0 && bestVideo ? +(bestVideo.views / avgViews).toFixed(1) : 0;

        // Calculate growth indicator from best video vs avg
        let growthRate = "steady";
        if (multiplier >= 5) growthRate = "explosive";
        else if (multiplier >= 2) growthRate = "fast";

        competitors.push({
          channelId: ch.id,
          channelName: ch.snippet.title,
          thumbnail: ch.snippet.thumbnails?.medium?.url || "",
          subscribers: subs,
          totalViews,
          videoCount,
          avgViews,
          growthRate,
          multiplier,
          country: ch.snippet.country || regionCode,
          topVideos: (entry?.topVideos || []).slice(0, 3),
          relevanceScore: (entry?.videoCount || 0) * 10 + (multiplier > 1 ? 20 : 0) + (subs < subscribers ? 15 : 0),
        });
      }
    }

    // Sort by relevance
    competitors.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return new Response(JSON.stringify({
      competitors: competitors.slice(0, 15),
      keywords: topKeywords,
      searchedCountry: regionCode,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-competitors error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
