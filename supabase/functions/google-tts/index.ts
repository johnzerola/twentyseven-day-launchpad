import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gemini TTS voices (30 prebuilt) ──
const GEMINI_VOICES: { name: string; label: string; gender: string; style: string }[] = [
  { name: 'Zephyr', label: 'Zephyr (Bright)', gender: 'FEMALE', style: 'bright' },
  { name: 'Puck', label: 'Puck (Upbeat)', gender: 'MALE', style: 'upbeat' },
  { name: 'Charon', label: 'Charon (Informative)', gender: 'MALE', style: 'informative' },
  { name: 'Kore', label: 'Kore (Firm)', gender: 'FEMALE', style: 'firm' },
  { name: 'Fenrir', label: 'Fenrir (Excitable)', gender: 'MALE', style: 'excitable' },
  { name: 'Leda', label: 'Leda (Youthful)', gender: 'FEMALE', style: 'youthful' },
  { name: 'Orus', label: 'Orus (Firm)', gender: 'MALE', style: 'firm' },
  { name: 'Aoede', label: 'Aoede (Breezy)', gender: 'FEMALE', style: 'breezy' },
  { name: 'Callirrhoe', label: 'Callirrhoe (Easy-going)', gender: 'FEMALE', style: 'easy-going' },
  { name: 'Autonoe', label: 'Autonoe (Bright)', gender: 'FEMALE', style: 'bright' },
  { name: 'Enceladus', label: 'Enceladus (Breathy)', gender: 'MALE', style: 'breathy' },
  { name: 'Iapetus', label: 'Iapetus (Clear)', gender: 'MALE', style: 'clear' },
  { name: 'Umbriel', label: 'Umbriel (Easy-going)', gender: 'MALE', style: 'easy-going' },
  { name: 'Algieba', label: 'Algieba (Smooth)', gender: 'MALE', style: 'smooth' },
  { name: 'Despina', label: 'Despina (Smooth)', gender: 'FEMALE', style: 'smooth' },
  { name: 'Erinome', label: 'Erinome (Clear)', gender: 'FEMALE', style: 'clear' },
  { name: 'Algenib', label: 'Algenib (Gravelly)', gender: 'MALE', style: 'gravelly' },
  { name: 'Rasalgethi', label: 'Rasalgethi (Informative)', gender: 'MALE', style: 'informative' },
  { name: 'Laomedeia', label: 'Laomedeia (Upbeat)', gender: 'FEMALE', style: 'upbeat' },
  { name: 'Achernar', label: 'Achernar (Soft)', gender: 'FEMALE', style: 'soft' },
  { name: 'Alnilam', label: 'Alnilam (Firm)', gender: 'MALE', style: 'firm' },
  { name: 'Schedar', label: 'Schedar (Even)', gender: 'MALE', style: 'even' },
  { name: 'Gacrux', label: 'Gacrux (Mature)', gender: 'MALE', style: 'mature' },
  { name: 'Pulcherrima', label: 'Pulcherrima (Forward)', gender: 'FEMALE', style: 'forward' },
  { name: 'Achird', label: 'Achird (Friendly)', gender: 'MALE', style: 'friendly' },
  { name: 'Zubenelgenubi', label: 'Zubenelgenubi (Casual)', gender: 'MALE', style: 'casual' },
  { name: 'Vindemiatrix', label: 'Vindemiatrix (Gentle)', gender: 'FEMALE', style: 'gentle' },
  { name: 'Sadachbia', label: 'Sadachbia (Lively)', gender: 'FEMALE', style: 'lively' },
  { name: 'Sadaltager', label: 'Sadaltager (Knowledgeable)', gender: 'MALE', style: 'knowledgeable' },
  { name: 'Sulafat', label: 'Sulafat (Warm)', gender: 'FEMALE', style: 'warm' },
];

// Default voice per language for narration style
const LANG_DEFAULT_VOICE: Record<string, string> = {
  'português': 'Charon',
  'inglês': 'Charon',
  'english': 'Charon',
  'espanhol': 'Orus',
  'alemão': 'Schedar',
  'polonês': 'Rasalgethi',
  'turco': 'Algieba',
  'japonês': 'Iapetus',
};

