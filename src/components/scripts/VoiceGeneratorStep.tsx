import { useState, useEffect, useRef } from 'react';
import { Mic, Play, Pause, Download, Loader2, Volume2, RefreshCw, Upload, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

export const VoiceGeneratorStep = ({
  script, language, onAudioGenerated, onNavigate, existingAudioUrl,
}: VoiceGeneratorStepProps) => {
  const [ttsLanguage, setTtsLanguage] = useState(language || 'português');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load voices when language changes
  useEffect(() => {
    loadVoices(ttsLanguage);
  }, [ttsLanguage]);

  const loadVoices = async (lang: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'list_voices', language: lang }),
        }
      );
      const data = await response.json();
      if (data.voices) {
        setVoices(data.voices);
        setSelectedVoice(data.voices[0]?.name || '');
      }
    } catch {
      // fallback
      setVoices([]);
    }
  };

  // Clean narration text (remove markdown, headers, etc)
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

  const generateAudio = async () => {
    const text = getCleanText();
    if (!text) { toast.error('Roteiro vazio'); return; }
    if (text.length > 50000) { toast.error('Roteiro muito longo (máx 50.000 caracteres)'); return; }

    setGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text,
            language: ttsLanguage,
            voiceName: selectedVoice,
            speakingRate,
            pitch,
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const url = `data:audio/mpeg;base64,${data.audioBase64}`;
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      setAudioUrl(objectUrl);
      onAudioGenerated(blob, objectUrl);
      const engineLabel = data.engine === 'elevenlabs'
        ? 'ElevenLabs'
        : data.engine === 'openai-tts'
          ? 'TTS secundário'
          : 'Google TTS';
      toast.success(`🎙️ Áudio gerado com ${engineLabel}! (${data.characterCount.toLocaleString()} caracteres, ${data.chunks} partes)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar áudio');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Máximo 100MB'); return;
    }
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    onAudioGenerated(file, url);
    toast.success('Áudio carregado!');
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
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
    if (!text) { return; }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charCount = getCleanText().length;
  const estimatedMinutes = Math.ceil(charCount / 900); // ~900 chars/min for narration

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
        <Badge variant="secondary" className="gap-1.5 py-1.5 px-3 bg-primary/10 text-primary border-primary/20">
          💰 TTS com fallback automático
        </Badge>
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

      {/* Voice Selection */}
      {voices.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Voz</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {voices.map(v => (
              <button
                key={v.name}
                onClick={() => setSelectedVoice(v.name)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedVoice === v.name
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <span className="text-lg">{v.gender === 'MALE' ? '🧑' : '👩'}</span>
                <div>
                  <p className="text-xs font-medium">{v.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.name.includes('Neural') ? '✨ Neural' : v.name.includes('Wavenet') ? '🌊 Wavenet' : '📢 Standard'}
                  </p>
                </div>
              </button>
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
            <Slider
              value={[speakingRate]}
              onValueChange={([v]) => setSpeakingRate(v)}
              min={0.5} max={2.0} step={0.1}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center justify-between">
              Tom (pitch)
              <Badge variant="outline" className="text-[10px]">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}</Badge>
            </label>
            <Slider
              value={[pitch]}
              onValueChange={([v]) => setPitch(v)}
              min={-10} max={10} step={0.5}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={generateAudio}
          disabled={generating || !script.trim()}
          className="gap-2"
          size="lg"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando narração...</>
          ) : (
            <><Mic className="w-4 h-4" /> Gerar Narração com IA</>
          )}
        </Button>

        <div className="relative">
          <Button variant="outline" size="lg" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" /> Subir meu áudio
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {uploadedFile ? `📎 ${uploadedFile.name}` : '🎙️ Narração gerada'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={togglePlay} className="gap-1.5">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pausar' : 'Ouvir'}
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadAudio} className="gap-1.5">
                <Download className="w-4 h-4" /> Baixar MP3
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadTranscript} className="gap-1.5">
                <FileText className="w-4 h-4" /> Baixar TXT
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
          <p className="text-[10px] text-muted-foreground">
            💡 Este áudio pode ser usado automaticamente na etapa de Cenas para sincronizar os prompts visuais com a narração.
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
        <p className="text-xs font-semibold text-primary">💡 Como funciona</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>O sistema tenta Google TTS primeiro e usa fallback automático se indisponível</li>
          <li>Vozes premium mantêm a geração funcionando mesmo com falha de permissão no Google</li>
          <li>Na próxima etapa (Cenas), você pode usar este áudio ou subir outro</li>
          <li>O áudio gerado será transcrito automaticamente para sincronizar as cenas</li>
        </ul>
      </div>

      <StepNavButtons currentStep="voice" onNavigate={onNavigate} />
    </motion.div>
  );
};
