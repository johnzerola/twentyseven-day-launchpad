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
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(identifier)}&maxResults=1&key=${YOUTUBE_API_KEY}`
        );
        const searchData = await searchRes.json();
        if (searchData.items?.[0]) channelId = searchData.items[0].snippet.channelId;
      }
    } else if (channelInput.startsWith("@")) {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelInput)}&maxResults=1&key=${YOUTUBE_API_KEY}`
      );
      const searchData = await searchRes.json();
      if (searchData.items?.[0]) channelId = searchData.items[0].snippet.channelId;
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
    const subscribers = parseInt(stats.subscriberCount || "0");
    const totalViews = parseInt(stats.viewCount || "0");
    const videoCount = parseInt(stats.videoCount || "0");

    // Get recent videos (last 30)
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=30&type=video&key=${YOUTUBE_API_KEY}`
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
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${topVideoIds}&key=${YOUTUBE_API_KEY}`
      );
      const tvData = await tvRes.json();
      topVideoStats = tvData.items || [];
    }

    // ========== COMPUTE REAL METRICS ==========
    const recentVideos = videoStats.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const comments = parseInt(v.statistics?.commentCount || "0");
      const duration = v.contentDetails?.duration || "";
      // Parse ISO 8601 duration
      const dMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const durationSec = dMatch ? (parseInt(dMatch[1] || "0") * 3600 + parseInt(dMatch[2] || "0") * 60 + parseInt(dMatch[3] || "0")) : 0;
      return {
        title: v.snippet.title,
        views,
        likes,
        comments,
        publishedAt: v.snippet.publishedAt,
        duration,
        durationSeconds: durationSec,
        engagement_rate: views > 0 ? ((likes + comments) / views * 100) : 0,
        like_rate: views > 0 ? (likes / views * 100) : 0,
        comment_rate: views > 0 ? (comments / views * 100) : 0,
        sub_watch_ratio: subscribers > 0 ? (views / subscribers * 100) : 0,
      };
    });

    const topVideos = topVideoStats.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || "0");
      const likes = parseInt(v.statistics?.likeCount || "0");
      const comments = parseInt(v.statistics?.commentCount || "0");
      const dMatch = (v.contentDetails?.duration || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const durationSec = dMatch ? (parseInt(dMatch[1] || "0") * 3600 + parseInt(dMatch[2] || "0") * 60 + parseInt(dMatch[3] || "0")) : 0;
      return {
        title: v.snippet.title,
        views,
        likes,
        comments,
        durationSeconds: durationSec,
        engagement_rate: views > 0 ? ((likes + comments) / views * 100) : 0,
        sub_watch_ratio: subscribers > 0 ? (views / subscribers * 100) : 0,
      };
    });

    const avgViews = recentVideos.length > 0
      ? recentVideos.reduce((sum: number, v: any) => sum + v.views, 0) / recentVideos.length
      : 0;

    // Subscriber watch ratio: what % of subs watch each video on average
    const sub_watch_ratio = subscribers > 0 ? (avgViews / subscribers * 100) : 0;

    // Engagement metrics
    const totalLikes = recentVideos.reduce((s: number, v: any) => s + v.likes, 0);
    const totalComments = recentVideos.reduce((s: number, v: any) => s + v.comments, 0);
    const totalRecentViews = recentVideos.reduce((s: number, v: any) => s + v.views, 0);
    const avg_engagement_rate = totalRecentViews > 0 ? ((totalLikes + totalComments) / totalRecentViews * 100) : 0;
    const avg_like_rate = totalRecentViews > 0 ? (totalLikes / totalRecentViews * 100) : 0;
    const avg_comment_rate = totalRecentViews > 0 ? (totalComments / totalRecentViews * 100) : 0;

    // Upload consistency: avg days between uploads
    const dates = recentVideos
      .map((v: any) => new Date(v.publishedAt).getTime())
      .sort((a: number, b: number) => b - a);
    let avg_days_between_uploads = 0;
    if (dates.length >= 2) {
      const diffs = [];
      for (let i = 0; i < dates.length - 1; i++) {
        diffs.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
      }
      avg_days_between_uploads = Math.round(diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length);
    }

    // Average video duration
    const durations = recentVideos.filter((v: any) => v.durationSeconds > 0).map((v: any) => v.durationSeconds);
    const avg_duration_seconds = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;

    // Views per video overall
    const views_per_video = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;

    // Best performing time patterns
    const dayOfWeek = recentVideos.map((v: any) => {
      const d = new Date(v.publishedAt);
      return { day: d.getUTCDay(), views: v.views };
    });
    const dayAgg: Record<number, { total: number; count: number }> = {};
    dayOfWeek.forEach((d: any) => {
      if (!dayAgg[d.day]) dayAgg[d.day] = { total: 0, count: 0 };
      dayAgg[d.day].total += d.views;
      dayAgg[d.day].count++;
    });
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const best_upload_day = Object.entries(dayAgg)
      .map(([day, data]) => ({ day: dayNames[parseInt(day)], avg: Math.round(data.total / data.count) }))
      .sort((a, b) => b.avg - a.avg)[0]?.day || 'N/A';

    // Outlier detection: videos with 3x+ avg views
    const outlier_videos = recentVideos.filter((v: any) => avgViews > 0 && v.views >= avgViews * 3);
    const underperforming_videos = recentVideos.filter((v: any) => avgViews > 0 && v.views < avgViews * 0.3);

    const realMetrics = {
      sub_watch_ratio: Math.round(sub_watch_ratio * 100) / 100,
      avg_engagement_rate: Math.round(avg_engagement_rate * 1000) / 1000,
      avg_like_rate: Math.round(avg_like_rate * 1000) / 1000,
      avg_comment_rate: Math.round(avg_comment_rate * 1000) / 1000,
      avg_days_between_uploads,
      avg_duration_seconds,
      views_per_video,
      best_upload_day,
      outlier_count: outlier_videos.length,
      underperforming_count: underperforming_videos.length,
      total_recent_videos: recentVideos.length,
      avg_views: Math.round(avgViews),
      // Health indicators
      consistency_score: avg_days_between_uploads <= 3 ? 'excelente' : avg_days_between_uploads <= 7 ? 'bom' : avg_days_between_uploads <= 14 ? 'regular' : 'fraco',
      engagement_health: avg_engagement_rate >= 8 ? 'excelente' : avg_engagement_rate >= 4 ? 'bom' : avg_engagement_rate >= 2 ? 'regular' : 'fraco',
      sub_loyalty: sub_watch_ratio >= 30 ? 'alta' : sub_watch_ratio >= 15 ? 'média' : sub_watch_ratio >= 5 ? 'baixa' : 'muito_baixa',
    };

    // Prepare data for AI analysis
    const channelSummary = {
      name: snippet.title,
      description: snippet.description,
      subscribers,
      totalViews,
      videoCount,
      thumbnail: snippet.thumbnails?.medium?.url,
      country: snippet.country || "Unknown",
      createdAt: snippet.publishedAt,
      realMetrics,
      recentVideos: recentVideos.slice(0, 15),
      topVideos: topVideos.slice(0, 10),
    };

    // Call Lovable AI for analysis
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é uma equipe de 3 especialistas analisando um canal do YouTube com MÉTRICAS REAIS:
1. CEO YouTube Expert: 10+ anos de experiência, 500+ canais monetizados, expert em algoritmo 2025/2026
2. Engenheiro de Dados: especialista em métricas de engajamento e retenção
3. Roteirista Veterano: ex-MrBeast/Disney, CTR 30%+, retenção 80%+

