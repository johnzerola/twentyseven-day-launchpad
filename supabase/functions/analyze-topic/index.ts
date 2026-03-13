import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, niche, style, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!topic?.trim()) throw new Error("Topic is required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nicheLC = (niche || '').toLowerCase();
    const styleLC = (style || '').toLowerCase();
    const topicLC = topic.toLowerCase();

    // Styles where Brave web search would HURT creativity (fiction, theories, personal stories)
    const CREATIVE_STYLES = ['conspiração', 'mitologia', 'teorias', 'storytelling', 'reddit', 'horror'];
    const isCreativeStyle = CREATIVE_STYLES.includes(styleLC);

    // ========== Parallel: DB queries + YouTube + Brave Search ==========
    // YouTube is ALWAYS useful — even for creative styles, we learn from successful videos
    const youtubeSearchPromise = YOUTUBE_API_KEY ? searchYouTubeVideos(YOUTUBE_API_KEY, topic, niche) : Promise.resolve([]);
    
    // Brave Search RAG — SKIP for creative styles (conspiração, mitologia, etc.)
    const BRAVE_API_KEY = Deno.env.get("BRAVE_API_KEY");
    const braveSearchPromise = (BRAVE_API_KEY && !isCreativeStyle) ? (async () => {
      // Check cache first
      const cacheKey = `brave:analyze:${topic}:${niche || ''}`;
      const { data: cached } = await sb.from("research_cache")
        .select("result_json").eq("cache_key", cacheKey).eq("source", "brave")
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (cached) return (cached.result_json as any)?.results || [];
      
      try {
        const params = new URLSearchParams({ q: `${topic} ${niche || ''} YouTube`, count: "5" });
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
          headers: { Accept: "application/json", "X-Subscription-Token": BRAVE_API_KEY },
        });
        if (!res.ok) { console.warn("Brave Search failed:", res.status); return []; }
        const data = await res.json();
        const results = (data.web?.results || []).slice(0, 8).map((r: any) => ({
          title: r.title, url: r.url, description: r.description,
        }));
        // Cache 48h
        await sb.from("research_cache").upsert({
          cache_key: cacheKey, source: "brave", result_json: { results },
          expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
        }, { onConflict: "cache_key,source" }).then(() => {});
        return results;
      } catch (e) { console.warn("Brave Search error:", e); return []; }
    })() : Promise.resolve([]);
    
    if (isCreativeStyle) {
      console.log(`Skipping Brave Search for creative style "${style}" — YouTube analysis only`);
    }

    // Also fetch hook_library and viral_titles for deeper context
    const hookLibPromise = sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
      .order("retention_score", { ascending: false }).limit(15);
    const viralTitlesPromise = sb.from("viral_titles_db" as any).select("title,views,why_viral,title_pattern,niche")
      .order("views", { ascending: false }).limit(30);

    const [channelsRes, sceneKnowledgeRes, scriptKnowledgeRes, ytKnowledgeRes, youtubeVideos, braveResults, hookLibRes, viralTitlesRes] = await Promise.all([
      sb.from("channel_intelligence")
        .select("channel_name,style,niche,avg_views,subscribers,growth_rate,viral_patterns,top_videos,visual_style_notes,upload_frequency,rpm_estimate")
        .order("avg_views", { ascending: false })
        .limit(200),
      sb.from("scene_prompt_knowledge")
        .select("category,title,prompt_template,tags,viral_score")
        .order("viral_score", { ascending: false })
        .limit(100),
      sb.from("script_knowledge")
        .select("category,title,content,examples,effectiveness_score")
        .order("effectiveness_score", { ascending: false })
        .limit(50),
      sb.from("youtube_knowledge")
        .select("category,title,content,priority")
        .order("priority", { ascending: false })
        .limit(20),
      youtubeSearchPromise,
      braveSearchPromise,
      hookLibPromise,
      viralTitlesPromise,
    ]);

    // ========== Filter channels by niche relevance ==========
    const allChannels = channelsRes.data || [];
    const scoredChannels = allChannels.map((ch: any) => {
      let score = 0;
      const chNiche = (ch.niche || '').toLowerCase();
      const chStyle = (ch.style || '').toLowerCase();
      const chName = (ch.channel_name || '').toLowerCase();
      if (nicheLC && chNiche.includes(nicheLC)) score += 20;
      if (nicheLC && nicheLC.includes(chNiche)) score += 15;
      if (styleLC && chStyle.includes(styleLC)) score += 10;
      const topicWords = topicLC.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of topicWords) {
        if (chNiche.includes(word)) score += 5;
        if (chName.includes(word)) score += 3;
      }
      if (ch.avg_views > 1000000) score += 5;
      if (ch.growth_rate === 'explosive' || ch.growth_rate === 'rapid') score += 3;
      return { ...ch, relevanceScore: score };
    });
    scoredChannels.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    const topChannels = scoredChannels.slice(0, 10);

    // ========== Filter scene knowledge ==========
    const styleMap: Record<string, string[]> = {
      'cinematográfico': ['cinematography', 'lighting', 'camera', 'hook'],
      'dark': ['dark', 'noir', 'horror', 'mystery'],
      '2d': ['animation', '2d', 'motion-graphics'],
      '3d': ['3d', 'animation', 'render'],
      'anime': ['anime', 'animation'],
      'realista': ['photorealistic', 'documentary'],
    };
    const nicheMap: Record<string, string[]> = {
      'mitologia': ['mythology', 'epic', 'ancient', 'gods'],
      'guerra': ['war', 'military', 'documentary'],
      'oceano': ['underwater', 'ocean', 'deep-sea'],
      'conspiração': ['conspiracy', 'mystery', 'dark'],
      'reddit': ['reddit', 'animation', '2d'],
      'horror': ['dark', 'horror', 'noir'],
      'documentário': ['documentary', 'historical'],
    };
    const relevantTags = [
      ...(styleMap[styleLC] || []),
      ...Object.entries(nicheMap).filter(([k]) => nicheLC.includes(k)).flatMap(([, v]) => v),
      'hook', 'transition', 'anti-ai', 'consistency', 'policy',
    ];
    const topSceneKnowledge = (sceneKnowledgeRes.data || [])
      .map((r: any) => {
        let score = r.viral_score || 0;
        const cat = r.category.toLowerCase();
        const tags = Array.isArray(r.tags) ? r.tags.map((t: string) => t.toLowerCase()) : [];
        if (relevantTags.some(rt => cat.includes(rt) || tags.some((t: string) => t.includes(rt)))) score += 10;
        return { ...r, relScore: score };
      })
      .sort((a: any, b: any) => b.relScore - a.relScore)
      .slice(0, 20);

    // ========== Format data for AI ==========
    const channelsBlock = topChannels.map((ch: any) => {
      const vp = typeof ch.viral_patterns === 'object' ? ch.viral_patterns : {};
      const hooks = Array.isArray(vp.hooks) ? vp.hooks.slice(0, 3).join(', ') : '';
      const topVids = Array.isArray(ch.top_videos) ? ch.top_videos.slice(0, 3).map((v: any) =>
        typeof v === 'object' ? `"${v.title}" (${v.views} views)` : String(v)
      ).join('; ') : '';
      return `🎯 ${ch.channel_name} | ${ch.niche} | ${ch.style} | ${ch.avg_views} avg views | ${ch.subscribers} subs | Growth: ${ch.growth_rate} | RPM: $${ch.rpm_estimate || '?'}
  Hooks: [${hooks}] | Visual: ${ch.visual_style_notes || 'N/A'}
  Top: ${topVids}`;
    }).join('\n\n');

    const sceneBlock = topSceneKnowledge.map((r: any) =>
      `[${r.category}] ${r.title}: ${r.prompt_template.slice(0, 150)}`
    ).join('\n');

    const scriptBlock = (scriptKnowledgeRes.data || []).slice(0, 15).map((r: any) =>
      `[${r.category}] ${r.title}: ${r.content.slice(0, 200)}`
    ).join('\n\n');

    const ytBlock = (ytKnowledgeRes.data || []).slice(0, 10).map((r: any) =>
      `[${r.category}] ${r.title}: ${r.content.slice(0, 200)}`
    ).join('\n\n');

    // ========== Format hook_library ==========
    const hookLibBlock = (hookLibRes.data || []).map((r: any) =>
      `• [${r.hook_type}] "${r.hook_text}" (retenção: ${r.retention_score}/10${r.niche ? `, ${r.niche}` : ''})`
    ).join("\n");

    // ========== Format viral_titles_db (topic-relevant) ==========
    const topicWordsForTitles = topicLC.split(/\s+/).filter((w: string) => w.length > 3);
    const scoredViralTitles = (viralTitlesRes.data || []).map((t: any) => {
      let score = 0;
      const tLC = (t.title || '').toLowerCase();
      for (const w of topicWordsForTitles) { if (tLC.includes(w)) score += 10; }
      if (nicheLC && (t.niche || '').toLowerCase().includes(nicheLC)) score += 15;
      return { ...t, matchScore: score };
    }).sort((a: any, b: any) => b.matchScore - a.matchScore);
    const relevantViralTitles = scoredViralTitles.slice(0, 10);
    const viralTitlesBlock = relevantViralTitles.map((t: any) =>
      `• "${t.title}" (${(t.views || 0).toLocaleString()} views) — Pattern: ${t.title_pattern || '?'} | Why: ${t.why_viral || 'N/A'}`
    ).join("\n");

    // ========== Format YouTube real-time videos ==========
    const ytVideosBlock = (youtubeVideos as any[]).length > 0
      ? (youtubeVideos as any[]).map((v: any, i: number) => {
        const viewsNum = parseInt(v.views) || 0;
        const likesNum = parseInt(v.likes) || 0;
        const commentsNum = parseInt(v.comments) || 0;
        const engRate = viewsNum > 0 ? (((likesNum + commentsNum) / viewsNum) * 100).toFixed(2) : '0';
        const daysAgo = v.publishedAt ? Math.floor((Date.now() - new Date(v.publishedAt).getTime()) / 86400000) : '?';
        const viewsPerDay = viewsNum > 0 && typeof daysAgo === 'number' && daysAgo > 0 ? Math.floor(viewsNum / daysAgo) : 'N/A';
        return `${i+1}. "${v.title}" by ${v.channelTitle}
   ${viewsNum.toLocaleString()} views | ${likesNum.toLocaleString()} likes | ${commentsNum.toLocaleString()} comments | Engagement: ${engRate}%
   Published: ${daysAgo} days ago | Views/day: ${viewsPerDay} | Duration: ${v.duration || '?'}
   Tags: ${(v.tags || []).slice(0, 8).join(', ') || 'none'}
   Description snippet: ${(v.description || '').slice(0, 150)}`;
      }).join('\n\n')
      : 'No real-time YouTube data available.';

    // ========== AI Analysis ==========
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "set_intelligence_briefing",
            description: "Return structured intelligence briefing for script generation",
            parameters: {
              type: "object",
              properties: {
                competitive_analysis: {
                  type: "object",
                  properties: {
                    top_channels_analyzed: { type: "number" },
                    avg_views_range: { type: "string" },
                    dominant_styles: { type: "array", items: { type: "string" } },
                    common_hooks: { type: "array", items: { type: "string" } },
                    avg_video_duration: { type: "string" },
                    content_gaps: { type: "array", items: { type: "string" } },
                    what_works: { type: "array", items: { type: "string" } },
                    what_to_avoid: { type: "array", items: { type: "string" } },
                  },
                  required: ["top_channels_analyzed", "dominant_styles", "common_hooks", "what_works", "what_to_avoid"],
                },
                youtube_real_time_analysis: {
                  type: "object",
                  properties: {
                    videos_found: { type: "number" },
                    top_performing_video: { type: "string" },
                    avg_views: { type: "string" },
                    avg_engagement_rate: { type: "string" },
                    common_title_patterns: { type: "array", items: { type: "string" } },
                    successful_angles: { type: "array", items: { type: "string" } },
                    why_top_videos_work: { type: "array", items: { type: "string" } },
                    underexplored_angles: { type: "array", items: { type: "string" } },
                    optimal_duration: { type: "string" },
                    best_tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["videos_found", "common_title_patterns", "successful_angles", "why_top_videos_work", "underexplored_angles"],
                },
                recommended_hooks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      hook_text: { type: "string" },
                      hook_type: { type: "string" },
                      why_it_works: { type: "string" },
                      inspired_by: { type: "string" },
                    },
                    required: ["hook_text", "hook_type", "why_it_works"],
                  },
                },
                visual_blueprint: {
                  type: "object",
                  properties: {
                    recommended_style: { type: "string" },
                    color_palette: { type: "string" },
                    camera_techniques: { type: "array", items: { type: "string" } },
                    lighting_mood: { type: "string" },
                    reference_channels: { type: "array", items: { type: "string" } },
                    hook_visual_suggestion: { type: "string" },
                  },
                  required: ["recommended_style", "camera_techniques", "lighting_mood", "hook_visual_suggestion"],
                },
                retention_techniques: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      technique: { type: "string" },
                      when_to_use: { type: "string" },
                      example: { type: "string" },
                    },
                    required: ["technique", "when_to_use"],
                  },
                },
                topic_angle: {
                  type: "object",
                  properties: {
                    suggested_angle: { type: "string" },
                    differentiation: { type: "string" },
                    emotional_core: { type: "string" },
                    target_audience: { type: "string" },
                  },
                  required: ["suggested_angle", "differentiation", "emotional_core"],
                },
              },
              required: ["competitive_analysis", "youtube_real_time_analysis", "recommended_hooks", "visual_blueprint", "retention_techniques", "topic_angle"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_intelligence_briefing" } },
        messages: [
          {
            role: "system",
            content: `You are a YouTube VIRAL INTELLIGENCE ANALYST. You analyze real channel data, viral patterns, proven techniques, AND real-time YouTube search results to create a comprehensive intelligence briefing.

Your analysis must be DATA-DRIVEN — based on actual performance data provided below.

═══ REAL CHANNEL DATABASE (${topChannels.length} channels) ═══
${channelsBlock || 'No matching channels found.'}

═══ SCENE/VISUAL TECHNIQUES (${topSceneKnowledge.length} templates) ═══
${sceneBlock}

═══ SCRIPT RETENTION TECHNIQUES (${scriptKnowledgeRes.data?.length || 0} methods) ═══
${scriptBlock}

═══ YOUTUBE ALGORITHM KNOWLEDGE ═══
${ytBlock}

═══ REAL-TIME YOUTUBE SEARCH RESULTS (${(youtubeVideos as any[]).length} videos with SIMILAR TOPICS found NOW) ═══
${ytVideosBlock}

═══ WEB RESEARCH (Brave Search - ${(braveResults as any[]).length} results) ═══
${(braveResults as any[]).length > 0 
  ? (braveResults as any[]).map((r: any, i: number) => `${i + 1}. "${r.title}" — ${r.description || ''} (${r.url})`).join('\n')
  : 'No web results available'}

CRITICAL RULES:
- The REAL-TIME YOUTUBE section contains ACTUAL videos that exist RIGHT NOW on YouTube about this EXACT topic or similar topics
- Analyze WHY the top-performing videos succeeded: title patterns, hooks, angles, duration, engagement
- Identify what angles are SATURATED (many videos already cover) vs UNDEREXPLORED
- Recommend differentiation strategies based on what's already out there
- Extract the best title patterns and hooks from real successful videos
- Base visual suggestions on what dominates this niche visually
- Be specific, actionable, data-backed
- Language: ${language || 'português'}`
          },
          {
            role: "user",
            content: `Analyze this topic for a YouTube video:

TOPIC: "${topic}"
NICHE: ${niche || 'general'}
STYLE: ${style || 'cinematic'}
LANGUAGE: ${language || 'português'}

IMPORTANT: Analyze the real-time YouTube videos found about this topic. Why did the top ones succeed? What angles are already covered? What's the gap I can exploit? What hooks and title patterns work best for THIS specific topic?`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (response.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await response.text();
      console.error("analyze-topic error:", response.status, t);
      throw new Error("Intelligence analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const briefing = JSON.parse(toolCall.function.arguments);

    // ========== AUTO-ENRICH: Save discovered patterns back to DB ==========
    let enrichmentStats = { channelsSaved: 0, knowledgeSaved: 0 };
    try {
      await autoEnrichDatabase(sb, briefing, youtubeVideos as any[], topic, niche, style, enrichmentStats);
    } catch (err) {
      console.error("Auto-enrichment failed (non-critical):", err);
    }

    return new Response(JSON.stringify({
      briefing,
      metadata: {
        channelsAnalyzed: topChannels.length,
        sceneKnowledgeUsed: topSceneKnowledge.length,
        scriptTechniquesUsed: scriptKnowledgeRes.data?.length || 0,
        ytKnowledgeUsed: ytKnowledgeRes.data?.length || 0,
        youtubeVideosFound: (youtubeVideos as any[]).length,
        braveResultsFound: (braveResults as any[]).length,
        topChannelNames: topChannels.slice(0, 5).map((c: any) => c.channel_name),
        topYoutubeVideos: (youtubeVideos as any[]).slice(0, 5).map((v: any) => ({
          title: v.title,
          views: v.views,
          channelTitle: v.channelTitle,
          engagement: v.views > 0 ? (((parseInt(v.likes)||0) + (parseInt(v.comments)||0)) / parseInt(v.views) * 100).toFixed(1) + '%' : '0%',
        })),
        enrichment: enrichmentStats,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-topic error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

// ========== YouTube Data API real-time search ==========
async function searchYouTubeVideos(apiKey: string, topic: string, niche?: string): Promise<any[]> {
  try {
    const query = niche ? `${topic} ${niche}` : topic;
    // Search for videos sorted by view count
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=viewCount&maxResults=15&relevanceLanguage=pt&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      console.error("YouTube search failed:", searchRes.status);
      return [];
    }
    const searchData = await searchRes.json();
    const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    // Get detailed stats for each video
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    if (!statsRes.ok) return [];
    const statsData = await statsRes.json();

    return (statsData.items || []).map((v: any) => ({
      videoId: v.id,
      title: v.snippet?.title || '',
      channelTitle: v.snippet?.channelTitle || '',
      description: v.snippet?.description || '',
      publishedAt: v.snippet?.publishedAt || '',
      tags: v.snippet?.tags || [],
      views: v.statistics?.viewCount || '0',
      likes: v.statistics?.likeCount || '0',
      comments: v.statistics?.commentCount || '0',
      duration: v.contentDetails?.duration || '',
    }));
  } catch (err) {
    console.error("YouTube search error:", err);
    return [];
  }
}

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ========== Auto-enrich: save discovered patterns to DB ==========
async function autoEnrichDatabase(
  sb: any, briefing: any, youtubeVideos: any[],
  topic: string, niche: string | undefined, style: string | undefined,
  stats: { channelsSaved: number; knowledgeSaved: number }
) {
  // 1. Save high-performing YouTube channels not yet in channel_intelligence
  const highPerformers = youtubeVideos.filter(v => parseInt(v.views) > 100000);
  if (highPerformers.length > 0) {
    const channelNames = [...new Set(highPerformers.map(v => v.channelTitle))];
    for (const chName of channelNames.slice(0, 5)) {
      // Check if already exists
      const { data: existing } = await sb.from("channel_intelligence")
        .select("id")
        .eq("channel_name", chName)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const chVideos = highPerformers.filter(v => v.channelTitle === chName);
      const avgViews = Math.floor(chVideos.reduce((s: number, v: any) => s + parseInt(v.views), 0) / chVideos.length);
      const topTags = chVideos.flatMap((v: any) => v.tags || []).slice(0, 10);
      const hooks = briefing.recommended_hooks?.slice(0, 3).map((h: any) => h.hook_text) || [];

      await sb.from("channel_intelligence").insert({
        channel_name: chName,
        niche: niche || 'geral',
        style: style || 'cinematic',
        avg_views: avgViews,
        subscribers: 0,
        growth_rate: avgViews > 1000000 ? 'rapid' : avgViews > 500000 ? 'steady' : 'moderate',
        viral_patterns: { hooks, tags: topTags, discovered_via: 'auto-enrich', topic_searched: topic },
        top_videos: chVideos.slice(0, 5).map((v: any) => ({ title: v.title, views: parseInt(v.views) })),
        visual_style_notes: briefing.visual_blueprint?.recommended_style || null,
        is_faceless: true,
        is_monetized: true,
      });
      stats.channelsSaved++;
    }
  }

  // 2. Save successful visual/hook patterns as scene_prompt_knowledge
  const ytAnalysis = briefing.youtube_real_time_analysis;
  if (ytAnalysis?.why_top_videos_work?.length > 0) {
    // Create a knowledge entry from the discovered patterns
    const successPatterns = ytAnalysis.why_top_videos_work.join('. ');
    const angles = (ytAnalysis.successful_angles || []).join(', ');
    const titlePatterns = (ytAnalysis.common_title_patterns || []).join('; ');

    // Check if we already have a similar entry (by topic)
    const { data: existingKnowledge } = await sb.from("scene_prompt_knowledge")
      .select("id")
      .eq("category", `auto-discovered-${(niche || 'general').toLowerCase()}`)
      .limit(5);

    // Only add if we don't have too many auto-discovered entries for this niche
    if (!existingKnowledge || existingKnowledge.length < 10) {
      await sb.from("scene_prompt_knowledge").insert({
        category: `auto-discovered-${(niche || 'general').toLowerCase()}`,
        title: `Viral patterns: ${topic.slice(0, 50)}`,
        prompt_template: `Based on analysis of ${youtubeVideos.length} real YouTube videos about "${topic}": SUCCESS FACTORS: ${successPatterns}. WINNING ANGLES: ${angles}. TITLE PATTERNS: ${titlePatterns}. VISUAL STYLE: ${briefing.visual_blueprint?.recommended_style || 'cinematic'}. LIGHTING: ${briefing.visual_blueprint?.lighting_mood || 'dramatic'}. Apply these patterns to generate visually magnetic scenes.`,
        tags: JSON.stringify([niche || 'general', style || 'cinematic', 'auto-discovered', 'viral-pattern']),
        viral_score: 8,
      });
      stats.knowledgeSaved++;
    }
  }

  // 3. Save hook patterns to script_knowledge if novel
  if (briefing.recommended_hooks?.length >= 2) {
    const { data: existingScriptK } = await sb.from("script_knowledge")
      .select("id")
      .eq("category", `auto-discovered-hooks`)
      .limit(20);

    if (!existingScriptK || existingScriptK.length < 30) {
      const hooksContent = briefing.recommended_hooks.map((h: any) =>
        `[${h.hook_type}] "${h.hook_text}" — ${h.why_it_works}${h.inspired_by ? ` (inspired by: ${h.inspired_by})` : ''}`
      ).join('\n');

      await sb.from("script_knowledge").insert({
        category: 'auto-discovered-hooks',
        title: `Hooks: ${(niche || topic).slice(0, 40)} (${new Date().toISOString().slice(0, 10)})`,
        content: `Hooks discovered from analyzing ${youtubeVideos.length} videos about "${topic}" in ${niche || 'general'} niche:\n${hooksContent}\n\nContent gaps identified: ${(briefing.competitive_analysis?.content_gaps || []).join('; ')}`,
        examples: JSON.stringify(briefing.recommended_hooks.map((h: any) => h.hook_text)),
        effectiveness_score: 8,
      });
      stats.knowledgeSaved++;
    }
  }
}
