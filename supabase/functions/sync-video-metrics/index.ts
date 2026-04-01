import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user_id, limit: maxLinks } = await req.json().catch(() => ({}));

    // Fetch links needing sync (no views_7d or updated > 24h ago)
    let query = sb.from("script_performance_link")
      .select("*")
      .or("views_7d.is.null,updated_at.lt." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(maxLinks || 50);

    if (user_id) query = query.eq("user_id", user_id);

    const { data: links } = await query;
    if (!links?.length) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: "All metrics up to date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ytKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean);

    let synced = 0;
    let errors = 0;

    // Batch video IDs (max 50 per API call)
    const videoIds = links.map((l: any) => l.youtube_video_id);
    const batches = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      batches.push(videoIds.slice(i, i + 50));
    }

    for (const batch of batches) {
      let videoData: Record<string, any> = {};

      for (const key of ytKeys) {
        try {
          const resp = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(",")}&key=${key}`
          );
          const data = await resp.json();
          if (data.error?.errors?.[0]?.reason === "quotaExceeded") continue;

          for (const item of (data.items || [])) {
            videoData[item.id] = {
              views: parseInt(item.statistics?.viewCount || "0"),
              likes: parseInt(item.statistics?.likeCount || "0"),
              comments: parseInt(item.statistics?.commentCount || "0"),
              title: item.snippet?.title,
              publishedAt: item.snippet?.publishedAt,
            };
          }
          break; // Success, stop key rotation
        } catch { continue; }
      }

      // Update each link
      for (const link of links.filter((l: any) => batch.includes(l.youtube_video_id))) {
        const vd = videoData[link.youtube_video_id];
        if (!vd) { errors++; continue; }

        const publishedAt = link.published_at ? new Date(link.published_at) : (vd.publishedAt ? new Date(vd.publishedAt) : null);
        const now = Date.now();
        const hoursSincePublish = publishedAt ? (now - publishedAt.getTime()) / (1000 * 60 * 60) : null;

        const update: any = {
          video_title: vd.title || link.video_title,
          published_at: vd.publishedAt || link.published_at,
          likes: vd.likes,
          comments: vd.comments,
          updated_at: new Date().toISOString(),
        };

        // Set time-windowed views
        if (hoursSincePublish !== null) {
          if (hoursSincePublish <= 48) update.views_48h = vd.views;
          if (hoursSincePublish <= 168) update.views_7d = vd.views; // 7 days
          if (hoursSincePublish <= 720) update.views_30d = vd.views; // 30 days
        } else {
          update.views_30d = vd.views;
        }

        // Calculate grade based on channel average
        const { data: channelAvg } = await sb
          .from("video_performance")
          .select("views_current")
          .eq("user_id", link.user_id)
          .not("views_current", "is", null);

        if (channelAvg?.length) {
          const avg = channelAvg.reduce((s: number, v: any) => s + (v.views_current || 0), 0) / channelAvg.length;
          const ratio = avg > 0 ? vd.views / avg : 1;
          update.beat_channel_average = ratio > 1;
          update.performance_grade = ratio >= 3 ? "S" : ratio >= 2 ? "A" : ratio >= 1.2 ? "B" : ratio >= 0.8 ? "C" : ratio >= 0.5 ? "D" : "F";
        }

        const { error } = await sb.from("script_performance_link").update(update).eq("id", link.id);
        if (error) { errors++; } else { synced++; }
      }

      await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    // If any links have full data (48h + 7d), trigger learnings extraction
    const usersWithData = [...new Set(links.filter((l: any) => l.views_48h && l.views_7d).map((l: any) => l.user_id))];
    for (const uid of usersWithData.slice(0, 5)) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-user-learnings`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ user_id: uid }),
        });
      } catch (e) {
        console.error("Failed to trigger learnings for user:", uid, e);
      }
    }

    return new Response(JSON.stringify({ success: true, synced, errors, total: links.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-video-metrics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
