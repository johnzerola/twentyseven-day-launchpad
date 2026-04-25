import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// YOUTUBE ANALYTICS COLLECTOR (cron-driven)
// Walks every connected OAuth channel and fills video_performance
// with REAL metrics (CTR, AVD, retention, impressions, watch time).
//
// Schedule (recommended via pg_cron):
//   • every 6h  → recently uploaded videos (< 48h since publish)
//   • every 24h → all videos still inside the 30-day window
//
// Service-role only. No user auth.
// ═══════════════════════════════════════════════════════════════

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_API_BASE = "https://www.googleapis.com/youtube/v3/videos";

interface CollectStats {
  channels_processed: number;
  videos_updated: number;
  videos_failed: number;
  videos_skipped: number;
  errors: string[];
}

class OAuthInvalidGrant extends Error {
  constructor(public detail: string) {
    super(`oauth_invalid_grant:${detail}`);
    this.name = "OAuthInvalidGrant";
  }
}

async function refreshToken(rt: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) {
    // invalid_grant means user revoked access or refresh_token expired
    if (data.error === "invalid_grant") {
      throw new OAuthInvalidGrant(data.error_description || data.error);
    }
    throw new Error(`oauth_refresh_failed:${data.error}`);
  }
  return data as { access_token: string; expires_in: number };
}

