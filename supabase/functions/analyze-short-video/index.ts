import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, niche, language, count } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };

    // ========== Search YouTube Shorts ==========
    const ytKey1 = Deno.env.get("YOUTUBE_API_KEY");
    const ytKey2 = Deno.env.get("YOUTUBE_API_KEY_2");
    const ytKey3 = Deno.env.get("YOUTUBE_API_KEY_3");
    const ytKey4 = Deno.env.get("YOUTUBE_API_KEY_4");
    let ytKey = ytKey1 || ytKey2 || ytKey3 || ytKey4;

    let shortsData: any[] = [];
    if (ytKey) {
      const queries = [
        `${topic} #shorts`,
        `${niche || topic} shorts viral`,
      ];

      for (const q of queries) {
        try {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoDuration=short&maxResults=${count || 8}&order=viewCount&key=${ytKey}`;
          const searchRes = await fetch(searchUrl);
          if (searchRes.status === 403 && ytKey === ytKey1 && ytKey2) {
            ytKey = ytKey2; // fallback
            continue;
          }
          if (!searchRes.ok) continue;
          const searchData = await searchRes.json();
          const videoIds = (searchData.items || []).map((i: any) => i.id?.videoId).filter(Boolean);

          if (videoIds.length > 0) {
            const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(',')}&key=${ytKey}`;
            const statsRes = await fetch(statsUrl);
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              for (const v of (statsData.items || [])) {
                const duration = v.contentDetails?.duration || '';
                // Only include actual shorts (<= 60s)
                const match = duration.match(/PT(?:(\d+)M)?(\d+)S/);
                const totalSec = match ? (parseInt(match[1] || '0') * 60 + parseInt(match[2] || '0')) : 999;
                if (totalSec <= 65) {
                  shortsData.push({
                    videoId: v.id,
                    title: v.snippet?.title,
                    channelTitle: v.snippet?.channelTitle,
                    channelId: v.snippet?.channelId,
                    views: parseInt(v.statistics?.viewCount || '0'),
                    likes: parseInt(v.statistics?.likeCount || '0'),
                    comments: parseInt(v.statistics?.commentCount || '0'),
                    duration: totalSec,
                    publishedAt: v.snippet?.publishedAt,
                    thumbnail: v.snippet?.thumbnails?.high?.url,
                    tags: v.snippet?.tags?.slice(0, 10) || [],
                  });
                }
              }
            }
          }
        } catch (e) { console.warn("YouTube search error:", e); }
      }

      // Dedupe by videoId
      const seen = new Set();
      shortsData = shortsData.filter(s => {
        if (seen.has(s.videoId)) return false;
        seen.add(s.videoId);
        return true;
      });
      shortsData.sort((a, b) => b.views - a.views);
      shortsData = shortsData.slice(0, 15);
    }

    // ========== AI Analysis ==========
    const shortsContext = shortsData.length > 0
      ? shortsData.map((s, i) =>
        `${i + 1}. "${s.title}" by ${s.channelTitle} — ${s.views.toLocaleString()} views, ${s.duration}s, ${s.likes} likes`
      ).join("\n")
      : "Nenhum Short encontrado no YouTube para este tópico.";

    const analysisRes = await fetch(AI_URL, {
      method: "POST", headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system", content: `Você é o MELHOR analista de engenharia reversa de YouTube Shorts virais do mundo.
Extraia o DNA COMPLETO de cada Short analisado.

Retorne um JSON válido com esta estrutura EXATA:
{
  "shorts_found": number,
  "top_shorts": [{"title": string, "views": number, "channel": string, "duration": number, "why_viral": string, "dna": {"hook_type": string, "hook_technique": string, "narrative_structure": string, "emotional_arc": string, "loop_type": string, "pacing": string, "visual_style": string, "target_emotion": string, "retention_tricks": [string]}}],
  "hook_patterns": [{"pattern": string, "example": string, "effectiveness": number, "psychology": string, "first_words": string}],
  "structure_patterns": [{"name": string, "description": string, "frequency": string, "beat_map": [{"beat": string, "timestamp": string, "purpose": string}]}],
  "visual_patterns": [{"pattern": string, "description": string, "camera_moves": [string], "color_palette": string}],
  "loop_techniques": [{"technique": string, "example": string, "loop_type": "visual|audio|narrative|emotional", "effectiveness": number}],
  "audio_patterns": [{"pattern": string, "description": string, "timing": string}],
  "text_overlay_patterns": [{"pattern": string, "placement": string, "font_style": string}],
  "content_gaps": [string],
  "recommended_angles": [string],
  "dominant_styles": [string],
  "avg_duration_seconds": number,
  "engagement_insights": string,
  "what_to_avoid": [string],
  "replication_blueprint": {"step1_hook": string, "step2_structure": string, "step3_visual": string, "step4_loop": string, "step5_audio": string}
}

IMPORTANTE: Analise PROFUNDAMENTE os HOOKS (primeiras palavras, técnica psicológica), ESTRUTURA NARRATIVA (beat map temporal), VISUAL (câmeras, cores, transições), LOOPS (tipo e técnica), ÁUDIO (efeitos sonoros, música, timing) e TEXT OVERLAYS de cada Short.
effectiveness é 1-10.`
          },
          {
            role: "user", content: `Faça engenharia reversa COMPLETA destes Shorts virais sobre "${topic}" (nicho: ${niche || 'geral'}, idioma: ${language || 'pt'}):\n\n${shortsContext}\n\nExtraia o DNA COMPLETO incluindo hook_technique, beat_map, camera_moves, loop_type, audio_patterns e um blueprint de replicação. Retorne APENAS o JSON.`
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

    return new Response(JSON.stringify({
      shorts: shortsData,
      analysis,
      metadata: {
        topic,
        niche,
        shorts_found: shortsData.length,
        youtube_api_used: !!ytKey,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-short-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
