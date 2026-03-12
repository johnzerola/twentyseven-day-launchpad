import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const BREAKOUT_SCORE = 0.70;
const STRONG_SCORE = 0.50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const { hours = 72, niche, limit = 200, action = "scan" } = body;

    // ═══════════════════════════════════════════════════════════════
    // ACTION: scan — Full viral scan with new 7-signal formula
    // ═══════════════════════════════════════════════════════════════
    if (action === "scan") {
      let query = sb.from("viral_titles_db").select("*").order("views", { ascending: false }).limit(limit);
      if (niche) query = query.eq("niche", niche);

      const { data: videos, error: vErr } = await query;
      if (vErr) throw new Error(`Failed to fetch videos: ${vErr.message}`);
      if (!videos || videos.length === 0) {
        return jsonResponse({ success: true, message: "No videos to process", processed: 0 });
      }

      // Pre-compute cluster scores for all niches in this batch
      const clusterScores = await computeClusterScores(sb);

      const results: any[] = [];
      let breakouts = 0;
      let enriched_count = 0;

      for (let i = 0; i < videos.length; i += 10) {
        const batch = videos.slice(i, i + 10);

        for (const video of batch) {
          try {
            // Enrich with YouTube stats
            let enrichedVideo = { ...video };
            if (YOUTUBE_API_KEY && video.channel_id) {
              enrichedVideo = await enrichWithYouTube(video, YOUTUBE_API_KEY);
              enriched_count++;
            }

            // Enrich thumbnail via AI vision (if not already done)
            let thumbnailCtr = 0.05;
            if (LOVABLE_API_KEY && video.channel_id) {
              thumbnailCtr = await enrichThumbnailScore(sb, LOVABLE_API_KEY, video);
            }
            enrichedVideo.thumbnail_ctr = thumbnailCtr;

            // Get channel median for ratio
            const channelMedian = await getChannelMedianViews(sb, video.channel_id || video.channel_name);

            // Get velocity history for acceleration
            const velocityHistory = await getVelocityHistory(sb, video.channel_id);

            // Cluster score for this niche
            const clusterScore = clusterScores[video.niche || "general"] || 0;

            // Compute NEW viral score (7-signal professional formula)
            const scoreData = computeViralScoreV2(enrichedVideo, channelMedian, velocityHistory, clusterScore);

            // Upsert emerging channel
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
                  formula_version: "v2",
                },
              }, { onConflict: "channel_id" }).catch(() => {});
            }

            // Breakout → reverse-engineer + queue
            if (scoreData.score >= BREAKOUT_SCORE) {
              breakouts++;

              await sb.from("viral_patterns").insert({
                pattern_name: `v2-${video.channel_id || "unknown"}-${Date.now()}`,
                pattern_json: {
                  hook_text: video.title,
                  views: enrichedVideo.views,
                  viral_score: scoreData.score,
                  score_breakdown: scoreData.breakdown,
                  emotional_triggers: video.emotional_triggers || [],
                  title_pattern: video.title_pattern,
                  formula: "v2_7signal",
                },
                niche: video.niche || null,
                source_video: video.channel_id,
              }).catch(() => {});

              await sb.from("task_queue").insert({
                task_type: "reverse_engineer",
                payload: {
                  video_id: video.channel_id,
                  video_title: video.title,
                  channel_name: video.channel_name,
                  niche: video.niche,
                  views: enrichedVideo.views,
                  language: video.language || "pt",
                  viral_score: scoreData.score,
                },
                status: "pending",
              }).catch(() => {});
            }

            results.push({
              title: video.title?.slice(0, 60),
              score: Math.round(scoreData.score * 100),
              tier: scoreData.score >= BREAKOUT_SCORE ? "BREAKOUT" : scoreData.score >= STRONG_SCORE ? "STRONG" : "MONITOR",
              breakdown: scoreData.breakdown,
            });
          } catch (e) {
            console.error(`Error processing video ${video.title}:`, e);
          }
        }

        if (i + 10 < videos.length) await new Promise(r => setTimeout(r, 500));
      }

      // Log execution
      await sb.from("execution_logs").insert({
        function_name: "viral-score-worker",
        success: true,
        duration_ms: Date.now() - startTime,
        api_calls_made: enriched_count,
        metadata: { action: "scan", videos_processed: results.length, breakouts, enriched: enriched_count, niche: niche || "all", formula: "v2" },
      });

      if (breakouts > 0) {
        await sb.from("ai_learning").insert({
          topic: "viral_detection_v2",
          insight: `V2 Scan: ${results.length} vídeos → ${breakouts} breakouts (nicho: ${niche || "all"}). Top: ${Math.max(...results.map(r => r.score))}/100. Fórmula: 7-signal com velocity_accel + cluster + retention_proxy.`,
          source: "viral-score-worker-v2",
        });
      }

      return jsonResponse({
        success: true, processed: results.length, breakouts, enriched: enriched_count,
        formula_version: "v2",
        top_results: results.filter(r => r.score >= 50).sort((a, b) => b.score - a.score).slice(0, 20),
        cluster_signals: clusterScores,
        duration_ms: Date.now() - startTime,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: recalculate_batch
    // ═══════════════════════════════════════════════════════════════
    if (action === "recalculate_batch") {
      const { data: channels } = await sb.from("emerging_channels")
        .select("*").order("viral_score", { ascending: false }).limit(100);

      if (!channels?.length) return jsonResponse({ success: true, message: "No channels to recalculate" });

      const clusterScores = await computeClusterScores(sb);
      let updated = 0;

      for (const ch of channels) {
        const meta = (ch.meta as any) || {};
        const score = computeViralScoreV2(
          { views: meta.views || 0, likes: 0, comments: 0, published_at: ch.detected_at, duration_seconds: 600 },
          1, [], clusterScores[ch.niche || "general"] || 0
        );
        await sb.from("emerging_channels").update({
          viral_score: Math.round(score.score * 100),
          last_checked: new Date().toISOString(),
          meta: { ...meta, score_breakdown: score.breakdown, formula_version: "v2" },
        }).eq("id", ch.id);
        updated++;
      }

      return jsonResponse({ success: true, updated, formula: "v2", duration_ms: Date.now() - startTime });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (e) {
    console.error("viral-score-worker error:", e);
    await sb.from("execution_logs").insert({
      function_name: "viral-score-worker",
      success: false,
      duration_ms: Date.now() - startTime,
      error_message: e instanceof Error ? e.message : "Unknown",
    }).catch(() => {});
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// NEW V2 VIRAL SCORE — 7-Signal Professional Formula
// ═══════════════════════════════════════════════════════════════════
//
// viral_score = 
//   0.25 × view_ratio        (views vs channel median)
//   0.20 × velocity           (views per hour, normalized)
//   0.15 × velocity_accel     (acceleration: current vs previous velocity)
//   0.15 × estimated_retention (AVD / video_length proxy)
//   0.10 × comment_velocity   (comments_per_hour / views_per_hour)
//   0.10 × thumbnail_score    (AI-analyzed CTR estimate)
//   0.05 × novelty            (cluster uniqueness signal)
//
function computeViralScoreV2(
  video: any,
  channelMedianViews: number,
  velocityHistory: number[],
  clusterScore: number,
): { score: number; breakdown: Record<string, number> } {
  const views = Number(video.views || 0);
  const likes = Number(video.likes || 0);
  const comments = Number(video.comments || 0);
  const durationSec = Number(video.duration_seconds || 600);
  const publishedAt = video.published_at ? new Date(video.published_at) : new Date();

  const hoursSincePublish = Math.max((Date.now() - publishedAt.getTime()) / 3600000, 1);

  // ── Signal 1: View Ratio (0.25) ──
  const viewsRatio = views / Math.max(1, channelMedianViews);
  const normViewRatio = Math.tanh(viewsRatio / 4);

  // ── Signal 2: Velocity (0.20) ──
  const viewsPerHour = views / hoursSincePublish;
  const normVelocity = Math.tanh(viewsPerHour / 1000);

  // ── Signal 3: Velocity Acceleration (0.15) ──
  // Compare current VPH to previous period's VPH
  // If accelerating → video is gaining momentum (very bullish signal)
  const prevVph = velocityHistory.length > 0
    ? velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length
    : viewsPerHour * 0.8; // assume 80% of current if no history
  const velocityAccel = prevVph > 0 ? (viewsPerHour - prevVph) / prevVph : 0;
  const normVelocityAccel = Math.tanh(Math.max(0, velocityAccel)); // only positive acceleration matters

  // ── Signal 4: Estimated Retention (0.15) ──
  // Without real YouTube Analytics, proxy via engagement signals
  // estimated_retention = avg_view_duration / video_length
  // Proxy AVD from likes/comments engagement + duration
  const engagementRate = (likes + comments * 3) / Math.max(1, views); // comments weighted 3x
  const estimatedAvdRatio = Math.min(1, 0.25 + engagementRate * 10); // base 25% + engagement boost
  const normRetention = estimatedAvdRatio;

  // ── Signal 5: Comment Velocity (0.10) ──
  // comments_per_hour / views_per_hour = comment density
  const commentsPerHour = comments / hoursSincePublish;
  const commentVelocity = viewsPerHour > 0 ? commentsPerHour / viewsPerHour : 0;
  const normCommentVelocity = Math.tanh(commentVelocity * 50);

  // ── Signal 6: Thumbnail Score (0.10) ──
  const thumbScore = Math.min(1, (video.thumbnail_ctr || 0.05) / 10);

  // ── Signal 7: Novelty / Cluster Signal (0.05) ──
  // If multiple small channels explode in same niche = opportunity signal
  const normNovelty = Math.min(1, clusterScore);

  // ── Weighted Sum ──
  const W = { w1: 0.25, w2: 0.20, w3: 0.15, w4: 0.15, w5: 0.10, w6: 0.10, w7: 0.05 };
  const score =
    W.w1 * normViewRatio +
    W.w2 * normVelocity +
    W.w3 * normVelocityAccel +
    W.w4 * normRetention +
    W.w5 * normCommentVelocity +
    W.w6 * thumbScore +
    W.w7 * normNovelty;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      view_ratio: round2(normViewRatio),
      velocity: round2(normVelocity),
      velocity_acceleration: round2(normVelocityAccel),
      estimated_retention: round2(normRetention),
      comment_velocity: round2(normCommentVelocity),
      thumbnail_score: round2(thumbScore),
      novelty_cluster: round2(normNovelty),
      raw: {
        views, vph: Math.round(viewsPerHour), channel_median: channelMedianViews,
        velocity_accel_pct: round2(velocityAccel * 100),
        est_avd_ratio: round2(estimatedAvdRatio),
        comment_density: round2(commentVelocity),
        cluster_score: round2(clusterScore),
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Cluster Detection: 3+ small channels exploding in same niche
// ═══════════════════════════════════════════════════════════════════
async function computeClusterScores(sb: any): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  // Get recently growing channels grouped by niche
  const { data: emerging } = await sb.from("emerging_channels")
    .select("niche, viral_score, channel_id")
    .gte("last_checked", new Date(Date.now() - 7 * 86400_000).toISOString())
    .gte("viral_score", 30);

  if (!emerging?.length) return scores;

  // Group by niche and count growing channels
  const nicheMap: Record<string, number[]> = {};
  for (const ch of emerging) {
    const n = ch.niche || "general";
    if (!nicheMap[n]) nicheMap[n] = [];
    nicheMap[n].push(ch.viral_score || 0);
  }

  // Get total channels per niche from channel_intelligence
  const { data: totalChannels } = await sb.from("channel_intelligence")
    .select("niche")
    .limit(500);

  const totalPerNiche: Record<string, number> = {};
  for (const ch of (totalChannels || [])) {
    totalPerNiche[ch.niche] = (totalPerNiche[ch.niche] || 0) + 1;
  }

  // cluster_score = channels_growing_same_keyword / total_channels
  // Boosted if 3+ channels are growing simultaneously
  for (const [n, growingScores] of Object.entries(nicheMap)) {
    const growing = growingScores.length;
    const total = Math.max(1, totalPerNiche[n] || growing);
    const ratio = growing / total;

    // Cluster signal: strong if 3+ channels growing in same niche
    const clusterBonus = growing >= 3 ? 0.3 : growing >= 2 ? 0.1 : 0;
    scores[n] = Math.min(1, ratio + clusterBonus);
  }

  return scores;
}

// ═══════════════════════════════════════════════════════════════════
// Velocity History — for acceleration computation
// ═══════════════════════════════════════════════════════════════════
async function getVelocityHistory(sb: any, channelId: string | null): Promise<number[]> {
  if (!channelId) return [];

  // Check if we have previous scan data in emerging_channels meta
  const { data: ch } = await sb.from("emerging_channels")
    .select("meta")
    .eq("channel_id", channelId)
    .maybeSingle();

  const meta = (ch?.meta as any) || {};
  if (meta.score_breakdown?.raw?.vph) {
    return [meta.score_breakdown.raw.vph]; // previous velocity
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════
// Thumbnail Enrichment via AI Vision
// ═══════════════════════════════════════════════════════════════════
async function enrichThumbnailScore(sb: any, lovableKey: string, video: any): Promise<number> {
  // Check if already analyzed
  const { data: existing } = await sb.from("thumbnail_features")
    .select("ctr_estimate")
    .eq("video_id", video.channel_id || video.id || "")
    .maybeSingle();

  if (existing?.ctr_estimate) return existing.ctr_estimate;

  // No real thumbnail URL in viral_titles_db, return default
  // (auto-enrich-worker handles real thumbnail analysis with YouTube API)
  return 0.05;
}

// ═══════════════════════════════════════════════════════════════════
// YouTube Stats Enrichment
// ═══════════════════════════════════════════════════════════════════
async function enrichWithYouTube(video: any, apiKey: string): Promise<any> {
  try {
    const channelId = video.channel_id;
    if (!channelId) return video;

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

async function getChannelMedianViews(sb: any, channelId: string | null): Promise<number> {
  if (!channelId) return 1;
  const { data } = await sb.from("viral_titles_db")
    .select("views").eq("channel_id", channelId)
    .order("published_at", { ascending: false }).limit(50);

  const arr = (data || []).map((x: any) => Number(x.views || 0)).sort((a: number, b: number) => a - b);
  if (arr.length === 0) {
    const { data: ci } = await sb.from("channel_intelligence")
      .select("avg_views").eq("youtube_channel_id", channelId).maybeSingle();
    return ci?.avg_views || 1;
  }
  return arr[Math.floor(arr.length / 2)] || 1;
}

// ─── Helpers ─────────────────────────────────────────────────
function round2(n: number): number { return Math.round(n * 100) / 100; }

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
