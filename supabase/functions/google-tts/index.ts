import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Google Cloud TTS language codes mapped from user-facing names ──
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

// ── Gemini TTS voices (30 prebuilt) — used as secondary engine ──
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

function isGeminiVoice(voiceName: string): boolean {
  return GEMINI_VOICES.some(v => v.name === voiceName);
}

// ── WAV header creation (PCM s16le → WAV) ──
function createWavHeader(dataLength: number, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);
  return new Uint8Array(header);
}

function pcmToWav(pcmBase64: string): Uint8Array {
  const binaryStr = atob(pcmBase64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) pcmBytes[i] = binaryStr.charCodeAt(i);
  const wavHeader = createWavHeader(pcmBytes.length);
  const wav = new Uint8Array(wavHeader.length + pcmBytes.length);
  wav.set(wavHeader, 0);
  wav.set(pcmBytes, wavHeader.length);
  return wav;
}

// ── Gemini TTS via Generative Language API (secondary engine) ──
async function synthesizeWithGeminiTTS(
  text: string, apiKey: string, voiceName: string, speakingRate: number, voiceStyle?: string,
): Promise<Uint8Array> {
  const VOICE_STYLE_PROMPTS: Record<string, string> = {
    'dopaminergico': `Read this narration with INTENSE energy and MAGNETIC charisma — like MrBeast meets top documentary narrator.
CRITICAL EMOTIONAL TECHNIQUES:
- Build tension with 0.3-0.5 second pauses before EVERY major reveal
- WHISPER on shocking moments (drop volume 40%, slow pace 20%)
- SHOUT with rising pitch on reveals and "impossível" moments
- Vary pace DRAMATICALLY: rapid-fire facts → sudden slow dramatic pause → explosive reveal
- Your voice should make listeners feel ADRENALINE and DOPAMINE
- Every sentence transition should feel like a mini-rollercoaster
- Use rhythmic patterns: short-short-short-LONG, building like music
- On emotional moments, let your voice CRACK slightly — vulnerability is magnetic
- Match the emotion markers in the text: [EMOÇÃO: choque] = gasp + pause, [EMOÇÃO: dopamina] = excited crescendo
Read with the passion of someone who DISCOVERED something incredible and CANNOT WAIT to share it:\n`,
    'misterioso': `Read this narration with a DEEP mysterious, conspiratorial tone that makes listeners lean in closer.
CRITICAL EMOTIONAL TECHNIQUES:
- Drop to near-WHISPER on dark moments — so quiet listeners turn up volume
- Let SILENCE hang for 0.5-0.8 seconds before key reveals — the anticipation IS the content
- Speak as if sharing a SECRET that could get you in trouble
- On revelation moments, shift from whisper to normal volume SUDDENLY — the contrast creates chills
- Use descending pitch patterns for dread, ascending for hope
- Breathe audibly before shocking facts — listeners mirror your tension
- Pacing: deliberate... measured... then suddenly RAPID when danger arrives
Read like a detective who just found the missing piece of the puzzle:\n`,
    'calmo': `Read this narration with calm authority, warmth, and the gravitas of a BBC/Netflix documentary narrator.
EMOTIONAL TECHNIQUES:
- Speak with quiet CONFIDENCE — every word carries weight
- Use measured pauses that give the listener time to ABSORB
- On emotional moments, let genuine warmth seep into your voice
- Maintain steady rhythm but SLOW DOWN on the most important revelations
- Your calmness should create TRUST — the listener believes every word
Read like David Attenborough discovering something that fills him with quiet wonder:\n`,
    'energetico': `Read this narration with EXPLOSIVE HIGH ENERGY and infectious enthusiasm!
CRITICAL EMOTIONAL TECHNIQUES:
- Every sentence should feel like the MOST IMPORTANT thing ever said
- Punchy, RHYTHMIC delivery — like a hip-hop flow meets TED talk
- ACCELERATE on exciting sequences, creating breathless urgency
- Use STACCATO rhythm for lists and reveals: "First. This. Then. THAT."
- Laugh or gasp naturally at genuinely surprising moments
- Your energy should be CONTAGIOUS — listeners should feel their heart rate increase
- On climactic moments, build a CRESCENDO — each word louder and faster
- Match [EMOÇÃO: dopamina] markers with peak energy bursts
Read like you just won the lottery AND discovered the meaning of life:\n`,
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
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gemini TTS error: ${response.status}`, errText);
    throw new Error(`GEMINI_TTS_${response.status}`);
  }
  const data = await response.json();
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('GEMINI_TTS_NO_AUDIO');
  return pcmToWav(audioData);
}

async function synthesizeWithGeminiTTSRetry(
  text: string, apiKey: string, voiceName: string, speakingRate: number, voiceStyle?: string,
): Promise<Uint8Array> {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await synthesizeWithGeminiTTS(text, apiKey, voiceName, speakingRate, voiceStyle);
    } catch (err: any) {
      const is429 = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (is429 && attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt) + Math.random() * 1000, 15000);
        console.warn(`Gemini TTS 429, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('GEMINI_TTS_RETRIES_EXHAUSTED');
}

// ── Google Cloud TTS (primary engine — separate quota from Gemini) ──
async function synthesizeWithGoogleCloudTTS(
  text: string, apiKey: string, voiceName: string, languageCode: string, speakingRate: number, pitch: number,
): Promise<{ buffer: Uint8Array; mimeType: string }> {
  const MAX_CHARS = 4500;
  const chunks: string[] = [];
  if (text.length <= MAX_CHARS) {
    chunks.push(text);
  } else {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > MAX_CHARS && current) { chunks.push(current.trim()); current = ''; }
      current += s;
    }
    if (current.trim()) chunks.push(current.trim());
  }

  console.log(`Google Cloud TTS: ${chunks.length} chunks, voice=${voiceName}, lang=${languageCode}`);
  const audioBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: chunk },
          voice: { languageCode, name: voiceName },
          audioConfig: { audioEncoding: 'MP3', speakingRate: speakingRate || 1.0, pitch: pitch || 0, sampleRateHertz: 24000 },
        }),
      }
    );
    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error('Google Cloud TTS error:', ttsResponse.status, errText);
      throw new Error(`GCLOUD_TTS_${ttsResponse.status}`);
    }
    const result = await ttsResponse.json();
    const binaryString = atob(result.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    audioBuffers.push(bytes.buffer);
  }

  let totalLength = 0;
  for (const buf of audioBuffers) totalLength += buf.byteLength;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioBuffers) { merged.set(new Uint8Array(buf), offset); offset += buf.byteLength; }

  return { buffer: merged, mimeType: 'audio/mpeg' };
}

