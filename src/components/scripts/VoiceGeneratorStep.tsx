import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Play, Pause, Download, Loader2, Volume2, RefreshCw, Upload, ChevronDown, FileText, Sparkles, Headphones, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { StepNavButtons } from './StepNavButtons';
import type { PipelineStep } from './PipelineStepper';

interface VoiceGeneratorStepProps {
  script: string;
  language: string;
  onAudioGenerated: (audioBlob: Blob, audioUrl: string) => void;
  onNavigate: (step: PipelineStep) => void;
  existingAudioUrl?: string;
}

interface VoiceOption {
  name: string;
  label: string;
  gender: string;
}

const TTS_LANGUAGES = [
  { value: 'português', label: '🇧🇷 Português (BR)', flag: '🇧🇷' },
  { value: 'inglês', label: '🇺🇸 English (US)', flag: '🇺🇸' },
  { value: 'espanhol', label: '🇪🇸 Español', flag: '🇪🇸' },
  { value: 'alemão', label: '🇩🇪 Deutsch', flag: '🇩🇪' },
  { value: 'polonês', label: '🇵🇱 Polski', flag: '🇵🇱' },
  { value: 'turco', label: '🇹🇷 Türkçe', flag: '🇹🇷' },
  { value: 'japonês', label: '🇯🇵 日本語', flag: '🇯🇵' },
];

const VOICE_STYLES = [
  { value: 'dopaminergico', label: 'Dopaminérgico', emoji: '⚡', desc: 'Carisma intenso, variação dramática, urgência narrativa — MrBeast style', color: 'border-primary bg-primary/10' },
  { value: 'misterioso', label: 'Misterioso', emoji: '🌑', desc: 'Suspense envolvente, pausas calculadas, tom grave e intrigante', color: 'border-chart-4 bg-chart-4/10' },
  { value: 'energetico', label: 'Energético', emoji: '🔥', desc: 'Alto impacto, ritmo acelerado, entusiasmo contagiante', color: 'border-destructive bg-destructive/10' },
  { value: 'calmo', label: 'Calmo', emoji: '🧘', desc: 'Voz serena, autoritativa e profissional — documentário', color: 'border-chart-2 bg-chart-2/10' },
];