async function getValidToken(sb: any, row: any): Promise<string> {
  if (
    row.access_token &&
    row.token_expires_at &&
    new Date(row.token_expires_at).getTime() > Date.now() + 60_000
  ) {
    return row.access_token;
  }
  const refreshed = await refreshToken(row.refresh_token);
  await sb
    .from("youtube_oauth_tokens")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(
        Date.now() + refreshed.expires_in * 1000
      ).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

async function fetchVideoStats(videoId: string, accessToken: string) {
  const url = `${DATA_API_BASE}?part=statistics,contentDetails,snippet&id=${videoId}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.items?.[0] || null;
}

async function fetchAnalytics(
  videoId: string,
  channelId: string,
  accessToken: string,
  startDate: string,
  endDate: string
) {
  // Core metrics
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics:
      "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,impressions,impressionClickThroughRate",
    filters: `video==${videoId}`,
  });
  const r = await fetch(`${ANALYTICS_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const row = j?.rows?.[0];
  if (!row) return null;
  const headers = (j.columnHeaders || []).map((h: any) => h.name);
  const out: Record<string, number> = {};
  headers.forEach((name: string, i: number) => (out[name] = Number(row[i] || 0)));
  return out;
}

async function fetchRetentionCurve(
  videoId: string,
  channelId: string,
  accessToken: string,
  startDate: string,
  endDate: string
) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "audienceWatchRatio,relativeRetentionPerformance",
    dimensions: "elapsedVideoTimeRatio",
    filters: `video==${videoId}`,
  });
  const r = await fetch(`${ANALYTICS_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j?.rows?.length) return null;
  return j.rows.map((row: any[]) => ({
    t: Number(row[0]),
    watch: Number(row[1]),
    rel: Number(row[2] ?? 0),
  }));
}

function ageHours(d: string | null) {
  if (!d) return Infinity;
  return (Date.now() - new Date(d).getTime()) / 36e5;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const startTs = Date.now();
  const stats: CollectStats = {
    channels_processed: 0,
    videos_updated: 0,
    videos_failed: 0,
    videos_skipped: 0,
    errors: [],
  };

  let runMode = "incremental";
  let runUserId: string | null = null;
  let runTriggeredBy = "cron";
  let sbForLog: any = null;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      mode = "incremental", // 'incremental' (≤48h) | 'daily' (≤30d) | 'all'
      user_id, // optional — limit to one user
      max_videos_per_channel = 50,
      triggered_by = "cron",
    } = body || {};
    runMode = mode;
    runUserId = user_id ?? null;
    runTriggeredBy = triggered_by;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    sbForLog = sb;

    // 1) Pick OAuth-connected channels
    let tokQ = sb.from("youtube_oauth_tokens").select("*");
    if (user_id) tokQ = tokQ.eq("user_id", user_id);
    const { data: tokens, error: tokErr } = await tokQ;
    if (tokErr) throw tokErr;
    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: "no oauth channels", stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);

    for (const tok of tokens) {
      stats.channels_processed++;
      try {
        const accessToken = await getValidToken(sb, tok);

        // 2) Pick videos to refresh from video_performance
        let cutoffHours: number;
        switch (mode) {
          case "incremental":
            cutoffHours = 48;
            break;
          case "daily":
            cutoffHours = 24 * 30;
            break;
          default:
            cutoffHours = 24 * 90;
        }
        const cutoffISO = new Date(
          Date.now() - cutoffHours * 3600 * 1000
        ).toISOString();

        const { data: videos, error: vErr } = await sb
          .from("video_performance")
          .select(
            "id,youtube_video_id,published_at,user_id,project_id,channel_id,last_checked_at"
          )
          .eq("user_id", tok.user_id)
          .gte("published_at", cutoffISO)
          .order("published_at", { ascending: false })
          .limit(max_videos_per_channel);

        if (vErr) throw vErr;
        if (!videos?.length) {
          stats.videos_skipped++;
          continue;
        }

        for (const v of videos) {
          // Throttle: skip if checked recently (less than 4h for incremental, 12h for daily)
          const minHoursBetween = mode === "incremental" ? 4 : 12;
          if (
            v.last_checked_at &&
            ageHours(v.last_checked_at) < minHoursBetween
          ) {
            stats.videos_skipped++;
            continue;
          }

          try {
            // Resolve startDate
            const publishedAt = v.published_at
              ? new Date(v.published_at)
              : new Date(Date.now() - 30 * 86400 * 1000);
            const startDate = publishedAt.toISOString().slice(0, 10);

            const [vidStats, analytics, retention] = await Promise.all([
              fetchVideoStats(v.youtube_video_id, accessToken),
              fetchAnalytics(
                v.youtube_video_id,
                tok.channel_id,
                accessToken,
                startDate,
                endDate
              ),
              fetchRetentionCurve(
                v.youtube_video_id,
                tok.channel_id,
                accessToken,
                startDate,
                endDate
              ),
            ]);

            if (!analytics && !vidStats) {
              stats.videos_failed++;
              continue;
            }

            const update: any = {
              last_checked_at: new Date().toISOString(),
              check_count: 0, // bumped via SQL below
              oauth_synced: true,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (vidStats?.statistics) {
              update.views_current = Number(vidStats.statistics.viewCount || 0);
              update.views = update.views_current;
              update.likes = Number(vidStats.statistics.likeCount || 0);
              update.comments = Number(vidStats.statistics.commentCount || 0);
            }

            if (analytics) {
              update.ctr_percent = +(
                Number(analytics.impressionClickThroughRate || 0) * 100
              ).toFixed(2);
              update.ctr = update.ctr_percent;
              update.avg_view_duration_seconds = Math.round(
                Number(analytics.averageViewDuration || 0)
              );
              update.avg_view_duration_s = update.avg_view_duration_seconds;
              update.avg_retention_percent = +(
                Number(analytics.averageViewPercentage || 0)
              ).toFixed(2);
              update.impressions = Math.round(
                Number(analytics.impressions || 0)
              );
              update.subscribers_gained = Math.round(
                Number(analytics.subscribersGained || 0)
              );
              update.subscriber_gain = update.subscribers_gained;
              update.watch_time_minutes = Math.round(
                Number(analytics.estimatedMinutesWatched || 0)
              );
              update.watch_time_hours =
                Number(analytics.estimatedMinutesWatched || 0) / 60;
            }

            if (retention) {
              update.retention_curve = retention;
            }

            // Time-bucketed views snapshot
            const ageH = ageHours(v.published_at);
            if (ageH <= 36 && update.views_current != null)
              update.views_day1 = update.views_current;
            if (ageH <= 84 && update.views_current != null)
              update.views_day3 = update.views_current;
            if (ageH <= 196 && update.views_current != null)
              update.views_day7 = update.views_current;
            if (ageH <= 24 * 35 && update.views_current != null)
              update.views_day30 = update.views_current;

            // Performance grade (lightweight heuristic)
            if (
              update.ctr_percent != null &&
              update.avg_retention_percent != null
            ) {
              const score =
                (update.ctr_percent / 6) * 50 +
                (update.avg_retention_percent / 50) * 50;
              update.performance_grade =
                score >= 80
                  ? "viral"
                  : score >= 60
                  ? "strong"
                  : score >= 40
                  ? "average"
                  : "weak";
            }

            const { error: upErr } = await sb
              .from("video_performance")
              .update(update)
              .eq("id", v.id);

            if (upErr) {
              stats.videos_failed++;
              stats.errors.push(`upd ${v.youtube_video_id}: ${upErr.message}`);
              continue;
            }

            // Atomically bump check_count via RPC
            await sb
              .rpc("increment_video_check_count", { _id: v.id })
              .then(() => {}, () => {});

            stats.videos_updated++;

            // Tiny delay to avoid quota burst
            await new Promise((r) => setTimeout(r, 120));
          } catch (e: any) {
            stats.videos_failed++;
            stats.errors.push(
              `vid ${v.youtube_video_id}: ${e?.message || "unknown"}`
            );
          }
        }
      } catch (e: any) {
        const msg = e?.message || "unknown";
        stats.errors.push(`channel ${tok.channel_id}: ${msg}`);

        // OAuth revoked/expired → flag for reconnect, don't keep retrying
        if (e instanceof OAuthInvalidGrant || msg.includes("oauth_invalid_grant")) {
          await sb
            .from("youtube_oauth_tokens")
            .update({
              needs_reauth: true,
              last_oauth_error: msg.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq("id", tok.id)
            .then(() => {}, () => {});
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        duration_ms: Date.now() - startTs,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("youtube-analytics-collector error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message || "unknown",
        stats,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
