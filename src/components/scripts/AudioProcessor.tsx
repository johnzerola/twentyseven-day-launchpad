import { useState, useRef } from 'react';
import { Upload, Trash2, Sparkles, Loader2, Mic, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import type { SyncedScene, TranscriptionData, Character, VideoStyleOption } from './types';

interface AudioProcessorProps {
  script: string;
  videoStyle: string;
  videoStyles: VideoStyleOption[];
  characters: Character[];
  language: string;
  niche: string;
  sceneBlueprintJson: any[];
  syncedScenes: SyncedScene[];
  setSyncedScenes: (scenes: SyncedScene[]) => void;
  getCleanNarration: () => string;
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const AudioProcessor = ({
  script, videoStyle, videoStyles, characters, language, niche,
  sceneBlueprintJson, syncedScenes, setSyncedScenes, getCleanNarration,
}: AudioProcessorProps) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [sceneDuration, setSceneDuration] = useState(8);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionData | null>(null);
  const [showTranscription, setShowTranscription] = useState(false);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    const audio = new Audio(URL.createObjectURL(file));
    audio.addEventListener('loadedmetadata', () => setAudioDuration(Math.ceil(audio.duration)));
  };

  const generateFromAudio = async () => {
    if (!audioFile) { toast.error('Faça upload do áudio narrado primeiro'); return; }
    const cleanScript = getCleanNarration();
    setTranscribing(true);
    setGeneratingPrompts(true);
    setTranscription(null);
    setSyncedScenes([]);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('script', cleanScript || '');
      formData.append('videoStyle', videoStyle);
      formData.append('characters', JSON.stringify(characters));
      formData.append('sceneDuration', String(sceneDuration));
      formData.append('language', language);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audio-to-scenes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: formData,
      });

      if (resp.status === 429) throw new Error('Rate limit. Tente novamente em alguns segundos.');
      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro: ${resp.status}`);
      }

      const data = await resp.json();
      if (data.transcription) {
        setTranscription(data.transcription);
        setAudioDuration(data.transcription.audioDuration || 0);
        setTranscribing(false);
        setShowTranscription(true);
      }
      setSyncedScenes(data.scenes || []);
      toast.success(`🎬 ${data.scenes?.length || 0} cenas contextuais geradas!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao processar áudio'); }
    finally { setTranscribing(false); setGeneratingPrompts(false); }
  };

  const generateSyncedPrompts = async () => {
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }
    setGeneratingPrompts(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-synced-prompts', {
        body: {
          script: cleanScript, videoStyle,
          characters: characters.length > 0 ? characters : undefined,
          audioDurationSeconds: audioDuration || undefined,
          sceneDurationSeconds: sceneDuration, language, niche,
          sceneBlueprintFromScript: sceneBlueprintJson.length > 0 ? sceneBlueprintJson : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSyncedScenes(data.scenes || []);
      toast.success(`${data.scenes?.length || 0} cenas sincronizadas!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar prompts'); }
    finally { setGeneratingPrompts(false); }
  };

  return (
    <>
      {/* Audio Upload */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">🎙️ Upload do Áudio Narrado</span>
          <Badge className="bg-primary/20 text-primary text-[10px]">Recomendado</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">A IA vai transcrever, analisar e criar prompts que ilustram cada momento da narração.</p>

        <div className="flex gap-2 mb-3">
          <label className="flex-1 flex items-center gap-2 p-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/60 cursor-pointer transition-all bg-primary/5 hover:bg-primary/10">
            <Upload className="w-5 h-5 text-primary" />
            <div>
              <span className="text-sm font-medium text-foreground block">
                {audioFile ? audioFile.name : 'Selecionar áudio .mp3 / .wav'}
              </span>
              {audioFile && audioDuration > 0 && (
                <span className="text-[10px] text-primary">Duração: {formatTime(audioDuration)} → ~{Math.ceil(audioDuration / sceneDuration)} cenas</span>
              )}
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
          </label>
          {audioFile && (
            <Button size="icon" variant="ghost" className="shrink-0 h-11 w-11" onClick={() => { setAudioFile(null); setAudioDuration(0); setTranscription(null); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="bg-muted/30 rounded-lg p-2 text-[10px] text-muted-foreground mb-3">
          🎬 Estilo: <strong className="text-foreground">{videoStyles.find(v => v.value === videoStyle)?.label}</strong>
          {characters.length > 0 && <> • 👥 {characters.length} personagens</>}
          <span className="ml-2">• ⏱ Duração automática pela IA</span>
        </div>

        <Button onClick={generateFromAudio} disabled={!audioFile || generatingPrompts || transcribing}
          className="w-full gap-2 h-11 text-sm gradient-hero border-0">
          {transcribing ? <><Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo e analisando...</>
            : generatingPrompts ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando cenas...</>
            : <><Sparkles className="w-4 h-4" /> 🧠 Transcrever + Gerar Cenas Inteligentes</>}
        </Button>
      </div>

      {/* Transcription */}
      {transcription && (
        <div className="mb-4">
          <button onClick={() => setShowTranscription(!showTranscription)}
            className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 mb-2">
            <FileText className="w-3 h-3" />
            {showTranscription ? 'Esconder' : 'Ver'} Transcrição ({transcription.wordCount} palavras • {formatTime(transcription.audioDuration)})
          </button>
          {showTranscription && (
            <div className="bg-muted/30 rounded-lg p-3 max-h-[200px] overflow-y-auto border border-border/50">
              {transcription.blocks.map((block, i) => (
                <p key={i} className="text-xs text-foreground mb-1">
                  <span className="text-[9px] text-primary font-mono mr-1">[{formatTime(block.startTime)}]</span>
                  {block.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback */}
      {!audioFile && (
        <div className="border border-border/50 rounded-lg p-3 mb-4">
          <p className="text-[10px] text-muted-foreground mb-2">Sem áudio? Gere prompts baseados no texto (menos preciso):</p>
          <Button onClick={generateSyncedPrompts} disabled={generatingPrompts} variant="outline" size="sm" className="gap-2">
            {generatingPrompts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar do Texto (fallback)
          </Button>
        </div>
      )}
    </>
  );
};