// ── ElevenLabs fallback ──
const ELEVENLABS_FALLBACK_VOICES = { MALE: 'onwK4e9ZLuTAKqWW03F9', FEMALE: 'EXAVITQu4vr4xnSDxMaL' };

function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }

async function synthesizeWithElevenLabs(
  text: string, apiKey: string, speakingRate: number, gender: 'MALE' | 'FEMALE',
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const voiceId = ELEVENLABS_FALLBACK_VOICES[gender] || ELEVENLABS_FALLBACK_VOICES.MALE;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: clamp(speakingRate || 1, 0.7, 1.2) },
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

    // ── List voices ──
    if (action === 'list_voices') {
      const { language, engine } = body;
      // If user explicitly requests Gemini voices
      if (engine === 'gemini') {
        return new Response(JSON.stringify({
          languageCode: 'auto',
          voices: GEMINI_VOICES.map(v => ({ name: v.name, label: v.label, gender: v.gender })),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Default: Google Cloud TTS voices
      const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];
      return new Response(JSON.stringify({
        languageCode: langConfig.code,
        voices: langConfig.voices,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Generate audio ──
    const { text, language, voiceName, speakingRate = 1.0, pitch = 0, voiceStyle, returnBinary, userTier } = body;
    if (!text?.trim()) throw new Error('Texto é obrigatório');

    // ── TIER-BASED VOICE QUALITY ──
    // Starter: Standard voices only (R$4/1M chars) — saves R$0.64/video
    // Pro/Full: Neural2 voices (R$16/1M chars) — premium quality
    const isStarterTier = userTier === 'starter';
    const STARTER_VOICE_MAP: Record<string, string> = {
      'pt-BR-Neural2-B': 'pt-BR-Standard-B',
      'pt-BR-Neural2-C': 'pt-BR-Standard-C',
      'pt-BR-Neural2-A': 'pt-BR-Standard-A',
      'pt-BR-Wavenet-B': 'pt-BR-Standard-B',
      'pt-BR-Wavenet-C': 'pt-BR-Standard-C',
      'en-US-Neural2-D': 'en-US-Standard-D',
      'en-US-Neural2-F': 'en-US-Standard-F',
      'en-US-Neural2-A': 'en-US-Standard-A',
      'en-US-Neural2-C': 'en-US-Standard-C',
      'en-US-Wavenet-D': 'en-US-Standard-D',
      'en-US-Wavenet-F': 'en-US-Standard-F',
      'es-ES-Neural2-B': 'es-ES-Standard-B',
      'es-ES-Neural2-A': 'es-ES-Standard-A',
    };

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    const GOOGLE_TTS_API_KEY_2 = Deno.env.get('GOOGLE_TTS_API_KEY_2');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    // All Google API keys to try in order
    const googleKeys = [GOOGLE_AI_API_KEY, GOOGLE_TTS_API_KEY_2].filter(Boolean) as string[];
    const langConfig = LANG_MAP[language?.toLowerCase()] || LANG_MAP['português'];

    // Detect if user selected a Gemini voice (e.g. "Charon", "Zephyr")
    const useGeminiEngine = isGeminiVoice(voiceName);
    const selectedVoice = voiceName || langConfig.voices[0].name;
    const fallbackGender = useGeminiEngine
      ? (GEMINI_VOICES.find(v => v.name === selectedVoice)?.gender === 'FEMALE' ? 'FEMALE' : 'MALE')
      : (langConfig.voices.find(v => v.name === selectedVoice)?.gender === 'FEMALE' ? 'FEMALE' : 'MALE');

    console.log(`TTS requested: voice=${selectedVoice}, engine=${useGeminiEngine ? 'gemini' : 'gcloud'}, lang=${language}, chars=${text.length}`);

    // ══════ ENGINE 1: Google Cloud TTS (try all keys) ══════
    if (!useGeminiEngine) {
      for (const key of googleKeys) {
        try {
          const result = await synthesizeWithGoogleCloudTTS(
            text, key, selectedVoice, langConfig.code, speakingRate, pitch,
          );
          if (returnBinary) {
            return new Response(result.buffer, {
              headers: { ...corsHeaders, 'Content-Type': result.mimeType },
            });
          }
          const audioBase64 = base64Encode(result.buffer);
          return new Response(JSON.stringify({
            audioBase64, mimeType: result.mimeType, engine: 'google-cloud-tts',
            voice: selectedVoice, languageCode: langConfig.code, chunks: 1, characterCount: text.length,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (gcloudErr) {
          const reason = gcloudErr instanceof Error ? gcloudErr.message : 'GCLOUD_TTS_FAILED';
          console.warn('Google Cloud TTS failed with key:', reason, '— trying next key');
        }
      }
    }

    // ══════ ENGINE 2: Gemini TTS (try all keys) ══════
    for (const key of googleKeys) {
      try {
        const geminiVoice = useGeminiEngine ? selectedVoice : 'Charon';
        const wavBytes = await synthesizeWithGeminiTTSRetry(text, key, geminiVoice, speakingRate, voiceStyle);
        if (returnBinary) {
          return new Response(wavBytes, {
            headers: { ...corsHeaders, 'Content-Type': 'audio/wav', 'Content-Length': String(wavBytes.length) },
          });
        }
        const audioBase64 = base64Encode(wavBytes);
        return new Response(JSON.stringify({
          audioBase64, mimeType: 'audio/wav', engine: 'gemini-tts',
          voice: geminiVoice, languageCode: 'auto', chunks: 1, characterCount: text.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (geminiErr) {
        const reason = geminiErr instanceof Error ? geminiErr.message : 'GEMINI_TTS_FAILED';
        console.warn('Gemini TTS failed with key:', reason, '— trying next');
      }
    }

    // ══════ ENGINE 2.5: Gemini TTS via Lovable AI Gateway (separate quota) ══════
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        console.log('Trying Lovable AI Gateway TTS fallback...');
        const geminiVoice = useGeminiEngine ? selectedVoice : 'Charon';
        const VOICE_STYLE_PROMPTS_GATEWAY: Record<string, string> = {
          'dopaminergico': 'Read with INTENSE energy and MAGNETIC charisma. Build tension with pauses before reveals. WHISPER on shocking moments. SHOUT on reveals. Vary pace DRAMATICALLY.',
          'misterioso': 'Read with a DEEP mysterious, conspiratorial tone. Drop to near-WHISPER on dark moments. Let SILENCE hang before key reveals.',
          'energetico': 'Read with EXPLOSIVE HIGH ENERGY. Every sentence should feel like the MOST IMPORTANT thing ever said. Punchy, RHYTHMIC delivery.',
          'calmo': 'Read with calm authority and warmth. Speak with quiet CONFIDENCE — every word carries weight.',
        };
        const styleInstr = VOICE_STYLE_PROMPTS_GATEWAY[voiceStyle || ''] || '';
        const ttsPrompt = styleInstr ? `${styleInstr}\n\nNarrate this text:\n${text}` : `Narrate this text with professional quality:\n${text}`;

        const gatewayRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            modalities: ['AUDIO'],
            audio: { voice: geminiVoice },
            messages: [{ role: 'user', content: ttsPrompt }],
          }),
        });

        if (gatewayRes.ok) {
          const gData = await gatewayRes.json();
          const audioContent = gData.choices?.[0]?.message?.audio?.data;
          if (audioContent) {
            const wavBytes = pcmToWav(audioContent);
            if (returnBinary) {
              return new Response(wavBytes, {
                headers: { ...corsHeaders, 'Content-Type': 'audio/wav', 'Content-Length': String(wavBytes.length) },
              });
            }
            const audioBase64 = base64Encode(wavBytes);
            return new Response(JSON.stringify({
              audioBase64, mimeType: 'audio/wav', engine: 'lovable-gateway-tts',
              voice: geminiVoice, languageCode: 'auto', chunks: 1, characterCount: text.length,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else {
          const errText = await gatewayRes.text();
          console.warn('Lovable Gateway TTS failed:', gatewayRes.status, errText.slice(0, 200));
        }
      } catch (gwErr) {
        console.warn('Lovable Gateway TTS error:', gwErr instanceof Error ? gwErr.message : gwErr);
      }
    }

    // ══════ ENGINE 3: ElevenLabs fallback ══════
    if (ELEVENLABS_API_KEY) {
      try {
        const result = await synthesizeWithElevenLabs(text, ELEVENLABS_API_KEY, speakingRate, fallbackGender as 'MALE' | 'FEMALE');
        if (returnBinary) {
          return new Response(result.buffer, {
            headers: { ...corsHeaders, 'Content-Type': result.mimeType },
          });
        }
        const audioBase64 = base64Encode(new Uint8Array(result.buffer));
        return new Response(JSON.stringify({
          audioBase64, mimeType: result.mimeType, engine: 'elevenlabs',
          voice: selectedVoice, languageCode: 'auto', chunks: 1, characterCount: text.length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (elevenErr) {
        console.warn('ElevenLabs fallback failed:', elevenErr instanceof Error ? elevenErr.message : elevenErr);
      }
    }

    // ══════ ENGINE 4: Browser synthesis (last resort) ══════
    return new Response(JSON.stringify({
      use_browser_synthesis: true, engine: 'browser-synthesis',
      text, languageCode: langConfig.code, voice: selectedVoice,
      characterCount: text.length, fallbackReason: 'ALL_ENGINES_FAILED',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('google-tts error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
