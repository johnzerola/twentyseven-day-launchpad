// ═══════════════════════════════════════════════════════════════
// TUBEBOT TOOL EXECUTOR — Executes tool calls with retry + timeout
// ═══════════════════════════════════════════════════════════════

import { callGeminiOpenAICompat } from "./gemini-direct.ts";

const DEFAULT_TOOL_TIMEOUT_MS = 15000;
const TOOL_TIMEOUTS_MS: Record<string, number> = {
  "analyze-channel": 12000,
  "youtube_channel_stats": 10000,
  "youtube_channel_videos": 10000,
  "youtube_video_stats": 10000,
  "youtube_search_api": 10000,
  "perplexity-research": 20000,
  "expert_analysis": 15000,
};

const NON_RETRYABLE_TIMEOUT_TOOLS = new Set([
  "analyze_channel", "analyze_niche",
  "youtube_channel_stats", "youtube_channel_videos",
  "youtube_video_stats", "youtube_search_api",
]);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)),
  ]);
}

function getYTKeys(): string[] {
  return [
    Deno.env.get("YOUTUBE_API_KEY"),
    Deno.env.get("YOUTUBE_API_KEY_2"),
    Deno.env.get("YOUTUBE_API_KEY_3"),
    Deno.env.get("YOUTUBE_API_KEY_4"),
  ].filter(Boolean) as string[];
}

