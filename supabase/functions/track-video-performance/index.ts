import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

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

/**
 * Auto-extract ranking keywords from a video title
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'a','o','e','de','da','do','em','para','com','que','um','uma','os','as','no','na','por',
    'the','a','an','and','or','is','it','of','to','in','for','on','with','at','by','this','that',
    'como','what','how','why','who','when','where','which','se','não','mais','muito','isso','este',
    'esta','esse','essa','mas','ou','seu','sua','ele','ela','nos','são','foi','tem','ser','ter',
  ]);

  const words = title
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíïóôõöúçñ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const keywords: string[] = [];

  // Full title as keyword (without special chars)
  const cleanTitle = title.replace(/[^\w\sáàâãéèêíïóôõöúçñ]/g, '').trim();
  if (cleanTitle.length > 5 && cleanTitle.length < 80) keywords.push(cleanTitle);

  // 2-3 word combinations (bigrams/trigrams)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 5) keywords.push(bigram);
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (trigram.length > 8) keywords.push(trigram);
    }
  }

  // Individual meaningful words (4+ chars)
  for (const w of words) {
    if (w.length >= 4) keywords.push(w);
  }

  // Deduplicate and limit
  return [...new Set(keywords)].slice(0, 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode = "check_all", videoId, userId } = await req.json().catch(() => ({}));
    const YT_KEY = getYouTubeKey();
    if (!YT_KEY) throw new Error("No YouTube API key configured");
    
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: any = { checked: 0, graded: 0, rankings_checked: 0, lessons: 0, keywords_extracted: 0 };

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

      // Auto-extract ranking keywords from title
      const rankingKeywords = extractKeywords(video.snippet.title);

      const { error } = await sb.from("video_performance").upsert({
        user_id: userId,
        youtube_video_id: videoId,
        title: video.snippet.title,
        published_at: video.snippet.publishedAt,
        views_current: views,
        likes,
        comments,
        ranking_keywords: rankingKeywords,
        last_checked_at: new Date().toISOString(),
        check_count: 1,
      }, { onConflict: "user_id,youtube_video_id" });

      if (error) throw error;
      results.keywords_extracted = rankingKeywords.length;

      return new Response(JSON.stringify({ success: true, title: video.snippet.title, views, ranking_keywords: rankingKeywords }), {
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
      const videoIds = videos.map((v: any) => v.youtube_video_id);
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
          const vid = videos.find((v: any) => v.youtube_video_id === item.id);
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

          const update: any = {
            views_current: views,
            likes,
            comments,
            performance_grade: grade,
            last_checked_at: new Date().toISOString(),
            check_count: (vid.check_count || 0) + 1,
          };

          // Auto-extract keywords if missing
          if (!vid.ranking_keywords || (vid.ranking_keywords as string[]).length === 0) {
            update.ranking_keywords = extractKeywords(vid.title);
            results.keywords_extracted++;
          }

          if (daysSince >= 1 && !vid.views_day1) update.views_day1 = views;
          if (daysSince >= 3 && !vid.views_day3) update.views_day3 = views;
          if (daysSince >= 7 && !vid.views_day7) update.views_day7 = views;
          if (daysSince >= 30 && !vid.views_day30) update.views_day30 = views;

          await sb.from("video_performance").update(update).eq("id", vid.id);
          results.checked++;

          // ═══ FEEDBACK LOOP: Grade changed → AI analysis → ai_learning ═══
          if (grade !== vid.performance_grade && grade !== "pending" && GOOGLE_AI_API_KEY && daysSince >= 3) {
            try {
              const aiRes = await fetch(AI_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    { role: "system", content: "You analyze YouTube video performance and extract lessons. Be specific and actionable. Respond in Portuguese." },
                    { role: "user", content: `Video: "${vid.title}"\nNiche: ${vid.niche || 'unknown'}\nViews: ${views.toLocaleString()} in ${Math.floor(daysSince)} days\nLikes: ${likes}, Comments: ${comments}\nGrade: ${grade} (prev: ${vid.performance_grade})\nHook type: ${vid.hook_type || 'unknown'}\nTitle pattern: ${vid.title_pattern || 'unknown'}\nPredicted score: ${vid.predicted_viral_score}\n\nAnalyze: What worked? What failed? What hook/title/structure techniques should be kept or avoided?` }
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
                          hook_verdict: { type: "string", description: "Was the hook effective? Keep or change?" },
                          title_verdict: { type: "string", description: "Did the title attract clicks?" },
                        },
                        required: ["what_worked", "what_failed", "lessons", "next_time", "prediction_accuracy", "hook_verdict", "title_verdict"],
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

                  // ═══ FEED BACK INTO ai_learning (closes the loop) ═══
                  await sb.from("ai_learning").insert({
                    topic: `performance_${grade}_${vid.niche || 'general'}`,
                    source: "track-video-performance",
                    insight: `[Grade ${grade}] "${vid.title}" — ${views} views in ${Math.floor(daysSince)}d. Hook: ${feedback.hook_verdict}. Title: ${feedback.title_verdict}. Lessons: ${feedback.lessons.join('; ')}. Next time: ${feedback.next_time}`,
                  });

                  // ═══ CLOSE SCRIPT→PERFORMANCE LOOP ═══
                  // If this video was generated from a saved script, feed real results back
                  if (vid.script_id) {
                    try {
                      const { data: script } = await sb.from("saved_scripts")
                        .select("style, video_type, duration, topic")
                        .eq("id", vid.script_id)
                        .maybeSingle();

                      if (script) {
                        // Update user_script_preferences with real performance data
                        const { data: existingPref } = await sb.from("user_script_preferences")
                          .select("id, preferred_styles, avg_retention_by_style")
                          .eq("user_id", vid.user_id)
                          .maybeSingle();

                        const styleKey = script.style || script.video_type || 'default';
                        const retention = vid.avg_retention_percent || 50;

                        if (existingPref) {
                          // Merge real performance into preference tracking
                          const retByStyle = (existingPref.avg_retention_by_style as Record<string, any>) || {};
                          if (!retByStyle[styleKey]) retByStyle[styleKey] = { total: 0, count: 0 };
                          retByStyle[styleKey].total += retention;
                          retByStyle[styleKey].count += 1;

                          await sb.from("user_script_preferences").update({
                            avg_retention_by_style: retByStyle,
                            updated_at: new Date().toISOString(),
                          }).eq("id", existingPref.id);
                        }

                        // Log specific script→performance insight
                        await sb.from("ai_learning").insert({
                          topic: "script_performance_link",
                          source: "track-video-performance",
                          insight: `Script style="${styleKey}" duration=${script.duration}min topic="${script.topic}" → Grade ${grade}, ${views} views, ${retention}% retention in ${Math.floor(daysSince)}d. ${feedback.hook_verdict}`,
                        });
                      }
                    } catch (e) {
                      console.error("Script→performance link error:", e);
                    }
                  }

                  // ═══ FEED BACK TO hook_library (evolve hooks based on real data) ═══
                  if (vid.hook_type) {
                    const retention_adj = grade === 'S' || grade === 'A' ? 0.5 : grade === 'D' || grade === 'F' ? -0.5 : 0;
                    if (retention_adj !== 0) {
                      const { data: hooks } = await sb.from("hook_library")
                        .select("id, retention_score")
                        .eq("hook_type", vid.hook_type)
                        .limit(5);
                      for (const hook of (hooks || [])) {
                        const newScore = Math.max(1, Math.min(10, (hook.retention_score || 5) + retention_adj));
                        await sb.from("hook_library").update({ retention_score: newScore }).eq("id", hook.id);
                      }
                    }
                  }

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
        .select("id, user_id, title, ranking_keywords, youtube_video_id, best_ranking_position")
        .not("ranking_keywords", "eq", "[]")
        .not("ranking_keywords", "is", null)
        .order("last_checked_at", { ascending: true })
        .limit(20);

      for (const vid of (videos || [])) {
        const keywords = (vid.ranking_keywords as string[]) || [];
        if (keywords.length === 0) continue;

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
              const currentBest = vid.best_ranking_position || 999;
              await sb.from("video_performance").update({
                best_ranking_position: Math.min(position + 1, currentBest),
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
