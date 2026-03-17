import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Curated Veo3 reference channels ──
const REFERENCE_CHANNELS = [
  // Restoration / DIY
  { url: "@mrsklaragarage", category: "restoration" },
  { url: "@Restoration-Factory", category: "restoration" },
  { url: "@kamilbusiness-22", category: "restoration" },
  // Movies / Compilations
  { url: "@stash_movies", category: "movies" },
  { url: "@Filmaxia", category: "movies" },
  // Dog / Animal Stories
  { url: "@VeteranDogTales", category: "animal_stories" },
  // Western / Old West Stories
  { url: "@SilentWestTales", category: "western_stories" },
  { url: "@Dusty_Boots", category: "western_stories" },
  { url: "@CowboyStoryStation", category: "western_stories" },
  { url: "@StoriesoftheCountryside-Us", category: "western_stories" },
  { url: "@RomancesoftheOldWest", category: "western_stories" },
  { url: "@BobsStoriesFromtheOldWest", category: "western_stories" },
  { url: "@HorsebackChronicles-p3h", category: "western_stories" },
  { url: "@HeartOfThePrairie", category: "western_stories" },
  // Survival / Outlander Stories
  { url: "@TheFindersTale", category: "survival_stories" },
  { url: "@Outlanderssurvivalstories", category: "survival_stories" },
  { url: "@ForgottenOutlandsTeachings", category: "survival_stories" },
  // Inspirational / Age Stories
  { url: "@DreamsDontAge", category: "inspirational" },
  { url: "@GrandmaTrueStories", category: "inspirational" },
  { url: "@EverydayValorStories-o3t", category: "inspirational" },
  // Heartbreak / Drama
  { url: "@HEARTBREAK-STORIES-CHANNEL", category: "drama_stories" },
  { url: "@IntoThePastStories", category: "drama_stories" },
  // Channel IDs
  { url: "channel/UCHL5AxOuChnnkXAzW4E5hgQ", category: "stories" },
  { url: "channel/UCqxEDM4DwBKgSkJc6zK-Dvw", category: "stories" },
  { url: "channel/UCEny9ly3uAew5ZasV3tXL7A", category: "stories" },
];

function getYouTubeKeys(): string[] {
  return [
    Deno.env.get("YOUTUBE_API_KEY"),
    Deno.env.get("YOUTUBE_API_KEY_2"),
    Deno.env.get("YOUTUBE_API_KEY_3"),
    Deno.env.get("YOUTUBE_API_KEY_4"),
  ].filter(Boolean) as string[];
}

let currentKeyIndex = 0;

async function ytFetch(endpoint: string, keys: string[]): Promise<any> {
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    const key = keys[idx];
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${YOUTUBE_API_BASE}/${endpoint}${sep}key=${key}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data?.error) {
      currentKeyIndex = idx;
      return data;
    }
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || res.status === 429) {
      console.log(`Key ${idx} quota exceeded, rotating...`);
      continue;
    }
    throw new Error(data?.error?.message || `YouTube ${res.status}`);
  }
  throw new Error("All YouTube API keys exhausted");
}

async function resolveChannelId(input: string, keys: string[]): Promise<string> {
  // Direct channel ID
  const cidMatch = input.match(/channel\/(UC[\w-]+)/);
  if (cidMatch) return cidMatch[1];

  // Handle
  const handle = input.replace(/^@/, "").replace(/\/videos$/, "");
  const data = await ytFetch(`channels?part=id&forHandle=${encodeURIComponent(handle)}`, keys);
  if (data?.items?.[0]?.id) return data.items[0].id;

  // Fallback search
  const search = await ytFetch(`search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1`, keys);
  if (search?.items?.[0]?.snippet?.channelId) return search.items[0].snippet.channelId;

  throw new Error(`Cannot resolve: ${input}`);
}

