import { callGeminiOpenAICompat } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { assertBudget, logCost } from "../_shared/cost-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function elevenLabsTTS(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text, model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 1.0 },
      }),
    }
  );
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 401) throw new Error("ElevenLabs API key inválida");
    if (response.status === 429) throw new Error("Rate limit ElevenLabs");
    throw new Error(`ElevenLabs error: ${response.status} ${errText}`);
  }
  return response.arrayBuffer();
}

async function openAITTS(text: string, _key: string): Promise<ArrayBuffer> {
  // Deprecated: OpenAI TTS fallback removed (gateway credits exhausted)
  // Primary TTS is google-tts, ElevenLabs is secondary
  throw new Error("OpenAI TTS fallback disabled — use google-tts instead");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ═══ AUTH CHECK ═══
    const authHeader = req.headers.get("authorization") || '';
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const _authSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: _claims, error: _authErr } = await _authSb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authErr || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text, voiceId, segmentIndex } = await req.json();
    if (!text?.trim()) throw new Error("Text is required");

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const voice = voiceId || "onwK4e9ZLuTAKqWW03F9";
    let audioBuffer: ArrayBuffer;
    let usedEngine = "elevenlabs";

    // Fallback chain: ElevenLabs → OpenAI TTS → browser synthesis
    if (ELEVENLABS_API_KEY) {
      try {
        audioBuffer = await elevenLabsTTS(text, voice, ELEVENLABS_API_KEY);
      } catch (e) {
        console.warn("ElevenLabs failed, trying OpenAI TTS:", (e as Error).message);
        if (GOOGLE_AI_API_KEY) {
          try {
            audioBuffer = await openAITTS(text, GOOGLE_AI_API_KEY);
            usedEngine = "openai";
          } catch (e2) {
            console.warn("OpenAI TTS also failed:", (e2 as Error).message);
            return new Response(JSON.stringify({ error: "all_tts_failed", use_browser_synthesis: true, text }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          return new Response(JSON.stringify({ error: "all_tts_failed", use_browser_synthesis: true, text }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else if (GOOGLE_AI_API_KEY) {
      audioBuffer = await openAITTS(text, GOOGLE_AI_API_KEY);
      usedEngine = "openai";
    } else {
      return new Response(JSON.stringify({ error: "No TTS API keys configured", use_browser_synthesis: true, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBase64 = base64Encode(audioBuffer!);
    return new Response(JSON.stringify({ audioBase64, segmentIndex, mimeType: "audio/mpeg", engine: usedEngine }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elevenlabs-tts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
