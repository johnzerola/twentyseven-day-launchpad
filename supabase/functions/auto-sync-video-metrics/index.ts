import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AUTO-SYNC-VIDEO-METRICS (cheap daily job)
 *
 * Strategy to keep YouTube Data API quota low:
 *  - Only refresh videos published in the last 14 days (active growth window)
 *    PLUS a small set of "tracked" videos already in video_performance.
 *  - One batched `videos?id=...` call per channel (≤50 IDs = 1 quota unit).
 *  - Throttle: skip channel if last_synced_at < 20h ago (unless force=true).
 *  - Hard ceiling: MAX_CHANNELS per invocation (default 50).
 *  - Recompute performance_score + CTR + avg_views_30d on user_channels.
 *
 * Body: { userId?, channelId?, force?: boolean, maxChannels?: number }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const YOUTUBE_API_KEY =
    Deno.env.get("YOUTUBE_API_KEY") ??
    Deno.env.get("YOUTUBE_API_KEY_2") ??
    Deno.env.get("YOUTUBE_API_KEY_3");

  if (!YOUTUBE_API_KEY) {
    return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* GET / empty */ }
  const { userId, channelId, force = false, maxChannels = 50 } = body;

  // 1. Pick channels to refresh (oldest sync first so quota is fair)
  let q = sb
    .from("user_channels")
    .select("id, user_id, channel_name, youtube_channel_id, niche, last_synced_at, avg_views_30d, avg_ctr_30d")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(maxChannels);
  if (userId) q = q.eq("user_id", userId);
  if (channelId) q = q.eq("id", channelId);
  const { data: channels, error: chErr } = await q;
  if (chErr) {
    return jsonResp({ error: chErr.message }, 500);
  }
  if (!channels?.length) return jsonResp({ message: "no channels", processed: 0 });

  const now = Date.now();
  const FOURTEEN_DAYS = 14 * 86400000;
  const THIRTY_DAYS = 30 * 86400000;
  const results: any[] = [];
  let totalQuotaUnits = 0;

  for (const ch of channels) {
    try {
      // Throttle 20h
      if (!force && ch.last_synced_at) {
        const ageH = (now - new Date(ch.last_synced_at).getTime()) / 3600000;
        if (ageH < 20) {
          results.push({ channel: ch.channel_name, skipped: `synced ${Math.round(ageH)}h ago` });
          continue;
        }
      }

      // 2. Collect candidate video IDs:
      //    a) videos already in video_performance for this channel published last 14d
      //    b) NEW recent videos from channel uploads (limited)
      const { data: tracked } = await sb
        .from("video_performance")
        .select("youtube_video_id, published_at")
        .eq("channel_id", ch.id)
        .gte("published_at", new Date(now - FOURTEEN_DAYS).toISOString())
        .limit(40);

      const trackedIds = new Set<string>(
        (tracked || []).map((r: any) => r.youtube_video_id).filter(Boolean),
      );

      // Get latest 5 uploads (1 quota unit) — only if we have room or no tracked
      if (trackedIds.size < 30) {
        const chRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ch.youtube_channel_id}&key=${YOUTUBE_API_KEY}`,
        );
        totalQuotaUnits += 1;
        const chJson = await chRes.json();
        const uploads = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploads) {
          const plRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=10&key=${YOUTUBE_API_KEY}`,
          );
          totalQuotaUnits += 1;
          const plJson = await plRes.json();
          for (const it of plJson.items || []) {
            const vid = it.snippet?.resourceId?.videoId;
            const pub = it.snippet?.publishedAt;
            if (vid && pub && new Date(pub).getTime() >= now - FOURTEEN_DAYS) {
              trackedIds.add(vid);
            }
          }
        }
      }

      const ids = Array.from(trackedIds).slice(0, 50);
      if (ids.length === 0) {
        await sb.from("user_channels").update({ last_synced_at: new Date().toISOString() }).eq("id", ch.id);
        results.push({ channel: ch.channel_name, videos: 0, note: "no recent videos" });
        continue;
      }

      // 3. Batch fetch (1 quota unit)
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids.join(",")}&key=${YOUTUBE_API_KEY}`,
      );
      totalQuotaUnits += 1;
      const statsJson = await statsRes.json();
      const videos = statsJson.items || [];

      let totalViews30 = 0, count30 = 0, totalCtr30 = 0, ctrCount = 0;
      let lastPostedAt: string | null = null;

      for (const v of videos) {
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");
        const publishedAt = v.snippet?.publishedAt;
        const pubMs = publishedAt ? new Date(publishedAt).getTime() : 0;
        const ageDays = pubMs ? (now - pubMs) / 86400000 : 0;

        if (!lastPostedAt || pubMs > new Date(lastPostedAt).getTime()) lastPostedAt = publishedAt;
        if (pubMs >= now - THIRTY_DAYS) { totalViews30 += views; count30++; }

        // CTR estimate: like/view * factor (proxy when no analytics OAuth)
        // Real CTR comes from sync-oauth-performance when available.
        const engagement = views > 0 ? (likes + comments) / views : 0;
        const ctrEstimate = Math.min(engagement * 12, 15); // cap 15%
        if (views > 100) { totalCtr30 += ctrEstimate; ctrCount++; }

        // Performance score 0-100
        // 50% views vs channel avg, 30% engagement, 20% velocity
        const channelAvg = ch.avg_views_30d || 1;
        const viewRatio = Math.min((views / channelAvg) * 50, 100);
        const engagementScore = Math.min(engagement * 1500, 100);
        const velocity = ageDays > 0 ? Math.min((views / ageDays) / 100, 100) : 0;
        const performanceScore = Math.round(
          viewRatio * 0.5 + engagementScore * 0.3 + velocity * 0.2,
        );

        const grade = performanceScore >= 75 ? "A" : performanceScore >= 50 ? "B" : performanceScore >= 30 ? "C" : "D";

        const title: string = v.snippet?.title || "";
        const topic = title.split(/\s+/).slice(0, 3).join(" ").toLowerCase();

        // Upsert without overwriting OAuth-only fields if they exist
        const { data: existing } = await sb
          .from("video_performance")
          .select("id, oauth_synced, sync_count")
          .eq("youtube_video_id", v.id)
          .maybeSingle();

        const payload: any = {
          user_id: ch.user_id,
          channel_id: ch.id,
          youtube_video_id: v.id,
          title,
          published_at: publishedAt,
          views,
          views_current: views,
          likes,
          comments,
          niche: ch.niche,
          topic,
          ctr: existing?.oauth_synced ? undefined : ctrEstimate,
          ctr_percent: existing?.oauth_synced ? undefined : ctrEstimate,
          performance_score: performanceScore,
          performance_grade: grade,
          last_synced_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
          sync_count: (existing?.sync_count || 0) + 1,
          check_count: (existing?.sync_count || 0) + 1,
        };
        // Strip undefined
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        await sb.from("video_performance").upsert(payload, {
          onConflict: "youtube_video_id",
        } as any);
      }

      const avgViews30 = count30 > 0 ? Math.round(totalViews30 / count30) : ch.avg_views_30d;
      const avgCtr30 = ctrCount > 0 ? +(totalCtr30 / ctrCount).toFixed(2) : ch.avg_ctr_30d;

      await sb
        .from("user_channels")
        .update({
          avg_views_30d: avgViews30,
          avg_ctr_30d: avgCtr30,
          last_posted_at: lastPostedAt,
          last_synced_at: new Date().toISOString(),
        } as any)
        .eq("id", ch.id);

      results.push({
        channel: ch.channel_name,
        videos: videos.length,
        avgViews30,
        avgCtr30,
        quotaUsed: 3,
      });
    } catch (e: any) {
      results.push({ channel: ch.channel_name, error: e.message });
    }
    // Small breather between channels
    await new Promise((r) => setTimeout(r, 200));
  }

  // Log execution
  await sb.from("execution_logs").insert({
    function_name: "auto-sync-video-metrics",
    success: true,
    metadata: { processed: results.length, quota_units: totalQuotaUnits },
  } as any);

  return jsonResp({ ok: true, processed: results.length, quotaUnits: totalQuotaUnits, results });

  function jsonResp(obj: any, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
