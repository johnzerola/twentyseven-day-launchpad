import { useState, useRef } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Upload, Music, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SyncedScene, Character, VideoStyleOption } from './types';

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
  customStyleNotes: string;
  setCustomStyleNotes: (notes: string) => void;
}

type ProcessingPhase = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'done';

const PHASE_LABELS: Record<ProcessingPhase, string> = {
  idle: '',
  uploading: 'Enviando áudio...',
  transcribing: '🎙️ Transcrevendo com IA...',
  analyzing: '🧠 Analisando narração e tempos...',
  generating: '🎬 Gerando cenas sincronizadas...',
  done: '✅ Cenas prontas!',
};

const PHASE_PROGRESS: Record<ProcessingPhase, number> = {
  idle: 0, uploading: 10, transcribing: 30, analyzing: 55, generating: 80, done: 100,
};

export const AudioProcessor = ({
  script, videoStyle, videoStyles, characters, language, niche,
  sceneBlueprintJson, syncedScenes, setSyncedScenes, getCleanNarration,
  customStyleNotes, setCustomStyleNotes,
}: AudioProcessorProps) => {
  const [phase, setPhase] = useState<ProcessingPhase>('idle');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Áudio deve ter no máximo 25MB');
      return;
    }
    setAudioFile(file);
  };

  const removeFile = () => {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateSyncedScenes = async () => {
    if (!audioFile) { toast.error('Selecione um arquivo de áudio'); return; }
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }

    setPhase('uploading');
    try {
      // Convert audio to base64
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const mimeType = audioFile.type || 'audio/mp3';

      setPhase('transcribing');

      const { data, error } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
        body: {
          audioBase64: base64,
          audioMimeType: mimeType,
          script: cleanScript,
          videoStyle,
          customStyleNotes,
          characters: characters.length > 0 ? characters : undefined,
          language,
          niche,
          sceneBlueprintFromScript: sceneBlueprintJson.length > 0 ? sceneBlueprintJson : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPhase('generating');
      // Small delay for UI feedback
      await new Promise(r => setTimeout(r, 500));

      setSyncedScenes(data.scenes || []);
      setPhase('done');
      toast.success(`${data.scenes?.length || 0} cenas sincronizadas com o áudio!`);

      setTimeout(() => setPhase('idle'), 3000);
    } catch (err: any) {
      setPhase('idle');
      if (err?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else if (err?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else toast.error(err.message || 'Erro ao processar áudio');
    }
  };

  const isProcessing = phase !== 'idle' && phase !== 'done';

  return (
    <div className="space-y-4">
      {/* Audio Upload */}
      <div className="border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Upload de Áudio (Narração)</span>
          <Badge className="bg-primary/20 text-primary text-[10px]">Gemini</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Envie o áudio narrado. A IA transcreve, analisa os tempos de fala e cria cenas visuais sincronizadas automaticamente.
        </p>

        {!audioFile ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-xs font-medium text-foreground">Clique para selecionar áudio</span>
            <span className="text-[10px] text-muted-foreground mt-1">MP3, WAV, M4A, OGG — até 25MB</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
            <Music className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{audioFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={removeFile} disabled={isProcessing}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Custom Style Notes */}
      <div className="border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Instruções Extras de Estilo</span>
          <Badge variant="outline" className="text-[10px]">Opcional</Badge>
        </div>
        <Textarea
          value={customStyleNotes}
          onChange={(e) => setCustomStyleNotes(e.target.value)}
          placeholder="Ex: quero tons dourados e quentes, câmera lenta nas cenas épicas, estilo documentário BBC..."
          className="text-xs min-h-[60px] resize-none"
          rows={2}
        />
      </div>

      {/* Info summary */}
      <div className="bg-muted/30 rounded-lg p-2 text-[10px] text-muted-foreground">
        🎬 Estilo: <strong className="text-foreground">{videoStyles.find(v => v.value === videoStyle)?.label}</strong>
        {characters.length > 0 && <> • 👥 {characters.length} personagens</>}
        {customStyleNotes && <> • ✏️ Com instruções extras</>}
        <span className="ml-2">• ⏱ IA decide duração (5-10s/cena)</span>
      </div>

      {/* Progress */}
      {phase !== 'idle' && (
        <div className="space-y-2">
          <Progress value={PHASE_PROGRESS[phase]} className="h-2" />
          <p className="text-xs text-center text-muted-foreground animate-pulse">{PHASE_LABELS[phase]}</p>
        </div>
      )}

      {/* Generate Button */}
      <Button onClick={generateSyncedScenes} disabled={isProcessing || !audioFile}
        className="w-full gap-2 h-11 text-sm gradient-hero border-0">
        {isProcessing
          ? <><Loader2 className="w-4 h-4 animate-spin" /> {PHASE_LABELS[phase]}</>
          : <><Sparkles className="w-4 h-4" /> 🧠 Gerar Cenas Sincronizadas do Áudio</>}
      </Button>
    </div>
  );
};
