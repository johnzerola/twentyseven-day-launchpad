import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface VideoItem {
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  published_at: string;
  duration_seconds: number;
  tags: string[];
  description_snippet: string;
  thumbnail_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  try {
    const { channel_id, channel_url, max_videos = 50, user_id, analyze_patterns = true } = await req.json();
    
    let resolvedChannelId = channel_id;
    
    // Resolve channel URL to ID if needed
    if (!resolvedChannelId && channel_url) {
      const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3");
      if (!YT_KEY) throw new Error("YouTube API key not configured");
      
      // Try handle, username, or channel ID from URL
      let handle = "";
      const urlMatch = channel_url.match(/@([\w.-]+)/);
      if (urlMatch) handle = urlMatch[1];
      
      if (handle) {
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YT_KEY}`
        );
        const searchData = await searchRes.json();
        resolvedChannelId = searchData.items?.[0]?.snippet?.channelId;
      }
      
      if (!resolvedChannelId) {
        const idMatch = channel_url.match(/channel\/(UC[\w-]+)/);
        if (idMatch) resolvedChannelId = idMatch[1];
      }
    }
    
    if (!resolvedChannelId) throw new Error("Could not resolve channel ID");
    
    const YT_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const YT_KEY_2 = Deno.env.get("YOUTUBE_API_KEY_2");
    const YT_KEY_3 = Deno.env.get("YOUTUBE_API_KEY_3");
    if (!YT_KEY && !YT_KEY_2 && !YT_KEY_3) throw new Error("YouTube API key not configured");
    
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Credit check (3 credits for bulk scan)
    if (user_id) {
      const { data: hasCredits } = await sb.rpc("consume_credits", { _user_id: user_id, _amount: 3 });
      if (!hasCredits) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes (necessário: 3)" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch channel info
    const apiKey = YT_KEY || YT_KEY_2 || YT_KEY_3!;
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${resolvedChannelId}&key=${apiKey}`
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];
    if (!channel) throw new Error("Channel not found");

    const channelInfo = {
      id: resolvedChannelId,
      name: channel.snippet.title,
      subscribers: parseInt(channel.statistics.subscriberCount || "0"),
      total_views: parseInt(channel.statistics.viewCount || "0"),
      total_videos: parseInt(channel.statistics.videoCount || "0"),
      thumbnail: channel.snippet.thumbnails?.medium?.url,
      created_at: channel.snippet.publishedAt,
      uploads_playlist: channel.contentDetails?.relatedPlaylists?.uploads,
    };

    // Fetch all videos from uploads playlist
    const allVideos: string[] = [];
    let nextPageToken = "";
    const playlistId = channelInfo.uploads_playlist;
    
    while (allVideos.length < max_videos) {
      const remaining = max_videos - allVideos.length;
      const pageSize = Math.min(remaining, 50);
      const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${pageSize}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
      
      const plRes = await fetch(plUrl);
      if (!plRes.ok) {
        // Try backup key
        if (YT_KEY_2 && apiKey === YT_KEY) {
          const plRes2 = await fetch(plUrl.replace(apiKey, YT_KEY_2));
          if (!plRes2.ok) break;
          const plData2 = await plRes2.json();
          allVideos.push(...(plData2.items || []).map((i: any) => i.contentDetails.videoId));
          nextPageToken = plData2.nextPageToken || "";
        } else break;
      } else {
        const plData = await plRes.json();
        allVideos.push(...(plData.items || []).map((i: any) => i.contentDetails.videoId));
        nextPageToken = plData.nextPageToken || "";
      }
      if (!nextPageToken) break;
    }

    // Fetch detailed stats for each video (in batches of 50)
    const videos: VideoItem[] = [];
    for (let i = 0; i < allVideos.length; i += 50) {
      const batch = allVideos.slice(i, i + 50);
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batch.join(",")}&key=${apiKey}`;
      const vRes = await fetch(vUrl);
      if (!vRes.ok) continue;
      const vData = await vRes.json();
      
      for (const item of (vData.items || [])) {
        const duration = item.contentDetails?.duration || "PT0S";
        const dMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const dSec = (parseInt(dMatch?.[1] || "0") * 3600) + (parseInt(dMatch?.[2] || "0") * 60) + parseInt(dMatch?.[3] || "0");
        
        videos.push({
          video_id: item.id,
          title: item.snippet.title,
          views: parseInt(item.statistics?.viewCount || "0"),
          likes: parseInt(item.statistics?.likeCount || "0"),
          comments: parseInt(item.statistics?.commentCount || "0"),
          published_at: item.snippet.publishedAt,
          duration_seconds: dSec,
          tags: (item.snippet.tags || []).slice(0, 20),
          description_snippet: (item.snippet.description || "").slice(0, 200),
          thumbnail_url: item.snippet.thumbnails?.high?.url || "",
        });
      }
    }

    // Calculate channel analytics
    const avgViews = videos.length > 0 ? Math.round(videos.reduce((s, v) => s + v.views, 0) / videos.length) : 0;
    const avgDuration = videos.length > 0 ? Math.round(videos.reduce((s, v) => s + v.duration_seconds, 0) / videos.length) : 0;
    const avgLikes = videos.length > 0 ? Math.round(videos.reduce((s, v) => s + v.likes, 0) / videos.length) : 0;
    
    // Find outliers (3x+ avg views)
    const outliers = videos.filter(v => v.views >= avgViews * 3).sort((a, b) => b.views - a.views);
    
    // Upload frequency
    const sortedByDate = [...videos].sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
    let avgDaysBetween = 0;
    if (sortedByDate.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sortedByDate.length; i++) {
        const diff = (new Date(sortedByDate[i].published_at).getTime() - new Date(sortedByDate[i-1].published_at).getTime()) / (1000 * 60 * 60 * 24);
        gaps.push(diff);
      }
      avgDaysBetween = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    }

    // Tag frequency analysis
    const tagFreq: Record<string, number> = {};
    videos.forEach(v => v.tags.forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; }));
    const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);

    // Title pattern analysis
    const titlePatterns = {
      questions: videos.filter(v => v.title.includes("?")).length,
      numbers: videos.filter(v => /\d+/.test(v.title)).length,
      caps_words: videos.filter(v => /[A-Z]{3,}/.test(v.title)).length,
      emojis: videos.filter(v => /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/u.test(v.title)).length,
      avg_title_length: Math.round(videos.reduce((s, v) => s + v.title.length, 0) / Math.max(videos.length, 1)),
    };

    // AI Pattern Analysis (if enabled)
    let aiAnalysis: any = null;
    if (analyze_patterns && videos.length >= 5) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const topVideos = [...videos].sort((a, b) => b.views - a.views).slice(0, 15);
        const bottomVideos = [...videos].sort((a, b) => a.views - b.views).slice(0, 5);
        
        const aiRes = await fetch(AI_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `Analyze this YouTube channel's patterns. Channel: "${channelInfo.name}" (${channelInfo.subscribers} subs, avg ${avgViews} views).

TOP PERFORMING VIDEOS:
${topVideos.map(v => `- "${v.title}" (${v.views} views, ${Math.round(v.duration_seconds/60)}min, ${v.likes} likes)`).join("\n")}

WORST PERFORMING:
${bottomVideos.map(v => `- "${v.title}" (${v.views} views)`).join("\n")}

TOP TAGS: ${topTags.slice(0, 10).map(t => t[0]).join(", ")}

Provide JSON with: { niche, sub_niche, content_style, what_works (array of patterns from top videos), what_fails (array from worst), optimal_duration_min, optimal_upload_day, hook_patterns (array), title_formula (array of templates), growth_strategy, estimated_rpm, faceless_score (0-10) }`
            }],
            response_format: { type: "json_object" },
          }),
        });
        
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          try {
            aiAnalysis = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          } catch { aiAnalysis = null; }
        }
      }
    }

    // Save to channel_intelligence
    await sb.from("channel_intelligence").upsert({
      youtube_channel_id: resolvedChannelId,
      channel_name: channelInfo.name,
      subscribers: channelInfo.subscribers,
      avg_views: avgViews,
      niche: aiAnalysis?.niche || "general",
      sub_niche: aiAnalysis?.sub_niche || null,
      style: aiAnalysis?.content_style || "unknown",
      is_faceless: (aiAnalysis?.faceless_score || 0) >= 6,
      growth_rate: avgDaysBetween <= 3 ? "fast" : avgDaysBetween <= 7 ? "steady" : "slow",
      upload_frequency: `every ${avgDaysBetween} days`,
      rpm_estimate: aiAnalysis?.estimated_rpm || 0,
      top_videos: outliers.slice(0, 5).map(v => ({ id: v.video_id, title: v.title, views: v.views })),
      viral_patterns: {
        what_works: aiAnalysis?.what_works || [],
        hook_patterns: aiAnalysis?.hook_patterns || [],
        title_formula: aiAnalysis?.title_formula || [],
        optimal_duration_min: aiAnalysis?.optimal_duration_min || Math.round(avgDuration / 60),
      },
      analyzed_at: new Date().toISOString(),
    }, { onConflict: "youtube_channel_id" }).catch(e => console.error("Upsert channel_intelligence:", e));

    // Save outlier videos to viral_titles_db
    for (const outlier of outliers.slice(0, 10)) {
      await sb.from("viral_titles_db").upsert({
        title: outlier.title,
        views: outlier.views,
        likes: outlier.likes,
        channel_id: resolvedChannelId,
        channel_name: channelInfo.name,
        duration_seconds: outlier.duration_seconds,
        published_at: outlier.published_at,
        niche: aiAnalysis?.niche || "general",
      }, { onConflict: "title" }).catch(() => {});
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "bulk-channel-scan",
      success: true,
      duration_ms: Date.now() - startTime,
      api_calls_made: Math.ceil(allVideos.length / 50) + 2,
      metadata: { channel_id: resolvedChannelId, videos_scanned: videos.length, outliers_found: outliers.length },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      channel: channelInfo,
      stats: {
        videos_scanned: videos.length,
        avg_views: avgViews,
        avg_duration_min: Math.round(avgDuration / 60),
        avg_likes: avgLikes,
        avg_days_between_uploads: avgDaysBetween,
        outliers_count: outliers.length,
        title_patterns: titlePatterns,
        top_tags: topTags.slice(0, 15),
      },
      outliers: outliers.slice(0, 10),
      videos: videos.sort((a, b) => b.views - a.views),
      ai_analysis: aiAnalysis,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bulk-channel-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
