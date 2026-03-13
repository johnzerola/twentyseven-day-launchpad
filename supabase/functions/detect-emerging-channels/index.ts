import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// viral_score = 0.4 * views_ratio + 0.3 * views_per_hour + 0.15 * comments_ratio + 0.15 * like_ratio
// All normalized to 0-100

function calculateViralScore(video: any, channelAvgViews: number): number {
  const views = video.views || 0;
  const likes = video.likes || 0;
  const comments = video.comments || 0;
  const publishedAt = video.published_at ? new Date(video.published_at).getTime() : Date.now();
  const hoursAge = Math.max(1, (Date.now() - publishedAt) / 3600000);

  const viewsRatio = channelAvgViews > 0 ? Math.min(100, (views / channelAvgViews) * 50) : 0;
  const viewsPerHour = Math.min(100, (views / hoursAge) * 0.1);
  const commentsRatio = views > 0 ? Math.min(100, (comments / views) * 5000) : 0;
  const likeRatio = views > 0 ? Math.min(100, (likes / views) * 200) : 0;

  return Math.round(
    0.4 * viewsRatio +
    0.3 * viewsPerHour +
    0.15 * commentsRatio +
    0.15 * likeRatio
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const youtubeKey = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!youtubeKey) throw new Error("YOUTUBE_API_KEY not configured");

    // Get niches to scan
    const { data: niches } = await sb.from("niche_database").select("name").limit(5);
    const processed: any[] = [];
    let apiCalls = 0;

    for (const niche of (niches || [])) {
      // Check API limit
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
      if (!allowed) {
        processed.push({ niche: niche.name, skipped: true, reason: "limit" });
        continue;
      }

      // Search YouTube for recent videos in this niche (last 72h)
      const publishedAfter = new Date(Date.now() - 72 * 3600000).toISOString();
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=10&publishedAfter=${publishedAfter}&q=${encodeURIComponent(niche.name)}&key=${youtubeKey}`;

      const searchResp = await fetch(searchUrl);
      const searchData = await searchResp.json();
      apiCalls++;

      if (!searchData.items?.length) {
        processed.push({ niche: niche.name, videos: 0 });
        continue;
      }

      // Get video stats
      const videoIds = searchData.items.map((i: any) => i.id.videoId).filter(Boolean).join(",");
      if (!videoIds) continue;

      const { data: allowed2 } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
      if (!allowed2) continue;

      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${youtubeKey}`;
      const statsResp = await fetch(statsUrl);
      const statsData = await statsResp.json();
      apiCalls++;

      for (const video of (statsData.items || [])) {
        const channelId = video.snippet?.channelId;
        const views = parseInt(video.statistics?.viewCount || "0");
        const likes = parseInt(video.statistics?.likeCount || "0");
        const comments = parseInt(video.statistics?.commentCount || "0");

        // Estimate channel avg (simple heuristic: assume 10% of this video's views)
        const estChannelAvg = Math.max(1000, views * 0.1);

        const score = calculateViralScore(
          { views, likes, comments, published_at: video.snippet?.publishedAt },
          estChannelAvg
        );

        if (score >= 50) {
          await sb.from("emerging_channels").upsert({
            channel_id: channelId,
            channel_title: video.snippet?.channelTitle,
            sample_video_id: video.id,
            niche: niche.name,
            viral_score: score,
            meta: {
              views, likes, comments,
              title: video.snippet?.title,
              published_at: video.snippet?.publishedAt,
            },
            last_checked: new Date().toISOString(),
          }, { onConflict: "id" });

          // Use channel_id for dedup (upsert won't work on id for new records)
          // So we check first
          const { data: existing } = await sb
            .from("emerging_channels")
            .select("id")
            .eq("channel_id", channelId)
            .eq("sample_video_id", video.id)
            .maybeSingle();

          if (!existing) {
            await sb.from("emerging_channels").insert({
              channel_id: channelId,
              channel_title: video.snippet?.channelTitle,
              sample_video_id: video.id,
              niche: niche.name,
              viral_score: score,
              meta: {
                views, likes, comments,
                title: video.snippet?.title,
                published_at: video.snippet?.publishedAt,
              },
            });
          } else {
            await sb.from("emerging_channels")
              .update({ viral_score: score, last_checked: new Date().toISOString(), meta: { views, likes, comments, title: video.snippet?.title } })
              .eq("id", existing.id);
          }
        }
      }

      processed.push({ niche: niche.name, videos: statsData.items?.length || 0 });
    }

    await sb.from("execution_logs").insert({
      function_name: "detect-emerging-channels",
      duration_ms: Date.now() - startTime,
      success: true,
      api_calls_made: apiCalls,
      metadata: { processed },
    });

    return new Response(JSON.stringify({ success: true, processed, api_calls: apiCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    await sb.from("execution_logs").insert({
      function_name: "detect-emerging-channels",
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: e.message,
    });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
