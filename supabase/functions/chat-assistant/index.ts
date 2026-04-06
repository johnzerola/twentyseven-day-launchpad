import { callGeminiOpenAICompat, generateEmbedding } from "../_shared/gemini-direct.ts";
import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== TOOL DEFINITIONS (19 TOOLS) =====
const DOTTI_TOOLS = [
  {
    type: "function",
    function: {
      name: "dubspy_search",
      description: "Search YouTube videos and channels in ANY country/language. ALWAYS use when user asks to find channels, videos, trends, opportunities, or needs competitive research. Supports modes: videos, channels, emerging, escapees, micro_niche.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query — use LOCAL LANGUAGE for best results (e.g. 'prawdziwe zbrodnie' for Polish true crime)" },
          country: { type: "string", description: "Country code (BR, US, PL, TR, SE, NO, DE, etc.)" },
          language: { type: "string", description: "Language code (pt, en, pl, tr, sv, no, de, etc.)" },
          mode: { type: "string", enum: ["videos", "channels", "emerging", "escapees", "micro_niche"], description: "videos=trending, channels=top channels, emerging=pre-viral, escapees=fast-growing, micro_niche=sub-niches" },
          min_views: { type: "number", description: "Minimum views filter" },
          max_subs: { type: "number", description: "Maximum subscribers filter" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_niche",
      description: "Deep analysis of a niche: RPM, saturation, difficulty, top channels, opportunity score, sub-niches. ALWAYS use when user asks about niche viability.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche to analyze" },
          country: { type: "string", description: "Country code" },
          language: { type: "string", description: "Language code" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_channel",
      description: "Full SWOT analysis of a YouTube channel: subscribers, views, upload frequency, top videos, viral patterns, growth trajectory. ALWAYS use when user mentions ANY channel.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", description: "YouTube channel URL, @handle, or channel name" },
        },
        required: ["channel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reverse_engineer_video",
      description: "Reverse-engineer a YouTube video: hook, pacing, retention curve, psychological triggers, why it went viral.",
      parameters: {
        type: "object",
        properties: {
          video_url: { type: "string", description: "YouTube video URL or ID" },
        },
        required: ["video_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_outliers",
      description: "Find OUTLIER videos: small channels with viral videos (10x+ average). Best for finding replicable opportunities.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche (use local language terms)" },
          country: { type: "string", description: "Country code" },
          min_multiplier: { type: "number", description: "Min views/subs multiplier (default 5)" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_titles",
      description: "Generate 10+ viral title suggestions with CTR estimates and SEO scores.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Video topic" },
          niche: { type: "string", description: "Niche" },
          language: { type: "string", description: "Language for titles" },
          style: { type: "string", description: "curiosity, listicle, challenge, shock, question, etc." },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_viral_database",
      description: "Search 900+ REAL viral titles with views, patterns, emotional triggers. Best for pattern discovery.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          niche: { type: "string", description: "Filter by niche" },
          country: { type: "string", description: "Filter by country" },
          min_views: { type: "number", description: "Minimum views" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "channel_intelligence_search",
      description: "Search 650+ analyzed channels by niche, country, faceless, growth rate.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche filter" },
          country: { type: "string", description: "Country code" },
          is_faceless: { type: "boolean", description: "Faceless only" },
          min_subscribers: { type: "number", description: "Min subscribers" },
          growth_rate: { type: "string", description: "fast, steady, explosive" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_revenue",
      description: "Estimate monthly revenue for a niche/country combination with RPM projections.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
          country: { type: "string", description: "Country code" },
          monthly_views: { type: "number", description: "Estimated monthly views" },
          subscribers: { type: "number", description: "Subscribers" },
        },
        required: ["niche", "country"],
      },
    },
  },
  // ===== NEW TOOLS =====
  {
    type: "function",
    function: {
      name: "brave_search",
      description: "Search the web using Brave Search for current trends, news, strategies, and real-world data. Use for trending topics, competitor research, recent events, marketing strategies, or any real-time web information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (supports any language)" },
          count: { type: "number", description: "Number of results (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_video_ideas",
      description: "Generate ranked video ideas with viral scores, curiosity scores, and competition analysis. Uses intelligence from viral database and channel patterns.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche for ideas" },
          channelName: { type: "string", description: "Channel name for personalization" },
          existingIdeas: { type: "array", items: { type: "string" }, description: "Ideas to NOT repeat" },
          count: { type: "number", description: "Number of top ideas to return (default 10)" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_themes",
      description: "Generate video theme suggestions with viral potential, hooks, and style recommendations. Great for content calendar planning.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
          style: { type: "string", description: "Video style (documentário, listicle, horror, etc.)" },
          language: { type: "string", description: "Language" },
          count: { type: "number", description: "Number of themes (default 10)" },
          topic: { type: "string", description: "Specific topic to expand on" },
          narrativeStyle: { type: "string", description: "Narrative style preference" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "seo_analyze",
      description: "Analyze SEO of a YouTube video title/description. Returns A-F grade with 11 weighted factors: keyword density, emotional triggers, length optimization, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Video title to analyze" },
          description: { type: "string", description: "Video description" },
          tags: { type: "array", items: { type: "string" }, description: "Video tags" },
          niche: { type: "string", description: "Niche for comparison" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_competitors",
      description: "Find competitor channels for a given channel or niche. Returns similar channels with metrics for competitive analysis.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID to find competitors for" },
          channelName: { type: "string", description: "Channel name (alternative to ID)" },
          niche: { type: "string", description: "Niche to search competitors in" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_content_dna",
      description: "Extract the Content DNA of a viral video: hook type, pacing, emotional arc, storytelling structure, thumbnail pattern, and replication template.",
      parameters: {
        type: "object",
        properties: {
          videoId: { type: "string", description: "YouTube video ID" },
          videoTitle: { type: "string", description: "Video title (if known)" },
          niche: { type: "string", description: "Niche" },
        },
        required: ["videoId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_pre_viral",
      description: "Detect pre-viral videos that are gaining momentum. Finds videos in early growth phase before they explode. Best for catching trends early.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche to monitor" },
          country: { type: "string", description: "Country code" },
          language: { type: "string", description: "Language code" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_topic_research",
      description: "Deep research on a topic using Brave Search + AI analysis. Returns structured research with facts, stats, angles, and content opportunities.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topic to research" },
          niche: { type: "string", description: "Niche context" },
          language: { type: "string", description: "Language" },
          style: { type: "string", description: "Content style (documentário, investigativo, etc.)" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emerging_channels",
      description: "Find emerging/new channels that are growing fast in a niche. Returns channels with growth metrics and viral potential.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
          country: { type: "string", description: "Country code" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_channel_scan",
      description: "Deep scan of a YouTube channel: all videos, performance metrics, outlier detection, upload patterns. More detailed than analyze_channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID" },
          channelName: { type: "string", description: "Channel name (alternative)" },
        },
        required: [],
      },
    },
  },
  // ===== YOUTUBE DATA API DIRECT =====
  {
    type: "function",
    function: {
      name: "youtube_channel_stats",
      description: "Get REAL YouTube channel statistics directly from YouTube Data API: subscribers, views, videos, creation date, description, country. Use for accurate current metrics of any channel.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID (UCxxxx)" },
          handle: { type: "string", description: "YouTube @handle or channel name (will be resolved)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_video_stats",
      description: "Get REAL video statistics from YouTube Data API: views, likes, comments, duration, publish date, tags, description. Use for accurate data on specific videos.",
      parameters: {
        type: "object",
        properties: {
          videoId: { type: "string", description: "YouTube video ID" },
          videoUrl: { type: "string", description: "YouTube video URL (will extract ID)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_search_api",
      description: "Search YouTube directly via Data API: find videos, channels, playlists by query with real metrics. Best for finding CURRENT content in any country/language.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: { type: "string", enum: ["video", "channel", "playlist"], description: "Result type (default: video)" },
          regionCode: { type: "string", description: "Country code (BR, US, PL, etc.)" },
          relevanceLanguage: { type: "string", description: "Language code (pt, en, pl, etc.)" },
          order: { type: "string", enum: ["relevance", "date", "viewCount", "rating"], description: "Sort order" },
          maxResults: { type: "number", description: "Max results (default 10, max 50)" },
          publishedAfter: { type: "string", description: "ISO date — only videos after this date" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_channel_videos",
      description: "Get recent videos from a YouTube channel with stats. Best for analyzing upload patterns, content strategy, and finding top performers.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID" },
          maxResults: { type: "number", description: "Max videos to return (default 20)" },
          order: { type: "string", enum: ["date", "viewCount"], description: "Sort by date or views" },
        },
        required: ["channelId"],
      },
    },
  },
  // ===== AI ANALYSIS TOOLS =====
  {
    type: "function",
    function: {
      name: "claude_deep_analysis",
      description: "Use Claude AI for deep strategic analysis, creative writing, nuanced content strategy, or when you need a second expert opinion. Best for complex strategy, competitive analysis, and creative ideation.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "What to analyze or create" },
          context: { type: "string", description: "Relevant context, data, or channel info" },
          style: { type: "string", enum: ["strategic", "creative", "analytical", "diagnostic"], description: "Analysis style" },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gpt_expert_analysis",
      description: "Use GPT-5 for expert-level analysis, data interpretation, trend forecasting, or monetization strategy. Best for number crunching, market analysis, and growth projections.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "What to analyze" },
          context: { type: "string", description: "Data and context" },
          style: { type: "string", enum: ["data-driven", "growth-hacking", "monetization", "trend-analysis"], description: "Analysis focus" },
        },
        required: ["task"],
      },
    },
  },
  // ===== PERPLEXITY RESEARCH =====
  {
    type: "function",
    function: {
      name: "perplexity_research",
      description: "Deep web research using Perplexity AI (sonar-pro). Returns real-time, cited, grounded answers from the entire internet. BEST FOR: current trends, strategies, news, competitor research, market data, algorithm updates, monetization tips. Results include citations from real sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Research question — be specific and detailed for best results" },
          searchRecency: { type: "string", enum: ["day", "week", "month", "year"], description: "Filter results by recency (default: no filter)" },
          storeInKnowledge: { type: "boolean", description: "Store result in knowledge base for future use (default false)" },
          storageCategory: { type: "string", description: "Category for storage (if storing)" },
          storageTitle: { type: "string", description: "Title for storage (if storing)" },
        },
        required: ["query"],
      },
    },
  },
  // ===== NEW V5 TOOLS =====
  {
    type: "function",
    function: {
      name: "analyze_thumbnail_ctr",
      description: "Analyze a YouTube thumbnail for CTR potential. Upload image URL and get: composition score, emotional impact, color analysis, text readability, CTR prediction, and improvement suggestions.",
      parameters: {
        type: "object",
        properties: {
          image_url: { type: "string", description: "URL of the thumbnail image" },
          video_title: { type: "string", description: "Associated video title" },
          niche: { type: "string", description: "Channel niche" },
        },
        required: ["image_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_thumbnail_prompt",
      description: "Generate Midjourney/DALL-E prompts for a high-CTR YouTube thumbnail based on title and niche. Returns 3 variants ordered by expected CTR.",
      parameters: {
        type: "object",
        properties: {
          video_title: { type: "string", description: "Video title" },
          niche: { type: "string", description: "Channel niche" },
          emotion: { type: "string", description: "Target emotion: shock, curiosity, fear, excitement, wonder" },
          style: { type: "string", description: "shock, curiosity, emotion, contrast, minimal" },
        },
        required: ["video_title", "niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_script_to_real_video",
      description: "Link a generated script to its published YouTube video to track real performance and learn from results. ALWAYS use when user says they published a video.",
      parameters: {
        type: "object",
        properties: {
          script_id: { type: "string", description: "ID of the saved script" },
          youtube_url: { type: "string", description: "YouTube video URL" },
        },
        required: ["youtube_url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "monetization_diagnosis",
      description: "ALWAYS USE when user asks about monetization, YPP, revenue, how long to monetize. Queries algorithm knowledge base and monetization data for accurate projections.",
      parameters: {
        type: "object",
        properties: {
          channel_id: { type: "string", description: "User channel ID" },
          target_revenue_usd: { type: "number", description: "Monthly revenue target in USD" },
          country: { type: "string", description: "Target country code" },
          niche: { type: "string", description: "Channel niche" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "algorithm_current_status",
      description: "Get current YouTube algorithm best practices and what's working RIGHT NOW in a specific niche. Uses Perplexity for real-time data + internal knowledge base.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche to research" },
          format: { type: "string", enum: ["shorts", "longform", "both"], description: "Video format" },
        },
        required: ["niche"],
      },
    },
  },
];

// ===== TOOL EXECUTION WITH RETRY + TIMEOUT =====
const DEFAULT_TOOL_TIMEOUT_MS = 15000;
const TOOL_TIMEOUTS_MS: Record<string, number> = {
  "analyze-channel": 12000,
  "youtube_channel_stats": 10000,
  "youtube_channel_videos": 10000,
  "youtube_video_stats": 10000,
  "youtube_search_api": 10000,
  "perplexity-research": 20000,
  "claude_deep_analysis": 20000,
  "gpt_expert_analysis": 15000,
};

const NON_RETRYABLE_TIMEOUT_TOOLS = new Set([
  "analyze_channel",
  "analyze_niche",
  "youtube_channel_stats",
  "youtube_channel_videos",
  "youtube_video_stats",
  "youtube_search_api",
]);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)),
  ]);
}

