import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let _ytKeys: string[] = [];
let _currentKeyIndex = 0;

function getYouTubeKeys(): string[] {
  const keys: string[] = [];
  const k1 = Deno.env.get("YOUTUBE_API_KEY");
  const k2 = Deno.env.get("YOUTUBE_API_KEY_2");
  if (k1) keys.push(k1);
  if (k2) keys.push(k2);
  return keys;
}

function getCurrentKey(): string {
  if (!_ytKeys.length) throw new Error("No YouTube API keys configured");
  return _ytKeys[_currentKeyIndex % _ytKeys.length];
}

function switchKey(): boolean {
  if (_ytKeys.length <= 1) return false;
  _currentKeyIndex = (_currentKeyIndex + 1) % _ytKeys.length;
  console.log(`Switched to YouTube API key #${_currentKeyIndex + 1}`);
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, style, channelUrl, language } = await req.json();

    _ytKeys = getYouTubeKeys();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!_ytKeys.length) throw new Error("YOUTUBE_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const YOUTUBE_API_KEY = getCurrentKey();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ========== Mode 1: Analyze specific channel URL/handle/id ==========
    if (channelUrl) {
      let channelId: string | null = null;
      try {
        channelId = await resolveChannelId(channelUrl, getCurrentKey());
      } catch (e: any) {
        if (e.message === "QUOTA_EXCEEDED_RETRY") {
          channelId = await resolveChannelId(channelUrl, getCurrentKey());
        } else throw e;
      }
      if (!channelId) return json({ error: "Canal não encontrado. Envie URL completa, @handle ou ID UC..." }, 404);
      const result = await analyzeChannel(channelId, getCurrentKey(), LOVABLE_API_KEY, sb);
      return json({ channel: result });
    }

    // ========== Mode 2: Search & analyze by niche + style ==========
    const searchQueries = buildSearchQueries(niche || "faceless", style || "all", language || "en");
    const allChannels: any[] = [];

    for (const query of searchQueries.slice(0, 3)) {
      const channels = await searchChannels(query, YOUTUBE_API_KEY);
      for (const ch of channels.slice(0, 5)) {
        try {
          const existing = await sb.from("channel_intelligence")
            .select("id")
            .eq("youtube_channel_id", ch.channelId)
            .maybeSingle();

          if (existing.data) continue; // skip already analyzed

          const result = await analyzeChannel(ch.channelId, YOUTUBE_API_KEY, LOVABLE_API_KEY, sb);
          allChannels.push(result);
        } catch (e) {
          console.error(`Failed to analyze ${ch.channelId}:`, e);
        }
      }
    }

    return json({ analyzed: allChannels.length, channels: allChannels });
  } catch (e) {
    console.error("analyze-viral-channels error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";

    if (msg.includes("QUOTA_EXCEEDED")) {
      return json({ error: "Quota da YouTube API esgotada. Tente novamente amanhã." }, 429);
    }
    if (msg.includes("CHANNEL_NOT_FOUND")) {
      return json({ error: "Canal não encontrado. Verifique a URL/@handle e tente novamente." }, 404);
    }
    if (msg.includes("402")) {
      return json({ error: "Créditos insuficientes." }, 402);
    }

    return json({ error: msg }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSearchQueries(niche: string, style: string, lang: string): string[] {
  const styleKeywords: Record<string, string[]> = {
    pov: ["POV stories", "animated stories", "story time animated"],
    stickmen: ["stick figure animation", "stickman animation", "simple animation viral"],
    wojak: ["wojak meme animated", "meme compilation animated", "POV meme"],
    cinematic: ["cinematic documentary faceless", "documentary essay", "video essay"],
    documentary: ["documentary faceless channel", "investigative documentary", "long form documentary"],
    horror: ["creepypasta narration", "true scary stories", "horror faceless", "dark mystery"],
    whiteboard: ["whiteboard animation", "explainer animation"],
    animation: ["educational animation", "animated explainer", "motion graphics education"],
    mrbeast: ["challenge video extreme", "expensive challenges", "survival challenge"],
    voce_sabia: ["did you know facts", "curiosidades", "amazing facts channel"],
    fatos: ["top 10 facts", "unknown facts", "interesting facts compilation"],
  };

  const keywords = styleKeywords[style] || [`${niche} faceless channel`, `${niche} no face youtube`];
  const langSuffix = lang === "pt" ? " português" : lang === "es" ? " español" : "";

  return keywords.map(k => `${k} ${niche}${langSuffix}`.trim());
}

async function resolveChannelId(input: string, apiKey: string): Promise<string | null> {
  const raw = input.trim();
  if (!raw) return null;

  // Direct channel ID
  if (raw.startsWith("UC") && raw.length >= 24) return raw;

  const normalized = raw
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");

  // youtube.com/channel/UC...
  const channelIdMatch = normalized.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
  if (channelIdMatch?.[1]) return channelIdMatch[1];

  // youtube.com/@handle or @handle
  const handleMatch = normalized.match(/youtube\.com\/@([\w.-]+)/i) || normalized.match(/^@([\w.-]+)$/i);
  if (handleMatch?.[1]) {
    return await resolveByHandle(handleMatch[1], apiKey);
  }

  // youtube.com/c/name or youtube.com/user/name
  const customNameMatch = normalized.match(/youtube\.com\/(?:c|user)\/([^\/]+)/i);
  if (customNameMatch?.[1]) {
    return await resolveBySearch(customNameMatch[1], apiKey);
  }

  // Plain text fallback: try as handle, then as search query
  const asHandle = raw.replace(/^@/, "").trim();
  const handleId = await resolveByHandle(asHandle, apiKey);
  if (handleId) return handleId;

  return await resolveBySearch(raw, apiKey);
}

function assertYouTubeResponse(data: any) {
  const reason = data?.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded") {
    if (switchKey()) {
      throw new Error("QUOTA_EXCEEDED_RETRY");
    }
    throw new Error("QUOTA_EXCEEDED");
  }
  if (data?.error?.message) throw new Error(`YOUTUBE_ERROR: ${data.error.message}`);
}

async function resolveByHandle(handle: string, apiKey: string): Promise<string | null> {
  if (!handle) return null;
  const cleanHandle = handle.replace(/^@/, "").trim();
  if (!cleanHandle) return null;

  const byHandleRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`
  );
  const byHandleData = await byHandleRes.json();
  assertYouTubeResponse(byHandleData);

  return byHandleData.items?.[0]?.id || null;
}

async function resolveBySearch(query: string, apiKey: string): Promise<string | null> {
  if (!query?.trim()) return null;

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=1`
  );
  const data = await res.json();
  assertYouTubeResponse(data);

  return data.items?.[0]?.snippet?.channelId || null;
}

async function searchChannels(query: string, apiKey: string): Promise<{ channelId: string; title: string }[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=10&order=viewCount`
  );
  const data = await res.json();
  assertYouTubeResponse(data);
  if (!data.items) return [];
  return data.items.map((item: any) => ({
    channelId: item.snippet.channelId,
    title: item.snippet.channelTitle,
  }));
}

async function analyzeChannel(
  channelId: string,
  youtubeKey: string,
  lovableKey: string,
  sb: any
): Promise<any> {
  // 1. Get channel details
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${youtubeKey}`
  );
  const chData = await chRes.json();
  assertYouTubeResponse(chData);
  const ch = chData.items?.[0];
  if (!ch) throw new Error("CHANNEL_NOT_FOUND");

  const stats = ch.statistics;
  const snippet = ch.snippet;

  // 2. Get top videos
  const vidRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=5&key=${youtubeKey}`
  );
  const vidData = await vidRes.json();
  assertYouTubeResponse(vidData);
  const videoIds = (vidData.items || []).map((v: any) => v.id.videoId).filter(Boolean);

  let topVideos: any[] = [];
  if (videoIds.length > 0) {
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}&key=${youtubeKey}`
    );
    const statsData = await statsRes.json();
    assertYouTubeResponse(statsData);
    topVideos = (statsData.items || []).map((v: any) => ({
      title: v.snippet.title,
      views: parseInt(v.statistics.viewCount || "0"),
      thumbnail_url: v.snippet.thumbnails?.high?.url || "",
      duration: v.contentDetails?.duration || "",
    }));
  }

  const avgViews = topVideos.length > 0
    ? Math.round(topVideos.reduce((a: number, v: any) => a + v.views, 0) / topVideos.length)
    : 0;

  // 3. AI Analysis with Gemini
  const aiPrompt = `Analyze this YouTube channel for viral patterns. Channel: "${snippet.title}" (${parseInt(stats.subscriberCount || "0").toLocaleString()} subs).
Top videos: ${topVideos.map((v: any) => `"${v.title}" (${v.views.toLocaleString()} views)`).join(", ")}
Channel description: ${snippet.description?.slice(0, 300) || "N/A"}

Return a JSON object with:
{
  "niche": "main niche",
  "sub_niche": "specific sub-niche",
  "style": one of: "pov","stickmen","wojak","cinematic","documentary","horror","whiteboard","animation","mrbeast","voce_sabia","fatos",
  "is_faceless": boolean,
  "growth_rate": "explosive" or "fast" or "steady",
  "viral_patterns": {
    "hooks": ["top 3 hook patterns used"],
    "transitions": ["transition styles"],
    "pacing": "pacing description",
    "thumbnail_style": "thumbnail style description"
  },
  "visual_style_notes": "detailed description of how videos look, edit style, colors, effects",
  "upload_frequency": "e.g. 2x/week",
  "rpm_estimate": estimated RPM in USD,
  "country": "2-letter country code",
  "language": "2-letter language code"
}`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a YouTube channel analyst. Return ONLY valid JSON, no markdown." },
        { role: "user", content: aiPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "analyze_channel",
          description: "Return structured channel analysis",
          parameters: {
            type: "object",
            properties: {
              niche: { type: "string" },
              sub_niche: { type: "string" },
              style: { type: "string", enum: ["pov","stickmen","wojak","cinematic","documentary","horror","whiteboard","animation","mrbeast","voce_sabia","fatos"] },
              is_faceless: { type: "boolean" },
              growth_rate: { type: "string", enum: ["explosive","fast","steady"] },
              viral_patterns: {
                type: "object",
                properties: {
                  hooks: { type: "array", items: { type: "string" } },
                  transitions: { type: "array", items: { type: "string" } },
                  pacing: { type: "string" },
                  thumbnail_style: { type: "string" },
                },
                required: ["hooks","transitions","pacing","thumbnail_style"],
              },
              visual_style_notes: { type: "string" },
              upload_frequency: { type: "string" },
              rpm_estimate: { type: "number" },
              country: { type: "string" },
              language: { type: "string" },
            },
            required: ["niche","sub_niche","style","is_faceless","growth_rate","viral_patterns","visual_style_notes","upload_frequency","rpm_estimate","country","language"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "analyze_channel" } },
    }),
  });

  let analysis: any = {
    niche: "geral", sub_niche: "", style: "cinematic", is_faceless: true,
    growth_rate: "steady", viral_patterns: {}, visual_style_notes: "",
    upload_frequency: "1x/semana", rpm_estimate: 5, country: "US", language: "en",
  };

  if (aiRes.ok) {
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch { /* use defaults */ }
    }
  } else {
    console.error("AI analysis failed:", aiRes.status);
    await aiRes.text(); // consume body
  }

  // 4. Save to DB
  const record = {
    channel_name: snippet.title,
    youtube_channel_id: channelId,
    niche: analysis.niche,
    sub_niche: analysis.sub_niche,
    style: analysis.style,
    country: analysis.country,
    language: analysis.language,
    subscribers: parseInt(stats.subscriberCount || "0"),
    avg_views: avgViews,
    growth_rate: analysis.growth_rate,
    is_faceless: analysis.is_faceless,
    is_monetized: true,
    viral_patterns: analysis.viral_patterns,
    top_videos: topVideos,
    visual_style_notes: analysis.visual_style_notes,
    upload_frequency: analysis.upload_frequency,
    rpm_estimate: analysis.rpm_estimate,
    analyzed_at: new Date().toISOString(),
  };

  const { error } = await sb.from("channel_intelligence").upsert(record, {
    onConflict: "youtube_channel_id",
  });
  if (error) console.error("DB insert error:", error);

  return record;
}
