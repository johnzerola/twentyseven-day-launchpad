import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, country, language, limit } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // ═══ YouTube API: Find trending shorts ═══
    const ytKeys = [
      Deno.env.get("YOUTUBE_API_KEY"),
      Deno.env.get("YOUTUBE_API_KEY_2"),
      Deno.env.get("YOUTUBE_API_KEY_3"),
      Deno.env.get("YOUTUBE_API_KEY_4"),
    ].filter(Boolean) as string[];

    let ytKey = ytKeys[Math.floor(Math.random() * ytKeys.length)] || null;
    let shortsData: any[] = [];

    if (ytKey) {
      // Multiple search queries to maximize trend discovery
      const queries = [
        `${niche || 'viral'} #shorts`,
        `${niche || 'trending'} shorts ${new Date().getFullYear()}`,
        `${niche || ''} shorts viral hoje`.trim(),
      ];

      for (const q of queries) {
        try {
          const regionParam = country ? `&regionCode=${country}` : '';
          const langParam = language === 'en' ? '&relevanceLanguage=en' : language === 'es' ? '&relevanceLanguage=es' : '&relevanceLanguage=pt';
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoDuration=short&maxResults=${limit || 10}&order=date&publishedAfter=${new Date(Date.now() - 3 * 86400000).toISOString()}${regionParam}${langParam}&key=${ytKey}`;
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) {
            // Try next key
            const nextKey = ytKeys.find(k => k !== ytKey);
            if (nextKey) { ytKey = nextKey; continue; }
            continue;
          }
          const searchData = await searchRes.json();
          const videoIds = (searchData.items || []).map((i: any) => i.id?.videoId).filter(Boolean);

          if (videoIds.length > 0) {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(',')}&key=${ytKey}`;
            const statsRes = await fetch(statsUrl);
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              for (const v of (statsData.items || [])) {
                const duration = v.contentDetails?.duration || '';
                const match = duration.match(/PT(?:(\d+)M)?(\d+)S/);
                const totalSec = match ? (parseInt(match[1] || '0') * 60 + parseInt(match[2] || '0')) : 999;
                if (totalSec <= 65) {
                  const views = parseInt(v.statistics?.viewCount || '0');
                  const likes = parseInt(v.statistics?.likeCount || '0');
                  const comments = parseInt(v.statistics?.commentCount || '0');
                  const publishedAt = v.snippet?.publishedAt;
                  const hoursAgo = publishedAt ? Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3600000) : 999;
                  const viewsPerHour = Math.round(views / hoursAgo);

                  shortsData.push({
                    videoId: v.id,
                    title: v.snippet?.title,
                    channelTitle: v.snippet?.channelTitle,
                    channelId: v.snippet?.channelId,
                    views,
                    likes,
                    comments,
                    duration: totalSec,
                    publishedAt,
                    thumbnail: v.snippet?.thumbnails?.high?.url,
                    tags: v.snippet?.tags?.slice(0, 10) || [],
                    viewsPerHour,
                    engagementRate: views > 0 ? Math.round((likes + comments) / views * 10000) / 100 : 0,
                    hoursAgo: Math.round(hoursAgo),
                    isTrending: viewsPerHour > 500,
                    isExplosive: viewsPerHour > 2000,
                  });
                }
              }
            }
          }
        } catch (e) { console.warn("YouTube search error:", e); }
      }

      // Dedupe & sort by velocity
      const seen = new Set();
      shortsData = shortsData.filter(s => {
        if (seen.has(s.videoId)) return false;
        seen.add(s.videoId);
        return true;
      });
      shortsData.sort((a, b) => b.viewsPerHour - a.viewsPerHour);
      shortsData = shortsData.slice(0, 20);
    }

    // ═══ Get channel subscriber counts for ratio calculation ═══
    if (ytKey && shortsData.length > 0) {
      const channelIds = [...new Set(shortsData.map(s => s.channelId).filter(Boolean))];
      if (channelIds.length > 0) {
        try {
          const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${ytKey}`;
          const chRes = await fetch(chUrl);
          if (chRes.ok) {
            const chData = await chRes.json();
            const subsMap: Record<string, number> = {};
            for (const ch of (chData.items || [])) {
              subsMap[ch.id] = parseInt(ch.statistics?.subscriberCount || '0');
            }
            for (const s of shortsData) {
              s.channelSubs = subsMap[s.channelId] || 0;
              s.viewToSubRatio = s.channelSubs > 0 ? Math.round(s.views / s.channelSubs * 100) / 100 : 0;
            }
          }
        } catch (e) { console.warn("Channel stats error:", e); }
      }
    }

    // ═══ AI Trend Analysis ═══
    const shortsContext = shortsData.length > 0
      ? shortsData.slice(0, 12).map((s, i) =>
        `${i + 1}. "${s.title}" by ${s.channelTitle} — ${s.views.toLocaleString()} views em ${s.hoursAgo}h (${s.viewsPerHour} views/h), ${s.duration}s, engagement: ${s.engagementRate}%, subs: ${(s.channelSubs || 0).toLocaleString()}, ratio: ${s.viewToSubRatio || 0}x`
      ).join("\n")
      : "Nenhum Short recente encontrado.";

    const analysisRes = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system", content: `Você é um analista de tendências de YouTube Shorts. Analise os Shorts mais recentes e identifique:
1. Temas/tópicos que estão EXPLODINDO agora
2. Formatos que estão performando melhor
3. Padrões de hook que estão funcionando
4. Gaps de conteúdo (oportunidades)

Retorne JSON VÁLIDO com esta estrutura:
{
  "trending_topics": [{"topic": string, "velocity": "explosive|rising|steady", "examples": [string], "why_trending": string, "opportunity_score": number}],
  "hot_formats": [{"format": string, "avg_views": number, "description": string}],
  "winning_hooks": [{"hook_pattern": string, "example": string, "effectiveness": number}],
  "content_gaps": [{"gap": string, "opportunity": string, "difficulty": "easy|medium|hard"}],
  "recommended_topics": [{"topic": string, "angle": string, "estimated_views": string, "urgency": "now|this_week|this_month"}],
  "trend_summary": string,
  "best_posting_time": string,
  "niche_health": {"score": number, "trend": "growing|stable|declining", "saturation": "low|medium|high"}
}`
          },
          {
            role: "user", content: `Analise estas tendências de Shorts para o nicho "${niche || 'geral'}" (país: ${country || 'BR'}, idioma: ${language || 'pt'}):\n\n${shortsContext}\n\nRetorne APENAS o JSON.`
          }
        ],
        stream: false,
      }),
    });

    let analysis: any = {};
    if (analysisRes.ok) {
      const d = await analysisRes.json();
      const content = d.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch (e) { console.warn("JSON parse error:", e); }
    }

    // ═══ Perplexity enrichment (if available) ═══
    let perplexityInsights: any = null;
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (PERPLEXITY_API_KEY && niche) {
      try {
        const pRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: "Pesquisador de tendências YouTube Shorts. Responda em português, dados específicos." },
              { role: "user", content: `Quais são as tendências virais AGORA em YouTube Shorts no nicho "${niche}"? Quais temas estão explodindo nas últimas 48h? Dados específicos, canais, formatos.` }
            ],
            search_recency_filter: "day",
            temperature: 0.1,
            max_tokens: 800,
          }),
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          perplexityInsights = {
            content: pData.choices?.[0]?.message?.content || '',
            citations: pData.citations || [],
          };
        }
      } catch (e) { console.warn("Perplexity error:", e); }
    }

    return new Response(JSON.stringify({
      shorts: shortsData,
      analysis,
      perplexityInsights,
      metadata: {
        niche: niche || 'geral',
        country: country || 'BR',
        language: language || 'pt',
        shorts_found: shortsData.length,
        trending_count: shortsData.filter(s => s.isTrending).length,
        explosive_count: shortsData.filter(s => s.isExplosive).length,
        youtube_api_used: !!ytKey,
        perplexity_used: !!perplexityInsights,
        scanned_at: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("shorts-trend-detector error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
