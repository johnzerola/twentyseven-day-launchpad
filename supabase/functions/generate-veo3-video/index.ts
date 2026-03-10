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

    if (action === "generate") {
      const { prompt, aspectRatio, model, negativePrompt } = body;
      if (!prompt) throw new Error("Prompt is required");

      const modelId = model || "veo-3.1-generate-preview";
      const url = `${BASE_URL}/models/${modelId}:predictLongRunning`;

      const instanceObj: any = { prompt };
      const parametersObj: any = { aspectRatio: aspectRatio || "16:9", sampleCount: 1 };
      if (negativePrompt) parametersObj.negativePrompt = negativePrompt;

      console.log("Veo3 request:", modelId);

      const response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": GOOGLE_AI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [instanceObj], parameters: parametersObj }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Veo3 error:", response.status, errorText);

        // Distinguish quota exhaustion from temporary rate limit
        const isQuotaExhausted = errorText.includes("RESOURCE_EXHAUSTED") || errorText.includes("exceeded your current quota");
        
        if (response.status === 429 || isQuotaExhausted) {
          return new Response(JSON.stringify({
            error: isQuotaExhausted
              ? "Quota da API Google esgotada. Aguarde alguns minutos para o reset."
              : "Rate limit temporário. Tente novamente em 30s.",
            quotaExhausted: isQuotaExhausted,
            retryAfter: isQuotaExhausted ? 120 : 30,
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": isQuotaExhausted ? "120" : "30" },
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
      return new Response(JSON.stringify({ operationName: result.name, status: "RUNNING" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "poll") {
      const { operationName } = body;
      if (!operationName) throw new Error("operationName is required");

      const response = await fetch(`${BASE_URL}/${operationName}`, {
        headers: { "x-goog-api-key": GOOGLE_AI_API_KEY },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Poll error:", response.status, errorText);
        throw new Error(`Poll error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.done) {
        return new Response(JSON.stringify({
          status: "RUNNING", operationName, progress: result.metadata?.progress || null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (result.error) {
        return new Response(JSON.stringify({
          status: "FAILED", error: result.error.message || "Video generation failed",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Extract video data
      const videos = result.response?.generateVideoResponse?.generatedSamples ||
                     result.response?.generatedSamples ||
                     result.result?.generateVideoResponse?.generatedSamples || [];

      if (videos.length === 0) {
        const videoFile = result.response?.video || result.result?.video;
        if (videoFile) {
          const fileUrl = `${BASE_URL}/files/${videoFile.name || videoFile}`;
          const fileRes = await fetch(fileUrl, { headers: { "x-goog-api-key": GOOGLE_AI_API_KEY } });
          if (fileRes.ok) {
            const videoBytes = new Uint8Array(await fileRes.arrayBuffer());
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < videoBytes.length; i += chunkSize) {
              binary += String.fromCharCode(...videoBytes.slice(i, i + chunkSize));
            }
            return new Response(JSON.stringify({
              status: "COMPLETED", videoBase64: btoa(binary), mimeType: "video/mp4",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
        return new Response(JSON.stringify({ status: "COMPLETED", rawResponse: result, videos: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const firstVideo = videos[0];
      const videoUri = firstVideo.video?.uri || firstVideo.uri;

      if (videoUri) {
        if (videoUri.startsWith("files/")) {
          const dlRes = await fetch(`${BASE_URL}/${videoUri}?alt=media`, {
            headers: { "x-goog-api-key": GOOGLE_AI_API_KEY },
          });
          if (dlRes.ok) {
            const videoBytes = new Uint8Array(await dlRes.arrayBuffer());
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < videoBytes.length; i += chunkSize) {
              binary += String.fromCharCode(...videoBytes.slice(i, i + chunkSize));
            }
            return new Response(JSON.stringify({
              status: "COMPLETED", videoBase64: btoa(binary), mimeType: "video/mp4",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
        return new Response(JSON.stringify({ status: "COMPLETED", videoUrl: videoUri }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "COMPLETED", rawResponse: result }), {
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
