import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// YouTube API helper with key rotation
async function ytFetch(path: string, params: Record<string, string>) {
  const keys = [
    Deno.env.get("YOUTUBE_API_KEY"),
    Deno.env.get("YOUTUBE_API_KEY_2"),
    Deno.env.get("YOUTUBE_API_KEY_3"),
    Deno.env.get("YOUTUBE_API_KEY_4"),
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    url.searchParams.set("key", key);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (res.ok) return res.json();
    if (res.status === 403) continue; // quota exceeded, try next key
    const t = await res.text();
    console.error(`YouTube API error ${res.status}:`, t);
    throw new Error(`YouTube API ${res.status}`);
  }
  throw new Error("All YouTube API keys exhausted");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, language, country, maxSubs, minViews, maxResults, mode, seedVideoIds } = await req.json();
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const targetMaxSubs = maxSubs || 50000;
    const targetMinViews = minViews || 100000;
    const targetMaxResults = Math.min(maxResults || 20, 50);

    // ═══════════════════════════════════════════════════════════════
    // MODE: "chain" — Incognito Simulator via relatedToVideoId chains
    // ═══════════════════════════════════════════════════════════════
    if (mode === "chain") {
      console.log(`[DISCOVER-CHAIN] Starting chain discovery from ${(seedVideoIds || []).length} seed videos`);

      // Step 1: Get seed videos (from param or from DB top viral videos)
      let seeds: string[] = seedVideoIds || [];
      if (seeds.length === 0) {
        // Auto-seed from our top viral content_dna videos
        const { data: topViral } = await sb.from("content_dna")
          .select("video_id")
          .gte("viral_score", 8)
          .order("views", { ascending: false })
          .limit(5);
        seeds = (topViral || []).map((v: any) => v.video_id).filter(Boolean);
      }
      if (seeds.length === 0) {
        // Fallback: search for a viral video in the niche
        try {
          const searchData = await ytFetch("search", {
            part: "snippet",
            q: `${niche || 'dark storytelling'} viral`,
            type: "video",
            maxResults: "3",
            order: "viewCount",
            videoDuration: "medium",
          });
          seeds = (searchData.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
        } catch (e) { console.warn("Seed search failed:", e); }
      }

      if (seeds.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No seed videos found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Chain discovery — follow relatedToVideoId up to 3 hops
      const discoveredChannelIds = new Set<string>();
      const relatedVideos: any[] = [];
      const maxHops = 3;
      let currentSeeds = seeds.slice(0, 3); // Start with max 3 seeds

      for (let hop = 0; hop < maxHops; hop++) {
        const nextSeeds: string[] = [];
        for (const seedId of currentSeeds) {
          try {
            const related = await ytFetch("search", {
              part: "snippet",
              relatedToVideoId: seedId,
              type: "video",
              maxResults: "10",
            });
            for (const item of (related.items || [])) {
              const vid = item.id?.videoId;
              const chId = item.snippet?.channelId;
              if (vid && chId && !discoveredChannelIds.has(chId)) {
                discoveredChannelIds.add(chId);
                relatedVideos.push({
                  videoId: vid,
                  channelId: chId,
                  channelTitle: item.snippet?.channelTitle,
                  title: item.snippet?.title,
                  hop,
                });
                if (hop < maxHops - 1) nextSeeds.push(vid);
              }
            }
          } catch (e) { console.warn(`Related search failed for ${seedId}:`, e); }
        }
        // Pick best 3 from this hop for next round
        currentSeeds = nextSeeds.slice(0, 3);
        if (currentSeeds.length === 0) break;
      }

      console.log(`[DISCOVER-CHAIN] Found ${discoveredChannelIds.size} unique channels across ${maxHops} hops`);

      // Step 3: Filter by subscriber count (small channels only)
      const channelIdArr = Array.from(discoveredChannelIds);
      const smallChannels = new Map<string, any>();

      for (let i = 0; i < channelIdArr.length; i += 50) {
        const batch = channelIdArr.slice(i, i + 50);
        try {
          const chData = await ytFetch("channels", {
            part: "snippet,statistics",
            id: batch.join(","),
          });
          for (const ch of (chData.items || [])) {
            const subs = parseInt(ch.statistics?.subscriberCount || "0");
            const totalViews = parseInt(ch.statistics?.viewCount || "0");
            const videoCount = parseInt(ch.statistics?.videoCount || "0");
            if (subs > 0 && subs <= targetMaxSubs && videoCount >= 3) {
              smallChannels.set(ch.id, {
                channelId: ch.id,
                channelName: ch.snippet?.title,
                subscribers: subs,
                totalViews,
                videoCount,
                avgViews: videoCount > 0 ? Math.round(totalViews / videoCount) : 0,
                country: ch.snippet?.country || country || "Unknown",
                language: language || "auto",
              });
            }
          }
        } catch (e) { console.warn("Channel batch failed:", e); }
      }

      // Step 4: Get top videos for small channels, calculate multiplier
      const chainResults: any[] = [];
      for (const [chId, chInfo] of smallChannels) {
        try {
          const vidData = await ytFetch("search", {
            part: "snippet",
            channelId: chId,
            type: "video",
            order: "viewCount",
            maxResults: "3",
          });
          const videoIds = (vidData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
          if (videoIds.length === 0) continue;

          const statsData = await ytFetch("videos", {
            part: "statistics,contentDetails",
            id: videoIds.join(","),
          });
          let maxVideoViews = 0;
          const topVideos: any[] = [];
          for (const v of (statsData.items || [])) {
            const views = parseInt(v.statistics?.viewCount || "0");
            if (views > maxVideoViews) maxVideoViews = views;
            const matchSnip = (vidData.items || []).find((s: any) => s.id?.videoId === v.id);
            topVideos.push({ videoId: v.id, title: matchSnip?.snippet?.title, views, duration: v.contentDetails?.duration });
          }
          const multiplier = chInfo.subscribers > 0 ? maxVideoViews / chInfo.subscribers : 0;
          if (maxVideoViews >= targetMinViews || multiplier >= 5) {
            chainResults.push({
              ...chInfo,
              multiplier: Math.round(multiplier * 10) / 10,
              maxVideoViews,
              topVideos: topVideos.sort((a: any, b: any) => b.views - a.views),
              niche: niche || "unknown",
              discoveryMethod: "chain",
              discoveryScore: Math.round(
                (Math.min(multiplier, 100) * 0.4) +
                (Math.min(maxVideoViews / 1000000 * 100, 100) * 0.3) +
                (chInfo.videoCount < 50 ? 80 : 40) * 0.3
              ),
            });
          }
        } catch (e) { console.warn(`Chain channel ${chId} failed:`, e); }
      }

      chainResults.sort((a, b) => b.discoveryScore - a.discoveryScore);
      const finalChain = chainResults.slice(0, targetMaxResults);

      // Save to DB
      let savedCount = 0;
      for (const ch of finalChain) {
        const { data: existing } = await sb.from("channel_intelligence")
          .select("id").eq("youtube_channel_id", ch.channelId).maybeSingle();
        if (!existing) {
          const { error } = await sb.from("channel_intelligence").insert({
            youtube_channel_id: ch.channelId,
            channel_name: ch.channelName,
            niche: ch.niche,
            subscribers: ch.subscribers,
            avg_views: ch.avgViews,
            country: ch.country,
            language: ch.language,
            is_faceless: true,
            is_monetized: ch.subscribers >= 1000,
            growth_rate: ch.multiplier >= 10 ? "explosive" : ch.multiplier >= 5 ? "fast" : "moderate",
            style: "dark_storytelling",
            top_videos: ch.topVideos,
            viral_patterns: { max_multiplier: ch.multiplier, discovery_score: ch.discoveryScore, discovered_via: "chain-discovery-v4" },
            content_category: "dark_storytelling",
          });
          if (!error) savedCount++;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        mode: "chain",
        channels: finalChain,
        seedsUsed: seeds.length,
        totalDiscovered: discoveredChannelIds.size,
        totalSmall: smallChannels.size,
        totalViral: finalChain.length,
        savedToDb: savedCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // MODE: default — keyword-based search (existing logic)
    // ═══════════════════════════════════════════════════════════════

    // Step 1: Generate smart search queries using AI
    let searchQueries: string[] = [];
    if (LOVABLE_API_KEY && niche) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Generate 6 YouTube search queries to find SMALL channels (<${targetMaxSubs} subscribers) with VIRAL videos (100K+ views) in the "${niche}" niche. Language: ${language || 'any'}. Country: ${country || 'any'}.

Requirements:
- Queries should find HIDDEN GEMS, not established channels
- Include niche-specific terms that small creators use
- Mix broad and specific queries
- Include queries that find "dark" faceless channels (storytelling, narration, no face)
- Include trending sub-topics within the niche

Return ONLY a JSON array of 6 strings, nothing else. Example: ["query1", "query2", ...]`
            }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData.choices?.[0]?.message?.content || '[]';
          const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          searchQueries = JSON.parse(cleaned);
        }
      } catch (e) { console.warn("AI query gen failed:", e); }
    }

    // Fallback queries
    if (searchQueries.length === 0) {
      const nicheLC = (niche || 'storytelling').toLowerCase();
      searchQueries = [
        `${nicheLC} story narration`,
        `${nicheLC} explained dark`,
        `${nicheLC} true story`,
        `${nicheLC} faceless channel`,
        `dark ${nicheLC} documentary`,
        `${nicheLC} viral shorts`,
      ];
    }

    console.log(`[DISCOVER] Searching with ${searchQueries.length} queries for niche="${niche}"`);

    // Step 2: Search YouTube for videos with high views
    const videoMap = new Map<string, any>();
    const channelIds = new Set<string>();

    for (const query of searchQueries.slice(0, 6)) {
      try {
        const searchData = await ytFetch("search", {
          part: "snippet",
          q: query,
          type: "video",
          maxResults: "15",
          order: "viewCount",
          relevanceLanguage: language || "en",
          regionCode: country || "US",
          videoDuration: "medium", // 4-20min
        });

        for (const item of (searchData.items || [])) {
          const vid = item.id?.videoId;
          const chId = item.snippet?.channelId;
          if (vid && chId && !videoMap.has(vid)) {
            videoMap.set(vid, {
              videoId: vid,
              channelId: chId,
              channelTitle: item.snippet?.channelTitle,
              title: item.snippet?.title,
              publishedAt: item.snippet?.publishedAt,
            });
            channelIds.add(chId);
          }
        }
      } catch (e) { console.warn(`Search query failed: ${query}`, e); }
    }

    if (channelIds.size === 0) {
      return new Response(JSON.stringify({ channels: [], message: "No channels found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Get channel statistics (filter by subscriber count)
    const channelIdArr = Array.from(channelIds);
    const smallChannels = new Map<string, any>();

    for (let i = 0; i < channelIdArr.length; i += 50) {
      const batch = channelIdArr.slice(i, i + 50);
      try {
        const chData = await ytFetch("channels", {
          part: "snippet,statistics,brandingSettings",
          id: batch.join(","),
        });

        for (const ch of (chData.items || [])) {
          const subs = parseInt(ch.statistics?.subscriberCount || "0");
          const totalViews = parseInt(ch.statistics?.viewCount || "0");
          const videoCount = parseInt(ch.statistics?.videoCount || "0");

          if (subs > 0 && subs <= targetMaxSubs && videoCount >= 3) {
            const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
            smallChannels.set(ch.id, {
              channelId: ch.id,
              channelName: ch.snippet?.title,
              description: ch.snippet?.description?.slice(0, 200),
              subscribers: subs,
              totalViews,
              videoCount,
              avgViews,
              country: ch.snippet?.country || country || "Unknown",
              language: language || "auto",
              thumbnailUrl: ch.snippet?.thumbnails?.medium?.url,
            });
          }
        }
      } catch (e) { console.warn("Channel batch failed:", e); }
    }

    // Step 4: Get top videos from small channels to find outliers
    const discoveredChannels: any[] = [];

    for (const [chId, chInfo] of smallChannels) {
      try {
        // Get most popular videos
        const vidData = await ytFetch("search", {
          part: "snippet",
          channelId: chId,
          type: "video",
          order: "viewCount",
          maxResults: "5",
        });

        const videoIds = (vidData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);
        if (videoIds.length === 0) continue;

        // Get video statistics
        const statsData = await ytFetch("videos", {
          part: "statistics,contentDetails",
          id: videoIds.join(","),
        });

        const topVideos: any[] = [];
        let maxVideoViews = 0;

        for (const v of (statsData.items || [])) {
          const views = parseInt(v.statistics?.viewCount || "0");
          const likes = parseInt(v.statistics?.likeCount || "0");
          if (views > maxVideoViews) maxVideoViews = views;

          const matchingSnippet = (vidData.items || []).find((s: any) => s.id?.videoId === v.id);
          topVideos.push({
            videoId: v.id,
            title: matchingSnippet?.snippet?.title || "Unknown",
            views,
            likes,
            duration: v.contentDetails?.duration,
            publishedAt: matchingSnippet?.snippet?.publishedAt,
          });
        }

        // Calculate viral multiplier (top video views / subscribers)
        const multiplier = chInfo.subscribers > 0 ? maxVideoViews / chInfo.subscribers : 0;

        if (maxVideoViews >= targetMinViews || multiplier >= 5) {
          discoveredChannels.push({
            ...chInfo,
            multiplier: Math.round(multiplier * 10) / 10,
            maxVideoViews,
            topVideos: topVideos.sort((a: any, b: any) => b.views - a.views).slice(0, 3),
            niche: niche || "unknown",
            discoveryScore: Math.round(
              (Math.min(multiplier, 100) * 0.4) +
              (Math.min(maxVideoViews / 1000000 * 100, 100) * 0.3) +
              (Math.min(topVideos.length * 20, 100) * 0.15) +
              (chInfo.videoCount < 50 ? 80 : chInfo.videoCount < 100 ? 60 : 40) * 0.15
            ),
          });
        }
      } catch (e) { console.warn(`Channel ${chId} video scan failed:`, e); }
    }

    // Sort by discovery score
    discoveredChannels.sort((a, b) => b.discoveryScore - a.discoveryScore);
    const finalChannels = discoveredChannels.slice(0, targetMaxResults);

    // Step 5: Save to channel_intelligence (those not already there)
    let savedCount = 0;
    for (const ch of finalChannels) {
      const { data: existing } = await sb.from("channel_intelligence")
        .select("id").eq("youtube_channel_id", ch.channelId).maybeSingle();

      if (!existing) {
        const { error } = await sb.from("channel_intelligence").insert({
          youtube_channel_id: ch.channelId,
          channel_name: ch.channelName,
          niche: ch.niche,
          subscribers: ch.subscribers,
          avg_views: ch.avgViews,
          country: ch.country,
          language: ch.language,
          is_faceless: true, // Assume faceless for discovery
          is_monetized: ch.subscribers >= 1000,
          growth_rate: ch.multiplier >= 10 ? "explosive" : ch.multiplier >= 5 ? "fast" : "moderate",
          style: "dark_storytelling",
          top_videos: ch.topVideos,
          viral_patterns: {
            max_multiplier: ch.multiplier,
            discovery_score: ch.discoveryScore,
            discovered_via: "discover-viral-channels-v4",
          },
          content_category: "dark_storytelling",
        });
        if (!error) savedCount++;
      }
    }

    // Step 6: AI analysis of patterns found
    let aiInsights = null;
    if (LOVABLE_API_KEY && finalChannels.length >= 3) {
      try {
        const summaryPrompt = `Analyze these ${finalChannels.length} small viral channels found in "${niche}":

${finalChannels.slice(0, 10).map((ch: any) => `- ${ch.channelName} (${ch.subscribers} subs, max ${ch.maxVideoViews} views, multiplier ${ch.multiplier}x)
  Top video: "${ch.topVideos?.[0]?.title}"`).join('\n')}

Provide in JSON:
{
  "common_patterns": ["pattern1", "pattern2"],
  "title_formulas": ["formula1", "formula2"],
  "content_gaps": ["gap1", "gap2"],
  "replication_strategy": "brief strategy",
  "estimated_difficulty": "easy|medium|hard",
  "best_channel_to_model": "channel name and why"
}`;

        const insightRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube growth strategist. Respond ONLY in valid JSON." },
              { role: "user", content: summaryPrompt },
            ],
          }),
        });
        if (insightRes.ok) {
          const insData = await insightRes.json();
          const raw = insData.choices?.[0]?.message?.content || '{}';
          aiInsights = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        }
      } catch (e) { console.warn("AI insights failed:", e); }
    }

    return new Response(JSON.stringify({
      success: true,
      channels: finalChannels,
      totalSearched: channelIds.size,
      totalSmall: smallChannels.size,
      totalViral: finalChannels.length,
      savedToDb: savedCount,
      aiInsights,
      searchQueries,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("discover-viral-channels error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