MÉTRICAS REAIS DISPONÍVEIS - use-as na análise:
- sub_watch_ratio: % dos inscritos que assistem cada vídeo em média
- avg_engagement_rate: taxa de engajamento (likes+comments/views)
- avg_comment_rate: taxa de comentários
- consistency_score: frequência de uploads
- outlier_count: vídeos que performaram 3x+ acima da média

Analise os dados e retorne JSON com esta estrutura EXATA:
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
  "growth_potential": "string",
  "engagement_diagnosis": "string — análise detalhada do engajamento real",
  "subscriber_loyalty_analysis": "string — análise da lealdade dos inscritos baseada em sub_watch_ratio",
  "best_content_type": "string — tipo de conteúdo que performa melhor baseado nos dados",
  "recommended_video_length": "string — duração ideal baseada nos dados reais",
  "viral_potential_topics": ["string — 5 tópicos com alto potencial baseados nos outliers do canal"]
}

Seja MUITO específico e prático. Use os DADOS REAIS do canal.`
          },
          {
            role: "user",
            content: `Analise este canal do YouTube com métricas reais:\n\n${JSON.stringify(channelSummary, null, 2)}\n\nRetorne APENAS o JSON, sem markdown.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "channel_analysis",
            description: "Return structured channel analysis with real metrics",
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
                growth_potential: { type: "string" },
                engagement_diagnosis: { type: "string" },
                subscriber_loyalty_analysis: { type: "string" },
                best_content_type: { type: "string" },
                recommended_video_length: { type: "string" },
                viral_potential_topics: { type: "array", items: { type: "string" } },
              },
              required: ["seo_score", "title_quality_score", "niche_detected", "strengths", "weaknesses", "seo_improvements", "content_strategy", "engagement_diagnosis", "subscriber_loyalty_analysis"],
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
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
      const content = aiData.choices?.[0]?.message?.content || "";
      analysis = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    }

    return new Response(JSON.stringify({
      channel: {
        id: channelId,
        name: snippet.title,
        thumbnail: snippet.thumbnails?.medium?.url,
        subscribers,
        views: totalViews,
        videos: videoCount,
        country: snippet.country,
        createdAt: snippet.publishedAt,
      },
      analysis,
      realMetrics,
      recentVideos: recentVideos.slice(0, 10),
      topVideos: topVideos.slice(0, 10),
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
