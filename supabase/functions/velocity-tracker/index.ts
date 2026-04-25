import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// VELOCITY TRACKER
// Takes snapshots of video/channel metrics at intervals
// 2 snapshots in 24h → calculates views/hour velocity
// Detects rising/falling/stable trends
// ═══════════════════════════════════════════════════════════

function getYouTubeKey(): string | undefined {
  return Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") ||
    Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "snapshot", videoIds, niche } = await req.json().catch(() => ({}));
    const YT_KEY = getYouTubeKey();
    if (!YT_KEY) throw new Error("No YouTube API key");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const results: any = { snapshots_taken: 0, trends_calculated: 0, rising_videos: [] };

    if (mode === "snapshot") {
      // Get videos to snapshot: from outlier_channels + video_performance + emerging content
      let ids: string[] = videoIds || [];

      if (!ids.length) {
        // Auto-discover: recent outliers + tracked videos
        const [outlierRes, perfRes] = await Promise.all([
          sb.from("outlier_channels").select("video_url").order("found_at", { ascending: false }).limit(20),
          sb.from("video_performance").select("youtube_video_id").order("last_checked_at", { ascending: false }).limit(30),
        ]);

        const outlierIds = (outlierRes.data || [])
          .map((o: any) => {
            const match = (o.video_url || '').match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : null;
          }).filter(Boolean);

        const perfIds = (perfRes.data || []).map((p: any) => p.youtube_video_id).filter(Boolean);
        ids = [...new Set([...outlierIds, ...perfIds])].slice(0, 50);
      }

      if (!ids.length) {
        return new Response(JSON.stringify({ success: true, message: "No videos to track", results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Batch YouTube API calls
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
        if (!allowed) break;

        const vRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${batch.join(",")}&key=${YT_KEY}`
        );
        const vData = await vRes.json();

        for (const item of (vData.items || [])) {
          const views = parseInt(item.statistics?.viewCount || '0');
          const likes = parseInt(item.statistics?.likeCount || '0');
          const comments = parseInt(item.statistics?.commentCount || '0');
          const channelId = item.snippet?.channelId || '';

          // Get previous snapshot for velocity calculation
          const { data: prevSnapshot } = await sb.from("velocity_snapshots")
            .select("views, snapshot_at")
            .eq("video_id", item.id)
            .order("snapshot_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let viewsPerHour = 0;
          let trend = "new";

          if (prevSnapshot) {
            const hoursDiff = (Date.now() - new Date(prevSnapshot.snapshot_at).getTime()) / 3600000;
            if (hoursDiff > 0.5) { // at least 30min between snapshots
              const viewsDiff = views - (prevSnapshot.views || 0);
              viewsPerHour = Math.round(viewsDiff / hoursDiff);

              // Trend: compare with expected baseline
              if (viewsPerHour > 500) trend = "exploding";
              else if (viewsPerHour > 100) trend = "rising";
              else if (viewsPerHour > 20) trend = "growing";
              else if (viewsPerHour > 0) trend = "stable";
              else trend = "declining";
            }
          }

          // Determine niche from existing data
          let videoNiche = niche || "general";
          if (!niche) {
            const { data: dnaMatch } = await sb.from("content_dna")
              .select("niche").eq("video_id", item.id).maybeSingle();
            if (dnaMatch?.niche) videoNiche = dnaMatch.niche;
          }

          await sb.from("velocity_snapshots").insert({
            video_id: item.id,
            channel_id: channelId,
            niche: videoNiche,
            views,
            likes,
            comments,
            views_per_hour: viewsPerHour,
            velocity_trend: trend,
          });

          results.snapshots_taken++;
          if (trend === "rising" || trend === "exploding") {
            results.rising_videos.push({
              id: item.id,
              title: item.snippet?.title,
              views,
              views_per_hour: viewsPerHour,
              trend,
            });
          }
        }
      }

      // Feed rising videos to ai_learning
      if (results.rising_videos.length > 0) {
        await sb.from("ai_learning").insert({
          topic: `velocity_rising_${new Date().toISOString().slice(0, 10)}`,
          source: "velocity-tracker",
          insight: JSON.stringify({
            rising_count: results.rising_videos.length,
            top_rising: results.rising_videos.slice(0, 5),
            timestamp: new Date().toISOString(),
          }),
        }).then(() => {}, () => {});
      }
    }

    if (mode === "analyze_trends") {
      // Aggregate velocity data by niche for the Niche Velocity Index
      const { data: niches } = await sb.from("velocity_snapshots")
        .select("niche")
        .gte("snapshot_at", new Date(Date.now() - 7 * 86400000).toISOString());

      const uniqueNiches = [...new Set((niches || []).map((n: any) => n.niche))];

      for (const nicheName of uniqueNiches) {
        const { data: snapshots } = await sb.from("velocity_snapshots")
          .select("views_per_hour, velocity_trend, views")
          .eq("niche", nicheName)
          .gte("snapshot_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .order("snapshot_at", { ascending: false })
          .limit(100);

        if (!snapshots?.length) continue;

        const avgVelocity = snapshots.reduce((s, v) => s + (v.views_per_hour || 0), 0) / snapshots.length;
        const risingCount = snapshots.filter(s => s.velocity_trend === "rising" || s.velocity_trend === "exploding").length;
        const totalVideos = snapshots.length;
        const growthVelocity = totalVideos > 0 ? (risingCount / totalVideos) * 100 : 0;

        // Saturation: more declining = more saturated
        const decliningCount = snapshots.filter(s => s.velocity_trend === "declining").length;
        const saturationScore = totalVideos > 0 ? (decliningCount / totalVideos) * 100 : 50;

        let window = "unknown";
        if (growthVelocity > 60) window = "hot_now";
        else if (growthVelocity > 30) window = "growing";
        else if (saturationScore > 60) window = "saturating";
        else window = "stable";

        await sb.from("niche_velocity").upsert({
          niche: nicheName,
          snapshot_date: new Date().toISOString().slice(0, 10),
          avg_views_per_video: Math.round(snapshots.reduce((s, v) => s + (v.views || 0), 0) / snapshots.length),
          top_video_views: Math.max(...snapshots.map(s => s.views || 0)),
          total_videos_30d: totalVideos,
          growth_velocity: Math.round(growthVelocity * 10) / 10,
          saturation_score: Math.round(saturationScore * 10) / 10,
          opportunity_window: window,
          metadata: { avg_velocity: avgVelocity, rising_ratio: risingCount / totalVideos },
        }, { onConflict: "niche,snapshot_date" });

        results.trends_calculated++;
      }
    }

    await sb.from("execution_logs").insert({
      function_name: "velocity-tracker",
      success: true,
      api_calls_made: Math.ceil(results.snapshots_taken / 50),
      metadata: results,
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("velocity-tracker error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
