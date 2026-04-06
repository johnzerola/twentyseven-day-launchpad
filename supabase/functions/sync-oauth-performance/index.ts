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

    return new Response(JSON.stringify({
      success: true,
      synced: results.filter(r => !r.error).length,
      errors: results.filter(r => r.error).length,
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
