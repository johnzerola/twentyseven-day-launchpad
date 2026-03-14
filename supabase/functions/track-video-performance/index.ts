import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function getYouTubeKey(): string | undefined {
  return Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
}

function gradePerformance(views: number, subs: number, daysSincePublish: number): string {
  if (daysSincePublish < 1) return "pending";
  const ratio = subs > 0 ? views / subs : views / 1000;
  if (ratio >= 5) return "S";
  if (ratio >= 2) return "A";
  if (ratio >= 1) return "B";
  if (ratio >= 0.5) return "C";
  if (ratio >= 0.2) return "D";
  return "F";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "check_all", videoId, userId } = await req.json().catch(() => ({}));
    const YT_KEY = getYouTubeKey();
    if (!YT_KEY) throw new Error("No YouTube API key configured");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: any = { checked: 0, graded: 0, rankings_checked: 0, lessons: 0 };

    // ═══ MODE: ADD VIDEO ═══
    if (mode === "add_video" && videoId && userId) {
      const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
      if (!allowed) throw new Error("YouTube API daily limit reached");

      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoId}&key=${YT_KEY}`);
      const vData = await vRes.json();
      const video = vData.items?.[0];
      if (!video) throw new Error("Video not found");

      const views = parseInt(video.statistics?.viewCount || '0');
      const likes = parseInt(video.statistics?.likeCount || '0');
      const comments = parseInt(video.statistics?.commentCount || '0');

      const { error } = await sb.from("video_performance").upsert({
        user_id: userId,
        youtube_video_id: videoId,
        title: video.snippet.title,
        published_at: video.snippet.publishedAt,
        views_current: views,
        likes,
        comments,
        last_checked_at: new Date().toISOString(),
        check_count: 1,
      }, { onConflict: "user_id,youtube_video_id" });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, title: video.snippet.title, views }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ MODE: CHECK ALL — Update metrics for tracked videos ═══
    if (mode === "check_all") {
      const query = userId 
        ? sb.from("video_performance").select("*").eq("user_id", userId)
        : sb.from("video_performance").select("*").neq("performance_grade", "S").order("last_checked_at", { ascending: true }).limit(50);
      
      const { data: videos } = await query;
      if (!videos?.length) {
        return new Response(JSON.stringify({ success: true, message: "No videos to check", results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Batch YouTube API calls (50 videos per request)
      const videoIds = videos.map(v => v.youtube_video_id);
      const batches = [];
      for (let i = 0; i < videoIds.length; i += 50) {
        batches.push(videoIds.slice(i, i + 50));
      }

      for (const batch of batches) {
        const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
        if (!allowed) break;

        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${batch.join(",")}&key=${YT_KEY}`);
        const vData = await vRes.json();

        for (const item of (vData.items || [])) {
          const vid = videos.find(v => v.youtube_video_id === item.id);
          if (!vid) continue;

          const views = parseInt(item.statistics?.viewCount || '0');
          const likes = parseInt(item.statistics?.likeCount || '0');
          const comments = parseInt(item.statistics?.commentCount || '0');
          const publishedAt = new Date(vid.published_at || vid.created_at);
          const daysSince = (Date.now() - publishedAt.getTime()) / 86400000;

          // Get subscriber count for the channel
          let subs = 0;
          const channelId = item.snippet?.channelId;
          if (channelId) {
            const { data: chIntel } = await sb.from("channel_intelligence")
              .select("subscribers").eq("youtube_channel_id", channelId).maybeSingle();
            subs = chIntel?.subscribers || 0;
          }

          const grade = gradePerformance(views, subs, daysSince);

          // Determine day-specific views
          const update: any = {
            views_current: views,
            likes,
            comments,
            performance_grade: grade,
            last_checked_at: new Date().toISOString(),
            check_count: (vid.check_count || 0) + 1,
          };

          if (daysSince >= 1 && !vid.views_day1) update.views_day1 = views;
          if (daysSince >= 3 && !vid.views_day3) update.views_day3 = views;
          if (daysSince >= 7 && !vid.views_day7) update.views_day7 = views;
          if (daysSince >= 30 && !vid.views_day30) update.views_day30 = views;

          await sb.from("video_performance").update(update).eq("id", vid.id);
          results.checked++;

          // Grade changed? Generate AI feedback
          if (grade !== vid.performance_grade && grade !== "pending" && LOVABLE_API_KEY && daysSince >= 3) {
            try {
              const aiRes = await fetch(AI_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "You analyze YouTube video performance and extract lessons. Be specific and actionable. Respond in Portuguese." },
                    { role: "user", content: `Video: "${vid.title}"\nNiche: ${vid.niche || 'unknown'}\nViews: ${views.toLocaleString()} in ${Math.floor(daysSince)} days\nLikes: ${likes}, Comments: ${comments}\nGrade: ${grade}\nHook type: ${vid.hook_type || 'unknown'}\nTitle pattern: ${vid.title_pattern || 'unknown'}\nPredicted score: ${vid.predicted_viral_score}\n\nWhat worked? What failed? What should be done differently next time?` }
                  ],
                  tools: [{
                    type: "function",
                    function: {
                      name: "analyze_performance",
                      parameters: {
                        type: "object",
                        properties: {
                          what_worked: { type: "array", items: { type: "string" } },
                          what_failed: { type: "array", items: { type: "string" } },
                          lessons: { type: "array", items: { type: "string" } },
                          next_time: { type: "string" },
                          prediction_accuracy: { type: "string" },
                        },
                        required: ["what_worked", "what_failed", "lessons", "next_time", "prediction_accuracy"],
                        additionalProperties: false,
                      }
                    }
                  }],
                  tool_choice: { type: "function", function: { name: "analyze_performance" } },
                }),
              });

              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
                if (tc) {
                  const feedback = JSON.parse(tc.function.arguments);
                  await sb.from("video_performance").update({
                    ai_feedback: feedback,
                    lessons_learned: feedback.lessons,
                  }).eq("id", vid.id);

                  // Feed lessons back into AI learning
                  await sb.from("ai_learning").insert({
                    topic: `performance_${grade}_${vid.niche || 'general'}`,
                    source: "track-video-performance",
                    insight: `[Grade ${grade}] "${vid.title}" — ${views} views in ${Math.floor(daysSince)}d. Lessons: ${feedback.lessons.join('; ')}. Next time: ${feedback.next_time}`,
                  });
                  results.lessons++;
                  results.graded++;
                }
              }
            } catch (e) {
              console.error("AI feedback error:", e);
            }
          }
        }
      }
    }

    // ═══ MODE: CHECK RANKINGS ═══
    if (mode === "check_rankings" || mode === "check_all") {
      const { data: videos } = await sb.from("video_performance")
        .select("id, user_id, title, ranking_keywords, youtube_video_id")
        .not("ranking_keywords", "eq", "[]")
        .order("last_checked_at", { ascending: true })
        .limit(20);

      for (const vid of (videos || [])) {
        const keywords = vid.ranking_keywords as string[] || [];
        for (const keyword of keywords.slice(0, 3)) {
          const { data: allowed } = await sb.rpc("check_and_increment_api_usage", { _api_name: "youtube" });
          if (!allowed) break;

          try {
            const searchRes = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=20&key=${YT_KEY}`
            );
            const searchData = await searchRes.json();
            const items = searchData.items || [];
            const position = items.findIndex((i: any) => i.id?.videoId === vid.youtube_video_id);

            // Get previous ranking
            const { data: prev } = await sb.from("title_rankings")
              .select("position")
              .eq("video_performance_id", vid.id)
              .eq("keyword", keyword)
              .order("checked_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            await sb.from("title_rankings").insert({
              user_id: vid.user_id,
              video_performance_id: vid.id,
              keyword,
              position: position >= 0 ? position + 1 : null,
              previous_position: prev?.position || null,
              checked_at: new Date().toISOString(),
            });

            if (position >= 0) {
              await sb.from("video_performance").update({
                best_ranking_position: Math.min(position + 1, vid.best_ranking_position || 999),
              }).eq("id", vid.id);
            }

            results.rankings_checked++;
          } catch (e) {
            console.error("Ranking check error:", e);
          }
        }
      }
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "track-video-performance",
      success: true,
      api_calls_made: results.checked + results.rankings_checked,
      metadata: results,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-video-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
