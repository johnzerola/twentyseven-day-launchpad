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
            // Parse ISO 8601 duration (PT#H#M#S) to seconds
            let durationSeconds: number | null = null;
            const dur = item.contentDetails?.duration;
            if (dur) {
              const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              if (match) {
                durationSeconds = (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
              }
            }
            videoData[item.id] = {
              views: parseInt(item.statistics?.viewCount || "0"),
              likes: parseInt(item.statistics?.likeCount || "0"),
              comments: parseInt(item.statistics?.commentCount || "0"),
              title: item.snippet?.title,
              publishedAt: item.snippet?.publishedAt,
              durationSeconds,
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

        // Also update duration_seconds and watch_time_hours in video_performance
        if (link.youtube_video_id) {
          const vpUpdate: any = {};
          if (vd.durationSeconds && vd.durationSeconds > 0) {
            vpUpdate.duration_seconds = vd.durationSeconds;
            // Calculate estimated watch_time_hours: views * duration * est_retention / 3600
            const estRetention = 0.5; // 50% default retention estimate
            vpUpdate.watch_time_hours = Math.round((vd.views * vd.durationSeconds * estRetention / 3600) * 100) / 100;
          }
          if (Object.keys(vpUpdate).length > 0) {
            await sb.from("video_performance")
              .update(vpUpdate)
              .eq("user_id", link.user_id)
              .eq("video_id", link.youtube_video_id);
          }
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

    // ============ CLOSED FEEDBACK LOOP → viral_patterns ============
    // Promote winners (grade S/A) into viral_patterns so future scripts use proven structures.
    let promoted = 0;
    let promotionSkipped = 0;
    const winners = links.filter((l: any) =>
      ["S", "A"].includes(l.performance_grade) && (l.views_7d || l.views_30d || 0) >= 1000
    );
    const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");

    for (const w of winners.slice(0, 10)) { // safety cap per run
      try {
        // Idempotency: skip if we already have a pattern from this video
        const { data: existing } = await sb
          .from("viral_patterns")
          .select("id")
          .eq("source_video", w.video_title || w.youtube_video_id)
          .maybeSingle();
        if (existing) { promotionSkipped++; continue; }

        // Pull the script that produced this video (when linked)
        let scriptContent: string | null = null;
        let niche: string | null = null;
        if (w.script_id) {
          const { data: s } = await sb
            .from("saved_scripts")
            .select("script_content, topic, style, video_type")
            .eq("id", w.script_id)
            .maybeSingle();
          if (s) {
            scriptContent = s.script_content;
            niche = s.topic;
          }
        }

        // Also pull niche/hook info from video_performance if present
        if (!niche && w.youtube_video_id) {
          const { data: vp } = await sb
            .from("video_performance")
            .select("niche, hook_type, title_pattern")
            .eq("user_id", w.user_id)
            .eq("youtube_video_id", w.youtube_video_id)
            .maybeSingle();
          if (vp?.niche) niche = vp.niche;
        }

        // Build pattern via Gemini (fallback to heuristic if no key)
        let patternJson: any = null;
        if (geminiKey && scriptContent) {
          const prompt = `Extract a reusable viral pattern from this proven YouTube winner.\n\nTITLE: ${w.video_title}\nVIEWS_7D: ${w.views_7d ?? "n/a"} | GRADE: ${w.performance_grade}\nSCRIPT (truncated):\n${(scriptContent || "").slice(0, 4000)}\n\nReturn STRICT JSON: { "hook_types": string[], "narrative_structure": string, "title_formulas": string[], "emotional_triggers": string[], "pacing": "fast"|"medium"|"slow", "success_factor": string, "replication_guide_pt": string }`;
          try {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ role: "user", parts: [{ text: prompt }] }],
                  generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
                }),
              }
            );
            const j = await resp.json();
            const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) patternJson = JSON.parse(text);
          } catch (err) {
            console.warn("Pattern extraction failed for", w.id, err);
          }
        }

        // Heuristic fallback so we still close the loop
        if (!patternJson) {
          patternJson = {
            hook_types: [],
            narrative_structure: "winner-derived (heuristic)",
            title_formulas: [w.video_title].filter(Boolean),
            success_factor: `Beat channel average; grade ${w.performance_grade}; views_7d=${w.views_7d ?? "?"}`,
            metrics: {
              views_48h: w.views_48h, views_7d: w.views_7d, views_30d: w.views_30d,
              ctr_pct: w.ctr_pct, retention_pct: w.avg_retention_pct,
            },
          };
        } else {
          patternJson.metrics = {
            views_48h: w.views_48h, views_7d: w.views_7d, views_30d: w.views_30d,
            ctr_pct: w.ctr_pct, retention_pct: w.avg_retention_pct,
          };
        }

        const { error: insErr } = await sb.from("viral_patterns").insert({
          pattern_name: `winner_${(w.video_title || w.youtube_video_id || "").slice(0, 40)}`,
          pattern_json: patternJson,
          niche: niche || "general",
          source_video: w.video_title || w.youtube_video_id,
        });
        if (insErr) console.warn("viral_patterns insert error:", insErr.message);
        else promoted++;
      } catch (e) {
        console.error("Promotion error for link", w.id, e);
      }
    }

    return new Response(JSON.stringify({ success: true, synced, errors, total: links.length, promoted, promotionSkipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-video-metrics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
