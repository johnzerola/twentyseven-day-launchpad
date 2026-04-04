import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const _ai = async (body: any) => {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
  const res = await callGeminiOpenAICompat(apiKey, body);
  return res;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stylePromptMap: Record<string, string> = {
  'cinematográfico': 'Ultra-realistic cinematic scene, dramatic lighting, shallow depth of field, film grain, ARRI ALEXA quality, 16:9 composition, movie-quality.',
  '2d': '2D flat animation style, vibrant bold colors, clean vector art, Kurzgesagt-inspired motion graphics, smooth lines, no 3D elements, flat design illustration.',
  '3d': '3D rendered scene, Pixar/DreamWorks quality, subsurface scattering, global illumination, stylized 3D characters, PBR materials.',
  'anime': 'Anime style illustration, Studio Ghibli/MAPPA quality, cel-shading, expressive eyes, dynamic composition, Japanese animation aesthetic.',
  'wojak': 'Wojak meme art style, simple drawn characters with exaggerated emotional expressions, internet meme aesthetic, flat colors, minimalist background, cartoon style.',
  'stickmen': 'Stick figure art style, minimalist black line drawings, simple white or colored background, humor through simplicity, hand-drawn feel.',
  'realista': 'Hyper-photorealistic photography, 8K resolution, natural lighting, Sony A7R quality, lifelike detail.',
  'dark': 'Dark noir cinematic, deep crushed blacks, neon accent lighting, Blade Runner aesthetic, atmospheric fog, cyberpunk mood.',
  'whiteboard': 'Whiteboard animation style, black ink hand-drawn sketches on white background, educational illustration, clean lines.',
  'comic': 'Comic book / graphic novel art style, bold ink outlines, halftone dots, dynamic action panels, saturated colors, superhero comic aesthetic.',
  'hq': 'Comic book / graphic novel art style, bold ink outlines, halftone dots, dynamic action panels, saturated colors.',
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visualPrompt, textContent, segmentIndex, videoStyle, customStyleNotes, referenceImageUrls } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    if (!visualPrompt?.trim() && !textContent?.trim()) {
      throw new Error("Visual prompt or text content required");
    }

    // Determine style from videoStyle or default
    const styleKey = (videoStyle || 'cinematográfico').toLowerCase();
    const styleDesc = stylePromptMap[styleKey] || stylePromptMap['cinematográfico'];

    const basePrompt = visualPrompt?.trim()
      ? visualPrompt
      : `Scene for a YouTube video narration. Scene description based on this script segment: "${textContent}". Professional quality.`;

    // Build the full prompt respecting the user's chosen style
    let fullPrompt = `Generate a high-quality image in this EXACT style: ${styleDesc}\n\nScene: ${basePrompt}`;
    
    if (customStyleNotes) {
      fullPrompt += `\n\nAdditional style instructions from the creator: ${customStyleNotes}`;
    }

    fullPrompt += '\n\n16:9 aspect ratio composition. On a clean background.';

    // Build messages — include reference images if provided for style matching
    const messages: any[] = [];
    
    if (referenceImageUrls?.length > 0) {
      // Multi-modal: send reference images + text prompt
      const content: any[] = [
        { type: "text", text: `Study these reference images carefully — they show the EXACT visual style the creator wants. Generate a NEW image matching this SAME art style, color palette, and character design.\n\n${fullPrompt}` },
      ];
      // Include up to 3 reference images to stay within limits
      for (const url of referenceImageUrls.slice(0, 3)) {
        content.push({ type: "image_url", image_url: { url } });
      }
      messages.push({ role: "user", content });
    } else {
      messages.push({ role: "user", content: fullPrompt });
    }

    const response = await _ai({
        model: "google/gemini-3.1-flash-image-preview",
        messages,
        modalities: ["image", "text"],
      });

    if (!response.ok) {
      const t = await response.text();
      console.error("Image gen error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente.", retryAfter: 60 }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("No image generated");
    }

    return new Response(JSON.stringify({ imageUrl, segmentIndex }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-segment-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