export async function executeTool(
  toolName: string,
  args: any,
  sb: any,
  supabaseUrl: string,
  serviceKey: string,
  attempt = 1
): Promise<string> {
  const callFn = async (fnName: string, payload: any) => {
    try {
      const timeoutMs = TOOL_TIMEOUTS_MS[toolName] || TOOL_TIMEOUTS_MS[fnName] || DEFAULT_TOOL_TIMEOUT_MS;
      const resp = await withTimeout(
        fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify(payload),
        }),
        timeoutMs,
        fnName
      );
      const text = await resp.text();
      if (!resp.ok) {
        console.error(`Tool ${fnName} HTTP ${resp.status}:`, text.slice(0, 500));
        return { error: `HTTP ${resp.status}`, details: text.slice(0, 300), data_reliability: "FAILED" };
      }
      try { return JSON.parse(text); } catch { return { raw: text.slice(0, 3000) }; }
    } catch (e: any) {
      console.error(`Tool ${fnName} error:`, e.message);
      return { error: e.message, data_reliability: "FAILED" };
    }
  };

  const _ai = async (body: any) => {
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
    return await callGeminiOpenAICompat(apiKey, body);
  };

  try {
    let result: any;

    switch (toolName) {
      case "dubspy_search": {
        const modeMap: Record<string, string> = {
          videos: "emerging", channels: "cluster", emerging: "emerging",
          escapees: "escapees", micro_niche: "micro-niche-drill",
          "micro-niche-drill": "micro-niche-drill", cluster: "cluster",
        };
        result = await callFn("dubspy-scan", {
          niche: args.niche || args.query || "general",
          mode: modeMap[args.mode || "emerging"] || "emerging",
          country: args.country || "BR",
          language: args.language || "pt",
          minVideoViews: args.min_views,
          maxSubs: args.max_subs,
        });
        break;
      }

      case "analyze_niche": {
        const nicheQuery = (args.niche || args.query || '').toLowerCase();
        const [nicheDbResult, nicheChannels, nicheVirals, nicheSaturation] = await Promise.all([
          sb.from("niche_database").select("*").or(`name.ilike.%${nicheQuery}%,sub_niches.cs.{${nicheQuery}}`).limit(10),
          sb.from("channel_intelligence")
            .select("channel_name, subscribers, avg_views, growth_rate, rpm_estimate, style, is_faceless, country, upload_frequency, created_at")
            .ilike("niche", `%${nicheQuery}%`).order("avg_views", { ascending: false }).limit(15),
          sb.from("viral_titles_db")
            .select("title, views, channel_name, emotional_triggers, why_viral")
            .ilike("niche", `%${nicheQuery}%`).order("views", { ascending: false }).limit(10),
          sb.from("channel_intelligence")
            .select("id", { count: "exact", head: true })
            .ilike("niche", `%${nicheQuery}%`)
            .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
        ]);
        const nicheInfo = nicheDbResult.data?.[0];
        const newChannels90d = nicheSaturation.count || 0;
        const saturationVelocity = Math.round((newChannels90d / 3) * 10) / 10;
        result = {
          niche: args.niche, country: args.country || 'BR',
          database: nicheInfo ? {
            rpm: nicheInfo.rpm_estimate, difficulty: nicheInfo.difficulty,
            saturation: nicheInfo.saturation, faceless_friendly: nicheInfo.faceless_friendly,
            sub_niches: nicheInfo.sub_niches,
          } : { note: "Niche not in database — using channel data" },
          saturation_analysis: {
            new_channels_last_90_days: newChannels90d,
            saturation_velocity: `${saturationVelocity} novos canais/mês`,
            saturating: saturationVelocity > 15,
            warning: saturationVelocity > 15 ? `⚠️ NICHO SATURANDO` : null,
          },
          channels: (nicheChannels.data || []).map((c: any) => ({
            name: c.channel_name, subs: c.subscribers, avgViews: c.avg_views,
            growth: c.growth_rate, rpm: c.rpm_estimate, faceless: c.is_faceless,
            country: c.country, uploadFreq: c.upload_frequency,
          })),
          viralTitles: (nicheVirals.data || []).map((v: any) => ({
            title: v.title, views: v.views, channel: v.channel_name,
            triggers: v.emotional_triggers, whyViral: v.why_viral,
          })),
          totalChannelsInNiche: (nicheChannels.data || []).length,
          avgRPM: nicheInfo?.rpm_estimate || (nicheChannels.data || []).reduce((s: number, c: any) => s + (c.rpm_estimate || 0), 0) / Math.max((nicheChannels.data || []).length, 1),
        };
        break;
      }

      case "analyze_channel":
        result = await callFn("analyze-channel", { channelInput: args.channel }); break;

      case "reverse_engineer_video": {
        const videoId = args.video_url.replace(/.*(?:v=|youtu\.be\/)/, '').replace(/[&?].*/, '');
        result = await callFn("reverse-engineer-video", { videoId }); break;
      }

      case "find_outliers":
        result = await callFn("find-outliers", { niche: args.niche, country: args.country || "BR", minMultiplier: args.min_multiplier || 5 }); break;

      case "generate_titles":
        result = await callFn("generate-titles", { topic: args.topic, niche: args.niche || "", language: args.language || "português", style: args.style || "mixed" }); break;

      case "search_viral_database": {
        let query = sb.from("viral_titles_db")
          .select("title, views, niche, country, language, emotional_triggers, title_pattern, why_viral, channel_name")
          .order("views", { ascending: false }).limit(25);
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.min_views) query = query.gte("views", args.min_views);
        if (args.query) query = query.or(`title.ilike.%${args.query}%,niche.ilike.%${args.query}%`);
        const { data } = await query;
        result = data || []; break;
      }

      case "channel_intelligence_search": {
        let query = sb.from("channel_intelligence")
          .select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency, youtube_channel_id")
          .order("avg_views", { ascending: false }).limit(25);
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.is_faceless !== undefined) query = query.eq("is_faceless", args.is_faceless);
        if (args.min_subscribers) query = query.gte("subscribers", args.min_subscribers);
        if (args.growth_rate) query = query.eq("growth_rate", args.growth_rate);
        const { data } = await query;
        result = data || []; break;
      }

      case "estimate_revenue":
        result = await callFn("estimate-revenue", { niche: args.niche, country: args.country, monthly_views: args.monthly_views || 100000, subscribers: args.subscribers || 10000 }); break;

      case "brave_search":
        result = await callFn("brave-search", { query: args.query, count: args.count || 10 }); break;

      case "suggest_video_ideas":
        result = await callFn("generate-ideas", { niche: args.niche, channelName: args.channelName || "", existingIdeas: args.existingIdeas || [], count: args.count || 10 }); break;

      case "suggest_themes":
        result = await callFn("suggest-themes", { niche: args.niche, style: args.style || "", language: args.language || "português", count: args.count || 10, topic: args.topic || "", narrativeStyle: args.narrativeStyle || "" }); break;

      case "seo_analyze":
        result = await callFn("seo-analyzer", { title: args.title, description: args.description || "", tags: args.tags || [], niche: args.niche || "" }); break;

      case "find_competitors":
        result = await callFn("find-competitors", { channelId: args.channelId || "", channelName: args.channelName || "", niche: args.niche }); break;

      case "extract_content_dna":
        result = await callFn("extract-content-dna", { videoId: args.videoId, videoTitle: args.videoTitle || "", niche: args.niche || "" }); break;

      case "detect_pre_viral":
        result = await callFn("pre-viral-detection", { niche: args.niche, country: args.country || "BR", language: args.language || "pt" }); break;

      case "analyze_topic_research":
        result = await callFn("analyze-topic", { topic: args.topic, niche: args.niche || "", language: args.language || "pt", style: args.style || "investigativo" }); break;

      case "search_emerging_channels":
        result = await callFn("detect-emerging-channels", { niche: args.niche, country: args.country || "BR" }); break;

      case "bulk_channel_scan":
        result = await callFn("bulk-channel-scan", { channelId: args.channelId || "", channelName: args.channelName || "" }); break;

      // ===== YOUTUBE DATA API DIRECT =====
      case "youtube_channel_stats": {
        const ytKeys = getYTKeys();
        let channelId = args.channelId;
        if (!channelId && args.handle) {
          const handle = args.handle.replace('@', '');
          for (const key of ytKeys) {
            try {
              let resp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${key}`);
              let data = await resp.json();
              if (data.items?.length > 0) { channelId = data.items[0].id; break; }
              resp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${encodeURIComponent(args.handle)}&maxResults=1&key=${key}`);
              data = await resp.json();
              if (data.items?.length > 0) { channelId = data.items[0].id?.channelId || data.items[0].snippet?.channelId; break; }
            } catch { continue; }
          }
        }
        if (!channelId) { result = { error: "Could not resolve channel" }; break; }
        for (const key of ytKeys) {
          try {
            const resp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${channelId}&key=${key}`);
            const data = await resp.json();
            if (data.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            if (data.items?.length > 0) {
              const ch = data.items[0];
              result = {
                channelId: ch.id, title: ch.snippet?.title,
                description: ch.snippet?.description?.slice(0, 500),
                country: ch.snippet?.country, publishedAt: ch.snippet?.publishedAt,
                subscribers: parseInt(ch.statistics?.subscriberCount || '0'),
                totalViews: parseInt(ch.statistics?.viewCount || '0'),
                videoCount: parseInt(ch.statistics?.videoCount || '0'),
                uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
                keywords: ch.brandingSettings?.channel?.keywords,
              };
              break;
            }
          } catch { continue; }
        }
        if (!result) result = { error: "YouTube API quota exceeded on all keys" };
        break;
      }

      case "youtube_video_stats": {
        const ytKeys = getYTKeys();
        let videoId = args.videoId;
        if (!videoId && args.videoUrl) videoId = args.videoUrl.replace(/.*(?:v=|youtu\.be\/)/, '').replace(/[&?].*/, '');
        if (!videoId) { result = { error: "No video ID" }; break; }
        for (const key of ytKeys) {
          try {
            const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${key}`);
            const data = await resp.json();
            if (data.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            if (data.items?.length > 0) {
              const v = data.items[0];
              result = {
                videoId: v.id, title: v.snippet?.title,
                description: v.snippet?.description?.slice(0, 500),
                channelId: v.snippet?.channelId, channelTitle: v.snippet?.channelTitle,
                publishedAt: v.snippet?.publishedAt, tags: v.snippet?.tags?.slice(0, 30),
                duration: v.contentDetails?.duration,
                views: parseInt(v.statistics?.viewCount || '0'),
                likes: parseInt(v.statistics?.likeCount || '0'),
                comments: parseInt(v.statistics?.commentCount || '0'),
                categoryId: v.snippet?.categoryId,
              };
              break;
            }
          } catch { continue; }
        }
        if (!result) result = { error: "YouTube API quota exceeded" };
        break;
      }

      case "youtube_search_api": {
        const ytKeys = getYTKeys();
        const params = new URLSearchParams({
          part: "snippet", q: args.query,
          type: args.type || "video", maxResults: String(args.maxResults || 10),
          order: args.order || "relevance",
        });
        if (args.regionCode) params.set("regionCode", args.regionCode);
        if (args.relevanceLanguage) params.set("relevanceLanguage", args.relevanceLanguage);
        if (args.publishedAfter) params.set("publishedAfter", args.publishedAfter);
        for (const key of ytKeys) {
          try {
            params.set("key", key);
            const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
            const data = await resp.json();
            if (data.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            const videoIds = (data.items || []).filter((i: any) => i.id?.videoId).map((i: any) => i.id.videoId).join(',');
            let videoStats: Record<string, any> = {};
            if (videoIds) {
              const statsResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds}&key=${key}`);
              const statsData = await statsResp.json();
              for (const v of (statsData.items || [])) {
                videoStats[v.id] = {
                  views: parseInt(v.statistics?.viewCount || '0'),
                  likes: parseInt(v.statistics?.likeCount || '0'),
                  comments: parseInt(v.statistics?.commentCount || '0'),
                  duration: v.contentDetails?.duration,
                };
              }
            }
            result = (data.items || []).map((item: any) => ({
              type: args.type || "video",
              id: item.id?.videoId || item.id?.channelId || item.id?.playlistId,
              title: item.snippet?.title, channelTitle: item.snippet?.channelTitle,
              channelId: item.snippet?.channelId, publishedAt: item.snippet?.publishedAt,
              description: item.snippet?.description?.slice(0, 200),
              ...(videoStats[item.id?.videoId] || {}),
            }));
            break;
          } catch { continue; }
        }
        if (!result) result = { error: "YouTube API quota exceeded" };
        break;
      }

      case "youtube_channel_videos": {
        const ytKeys = getYTKeys();
        for (const key of ytKeys) {
          try {
            const chResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${args.channelId}&key=${key}`);
            const chData = await chResp.json();
            if (chData.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) { result = { error: "Channel not found" }; break; }
            const plResp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${args.maxResults || 20}&key=${key}`);
            const plData = await plResp.json();
            const videoIds = (plData.items || []).map((i: any) => i.snippet?.resourceId?.videoId).filter(Boolean).join(',');
            if (!videoIds) { result = []; break; }
            const vResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${key}`);
            const vData = await vResp.json();
            result = (vData.items || []).map((v: any) => ({
              videoId: v.id, title: v.snippet?.title, publishedAt: v.snippet?.publishedAt,
              duration: v.contentDetails?.duration, views: parseInt(v.statistics?.viewCount || '0'),
              likes: parseInt(v.statistics?.likeCount || '0'), comments: parseInt(v.statistics?.commentCount || '0'),
            }));
            if (args.order === 'viewCount') result.sort((a: any, b: any) => b.views - a.views);
            break;
          } catch { continue; }
        }
        if (!result) result = { error: "YouTube API quota exceeded" };
        break;
      }

      case "expert_analysis":
      case "claude_deep_analysis":
      case "gpt_expert_analysis": {
        const styles: Record<string, string> = {
          strategic: "Você é um consultor estratégico de YouTube com 15 anos de experiência.",
          creative: "Você é um diretor criativo premiado.",
          analytical: "Você é um analista de dados do YouTube.",
          diagnostic: "Você é um diagnosticador de canais do YouTube.",
          "data-driven": "You are a YouTube data scientist.",
          "growth-hacking": "You are a YouTube growth hacker.",
          "monetization": "You are a YouTube monetization expert.",
          "trend-analysis": "You are a trend analyst.",
        };
        try {
          const resp = await _ai({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: (styles[args.style || 'strategic'] || styles.strategic) + "\n\nResponda SEMPRE em português brasileiro." },
              { role: "user", content: `${args.task}\n\n${args.context ? `CONTEXTO:\n${args.context}` : ''}` },
            ],
          });
          const data = await resp.json();
          result = { analysis: data.choices?.[0]?.message?.content || "No response", model: "gemini-2.5-flash" };
        } catch (e: any) { result = { error: `Analysis error: ${e.message}` }; }
        break;
      }

      case "perplexity_research":
        result = await callFn("perplexity-research", {
          singleQuery: { query: args.query, searchRecency: args.searchRecency, storeInKnowledge: args.storeInKnowledge || false, storageCategory: args.storageCategory || "perplexity_research", storageTitle: args.storageTitle || args.query.slice(0, 100) },
        }); break;

      case "analyze_thumbnail_ctr": {
        try {
          const resp = await _ai({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a YouTube thumbnail CTR expert. Analyze and provide scores and improvements. Respond in Portuguese brasileiro." },
              { role: "user", content: `Analyze thumbnail CTR potential.\nImage URL: ${args.image_url}\nTitle: ${args.video_title || 'Unknown'}\nNiche: ${args.niche || 'general'}` },
            ],
          });
          const data = await resp.json();
          result = { analysis: data.choices?.[0]?.message?.content || "No analysis", model: "gemini-2.5-flash" };
        } catch (e: any) { result = { error: e.message }; }
        break;
      }

      case "generate_thumbnail_prompt":
        result = await callFn("generate-thumbnail-prompt", { video_title: args.video_title, niche: args.niche, emotion: args.emotion || "curiosity", style: args.style || "auto", count: 3 }); break;

      case "link_script_to_real_video":
        result = await callFn("link-script-to-video", { script_id: args.script_id || null, youtube_url: args.youtube_url }); break;

      case "monetization_diagnosis": {
        const [algoK, monetK, chData] = await Promise.all([
          sb.from("youtube_algorithm_knowledge").select("title, content, data_json, category").in("category", ["ypp_requirements", "longform_algorithm", "shorts_algorithm"]).order("priority", { ascending: false }).limit(15),
          sb.from("monetization_knowledge_base").select("title, content, data_json, topic, country_code").limit(20),
          args.channel_id ? sb.from("user_channels").select("*").eq("id", args.channel_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        result = {
          algorithm_knowledge: (algoK.data || []).map((k: any) => ({ title: k.title, content: k.content, data: k.data_json })),
          monetization_data: (monetK.data || []).map((m: any) => ({ title: m.title, content: m.content, data: m.data_json, country: m.country_code })),
          channel: chData.data, niche: args.niche, target_revenue: args.target_revenue_usd,
        };
        break;
      }

      case "algorithm_current_status": {
        const [intK, pxResult] = await Promise.all([
          sb.from("youtube_algorithm_knowledge").select("title, content, data_json, category, confidence_score")
            .eq("applies_to_format", args.format === "shorts" ? "shorts" : args.format === "longform" ? "longform" : "both")
            .order("priority", { ascending: false }).limit(10),
          callFn("perplexity-research", {
            singleQuery: { query: `YouTube algorithm best practices 2025-2026 for ${args.niche} ${args.format || "both"} videos. What's working right now?`, searchRecency: "month" },
          }),
        ]);
        result = {
          internal_knowledge: (intK.data || []).map((k: any) => ({ title: k.title, content: k.content, data: k.data_json, confidence: k.confidence_score })),
          live_research: pxResult, niche: args.niche, format: args.format,
        };
        break;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    // Retry for transient errors
    const resultStr = JSON.stringify(result);
    const errorText = typeof result?.error === 'string' ? result.error : '';
    const isTransient = errorText.includes('Timeout') || errorText.includes('Network') || errorText.includes('context canceled');
    const isTimeout = errorText.includes('Timeout');
    const shouldRetry = attempt === 1 && isTransient && !(isTimeout && NON_RETRYABLE_TIMEOUT_TOOLS.has(toolName));

    if (shouldRetry) {
      console.log(`Tool ${toolName} transient failure, retrying...`);
      await new Promise(r => setTimeout(r, 1000));
      return executeTool(toolName, args, sb, supabaseUrl, serviceKey, 2);
    }

    return resultStr.slice(0, 10000);
  } catch (e: any) {
    console.error(`Tool ${toolName} error (attempt ${attempt}):`, e);
    if (attempt === 1) {
      await new Promise(r => setTimeout(r, 1000));
      return executeTool(toolName, args, sb, supabaseUrl, serviceKey, 2);
    }
    return JSON.stringify({ error: e.message, tool: toolName });
  }
}