// ── WAV header creation (PCM s16le → WAV) ──
function createWavHeader(dataLength: number, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function pcmToWav(pcmBase64: string): Uint8Array {
  const binaryStr = atob(pcmBase64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }
  const wavHeader = createWavHeader(pcmBytes.length);
  const wav = new Uint8Array(wavHeader.length + pcmBytes.length);
  wav.set(wavHeader, 0);
  wav.set(pcmBytes, wavHeader.length);
  return wav;
}

// ── Gemini TTS via Generative Language API ──
async function synthesizeWithGeminiTTS(
  text: string,
  apiKey: string,
  voiceName: string,
  speakingRate: number,
  voiceStyle?: string,
): Promise<Uint8Array> {
  // Build style instruction based on voiceStyle and speakingRate
  const VOICE_STYLE_PROMPTS: Record<string, string> = {
    'dopaminergico': 'Read this narration with INTENSE energy and magnetic charisma. Your voice must captivate — convey wonder, urgency, and raw emotion. Vary your pace DRAMATICALLY: slow down for revelations, speed up for excitement. Use vocal emphasis on key words. Make the listener FEEL every sentence. Deliver like a world-class documentary narrator who makes people unable to stop listening. Your voice should create DOPAMINE — anticipation, surprise, and reward in every phrase:\n',
    'misterioso': 'Read this narration with a mysterious, conspiratorial tone. Speak as if sharing secrets. Lower your voice for revelations. Use dramatic pauses before key moments. Create tension and intrigue with every sentence. The listener should feel like they are uncovering hidden truths:\n',
    'calmo': 'Read this narration with calm authority and warmth. Speak clearly and steadily, with gentle emphasis on important points. Your voice should be soothing yet engaging, like a trusted mentor sharing wisdom. Use measured pacing with thoughtful pauses:\n',
    'energetico': 'Read this narration with HIGH ENERGY and enthusiasm! Your voice should be dynamic, punchy, and exciting. Vary your tempo — fast for action, brief pauses for impact. Make every sentence feel urgent and important. Channel the energy of the best YouTube creators:\n',
  };

  let stylePrefix = VOICE_STYLE_PROMPTS[voiceStyle || ''] || '';
  if (!stylePrefix) {
    if (speakingRate < 0.9) stylePrefix = 'Read slowly and deliberately:\n';
    else if (speakingRate > 1.15) stylePrefix = 'Read at a brisk, energetic pace:\n';
  }

  const model = 'gemini-2.5-flash-preview-tts';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${stylePrefix}${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini TTS error:', response.status, errText);
    throw new Error(`GEMINI_TTS_${response.status}`);
  }

  const result = await response.json();
  const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('GEMINI_TTS_NO_AUDIO');

  // Convert raw PCM (s16le 24kHz mono) to WAV
  return pcmToWav(audioData);
}

// ── ElevenLabs fallback ──
const ELEVENLABS_FALLBACK_VOICES = {
  MALE: 'onwK4e9ZLuTAKqWW03F9',
  FEMALE: 'EXAVITQu4vr4xnSDxMaL',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function synthesizeWithElevenLabs(
  text: string,
  apiKey: string,
  speakingRate: number,
  gender: 'MALE' | 'FEMALE',
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const voiceId = ELEVENLABS_FALLBACK_VOICES[gender] || ELEVENLABS_FALLBACK_VOICES.MALE;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
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

  return { buffer: await response.arrayBuffer(), mimeType: 'audio/mpeg' };
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // List voices action
    if (action === 'list_voices') {
      return new Response(JSON.stringify({
        languageCode: 'auto',
        voices: GEMINI_VOICES.map(v => ({ name: v.name, label: v.label, gender: v.gender })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate audio
    const { text, language, voiceName, speakingRate = 1.0 } = body;
    if (!text?.trim()) throw new Error('Texto é obrigatório');

    const defaultVoice = LANG_DEFAULT_VOICE[language?.toLowerCase()] || 'Charon';
    // Map old Google Cloud TTS voice names to Gemini voices
    const isOldVoiceName = voiceName?.includes('-') && voiceName?.includes('Neural');
    const selectedVoice = isOldVoiceName ? defaultVoice : (voiceName || defaultVoice);
    const selectedVoiceMeta = GEMINI_VOICES.find(v => v.name === selectedVoice);
    const fallbackGender = selectedVoiceMeta?.gender === 'FEMALE' ? 'FEMALE' : 'MALE';

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    console.log(`TTS requested: voice=${selectedVoice}, lang=${language}, chars=${text.length}`);

    let audioBase64 = '';
    let mimeType = 'audio/wav';
    let engine = 'gemini-tts';
    let fallbackReason: string | null = null;

    // ── Try Gemini TTS (primary) ──
    try {
      if (!GOOGLE_AI_API_KEY) throw new Error('GEMINI_TTS_UNAVAILABLE');
      const wavBytes = await synthesizeWithGeminiTTS(text, GOOGLE_AI_API_KEY, selectedVoice, speakingRate);
      audioBase64 = base64Encode(wavBytes);
      mimeType = 'audio/wav';
    } catch (geminiError) {
      fallbackReason = geminiError instanceof Error ? geminiError.message : 'GEMINI_TTS_FAILED';
      console.warn('Gemini TTS failed, trying fallback:', fallbackReason);

      // ── ElevenLabs fallback ──
      if (ELEVENLABS_API_KEY) {
        try {
          const result = await synthesizeWithElevenLabs(text, ELEVENLABS_API_KEY, speakingRate, fallbackGender as 'MALE' | 'FEMALE');
          audioBase64 = base64Encode(new Uint8Array(result.buffer));
          mimeType = result.mimeType;
          engine = 'elevenlabs';
        } catch (elevenError) {
          console.warn('ElevenLabs fallback failed:', elevenError instanceof Error ? elevenError.message : elevenError);
        }
      }

      // ── Browser synthesis fallback ──
      if (!audioBase64) {
        return new Response(JSON.stringify({
          use_browser_synthesis: true,
          engine: 'browser-synthesis',
          text,
          languageCode: 'auto',
          voice: selectedVoice,
          characterCount: text.length,
          fallbackReason,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      audioBase64,
      mimeType,
      engine,
      voice: selectedVoice,
      languageCode: 'auto',
      chunks: 1,
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
