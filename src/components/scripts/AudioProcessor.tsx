import { useState, useRef } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Upload, Music, X, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AudioMasteringPanel } from './AudioMasteringPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  referenceImageUrls?: string[];
  onReferenceImagesChange?: (urls: string[]) => void;
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
  customStyleNotes, setCustomStyleNotes, referenceImageUrls, onReferenceImagesChange,
}: AudioProcessorProps) => {
  const [phase, setPhase] = useState<ProcessingPhase>('idle');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingRefImage, setUploadingRefImage] = useState(false);
  const [masteringOpen, setMasteringOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Áudio deve ter no máximo 100MB');
      return;
    }
    setAudioFile(file);
  };

  const removeFile = () => {
    setAudioFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRefImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const current = referenceImageUrls || [];
    if (current.length + files.length > 5) {
      toast.error('Máximo de 5 imagens de referência');
      return;
    }
    setUploadingRefImage(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `references/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('media').upload(path, file);
        if (error) { toast.error(`Erro ao subir ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        newUrls.push(urlData.publicUrl);
      }
      if (newUrls.length > 0) {
        onReferenceImagesChange?.([...current, ...newUrls]);
        toast.success(`${newUrls.length} imagem(ns) adicionada(s)`);
      }
    } finally {
      setUploadingRefImage(false);
    }
  };

  const removeRefImage = (index: number) => {
    const current = referenceImageUrls || [];
    onReferenceImagesChange?.(current.filter((_, i) => i !== index));
  };

  const generateSyncedScenes = async () => {
    if (!audioFile) { toast.error('Selecione um arquivo de áudio'); return; }
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }

    setPhase('uploading');
    try {
      // Convert audio to base64 using chunked buffer (safer for large files)
      const arrayBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = audioFile.type || 'audio/mp3';

      setPhase('transcribing');

      const { data, error } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
        body: {
          audioBase64: base64,
          audioMimeType: mimeType,
          script: cleanScript,
          videoStyle,
          customStyleNotes,
          referenceImageUrls: referenceImageUrls?.length ? referenceImageUrls : undefined,
          characters: characters.length > 0 ? characters : undefined,
          language,
          niche,
          sceneBlueprintFromScript: sceneBlueprintJson.length > 0 ? sceneBlueprintJson : undefined,
        },
      });

      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 504) throw new Error('Tempo limite no processamento do áudio. Tente novamente.');
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      const scenes = (Array.isArray(data?.scenes) ? data.scenes : [])
        .filter((scene: any) => scene && typeof scene.visualPrompt === 'string' && scene.visualPrompt.trim().length > 0)
        .map((scene: any, index: number) => ({
          ...scene,
          sceneIndex: typeof scene.sceneIndex === 'number' ? scene.sceneIndex : index + 1,
          startTime: Number(scene.startTime) || 0,
          endTime: Number(scene.endTime) || (Number(scene.startTime) || 0) + 6,
        }));

      if (scenes.length === 0) {
        throw new Error('Nenhuma cena válida foi retornada. Gere novamente com este mesmo áudio.');
      }

      setPhase('generating');
      await new Promise(r => setTimeout(r, 500));

      setSyncedScenes(scenes);
      setPhase('done');
      toast.success(`${scenes.length} cenas sincronizadas com o áudio!`);

      if (data?.metadata?.fallbackUsed) {
        toast.message('Alguns blocos foram recuperados em modo de segurança para garantir o retorno dos prompts.');
      }

      setTimeout(() => setPhase('idle'), 3000);
    } catch (err: any) {
      setPhase('idle');
      if (err?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else if (err?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else if (err?.message?.toLowerCase?.().includes('timeout') || err?.message?.includes('Tempo limite')) {
        toast.error('A geração demorou demais. Tente novamente que agora está otimizado para áudio longo.');
      }
      else toast.error(err.message || 'Erro ao processar áudio');
    }
  };

  const isProcessing = phase !== 'idle' && phase !== 'done';
  const currentRefs = referenceImageUrls || [];

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
            <span className="text-[10px] text-muted-foreground mt-1">MP3, WAV, M4A, OGG — até 100MB (~50 min)</span>
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

      {/* Audio Mastering */}
      {audioFile && (
        <AudioMasteringPanel audioFile={audioFile} />
      )}

      {/* Reference Images */}
      {onReferenceImagesChange && (
        <div className="border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Imagens de Referência Visual</span>
              <Badge variant="outline" className="text-[10px]">Opcional</Badge>
            </div>
            {currentRefs.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{currentRefs.length}/5</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Suba imagens do estilo visual desejado (ex: frames, screenshots, arte). A IA vai seguir esse padrão nas cenas.
          </p>
          <div className="flex flex-wrap gap-2">
            {currentRefs.map((url, i) => (
              <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
                <img src={url} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeRefImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {currentRefs.length < 5 && (
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40">
                {uploadingRefImage ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[8px] text-muted-foreground">Adicionar</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple onChange={handleRefImageUpload} className="hidden" disabled={uploadingRefImage} />
              </label>
            )}
          </div>
        </div>
      )}

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
        {currentRefs.length > 0 && <> • 🖼️ {currentRefs.length} refs visuais</>}
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
