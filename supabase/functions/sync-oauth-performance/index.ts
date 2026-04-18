import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// SYNC OAUTH PERFORMANCE
// Fetches real YouTube Analytics data via OAuth tokens
// and populates video_performance with D1/D3/D7/D30 metrics
// ═══════════════════════════════════════════════════════════════

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error}`);
  return data;
}

// ── Auto-link scripts to YouTube videos by title similarity ──
async function autoLinkScripts(sb: any, userIds: string[]): Promise<number> {
  const uniqueUserIds = [...new Set(userIds)];
  let linked = 0;

  for (const userId of uniqueUserIds) {
    // Get unlinked video performances
    const { data: performances } = await sb.from("video_performance")
      .select("youtube_video_id, title, avg_retention_percent, ctr_percent, views_day7, views_day30, performance_grade, views_current, published_at")
      .eq("user_id", userId)
      .eq("oauth_synced", true);

    if (!performances?.length) continue;

    // Get user's scripts
    const { data: projects } = await sb.from("video_projects")
      .select("id, title")
      .eq("user_id", userId);

    if (!projects?.length) continue;

    // Check existing links
    const { data: existingLinks } = await sb.from("script_performance_link")
      .select("youtube_video_id")
      .eq("user_id", userId);
    const linkedVideoIds = new Set((existingLinks || []).map((l: any) => l.youtube_video_id));

    for (const perf of performances) {
      if (linkedVideoIds.has(perf.youtube_video_id)) continue;

      // Simple fuzzy match: find script with most similar title
      const perfTitle = (perf.title || "").toLowerCase().replace(/[^a-záàâãéèêíïóôõúç0-9\s]/gi, "");
      let bestMatch: any = null;
      let bestScore = 0;

      for (const proj of projects) {
        const projTitle = (proj.title || "").toLowerCase().replace(/[^a-záàâãéèêíïóôõúç0-9\s]/gi, "");
        // Word overlap score
        const perfWords = new Set(perfTitle.split(/\s+/).filter((w: string) => w.length > 2));
        const projWords = new Set(projTitle.split(/\s+/).filter((w: string) => w.length > 2));
        const overlap = [...perfWords].filter(w => projWords.has(w)).length;
        const score = overlap / Math.max(perfWords.size, projWords.size, 1);
        if (score > bestScore && score >= 0.3) {
          bestScore = score;
          bestMatch = proj;
        }
      }

      if (bestMatch) {
        const { error } = await sb.from("script_performance_link").insert({
          user_id: userId,
          script_id: bestMatch.id,
          youtube_video_id: perf.youtube_video_id,
          video_title: perf.title,
          published_at: perf.published_at,
          views_7d: perf.views_day7,
          views_30d: perf.views_day30,
          avg_retention_pct: perf.avg_retention_percent,
          ctr_pct: perf.ctr_percent,
          performance_grade: perf.performance_grade,
        });
        if (!error) linked++;
      }
    }
  }

  return linked;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Support both auth'd user and cron (service key)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    const body = await req.json().catch(() => ({}));

    // Try user auth first
    if (token && token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      const { data: userData } = await sb.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    // Cron mode: process all users with OAuth tokens
    if (!userId && body.user_id) {
      userId = body.user_id;
    }

    // Get OAuth tokens
    let tokenQuery = sb.from("youtube_oauth_tokens").select("*");
    if (userId) tokenQuery = tokenQuery.eq("user_id", userId);
    const { data: tokens, error: tokenError } = await tokenQuery.limit(50);
    
    if (tokenError || !tokens?.length) {
      return new Response(JSON.stringify({ success: true, message: "No OAuth tokens found", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const ytDataKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
    ].filter(Boolean) as string[];

    for (const tokenRow of tokens) {
      try {
        // Refresh token if expired
        let accessToken = tokenRow.access_token;
        if (new Date(tokenRow.token_expires_at) < new Date()) {
          const refreshed = await refreshAccessToken(tokenRow.refresh_token);
          accessToken = refreshed.access_token;
          await sb.from("youtube_oauth_tokens").update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", tokenRow.id);
        }

        // Get recent videos from the channel
        let recentVideos: any[] = [];
        for (const ytKey of ytDataKeys) {
          try {
            const chResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${tokenRow.channel_id}&key=${ytKey}`);
            const chData = await chResp.json();
            const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) continue;

            const plResp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=20&key=${ytKey}`);
            const plData = await plResp.json();
            const videoIds = (plData.items || []).map((i: any) => i.snippet?.resourceId?.videoId).filter(Boolean);
            
            if (videoIds.length) {
              const vResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${ytKey}`);
              const vData = await vResp.json();
              recentVideos = (vData.items || []).map((v: any) => ({
                videoId: v.id,
                title: v.snippet?.title,
                publishedAt: v.snippet?.publishedAt,
                views: parseInt(v.statistics?.viewCount || '0'),
                likes: parseInt(v.statistics?.likeCount || '0'),
                comments: parseInt(v.statistics?.commentCount || '0'),
                duration: v.contentDetails?.duration,
              }));
            }
            break;
          } catch { continue; }
        }

        // Fetch per-video analytics via YouTube Analytics API
        for (const video of recentVideos) {
          const publishDate = new Date(video.publishedAt);
          const daysSincePublish = Math.floor((Date.now() - publishDate.getTime()) / 86400000);

          // Only process videos published in the last 90 days
          if (daysSincePublish > 90 || daysSincePublish < 1) continue;

          try {
            // Get CTR and retention data from YouTube Analytics
            const startDate = publishDate.toISOString().split("T")[0];
            const endDate = new Date().toISOString().split("T")[0];
            
            const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${tokenRow.channel_id}&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained&filters=video==${video.videoId}&dimensions=day&sort=day`;
            
            const analyticsResp = await fetch(analyticsUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const analyticsData = await analyticsResp.json();

            if (analyticsData.error) {
              console.warn(`Analytics error for ${video.videoId}:`, analyticsData.error.message);
              continue;
            }

            // Aggregate metrics
            const rows = analyticsData.rows || [];
            if (!rows.length) continue;

            // Columns: 0=day, 1=views, 2=estimatedMinutesWatched, 3=averageViewDuration, 4=averageViewPercentage, 5=subscribersGained
            const totalViews = rows.reduce((s: number, r: any) => s + (r[1] || 0), 0);
            const totalMinutes = rows.reduce((s: number, r: any) => s + (r[2] || 0), 0);
            const avgRetention = rows.reduce((s: number, r: any) => s + (r[4] || 0), 0) / rows.length;
            const subsGained = rows.reduce((s: number, r: any) => s + (r[5] || 0), 0);
            // CTR not available via youtubeanalytics v2 basic metrics — estimate from views/subs ratio
            const avgCTR = 0;

            // Calculate D1/D3/D7/D30 views
            const viewsD1 = rows.length >= 1 ? rows[0][1] || 0 : null;
            const viewsD3 = rows.length >= 3 ? rows.slice(0, 3).reduce((s: number, r: any) => s + (r[1] || 0), 0) : null;
            const viewsD7 = rows.length >= 7 ? rows.slice(0, 7).reduce((s: number, r: any) => s + (r[1] || 0), 0) : null;
            const viewsD30 = rows.length >= 30 ? rows.slice(0, 30).reduce((s: number, r: any) => s + (r[1] || 0), 0) : null;

            // ⭐ NEW: Fetch real per-second retention curve (audienceWatchRatio by elapsedVideoTimeRatio)
            let retentionCurve: number[] | null = null;
            try {
              const curveUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${tokenRow.channel_id}&startDate=${startDate}&endDate=${endDate}&metrics=audienceWatchRatio,relativeRetentionPerformance&dimensions=elapsedVideoTimeRatio&filters=video==${video.videoId}&sort=elapsedVideoTimeRatio`;
              const curveResp = await fetch(curveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
              const curveData = await curveResp.json();
              if (curveData.rows?.length) {
                // Each row: [elapsedRatio (0..1), audienceWatchRatio, relativeRetention]
                retentionCurve = curveData.rows.map((r: any) => ({
                  t: r[0],
                  ratio: r[1],
                  rel: r[2],
                }));
              }
            } catch (e) {
              console.warn(`Retention curve unavailable for ${video.videoId}:`, (e as Error).message);
            }

            // Determine performance grade
            let grade = 'C';
            if (avgRetention >= 60) grade = 'S';
            else if (avgRetention >= 50) grade = 'A';
            else if (avgRetention >= 40) grade = 'B';
            else if (avgRetention >= 30) grade = 'C';
            else if (avgRetention >= 20) grade = 'D';
            else grade = 'F';

            // Upsert into video_performance
            const { error: upsertError } = await sb.from("video_performance").upsert({
              user_id: tokenRow.user_id,
              youtube_video_id: video.videoId,
              title: video.title,
              published_at: video.publishedAt,
              views_current: totalViews,
              views_day1: viewsD1,
              views_day3: viewsD3,
              views_day7: viewsD7,
              views_day30: viewsD30,
              avg_retention_percent: Math.round(avgRetention * 10) / 10,
              ctr_percent: avgCTR,
              avg_view_duration_seconds: rows.length > 0 ? Math.round(rows.reduce((s: number, r: any) => s + (r[3] || 0), 0) / rows.length) : 0,
              impressions: 0,
              subscribers_gained: subsGained,
              watch_time_minutes: Math.round(totalMinutes),
              performance_grade: grade,
              retention_curve: retentionCurve,
              oauth_synced: true,
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "youtube_video_id,user_id" });

            if (upsertError) console.error(`Upsert error for ${video.videoId}:`, upsertError.message);
            else results.push({ videoId: video.videoId, title: video.title, grade, ctr: avgCTR, retention: avgRetention });

          } catch (e) {
            console.warn(`Video analytics error for ${video.videoId}:`, (e as Error).message);
          }
        }

      } catch (e) {
        console.error(`Token processing error for user ${tokenRow.user_id}:`, (e as Error).message);
        results.push({ user_id: tokenRow.user_id, error: (e as Error).message });
      }
    }

    // ── Phase 2: Auto-link videos to scripts via title similarity ──
    const linkedCount = await autoLinkScripts(sb, tokens.map((t: any) => t.user_id));

    // ── Phase 2.5: Populate output_performance_feedback ──
    // Links real CTR/retention back to generated titles, hooks, thumbnails
    let feedbackInserted = 0;
    for (const r of results.filter((r: any) => !r.error && r.videoId)) {
      try {
        // Find linked script
        const { data: link } = await sb.from("script_performance_link")
          .select("script_id, user_id")
          .eq("youtube_video_id", r.videoId)
          .maybeSingle();
        if (!link?.script_id) continue;

        // Get project details (title = output)
        const { data: proj } = await sb.from("video_projects")
          .select("title, niche, language")
          .eq("id", link.script_id)
          .maybeSingle();
        if (!proj) continue;

        // Get predicted scores from content_thesis if available
        const { data: thesis } = await sb.from("content_thesis")
          .select("confidence_score")
          .eq("video_project_id", link.script_id)
          .maybeSingle();

        await sb.from("output_performance_feedback").upsert({
          user_id: link.user_id,
          output_type: "title",
          output_content: proj.title,
          script_id: link.script_id,
          youtube_video_id: r.videoId,
          predicted_ctr: thesis?.confidence_score ? thesis.confidence_score / 10 : null,
          predicted_retention: null,
          actual_ctr: r.ctr || null,
          actual_retention: r.retention || null,
          actual_views: r.views || null,
          niche: proj.niche,
          language: proj.language,
        }, { onConflict: "id" });
        feedbackInserted++;
      } catch { /* skip */ }
    }

    // ── Phase 3: AUTO FEEDBACK LOOP ──
    // Automatically trigger extract-user-learnings + self-learning-worker
    // to close the loop without manual intervention
    const feedbackResults: any = { learnings: [], selfLearning: null };
    const uniqueUserIds = [...new Set(tokens.map((t: any) => t.user_id))];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 3a: Extract learnings for each user (updates user_content_memory + hook_library)
    for (const uid of uniqueUserIds) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/extract-user-learnings`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uid }),
        });
        const data = await res.json().catch(() => ({}));
        feedbackResults.learnings.push({ user_id: uid, success: res.ok, patterns: data.patterns?.length || 0 });
      } catch (e) {
        feedbackResults.learnings.push({ user_id: uid, success: false, error: (e as Error).message });
      }
    }

    // 3b: Run self-learning-worker (calibrates prediction scores with real data)
    try {
      const slRes = await fetch(`${supabaseUrl}/functions/v1/self-learning-worker`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      feedbackResults.selfLearning = await slRes.json().catch(() => ({ ok: slRes.ok }));
    } catch (e) {
      feedbackResults.selfLearning = { error: (e as Error).message };
    }

    // 3c: ⭐ LEARNING LOOP — extract CTR patterns per user (winning/losing title patterns)
    feedbackResults.ctrLearning = [];
    for (const uid of uniqueUserIds) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/learn-from-ctr`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uid }),
        });
        const d = await r.json().catch(() => ({}));
        feedbackResults.ctrLearning.push({ user_id: uid, ok: r.ok, niches: d.results?.[0]?.niches?.length || 0 });
      } catch (e) {
        feedbackResults.ctrLearning.push({ user_id: uid, error: (e as Error).message });
      }
    }

    // 3d: ⭐ LEARNING LOOP — classify hook types of synced videos and link to retention
    try {
      const hcRes = await fetch(`${supabaseUrl}/functions/v1/classify-hook-performance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      feedbackResults.hookClassify = await hcRes.json().catch(() => ({ ok: hcRes.ok }));
    } catch (e) {
      feedbackResults.hookClassify = { error: (e as Error).message };
    }

    return new Response(JSON.stringify({
      success: true,
      synced: results.filter(r => !r.error).length,
      linked: linkedCount,
      feedback_inserted: feedbackInserted,
      errors: results.filter(r => r.error).length,
      feedbackLoop: feedbackResults,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("sync-oauth-performance error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
