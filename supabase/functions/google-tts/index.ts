import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const ELEVENLABS_FALLBACK_VOICES = {
  MALE: 'onwK4e9ZLuTAKqWW03F9',
  FEMALE: 'EXAVITQu4vr4xnSDxMaL',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function splitText(text: string, maxChars = 4500) {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function decodeBase64Audio(audioContent: string) {
  const binaryString = atob(audioContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function mergeAudioBuffers(audioBuffers: ArrayBuffer[]) {
  let totalLength = 0;
  for (const buffer of audioBuffers) totalLength += buffer.byteLength;

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of audioBuffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return merged;
}

async function synthesizeWithGoogle(
  chunks: string[],
  apiKey: string,
  langCode: string,
  selectedVoice: string,
  speakingRate: number,
  pitch: number,
) {
  const audioBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: chunk },
          voice: {
            languageCode: langCode,
            name: selectedVoice,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate,
            pitch,
            sampleRateHertz: 24000,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google TTS error:', response.status, errText);
      if (response.status === 403) throw new Error('GOOGLE_TTS_PERMISSION_DENIED');
      if (response.status === 429) throw new Error('GOOGLE_TTS_RATE_LIMIT');
      throw new Error(`GOOGLE_TTS_${response.status}`);
    }

    const result = await response.json();
    audioBuffers.push(decodeBase64Audio(result.audioContent));
  }

  return audioBuffers;
}

async function synthesizeWithElevenLabs(
  chunks: string[],
  apiKey: string,
  speakingRate: number,
  gender: 'MALE' | 'FEMALE',
) {
  const audioBuffers: ArrayBuffer[] = [];
  const voiceId = ELEVENLABS_FALLBACK_VOICES[gender] || ELEVENLABS_FALLBACK_VOICES.MALE;

  for (let i = 0; i < chunks.length; i++) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: chunks[i],
          model_id: 'eleven_multilingual_v2',
          previous_text: i > 0 ? chunks[i - 1].slice(-400) : undefined,
          next_text: i < chunks.length - 1 ? chunks[i + 1].slice(0, 400) : undefined,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
            speed: clamp(speakingRate || 1, 0.7, 1.2),
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errText);
      throw new Error(`ELEVENLABS_TTS_${response.status}`);
    }

    audioBuffers.push(await response.arrayBuffer());
  }

  return audioBuffers;
}

async function synthesizeWithOpenAITTS(chunks: string[], apiKey: string, gender: 'MALE' | 'FEMALE') {
  const audioBuffers: ArrayBuffer[] = [];
  const voice = gender === 'FEMALE' ? 'nova' : 'onyx';

  for (const chunk of chunks) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: chunk,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI TTS error:', response.status, errText);
      throw new Error(`OPENAI_TTS_${response.status}`);
    }

    audioBuffers.push(await response.arrayBuffer());
  }

  return audioBuffers;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'list_voices') {
      const { language } = body;
      const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];
      return new Response(JSON.stringify({
        languageCode: langConfig.code,
        voices: langConfig.voices,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, language, voiceName, speakingRate = 1.0, pitch = 0 } = body;
    if (!text?.trim()) throw new Error('Texto é obrigatório');

    const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];
    const selectedVoice = voiceName || langConfig.voices[0].name;
    const selectedVoiceMeta = langConfig.voices.find((voice) => voice.name === selectedVoice);
    const fallbackGender = selectedVoiceMeta?.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    const chunks = splitText(text);

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    console.log(`Google TTS requested: ${chunks.length} chunks, voice=${selectedVoice}, lang=${langConfig.code}`);

    let audioBuffers: ArrayBuffer[] = [];
    let engine = 'google-cloud-tts';
    let fallbackReason: string | null = null;

    try {
      if (!GOOGLE_AI_API_KEY) throw new Error('GOOGLE_TTS_UNAVAILABLE');
      audioBuffers = await synthesizeWithGoogle(
        chunks,
        GOOGLE_AI_API_KEY,
        langConfig.code,
        selectedVoice,
        speakingRate,
        pitch,
      );
    } catch (googleError) {
      fallbackReason = googleError instanceof Error ? googleError.message : 'GOOGLE_TTS_FAILED';
      console.warn('Google TTS unavailable, starting fallback chain:', fallbackReason);

      if (ELEVENLABS_API_KEY) {
        try {
          audioBuffers = await synthesizeWithElevenLabs(chunks, ELEVENLABS_API_KEY, speakingRate, fallbackGender);
          engine = 'elevenlabs';
        } catch (elevenError) {
          console.warn('ElevenLabs fallback failed:', elevenError instanceof Error ? elevenError.message : elevenError);
        }
      }

      if (!audioBuffers.length && LOVABLE_API_KEY) {
        try {
          audioBuffers = await synthesizeWithLovableTTS(chunks, LOVABLE_API_KEY);
          engine = 'openai-tts';
        } catch (lovableError) {
          console.warn('Lovable TTS fallback failed:', lovableError instanceof Error ? lovableError.message : lovableError);
        }
      }

      if (!audioBuffers.length) {
        return new Response(JSON.stringify({
          use_browser_synthesis: true,
          engine: 'browser-synthesis',
          text,
          languageCode: langConfig.code,
          voice: selectedVoice,
          chunks: chunks.length,
          characterCount: text.length,
          fallbackReason,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const audioBase64 = base64Encode(mergeAudioBuffers(audioBuffers));

    return new Response(JSON.stringify({
      audioBase64,
      mimeType: 'audio/mpeg',
      engine,
      voice: selectedVoice,
      languageCode: langConfig.code,
      chunks: chunks.length,
      characterCount: text.length,
      fallbackReason,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('google-tts error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
