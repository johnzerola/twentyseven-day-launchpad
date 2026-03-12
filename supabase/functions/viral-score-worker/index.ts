import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREAKOUT_SCORE = 0.70; // 70/100 threshold
const STRONG_SCORE = 0.50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const { hours = 72, niche, limit = 200, action = "scan" } = body;

    // ═══════════════════════════════════════════════════════════
    // ACTION: scan — Fetch recent viral_titles_db + channel_intelligence
    // and compute/update viral scores
    // ═══════════════════════════════════════════════════════════
    if (action === "scan") {
      // Get recent videos from viral_titles_db
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      let query = sb.from("viral_titles_db").select("*").order("views", { ascending: false }).limit(limit);
      if (niche) query = query.eq("niche", niche);

      const { data: videos, error: vErr } = await query;
      if (vErr) throw new Error(`Failed to fetch videos: ${vErr.message}`);
      if (!videos || videos.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No videos to process", processed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: any[] = [];
      let breakouts = 0;
      let enriched_count = 0;

      // Process in batches of 10
      for (let i = 0; i < videos.length; i += 10) {
        const batch = videos.slice(i, i + 10);

        for (const video of batch) {
          try {
            // Enrich with YouTube stats if we have the API key
            let enrichedVideo = { ...video };
            if (YOUTUBE_API_KEY && video.channel_id) {
              enrichedVideo = await enrichWithYouTube(video, YOUTUBE_API_KEY);
              enriched_count++;
            }

            // Get channel median views for ratio calculation
            const channelMedian = await getChannelMedianViews(sb, video.channel_id || video.channel_name);

            // Compute viral score (enhanced 7-component formula)
            const scoreData = computeViralScore(enrichedVideo, channelMedian);

            // Upsert emerging channel if score is notable
            if (scoreData.score >= STRONG_SCORE && video.channel_id) {
              await sb.from("emerging_channels").upsert({
                channel_id: video.channel_id,
                channel_title: video.channel_name,
                niche: video.niche || "general",
                viral_score: Math.round(scoreData.score * 100),
                sample_video_id: video.id,
                last_checked: new Date().toISOString(),
                meta: {
                  views: enrichedVideo.views,
                  score_breakdown: scoreData.breakdown,
                  title: video.title,
                },
              }, { onConflict: "channel_id" }).catch(() => {});
            }

            // If breakout, reverse-engineer and queue script generation
            if (scoreData.score >= BREAKOUT_SCORE) {
              breakouts++;

              // Save viral pattern
              await sb.from("viral_patterns").insert({
                pattern_name: `auto-${video.channel_id || "unknown"}-${Date.now()}`,
                pattern_json: {
                  hook_text: video.title,
                  views: enrichedVideo.views,
                  viral_score: scoreData.score,
                  score_breakdown: scoreData.breakdown,
                  emotional_triggers: video.emotional_triggers || [],
                  title_pattern: video.title_pattern,
                },
                niche: video.niche || null,
                source_video: video.channel_id,
              }).catch(() => {});

              // Queue reverse engineering
              await sb.from("task_queue").insert({
                task_type: "reverse_engineer",
                payload: {
                  video_id: video.channel_id,
                  video_title: video.title,
                  channel_name: video.channel_name,
                  niche: video.niche,
                  views: enrichedVideo.views,
                  language: video.language || "pt",
                },
                status: "pending",
                scheduled_at: new Date().toISOString(),
              }).catch(() => {});
            }

            results.push({
              title: video.title?.slice(0, 60),
              score: Math.round(scoreData.score * 100),
              tier: scoreData.score >= BREAKOUT_SCORE ? "BREAKOUT" : scoreData.score >= STRONG_SCORE ? "STRONG" : "MONITOR",
            });

          } catch (e) {
            console.error(`Error processing video ${video.title}:`, e);
          }
        }

        // Rate limit: pause 500ms between batches
        if (i + 10 < videos.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Log execution
      await sb.from("execution_logs").insert({
        function_name: "viral-score-worker",
        success: true,
        duration_ms: Date.now() - startTime,
        api_calls_made: enriched_count,
        metadata: {
          action: "scan",
          videos_processed: results.length,
          breakouts,
          enriched: enriched_count,
          niche: niche || "all",
        },
      }).catch(() => {});

      // Save learnings to ai_learning
      if (breakouts > 0) {
        await sb.from("ai_learning").insert({
          topic: "viral_detection",
          insight: `Scan de ${results.length} vídeos: ${breakouts} breakouts detectados no nicho "${niche || "all"}". Top score: ${Math.max(...results.map(r => r.score))}/100.`,
          source: "viral-score-worker",
        }).catch(() => {});
      }

      return new Response(JSON.stringify({
        success: true,
        processed: results.length,
        breakouts,
        enriched: enriched_count,
        top_results: results.filter(r => r.score >= 50).sort((a, b) => b.score - a.score).slice(0, 20),
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ACTION: recalculate_batch — Recalculate scores for existing emerging_channels
    // ═══════════════════════════════════════════════════════════
    if (action === "recalculate_batch") {
      const { data: channels } = await sb.from("emerging_channels")
        .select("*").order("viral_score", { ascending: false }).limit(100);

      if (!channels || channels.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No channels to recalculate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      for (const ch of channels) {
        const meta = (ch.meta as any) || {};
        const score = computeViralScore(
          { views: meta.views || 0, likes: 0, comments: 0, published_at: ch.detected_at, duration_seconds: 600 },
          1
        );
        await sb.from("emerging_channels").update({
          viral_score: Math.round(score.score * 100),
          last_checked: new Date().toISOString(),
        }).eq("id", ch.id);
        updated++;
      }

      return new Response(JSON.stringify({ success: true, updated, duration_ms: Date.now() - startTime }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("viral-score-worker error:", e);
    await sb.from("execution_logs").insert({
      function_name: "viral-score-worker",
      success: false,
      duration_ms: Date.now() - startTime,
      error_message: e instanceof Error ? e.message : "Unknown",
    }).catch(() => {});
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Enhanced Viral Score (7-component formula from worker spec) ───
function computeViralScore(
  video: any,
  channelMedianViews: number,
): { score: number; breakdown: Record<string, number> } {
  const views = Number(video.views || 0);
  const likes = Number(video.likes || 0);
  const comments = Number(video.comments || 0);
  const durationSec = Number(video.duration_seconds || 600);
  const publishedAt = video.published_at ? new Date(video.published_at) : new Date();

  // Hours since publication
  const hoursSincePublish = Math.max((Date.now() - publishedAt.getTime()) / 3600000, 1);
  const viewsPerHour = views / hoursSincePublish;

  // View ratio vs channel average
  const viewsRatio = views / Math.max(1, channelMedianViews);

  // Average view duration estimate (25% of total if unknown)
  const avgViewDurationSec = video.avg_view_duration_seconds || durationSec * 0.25;
  const avdRatio = Math.min(1, avgViewDurationSec / Math.max(1, durationSec));

  // Engagement rates
  const commentRate = comments / Math.max(1, views);
  const likeRate = likes / Math.max(1, views);

  // Novelty and thumbnail (placeholders if not available)
  const novelty = video.novelty_score || 0.05;
  const thumbScore = video.thumbnail_features?.ctr_estimate || 0.05;

  // Weights from spec
  const w = { w1: 0.30, w2: 0.20, w3: 0.20, w4: 0.10, w5: 0.10, w6: 0.06, w7: 0.04 };

  // Normalize with tanh for smooth capping
  const nViews = Math.tanh(viewsRatio / 4);
  const nVPH = Math.tanh(viewsPerHour / 1000);
  const nAVD = avdRatio;
  const nComment = Math.tanh(commentRate * 100);
  const nLike = Math.tanh(likeRate * 100);

  const score = w.w1 * nViews + w.w2 * nVPH + w.w3 * nAVD + w.w4 * nComment + w.w5 * nLike + w.w6 * novelty + w.w7 * thumbScore;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      views_ratio: Math.round(nViews * 100) / 100,
      views_per_hour: Math.round(nVPH * 100) / 100,
      avg_view_duration: Math.round(nAVD * 100) / 100,
      comment_rate: Math.round(nComment * 100) / 100,
      like_rate: Math.round(nLike * 100) / 100,
      novelty: Math.round(novelty * 100) / 100,
      thumbnail: Math.round(thumbScore * 100) / 100,
      raw_views: views,
      raw_vph: Math.round(viewsPerHour),
      channel_median: channelMedianViews,
    },
  };
}

// ─── YouTube Stats Enrichment ───
async function enrichWithYouTube(video: any, apiKey: string): Promise<any> {
  try {
    const channelId = video.channel_id;
    if (!channelId) return video;

    // Fetch latest videos from channel to get fresh stats
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&order=date&maxResults=1&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return video;
    const searchData = await searchRes.json();

    const latestVideoId = searchData.items?.[0]?.id?.videoId;
    if (!latestVideoId) return video;

    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${latestVideoId}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    if (!statsRes.ok) return video;
    const statsData = await statsRes.json();
    const item = statsData.items?.[0];

    if (item) {
      return {
        ...video,
        views: Number(item.statistics?.viewCount || video.views || 0),
        likes: Number(item.statistics?.likeCount || 0),
        comments: Number(item.statistics?.commentCount || 0),
        duration_seconds: parseDuration(item.contentDetails?.duration || "PT0S"),
      };
    }
  } catch (e) {
    console.error("YouTube enrichment error:", e);
  }
  return video;
}

function parseDuration(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0));
}

// ─── Channel Median Views ───
async function getChannelMedianViews(sb: any, channelId: string | null): Promise<number> {
  if (!channelId) return 1;

  // Try viral_titles_db first
  const { data } = await sb.from("viral_titles_db")
    .select("views")
    .eq("channel_id", channelId)
    .order("published_at", { ascending: false })
    .limit(50);

  const arr = (data || []).map((x: any) => Number(x.views || 0)).sort((a: number, b: number) => a - b);
  if (arr.length === 0) {
    // Fallback to channel_intelligence
    const { data: ci } = await sb.from("channel_intelligence")
      .select("avg_views")
      .eq("youtube_channel_id", channelId)
      .maybeSingle();
    return ci?.avg_views || 1;
  }
  return arr[Math.floor(arr.length / 2)] || 1;
}
