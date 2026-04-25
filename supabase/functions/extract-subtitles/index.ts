import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { video_id, language = "en" } = await req.json();
    if (!video_id) throw new Error("video_id required");

    const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") || Deno.env.get("YOUTUBE_API_KEY_2") || Deno.env.get("YOUTUBE_API_KEY_3") || Deno.env.get("YOUTUBE_API_KEY_4");
    if (!YT_KEY) throw new Error("YouTube API key not configured");

    // Method 1: Try YouTube Data API captions list
    const captionsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${video_id}&key=${YT_KEY}`
    );

    let transcript = "";
    let method = "none";
    let captionLanguage = language;

    if (captionsRes.ok) {
      const captionsData = await captionsRes.json();
      const captions = captionsData.items || [];
      
      // Find best caption track (prefer manual > ASR, target language > any)
      const manual = captions.find((c: any) => 
        c.snippet.language === language && c.snippet.trackKind !== "ASR"
      );
      const asr = captions.find((c: any) => 
        c.snippet.language === language && c.snippet.trackKind === "ASR"
      );
      const anyCaption = captions.find((c: any) => 
        c.snippet.trackKind !== "ASR"
      ) || captions[0];

      const bestCaption = manual || asr || anyCaption;
      
      if (bestCaption) {
        captionLanguage = bestCaption.snippet.language;
        method = bestCaption.snippet.trackKind === "ASR" ? "auto-generated" : "manual";
      }
    }

    // Method 2: Try fetching auto-generated captions via timedtext API
    // This is the public endpoint YouTube uses for auto-captions
    const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${video_id}&lang=${language}&fmt=json3`;
    const ttRes = await fetch(timedtextUrl);
    
    if (ttRes.ok) {
      try {
        const ttData = await ttRes.json();
        if (ttData.events && ttData.events.length > 0) {
          transcript = ttData.events
            .filter((e: any) => e.segs)
            .map((e: any) => {
              const time = Math.floor((e.tStartMs || 0) / 1000);
              const text = e.segs.map((s: any) => s.utf8 || "").join("").trim();
              return { time, text };
            })
            .filter((s: any) => s.text.length > 0)
            .map((s: any) => {
              const min = Math.floor(s.time / 60);
              const sec = s.time % 60;
              return `[${min}:${sec.toString().padStart(2, "0")}] ${s.text}`;
            })
            .join("\n");
          method = "timedtext-json3";
        }
      } catch { /* not json */ }
    }

    // Method 3: Try srv3 format (XML subtitles)
    if (!transcript) {
      const srv3Url = `https://www.youtube.com/api/timedtext?v=${video_id}&lang=${language}&fmt=srv3`;
      const srv3Res = await fetch(srv3Url);
      if (srv3Res.ok) {
        const xmlText = await srv3Res.text();
        if (xmlText.includes("<text")) {
          // Parse simple XML timestamps
          const segments: string[] = [];
          const regex = /<text start="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
          let match;
          while ((match = regex.exec(xmlText)) !== null) {
            const startSec = Math.floor(parseFloat(match[1]));
            const text = match[2]
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/<[^>]*>/g, "")
              .trim();
            if (text) {
              const min = Math.floor(startSec / 60);
              const sec = startSec % 60;
              segments.push(`[${min}:${sec.toString().padStart(2, "0")}] ${text}`);
            }
          }
          if (segments.length > 0) {
            transcript = segments.join("\n");
            method = "srv3-xml";
          }
        }
      }
    }

    // Method 4: Try fetching from the video page itself (innertube)
    if (!transcript) {
      try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${video_id}`, {
          headers: { "Accept-Language": language },
        });
        const html = await pageRes.text();
        
        // Extract caption track URLs from the page
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (captionMatch) {
          const tracks = JSON.parse(captionMatch[1]);
          const targetTrack = tracks.find((t: any) => 
            t.languageCode === language
          ) || tracks[0];
          
          if (targetTrack?.baseUrl) {
            const trackRes = await fetch(targetTrack.baseUrl + "&fmt=json3");
            if (trackRes.ok) {
              const trackData = await trackRes.json();
              if (trackData.events) {
                transcript = trackData.events
                  .filter((e: any) => e.segs)
                  .map((e: any) => {
                    const time = Math.floor((e.tStartMs || 0) / 1000);
                    const text = e.segs.map((s: any) => s.utf8 || "").join("").trim();
                    return { time, text };
                  })
                  .filter((s: any) => s.text.length > 0)
                  .map((s: any) => {
                    const min = Math.floor(s.time / 60);
                    const sec = s.time % 60;
                    return `[${min}:${sec.toString().padStart(2, "0")}] ${s.text}`;
                  })
                  .join("\n");
                method = "innertube";
                captionLanguage = targetTrack.languageCode;
              }
            }
          }
        }
      } catch (e) {
        console.error("Innertube extraction error:", e);
      }
    }

    // Cache result
    if (transcript) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await sb.from("research_cache").upsert({
        cache_key: `subtitle_${video_id}_${language}`,
        source: "youtube-subtitles",
        query: video_id,
        params: { language: captionLanguage, method },
        result_json: { transcript, word_count: transcript.split(/\s+/).length, line_count: transcript.split("\n").length },
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "cache_key" }).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({
      success: !!transcript,
      video_id,
      language: captionLanguage,
      method,
      transcript: transcript || null,
      word_count: transcript ? transcript.split(/\s+/).length : 0,
      line_count: transcript ? transcript.split("\n").length : 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-subtitles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