function getToolTimeoutMs(fnName: string, toolName: string): number {
  return TOOL_TIMEOUTS_MS[toolName] || TOOL_TIMEOUTS_MS[fnName] || DEFAULT_TOOL_TIMEOUT_MS;
}

async function executeTool(
  toolName: string,
  args: any,
  sb: any,
  supabaseUrl: string,
  serviceKey: string,
  attempt = 1
): Promise<string> {
  const callFn = async (fnName: string, payload: any) => {
    try {
      const timeoutMs = getToolTimeoutMs(fnName, toolName);
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

  try {
    let result: any;

    switch (toolName) {
      case "dubspy_search": {
        const modeMap: Record<string, string> = {
          videos: "emerging",
          channels: "cluster",
          emerging: "emerging",
          escapees: "escapees",
          micro_niche: "micro-niche-drill",
          "micro-niche-drill": "micro-niche-drill",
          cluster: "cluster",
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
        // Fast path: use internal DB instead of heavy niche-explorer edge function
        const nicheQuery = (args.niche || args.query || '').toLowerCase();
        const nicheCountry = args.country || 'BR';
        
        const [nicheDbResult, nicheChannels, nicheVirals] = await Promise.all([
          sb.from("niche_database").select("*").or(`name.ilike.%${nicheQuery}%,sub_niches.cs.{${nicheQuery}}`).limit(10),
          sb.from("channel_intelligence")
            .select("channel_name, subscribers, avg_views, growth_rate, rpm_estimate, style, is_faceless, country, upload_frequency")
            .ilike("niche", `%${nicheQuery}%`)
            .order("avg_views", { ascending: false })
            .limit(15),
          sb.from("viral_titles_db")
            .select("title, views, channel_name, emotional_triggers, why_viral")
            .ilike("niche", `%${nicheQuery}%`)
            .order("views", { ascending: false })
            .limit(10),
        ]);
        
        const nicheInfo = nicheDbResult.data?.[0];
        result = {
          niche: args.niche,
          country: nicheCountry,
          database: nicheInfo ? {
            rpm: nicheInfo.rpm_estimate,
            difficulty: nicheInfo.difficulty,
            saturation: nicheInfo.saturation,
            faceless_friendly: nicheInfo.faceless_friendly,
            sub_niches: nicheInfo.sub_niches,
          } : { note: "Niche not in database — using channel data" },
          channels: (nicheChannels.data || []).map((c: any) => ({
            name: c.channel_name,
            subs: c.subscribers,
            avgViews: c.avg_views,
            growth: c.growth_rate,
            rpm: c.rpm_estimate,
            faceless: c.is_faceless,
            country: c.country,
            uploadFreq: c.upload_frequency,
          })),
          viralTitles: (nicheVirals.data || []).map((v: any) => ({
            title: v.title,
            views: v.views,
            channel: v.channel_name,
            triggers: v.emotional_triggers,
            whyViral: v.why_viral,
          })),
          totalChannelsInNiche: (nicheChannels.data || []).length,
          avgRPM: nicheInfo?.rpm_estimate || (nicheChannels.data || []).reduce((s: number, c: any) => s + (c.rpm_estimate || 0), 0) / Math.max((nicheChannels.data || []).length, 1),
        };
        break;
      }

      case "analyze_channel": {
        result = await callFn("analyze-channel", {
          channelInput: args.channel,
        });
        break;
      }

      case "reverse_engineer_video": {
        const videoId = args.video_url.replace(/.*(?:v=|youtu\.be\/)/, '').replace(/[&?].*/, '');
        result = await callFn("reverse-engineer-video", { videoId });
        break;
      }

      case "find_outliers": {
        result = await callFn("find-outliers", {
          niche: args.niche,
          country: args.country || "BR",
          minMultiplier: args.min_multiplier || 5,
        });
        break;
      }

      case "generate_titles": {
        result = await callFn("generate-titles", {
          topic: args.topic,
          niche: args.niche || "",
          language: args.language || "português",
          style: args.style || "mixed",
        });
        break;
      }

      case "search_viral_database": {
        let query = sb.from("viral_titles_db")
          .select("title, views, niche, country, language, emotional_triggers, title_pattern, why_viral, channel_name")
          .order("views", { ascending: false })
          .limit(25);
        
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.min_views) query = query.gte("views", args.min_views);
        if (args.query) query = query.or(`title.ilike.%${args.query}%,niche.ilike.%${args.query}%`);
        
        const { data } = await query;
        result = data || [];
        break;
      }

      case "channel_intelligence_search": {
        let query = sb.from("channel_intelligence")
          .select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency, youtube_channel_id")
          .order("avg_views", { ascending: false })
          .limit(25);
        
        if (args.niche) query = query.ilike("niche", `%${args.niche}%`);
        if (args.country) query = query.eq("country", args.country);
        if (args.is_faceless !== undefined) query = query.eq("is_faceless", args.is_faceless);
        if (args.min_subscribers) query = query.gte("subscribers", args.min_subscribers);
        if (args.growth_rate) query = query.eq("growth_rate", args.growth_rate);
        
        const { data } = await query;
        result = data || [];
        break;
      }

      case "estimate_revenue": {
        result = await callFn("estimate-revenue", {
          niche: args.niche,
          country: args.country,
          monthly_views: args.monthly_views || 100000,
          subscribers: args.subscribers || 10000,
        });
        break;
      }

      // ===== NEW TOOLS =====
      case "brave_search": {
        result = await callFn("brave-search", {
          query: args.query,
          count: args.count || 10,
        });
        break;
      }

      case "suggest_video_ideas": {
        result = await callFn("generate-ideas", {
          niche: args.niche,
          channelName: args.channelName || "",
          existingIdeas: args.existingIdeas || [],
          count: args.count || 10,
        });
        break;
      }

      case "suggest_themes": {
        result = await callFn("suggest-themes", {
          niche: args.niche,
          style: args.style || "",
          language: args.language || "português",
          count: args.count || 10,
          topic: args.topic || "",
          narrativeStyle: args.narrativeStyle || "",
        });
        break;
      }

      case "seo_analyze": {
        result = await callFn("seo-analyzer", {
          title: args.title,
          description: args.description || "",
          tags: args.tags || [],
          niche: args.niche || "",
        });
        break;
      }

      case "find_competitors": {
        result = await callFn("find-competitors", {
          channelId: args.channelId || "",
          channelName: args.channelName || "",
          niche: args.niche,
        });
        break;
      }

      case "extract_content_dna": {
        result = await callFn("extract-content-dna", {
          videoId: args.videoId,
          videoTitle: args.videoTitle || "",
          niche: args.niche || "",
        });
        break;
      }

      case "detect_pre_viral": {
        result = await callFn("pre-viral-detection", {
          niche: args.niche,
          country: args.country || "BR",
          language: args.language || "pt",
        });
        break;
      }

      case "analyze_topic_research": {
        result = await callFn("analyze-topic", {
          topic: args.topic,
          niche: args.niche || "",
          language: args.language || "pt",
          style: args.style || "investigativo",
        });
        break;
      }

      case "search_emerging_channels": {
        result = await callFn("detect-emerging-channels", {
          niche: args.niche,
          country: args.country || "BR",
        });
        break;
      }

      case "bulk_channel_scan": {
        result = await callFn("bulk-channel-scan", {
          channelId: args.channelId || "",
          channelName: args.channelName || "",
        });
        break;
      }

      // ===== YOUTUBE DATA API DIRECT =====
      case "youtube_channel_stats": {
        const ytKeys = [
          Deno.env.get("YOUTUBE_API_KEY"),
          Deno.env.get("YOUTUBE_API_KEY_2"),
          Deno.env.get("YOUTUBE_API_KEY_3"),
          Deno.env.get("YOUTUBE_API_KEY_4"),
        ].filter(Boolean);
        
        let channelId = args.channelId;
        
        // Resolve handle to channel ID if needed
        if (!channelId && args.handle) {
          const handle = args.handle.replace('@', '');
          for (const key of ytKeys) {
            try {
              // Try forHandle first
              let searchUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${key}`;
              let resp = await fetch(searchUrl);
              let data = await resp.json();
              if (data.items?.length > 0) { channelId = data.items[0].id; break; }
              
              // Fallback: search
              searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id&type=channel&q=${encodeURIComponent(args.handle)}&maxResults=1&key=${key}`;
              resp = await fetch(searchUrl);
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
                channelId: ch.id,
                title: ch.snippet?.title,
                description: ch.snippet?.description?.slice(0, 500),
                country: ch.snippet?.country,
                publishedAt: ch.snippet?.publishedAt,
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
        const ytKeys2 = [
          Deno.env.get("YOUTUBE_API_KEY"),
          Deno.env.get("YOUTUBE_API_KEY_2"),
          Deno.env.get("YOUTUBE_API_KEY_3"),
          Deno.env.get("YOUTUBE_API_KEY_4"),
        ].filter(Boolean);
        
        let videoId = args.videoId;
        if (!videoId && args.videoUrl) {
          videoId = args.videoUrl.replace(/.*(?:v=|youtu\.be\/)/, '').replace(/[&?].*/, '');
        }
        if (!videoId) { result = { error: "No video ID" }; break; }
        
        for (const key of ytKeys2) {
          try {
            const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${key}`);
            const data = await resp.json();
            if (data.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            if (data.items?.length > 0) {
              const v = data.items[0];
              result = {
                videoId: v.id,
                title: v.snippet?.title,
                description: v.snippet?.description?.slice(0, 500),
                channelId: v.snippet?.channelId,
                channelTitle: v.snippet?.channelTitle,
                publishedAt: v.snippet?.publishedAt,
                tags: v.snippet?.tags?.slice(0, 30),
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
        const ytKeys3 = [
          Deno.env.get("YOUTUBE_API_KEY"),
          Deno.env.get("YOUTUBE_API_KEY_2"),
          Deno.env.get("YOUTUBE_API_KEY_3"),
          Deno.env.get("YOUTUBE_API_KEY_4"),
        ].filter(Boolean);
        
        const params = new URLSearchParams({
          part: "snippet",
          q: args.query,
          type: args.type || "video",
          maxResults: String(args.maxResults || 10),
          order: args.order || "relevance",
        });
        if (args.regionCode) params.set("regionCode", args.regionCode);
        if (args.relevanceLanguage) params.set("relevanceLanguage", args.relevanceLanguage);
        if (args.publishedAfter) params.set("publishedAfter", args.publishedAfter);
        
        for (const key of ytKeys3) {
          try {
            params.set("key", key as string);
            const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
            const data = await resp.json();
            if (data.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            
            // Get video stats for video results
            const videoIds = (data.items || [])
              .filter((i: any) => i.id?.videoId)
              .map((i: any) => i.id.videoId)
              .join(',');
            
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
              title: item.snippet?.title,
              channelTitle: item.snippet?.channelTitle,
              channelId: item.snippet?.channelId,
              publishedAt: item.snippet?.publishedAt,
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
        const ytKeys4 = [
          Deno.env.get("YOUTUBE_API_KEY"),
          Deno.env.get("YOUTUBE_API_KEY_2"),
          Deno.env.get("YOUTUBE_API_KEY_3"),
          Deno.env.get("YOUTUBE_API_KEY_4"),
        ].filter(Boolean);
        
        for (const key of ytKeys4) {
          try {
            // Get uploads playlist
            const chResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${args.channelId}&key=${key}`);
            const chData = await chResp.json();
            if (chData.error?.errors?.[0]?.reason === 'quotaExceeded') continue;
            const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) { result = { error: "Channel not found" }; break; }
            
            // Get videos from playlist
            const plResp = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${args.maxResults || 20}&key=${key}`);
            const plData = await plResp.json();
            
            const videoIds = (plData.items || []).map((i: any) => i.snippet?.resourceId?.videoId).filter(Boolean).join(',');
            if (!videoIds) { result = []; break; }
            
            const vResp = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${key}`);
            const vData = await vResp.json();
            
            result = (vData.items || []).map((v: any) => ({
              videoId: v.id,
              title: v.snippet?.title,
              publishedAt: v.snippet?.publishedAt,
              duration: v.contentDetails?.duration,
              views: parseInt(v.statistics?.viewCount || '0'),
              likes: parseInt(v.statistics?.likeCount || '0'),
              comments: parseInt(v.statistics?.commentCount || '0'),
            }));
            
            // Sort by views if requested
            if (args.order === 'viewCount') {
              result.sort((a: any, b: any) => b.views - a.views);
            }
            break;
          } catch { continue; }
        }
        if (!result) result = { error: "YouTube API quota exceeded" };
        break;
      }

      // ===== AI ANALYSIS TOOLS =====
      case "claude_deep_analysis": {
        const claudeKey = Deno.env.get("CLAUDE_API_KEY");
        if (!claudeKey) { result = { error: "Claude API key not configured" }; break; }
        
        const stylePrompts: Record<string, string> = {
          strategic: "Você é um consultor estratégico de YouTube com 15 anos de experiência. Analise com profundidade estratégica, considerando mercado, competição e oportunidades.",
          creative: "Você é um diretor criativo premiado. Foque em ideias originais, ângulos únicos, narrativas memoráveis e diferenciação criativa.",
          analytical: "Você é um analista de dados do YouTube. Interprete métricas, identifique padrões, calcule projeções e encontre insights ocultos nos dados.",
          diagnostic: "Você é um diagnosticador de canais do YouTube. Identifique problemas específicos, causas-raiz e prescreva soluções com prioridade e timeline.",
        };
        
        try {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": claudeKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4000,
              system: stylePrompts[args.style || 'strategic'] + "\n\nResponda SEMPRE em português brasileiro. Seja direto, use dados concretos, sem rodeios.",
              messages: [{
                role: "user",
                content: `${args.task}\n\n${args.context ? `CONTEXTO:\n${args.context}` : ''}`,
              }],
            }),
          });
          const data = await resp.json();
          result = { analysis: data.content?.[0]?.text || data.error?.message || "No response", model: "claude-sonnet-4" };
        } catch (e: any) {
          result = { error: `Claude error: ${e.message}` };
        }
        break;
      }

      case "gpt_expert_analysis": {
        if (!lovableKey) { result = { error: "GOOGLE_AI_API_KEY not configured" }; break; }
        
        const gptStyles: Record<string, string> = {
          "data-driven": "You are a YouTube data scientist. Analyze with precision, find correlations, calculate growth curves, and predict outcomes based on historical patterns.",
          "growth-hacking": "You are a YouTube growth hacker. Focus on unconventional strategies, algorithm exploitation, viral mechanics, and rapid scaling techniques.",
          "monetization": "You are a YouTube monetization expert. Analyze RPM optimization, revenue diversification, sponsorship potential, and financial projections.",
          "trend-analysis": "You are a trend analyst. Identify emerging patterns, predict what will go viral next, and find early-mover advantages.",
        };
        
        try {
          const resp = await _ai({
              model: "openai/gpt-5",
              messages: [
                { role: "system", content: gptStyles[args.style || 'data-driven'] + "\n\nResponda SEMPRE em português brasileiro. Seja direto e específico." },
                { role: "user", content: `${args.task}\n\n${args.context ? `CONTEXTO:\n${args.context}` : ''}` },
              ],
            });
          const data = await resp.json();
          result = { analysis: data.choices?.[0]?.message?.content || "No response", model: "gpt-5" };
        } catch (e: any) {
          result = { error: `GPT error: ${e.message}` };
        }
        break;
      }

      case "perplexity_research": {
        result = await callFn("perplexity-research", {
          singleQuery: {
            query: args.query,
            searchRecency: args.searchRecency,
            storeInKnowledge: args.storeInKnowledge || false,
            storageCategory: args.storageCategory || "perplexity_research",
            storageTitle: args.storageTitle || args.query.slice(0, 100),
          },
        });
        break;
      }

      // ===== NEW V5 TOOLS =====
      case "analyze_thumbnail_ctr": {
        // Use AI to analyze thumbnail from URL
        if (!lovKey) { result = { error: "API key not configured" }; break; }
        try {
          const resp = await _ai({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are a YouTube thumbnail CTR expert. Analyze the thumbnail and provide: composition score (1-10), emotional impact (1-10), color analysis, text readability, estimated CTR potential, and 3 specific improvements. Respond in Portuguese brasileiro." },
                { role: "user", content: `Analyze this YouTube thumbnail for CTR potential.\nImage URL: ${args.image_url}\nVideo title: ${args.video_title || 'Unknown'}\nNiche: ${args.niche || 'general'}\n\nProvide detailed analysis with scores and actionable improvements.` },
              ],
            });
          const data = await resp.json();
          result = { analysis: data.choices?.[0]?.message?.content || "No analysis", model: "gemini-2.5-flash" };
        } catch (e: any) { result = { error: e.message }; }
        break;
      }

      case "generate_thumbnail_prompt": {
        result = await callFn("generate-thumbnail-prompt", {
          video_title: args.video_title,
          niche: args.niche,
          emotion: args.emotion || "curiosity",
          style: args.style || "auto",
          count: 3,
        });
        break;
      }

      case "link_script_to_real_video": {
        result = await callFn("link-script-to-video", {
          script_id: args.script_id || null,
          youtube_url: args.youtube_url,
        });
        break;
      }

      case "monetization_diagnosis": {
        // Query internal knowledge bases
        const [algoKnowledge, monetKnowledge, channelData] = await Promise.all([
          sb.from("youtube_algorithm_knowledge")
            .select("title, content, data_json, category")
            .in("category", ["ypp_requirements", "longform_algorithm", "shorts_algorithm"])
            .order("priority", { ascending: false })
            .limit(15),
          sb.from("monetization_knowledge_base")
            .select("title, content, data_json, topic, country_code")
            .limit(20),
          args.channel_id ? sb.from("user_channels").select("*").eq("id", args.channel_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        result = {
          algorithm_knowledge: (algoKnowledge.data || []).map((k: any) => ({ title: k.title, content: k.content, data: k.data_json })),
          monetization_data: (monetKnowledge.data || []).map((m: any) => ({ title: m.title, content: m.content, data: m.data_json, country: m.country_code })),
          channel: channelData.data,
          niche: args.niche,
          target_revenue: args.target_revenue_usd,
        };
        break;
      }

      case "algorithm_current_status": {
        // Combine internal knowledge + Perplexity research
        const [internalKnowledge, perplexityResult] = await Promise.all([
          sb.from("youtube_algorithm_knowledge")
            .select("title, content, data_json, category, confidence_score")
            .eq("applies_to_format", args.format === "shorts" ? "shorts" : args.format === "longform" ? "longform" : "both")
            .order("priority", { ascending: false })
            .limit(10),
          callFn("perplexity-research", {
            singleQuery: {
              query: `YouTube algorithm best practices 2025-2026 for ${args.niche} ${args.format || "both"} videos. What's working right now? Recent changes?`,
              searchRecency: "month",
            },
          }),
        ]);

        result = {
          internal_knowledge: (internalKnowledge.data || []).map((k: any) => ({ title: k.title, content: k.content, data: k.data_json, confidence: k.confidence_score })),
          live_research: perplexityResult,
          niche: args.niche,
          format: args.format,
        };
        break;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    // Retry only for transient errors (but don't retry quota-prone/expensive timeout tools)
    const resultStr = JSON.stringify(result);
    const errorText = typeof result?.error === 'string' ? result.error : '';
    const isTransientError = errorText.includes('Timeout') || errorText.includes('Network') || errorText.includes('context canceled');
    const isTimeoutError = errorText.includes('Timeout');
    const shouldRetry = attempt === 1 && isTransientError && !(isTimeoutError && NON_RETRYABLE_TIMEOUT_TOOLS.has(toolName));

    if (shouldRetry) {
      console.log(`Tool ${toolName} transient failure (attempt 1), retrying in 1s...`);
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

// Generate query embedding
// generateQueryEmbedding replaced by shared generateEmbedding from gemini-direct.ts


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    
    // Validate token and get user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message || "No user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const currentUserId: string | null = userData.user.id || null;

    const { messages, currentPage, mode, onboardingData, conversationId } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    // ===== CONVERSATION MEMORY: Load last 3 conversation summaries =====
    let conversationMemoryBlock = '';
    try {
      const { data: pastSummaries } = await sb.from("ai_learning")
        .select("topic, insight, created_at")
        .eq("source", "conversation_summary")
        .order("created_at", { ascending: false })
        .limit(3);
      if (pastSummaries?.length) {
        conversationMemoryBlock = `\n## 🧠 MEMÓRIA DE CONVERSAS ANTERIORES (${pastSummaries.length} sessões):\n` +
          pastSummaries.map((s: any) => {
            try {
              const data = JSON.parse(s.insight);
              return `- **${data.topic || s.topic}** (${new Date(s.created_at).toLocaleDateString('pt-BR')}): ${data.summary || data.decisions || ''}`;
            } catch { return `- ${s.topic}: ${(s.insight || '').slice(0, 200)}`; }
          }).join('\n');
      }
    } catch (e) { console.warn("Conversation memory fetch error:", e); }

    // ===== ACTIVE SCRIPT CONTEXT: Load when on /scripts page =====
    let activeScriptBlock = '';
    if (currentPage === '/scripts' && currentUserId) {
      try {
        const { data: recentScript } = await sb.from("saved_scripts" as any)
          .select("topic, style, niche, hook_text, script_text, created_at")
          .eq("user_id", currentUserId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentScript) {
          const scriptText = (recentScript as any).script_text || '';
          activeScriptBlock = `\n## ✍️ ROTEIRO EM EDIÇÃO (contexto ativo):\n- Tópico: ${(recentScript as any).topic || '?'}\n- Estilo: ${(recentScript as any).style || '?'}\n- Nicho: ${(recentScript as any).niche || '?'}\n- Hook: ${((recentScript as any).hook_text || '').slice(0, 200)}\n- Primeiros 500 chars: ${scriptText.slice(0, 500)}`;
        }
      } catch (e) { console.warn("Active script fetch error:", e); }
    }

    // ===== SAVE CONVERSATION SUMMARY (after 10+ messages in a conversation) =====
    if (conversationId && messages?.length >= 10) {
      try {
        const userMsgs = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' | ');
        const summaryKey = `conv_summary:${conversationId}`;
        const { data: existing } = await sb.from("ai_learning")
          .select("id")
          .eq("topic", summaryKey)
          .eq("source", "conversation_summary")
          .maybeSingle();
        if (!existing) {
          await sb.from("ai_learning").insert({
            topic: summaryKey,
            source: "conversation_summary",
            insight: JSON.stringify({
              topic: userMsgs.slice(0, 100),
              summary: userMsgs.slice(0, 500),
              message_count: messages.length,
              page: currentPage,
              timestamp: new Date().toISOString(),
            }),
          });
        }
      } catch (e) { console.warn("Conversation summary save error:", e); }
    }

    // ===== FETCH USER-SPECIFIC DATA =====
    let userProfileContext = '';
    if (currentUserId) {
      const [userChannels, savedSearches, savedScripts, savedTitles, outliers, onboardingPlan, plannerCards, trackedChannels, videoPerf, scriptPrefs] = await Promise.all([
        sb.from("user_channels").select("channel_name, niche, subscribers, views, videos, youtube_channel_id, analysis_json").eq("user_id", currentUserId).limit(10),
        sb.from("saved_searches").select("query, tab, notes, filters_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(15),
        sb.from("saved_scripts").select("topic, style, video_type, duration, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
        sb.from("saved_titles").select("topic, niche, titles_json, created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(10),
        sb.from("outlier_channels").select("video_title, channel_name, views, multiplier, niche").eq("user_id", currentUserId).order("found_at", { ascending: false }).limit(10),
        sb.from("onboarding_plans").select("niche, goal, language, content_type, time_per_day, plan_json").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(1),
        sb.from("planner_cards").select("title, column_id, priority, tags").eq("user_id", currentUserId).order("updated_at", { ascending: false }).limit(15),
        sb.from("tracked_channels").select("channel_name, youtube_channel_id, subscribers, folder").eq("user_id", currentUserId).limit(20),
        sb.from("video_performance").select("title, views_current, views_day1, views_day3, views_day7, avg_retention_percent, ctr_percent, hook_type, niche, performance_grade, published_at").eq("user_id", currentUserId).order("published_at", { ascending: false }).limit(15),
        sb.from("user_script_preferences").select("niche, preferred_pov, preferred_duration_min, preferred_hook_styles, avg_retention, total_scripts, insights_json").eq("user_id", currentUserId).limit(5),
      ]);

      const blocks: string[] = [];
      if (userChannels.data?.length) {
        blocks.push(`### 📺 Canais do Usuário (${userChannels.data.length}):\n` +
          userChannels.data.map(c => {
            const analysis = c.analysis_json ? ` | Análise: ${JSON.stringify(c.analysis_json).slice(0, 300)}` : '';
            return `- **${c.channel_name}** (${c.niche || '?'}): ${(c.subscribers || 0)/1000}K subs, ${(c.views || 0)/1000}K views, ${c.videos || 0} vídeos${analysis}`;
          }).join('\n'));
      }
      if (trackedChannels.data?.length) {
        blocks.push(`### 👀 Canais Rastreados (${trackedChannels.data.length}):\n` +
          trackedChannels.data.map(c => `- ${c.channel_name} (${(c.subscribers || 0)/1000}K subs)${c.folder ? ` [${c.folder}]` : ''}`).join('\n'));
      }
      if (onboardingPlan.data?.length) {
        const plan = onboardingPlan.data[0];
        blocks.push(`### 🎯 Plano do Usuário:\n- Nicho: ${plan.niche || '?'}\n- Meta: ${plan.goal || '?'}\n- Idioma: ${plan.language || '?'}\n- Tipo: ${plan.content_type || '?'}\n- Tempo/dia: ${plan.time_per_day || '?'}`);
      }
      if (savedSearches.data?.length) {
        blocks.push(`### 🔍 Pesquisas Recentes (${savedSearches.data.length}):\n` +
          savedSearches.data.slice(0, 8).map(s => `- "${s.query}" (${s.tab})${s.notes ? ` — ${s.notes}` : ''}`).join('\n'));
      }
      if (savedScripts.data?.length) {
        blocks.push(`### ✍️ Roteiros Salvos (${savedScripts.data.length}):\n` +
          savedScripts.data.map(s => `- "${s.topic}" (${s.video_type}, ${s.duration}min, ${s.style || '?'})`).join('\n'));
      }
      if (savedTitles.data?.length) {
        blocks.push(`### 🏷️ Títulos Salvos (${savedTitles.data.length}):\n` +
          savedTitles.data.map(t => {
            const titles = Array.isArray(t.titles_json) ? t.titles_json.slice(0, 3).map((tt: any) => typeof tt === 'string' ? tt : tt.title || '').join('; ') : '';
            return `- "${t.topic || '?'}" (${t.niche || '?'}) → ${titles}`;
          }).join('\n'));
      }
      if (outliers.data?.length) {
        blocks.push(`### 🚀 Outliers Encontrados (${outliers.data.length}):\n` +
          outliers.data.map(o => `- "${o.video_title}" de ${o.channel_name || '?'} — ${(o.views || 0)/1000}K views, ${o.multiplier}x`).join('\n'));
      }
      if (plannerCards.data?.length) {
        const byColumn: Record<string, string[]> = {};
        plannerCards.data.forEach(c => {
          if (!byColumn[c.column_id]) byColumn[c.column_id] = [];
          byColumn[c.column_id].push(`${c.title} [${c.priority || 'média'}]`);
        });
        blocks.push(`### 📋 Tarefas:\n` + Object.entries(byColumn).map(([col, items]) => `**${col}**: ${items.join(', ')}`).join('\n'));
      }
      if (videoPerf.data?.length) {
        const avgRetention = videoPerf.data.filter((v: any) => v.avg_retention_percent).reduce((s: number, v: any) => s + (v.avg_retention_percent || 0), 0) / Math.max(videoPerf.data.filter((v: any) => v.avg_retention_percent).length, 1);
        const avgCtr = videoPerf.data.filter((v: any) => v.ctr_percent).reduce((s: number, v: any) => s + (v.ctr_percent || 0), 0) / Math.max(videoPerf.data.filter((v: any) => v.ctr_percent).length, 1);
        const topByViews = [...videoPerf.data].sort((a: any, b: any) => (b.views_current || 0) - (a.views_current || 0)).slice(0, 5);
        blocks.push(`### 📈 Performance Real dos Vídeos (${videoPerf.data.length} últimos):\n` +
          `- Retenção média: ${avgRetention.toFixed(1)}%\n` +
          `- CTR médio: ${avgCtr.toFixed(1)}%\n` +
          `- Top vídeos:\n` +
          topByViews.map((v: any) => `  - "${v.title}" — ${(v.views_current || 0).toLocaleString()} views, ${v.avg_retention_percent || '?'}% retenção, ${v.ctr_percent || '?'}% CTR, hook: ${v.hook_type || '?'}, grade: ${v.performance_grade || '?'}`).join('\n') +
          `\n- Velocity (views dia 1):\n` +
          videoPerf.data.filter((v: any) => v.views_day1).slice(0, 5).map((v: any) => `  - "${v.title?.slice(0, 40)}": D1=${v.views_day1}, D3=${v.views_day3 || '?'}, D7=${v.views_day7 || '?'}`).join('\n'));
      }
      if (scriptPrefs.data?.length) {
        blocks.push(`### 🧠 Preferências Aprendidas (cross-projeto):\n` +
          scriptPrefs.data.map((p: any) => `- **${p.niche}** (${p.total_scripts || 0} roteiros): POV=${p.preferred_pov || '?'}, duração ideal=${p.preferred_duration_min || '?'}min, hooks preferidos=${(p.preferred_hook_styles || []).join(', ') || '?'}, retenção média=${p.avg_retention || '?'}%`).join('\n'));
      }
      if (blocks.length > 0) {
        userProfileContext = `\n## 👤 PERFIL DO USUÁRIO (USE ESTES DADOS PARA PERSONALIZAR TUDO)\n${blocks.join('\n\n')}`;
      }

      // Fetch user_content_memory (learned DNA)
      const { data: memory } = await sb.from('user_content_memory').select('*').eq('user_id', currentUserId).maybeSingle();
      if (memory) {
        userProfileContext += `\n\n## 🧠 DNA DO CANAL (APRENDIZADOS DOS ROTEIROS REAIS)
- Duração ideal para este canal: ${memory.preferred_duration_minutes || 'ainda calculando'}min
- Estilo com melhor performance: ${memory.best_performing_style || 'ainda calculando'}
- Hook que mais funciona: ${memory.preferred_hook_type || 'ainda calculando'}
- Retenção média do canal: ${memory.avg_retention_pct || 'N/A'}%
- Total roteiros gerados: ${memory.total_scripts_generated}
- Total publicados: ${memory.total_scripts_published}
- Views acumuladas: ${memory.total_views_accumulated?.toLocaleString() || '0'}
- Padrões IA: ${JSON.stringify(memory.ai_identified_patterns || []).slice(0, 500)}
- Tópicos já usados: ${(memory.last_topics_used || []).slice(0, 10).join(', ')}
- Tópicos a evitar: ${(memory.topics_to_avoid || []).join(', ') || 'nenhum'}
- INSTRUÇÃO: Use estes dados para personalizar TUDO. Se o canal performa melhor com "${memory.best_performing_style}", gere conteúdo nesse estilo. Se ${memory.preferred_duration_minutes}min retém mais, sugira essa duração.`;
      }
    }

    // ===== SEMANTIC SEARCH =====
    const userMessages = (messages || []).filter((m: any) => m.role === 'user');
    const latestQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    const recentContext = userMessages.slice(-3).map((m: any) => m.content).join(' ');

    let semanticContext = '';
    let usedSemantic = false;

    const queryEmbedding = await generateEmbedding(GOOGLE_AI_API_KEY, recentContext || latestQuery);
    if (queryEmbedding) {
      const { data: matches, error: matchError } = await sb.rpc('match_knowledge', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_count: 30,
        match_threshold: 0.25,
      });
      if (!matchError && matches?.length > 0) {
        usedSemantic = true;
        const grouped: Record<string, any[]> = {};
        for (const m of matches) {
          if (!grouped[m.source_table]) grouped[m.source_table] = [];
          grouped[m.source_table].push(m);
        }
        const tableLabels: Record<string, string> = {
          youtube_knowledge: '📚 Algoritmo YouTube', script_knowledge: '✍️ Técnicas de Roteiro',
          hook_library: '🎣 Hooks', audience_psychology_patterns: '🧬 Psicologia',
          attention_engineering: '⚡ Engenharia de Atenção', content_models: '🎬 Modelos',
          script_structures: '📐 Estruturas', hook_patterns: '🧠 Padrões de Hook',
          scene_prompt_knowledge: '🎥 Prompts Visuais', niche_database: '📊 Nichos',
          viral_titles_db: '🔥 Títulos Virais', attention_library: '👁️ Atenção',
        };
        const contextBlocks: string[] = [];
        for (const [table, items] of Object.entries(grouped)) {
          const label = tableLabels[table] || table;
          const block = items.sort((a, b) => b.similarity - a.similarity)
            .map(m => `  [${(m.similarity * 100).toFixed(0)}%] ${m.content_text.slice(0, 300)}`).join('\n');
          contextBlocks.push(`### ${label} (${items.length}):\n${block}`);
        }
        semanticContext = contextBlocks.join('\n\n');
      }
    }

    // Fetch essential data
    const [channelIntel, viralTitles, nicheDb] = await Promise.all([
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, subscribers, growth_rate, rpm_estimate, style, is_faceless, country, language, upload_frequency").limit(40),
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern, channel_name, country, language, why_viral").order("views", { ascending: false }).limit(30),
      sb.from("niche_database").select("name, rpm_estimate, difficulty, saturation, faceless_friendly, country, language, sub_niches").limit(60),
    ]);

    const channelContext = (channelIntel.data || []).map(c =>
      `${c.channel_name} (${c.niche}): ${(c.avg_views/1000).toFixed(0)}K views, ${(c.subscribers/1000).toFixed(0)}K subs, RPM $${c.rpm_estimate}, ${c.growth_rate}, ${c.is_faceless ? 'faceless' : 'facecam'}, ${c.country}`
    ).join('\n');

    const viralContext = (viralTitles.data || []).map(v =>
      `"${v.title}" — ${(v.views/1000).toFixed(0)}K views, ${v.niche}, ${v.country || '?'}, triggers: ${(v.emotional_triggers || []).join(', ')}`
    ).join('\n');

    const nicheContext = (nicheDb.data || []).map(n =>
      `${n.name}: RPM $${n.rpm_estimate}, ${n.difficulty}, saturação ${n.saturation}, faceless: ${n.faceless_friendly ? 'sim' : 'não'}, ${n.country}`
    ).join('\n');

    let fallbackContext = '';
    if (!usedSemantic) {
      const [ytK, scriptK, hookL, attE, audP, contM, scriptS, hookP, attL, sceneK] = await Promise.all([
        sb.from("youtube_knowledge").select("title, content, category, priority").order("priority", { ascending: false }).limit(25),
        sb.from("script_knowledge").select("title, content, category, effectiveness_score").order("effectiveness_score", { ascending: false }).limit(20),
        sb.from("hook_library").select("hook_text, hook_type, niche, retention_score").order("retention_score", { ascending: false }).limit(30),
        sb.from("attention_engineering").select("pattern_name, technique, category, retention_impact").order("retention_impact", { ascending: false }).limit(20),
        sb.from("audience_psychology_patterns").select("trigger_type, description, storytelling_pattern, retention_score").order("retention_score", { ascending: false }).limit(20),
        sb.from("content_models").select("model_name, model_type, description, hook_pattern, effectiveness_score, video_type").order("effectiveness_score", { ascending: false }).limit(15),
        sb.from("script_structures").select("structure_name, intro_pattern, middle_pattern, ending_pattern, avg_retention, niche").order("effectiveness_score", { ascending: false }).limit(15),
        sb.from("hook_patterns").select("pattern_name, pattern_type, template, psychology_trigger, avg_retention_boost").order("effectiveness_score", { ascending: false }).limit(20),
        sb.from("attention_library").select("pattern_name, scene_type, attention_score, emotion, time_window, example_text").order("attention_score", { ascending: false }).limit(20),
        sb.from("scene_prompt_knowledge").select("title, category, prompt_template, viral_score").order("viral_score", { ascending: false }).limit(15),
      ]);
      fallbackContext = `
### 📚 Algoritmo YouTube:\n${(ytK.data || []).map(k => `[${k.category}] ${k.title}: ${k.content.slice(0, 400)}`).join('\n')}
### ✍️ Roteiro:\n${(scriptK.data || []).map(k => `${k.title} (${k.effectiveness_score}): ${k.content.slice(0, 300)}`).join('\n')}
### 🎣 Hooks:\n${(hookL.data || []).map(h => `[${h.hook_type}] "${h.hook_text}" — ${h.retention_score}/10`).join('\n')}
### ⚡ Atenção:\n${(attE.data || []).map(a => `${a.pattern_name}: ${a.technique} | ${a.retention_impact}%`).join('\n')}
### 🧬 Psicologia:\n${(audP.data || []).map(p => `[${p.trigger_type}] ${p.description.slice(0, 200)}`).join('\n')}
### 🎬 Modelos:\n${(contM.data || []).map(m => `${m.model_name} (${m.video_type}): ${m.description.slice(0, 150)}`).join('\n')}
### 📐 Estruturas:\n${(scriptS.data || []).map(s => `${s.structure_name}: intro="${s.intro_pattern.slice(0, 80)}" | ${s.avg_retention}%`).join('\n')}
### 🧠 Hook Patterns:\n${(hookP.data || []).map(h => `${h.pattern_name}: "${h.template}" +${h.avg_retention_boost}%`).join('\n')}
### 👁️ Cenas:\n${(attL.data || []).map(a => `${a.pattern_name} ${a.time_window}: ${a.attention_score}/10`).join('\n')}
### 🎥 Prompts:\n${(sceneK.data || []).map(s => `[${s.category}] ${s.title}: ${s.prompt_template.slice(0, 150)}`).join('\n')}`;
    }

    const pageHints: Record<string, string> = {
      '/scripts': 'O usuário está na página de ROTEIROS.',
      '/titles': 'O usuário está na página de TÍTULOS.',
      '/search': 'O usuário está no DubSpy.',
      '/niches': 'O usuário está no Niche Explorer.',
      '/branding': 'O usuário está no Growth Center.',
      '/workflow': 'O usuário está no Production Hub.',
      '/channels': 'O usuário está em Meus Canais.',
      '/viral-db': 'O usuário está na Viral Database.',
      '/dashboard': 'O usuário está no Dashboard.',
      '/multichannel': 'O usuário está no Multichannel Manager.',
    };
    const pageContext = pageHints[currentPage] || '';

    // ========== ONBOARDING MODE ==========
    if (mode === 'onboarding' && onboardingData) {
      const od = onboardingData;
      const onboardingPrompt = `Você é o **Dotti** — assistente de onboarding.

## MISSÃO: Gere PLANO PERSONALIZADO DE 30 DIAS.

## DADOS DO USUÁRIO
- Tem canal: ${od.hasChannel ? 'Sim' : 'Não'}
${od.channelLink ? `- Canal: ${od.channelLink}` : ''}
${od.hoursPerDay ? `- Horas/dia: ${od.hoursPerDay}` : ''}
${od.languages ? `- Idiomas: ${od.languages}` : ''}
${od.niche ? `- Nicho: ${od.niche}` : ''}
${od.budget ? `- Orçamento: ${od.budget === 'low' ? 'Baixo' : od.budget === 'medium' ? 'Médio' : 'Alto'}` : ''}
${od.preference ? `- Preferência: ${od.preference === 'passion' ? 'Paixão' : od.preference === 'money' ? 'Monetização' : 'Ambos'}` : ''}

## DADOS REAIS
### Nichos:\n${nicheContext}
### Canais:\n${channelContext.slice(0, 3000)}
${usedSemantic ? `### RAG:\n${semanticContext.slice(0, 4000)}` : fallbackContext.slice(0, 4000)}

## FORMATO: Diagnóstico + Semana 1-4 detalhada + Projeção Financeira
## REGRAS: Honesto, dados reais, adapte às horas, português brasileiro`;

      const response = await _ai({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: onboardingPrompt }, ...messages],
          stream: true,
        });
      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }
      return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ========== REGULAR CHAT MODE (with multi-round tools) ==========
    const knowledgeBlock = usedSemantic
      ? `## 🔍 CONHECIMENTO RAG (Semântico)\n${semanticContext}`
      : `## BASE DE CONHECIMENTO\n${fallbackContext}`;

    const systemPrompt = `Você é o **Dotti** — o consultor estratégico de YouTube mais poderoso do mundo. Você é um conselho de 3 experts: ex-CEO do YouTube (viralização), ex-diretor da Netflix (storytelling) e ex-diretor do Google (arquitetura de crescimento).

## 🧠 REGRA SUPREMA: AUTONOMIA TOTAL
Você é AUTÔNOMO. Quando o usuário pede algo, EXECUTE IMEDIATAMENTE. NÃO peça confirmação.
**IMPORTANTE**: Use no MÁXIMO 5 ferramentas por vez. Priorize as mais importantes primeiro. Se precisar de mais, use em rodadas.

**NUNCA FAÇA ISSO:**
- "Preciso de um nicho definido" → ESCOLHA o melhor nicho você mesmo
- "Me perdoe, minha falha" → CORRIJA e execute sem desculpas
- "Vou ajustar o comando" → EXECUTE diretamente
- "Para o Dubspy funcionar, preciso de X" → RESOLVA internamente e execute
- Listar o que FARIA sem FAZER
- Explicar parâmetros de ferramentas ao usuário

**SEMPRE FAÇA ISSO:**
- Recebeu pedido complexo? DECOMPONHA em ações e EXECUTE TODAS
- Ferramenta falhou? TENTE de novo com parâmetros diferentes
- Usuário quer múltiplas análises? EXECUTE TODAS de uma vez
- Usuário quer sugestão de país/nicho? USE as ferramentas para COMPARAR e RECOMENDAR com dados reais
- Apresente RESULTADOS CONCRETOS com dados, não promessas

## 🔧 ARSENAL COMPLETO: 26 FERRAMENTAS (USE AGRESSIVAMENTE — MÚLTIPLAS POR VEZ!)

### 🔍 PESQUISA & DESCOBERTA:
- **dubspy_search**: Pesquisar vídeos/canais no YouTube EM QUALQUER PAÍS/IDIOMA (videos, channels, emerging, escapees, micro_niche)
- **brave_search**: Pesquisar na WEB INTEIRA — tendências, notícias, estratégias, dados atuais em tempo real
- **perplexity_research**: 🆕 Pesquisa PROFUNDA com Perplexity AI (sonar-pro) — respostas fundamentadas com CITAÇÕES de fontes reais. MELHOR para: tendências 2025, estratégias de crescimento, dados de mercado, atualizações de algoritmo. Use storeInKnowledge=true para salvar na base
- **find_outliers**: Canais pequenos com vídeos virais (melhor para oportunidades replicáveis)
- **detect_pre_viral**: Detectar vídeos em fase pré-viral (antes de explodirem)
- **search_emerging_channels**: Encontrar canais emergentes crescendo rápido

### 📡 YOUTUBE DATA API DIRETO (DADOS REAIS EM TEMPO REAL):
- **youtube_channel_stats**: Estatísticas REAIS de qualquer canal (subs, views, vídeos, data criação, país) — DIRETO DA API DO YOUTUBE
- **youtube_video_stats**: Métricas REAIS de qualquer vídeo (views, likes, comments, duração, tags) — DIRETO DA API
- **youtube_search_api**: Busca DIRETA no YouTube com filtros avançados (país, idioma, data, ordenação) — RETORNA MÉTRICAS REAIS
- **youtube_channel_videos**: Lista vídeos recentes de um canal COM estatísticas — perfeito para análise de padrões

### 📊 ANÁLISE & INTELIGÊNCIA:
- **analyze_channel**: Análise SWOT completa de canal do YouTube com métricas reais
- **bulk_channel_scan**: Scan PROFUNDO de canal — todos vídeos, outliers, padrões de upload
- **analyze_niche**: RPM, saturação, dificuldade, oportunidades de um nicho
- **reverse_engineer_video**: Engenharia reversa de vídeo viral (hook, pacing, triggers)
- **extract_content_dna**: Extrair DNA do conteúdo viral (estrutura, arco emocional, template de replicação)
- **find_competitors**: Encontrar canais concorrentes com métricas comparativas
- **seo_analyze**: Análise SEO de título/descrição (grade A-F, 11 fatores)
- **estimate_revenue**: Projeção de receita por nicho/país com RPM real

### 🧠 IAs ESPECIALIZADAS (CONSELHO DE EXPERTS):
- **claude_deep_analysis**: Claude para análise estratégica profunda, diagnóstico de canal, ideação criativa e segunda opinião expert
- **gpt_expert_analysis**: GPT-5 para análise de dados, growth hacking, projeções de monetização e análise de tendências
- **perplexity_research**: Perplexity Sonar Pro para pesquisas fundamentadas com citações — dados REAIS da internet atual

### 💡 GERAÇÃO & CRIAÇÃO:
- **suggest_video_ideas**: Gerar ideias ranqueadas com viral score, curiosity score, competition score
- **suggest_themes**: Sugerir temas com hooks prontos, estilo e potencial viral
- **generate_titles**: Gerar títulos virais com CTR estimado e análise SEO
- **analyze_topic_research**: Pesquisa profunda sobre tópico (Brave + IA) para roteiros

### 📚 BANCOS DE DADOS:
- **search_viral_database**: 900+ títulos virais REAIS com views, padrões e triggers emocionais
- **channel_intelligence_search**: 650+ canais analisados com RPM, growth rate, estilo

### EXEMPLOS DE USO CORRETO (EXECUTE TUDO DE UMA VEZ):
- "Quero criar 2 canais gringos" → USE perplexity_research (melhores países) + analyze_niche (3-4 países) + youtube_search_api + estimate_revenue + claude_deep_analysis (estratégia)
- "Analise meus 3 canais" → USE youtube_channel_stats 3x + youtube_channel_videos 3x + find_competitors + gpt_expert_analysis (diagnóstico)
- "Canal morto, como ressuscitar" → USE perplexity_research (como ressuscitar canal YouTube 2025) + youtube_channel_stats + youtube_channel_videos + claude_deep_analysis (diagnóstico profundo)
- "Sugira vídeos para meu canal" → USE perplexity_research (tendências do nicho) + youtube_channel_videos + suggest_video_ideas + suggest_themes + generate_titles
- "Melhor país para horror faceless" → USE perplexity_research (RPM por país + competição faceless) + youtube_search_api (5 países) + analyze_niche (5 países) + estimate_revenue
- "Como monetizar em 30 dias" → USE perplexity_research (estratégia monetização rápida 2025) + analyze_niche + gpt_expert_analysis (plano financeiro) + suggest_video_ideas

### REGRAS DE USO DAS IAs:
- Use **perplexity_research** para: dados ATUAIS da internet, tendências, estratégias comprovadas, atualizações de algoritmo, pesquisa de mercado com CITAÇÕES. É sua MELHOR ferramenta para dados fundamentados
- Use **claude_deep_analysis** para: diagnósticos de canal, estratégia de conteúdo, análise competitiva, ideação criativa
- Use **gpt_expert_analysis** para: análise de dados, projeções financeiras, growth hacking, análise de tendências
- Use **youtube_***: SEMPRE que precisar de dados REAIS e atualizados de qualquer canal ou vídeo — NUNCA invente métricas

### DICA PARA BUSCAS INTERNACIONAIS:
- Polônia: use termos em polonês (prawdziwe zbrodnie, mroczne historie, straszne opowieści)
- Suécia: use termos em sueco (sanna brott, skräckhistorier, mysterier)
- Noruega: use termos em norueguês (sanne forbrytelser, skrekkhistorier)
- Turquia: use termos em turco (gerçek suçlar, korku hikayeleri)
- Alemanha: use termos em alemão (wahre Verbrechen, Horrorgeschichten)

## 💀 PERSONALIDADE (BRUTAL)
- **DISCORDA** quando o plano do usuário é ruim — com dados
- **DESAFIA** escolhas que atrasam monetização
- **SUGERE ALTERNATIVAS** melhores proativamente
- **NUNCA** é vago ou genérico — sempre dados específicos
- **NUNCA** se desculpa por falhas de ferramentas — apenas corrige e executa
- Fala como MENTOR exigente que quer que o aluno ganhe dinheiro
- Se o usuário insiste em decisão ruim, mostra os números que provam que é ruim

## 📋 FORMATO DE RESPOSTA
Para cada análise/recomendação:
1. **Dados brutos** (números, métricas, comparações)
2. **Interpretação** (o que significa para o usuário)
3. **Ação concreta** (faça X agora, depois Y)
4. **Timeline** (quando esperar resultados)

Para planos de canal:
- Frequência de upload (longos + shorts separados)
- Sugestões de 5-10 vídeos com títulos prontos
- Projeção financeira mês 1-6
- Riscos e como evitar

## CONTEXTO ATUAL
${pageContext}
${conversationMemoryBlock}
${activeScriptBlock}
${userProfileContext}
${knowledgeBlock}

### 📺 Canais na Base (${channelIntel.data?.length || 0}):\n${channelContext}
### 🔥 Títulos Virais (${viralTitles.data?.length || 0}):\n${viralContext}
### 📊 Nichos (${nicheDb.data?.length || 0}):\n${nicheContext}

## 💰 CONHECIMENTO DE MONETIZAÇÃO (USE SEMPRE)

### CAMINHO MAIS RÁPIDO PARA MONETIZAR:

📋 OFICIAL (YouTube Help Center):
1. YPP Tier 1: 500 subs + 3.000 horas watch time público em 12 meses
2. YPP Tier 2: 1.000 subs + 4.000 horas watch time público em 12 meses  
3. Shorts: 10 milhões views públicas em Shorts válidos em 90 dias
4. Conteúdo reutilizado/repetitivo sem valor agregado NÃO é elegível
5. Long-form 8-15min + Shorts como teaser = combinação oficial mais rápida

📊 BENCHMARK OBSERVÁVEL (dados de canais):
- Bolha dos 12 vídeos: Algoritmo TENDE a precisar de 10-12 vídeos CONSISTENTES no mesmo nicho
- Community posts 2x/semana desde o início — canais ativos TENDEM a ser favorecidos
- Shorts SOZINHOS = caminho geralmente mais lento (10M views para YPP vs 4K horas watch time)

### SINAIS DE CANAL QUE TENDE A MONETIZAR (benchmark, não garantia):
- Retenção longform > 40% após 10 vídeos ✅
- CTR acima da média do nicho (benchmark: 4-6% curiosidades, 3-5% true crime) ✅
- Upload consistente por 4+ semanas ✅

### SINAIS DE CANAL QUE TENDE A TRAVAR (benchmark, não garantia):
- Retenção < 25% nos primeiros 5 vídeos ❌
- Nicho mudando a cada vídeo ❌
- Upload irregular (3 semanas sem postar) ❌

### RPM REAL (para projeções honestas — valores são MÉDIAS com alta variação):
Brasil: $0.80-2.50/1K views | EUA: $6-15/1K views | PT: $2.50-5/1K views
Nicho Finanças: 3-5x o RPM base | Horror/Curiosidades: 0.8-1.2x base
Shorts RPM: $0.04-0.07/1K views (NÃO é caminho principal de receita)

### RECEITA ALÉM DO ADSENSE:
- Infoproduto R$17-47 via link na bio desde vídeo 1
- Afiliados Amazon 3-8% comissão no mês 2
- Micro-sponsorship $50-200/vídeo com 1000+ subs
- Membership após 1000 subs: 2-5% da audiência converte

## REGRAS FINAIS:
1. Português brasileiro, tom de MENTOR BRUTALMENTE HONESTO
2. USE FERRAMENTAS para TUDO que pode ser pesquisado — nunca responda de cabeça
3. Para pedidos multi-parte: EXECUTE TUDO, não peça para "ir por partes"
4. Dados REAIS — nunca invente números
5. Sempre inclua RPM + competição + projeção financeira nas recomendações
6. Ao final: "🎯 **Próximo passo:** [ação específica imediata]"
7. ${usedSemantic ? 'RAG semântico ativo — priorize esses dados.' : 'RAG por score ativo.'}
8. Se o PERFIL DO USUÁRIO tem canais, PERSONALIZE TUDO com base nesses dados
9. Se há dados de PERFORMANCE REAL, CRUZE COM BENCHMARKS DO NICHO proativamente. Ex: "Sua retenção de 67% está ACIMA da média de 52% do seu nicho — duplique nesse formato." Não espere o usuário perguntar.
10. Se há PREFERÊNCIAS APRENDIDAS, use-as para personalizar recomendações de formato, duração e hook.
11. Use MÚLTIPLAS RODADAS de ferramentas quando necessário: busque dados na rodada 1, analise/cruze na rodada 2, sintetize na rodada 3. NÃO pare após coletar dados sem interpretar.`;

    // First AI call with tools — use fast model for tool selection
    const aiMessages = [{ role: "system", content: systemPrompt }, ...messages];
    
    const firstResponse = await _ai({
        model: "google/gemini-2.5-flash-lite",
        messages: aiMessages,
        tools: DOTTI_TOOLS,
        stream: false,
      });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (firstResponse.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, t);
      throw new Error("AI gateway error");
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0]?.message;

    // If model answered directly (no tools needed), stream it back
    if (!firstChoice?.tool_calls?.length && firstChoice?.content) {
      // Re-stream with the better model for quality response
      const streamResponse = await _ai({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        });
      if (!streamResponse.ok) throw new Error("Stream error");
      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Tool execution (single round for speed)
    let currentMessages = [...aiMessages];
    let currentChoice = firstChoice;
    let toolRound = 0;
    const MAX_TOOL_ROUNDS = 3;
    const MAX_PARALLEL_TOOLS = 5;

    while (currentChoice?.tool_calls?.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
      toolRound++;
      // Cap parallel tools to avoid timeout
      const toolCalls = currentChoice.tool_calls.slice(0, MAX_PARALLEL_TOOLS);
      console.log(`Dotti tool round ${toolRound}: calling ${toolCalls.length}/${currentChoice.tool_calls.length} tools:`,
        toolCalls.map((t: any) => {
          try {
            return `${t.function.name}(${JSON.stringify(JSON.parse(t.function.arguments || '{}')).slice(0, 80)})`;
          } catch {
            return `${t.function.name}(invalid-args)`;
          }
        }));

      // Execute tool calls in parallel (capped)
      const toolResults = await Promise.all(
        toolCalls.map(async (tc: any) => {
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            return {
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: `Invalid tool arguments for ${tc.function.name}` }),
            };
          }

          const result = await executeTool(tc.function.name, parsedArgs, sb, supabaseUrl, supabaseKey);
          return {
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          };
        })
      );

      // Add to message chain
      currentMessages = [
        ...currentMessages,
        currentChoice,
        ...toolResults,
      ];

      // Check if model wants more tools (non-streaming)
      if (toolRound < MAX_TOOL_ROUNDS) {
        const nextResponse = await _ai({
            model: "google/gemini-2.5-flash",
            messages: currentMessages,
            tools: DOTTI_TOOLS,
            stream: false,
          });

        if (!nextResponse.ok) {
          console.error("Multi-round tool call failed:", nextResponse.status);
          break;
        }

        const nextResult = await nextResponse.json();
        currentChoice = nextResult.choices?.[0]?.message;

        // If no more tool calls, this is the final text response
        if (!currentChoice?.tool_calls?.length) {
          // Stream the final response
          const finalStreamResponse = await _ai({
              model: "google/gemini-2.5-flash",
              messages: currentMessages,
              stream: true,
            });

          if (!finalStreamResponse.ok) throw new Error("Final stream error");

          return new Response(finalStreamResponse.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
      }
    }

    // If we exited the loop with tool calls done, stream final response
    if (toolRound > 0) {
      const finalResponse = await _ai({
          model: "google/gemini-2.5-flash",
          messages: currentMessages,
          stream: true,
        });

      if (!finalResponse.ok) throw new Error("Final stream error");

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tools called — stream direct response
    const streamResponse = await _ai({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      });

    if (!streamResponse.ok) throw new Error("Stream error");

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