async function aiAnalyze(prompt: string, apiKey: string, tool: any): Promise<any> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a YouTube content intelligence analyst specializing in faceless/AI-generated long-form video channels. Analyze with precision. Always respond via the tool call." },
        { role: "user", content: prompt.slice(0, 8000) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) { await new Promise(r => setTimeout(r, 5000)); throw new Error("rate_limited"); }
    throw new Error(`AI ${res.status}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("No tool call returned");
  return JSON.parse(tc.function.arguments);
}

const CHANNEL_DEEP_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_veo3_channel",
    description: "Deep analysis of a Veo3-style YouTube channel",
    parameters: {
      type: "object",
      properties: {
        niche: { type: "string" },
        sub_niche: { type: "string" },
        language: { type: "string" },
        country: { type: "string" },
        style: { type: "string", description: "Visual/narrative style (e.g. cinematic western, dramatic storytelling)" },
        is_faceless: { type: "boolean" },
        is_veo3_style: { type: "boolean", description: "Whether content appears AI-generated (Veo3, Sora, etc.)" },
        visual_style_notes: { type: "string", description: "Detailed visual style description: camera movements, color grading, scene types" },
        content_model: { type: "string", enum: ["storytelling", "documentary", "mystery", "drama", "restoration", "compilation", "educational", "emotional"] },
        avg_video_duration_min: { type: "number" },
        hook_patterns: { type: "array", items: { type: "string" }, description: "Common hook techniques used" },
        title_formulas: { type: "array", items: { type: "string" }, description: "Title templates that work" },
        narrative_structure: { type: "string", description: "How stories are structured (e.g. intro→conflict→resolution→twist)" },
        scene_types: { type: "array", items: { type: "string" }, description: "Common scene types used (e.g. wide landscape, close-up face, action sequence)" },
        camera_techniques: { type: "array", items: { type: "string" }, description: "Camera movements and angles used" },
        music_style: { type: "string" },
        pacing: { type: "string", enum: ["slow", "medium", "fast", "variable"] },
        emotion_primary: { type: "string" },
        psychological_triggers: { type: "array", items: { type: "string" } },
        why_successful: { type: "string" },
        replication_guide_pt: { type: "string", description: "Step-by-step guide to replicate this channel's style in Portuguese" },
        replication_guide_en: { type: "string", description: "Step-by-step guide to replicate in English for other markets" },
        best_markets: { type: "array", items: { type: "string" }, description: "Best countries/languages to replicate this content" },
        estimated_rpm: { type: "number" },
        growth_rate: { type: "string", enum: ["explosive", "fast", "steady", "slow"] },
        top_video_patterns: { type: "array", items: { type: "object", properties: { title: { type: "string" }, views: { type: "number" }, why_viral: { type: "string" }, hook_text: { type: "string" } }, required: ["title", "views", "why_viral"] } },
      },
      required: ["niche", "sub_niche", "language", "country", "style", "is_faceless", "is_veo3_style", "visual_style_notes", "content_model", "hook_patterns", "title_formulas", "narrative_structure", "scene_types", "camera_techniques", "pacing", "emotion_primary", "psychological_triggers", "why_successful", "replication_guide_pt", "best_markets"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { start_index = 0, batch_size = 5 } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const ytKeys = getYouTubeKeys();
    if (!ytKeys.length) throw new Error("No YouTube API keys configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Deduplicate channels
    const seen = new Set<string>();
    const uniqueChannels = REFERENCE_CHANNELS.filter(c => {
      const key = c.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const batch = uniqueChannels.slice(start_index, start_index + batch_size);
    const report: any[] = [];
    let processed = 0, errors = 0;

    for (const ch of batch) {
      const label = ch.url;
      try {
        console.log(`Processing ${label}...`);

        // 1. Resolve channel ID
        const channelId = await resolveChannelId(ch.url, ytKeys);

        // 2. Get channel stats
        const chData = await ytFetch(`channels?part=snippet,statistics,contentDetails&id=${channelId}`, ytKeys);
        const channel = chData.items?.[0];
        if (!channel) { console.error(`${label}: not found`); errors++; continue; }

        const subs = parseInt(channel.statistics.subscriberCount || "0");
        const totalViews = parseInt(channel.statistics.viewCount || "0");
        const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;

        // 3. Get top videos (by view count)
        const topSearch = await ytFetch(`search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=15&type=video`, ytKeys);
        const topIds = (topSearch.items || []).map((i: any) => i.id.videoId).filter(Boolean);

        let topVideos: any[] = [];
        if (topIds.length) {
          const vData = await ytFetch(`videos?part=snippet,statistics,contentDetails&id=${topIds.join(",")}`, ytKeys);
          topVideos = (vData.items || []).map((v: any) => {
            const views = parseInt(v.statistics?.viewCount || "0");
            const likes = parseInt(v.statistics?.likeCount || "0");
            const dMatch = (v.contentDetails?.duration || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const dSec = dMatch ? (parseInt(dMatch[1]||"0")*3600 + parseInt(dMatch[2]||"0")*60 + parseInt(dMatch[3]||"0")) : 0;
            return {
              video_id: v.id,
              title: v.snippet.title,
              views,
              likes,
              duration_seconds: dSec,
              description: (v.snippet.description || "").slice(0, 300),
              published_at: v.snippet.publishedAt,
              tags: (v.snippet.tags || []).slice(0, 10),
            };
          }).sort((a: any, b: any) => b.views - a.views);
        }

        const avgViews = topVideos.length ? Math.round(topVideos.reduce((s: number, v: any) => s + v.views, 0) / topVideos.length) : 0;

        // 4. AI Deep Analysis
        const prompt = `Analyze this YouTube channel deeply for Veo3/AI-video replication:

CHANNEL: "${channel.snippet.title}"
Subscribers: ${subs.toLocaleString()}
Total views: ${totalViews.toLocaleString()}
Category: ${ch.category}
Description: "${(channel.snippet.description || "").slice(0, 500)}"
Country: ${channel.snippet.country || "Unknown"}

TOP ${topVideos.length} VIDEOS:
${topVideos.slice(0, 12).map((v: any, i: number) => `${i+1}. "${v.title}" — ${v.views.toLocaleString()} views, ${Math.round(v.duration_seconds/60)}min, tags: ${v.tags.slice(0,5).join(", ")}`).join("\n")}

This channel appears to use AI-generated video (Veo3/Sora style). Analyze:
1. Visual style, camera movements, scene types used
2. Narrative structure and pacing
3. Hook patterns and title formulas
4. Why this content goes viral
5. How to replicate for Brazil (PT-BR) and other high-RPM markets
6. What makes the TOP videos outperform others`;

        let analysis: any;
        try {
          analysis = await aiAnalyze(prompt, LOVABLE_API_KEY, CHANNEL_DEEP_TOOL);
        } catch (e: any) {
          if (e.message === "rate_limited") {
            console.log("Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
            analysis = await aiAnalyze(prompt, LOVABLE_API_KEY, CHANNEL_DEEP_TOOL);
          } else throw e;
        }

        // 5. Save to channel_intelligence
        await sb.from("channel_intelligence").upsert({
          youtube_channel_id: channelId,
          channel_name: channel.snippet.title,
          subscribers: subs,
          avg_views: avgViews,
          niche: analysis.niche || ch.category,
          sub_niche: analysis.sub_niche,
          language: analysis.language || "en",
          country: analysis.country || channel.snippet.country || "US",
          style: analysis.style || "unknown",
          is_faceless: analysis.is_faceless ?? true,
          is_monetized: subs >= 1000,
          growth_rate: analysis.growth_rate || "steady",
          upload_frequency: `${analysis.avg_video_duration_min || 0}min avg`,
          rpm_estimate: analysis.estimated_rpm || 0,
          visual_style_notes: analysis.visual_style_notes,
          top_videos: (analysis.top_video_patterns || topVideos.slice(0, 5)).map((v: any) => ({
            video_id: v.video_id || "",
            title: v.title,
            views: v.views || 0,
            hook_text: v.hook_text || v.why_viral || "",
          })),
          viral_patterns: {
            hook_patterns: analysis.hook_patterns,
            title_formulas: analysis.title_formulas,
            narrative_structure: analysis.narrative_structure,
            scene_types: analysis.scene_types,
            camera_techniques: analysis.camera_techniques,
            music_style: analysis.music_style,
            pacing: analysis.pacing,
            content_model: analysis.content_model,
            is_veo3_style: analysis.is_veo3_style,
            replication_guide_pt: analysis.replication_guide_pt,
            replication_guide_en: analysis.replication_guide_en,
            best_markets: analysis.best_markets,
            psychological_triggers: analysis.psychological_triggers,
            why_successful: analysis.why_successful,
          },
          analyzed_at: new Date().toISOString(),
        }, { onConflict: "youtube_channel_id" });

        // 6. Save top videos to viral_titles_db
        for (const v of topVideos.slice(0, 8)) {
          await sb.from("viral_titles_db").upsert({
            title: v.title,
            views: v.views,
            likes: v.likes,
            channel_id: channelId,
            channel_name: channel.snippet.title,
            duration_seconds: v.duration_seconds,
            published_at: v.published_at,
            niche: analysis.niche || ch.category,
            language: analysis.language || "en",
          }, { onConflict: "title" }).catch(() => {});
        }

        // 7. Save content DNA for each top video
        for (const v of topVideos.slice(0, 5)) {
          const multiplier = avgViews > 0 ? Math.round(v.views / avgViews * 100) / 100 : 1;
          await sb.from("content_dna").upsert({
            video_id: v.video_id,
            video_title: v.title,
            channel_id: channelId,
            channel_name: channel.snippet.title,
            niche: analysis.niche || ch.category,
            language: analysis.language || "en",
            views: v.views,
            subscribers: subs,
            multiplier,
            hook_type: analysis.hook_patterns?.[0] || "story",
            hook_pattern: analysis.hook_patterns?.join(", "),
            title_structure: "story",
            story_structure: analysis.narrative_structure || "hero_journey",
            pacing: analysis.pacing || "medium",
            visual_style: analysis.visual_style_notes,
            emotion_primary: analysis.emotion_primary || "curiosity",
            psychological_triggers: analysis.psychological_triggers || [],
            attention_score: 80,
            curiosity_score: 85,
            dopamine_score: 75,
            estimated_retention: 65,
            why_viral: analysis.why_successful,
            content_model: analysis.content_model || "storytelling",
            viral_score: multiplier >= 3 ? 90 : multiplier >= 2 ? 80 : 70,
            source: "seed-reference-channels",
            video_type: "long",
          }, { onConflict: "video_id" }).catch(e => console.error(`DNA upsert error:`, e));
        }

        // 8. Save viral patterns by niche/category
        await sb.from("viral_patterns").insert({
          pattern_name: `${analysis.content_model || ch.category}_${channel.snippet.title.slice(0, 20)}`,
          niche: analysis.niche || ch.category,
          source_video: topVideos[0]?.title || channel.snippet.title,
          pattern_json: {
            hook_types: analysis.hook_patterns,
            emotional_triggers: analysis.psychological_triggers,
            title_formulas: analysis.title_formulas,
            pacing: analysis.pacing,
            scene_types: analysis.scene_types,
            camera_techniques: analysis.camera_techniques,
            narrative_structure: analysis.narrative_structure,
            content_model: analysis.content_model,
            is_veo3: analysis.is_veo3_style,
            replication_guide_pt: analysis.replication_guide_pt,
            best_markets: analysis.best_markets,
            success_factor: analysis.why_successful,
          },
        }).catch(() => {});

        processed++;
        report.push({ channel: channel.snippet.title, channelId, status: "ok", niche: analysis.niche, videos: topVideos.length });

        // Rate limit protection
        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        console.error(`Error processing ${label}:`, e.message);
        errors++;
        report.push({ channel: label, status: "error", error: e.message });
      }
    }

    // Log execution
    await sb.from("execution_logs").insert({
      function_name: "seed-reference-channels",
      success: errors === 0,
      duration_ms: 0,
      metadata: {
        batch_start: start_index,
        batch_size,
        processed,
        errors,
        total_channels: uniqueChannels.length,
        next_index: start_index + batch_size < uniqueChannels.length ? start_index + batch_size : null,
        report,
      },
    }).catch(() => {});

    return new Response(JSON.stringify({
      success: true,
      processed,
      errors,
      total_channels: uniqueChannels.length,
      next_index: start_index + batch_size < uniqueChannels.length ? start_index + batch_size : null,
      report,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-reference-channels error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
