import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScanParams {
  mode: "emerging" | "escapees" | "cluster" | "micro-niche-drill";
  niche: string;
  country?: string;
  language?: string;
  maxVideos?: number;
  maxChannelAgeDays?: number;
  minSubs?: number;
  maxSubs?: number;
  maxChannelVideos?: number;
  minVideoViews?: number;
  minEngagement?: number;
  minViralScore?: number;
  sortBy?: string;
}

async function fetchJSON(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    const reason = data.error.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new Error("QUOTA_EXCEEDED");
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data;
}

function daysSince(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Generate multiple search queries using AI for better coverage
async function generateSearchQueries(niche: string, mode: string, language: string, lovableKey: string): Promise<string[]> {
  const baseQueries = [niche];
  try {
    const res = await _ai({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You generate YouTube search queries. Return ONLY a JSON array of 4 strings. No markdown." },
          { role: "user", content: `Generate 4 diverse YouTube search queries to find ${mode === 'emerging' ? 'new small channels' : mode === 'escapees' ? 'fast-growing channels' : 'channels'} in the "${niche}" niche. Language: ${language || 'any'}. Each query should target different angles/subtopics. Return as JSON array.` },
        ],
      });
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return [...baseQueries, ...parsed.slice(0, 4)];
      }
    }
  } catch (e) {
    console.error("Query generation error:", e);
  }
  // Fallback: create variations manually
  return [
    niche,
    `${niche} 2025 2026`,
    `${niche} tutorial como`,
    `${niche} top melhores`,
  ];
}

