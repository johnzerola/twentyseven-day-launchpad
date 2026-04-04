import { callGemini, callGeminiWithFallback, callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NICHES_TO_SCAN = [
  "dark history documentary", "true crime mystery", "conspiracy theories",
  "mythology gods ancient", "ocean deep sea mysteries", "abandoned places exploration",
  "personal finance investing", "psychology facts mind", "space universe cosmos",
  "technology AI future", "horror scary stories", "motivation success mindset",
  "science experiments explained", "war military history", "crypto bitcoin explained",
  "health fitness nutrition", "gaming tips tricks", "cooking recipes easy",
  "travel adventure hidden", "animals nature wildlife",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, maxResults } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nichesToScan = niche ? [niche] : NICHES_TO_SCAN.slice(0, 5);
    const limit = Math.min(maxResults || 50, 100);
    let totalInserted = 0;

    for (const searchNiche of nichesToScan) {
      // Search YouTube for high-view videos
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(searchNiche)}&maxResults=${limit}&order=viewCount&videoDuration=medium&key=${YOUTUBE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const videoIds = (searchData.items || []).map((i: any) => i.id.videoId).filter(Boolean);
      if (videoIds.length === 0) continue;

      // Get stats
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
      const statsRes = await fetch(statsUrl);
      if (!statsRes.ok) continue;
      const statsData = await statsRes.json();

      // Filter: >350k views, not shorts (>60s)
      const qualifying = (statsData.items || []).filter((v: any) => {
        const views = parseInt(v.statistics?.viewCount || '0');
        const duration = v.contentDetails?.duration || '';
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSeconds = durationMatch
          ? (parseInt(durationMatch[1] || '0') * 3600 + parseInt(durationMatch[2] || '0') * 60 + parseInt(durationMatch[3] || '0'))
          : 0;
        return views >= 350000 && totalSeconds > 60;
      });

      if (qualifying.length === 0) continue;

      // AI: analyze why titles worked (batch)
      const titlesForAnalysis = qualifying.map((v: any) => ({
        title: v.snippet?.title || '',
        views: parseInt(v.statistics?.viewCount || '0'),
        channel: v.snippet?.channelTitle || '',
      }));

      let aiAnalysis: any[] = [];
      try {
        const aiRes = await _ai({
            model: "google/gemini-2.5-flash-lite",
            tools: [{
              type: "function",
              function: {
                name: "analyze_titles",
                description: "Analyze why viral titles worked",
                parameters: {
                  type: "object",
                  properties: {
                    analyses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number" },
                          why_viral: { type: "string", description: "1-2 sentences explaining why this title went viral" },
                          pattern: { type: "string", description: "Title pattern used: curiosity, numbers, urgency, controversy, storytelling, how-to, shock" },
                          triggers: { type: "array", items: { type: "string" }, description: "Emotional triggers: fear, greed, curiosity, anger, surprise, FOMO" },
                          seo_score: { type: "number", description: "SEO optimization 1-10" },
                        },
                        required: ["index", "why_viral", "pattern", "triggers", "seo_score"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["analyses"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "analyze_titles" } },
            messages: [
              { role: "system", content: "Analyze viral YouTube titles. Be concise and specific." },
              { role: "user", content: `Niche: ${searchNiche}\n\nTitles:\n${titlesForAnalysis.map((t, i) => `${i}. "${t.title}" (${t.views} views, by ${t.channel})`).join('\n')}` },
            ],
          });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}');
          aiAnalysis = parsed.analyses || [];
        }
      } catch { /* AI analysis optional */ }

      // Insert into DB
      const rows = qualifying.map((v: any, i: number) => {
        const ai = aiAnalysis.find((a: any) => a.index === i) || {};
        const duration = v.contentDetails?.duration || '';
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSeconds = durationMatch
          ? (parseInt(durationMatch[1] || '0') * 3600 + parseInt(durationMatch[2] || '0') * 60 + parseInt(durationMatch[3] || '0'))
          : 0;

        return {
          title: v.snippet?.title || '',
          channel_name: v.snippet?.channelTitle || '',
          channel_id: v.snippet?.channelId || '',
          views: parseInt(v.statistics?.viewCount || '0'),
          likes: parseInt(v.statistics?.likeCount || '0'),
          niche: searchNiche,
          language: v.snippet?.defaultLanguage || v.snippet?.defaultAudioLanguage || 'en',
          country: '',
          duration_seconds: totalSeconds,
          published_at: v.snippet?.publishedAt || null,
          why_viral: ai.why_viral || null,
          title_pattern: ai.pattern || null,
          emotional_triggers: ai.triggers || [],
          seo_score: ai.seo_score || 0,
        };
      });

      const { error } = await sb.from('viral_titles_db').insert(rows);
      if (!error) totalInserted += rows.length;
    }

    return new Response(JSON.stringify({ inserted: totalInserted, niches_scanned: nichesToScan.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-viral-titles-db error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
