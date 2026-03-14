import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PRE-VIRAL DETECTION ENGINE
 * 
 * Finds videos likely to go viral BEFORE they explode.
 * 
 * Algorithm:
 *   pre_viral_score = (view_ratio * 0.4) + (velocity_score * 0.3) + 
 *                     (engagement_rate * 0.2) + (recency_factor * 0.1)
 * 
 * Sources: velocity_snapshots, outlier_channels, emerging_channels
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, threshold = 60, maxResults = 50 } = await req.json().catch(() => ({}));
    const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") ||
                   Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!YT_KEY) throw new Error("No YouTube API key");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const results: any = { scanned: 0, pre_viral_found: 0, candidates: [] };

    // ═══ STEP 1: Gather candidate video IDs from multiple sources ═══
    const candidateIds = new Set<string>();

    // Source A: Recent velocity snapshots with rising/growing trend
    const { data: risingSnapshots } = await sb.from("velocity_snapshots")
      .select("video_id")
      .in("velocity_trend", ["rising", "growing", "exploding"])
      .gte("snapshot_at", new Date(Date.now() - 48 * 3600000).toISOString())
      .limit(30);
    (risingSnapshots || []).forEach(s => candidateIds.add(s.video_id));

    // Source B: Recent outlier videos
    const { data: outliers } = await sb.from("outlier_channels")
      .select("video_url")
      .gte("found_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(20);
    for (const o of (outliers || [])) {
      const match = (o.video_url || '').match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) candidateIds.add(match[1]);
    }

    // Source C: Emerging channels' sample videos
    const { data: emerging } = await sb.from("emerging_channels")
      .select("sample_video_id")
      .gte("detected_at", new Date(Date.now() - 14 * 86400000).toISOString())
      .limit(15);
    (emerging || []).forEach(e => { if (e.sample_video_id) candidateIds.add(e.sample_video_id); });

    // Source D: YouTube search for fresh content in target niches
    if (candidateIds.size < 20) {
      const searchNiches = niche ? [niche] : ['facts', 'mystery', 'motivation', 'scary stories'];
      for (const n of searchNiches.slice(0, 3)) {
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
        if (!allowed) break;
        try {
          const sRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(n)}&type=video&order=date&maxResults=10&publishedAfter=${new Date(Date.now() - 72 * 3600000).toISOString()}&key=${YT_KEY}`
          );
          const sData = await sRes.json();
          (sData.items || []).forEach((i: any) => { if (i.id?.videoId) candidateIds.add(i.id.videoId); });
        } catch (e) { console.warn("Search error:", e); }
      }
    }

    if (candidateIds.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No candidates found", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ STEP 2: Fetch full stats from YouTube ═══
    const allIds = [...candidateIds].slice(0, maxResults);
    const videoData: any[] = [];

    for (let i = 0; i < allIds.length; i += 50) {
      const batch = allIds.slice(i, i + 50);
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
      if (!allowed) break;

      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(",")}&key=${YT_KEY}`
      );
      const vData = await vRes.json();

      for (const item of (vData.items || [])) {
        const views = parseInt(item.statistics?.viewCount || '0');
        const likes = parseInt(item.statistics?.likeCount || '0');
        const comments = parseInt(item.statistics?.commentCount || '0');
        const publishedAt = new Date(item.snippet?.publishedAt || Date.now());
        const hoursLive = Math.max(1, (Date.now() - publishedAt.getTime()) / 3600000);

        // Get channel subscriber count
        let subs = 0;
        try {
          const chRes = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${item.snippet?.channelId}&key=${YT_KEY}`
          );
          const chData = await chRes.json();
          subs = parseInt(chData.items?.[0]?.statistics?.subscriberCount || '0');
        } catch (e) { /* skip */ }

        const dur = item.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const seconds = dur ? (parseInt(dur[1]||'0')*3600 + parseInt(dur[2]||'0')*60 + parseInt(dur[3]||'0')) : 0;

        videoData.push({
          id: item.id,
          title: item.snippet?.title,
          channelId: item.snippet?.channelId,
          channelName: item.snippet?.channelTitle,
          thumbnail: item.snippet?.thumbnails?.high?.url,
          publishedAt,
          hoursLive,
          views, likes, comments, subs, seconds,
        });
      }
    }

    // ═══ STEP 3: Calculate pre-viral scores ═══
    for (const v of videoData) {
      results.scanned++;

      // Skip very old videos (>7 days)
      if (v.hoursLive > 168) continue;

      const viewsPerHour = v.views / v.hoursLive;
      const engagementRate = v.views > 0 ? (v.likes + v.comments) / v.views : 0;
      const viewRatio = v.subs > 0 ? (v.views / v.subs) * 10 : viewsPerHour / 10;

      // Get previous snapshot for acceleration
      const { data: prevSnapshot } = await sb.from("velocity_snapshots")
        .select("views, snapshot_at")
        .eq("video_id", v.id)
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let growthAcceleration = 0;
      if (prevSnapshot) {
        const prevHours = (Date.now() - new Date(prevSnapshot.snapshot_at).getTime()) / 3600000;
        if (prevHours > 0.5) {
          const prevVelocity = prevSnapshot.views / (v.hoursLive - prevHours || 1);
          growthAcceleration = prevVelocity > 0 ? (viewsPerHour / prevVelocity - 1) * 100 : 0;
        }
      }

      // Recency: newer = higher (0-100)
      const recencyFactor = Math.max(0, 100 - (v.hoursLive / 168 * 100));

      // Calculate scores using DB functions logic
      const velocityScore = Math.min(100, 
        (Math.min(viewsPerHour / 100, 100) * 0.5) +
        (Math.min(engagementRate * 100, 100) * 0.3) +
        (Math.min(Math.max(growthAcceleration, 0), 100) * 0.2)
      );

      const preViralScore = Math.round(
        (Math.min(viewRatio, 100) * 0.4) +
        (Math.min(velocityScore, 100) * 0.3) +
        (Math.min(engagementRate * 100, 100) * 0.2) +
        (Math.min(recencyFactor, 100) * 0.1)
      * 100) / 100;

      // Determine niche from content_dna or default
      let videoNiche = niche || 'general';
      const { data: dna } = await sb.from("content_dna")
        .select("niche").eq("video_id", v.id).maybeSingle();
      if (dna?.niche) videoNiche = dna.niche;

      const status = preViralScore >= threshold ? 'pre_viral' : 'monitoring';

      // Upsert into emerging_videos
      await sb.from("emerging_videos").upsert({
        video_id: v.id,
        channel_id: v.channelId,
        channel_name: v.channelName,
        title: v.title,
        niche: videoNiche,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        subscribers: v.subs,
        views_per_hour: Math.round(viewsPerHour * 100) / 100,
        engagement_rate: Math.round(engagementRate * 10000) / 10000,
        growth_acceleration: Math.round(growthAcceleration * 100) / 100,
        velocity_score: Math.round(velocityScore * 100) / 100,
        pre_viral_score: preViralScore,
        view_ratio: Math.round(viewRatio * 100) / 100,
        recency_factor: Math.round(recencyFactor * 100) / 100,
        status,
        thumbnail_url: v.thumbnail,
        published_at: v.publishedAt.toISOString(),
        duration_seconds: v.seconds,
        snapshots_count: 1,
        peak_views: v.views,
        updated_at: new Date().toISOString(),
      }, { onConflict: "video_id" });

      // Save velocity snapshot
      await sb.from("velocity_snapshots").insert({
        video_id: v.id,
        channel_id: v.channelId,
        niche: videoNiche,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        views_per_hour: Math.round(viewsPerHour * 100) / 100,
        velocity_trend: velocityScore > 70 ? "exploding" : velocityScore > 40 ? "rising" : velocityScore > 15 ? "growing" : "stable",
      });

      if (status === 'pre_viral') {
        results.pre_viral_found++;
        results.candidates.push({
          id: v.id,
          title: v.title?.slice(0, 60),
          channel: v.channelName,
          views: v.views,
          pre_viral_score: preViralScore,
          velocity_score: velocityScore,
          views_per_hour: Math.round(viewsPerHour),
        });
      }
    }

    // Feed to ai_learning
    if (results.pre_viral_found > 0) {
      await sb.from("ai_learning").insert({
        topic: `pre_viral_detection_${new Date().toISOString().slice(0, 10)}`,
        source: "pre-viral-detection",
        insight: JSON.stringify({
          scanned: results.scanned,
          found: results.pre_viral_found,
          top_candidates: results.candidates.slice(0, 5),
        }),
      }).catch(() => {});
    }

    await sb.from("execution_logs").insert({
      function_name: "pre-viral-detection",
      success: true,
      api_calls_made: Math.ceil(videoData.length / 50) + 1,
      metadata: { scanned: results.scanned, found: results.pre_viral_found },
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pre-viral-detection error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
