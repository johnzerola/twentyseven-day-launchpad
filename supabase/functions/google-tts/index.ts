import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Google Cloud TTS language codes mapped from user-facing names
const LANG_MAP: Record<string, { code: string; voices: { name: string; label: string; gender: string }[] }> = {
  'português': {
    code: 'pt-BR',
    voices: [
      { name: 'pt-BR-Neural2-B', label: 'Lucas (Masculino Neural)', gender: 'MALE' },
      { name: 'pt-BR-Neural2-C', label: 'Ana (Feminino Neural)', gender: 'FEMALE' },
      { name: 'pt-BR-Neural2-A', label: 'Pedro (Masculino Neural 2)', gender: 'MALE' },
      { name: 'pt-BR-Wavenet-B', label: 'Rafael (Masculino Wavenet)', gender: 'MALE' },
      { name: 'pt-BR-Wavenet-C', label: 'Camila (Feminino Wavenet)', gender: 'FEMALE' },
      { name: 'pt-BR-Standard-B', label: 'Bruno (Masculino Standard)', gender: 'MALE' },
    ],
  },
  'inglês': {
    code: 'en-US',
    voices: [
      { name: 'en-US-Neural2-D', label: 'James (Male Neural)', gender: 'MALE' },
      { name: 'en-US-Neural2-F', label: 'Sarah (Female Neural)', gender: 'FEMALE' },
      { name: 'en-US-Neural2-A', label: 'Alex (Male Neural 2)', gender: 'MALE' },
      { name: 'en-US-Neural2-C', label: 'Emma (Female Neural 2)', gender: 'FEMALE' },
      { name: 'en-US-Wavenet-D', label: 'David (Male Wavenet)', gender: 'MALE' },
      { name: 'en-US-Wavenet-F', label: 'Lily (Female Wavenet)', gender: 'FEMALE' },
    ],
  },
  'english': {
    code: 'en-US',
    voices: [
      { name: 'en-US-Neural2-D', label: 'James (Male Neural)', gender: 'MALE' },
      { name: 'en-US-Neural2-F', label: 'Sarah (Female Neural)', gender: 'FEMALE' },
    ],
  },
  'espanhol': {
    code: 'es-ES',
    voices: [
      { name: 'es-ES-Neural2-B', label: 'Carlos (Masculino Neural)', gender: 'MALE' },
      { name: 'es-ES-Neural2-A', label: 'María (Feminino Neural)', gender: 'FEMALE' },
    ],
  },
  'alemão': {
    code: 'de-DE',
    voices: [
      { name: 'de-DE-Neural2-B', label: 'Hans (Männlich Neural)', gender: 'MALE' },
      { name: 'de-DE-Neural2-C', label: 'Anna (Weiblich Neural)', gender: 'FEMALE' },
    ],
  },
  'polonês': {
    code: 'pl-PL',
    voices: [
      { name: 'pl-PL-Wavenet-B', label: 'Jan (Męski Wavenet)', gender: 'MALE' },
      { name: 'pl-PL-Wavenet-A', label: 'Ewa (Żeński Wavenet)', gender: 'FEMALE' },
    ],
  },
  'turco': {
    code: 'tr-TR',
    voices: [
      { name: 'tr-TR-Wavenet-B', label: 'Mehmet (Erkek Wavenet)', gender: 'MALE' },
      { name: 'tr-TR-Wavenet-C', label: 'Ayşe (Kadın Wavenet)', gender: 'FEMALE' },
    ],
  },
  'japonês': {
    code: 'ja-JP',
    voices: [
      { name: 'ja-JP-Neural2-C', label: 'Kenji (男性 Neural)', gender: 'MALE' },
      { name: 'ja-JP-Neural2-B', label: 'Yuki (女性 Neural)', gender: 'FEMALE' },
    ],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY não configurada");

    const body = await req.json();
    const { action } = body;

    // Action: list voices for a language
    if (action === "list_voices") {
      const { language } = body;
      const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];
      return new Response(JSON.stringify({
        languageCode: langConfig.code,
        voices: langConfig.voices,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: synthesize text
    const { text, language, voiceName, speakingRate, pitch } = body;
    if (!text?.trim()) throw new Error("Texto é obrigatório");

    const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];
    const selectedVoice = voiceName || langConfig.voices[0].name;

    // Split long text into chunks (max 5000 bytes for Google TTS)
    const MAX_CHARS = 4500;
    const chunks: string[] = [];
    if (text.length <= MAX_CHARS) {
      chunks.push(text);
    } else {
      // Split by sentences
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > MAX_CHARS) {
          if (current) chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }

    console.log(`Google TTS: ${chunks.length} chunks, voice=${selectedVoice}, lang=${langConfig.code}`);

    const audioBuffers: ArrayBuffer[] = [];

    for (const chunk of chunks) {
      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_AI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: chunk },
            voice: {
              languageCode: langConfig.code,
              name: selectedVoice,
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: speakingRate || 1.0,
              pitch: pitch || 0,
              sampleRateHertz: 24000,
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        const errText = await ttsResponse.text();
        console.error("Google TTS error:", ttsResponse.status, errText);
        if (ttsResponse.status === 403) throw new Error("Google Cloud TTS não habilitado ou API key sem permissão. Ative a API Text-to-Speech no Google Cloud Console.");
        if (ttsResponse.status === 429) throw new Error("Limite de requisições do Google TTS atingido. Tente novamente em alguns minutos.");
        throw new Error(`Erro no Google TTS: ${ttsResponse.status}`);
      }

      const result = await ttsResponse.json();
      // Google returns audioContent as base64
      const binaryString = atob(result.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBuffers.push(bytes.buffer);
    }

    // Merge audio buffers
    let totalLength = 0;
    for (const buf of audioBuffers) totalLength += buf.byteLength;
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      merged.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }

    const audioBase64 = base64Encode(merged);

    return new Response(JSON.stringify({
      audioBase64,
      mimeType: "audio/mpeg",
      engine: "google-cloud-tts",
      voice: selectedVoice,
      languageCode: langConfig.code,
      chunks: chunks.length,
      characterCount: text.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-tts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
