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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!topic?.trim()) throw new Error("Topic is required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nicheLC = (niche || '').toLowerCase();
    const styleLC = (style || '').toLowerCase();
    const topicLC = topic.toLowerCase();

    // ========== Parallel DB queries ==========
    const [channelsRes, sceneKnowledgeRes, scriptKnowledgeRes, ytKnowledgeRes] = await Promise.all([
      // Channels matching niche — top 10 by views
      sb.from("channel_intelligence")
        .select("channel_name,style,niche,avg_views,subscribers,growth_rate,viral_patterns,top_videos,visual_style_notes,upload_frequency,rpm_estimate")
        .order("avg_views", { ascending: false })
        .limit(200),
      // Scene prompt knowledge
      sb.from("scene_prompt_knowledge")
        .select("category,title,prompt_template,tags,viral_score")
        .order("viral_score", { ascending: false })
        .limit(100),
      // Script knowledge
      sb.from("script_knowledge")
        .select("category,title,content,examples,effectiveness_score")
        .order("effectiveness_score", { ascending: false })
        .limit(50),
      // YouTube algorithm knowledge
      sb.from("youtube_knowledge")
        .select("category,title,content,priority")
        .order("priority", { ascending: false })
        .limit(20),
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
      // Topic keyword matching
      const topicWords = topicLC.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of topicWords) {
        if (chNiche.includes(word)) score += 5;
        if (chName.includes(word)) score += 3;
      }
      // Boost high-performance channels
      if (ch.avg_views > 1000000) score += 5;
      if (ch.growth_rate === 'explosive' || ch.growth_rate === 'rapid') score += 3;
      return { ...ch, relevanceScore: score };
    });
    scoredChannels.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    const topChannels = scoredChannels.slice(0, 10);

    // ========== Filter scene knowledge by style/niche ==========
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

    // ========== Format data for AI analysis ==========
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

    // ========== AI Analysis with Gemini Flash ==========
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
              required: ["competitive_analysis", "recommended_hooks", "visual_blueprint", "retention_techniques", "topic_angle"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_intelligence_briefing" } },
        messages: [
          {
            role: "system",
            content: `You are a YouTube VIRAL INTELLIGENCE ANALYST. You analyze real channel data, viral patterns, and proven techniques to create an intelligence briefing that will guide script and visual generation.

Your analysis must be DATA-DRIVEN — based on the actual channel performance data, viral patterns, and proven techniques provided below.

═══ REAL CHANNEL DATA (${topChannels.length} channels analyzed) ═══
${channelsBlock || 'No matching channels found — use general best practices.'}

═══ SCENE/VISUAL TECHNIQUES (${topSceneKnowledge.length} proven templates) ═══
${sceneBlock}

═══ SCRIPT RETENTION TECHNIQUES (${scriptKnowledgeRes.data?.length || 0} proven methods) ═══
${scriptBlock}

═══ YOUTUBE ALGORITHM KNOWLEDGE ═══
${ytBlock}

RULES:
- Base ALL recommendations on the REAL data above
- Hooks must be inspired by what actually works in this niche
- Visual suggestions must match the niche's proven visual style
- Identify content GAPS — topics the top channels haven't covered yet
- Be specific, actionable, and data-backed
- Language: ${language || 'português'}`
          },
          {
            role: "user",
            content: `Analyze this topic for a YouTube video:

TOPIC: "${topic}"
NICHE: ${niche || 'general'}
STYLE: ${style || 'cinematic'}
LANGUAGE: ${language || 'português'}

Create a detailed intelligence briefing based on the real channel data and viral patterns above. What works? What to avoid? What hooks are proven? What visual style dominates? Where are the content gaps?`
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

    return new Response(JSON.stringify({
      briefing,
      metadata: {
        channelsAnalyzed: topChannels.length,
        sceneKnowledgeUsed: topSceneKnowledge.length,
        scriptTechniquesUsed: scriptKnowledgeRes.data?.length || 0,
        ytKnowledgeUsed: ytKnowledgeRes.data?.length || 0,
        topChannelNames: topChannels.slice(0, 5).map((c: any) => c.channel_name),
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-topic error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
