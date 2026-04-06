// ═══════════════════════════════════════════════════════════════
// TUBEBOT TOOL DEFINITIONS — 25 tools for YouTube growth assistant
// ═══════════════════════════════════════════════════════════════

export const TUBEBOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "dubspy_search",
      description: "Search YouTube videos and channels in ANY country/language. ALWAYS use when user asks to find channels, videos, trends, opportunities, or needs competitive research. Supports modes: videos, channels, emerging, escapees, micro_niche.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query — use LOCAL LANGUAGE for best results" },
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
      name: "analyze_channel",
      description: "Full SWOT analysis of a YouTube channel: subscribers, views, upload frequency, top videos, viral patterns, growth trajectory.",
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
      name: "analyze_niche",
      description: "Deep analysis of a niche: RPM, saturation, difficulty, top channels, opportunity score, sub-niches.",
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
      description: "Find OUTLIER videos: small channels with viral videos (10x+ average).",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
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
      description: "Search 900+ REAL viral titles with views, patterns, emotional triggers.",
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
  {
    type: "function",
    function: {
      name: "brave_search",
      description: "Search the web using Brave Search for current trends, news, strategies.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
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
      description: "Generate ranked video ideas with viral scores and competition analysis.",
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
      description: "Generate video theme suggestions with viral potential and hooks.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", description: "Niche" },
          style: { type: "string", description: "Video style" },
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
      description: "Analyze SEO of a YouTube video title/description. Returns A-F grade.",
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
      description: "Find competitor channels for a given channel or niche.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID" },
          channelName: { type: "string", description: "Channel name" },
          niche: { type: "string", description: "Niche to search" },
        },
        required: ["niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_content_dna",
      description: "Extract Content DNA of a viral video: hook type, pacing, emotional arc.",
      parameters: {
        type: "object",
        properties: {
          videoId: { type: "string", description: "YouTube video ID" },
          videoTitle: { type: "string", description: "Video title" },
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
      description: "Detect pre-viral videos gaining momentum in early growth phase.",
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
      description: "Deep research on a topic using web search + AI analysis.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topic to research" },
          niche: { type: "string", description: "Niche context" },
          language: { type: "string", description: "Language" },
          style: { type: "string", description: "Content style" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emerging_channels",
      description: "Find emerging/new channels growing fast in a niche.",
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
      description: "Deep scan of a YouTube channel: all videos, performance metrics, outlier detection.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID" },
          channelName: { type: "string", description: "Channel name" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_channel_stats",
      description: "Get REAL YouTube channel statistics from Data API.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID (UCxxxx)" },
          handle: { type: "string", description: "YouTube @handle or channel name" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_video_stats",
      description: "Get REAL video statistics from YouTube Data API.",
      parameters: {
        type: "object",
        properties: {
          videoId: { type: "string", description: "YouTube video ID" },
          videoUrl: { type: "string", description: "YouTube video URL" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_search_api",
      description: "Search YouTube directly via Data API.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: { type: "string", enum: ["video", "channel", "playlist"], description: "Result type" },
          regionCode: { type: "string", description: "Country code" },
          relevanceLanguage: { type: "string", description: "Language code" },
          order: { type: "string", enum: ["relevance", "date", "viewCount", "rating"], description: "Sort order" },
          maxResults: { type: "number", description: "Max results (default 10, max 50)" },
          publishedAfter: { type: "string", description: "ISO date" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "youtube_channel_videos",
      description: "Get recent videos from a YouTube channel with stats.",
      parameters: {
        type: "object",
        properties: {
          channelId: { type: "string", description: "YouTube channel ID" },
          maxResults: { type: "number", description: "Max videos (default 20)" },
          order: { type: "string", enum: ["date", "viewCount"], description: "Sort" },
        },
        required: ["channelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expert_analysis",
      description: "Deep AI analysis using multiple perspectives: strategic, creative, analytical, diagnostic.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "What to analyze or create" },
          context: { type: "string", description: "Relevant context" },
          style: { type: "string", enum: ["strategic", "creative", "analytical", "diagnostic"], description: "Analysis perspective" },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "perplexity_research",
      description: "Deep web research using Perplexity AI with real citations.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Research question" },
          searchRecency: { type: "string", enum: ["day", "week", "month", "year"], description: "Filter by recency" },
          storeInKnowledge: { type: "boolean", description: "Store in knowledge base" },
          storageCategory: { type: "string", description: "Category for storage" },
          storageTitle: { type: "string", description: "Title for storage" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_thumbnail_ctr",
      description: "Analyze a YouTube thumbnail for CTR potential.",
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
      description: "Generate Midjourney/DALL-E prompts for a high-CTR YouTube thumbnail.",
      parameters: {
        type: "object",
        properties: {
          video_title: { type: "string", description: "Video title" },
          niche: { type: "string", description: "Channel niche" },
          emotion: { type: "string", description: "Target emotion" },
          style: { type: "string", description: "Visual style" },
        },
        required: ["video_title", "niche"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_script_to_real_video",
      description: "Link a generated script to its published YouTube video.",
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
      description: "Monetization/YPP diagnosis with algorithm knowledge.",
      parameters: {
        type: "object",
        properties: {
          channel_id: { type: "string", description: "User channel ID" },
          target_revenue_usd: { type: "number", description: "Monthly revenue target" },
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
      description: "Get current YouTube algorithm best practices for a niche.",
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
