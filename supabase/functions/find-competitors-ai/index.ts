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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelId, channelName, topVideoTitles, subscribers, niche, country } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

    const regionCode = country || "US";
    const titles = (topVideoTitles || []).slice(0, 10);
    if (titles.length === 0) throw new Error("No video titles provided");

    // Step 1: AI generates smart search queries based on channel content
    const aiQueryRes = await _ai({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "generate_search_queries",
            description: "Generate YouTube search queries to find competitors",
            parameters: {
              type: "object",
              properties: {
                queries: {
                  type: "array",
                  items: { type: "string" },
                  description: "5-8 YouTube search queries to find competitor channels. Mix broad niche queries with specific topic queries."
                },
                detected_niche: { type: "string" },
                detected_style: { type: "string" },
                detected_audience: { type: "string" },
              },
              required: ["queries", "detected_niche", "detected_style"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_search_queries" } },
        messages: [
          { role: "system", content: "You are a YouTube competitive intelligence expert. Analyze channel titles to understand their niche, style and audience, then generate search queries that would find their direct competitors." },
          { role: "user", content: `Channel: ${channelName || 'Unknown'}\nSubscribers: ${subscribers || 0}\nNiche hint: ${niche || 'unknown'}\nCountry: ${regionCode}\n\nTop video titles:\n${titles.map((t: string, i: number) => `${i+1}. ${t}`).join('\n')}\n\nGenerate 5-8 YouTube search queries that would find channels making similar content. Include:\n- Broad niche queries (e.g. "dark history documentaries")\n- Specific topic queries from their best videos\n- Style-based queries (e.g. "faceless horror narration")\n- Audience-interest queries (what their viewers also watch)` },
        ],
      });

    if (!aiQueryRes.ok) throw new Error("AI query generation failed");
    const aiQueryData = await aiQueryRes.json();
    const queryResult = JSON.parse(aiQueryData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}');
    const searchQueries = (queryResult.queries || []).slice(0, 6);

    // Step 2: Search YouTube with AI-generated queries
    const channelMap: Record<string, { channelId: string; channelName: string; thumbnail: string; topVideos: { title: string; views: number; videoId: string }[]; hitCount: number }> = {};

    for (const query of searchQueries) {
      try {
        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&regionCode=${regionCode}&maxResults=15&order=viewCount&key=${YOUTUBE_API_KEY}`);
        const searchData = await searchRes.json();
        for (const item of (searchData.items || [])) {
          const cId = item.snippet.channelId;
          if (cId === channelId) continue;
          if (!channelMap[cId]) {
            channelMap[cId] = { channelId: cId, channelName: item.snippet.channelTitle, thumbnail: item.snippet.thumbnails?.medium?.url || "", topVideos: [], hitCount: 0 };
          }
          channelMap[cId].hitCount++;
          if (channelMap[cId].topVideos.length < 5) {
            channelMap[cId].topVideos.push({ title: item.snippet.title, views: 0, videoId: item.id.videoId });
          }
        }
      } catch { /* skip failed query */ }
    }

    // Step 3: Get video stats + channel stats
    const allVideoIds = Object.values(channelMap).flatMap(c => c.topVideos.map(v => v.videoId)).slice(0, 50);
    if (allVideoIds.length > 0) {
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${allVideoIds.join(",")}&key=${YOUTUBE_API_KEY}`);
      const vData = await vRes.json();
      const viewsMap: Record<string, number> = {};
      for (const v of (vData.items || [])) viewsMap[v.id] = parseInt(v.statistics?.viewCount || "0");
      for (const ch of Object.values(channelMap)) {
        for (const tv of ch.topVideos) tv.views = viewsMap[tv.videoId] || 0;
        ch.topVideos.sort((a, b) => b.views - a.views);
      }
    }

    const discoveredIds = Object.keys(channelMap).slice(0, 20);
    const rawCompetitors: any[] = [];

    if (discoveredIds.length > 0) {
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${discoveredIds.join(",")}&key=${YOUTUBE_API_KEY}`);
      const chData = await chRes.json();
      for (const ch of (chData.items || [])) {
        const subs = parseInt(ch.statistics?.subscriberCount || "0");
        const totalViews = parseInt(ch.statistics?.viewCount || "0");
        const videoCount = parseInt(ch.statistics?.videoCount || "0");
        if (subs < 100) continue;
        const entry = channelMap[ch.id];
        rawCompetitors.push({
          channelId: ch.id, channelName: ch.snippet.title,
          thumbnail: ch.snippet.thumbnails?.medium?.url || "",
          subscribers: subs, totalViews, videoCount,
          avgViews: videoCount > 0 ? Math.round(totalViews / videoCount) : 0,
          country: ch.snippet.country || regionCode,
          topVideos: (entry?.topVideos || []).slice(0, 3),
          hitCount: entry?.hitCount || 0,
        });
      }
    }

    // Step 4: AI analyzes competitors
    const topCompetitors = rawCompetitors.sort((a, b) => b.hitCount - a.hitCount).slice(0, 12);
    
    const aiAnalysisRes = await _ai({
        model: "google/gemini-3-flash-preview",
        tools: [{
          type: "function",
          function: {
            name: "analyze_competitors",
            description: "Analyze competitor channels",
            parameters: {
              type: "object",
              properties: {
                competitors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      channelId: { type: "string" },
                      why_competitor: { type: "string", description: "Why this is a direct competitor (1 sentence)" },
                      what_they_do_better: { type: "string", description: "What they do better than user's channel" },
                      content_gap: { type: "string", description: "Content gap user could exploit" },
                      threat_level: { type: "string", enum: ["low", "medium", "high"] },
                      growth_assessment: { type: "string", enum: ["declining", "steady", "growing", "explosive"] },
                    },
                    required: ["channelId", "why_competitor", "what_they_do_better", "content_gap", "threat_level", "growth_assessment"],
                    additionalProperties: false,
                  },
                },
                overall_insights: {
                  type: "object",
                  properties: {
                    market_saturation: { type: "string", enum: ["low", "medium", "high"] },
                    biggest_opportunity: { type: "string" },
                    recommended_differentiation: { type: "string" },
                    content_gaps: { type: "array", items: { type: "string" } },
                  },
                  required: ["market_saturation", "biggest_opportunity", "recommended_differentiation", "content_gaps"],
                  additionalProperties: false,
                },
              },
              required: ["competitors", "overall_insights"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_competitors" } },
        messages: [
          { role: "system", content: "You are a YouTube competitive analyst. Analyze competitor data and provide actionable insights." },
          { role: "user", content: `User's channel: ${channelName} (${subscribers} subs, niche: ${niche || queryResult.detected_niche || 'unknown'})\n\nCompetitors found:\n${topCompetitors.map((c, i) => `${i+1}. ${c.channelName} | ${c.subscribers} subs | ${c.avgViews} avg views | Top: ${c.topVideos.map((v: any) => `"${v.title}" (${v.views} views)`).join(', ')}`).join('\n')}\n\nAnalyze each competitor: why they're relevant, what they do better, content gaps to exploit.` },
        ],
      });

    if (!aiAnalysisRes.ok) throw new Error("AI analysis failed");
    const aiAnalysis = await aiAnalysisRes.json();
    const analysis = JSON.parse(aiAnalysis.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}');

    // Merge AI analysis with raw data
    const enrichedCompetitors = topCompetitors.map(comp => {
      const aiComp = (analysis.competitors || []).find((a: any) => a.channelId === comp.channelId);
      return {
        ...comp,
        growthRate: aiComp?.growth_assessment || "steady",
        multiplier: comp.avgViews > 0 && comp.topVideos[0] ? +(comp.topVideos[0].views / comp.avgViews).toFixed(1) : 0,
        relevanceScore: comp.hitCount * 10,
        why_competitor: aiComp?.why_competitor || '',
        what_they_do_better: aiComp?.what_they_do_better || '',
        content_gap: aiComp?.content_gap || '',
        threat_level: aiComp?.threat_level || 'medium',
      };
    });

    return new Response(JSON.stringify({
      competitors: enrichedCompetitors,
      keywords: searchQueries,
      insights: analysis.overall_insights || {},
      detected: { niche: queryResult.detected_niche, style: queryResult.detected_style, audience: queryResult.detected_audience },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("find-competitors-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
