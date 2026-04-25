import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SYNC-CHANNEL-PERFORMANCE
 * Weekly job (Sundays). For each user_channel:
 *  1. Pull recent uploads from YouTube Data API (free quota).
 *  2. Upsert metrics into video_performance.
 *  3. Recompute aggregates on user_channels (avg_views_30d, avg_ctr_30d, last_posted_at).
 *  4. Recompute channel_intelligence_per_user (best topics/hooks/days/hours).
 *
 * Body params (optional):
 *   - userId: limit to one user
 *   - channelId: limit to one channel (id from user_channels)
 *   - force: ignore last_synced_at throttling (default false)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? Deno.env.get("YOUTUBE_API_KEY_2");

  const body = await req.json().catch(() => ({} as any));
  const { userId, channelId, force = false } = body;

  if (!YOUTUBE_API_KEY) {
    return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY missing" }), { status: 500, headers: corsHeaders });
  }

  let q = sb.from("user_channels").select("*");
  if (userId) q = q.eq("user_id", userId);
  if (channelId) q = q.eq("id", channelId);
  const { data: channels, error: chErr } = await q;
  if (chErr) return new Response(JSON.stringify({ error: chErr.message }), { status: 500, headers: corsHeaders });
  if (!channels?.length) return new Response(JSON.stringify({ message: "no channels" }), { headers: corsHeaders });

  const results: any[] = [];

  for (const ch of channels as any[]) {
    try {
      // Throttle: skip if synced in last 6 days unless forced
      if (!force && ch.last_synced_at) {
        const ageDays = (Date.now() - new Date(ch.last_synced_at).getTime()) / 86400000;
        if (ageDays < 6) { results.push({ channel: ch.channel_name, skipped: "recent" }); continue; }
      }

      // 1. Get uploads playlist
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${ch.youtube_channel_id}&key=${YOUTUBE_API_KEY}`);
      const chJson = await chRes.json();
      const uploads = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) { results.push({ channel: ch.channel_name, error: "no uploads playlist" }); continue; }

      // 2. Get last 30 videos
      const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=30&key=${YOUTUBE_API_KEY}`);
      const plJson = await plRes.json();
      const videoIds = (plJson.items || []).map((i: any) => i.snippet?.resourceId?.videoId).filter(Boolean);
      if (videoIds.length === 0) { results.push({ channel: ch.channel_name, videos: 0 }); continue; }

      // 3. Batch get statistics
      const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
      const statsJson = await statsRes.json();
      const videos = statsJson.items || [];

      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 86400000;
      let totalViews30 = 0, count30 = 0, lastPostedAt: string | null = null;
      const topics: Record<string, { views: number; count: number }> = {};
      const dayBuckets: Record<string, { views: number; count: number }> = {};
      const hourBuckets: Record<number, { views: number; count: number }> = {};
      let bestVideoId: string | null = null, bestViews = 0;

      for (const v of videos) {
        const views = parseInt(v.statistics?.viewCount || "0");
        const likes = parseInt(v.statistics?.likeCount || "0");
        const comments = parseInt(v.statistics?.commentCount || "0");
        const publishedAt = v.snippet?.publishedAt;
        const pubMs = publishedAt ? new Date(publishedAt).getTime() : 0;

        if (!lastPostedAt || (pubMs && pubMs > new Date(lastPostedAt).getTime())) lastPostedAt = publishedAt;
        if (pubMs >= thirtyDaysAgo) { totalViews30 += views; count30++; }
        if (views > bestViews) { bestViews = views; bestVideoId = v.id; }

        // Topic = first 3 words of title (rough heuristic)
        const title: string = v.snippet?.title || "";
        const topic = title.split(/\s+/).slice(0, 3).join(" ").toLowerCase();
        if (topic) {
          topics[topic] = topics[topic] || { views: 0, count: 0 };
          topics[topic].views += views;
          topics[topic].count++;
        }

        if (publishedAt) {
          const d = new Date(publishedAt);
          const dayName = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][d.getUTCDay()];
          const hour = d.getUTCHours();
          dayBuckets[dayName] = dayBuckets[dayName] || { views: 0, count: 0 };
          dayBuckets[dayName].views += views; dayBuckets[dayName].count++;
          hourBuckets[hour] = hourBuckets[hour] || { views: 0, count: 0 };
          hourBuckets[hour].views += views; hourBuckets[hour].count++;
        }

        // Upsert into video_performance
        await sb.from("video_performance").upsert({
          user_id: ch.user_id,
          channel_id: ch.id,
          youtube_video_id: v.id,
          title: v.snippet?.title,
          published_at: publishedAt,
          views,
          likes,
          comments,
          niche: ch.niche,
          topic,
          last_synced_at: new Date().toISOString(),
        } as any, { onConflict: "youtube_video_id" } as any);
      }

      const avgViews30 = count30 > 0 ? Math.round(totalViews30 / count30) : 0;

      // Best topics: sorted by avg views
      const topTopics = Object.entries(topics)
        .map(([t, s]) => ({ topic: t, avg: s.views / s.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5)
        .map(x => x.topic);

      const lowTopics = Object.entries(topics)
        .map(([t, s]) => ({ topic: t, avg: s.views / s.count }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 3)
        .map(x => x.topic);

      const bestDays = Object.entries(dayBuckets)
        .map(([d, s]) => ({ day: d, avg: s.views / s.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(x => x.day);

      const bestHours = Object.entries(hourBuckets)
        .map(([h, s]) => ({ hour: parseInt(h), avg: s.views / s.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(x => x.hour);

      // Update user_channels aggregates
      const nextSlot = computeNextSlot(ch.posting_days || ["monday","wednesday","friday"], ch.posting_hour ?? 18, ch.min_interval_hours ?? 48, lastPostedAt);
      await sb.from("user_channels").update({
        avg_views_30d: avgViews30,
        last_posted_at: lastPostedAt,
        next_slot_at: nextSlot,
        total_videos_posted: videos.length,
        top_topics: topTopics,
        avoided_topics: lowTopics,
      } as any).eq("id", ch.id);

      // Upsert intelligence
      await sb.from("channel_intelligence_per_user").upsert({
        user_id: ch.user_id,
        channel_id: ch.id,
        top_performing_topics: topTopics,
        low_performing_topics: lowTopics,
        best_posting_days: bestDays,
        best_posting_hours: bestHours,
        avg_views_all_time: avgViews30,
        best_video_id: bestVideoId,
        best_video_views: bestViews,
        last_analyzed_at: new Date().toISOString(),
      } as any, { onConflict: "channel_id" } as any);

      results.push({ channel: ch.channel_name, videos: videos.length, avgViews30, topTopics, bestDays, bestHours });
    } catch (e: any) {
      results.push({ channel: ch.channel_name, error: e.message });
    }
    await new Promise(r => setTimeout(r, 250));
  }

  await sb.from("execution_logs").insert({
    function_name: "sync-channel-performance",
    success: true,
    metadata: { results_count: results.length },
  });

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function computeNextSlot(days: string[], hour: number, minIntervalHours: number, lastPostedAt: string | null): string {
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const allowed = (days || []).map(d => dayMap[d.toLowerCase()]).filter(d => d !== undefined);
  if (allowed.length === 0) allowed.push(1, 3, 5);

  let earliest = new Date();
  if (lastPostedAt) {
    const minNext = new Date(new Date(lastPostedAt).getTime() + minIntervalHours * 3600000);
    if (minNext > earliest) earliest = minNext;
  }

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(earliest);
    candidate.setDate(candidate.getDate() + i);
    candidate.setUTCHours(hour, 0, 0, 0);
    if (candidate < earliest) continue;
    if (allowed.includes(candidate.getUTCDay())) return candidate.toISOString();
  }
  // Fallback
  const fb = new Date(earliest); fb.setDate(fb.getDate() + 1); fb.setUTCHours(hour, 0, 0, 0);
  return fb.toISOString();
}
