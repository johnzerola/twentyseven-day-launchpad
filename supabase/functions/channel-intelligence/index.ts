import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated to Gemini Direct via _shared/gemini-direct.ts

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelInput } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // ========== 1. RESOLVE CHANNEL ID ==========
    let channelId = channelInput.trim();
    const urlMatch = channelInput.match(/youtube\.com\/(channel\/|c\/|@)([^\/\?\#\s]+)/);
    if (urlMatch) {
      if (urlMatch[1] === "channel/") {
        channelId = urlMatch[2];
      } else {
        // Use channels.list with forHandle for @ handles (doesn't count as search quota)
        const handle = urlMatch[2];
        const handleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`);
        const handleData = await handleRes.json();
        if (handleData.error?.errors?.[0]?.reason === "quotaExceeded") {
          return new Response(JSON.stringify({ error: "Quota da YouTube API esgotada. Tente novamente amanhã ou reduza o uso." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (handleData.items?.[0]) {
          channelId = handleData.items[0].id;
        } else {
          // Fallback: try search
          const sr = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`);
          const sd = await sr.json();
          if (sd.error?.errors?.[0]?.reason === "quotaExceeded") {
            return new Response(JSON.stringify({ error: "Quota da YouTube API esgotada. Tente novamente amanhã." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (sd.items?.[0]) channelId = sd.items[0].snippet.channelId;
        }
      }
    } else if (channelInput.startsWith("@")) {
      const handle = channelInput.replace("@", "");
      const handleRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`);
      const handleData = await handleRes.json();
      if (handleData.error?.errors?.[0]?.reason === "quotaExceeded") {
        return new Response(JSON.stringify({ error: "Quota da YouTube API esgotada. Tente novamente amanhã." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (handleData.items?.[0]) channelId = handleData.items[0].id;
    }

    // ========== 2. FETCH CHANNEL + VIDEOS IN PARALLEL ==========
    const [channelRes, recentRes, topRes] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,topicDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`),
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=30&type=video&key=${YOUTUBE_API_KEY}`),
      fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=15&type=video&key=${YOUTUBE_API_KEY}`),
    ]);

    const [channelData, recentData, topData] = await Promise.all([channelRes.json(), recentRes.json(), topRes.json()]);
    
    // Check for quota exceeded in channel fetch
    if (channelData.error?.errors?.[0]?.reason === "quotaExceeded" || recentData.error?.errors?.[0]?.reason === "quotaExceeded") {
      return new Response(JSON.stringify({ error: "Quota da YouTube API esgotada. Tente novamente amanhã." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const channel = channelData.items?.[0];
    if (!channel) {
      return new Response(JSON.stringify({ error: "Canal não encontrado. Verifique a URL ou ID do canal." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stats = channel.statistics;
    const snippet = channel.snippet;
    const subs = parseInt(stats.subscriberCount || '0');
    const totalViews = parseInt(stats.viewCount || '0');
    const videoCount = parseInt(stats.videoCount || '0');

    // Get detailed stats for recent + top videos
    const allVideoIds = [...new Set([
      ...(recentData.items || []).map((v: any) => v.id?.videoId).filter(Boolean),
      ...(topData.items || []).map((v: any) => v.id?.videoId).filter(Boolean),
    ])];

    let allVideos: any[] = [];
    if (allVideoIds.length) {
      // Batch in chunks of 50
      for (let i = 0; i < allVideoIds.length; i += 50) {
        const batch = allVideoIds.slice(i, i + 50).join(",");
        const vr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch}&key=${YOUTUBE_API_KEY}`);
        const vd = await vr.json();
        allVideos.push(...(vd.items || []));
      }
    }

    // ========== 3. CALCULATE METRICS ==========
    const videoMetrics = allVideos.map((v: any) => {
      const views = parseInt(v.statistics?.viewCount || '0');
      const likes = parseInt(v.statistics?.likeCount || '0');
      const comments = parseInt(v.statistics?.commentCount || '0');
      const dur = v.contentDetails?.duration || '';
      const durMatch = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const seconds = durMatch ? (parseInt(durMatch[1]||'0')*3600 + parseInt(durMatch[2]||'0')*60 + parseInt(durMatch[3]||'0')) : 0;
      return {
        id: v.id,
        title: v.snippet.title,
        views, likes, comments,
        publishedAt: v.snippet.publishedAt,
        duration: dur,
        durationSeconds: seconds,
        engagementRate: views > 0 ? ((likes + comments) / views * 100) : 0,
        tags: (v.snippet.tags || []).slice(0, 10),
      };
    });

    const avgViews = videoMetrics.length > 0 ? videoMetrics.reduce((s, v) => s + v.views, 0) / videoMetrics.length : 0;
    const medianViews = videoMetrics.length > 0 ? [...videoMetrics].sort((a, b) => a.views - b.views)[Math.floor(videoMetrics.length / 2)].views : 0;

    // Detect outliers (>3x avg) and super outliers (>10x avg)
    const outliers = videoMetrics.filter(v => v.views > avgViews * 3).sort((a, b) => b.views - a.views);
    const superOutliers = videoMetrics.filter(v => v.views > avgViews * 10);

    // Content format detection
    const shortVideos = videoMetrics.filter(v => v.durationSeconds > 0 && v.durationSeconds < 120);
    const midVideos = videoMetrics.filter(v => v.durationSeconds >= 120 && v.durationSeconds < 480);
    const longVideos = videoMetrics.filter(v => v.durationSeconds >= 480);

    // Upload frequency
    const dates = videoMetrics.map(v => new Date(v.publishedAt).getTime()).filter(Boolean).sort((a, b) => b - a);
    let avgDaysBetween = 0;
    if (dates.length >= 2) {
      const diffs = [];
      for (let i = 0; i < dates.length - 1; i++) diffs.push((dates[i] - dates[i + 1]) / 86400000);
      avgDaysBetween = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    }

    // ========== 4. FETCH KNOWLEDGE FROM DB ==========
    const [ytKnowledgeRes, nicheDbRes, viralTitlesRes, blueprintsRes, psychRes] = await Promise.all([
      sb.from("youtube_knowledge").select("title,content,category").order("priority", { ascending: false }).limit(8),
      sb.from("niche_database").select("name,rpm_estimate,difficulty,saturation,faceless_friendly").limit(50),
      sb.from("viral_titles_db").select("title,views,niche,title_pattern,why_viral").order("views", { ascending: false }).limit(20),
      sb.from("video_blueprints").select("video_title,views,niche,hook_type,visual_style,scores").order("views", { ascending: false }).limit(10),
      sb.from("audience_psychology_patterns").select("trigger_type,description,retention_score").order("retention_score", { ascending: false }).limit(8),
    ]);

    const knowledgeContext = (ytKnowledgeRes.data || []).map((r: any) => `[${r.category}] ${r.title}: ${r.content?.slice(0, 200)}`).join("\n");
    const nicheData = (nicheDbRes.data || []).map((r: any) => `${r.name}: RPM=$${r.rpm_estimate}, difficulty=${r.difficulty}, saturation=${r.saturation}, faceless=${r.faceless_friendly}`).join("\n");
    const viralRef = (viralTitlesRes.data || []).map((r: any) => `"${r.title}" (${fmt(r.views)} views, ${r.niche}) — Pattern: ${r.title_pattern || '?'}`).join("\n");
    const blueprintRef = (blueprintsRes.data || []).map((r: any) => `"${r.video_title}" (${fmt(r.views)} views) — Hook: ${r.hook_type}, Style: ${r.visual_style}, Scores: ${JSON.stringify(r.scores)}`).join("\n");
    const psychRef = (psychRes.data || []).map((r: any) => `• ${r.trigger_type}: ${r.description?.slice(0, 150)} (score: ${r.retention_score})`).join("\n");

    // ========== 5. AI ANALYSIS WITH FULL CONTEXT ==========
    const channelSummary = `
CANAL: "${snippet.title}"
Inscritos: ${fmt(subs)} | Views totais: ${fmt(totalViews)} | Vídeos: ${videoCount}
País: ${snippet.country || 'N/A'} | Criado: ${snippet.publishedAt}
Descrição: ${snippet.description?.slice(0, 300)}

MÉTRICAS:
- Média de views: ${fmt(Math.round(avgViews))} | Mediana: ${fmt(medianViews)}
- Outliers (>3x média): ${outliers.length} vídeos
- Super outliers (>10x média): ${superOutliers.length} vídeos
- Upload frequency: 1 vídeo a cada ${avgDaysBetween.toFixed(1)} dias
- Shorts (<2min): ${shortVideos.length} | Mid (2-8min): ${midVideos.length} | Long (>8min): ${longVideos.length}

TOP 10 VÍDEOS:
${videoMetrics.sort((a, b) => b.views - a.views).slice(0, 10).map((v, i) => `${i + 1}. "${v.title}" — ${fmt(v.views)} views, ${v.engagementRate.toFixed(1)}% engagement, ${v.durationSeconds}s`).join("\n")}

OUTLIERS:
${outliers.slice(0, 5).map(v => `🔥 "${v.title}" — ${fmt(v.views)} views (${(v.views / avgViews).toFixed(1)}x média)`).join("\n") || "Nenhum outlier detectado"}

ÚLTIMOS 10 VÍDEOS:
${videoMetrics.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 10).map(v => `• "${v.title}" — ${fmt(v.views)} views, ${v.engagementRate.toFixed(1)}% eng`).join("\n")}
`;

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o CEO de uma agência de YouTube com 25 anos de experiência e 1000+ canais monetizados. Analise este canal com base em dados REAIS e na base de conhecimento interna.

🧠 BASE DE CONHECIMENTO YOUTUBE 2026:
${knowledgeContext}

📊 BANCO DE NICHOS (RPM, dificuldade, saturação):
${nicheData}

🔥 TÍTULOS VIRAIS DE REFERÊNCIA:
${viralRef}

🎬 BLUEPRINTS DE VÍDEOS VIRAIS:
${blueprintRef}

🧪 PADRÕES PSICOLÓGICOS:
${psychRef}

USE esta base para fazer recomendações ESPECÍFICAS e ACIONÁVEIS. Compare o canal com os padrões de sucesso da base.`
          },
          {
            role: "user",
            content: `ANÁLISE COMPLETA DO CANAL:\n${channelSummary}\n\nGere a análise mais completa e acionável possível. Compare com padrões virais da base de conhecimento.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "channel_intelligence_report",
            description: "Complete channel intelligence report with growth strategy",
            parameters: {
              type: "object",
              properties: {
                channelScore: {
                  type: "object",
                  properties: {
                    overall: { type: "number", description: "0-100 overall score" },
                    content: { type: "number" },
                    seo: { type: "number" },
                    engagement: { type: "number" },
                    monetization: { type: "number" },
                    consistency: { type: "number" },
                    growth: { type: "number" },
                  },
                  required: ["overall", "content", "seo", "engagement", "monetization", "consistency", "growth"],
                  additionalProperties: false,
                },
                nicheAnalysis: {
                  type: "object",
                  properties: {
                    detectedNiche: { type: "string" },
                    detectedSubNiche: { type: "string" },
                    nicheFit: { type: "number", description: "0-100 how well content fits niche" },
                    estimatedRPM: { type: "number" },
                    saturation: { type: "string", enum: ["low", "medium", "high", "very_high"] },
                    facelessFriendly: { type: "boolean" },
                    betterNiches: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          niche: { type: "string" },
                          reason: { type: "string" },
                          estimatedRPM: { type: "number" },
                          difficulty: { type: "string" },
                        },
                        required: ["niche", "reason", "estimatedRPM", "difficulty"],
                        additionalProperties: false,
                      }
                    },
                  },
                  required: ["detectedNiche", "detectedSubNiche", "nicheFit", "estimatedRPM", "saturation", "facelessFriendly", "betterNiches"],
                  additionalProperties: false,
                },
                contentFormat: {
                  type: "object",
                  properties: {
                    primaryFormat: { type: "string" },
                    secondaryFormats: { type: "array", items: { type: "string" } },
                    bestPerformingFormat: { type: "string" },
                    recommendedFormats: { type: "array", items: { type: "string" } },
                    optimalDuration: { type: "string" },
                    storytellingStyle: { type: "string" },
                  },
                  required: ["primaryFormat", "secondaryFormats", "bestPerformingFormat", "recommendedFormats", "optimalDuration", "storytellingStyle"],
                  additionalProperties: false,
                },
                outlierAnalysis: {
                  type: "object",
                  properties: {
                    whatMakesOutliers: { type: "string" },
                    commonPatterns: { type: "array", items: { type: "string" } },
                    replicableElements: { type: "array", items: { type: "string" } },
                  },
                  required: ["whatMakesOutliers", "commonPatterns", "replicableElements"],
                  additionalProperties: false,
                },
                competitors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      channelName: { type: "string" },
                      whyCompetitor: { type: "string" },
                      whatToLearn: { type: "string" },
                    },
                    required: ["channelName", "whyCompetitor", "whatToLearn"],
                    additionalProperties: false,
                  }
                },
                growthStrategy: {
                  type: "object",
                  properties: {
                    immediate: { type: "array", items: { type: "string" }, description: "Actions for this week" },
                    shortTerm: { type: "array", items: { type: "string" }, description: "Actions for next 30 days" },
                    longTerm: { type: "array", items: { type: "string" }, description: "Actions for next 90 days" },
                    uploadFrequency: { type: "string" },
                    contentPillars: { type: "array", items: { type: "string" } },
                    monetizationPath: { type: "string" },
                    estimatedTimeToMonetization: { type: "string" },
                    estimatedMonthlyRevenue30d: { type: "string" },
                    estimatedMonthlyRevenue90d: { type: "string" },
                  },
                  required: ["immediate", "shortTerm", "longTerm", "uploadFrequency", "contentPillars", "monetizationPath", "estimatedTimeToMonetization"],
                  additionalProperties: false,
                },
                recommendedTopics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      whyNow: { type: "string" },
                      estimatedViews: { type: "string" },
                      titleSuggestion: { type: "string" },
                      format: { type: "string" },
                    },
                    required: ["topic", "whyNow", "estimatedViews", "titleSuggestion", "format"],
                    additionalProperties: false,
                  }
                },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                criticalFixes: { type: "array", items: { type: "string" }, description: "Most urgent issues to fix" },
                seoImprovements: { type: "array", items: { type: "string" } },
                thumbnailAdvice: { type: "array", items: { type: "string" } },
              },
              required: ["channelScore", "nicheAnalysis", "contentFormat", "outlierAnalysis", "competitors", "growthStrategy", "recommendedTopics", "strengths", "weaknesses", "criticalFixes", "seoImprovements", "thumbnailAdvice"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "channel_intelligence_report" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No AI response");
    const report = JSON.parse(toolCall.function.arguments);

    // ========== 6. AUTO-LEARN: Save channel intelligence ==========
    try {
      await sb.from("channel_intelligence").upsert({
        youtube_channel_id: channelId,
        channel_name: snippet.title,
        subscribers: subs,
        avg_views: Math.round(avgViews),
        niche: report.nicheAnalysis?.detectedNiche || 'unknown',
        sub_niche: report.nicheAnalysis?.detectedSubNiche || null,
        style: report.contentFormat?.primaryFormat || 'unknown',
        growth_rate: report.channelScore?.growth >= 70 ? 'fast' : report.channelScore?.growth >= 40 ? 'steady' : 'slow',
        is_faceless: report.nicheAnalysis?.facelessFriendly || false,
        is_monetized: subs >= 1000 && totalViews >= 4000000,
        rpm_estimate: report.nicheAnalysis?.estimatedRPM || 0,
        top_videos: outliers.slice(0, 5).map(v => ({ title: v.title, views: v.views })),
        viral_patterns: {
          outlierPatterns: report.outlierAnalysis?.commonPatterns || [],
          replicableElements: report.outlierAnalysis?.replicableElements || [],
          storytellingStyle: report.contentFormat?.storytellingStyle || '',
        },
        visual_style_notes: report.contentFormat?.storytellingStyle || null,
        country: snippet.country || 'US',
        language: snippet.defaultLanguage || 'en',
      }, { onConflict: "youtube_channel_id" });
      console.log(`Saved channel intelligence for "${snippet.title}"`);
    } catch (e) {
      console.error("Auto-learn channel error:", e);
    }

    return new Response(JSON.stringify({
      channel: {
        id: channelId,
        name: snippet.title,
        thumbnail: snippet.thumbnails?.medium?.url,
        banner: channel.brandingSettings?.image?.bannerExternalUrl || null,
        subscribers: subs,
        totalViews,
        videoCount,
        country: snippet.country,
        createdAt: snippet.publishedAt,
        description: snippet.description?.slice(0, 500),
      },
      metrics: {
        avgViews: Math.round(avgViews),
        medianViews,
        outlierCount: outliers.length,
        superOutlierCount: superOutliers.length,
        avgDaysBetweenUploads: Math.round(avgDaysBetween * 10) / 10,
        shortVideos: shortVideos.length,
        midVideos: midVideos.length,
        longVideos: longVideos.length,
      },
      topVideos: videoMetrics.sort((a, b) => b.views - a.views).slice(0, 10),
      outliers: outliers.slice(0, 5),
      recentVideos: videoMetrics.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 10),
      report,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("channel-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