async function searchYouTubeVideos(query: string, apiKey: string, country: string, language: string, publishedAfter: string, maxResults = 50): Promise<any[]> {
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&order=viewCount&publishedAfter=${publishedAfter}&key=${apiKey}`;
  if (country) url += `&regionCode=${country}`;
  if (language) url += `&relevanceLanguage=${language}`;
  try {
    const data = await fetchJSON(url);
    return data.items || [];
  } catch (e) {
    console.error(`Search error for "${query}":`, e);
    return [];
  }
}

function buildChannelData(cData: any, vData: any) {
  const channelMap: Record<string, any> = {};
  for (const ch of (cData.items || [])) {
    const subs = parseInt(ch.statistics.subscriberCount || "0");
    const totalViews = parseInt(ch.statistics.viewCount || "0");
    const videoCount = parseInt(ch.statistics.videoCount || "0");
    const createdAt = ch.snippet.publishedAt;
    channelMap[ch.id] = {
      id: ch.id,
      name: ch.snippet.title,
      thumbnail: ch.snippet.thumbnails?.medium?.url,
      description: ch.snippet.description?.slice(0, 300) || "",
      subscribers: subs,
      totalViews,
      videoCount,
      avgViews: videoCount > 0 ? Math.floor(totalViews / videoCount) : 0,
      country: ch.snippet.country || "",
      createdAt,
      ageDays: Math.round(daysSince(createdAt)),
      keywords: ch.brandingSettings?.channel?.keywords || "",
      isMonetized: subs >= 1000 && totalViews >= 240000,
    };
  }

  const channelVideos: Record<string, any[]> = {};
  for (const v of (vData.items || [])) {
    const chId = v.snippet.channelId;
    if (!channelVideos[chId]) channelVideos[chId] = [];
    const views = parseInt(v.statistics?.viewCount || "0");
    const likes = parseInt(v.statistics?.likeCount || "0");
    const comments = parseInt(v.statistics?.commentCount || "0");
    const publishedMs = new Date(v.snippet.publishedAt).getTime();
    const hoursAge = Math.max(1, (Date.now() - publishedMs) / 3600000);
    const viewVelocity72h = hoursAge <= 72 ? views : Math.round(views * (72 / hoursAge));

    channelVideos[chId].push({
      id: v.id,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      views, likes, comments,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails?.duration || "",
      vph: Math.round(views / hoursAge),
      engagementRate: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
      commentEngagement: views > 0 ? parseFloat(((comments / views) * 100).toFixed(3)) : 0,
      likeRatio: views > 0 ? parseFloat(((likes / views) * 100).toFixed(2)) : 0,
      viewVelocity72h,
    });
  }
  return { channelMap, channelVideos };
}

function enrichChannels(channelMap: Record<string, any>, channelVideos: Record<string, any[]>) {
  return Object.entries(channelMap).map(([chId, ch]) => {
    const videos = (channelVideos[chId] || []).sort((a: any, b: any) => b.views - a.views);
    const totalVideoViews = videos.reduce((s: number, v: any) => s + v.views, 0);
    const avgVideoViews = videos.length > 0 ? Math.round(totalVideoViews / videos.length) : 0;
    const maxVideoViews = videos.length > 0 ? Math.max(...videos.map((v: any) => v.views)) : 0;
    const avgVph = videos.length > 0 ? Math.round(videos.reduce((s: number, v: any) => s + v.vph, 0) / videos.length) : 0;
    const viewsPerSub = ch.subscribers > 0 ? parseFloat((totalVideoViews / ch.subscribers).toFixed(2)) : 0;
    const avgEngagement = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.engagementRate, 0) / videos.length).toFixed(2)) : 0;
    const avgCommentEngagement = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.commentEngagement, 0) / videos.length).toFixed(3)) : 0;
    const avgLikeRatio = videos.length > 0 ? parseFloat((videos.reduce((s: number, v: any) => s + v.likeRatio, 0) / videos.length).toFixed(2)) : 0;
    const avgViewVelocity72h = videos.length > 0 ? Math.round(videos.reduce((s: number, v: any) => s + v.viewVelocity72h, 0) / videos.length) : 0;

    const publishDates = videos.map((v: any) => new Date(v.publishedAt).getTime()).sort((a: number, b: number) => b - a);
    let uploadFrequencyDays = 0;
    if (publishDates.length >= 2) {
      const intervals = [];
      for (let i = 0; i < publishDates.length - 1; i++) intervals.push((publishDates[i] - publishDates[i + 1]) / 86400000);
      uploadFrequencyDays = parseFloat((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1));
    }

    const efficiencyScore = ch.subscribers > 0 ? Math.min(100, Math.round((maxVideoViews / Math.max(ch.subscribers, 1)) * 10)) : 0;
    const growthVelocity = ch.subscribers > 0 ? Math.round((avgVideoViews / ch.subscribers) * 100) : 0;

    const vsViewsPerSub = Math.min(30, viewsPerSub * 3);
    const vsVelocity = Math.min(20, (avgViewVelocity72h / 10000) * 20);
    const vsEngagement = Math.min(20, avgCommentEngagement * 200);
    const vsLikeRatio = Math.min(15, avgLikeRatio * 3);
    const vsUploadFreq = uploadFrequencyDays > 0 && uploadFrequencyDays <= 7 ? 15 : uploadFrequencyDays <= 14 ? 10 : uploadFrequencyDays <= 30 ? 5 : 0;

    const viralScore = Math.min(100, Math.round(vsViewsPerSub + vsVelocity + vsEngagement + vsLikeRatio + vsUploadFreq));
    const growthPotentialScore = Math.min(100, Math.round((efficiencyScore * 0.4) + (viralScore * 0.4) + (growthVelocity > 200 ? 20 : growthVelocity > 100 ? 10 : 0)));
    const algorithmBoostProbability = Math.min(100, Math.round(viralScore * 0.6 + (avgViewVelocity72h > 50000 ? 40 : avgViewVelocity72h > 10000 ? 20 : 0)));
    const outlierVideos = videos.filter((v: any) => ch.avgViews > 0 && v.views >= ch.avgViews * 3);

    return {
      ...ch,
      videos: videos.slice(0, 5),
      recentVideoCount: videos.length,
      avgVideoViews, maxVideoViews, avgVph, viewsPerSub, efficiencyScore,
      outlierCount: outlierVideos.length, growthVelocity,
      avgEngagement, avgCommentEngagement, avgLikeRatio, avgViewVelocity72h,
      uploadFrequencyDays, viralScore, growthPotentialScore, algorithmBoostProbability,
      isEmerging: ch.videoCount <= 20 && ch.ageDays <= 180,
      isAlgorithmEscapee: growthVelocity >= 300 && ch.videoCount <= 30,
    };
  });
}

function applyFilters(channels: any[], params: ScanParams) {
  let filtered = [...channels];
  const { mode, minSubs, maxSubs, maxChannelVideos, minVideoViews, minEngagement, minViralScore, maxVideos, maxChannelAgeDays } = params;

  if (mode === "emerging") {
    const maxVids = maxVideos || 20;
    const maxAge = maxChannelAgeDays || 180;
    filtered = filtered.filter(ch => ch.videoCount <= maxVids && ch.ageDays <= maxAge);
  } else if (mode === "escapees") {
    filtered = filtered.filter(ch => ch.growthVelocity >= 150);
  }

  if (minSubs && minSubs > 0) filtered = filtered.filter(ch => ch.subscribers >= minSubs);
  if (maxSubs && maxSubs > 0) filtered = filtered.filter(ch => ch.subscribers <= maxSubs);
  if (maxChannelVideos && maxChannelVideos > 0) filtered = filtered.filter(ch => ch.videoCount <= maxChannelVideos);
  if (minVideoViews && minVideoViews > 0) filtered = filtered.filter(ch => ch.maxVideoViews >= minVideoViews);
  if (minEngagement && minEngagement > 0) filtered = filtered.filter(ch => ch.avgEngagement >= minEngagement);
  if (minViralScore && minViralScore > 0) filtered = filtered.filter(ch => ch.viralScore >= minViralScore);

  return filtered;
}

function sortChannels(channels: any[], mode: string, sortBy?: string) {
  const sortKey = sortBy || (mode === "escapees" ? "growthVelocity" : "viralScore");
  return channels.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params: ScanParams = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const { mode, niche, country = "", language = "" } = params;
    if (!niche?.trim()) throw new Error("Niche is required");

    console.log(`DubSpy scan: mode=${mode}, niche="${niche}", country=${country}, lang=${language}`);

    // Step 1: Generate multiple search queries using AI for broader coverage
    const queries = GOOGLE_AI_API_KEY 
      ? await generateSearchQueries(niche, mode, language, GOOGLE_AI_API_KEY)
      : [niche, `${niche} 2026`, `${niche} como fazer`];

    console.log(`Generated ${queries.length} search queries:`, queries);

    // Step 2: Search YouTube with multiple queries (broader coverage)
    const after30d = new Date(Date.now() - 30 * 86400000).toISOString();
    const after90d = new Date(Date.now() - 90 * 86400000).toISOString();
    const after180d = new Date(Date.now() - 180 * 86400000).toISOString();
    const publishedAfter = mode === "escapees" ? after30d : mode === "emerging" ? after180d : after90d;

    // Run searches in parallel (max 3 to conserve quota)
    const searchQueries = queries.slice(0, 3);
    const allSearchResults = await Promise.all(
      searchQueries.map(q => searchYouTubeVideos(q, YOUTUBE_API_KEY, country, language, publishedAfter, 50))
    );

    // Deduplicate videos by ID
    const seenVideoIds = new Set<string>();
    const allVideoItems: any[] = [];
    for (const items of allSearchResults) {
      for (const item of items) {
        const vid = item.id?.videoId;
        if (vid && !seenVideoIds.has(vid)) {
          seenVideoIds.add(vid);
          allVideoItems.push(item);
        }
      }
    }

    console.log(`Total unique videos found: ${allVideoItems.length} from ${searchQueries.length} queries`);

    if (!allVideoItems.length) {
      // Check if all queries failed due to quota
      const quotaExceeded = allSearchResults.every(r => r.length === 0);
      return new Response(JSON.stringify({ 
        channels: [], clusters: [], 
        error: quotaExceeded ? "Quota da YouTube API esgotada. Tente novamente amanhã." : undefined,
        meta: { totalFound: 0, emergingCount: 0, escapeeCount: 0, queriesUsed: searchQueries, quotaExceeded } 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Get video stats (batch in groups of 50)
    const allVideoIds = allVideoItems.map((i: any) => i.id.videoId).filter(Boolean);
    const videoStatsBatches = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50);
      videoStatsBatches.push(fetchJSON(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${batch.join(",")}&key=${YOUTUBE_API_KEY}`));
    }
    const videoStatsResults = await Promise.all(videoStatsBatches);
    const allVideoData = { items: videoStatsResults.flatMap(r => r.items || []) };

    // Step 4: Get unique channel details
    const channelIds = [...new Set((allVideoData.items || []).map((v: any) => v.snippet.channelId))] as string[];
    console.log(`Unique channels found: ${channelIds.length}`);

    // Batch channel requests (max 50 per request)
    const channelBatches = [];
    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      channelBatches.push(fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings,contentDetails&id=${batch.join(",")}&key=${YOUTUBE_API_KEY}`));
    }
    const channelResults = await Promise.all(channelBatches);
    const allChannelData = { items: channelResults.flatMap(r => r.items || []) };

    // Step 5: Build & enrich
    const { channelMap, channelVideos } = buildChannelData(allChannelData, allVideoData);
    let channels = enrichChannels(channelMap, channelVideos);

    console.log(`Enriched channels: ${channels.length}, applying filters...`);

    // Step 6: Apply filters
    channels = applyFilters(channels, params);
    console.log(`After filters: ${channels.length} channels`);

    // Step 7: Sort
    channels = sortChannels(channels, mode, params.sortBy);

    // Step 8: AI clustering (cluster/micro-niche-drill modes)
    let clusters: any[] = [];
    if ((mode === "cluster" || mode === "micro-niche-drill") && GOOGLE_AI_API_KEY && channels.length >= 2) {
      try {
        const channelSummary = channels.slice(0, 25).map(ch =>
          `ID:${ch.id} | ${ch.name} (${ch.subscribers} subs, ${ch.videoCount} vids, avg ${ch.avgViews} views, viral:${ch.viralScore}, keywords: ${ch.keywords?.slice(0, 100)}). Top: ${ch.videos.slice(0, 2).map((v: any) => `"${v.title}"`).join(", ")}`
        ).join("\n");

        const aiRes = await _ai({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube niche analyst. Analyze channels and group them into micro-niche clusters. For each cluster, include the channel IDs that belong to it. Also suggest 3-5 specific video topics. Respond in Portuguese (BR)." },
              { role: "user", content: `Agrupe estes canais do nicho "${niche}" em micro-nichos distintos. Use os IDs exatos:\n\n${channelSummary}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "channel_clusters",
                description: "Return channel clusters",
                parameters: {
                  type: "object",
                  properties: {
                    clusters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          opportunity: { type: "string", enum: ["Alta", "Média", "Baixa"] },
                          channelIds: { type: "array", items: { type: "string" } },
                          suggestedTopics: { type: "array", items: { type: "string" } },
                          searchQuery: { type: "string" },
                        },
                        required: ["name", "description", "opportunity", "channelIds", "suggestedTopics", "searchQuery"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["clusters"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "channel_clusters" } },
          });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            clusters = parsed.clusters || [];
          }
        }
      } catch (e) {
        console.error("AI clustering error:", e);
      }
    }

    // Step 9: Micro-niche drill — discover more channels per cluster
    if (mode === "micro-niche-drill" && clusters.length > 0) {
      const drillPromises = clusters.filter(c => c.searchQuery).map(async (cluster) => {
        try {
          let drillUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cluster.searchQuery)}&maxResults=10&key=${YOUTUBE_API_KEY}`;
          if (country) drillUrl += `&regionCode=${country}`;
          if (language) drillUrl += `&relevanceLanguage=${language}`;
          const drillData = await fetchJSON(drillUrl);
          const drillIds = (drillData.items || []).map((i: any) => i.snippet?.channelId || i.id?.channelId).filter(Boolean);
          const newIds = drillIds.filter((id: string) => !channelIds.includes(id));
          if (newIds.length > 0) {
            const extraCData = await fetchJSON(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${newIds.slice(0, 10).join(",")}&key=${YOUTUBE_API_KEY}`);
            cluster.discoveredChannels = (extraCData.items || []).map((ch: any) => ({
              id: ch.id,
              name: ch.snippet.title,
              thumbnail: ch.snippet.thumbnails?.medium?.url,
              subscribers: parseInt(ch.statistics.subscriberCount || "0"),
              totalViews: parseInt(ch.statistics.viewCount || "0"),
              videoCount: parseInt(ch.statistics.videoCount || "0"),
              avgViews: parseInt(ch.statistics.videoCount || "1") > 0 ? Math.floor(parseInt(ch.statistics.viewCount || "0") / parseInt(ch.statistics.videoCount || "1")) : 0,
            }));
          }
        } catch (e) {
          console.error(`Drill error for ${cluster.name}:`, e);
        }
      });
      await Promise.all(drillPromises);
    }

    const result = {
      channels: channels.slice(0, 40),
      clusters,
      meta: {
        mode, niche, country,
        totalFound: channels.length,
        emergingCount: channels.filter(ch => ch.isEmerging).length,
        escapeeCount: channels.filter(ch => ch.isAlgorithmEscapee).length,
        queriesUsed: searchQueries,
        uniqueVideosAnalyzed: allVideoItems.length,
        uniqueChannelsAnalyzed: channelIds.length,
      },
    };

    // ═══════ VIRAL ENGINE FEEDBACK LOOP ═══════
    // Auto-feed discovered data back into knowledge bases
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Feed top video titles into viral_titles_db
      const topVideos = channels
        .flatMap((ch: any) => (ch.topVideos || []).map((v: any) => ({ ...v, channelName: ch.name, channelNiche: ch.estimatedNiche })))
        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
        .slice(0, 20);

      if (topVideos.length > 0) {
        const titlesToInsert = topVideos
          .filter((v: any) => v.title && v.views > 50000)
          .map((v: any) => ({
            title: v.title,
            views: v.views || 0,
            niche: v.channelNiche || niche || 'unknown',
            source: 'dubspy',
            why_viral: `Discovered via DubSpy ${mode} scan. Channel: ${v.channelName}`,
            title_pattern: 'auto-detected',
          }));

        if (titlesToInsert.length > 0) {
          await sb.from("viral_titles_db" as any).upsert(titlesToInsert, { onConflict: 'title' as any, ignoreDuplicates: true } as any);
          console.log(`Fed ${titlesToInsert.length} titles to viral_titles_db`);
        }
      }

      // Feed hook patterns from top-performing video titles
      const hookCandidates = topVideos
        .filter((v: any) => v.views > 100000 && v.title)
        .slice(0, 5);
      
      if (hookCandidates.length > 0) {
        const hooksToInsert = hookCandidates.map((v: any) => ({
          hook_text: v.title,
          hook_type: 'title_hook',
          retention_score: Math.min(10, Math.round(Math.log10(v.views || 1))),
          niche: v.channelNiche || niche || 'unknown',
          source_video: v.id || null,
        }));

        await sb.from("hook_library").upsert(hooksToInsert, { onConflict: 'hook_text' as any, ignoreDuplicates: true } as any);
        console.log(`Fed ${hooksToInsert.length} hooks to hook_library`);
      }

      // Feed hook_patterns table
      if (clusters.length > 0) {
        const patternsToInsert = clusters.slice(0, 5).map((c: any) => ({
          pattern_name: `DubSpy: ${c.name}`,
          pattern_type: 'topic_cluster',
          template: `Cluster "${c.name}" com ${c.videoCount || 0} vídeos. Padrão detectado em ${mode} scan.`,
          example_hooks: (c.sampleVideos || []).slice(0, 3).map((v: any) => ({ title: v, source: 'dubspy' })),
          best_for_niches: [niche || 'unknown'],
          effectiveness_score: Math.min(10, Math.round((c.totalViews || 0) / 500000) + 4),
          source: 'dubspy_auto',
        }));

        await sb.from("hook_patterns" as any).upsert(patternsToInsert, { onConflict: 'pattern_name' as any, ignoreDuplicates: true } as any);
        console.log(`Fed ${patternsToInsert.length} hook patterns`);
      }

    } catch (feedErr) {
      console.warn("Viral Engine feedback failed (non-critical):", feedErr);
    }

    console.log(`DubSpy result: ${result.channels.length} channels, ${clusters.length} clusters`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dubspy-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