// Voice preview phrases per language
const PREVIEW_PHRASES: Record<string, string> = {
  'português': 'Você não vai acreditar no que aconteceu! Esta é uma prévia da minha voz.',
  'inglês': "You won't believe what happened next! This is a preview of my voice.",
  'english': "You won't believe what happened next! This is a preview of my voice.",
  'espanhol': '¡No vas a creer lo que pasó después! Esta es una vista previa de mi voz.',
  'alemão': 'Sie werden nicht glauben, was als nächstes passiert ist! Dies ist eine Vorschau meiner Stimme.',
  'polonês': 'Nie uwierzysz, co się stało! To jest podgląd mojego głosu.',
  'turco': 'Sonra ne olduğuna inanamayacaksınız! Bu benim sesimin bir önizlemesi.',
  'japonês': '次に何が起こったか信じられないでしょう！これは私の声のプレビューです。',
};

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`;
const TTS_HEADERS = {
  'Content-Type': 'application/json',
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

// Max chars per chunk to avoid memory limit on edge function
const MAX_CHUNK_CHARS = 2500;

/** Split text at sentence boundaries into chunks ≤ maxLen */
function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export const VoiceGeneratorStep = ({
  script, language, onAudioGenerated, onNavigate, existingAudioUrl,
}: VoiceGeneratorStepProps) => {
  const [ttsLanguage, setTtsLanguage] = useState(language || 'português');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('dopaminergico');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => { loadVoices(ttsLanguage); }, [ttsLanguage]);

  const loadVoices = async (lang: string) => {
    try {
      const response = await fetch(TTS_URL, {
        method: 'POST', headers: TTS_HEADERS,
        body: JSON.stringify({ action: 'list_voices', language: lang }),
      });
      const data = await response.json();
      if (data.voices) {
        setVoices(data.voices);
        setSelectedVoice(data.voices[0]?.name || '');
      }
    } catch { setVoices([]); }
  };

  const getCleanText = () => {
    return script
      .replace(/^#+\s.*$/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[.*?\]/g, '')
      .replace(/---+/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^\s*[-•●]\s*/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  /** Call TTS for a single chunk, returns audio Blob */
  const generateChunk = async (text: string): Promise<Blob | null> => {
    const response = await fetch(TTS_URL, {
      method: 'POST', headers: TTS_HEADERS,
      body: JSON.stringify({
        text, language: ttsLanguage,
        voiceName: selectedVoice, voiceStyle, speakingRate, pitch,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (data.use_browser_synthesis) return null; // fallback signal

    const mime = data.mimeType || 'audio/mpeg';
    const url = `data:${mime};base64,${data.audioBase64}`;
    const res = await fetch(url);
    return res.blob();
  };

  const generateAudio = async () => {
    const text = getCleanText();
    if (!text) { toast.error('Roteiro vazio'); return; }
    if (text.length > 50000) { toast.error('Roteiro muito longo (máx 50.000 caracteres)'); return; }

    setGenerating(true);
    setProgress(0);
    abortRef.current = false;

    try {
      const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS);
      const totalChunks = chunks.length;
      setProgressLabel(`0 / ${totalChunks} partes`);

      const audioBlobs: Blob[] = [];

      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) { toast.info('Geração cancelada'); return; }
        setProgressLabel(`${i + 1} / ${totalChunks} partes`);
        setProgress(Math.round(((i) / totalChunks) * 100));

        const blob = await generateChunk(chunks[i]);
        if (!blob) {
          // Browser synthesis fallback for the whole text
          if (!('speechSynthesis' in window)) throw new Error('Nenhum provedor de voz disponível');
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'pt-BR';
          utterance.rate = Math.min(Math.max(speakingRate, 0.7), 1.2);
          window.speechSynthesis.speak(utterance);
          toast.warning('🎙️ Usando voz local do navegador.');
          return;
        }
        audioBlobs.push(blob);
      }

      setProgress(100);
      setProgressLabel('Finalizando...');

      // Concatenate all audio blobs
      const finalBlob = new Blob(audioBlobs, { type: audioBlobs[0]?.type || 'audio/wav' });
      const objectUrl = URL.createObjectURL(finalBlob);
      setAudioUrl(objectUrl);
      onAudioGenerated(finalBlob, objectUrl);

      const styleLabel = VOICE_STYLES.find(s => s.value === voiceStyle)?.label || voiceStyle;
      toast.success(`🎙️ Narração gerada! (${text.length.toLocaleString()} caracteres, ${totalChunks} partes, estilo ${styleLabel})`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar áudio');
    } finally {
      setGenerating(false);
      setProgress(0);
      setProgressLabel('');
    }
  };

  /** Preview a voice with a short phrase */
  const previewVoice = useCallback(async (voiceName: string) => {
    if (previewingVoice) {
      // Stop current preview
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
      if (previewingVoice === voiceName) { setPreviewingVoice(null); return; }
    }
    setPreviewingVoice(voiceName);
    try {
      const phrase = PREVIEW_PHRASES[ttsLanguage] || PREVIEW_PHRASES['português'];
      const response = await fetch(TTS_URL, {
        method: 'POST', headers: TTS_HEADERS,
        body: JSON.stringify({
          text: phrase, language: ttsLanguage,
          voiceName, voiceStyle, speakingRate: 1.0,
        }),
      });
      const data = await response.json();
      if (data.error || data.use_browser_synthesis) {
        toast.error('Não foi possível gerar prévia');
        setPreviewingVoice(null);
        return;
      }
      const mime = data.mimeType || 'audio/mpeg';
      const url = `data:${mime};base64,${data.audioBase64}`;
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoice(null);
      audio.onerror = () => setPreviewingVoice(null);
      await audio.play();
    } catch {
      toast.error('Erro ao gerar prévia');
      setPreviewingVoice(null);
    }
  }, [previewingVoice, ttsLanguage, voiceStyle]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error('Máximo 100MB'); return; }
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    onAudioGenerated(file, url);
    toast.success('Áudio carregado!');
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `narration-${Date.now()}.mp3`;
    a.click();
  };

  const downloadTranscript = () => {
    const text = getCleanText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charCount = getCleanText().length;
  const estimatedMinutes = Math.ceil(charCount / 900);
  const estimatedChunks = Math.ceil(charCount / MAX_CHUNK_CHARS);

  return (
    <motion.div
      key="voice"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="bg-card border border-border rounded-xl p-5 space-y-5"
    >
      <div>
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" /> Gerar Voz / Narração
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gere a narração com fallback automático de voz ou suba seu próprio áudio
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          📝 {charCount.toLocaleString()} caracteres
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          ⏱️ ~{estimatedMinutes} min de áudio
        </Badge>
        {estimatedChunks > 1 && (
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
            📦 {estimatedChunks} partes
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 bg-primary/10 text-primary border-primary/20">
          💰 TTS com fallback automático
        </Badge>
      </div>

      {/* Voice Style Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Estilo de Voz
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {VOICE_STYLES.map(style => (
            <button
              key={style.value}
              onClick={() => setVoiceStyle(style.value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                voiceStyle === style.value
                  ? `${style.color} shadow-md scale-[1.02]`
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span className="text-2xl">{style.emoji}</span>
              <span className="text-xs font-semibold">{style.label}</span>
              <span className="text-[9px] text-muted-foreground leading-tight">{style.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Idioma da Narração</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {TTS_LANGUAGES.map(lang => (
            <button
              key={lang.value}
              onClick={() => setTtsLanguage(lang.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                ttsLanguage === lang.value
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="text-[10px] font-medium">{lang.label.split(' ')[1] || lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Selection with Preview */}
      {voices.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            🎤 Voz <span className="text-[9px] font-normal text-muted-foreground/70 ml-1">(clique em 🎧 para ouvir prévia)</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {voices.map(v => (
              <div
                key={v.name}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  selectedVoice === v.name
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <button
                  onClick={() => setSelectedVoice(v.name)}
                  className="flex items-center gap-2.5 flex-1 text-left"
                >
                  <span className="text-lg">{v.gender === 'MALE' ? '🧑' : '👩'}</span>
                  <div>
                    <p className="text-xs font-medium">{v.label}</p>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); previewVoice(v.name); }}
                  className={`p-1.5 rounded-lg transition-all ${
                    previewingVoice === v.name
                      ? 'bg-primary text-primary-foreground animate-pulse'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title={`Ouvir prévia de ${v.name}`}
                >
                  {previewingVoice === v.name ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Headphones className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        Ajustes avançados
      </button>
      {showAdvanced && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-border/50">
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center justify-between">
              Velocidade da fala
              <Badge variant="outline" className="text-[10px]">{speakingRate.toFixed(1)}x</Badge>
            </label>
            <Slider value={[speakingRate]} onValueChange={([v]) => setSpeakingRate(v)} min={0.5} max={2.0} step={0.1} className="w-full" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center justify-between">
              Tom (pitch)
              <Badge variant="outline" className="text-[10px]">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}</Badge>
            </label>
            <Slider value={[pitch]} onValueChange={([v]) => setPitch(v)} min={-10} max={10} step={0.5} className="w-full" />
          </div>
        </div>
      )}

      {/* Progress bar during generation */}
      {generating && (
        <div className="space-y-2 p-4 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Gerando narração...
            </span>
            <span className="text-xs text-muted-foreground">{progressLabel}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">
            O texto foi dividido em partes menores para evitar erros de memória. Cada parte é gerada sequencialmente.
          </p>
          <Button variant="ghost" size="sm" onClick={() => { abortRef.current = true; }} className="text-xs text-destructive">
            Cancelar
          </Button>
        </div>
      )}

      {/* Actions */}
      {!generating && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={generateAudio} disabled={generating || !script.trim()} className="gap-2" size="lg">
            <Mic className="w-4 h-4" /> Gerar Narração com IA
          </Button>
          <div className="relative">
            <Button variant="outline" size="lg" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Subir meu áudio
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
      )}

      {/* Audio Player */}
      {audioUrl && !generating && (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {uploadedFile ? `📎 ${uploadedFile.name}` : '🎙️ Narração gerada'}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={togglePlay} className="gap-1.5">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pausar' : 'Ouvir'}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadAudio} className="gap-1.5">
                <Download className="w-4 h-4" /> Baixar
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadTranscript} className="gap-1.5">
                <FileText className="w-4 h-4" /> TXT
              </Button>
              <Button variant="ghost" size="sm" onClick={generateAudio} className="gap-1.5" disabled={generating}>
                <RefreshCw className="w-4 h-4" /> Refazer
              </Button>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="w-full"
            controls
          />
        </div>
      )}

      {/* Info box */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
        <p className="text-xs font-semibold text-primary">💡 Como funciona</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Escolha o <strong>Estilo de Voz</strong> para definir a personalidade da narração</li>
          <li>Clique em 🎧 ao lado de cada voz para ouvir uma prévia antes de gerar</li>
          <li>Textos longos são divididos automaticamente em partes para evitar falhas</li>
          <li>O sistema usa Gemini TTS com fallback automático para ElevenLabs e voz do navegador</li>
        </ul>
      </div>

      <StepNavButtons currentStep="voice" onNavigate={onNavigate} />
    </motion.div>
  );
};
