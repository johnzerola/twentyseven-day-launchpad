import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const body = await req.json();
    const { action } = body;

    // ACTION: generate — start a new video generation
    if (action === "generate") {
      const { prompt, aspectRatio, duration, model, negativePrompt } = body;
      if (!prompt) throw new Error("Prompt is required");

      const modelId = model || "veo-3.0-generate-preview";
      const url = `${BASE_URL}/models/${modelId}:generateVideos`;

      const config: any = {
        aspectRatio: aspectRatio || "16:9",
        numberOfVideos: 1,
      };
      if (negativePrompt) config.negativePrompt = negativePrompt;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": GOOGLE_AI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          config,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Veo3 generate error:", response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit. Aguarde e tente novamente." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402 || response.status === 403) {
          return new Response(JSON.stringify({ error: "Sem créditos ou acesso negado. Verifique sua API Key e billing." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Veo3 API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      // Returns operation name for polling
      return new Response(JSON.stringify({
        operationName: result.name,
        status: "RUNNING",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: poll — check status of a running operation
    if (action === "poll") {
      const { operationName } = body;
      if (!operationName) throw new Error("operationName is required");

      const url = `${BASE_URL}/${operationName}`;
      const response = await fetch(url, {
        headers: { "x-goog-api-key": GOOGLE_AI_API_KEY },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Veo3 poll error:", response.status, errorText);
        throw new Error(`Poll error: ${response.status}`);
      }

      const result = await response.json();

      // Operation still running
      if (!result.done) {
        return new Response(JSON.stringify({
          status: "RUNNING",
          operationName,
          progress: result.metadata?.progress || null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Operation complete - extract video
      if (result.error) {
        return new Response(JSON.stringify({
          status: "FAILED",
          error: result.error.message || "Video generation failed",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract video data from response
      const videos = result.response?.generateVideoResponse?.generatedSamples ||
                     result.response?.generatedSamples ||
                     result.result?.generateVideoResponse?.generatedSamples ||
                     [];

      if (videos.length === 0) {
        // Try to find video in alternative response structure
        const videoFile = result.response?.video || result.result?.video;
        if (videoFile) {
          // Download the video file
          const fileUrl = `${BASE_URL}/files/${videoFile.name || videoFile}`;
          const fileRes = await fetch(fileUrl, {
            headers: { "x-goog-api-key": GOOGLE_AI_API_KEY },
          });

          if (fileRes.ok) {
            const videoData = await fileRes.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(videoData)));
            return new Response(JSON.stringify({
              status: "COMPLETED",
              videoBase64: base64,
              mimeType: "video/mp4",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Return raw response for debugging
        return new Response(JSON.stringify({
          status: "COMPLETED",
          rawResponse: result,
          videos: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Process generated videos - download first one
      const firstVideo = videos[0];
      const videoUri = firstVideo.video?.uri || firstVideo.uri;

      if (videoUri) {
        // If it's a file reference, download it
        if (videoUri.startsWith("files/")) {
          const dlUrl = `${BASE_URL}/${videoUri}?alt=media`;
          const dlRes = await fetch(dlUrl, {
            headers: { "x-goog-api-key": GOOGLE_AI_API_KEY },
          });

          if (dlRes.ok) {
            const videoBytes = new Uint8Array(await dlRes.arrayBuffer());
            // Convert to base64 in chunks to avoid stack overflow
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < videoBytes.length; i += chunkSize) {
              binary += String.fromCharCode(...videoBytes.slice(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            return new Response(JSON.stringify({
              status: "COMPLETED",
              videoBase64: base64,
              mimeType: "video/mp4",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Direct URL
        return new Response(JSON.stringify({
          status: "COMPLETED",
          videoUrl: videoUri,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: return raw data
      return new Response(JSON.stringify({
        status: "COMPLETED",
        rawResponse: result,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}. Use "generate" or "poll".`);
  } catch (e) {
    console.error("generate-veo3-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
