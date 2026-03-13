import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { channelId } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get channel info
    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`);
    const chData = await chRes.json();
    if (!chData.items?.length) throw new Error("Canal não encontrado");

    const ch = chData.items[0];

    // Get top 10 videos by views
    const topRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=10&type=video&key=${YOUTUBE_API_KEY}`);
    const topData = await topRes.json();
    const videoIds = topData.items?.map((v: any) => v.id.videoId).filter(Boolean).join(',');

    let videoDetails: any[] = [];
    if (videoIds) {
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
      const vData = await vRes.json();
      videoDetails = (vData.items || []).map((v: any) => ({
        title: v.snippet.title,
        views: parseInt(v.statistics?.viewCount || '0'),
        likes: parseInt(v.statistics?.likeCount || '0'),
        duration: v.contentDetails?.duration,
        publishedAt: v.snippet.publishedAt,
        tags: v.snippet.tags?.slice(0, 10) || [],
      }));
    }

    // AI generates emulation roadmap
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `Analyze this YouTube channel and create a 1-click emulation roadmap:

Channel: ${ch.snippet.title}
Subs: ${ch.statistics.subscriberCount}
Videos: ${ch.statistics.videoCount}
Total views: ${ch.statistics.viewCount}

Top videos:
${videoDetails.map((v, i) => `${i + 1}. "${v.title}" - ${v.views} views, ${v.likes} likes`).join('\n')}

Create a detailed roadmap to emulate this channel's success. Include suggested video titles, posting frequency, content format, keywords, and thumbnail strategies.`
        }],
        tools: [{
          type: "function",
          function: {
            name: "emulation_roadmap",
            description: "Generate channel emulation roadmap",
            parameters: {
              type: "object",
              properties: {
                strategy: { type: "string" },
                suggestedTitles: { type: "array", items: { type: "string" } },
                postingFrequency: { type: "string" },
                contentFormat: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                thumbnailStrategy: { type: "string" },
                uniqueAngle: { type: "string" },
                estimatedTimeToMonetize: { type: "string" },
                weeklyPlan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "number" },
                      focus: { type: "string" },
                      videos: { type: "array", items: { type: "string" } }
                    },
                    required: ["week", "focus", "videos"]
                  }
                }
              },
              required: ["strategy", "suggestedTitles", "postingFrequency", "contentFormat", "keywords", "thumbnailStrategy", "weeklyPlan"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "emulation_roadmap" } }
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed");
    }

    const aiData = await aiRes.json();
    let roadmap;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      roadmap = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse roadmap");
    }

    return new Response(JSON.stringify({
      channel: {
        name: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.medium?.url,
        subscribers: parseInt(ch.statistics.subscriberCount || '0'),
        views: parseInt(ch.statistics.viewCount || '0'),
      },
      topVideos: videoDetails,
      roadmap,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("emulate-channel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
