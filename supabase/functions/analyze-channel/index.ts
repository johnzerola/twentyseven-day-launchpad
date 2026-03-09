import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelInput } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Extract channel ID from URL or use as-is
    let channelId = channelInput.trim();
    const urlMatch = channelInput.match(/youtube\.com\/(channel\/|c\/|@)([^\/\?]+)/);
    if (urlMatch) {
      const identifier = urlMatch[2];
      if (urlMatch[1] === "channel/") {
        channelId = identifier;
      } else {
        // Handle @username or /c/ name - search for channel
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(identifier)}&maxResults=1&key=${YOUTUBE_API_KEY}`
        );
        const searchData = await searchRes.json();
        if (searchData.items?.[0]) {
          channelId = searchData.items[0].snippet.channelId;
        }
      }
    } else if (channelInput.startsWith("@")) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelInput)}&maxResults=1&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      if (searchData.items?.[0]) {
        channelId = searchData.items[0].snippet.channelId;
      }
    }

    // Get channel stats
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );
    const channelData = await channelRes.json();
    if (!channelData.items?.length) {
      return new Response(JSON.stringify({ error: "Canal não encontrado. Verifique a URL ou ID." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channel = channelData.items[0];
    const stats = channel.statistics;
    const snippet = channel.snippet;

    // Get recent videos (last 20)
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=20&type=video&key=${YOUTUBE_API_KEY}`
    );
    const videosData = await videosRes.json();
    const videoIds = videosData.items?.map((v: any) => v.id.videoId).filter(Boolean).join(",");

    let videoStats: any[] = [];
    if (videoIds) {
      const vStatsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      );
      const vStatsData = await vStatsRes.json();
      videoStats = vStatsData.items || [];
    }

    // Get top videos by views
    const topVideosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=10&type=video&key=${YOUTUBE_API_KEY}`
    );
    const topVideosData = await topVideosRes.json();
    const topVideoIds = topVideosData.items?.map((v: any) => v.id.videoId).filter(Boolean).join(",");
    
    let topVideoStats: any[] = [];
    if (topVideoIds) {
      const tvRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${topVideoIds}&key=${YOUTUBE_API_KEY}`
      );
      const tvData = await tvRes.json();
      topVideoStats = tvData.items || [];
    }

    // Prepare data for AI analysis
    const channelSummary = {
      name: snippet.title,
      description: snippet.description,
      subscribers: parseInt(stats.subscriberCount || "0"),
      totalViews: parseInt(stats.viewCount || "0"),
      videoCount: parseInt(stats.videoCount || "0"),
      thumbnail: snippet.thumbnails?.medium?.url,
      country: snippet.country || "Unknown",
      createdAt: snippet.publishedAt,
      recentVideos: videoStats.map((v: any) => ({
        title: v.snippet.title,
        views: parseInt(v.statistics?.viewCount || "0"),
        likes: parseInt(v.statistics?.likeCount || "0"),
        comments: parseInt(v.statistics?.commentCount || "0"),
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails?.duration,
      })),
      topVideos: topVideoStats.map((v: any) => ({
        title: v.snippet.title,
        views: parseInt(v.statistics?.viewCount || "0"),
        likes: parseInt(v.statistics?.likeCount || "0"),
      })),
    };

    const avgViews = channelSummary.recentVideos.length > 0
      ? channelSummary.recentVideos.reduce((sum: number, v: any) => sum + v.views, 0) / channelSummary.recentVideos.length
      : 0;

    // Call Lovable AI for analysis
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é uma equipe de 3 especialistas analisando um canal do YouTube:
1. CEO YouTube Expert: 10+ anos de experiência, 500+ canais monetizados, expert em algoritmo 2025/2026
2. Engenheiro de Software Sênior: especialista em dados e métricas
3. Roteirista Veterano: ex-MrBeast/Disney, CTR 30%+, retenção 80%+

Analise os dados do canal e retorne uma análise completa em JSON com esta estrutura EXATA:
{
  "seo_score": number (0-100),
  "title_quality_score": number (0-100),
  "niche_detected": "string",
  "niche_fit_score": number (0-100),
  "strengths": ["string"],
  "weaknesses": ["string"],
  "seo_improvements": ["string"],
  "title_improvements": ["string"],
  "thumbnail_suggestions": ["string"],
  "niche_change_suggestions": [{"niche": "string", "reason": "string", "audience_retention_estimate": "string"}],
  "monetization_readiness": number (0-100),
  "estimated_rpm": number,
  "estimated_monthly_revenue": "string",
  "upload_frequency_recommendation": "string",
  "content_strategy": "string",
  "competitor_insights": "string",
  "growth_potential": "string"
}

Seja MUITO específico e prático. Use dados reais do canal.`
          },
          {
            role: "user",
            content: `Analise este canal do YouTube:\n\n${JSON.stringify(channelSummary, null, 2)}\n\nMédia de views recentes: ${Math.round(avgViews)}\n\nRetorne APENAS o JSON, sem markdown.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "channel_analysis",
            description: "Return structured channel analysis",
            parameters: {
              type: "object",
              properties: {
                seo_score: { type: "number" },
                title_quality_score: { type: "number" },
                niche_detected: { type: "string" },
                niche_fit_score: { type: "number" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                seo_improvements: { type: "array", items: { type: "string" } },
                title_improvements: { type: "array", items: { type: "string" } },
                thumbnail_suggestions: { type: "array", items: { type: "string" } },
                niche_change_suggestions: { type: "array", items: { type: "object", properties: { niche: { type: "string" }, reason: { type: "string" }, audience_retention_estimate: { type: "string" } }, required: ["niche", "reason", "audience_retention_estimate"] } },
                monetization_readiness: { type: "number" },
                estimated_rpm: { type: "number" },
                estimated_monthly_revenue: { type: "string" },
                upload_frequency_recommendation: { type: "string" },
                content_strategy: { type: "string" },
                competitor_insights: { type: "string" },
                growth_potential: { type: "string" }
              },
              required: ["seo_score", "title_quality_score", "niche_detected", "strengths", "weaknesses", "seo_improvements", "content_strategy"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "channel_analysis" } }
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiRes.json();
    let analysis;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      // Fallback: try parsing content directly
      const content = aiData.choices?.[0]?.message?.content || "";
      analysis = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    }

    return new Response(JSON.stringify({
      channel: {
        id: channelId,
        name: snippet.title,
        thumbnail: snippet.thumbnails?.medium?.url,
        subscribers: parseInt(stats.subscriberCount || "0"),
        views: parseInt(stats.viewCount || "0"),
        videos: parseInt(stats.videoCount || "0"),
        country: snippet.country,
        createdAt: snippet.publishedAt,
      },
      analysis,
      recentVideos: channelSummary.recentVideos.slice(0, 5),
      topVideos: channelSummary.topVideos.slice(0, 5),
      avgRecentViews: Math.round(avgViews),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-channel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
