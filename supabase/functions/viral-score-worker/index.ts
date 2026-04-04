import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const BREAKOUT_SCORE = 0.70;
const STRONG_SCORE = 0.50;

// ═══════════════════════════════════════════════════════════════════
// ECONOMY CONFIG — Prevent runaway costs
// ═══════════════════════════════════════════════════════════════════
const MAX_RUNS_PER_DAY = 3;           // Max 3 scans per day (was unlimited!)
const MAX_YOUTUBE_CALLS_PER_RUN = 15; // Max 15 YouTube enrichments per run (was 50+)
const MIN_INTERVAL_HOURS = 6;         // Minimum 6h between runs
const MAX_BATCH_SIZE = 50;            // Process max 50 videos per run (was 200)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const { hours = 72, niche, limit = MAX_BATCH_SIZE, action = "scan", force = false } = body;

    // ═══════════════════════════════════════════════════════════════
    // THROTTLE CHECK — Prevent runaway execution
    // ═══════════════════════════════════════════════════════════════
    if (action === "scan" && !force) {
      const throttleCheck = await checkThrottle(sb);
      if (!throttleCheck.allowed) {
        return jsonResponse({
          success: true,
          throttled: true,
          reason: throttleCheck.reason,
          next_allowed_at: throttleCheck.nextAllowedAt,
          runs_today: throttleCheck.runsToday,
          message: `Economia ativa: ${throttleCheck.reason}`,
        });
      }
    }

    if (action === "scan") {
      const effectiveLimit = Math.min(limit, MAX_BATCH_SIZE);
      let query = sb.from("viral_titles_db").select("*").order("views", { ascending: false }).limit(effectiveLimit);
      if (niche) query = query.eq("niche", niche);

      const { data: videos, error: vErr } = await query;
      if (vErr) throw new Error(`Failed to fetch videos: ${vErr.message}`);
      if (!videos || videos.length === 0) {
        return jsonResponse({ success: true, message: "No videos to process", processed: 0 });
      }

      const clusterScores = await computeClusterScores(sb);
      const crossNicheMomentum = await computeCrossNicheMomentum(sb);

      const results: any[] = [];
      let breakouts = 0;
      let enriched_count = 0;
      let youtube_calls = 0;

      for (let i = 0; i < videos.length; i += 10) {
        const batch = videos.slice(i, i + 10);

        for (const video of batch) {
          try {
            let enrichedVideo = { ...video };
            
            // ECONOMY: Only enrich with YouTube if under call limit
            if (YOUTUBE_API_KEY && video.channel_id && youtube_calls < MAX_YOUTUBE_CALLS_PER_RUN) {
              // Check YouTube API quota before calling
              const { data: ytAllowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
              if (ytAllowed) {
                enrichedVideo = await enrichWithYouTube(video, YOUTUBE_API_KEY);
                enriched_count++;
                youtube_calls++;
              }
            }

            let thumbnailCtr = 0.05;
            // ECONOMY: Skip thumbnail AI analysis — use cached or default
            if (video.channel_id) {
              thumbnailCtr = await getCachedThumbnailScore(sb, video);
            }
            enrichedVideo.thumbnail_ctr = thumbnailCtr;

            const channelMedian = await getChannelMedianViews(sb, video.channel_id || video.channel_name);
            const velocityHistory = await getVelocityHistory(sb, video.channel_id);
            const clusterScore = clusterScores[video.niche || "general"] || 0;
            const crossMomentum = crossNicheMomentum[video.niche || "general"] || 0;

            const scoreData = computeViralScoreV3(enrichedVideo, channelMedian, velocityHistory, clusterScore, crossMomentum);

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
                  formula_version: "v3",
                },
              }, { onConflict: "channel_id" });
            }

            if (scoreData.score >= BREAKOUT_SCORE) {
              breakouts++;

              await sb.from("viral_patterns").insert({
                pattern_name: `v3-${video.channel_id || "unknown"}-${Date.now()}`,
                pattern_json: {
                  hook_text: video.title,
                  views: enrichedVideo.views,
                  viral_score: scoreData.score,
                  score_breakdown: scoreData.breakdown,
                  emotional_triggers: video.emotional_triggers || [],
                  title_pattern: video.title_pattern,
                  formula: "v3_9signal",
                },
                niche: video.niche || null,
                source_video: video.channel_id,
              });

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
              });
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

      await sb.from("execution_logs").insert({
        function_name: "viral-score-worker",
        success: true,
        duration_ms: Date.now() - startTime,
        api_calls_made: youtube_calls,
        metadata: {
          action: "scan",
          videos_processed: results.length,
          breakouts,
          enriched: enriched_count,
          youtube_calls,
          youtube_limit: MAX_YOUTUBE_CALLS_PER_RUN,
          niche: niche || "all",
          formula: "v3",
          economy_mode: true,
        },
      });

      if (breakouts > 0) {
        await sb.from("ai_learning").insert({
          topic: "viral_detection_v3",
          insight: `V3 Scan: ${results.length} vídeos → ${breakouts} breakouts (nicho: ${niche || "all"}). Top: ${Math.max(...results.map(r => r.score))}/100.`,
          source: "viral-score-worker-v3",
        });
      }

      return jsonResponse({
        success: true, processed: results.length, breakouts, enriched: enriched_count,
        youtube_calls_used: youtube_calls,
        youtube_calls_limit: MAX_YOUTUBE_CALLS_PER_RUN,
        formula_version: "v3",
        economy_mode: true,
        top_results: results.filter(r => r.score >= 50).sort((a, b) => b.score - a.score).slice(0, 20),
        cluster_signals: clusterScores,
        cross_niche_momentum: crossNicheMomentum,
        duration_ms: Date.now() - startTime,
      });
    }

    if (action === "recalculate_batch") {
      const { data: channels } = await sb.from("emerging_channels")
        .select("*").order("viral_score", { ascending: false }).limit(50); // Was 100

      if (!channels?.length) return jsonResponse({ success: true, message: "No channels to recalculate" });

      const clusterScores = await computeClusterScores(sb);
      const crossNicheMomentum = await computeCrossNicheMomentum(sb);
      let updated = 0;

      for (const ch of channels) {
        const meta = (ch.meta as any) || {};
        const score = computeViralScoreV3(
          { views: meta.views || 0, likes: 0, comments: 0, published_at: ch.detected_at, duration_seconds: 600 },
          1, [], clusterScores[ch.niche || "general"] || 0, crossNicheMomentum[ch.niche || "general"] || 0
        );
        await sb.from("emerging_channels").update({
          viral_score: Math.round(score.score * 100),
          last_checked: new Date().toISOString(),
          meta: { ...meta, score_breakdown: score.breakdown, formula_version: "v3" },
        }).eq("id", ch.id);
        updated++;
      }

      return jsonResponse({ success: true, updated, formula: "v3", duration_ms: Date.now() - startTime });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (e) {
    console.error("viral-score-worker error:", e);
    await sb.from("execution_logs").insert({
      function_name: "viral-score-worker",
      success: false,
      duration_ms: Date.now() - startTime,
      error_message: e instanceof Error ? e.message : "Unknown",
    });
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// THROTTLE — Self-protection against runaway crons
// ═══════════════════════════════════════════════════════════════════
async function checkThrottle(sb: any): Promise<{ allowed: boolean; reason?: string; runsToday?: number; nextAllowedAt?: string }> {
  const today = new Date().toISOString().slice(0, 10);

  // Count runs today
  const { data: todayLogs } = await sb.from("execution_logs")
    .select("created_at")
    .eq("function_name", "viral-score-worker")
    .eq("success", true)
    .gte("created_at", `${today}T00:00:00Z`)
    .order("created_at", { ascending: false });

  const runsToday = todayLogs?.length || 0;

  if (runsToday >= MAX_RUNS_PER_DAY) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return {
      allowed: false,
      reason: `Limite diário atingido (${runsToday}/${MAX_RUNS_PER_DAY} runs)`,
      runsToday,
      nextAllowedAt: tomorrow.toISOString(),
    };
  }

  // Check minimum interval
  if (todayLogs && todayLogs.length > 0) {
    const lastRun = new Date(todayLogs[0].created_at);
    const hoursSinceLastRun = (Date.now() - lastRun.getTime()) / 3600000;
    if (hoursSinceLastRun < MIN_INTERVAL_HOURS) {
      const nextAllowed = new Date(lastRun.getTime() + MIN_INTERVAL_HOURS * 3600000);
      return {
        allowed: false,
        reason: `Intervalo mínimo: ${MIN_INTERVAL_HOURS}h (última run: ${hoursSinceLastRun.toFixed(1)}h atrás)`,
        runsToday,
        nextAllowedAt: nextAllowed.toISOString(),
      };
    }
  }

  return { allowed: true, runsToday };
}

// ═══════════════════════════════════════════════════════════════════
// V3 VIRAL SCORE — 9-Signal Algorithm
// ═══════════════════════════════════════════════════════════════════
function computeViralScoreV3(
  video: any,
  channelMedianViews: number,
  velocityHistory: number[],
  clusterScore: number,
  crossNicheMomentum: number,
): { score: number; breakdown: Record<string, number> } {
  const views = Number(video.views || 0);
  const likes = Number(video.likes || 0);
  const comments = Number(video.comments || 0);
  const durationSec = Number(video.duration_seconds || 600);
  const publishedAt = video.published_at ? new Date(video.published_at) : new Date();

  const hoursSincePublish = Math.max((Date.now() - publishedAt.getTime()) / 3600000, 1);
  const daysSincePublish = hoursSincePublish / 24;

  const viewsRatio = views / Math.max(1, channelMedianViews);
  const normViewRatio = Math.tanh(viewsRatio / 4);

  const viewsPerHour = views / hoursSincePublish;
  const normVelocity = Math.tanh(viewsPerHour / 1000);

  const prevVph = velocityHistory.length > 0
    ? velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length
    : viewsPerHour * 0.8;
  const velocityAccel = prevVph > 0 ? (viewsPerHour - prevVph) / prevVph : 0;
  const normVelocityAccel = Math.tanh(Math.max(0, velocityAccel));

  const engagementRate = (likes + comments * 3) / Math.max(1, views);
  const estimatedAvdRatio = Math.min(1, 0.25 + engagementRate * 10);
  const normRetention = estimatedAvdRatio;

  const recencyDecay = Math.exp(-0.693 * daysSincePublish / 14);
  const normRecency = Math.min(1, recencyDecay);

  const likeRatio = likes / Math.max(1, views);
  const commentRatio = comments / Math.max(1, views);
  const likeQuality = Math.min(1, likeRatio / 0.04);
  const commentQuality = Math.min(1, commentRatio / 0.005);
  const normEngagementQuality = likeQuality * 0.5 + commentQuality * 0.5;

  const commentsPerHour = comments / hoursSincePublish;
  const commentVelocity = viewsPerHour > 0 ? commentsPerHour / viewsPerHour : 0;
  const normCommentVelocity = Math.tanh(commentVelocity * 50);

  const thumbScore = Math.min(1, (video.thumbnail_ctr || 0.05) / 10);

  const normCrossNiche = Math.min(1, (clusterScore * 0.6 + crossNicheMomentum * 0.4));

  const W = { w1: 0.20, w2: 0.15, w3: 0.12, w4: 0.12, w5: 0.10, w6: 0.10, w7: 0.08, w8: 0.08, w9: 0.05 };
  const score =
    W.w1 * normViewRatio +
    W.w2 * normVelocity +
    W.w3 * normVelocityAccel +
    W.w4 * normRetention +
    W.w5 * normRecency +
    W.w6 * normEngagementQuality +
    W.w7 * normCommentVelocity +
    W.w8 * thumbScore +
    W.w9 * normCrossNiche;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      view_ratio: round2(normViewRatio),
      velocity: round2(normVelocity),
      velocity_acceleration: round2(normVelocityAccel),
      estimated_retention: round2(normRetention),
      recency_decay: round2(normRecency),
      engagement_quality: round2(normEngagementQuality),
      comment_velocity: round2(normCommentVelocity),
      thumbnail_score: round2(thumbScore),
      cross_niche_signal: round2(normCrossNiche),
      raw: {
        views, vph: Math.round(viewsPerHour), channel_median: channelMedianViews,
        velocity_accel_pct: round2(velocityAccel * 100),
        est_avd_ratio: round2(estimatedAvdRatio),
        comment_density: round2(commentVelocity),
        cluster_score: round2(clusterScore),
        days_since_publish: round2(daysSincePublish),
        like_ratio_pct: round2(likeRatio * 100),
        comment_ratio_pct: round2(commentRatio * 100),
        cross_niche_momentum: round2(crossNicheMomentum),
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Cluster Detection
// ═══════════════════════════════════════════════════════════════════
async function computeClusterScores(sb: any): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};

  const { data: emerging } = await sb.from("emerging_channels")
    .select("niche, viral_score, channel_id")
    .gte("last_checked", new Date(Date.now() - 7 * 86400_000).toISOString())
    .gte("viral_score", 30);

  if (!emerging?.length) return scores;

  const nicheMap: Record<string, number[]> = {};
  for (const ch of emerging) {
    const n = ch.niche || "general";
    if (!nicheMap[n]) nicheMap[n] = [];
    nicheMap[n].push(ch.viral_score || 0);
  }

  const { data: totalChannels } = await sb.from("channel_intelligence")
    .select("niche").limit(500);

  const totalPerNiche: Record<string, number> = {};
  for (const ch of (totalChannels || [])) {
    totalPerNiche[ch.niche] = (totalPerNiche[ch.niche] || 0) + 1;
  }

  for (const [n, growingScores] of Object.entries(nicheMap)) {
    const growing = growingScores.length;
    const total = Math.max(1, totalPerNiche[n] || growing);
    const ratio = growing / total;
    const avgScore = growingScores.reduce((a, b) => a + b, 0) / growing;
    const clusterBonus = growing >= 5 ? 0.4 : growing >= 3 ? 0.3 : growing >= 2 ? 0.1 : 0;
    const qualityBonus = avgScore > 60 ? 0.15 : avgScore > 40 ? 0.05 : 0;
    scores[n] = Math.min(1, ratio + clusterBonus + qualityBonus);
  }

  return scores;
}

// ═══════════════════════════════════════════════════════════════════
// Cross-Niche Momentum
// ═══════════════════════════════════════════════════════════════════
async function computeCrossNicheMomentum(sb: any): Promise<Record<string, number>> {
  const momentum: Record<string, number> = {};

  const { data: recentViral } = await sb.from("viral_titles_db")
    .select("niche, views")
    .gte("published_at", new Date(Date.now() - 14 * 86400_000).toISOString())
    .order("views", { ascending: false })
    .limit(200);

  if (!recentViral?.length) return momentum;

  const nicheActivity: Record<string, { count: number; totalViews: number }> = {};
  for (const v of recentViral) {
    const n = v.niche || "general";
    if (!nicheActivity[n]) nicheActivity[n] = { count: 0, totalViews: 0 };
    nicheActivity[n].count++;
    nicheActivity[n].totalViews += Number(v.views || 0);
  }

  const activeNiches = Object.entries(nicheActivity).filter(([_, v]) => v.count >= 3);
  const totalActiveNiches = activeNiches.length;

  for (const [niche] of Object.entries(nicheActivity)) {
    const otherActive = activeNiches.filter(([n]) => n !== niche).length;
    momentum[niche] = Math.min(1, otherActive / Math.max(1, totalActiveNiches) + (nicheActivity[niche].count >= 5 ? 0.2 : 0));
  }

  return momentum;
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
async function getVelocityHistory(sb: any, channelId: string | null): Promise<number[]> {
  if (!channelId) return [];
  
  // Step 1: Find youtube_video_ids for this channel from viral_titles_db
  const { data: channelVideos } = await sb.from("viral_titles_db")
    .select("id")
    .eq("channel_id", channelId)
    .order("published_at", { ascending: false })
    .limit(20);
  
  const videoIds = (channelVideos || []).map((v: any) => v.id).filter(Boolean);
  
  // Step 2: Get real velocity from video_performance for these specific videos
  if (videoIds.length > 0) {
    const { data: perfData } = await sb.from("video_performance")
      .select("views_day1, views_day3, views_day7, published_at, youtube_video_id")
      .in("youtube_video_id", videoIds.slice(0, 15))
      .not("views_day1", "is", null)
      .order("published_at", { ascending: false })
      .limit(10);
    
    if (perfData?.length) {
      const velocities = perfData
        .filter((p: any) => p.views_day1 > 0 && p.published_at)
        .map((p: any) => {
          // Use 48h velocity: views_day3 gives ~72h, views_day1 gives ~24h
          // Calculate views-per-hour from the earliest available snapshot
          if (p.views_day1) return p.views_day1 / 24; // views per hour in first 24h
          if (p.views_day3) return p.views_day3 / 72;
          if (p.views_day7) return p.views_day7 / 168;
          return 0;
        })
        .filter((v: number) => v > 0);
      if (velocities.length > 0) return velocities;
    }
  }

  // Fallback: velocity_snapshots (realtime tracking data)
  const { data: snapshots } = await sb.from("velocity_snapshots")
    .select("views_per_hour")
    .eq("channel_id", channelId)
    .order("snapshot_at", { ascending: false })
    .limit(5);
  
  if (snapshots?.length) {
    return snapshots.map((s: any) => s.views_per_hour || 0).filter((v: number) => v > 0);
  }

  // Final fallback: emerging_channels meta
  const { data: ch } = await sb.from("emerging_channels")
    .select("meta").eq("channel_id", channelId).maybeSingle();
  const meta = (ch?.meta as any) || {};
  if (meta.score_breakdown?.raw?.vph) return [meta.score_breakdown.raw.vph];
  return [];
}

// ECONOMY: Only use cached thumbnail scores, no AI calls
async function getCachedThumbnailScore(sb: any, video: any): Promise<number> {
  const { data: existing } = await sb.from("thumbnail_features")
    .select("ctr_estimate").eq("video_id", video.channel_id || video.id || "").maybeSingle();
  if (existing?.ctr_estimate) return existing.ctr_estimate;
  return 0.05;
}

async function enrichWithYouTube(video: any, apiKey: string): Promise<any> {
  try {
    const channelId = video.channel_id;
    if (!channelId) return video;

    // ECONOMY: Single API call instead of 2 — use channel's latest video stats
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

function round2(n: number): number { return Math.round(n * 100) / 100; }

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
