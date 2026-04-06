import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { 
      keywords, 
      maxResults = 50, 
      minMultiplier = 10, 
      maxSubs = 100000, 
      minSubs = 500, 
      publishedAfterDays = 30,
      extractDNA = true,
    } = await req.json();
    
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const publishedAfter = new Date(Date.now() - publishedAfterDays * 86400000).toISOString();
    
    // Search for viral videos in the niche
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keywords)}&type=video&publishedAfter=${publishedAfter}&order=viewCount&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (!searchData.items?.length) {
      return new Response(JSON.stringify({ outliers: [], total_searched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get video statistics (views, likes, comments)
    const videoIds = searchData.items.map((v: any) => v.id.videoId).filter(Boolean).join(",");
    const videoStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videoStatsRes = await fetch(videoStatsUrl);
    const videoStatsData = await videoStatsRes.json();
    
    const videoDataMap = new Map<string, { views: number; likes: number; comments: number; duration: string }>();
    for (const v of videoStatsData.items || []) {
      videoDataMap.set(v.id, {
        views: parseInt(v.statistics.viewCount || "0"),
        likes: parseInt(v.statistics.likeCount || "0"),
        comments: parseInt(v.statistics.commentCount || "0"),
        duration: v.contentDetails?.duration || "",
      });
    }

    // Get unique channel IDs
    const channelIds = [...new Set(searchData.items.map((v: any) => v.snippet.channelId))];
    
    // Batch fetch channel stats
    const channelStatsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds.join(",")}&key=${YOUTUBE_API_KEY}`;
    const channelStatsRes = await fetch(channelStatsUrl);
    const channelStatsData = await channelStatsRes.json();
    
    const channelMap = new Map<string, { subs: number; name: string; thumbnail: string; videoCount: number }>();
    for (const ch of channelStatsData.items || []) {
      channelMap.set(ch.id, {
        subs: parseInt(ch.statistics.subscriberCount || "0"),
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.default?.url || "",
        videoCount: parseInt(ch.statistics.videoCount || "0"),
      });
    }

    // Find outliers: small channels with viral videos
    const outliers: any[] = [];
    for (const video of searchData.items) {
      const channelId = video.snippet.channelId;
      const videoId = video.id.videoId;
      const channel = channelMap.get(channelId);
      const videoData = videoDataMap.get(videoId);
      const views = videoData?.views || 0;
      
      if (!channel) continue;
      
      const { subs, name, thumbnail, videoCount } = channel;
      if (subs < minSubs || subs > maxSubs) continue;
      
      const multiplier = subs > 0 ? views / subs : 0;
      if (multiplier < minMultiplier) continue;

      // Calculate engagement metrics
      const likes = videoData?.likes || 0;
      const comments = videoData?.comments || 0;
      const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
      const likesToViews = views > 0 ? (likes / views) * 100 : 0;
      
      // Algorithmic Gold Score: combines multiplier + engagement + channel efficiency
      const channelEfficiency = videoCount > 0 ? views / videoCount : 0;
      const goldScore = Math.min(100, Math.round(
        (Math.min(multiplier, 100) / 100) * 40 +  // multiplier weight
        (Math.min(engagementRate, 10) / 10) * 30 + // engagement weight
        (Math.min(channelEfficiency / 10000, 1)) * 30 // efficiency weight
      ));
      
      outliers.push({
        video_title: video.snippet.title,
        video_url: `https://youtube.com/watch?v=${videoId}`,
        video_id: videoId,
        channel_name: name,
        channel_id: channelId,
        subscribers: subs,
        views,
        likes,
        comments,
        multiplier: Math.round(multiplier * 100) / 100,
        engagement_rate: Math.round(engagementRate * 100) / 100,
        likes_ratio: Math.round(likesToViews * 100) / 100,
        gold_score: goldScore,
        niche: keywords,
        thumbnail_url: video.snippet.thumbnails?.high?.url || thumbnail,
        published_at: video.snippet.publishedAt,
        duration: videoData?.duration || "",
        channel_video_count: videoCount,
      });
    }

    // Sort by gold_score (most algorithmically valuable first)
    outliers.sort((a, b) => b.gold_score - a.gold_score);

    // Save to DB if user is authenticated
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: claims } = await sb.auth.getUser();
        userId = claims?.user?.id || null;
        if (userId && outliers.length > 0) {
          const rows = outliers.slice(0, 20).map(o => ({
            user_id: userId!,
            video_title: o.video_title,
            video_url: o.video_url,
            channel_name: o.channel_name,
            channel_id: o.channel_id,
            subscribers: o.subscribers,
            views: o.views,
            multiplier: o.multiplier,
            niche: o.niche,
            thumbnail_url: o.thumbnail_url,
            published_at: o.published_at,
          }));
          await sb.from("outlier_channels").insert(rows);
        }
      } catch (e) {
        console.error("Error saving outliers:", e);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PAIRED LOSERS — Find underperforming videos from same channels
    // ═══════════════════════════════════════════════════════════════
    const YOUTUBE_API_KEY_FOR_LOSERS = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (YOUTUBE_API_KEY_FOR_LOSERS && outliers.length > 0) {
      try {
        // Get unique channels from top 5 outliers
        const topChannelIds = [...new Set(outliers.slice(0, 5).map(o => o.channel_id))].slice(0, 3);
        
        for (const chId of topChannelIds) {
          // Get channel's uploads playlist
          const chResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${chId}&key=${YOUTUBE_API_KEY_FOR_LOSERS}`);
          const chData = await chResp.json();
          const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          const totalViews = parseInt(chData.items?.[0]?.statistics?.viewCount || "0");
          const totalVids = parseInt(chData.items?.[0]?.statistics?.videoCount || "1");
          const channelAvg = totalVids > 0 ? Math.round(totalViews / totalVids) : 0;
          if (!uploadsId) continue;

          // Get recent videos
          const plResp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=15&key=${YOUTUBE_API_KEY_FOR_LOSERS}`);
          const plData = await plResp.json();
          const vidIds = (plData.items || []).map((i: any) => i.snippet?.resourceId?.videoId).filter(Boolean);
          if (!vidIds.length) continue;

          const vResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${vidIds.join(",")}&key=${YOUTUBE_API_KEY_FOR_LOSERS}`);
          const vData = await vResp.json();

          // Find losers: videos BELOW channel average
          const losers = (vData.items || [])
            .map((v: any) => ({
              title: v.snippet?.title,
              views: parseInt(v.statistics?.viewCount || "0"),
              videoId: v.id,
            }))
            .filter((v: any) => v.views < channelAvg && v.views > 0)
            .sort((a: any, b: any) => a.views - b.views)
            .slice(0, 3);

          // Attach paired_losers to matching outliers
          for (const ol of outliers.filter(o => o.channel_id === chId)) {
            ol.paired_losers = losers.map((l: any) => ({
              title: l.title,
              views: l.views,
              delta_vs_outlier: ol.views - l.views,
              delta_vs_avg: channelAvg - l.views,
            }));
            ol.channel_avg_views = channelAvg;
          }
        }
      } catch (e) {
        console.warn("Paired losers fetch error:", e);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CONTENT DNA EXTRACTION — Auto-extract from top outliers
    // ═══════════════════════════════════════════════════════════════
    let dnaResults: any[] = [];
    if (extractDNA && outliers.length > 0) {
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (GOOGLE_AI_API_KEY) {
        try {
          const topOutliers = outliers.slice(0, 5);
          const outlierSummary = topOutliers.map((o, i) => 
            `${i+1}. "${o.video_title}" — ${o.channel_name} (${o.subscribers} subs, ${o.views} views, ${o.multiplier}x, engagement: ${o.engagement_rate}%)`
          ).join("\n");

          const AI_URL_DNA = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
          const dnaRes = await fetch(AI_URL_DNA, {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `You are a Content DNA analyst. Extract the viral DNA from outlier videos — the specific patterns that caused small channels to go viral. Focus on: hook type, title pattern, thumbnail pattern hypothesis, story structure, pacing style, emotional triggers, and visual style. Output STRUCTURED data only.`
                },
                {
                  role: "user",
                  content: `Extract Content DNA from these outlier videos in the "${keywords}" niche:\n\n${outlierSummary}\n\nFor each video, identify the specific viral DNA.`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "save_content_dna",
                  parameters: {
                    type: "object",
                    properties: {
                      videos: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            hook_type: { type: "string", description: "curiosity_gap, shock, counter_intuitive, stakes, forbidden_knowledge, identity, paradox" },
                            title_pattern: { type: "string", description: "The reusable title template, e.g. 'O que acontece quando [X]?'" },
                            thumbnail_pattern: { type: "string", description: "Hypothesized thumbnail style: reaction_face, before_after, text_overlay, dramatic_scene, contrast" },
                            story_structure: { type: "string", description: "linear, flashforward, mystery_reveal, listicle, comparison, transformation" },
                            pacing: { type: "string", description: "fast_cuts, slow_build, escalating, constant_intensity" },
                            emotion_primary: { type: "string" },
                            emotion_secondary: { type: "string" },
                            visual_style: { type: "string", description: "cinematic, documentary, animated, screen_recording, talking_head, b_roll_heavy" },
                            why_viral: { type: "string", description: "1-sentence explanation of the viral mechanism" },
                            replication_template: { type: "string", description: "How to replicate this video's success in the same niche" },
                          },
                          required: ["title", "hook_type", "title_pattern", "story_structure", "emotion_primary", "why_viral"]
                        }
                      },
                      niche_patterns: {
                        type: "object",
                        properties: {
                          dominant_hook_type: { type: "string" },
                          dominant_story_structure: { type: "string" },
                          dominant_emotion: { type: "string" },
                          avg_title_length: { type: "number" },
                          uses_numbers: { type: "boolean" },
                          uses_questions: { type: "boolean" },
                          recommended_style: { type: "string" },
                        }
                      }
                    },
                    required: ["videos", "niche_patterns"],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "save_content_dna" } },
            }),
          });

          if (dnaRes.ok) {
            const dnaData = await dnaRes.json();
            const tc = dnaData.choices?.[0]?.message?.tool_calls?.[0];
            if (tc) {
              const dna = JSON.parse(tc.function.arguments);
              dnaResults = dna.videos || [];

              // ═══ AUTO-FEED: Save DNA to viral database ═══
              const sbService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
              const feedPromises: Promise<any>[] = [];

              for (let i = 0; i < dnaResults.length && i < topOutliers.length; i++) {
                const dnaVideo = dnaResults[i];
                const outlier = topOutliers[i];

                // Feed viral_titles_db
                feedPromises.push(
                  sbService.from("viral_titles_db").upsert({
                    title: outlier.video_title,
                    views: outlier.views,
                    channel_id: outlier.channel_id,
                    channel_name: outlier.channel_name,
                    niche: keywords,
                    language: "auto",
                    title_pattern: dnaVideo.title_pattern || null,
                    emotional_triggers: [dnaVideo.emotion_primary, dnaVideo.emotion_secondary].filter(Boolean),
                    why_viral: dnaVideo.why_viral || `Outlier: ${outlier.multiplier}x com ${outlier.subscribers} subs`,
                  }, { onConflict: "title" }).catch(() => {})
                );

                // Feed hook_library
                if (dnaVideo.hook_type) {
                  feedPromises.push(
                    sbService.from("hook_library").insert({
                      hook_text: `[${dnaVideo.hook_type.toUpperCase()}] ${outlier.video_title}`,
                      hook_type: dnaVideo.hook_type,
                      niche: keywords,
                      retention_score: Math.min(10, Math.round(outlier.gold_score / 10)),
                      source_video: outlier.video_url,
                    }).catch(() => {})
                  );
                }

                // Feed video_blueprints with full DNA
                feedPromises.push(
                  sbService.from("video_blueprints").upsert({
                    video_id: outlier.video_id,
                    video_title: outlier.video_title,
                    channel_id: outlier.channel_id,
                    channel_name: outlier.channel_name,
                    niche: keywords,
                    views: outlier.views,
                    hook_type: dnaVideo.hook_type,
                    narrative_style: dnaVideo.story_structure,
                    story_structure: {
                      type: dnaVideo.story_structure,
                      pacing: dnaVideo.pacing,
                      visual_style: dnaVideo.visual_style,
                    },
                    scores: {
                      gold_score: outlier.gold_score,
                      multiplier: outlier.multiplier,
                      engagement_rate: outlier.engagement_rate,
                    },
                    source: "outlier-dna-auto",
                  }, { onConflict: "video_id" }).catch(() => {})
                );
              }

              // Save niche-level patterns
              if (dna.niche_patterns) {
                feedPromises.push(
                  sbService.from("ai_learning").insert({
                    topic: `niche_dna_${keywords}_${Date.now()}`,
                    source: "outlier-dna-engine",
                    insight: JSON.stringify({
                      niche: keywords,
                      patterns: dna.niche_patterns,
                      sample_size: dnaResults.length,
                      avg_multiplier: topOutliers.reduce((s, o) => s + o.multiplier, 0) / topOutliers.length,
                      extracted_at: new Date().toISOString(),
                    }),
                  }).catch(() => {})
                );
              }

              // ═══ AUTO-FEED: content_dna table ═══
              for (let i = 0; i < dnaResults.length && i < topOutliers.length; i++) {
                const dv = dnaResults[i];
                const ol = topOutliers[i];
                feedPromises.push(
                  sbService.from("content_dna").upsert({
                    video_id: ol.video_id,
                    video_title: ol.video_title,
                    channel_id: ol.channel_id,
                    channel_name: ol.channel_name,
                    niche: keywords,
                    views: ol.views,
                    subscribers: ol.subscribers,
                    multiplier: ol.multiplier,
                    hook_type: dv.hook_type || null,
                    hook_pattern: dv.title_pattern || null,
                    hook_strength: ol.gold_score ? Math.min(10, ol.gold_score / 10) : 5,
                    title_structure: dv.title_pattern || null,
                    story_structure: dv.story_structure || null,
                    pacing: dv.pacing || null,
                    visual_style: dv.visual_style || null,
                    thumbnail_pattern: dv.thumbnail_pattern || null,
                    emotion_primary: dv.emotion_primary || null,
                    emotion_secondary: dv.emotion_secondary || null,
                    psychological_triggers: [dv.emotion_primary, dv.emotion_secondary].filter(Boolean),
                    why_viral: dv.why_viral || `Outlier: ${ol.multiplier}x`,
                    replication_template: dv.replication_template || null,
                    gold_score: ol.gold_score || 0,
                    viral_score: ol.gold_score || 0,
                    source: "outlier-engine-auto",
                  }, { onConflict: "video_id" }).catch(() => {})
                );
              }

              await Promise.all(feedPromises);
            }
          }
        } catch (e) {
          console.error("DNA extraction error:", e);
        }
      }
    }

    return new Response(JSON.stringify({ 
      outliers: outliers.slice(0, 20), 
      total_searched: searchData.items.length,
      total_outliers: outliers.length,
      content_dna: dnaResults,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-outliers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
