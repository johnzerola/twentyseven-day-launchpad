import { useState, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Upload, Music, X, Headphones, AlertTriangle, FileText, Users, Clock, Zap, Download } from 'lucide-react';
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
  enableASMR?: boolean;
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
  customStyleNotes, setCustomStyleNotes, enableASMR, referenceImageUrls, onReferenceImagesChange,
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

  const getAudioDurationSeconds = useCallback((file: File) => {
    return new Promise<number>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        audio.removeAttribute('src');
      };

      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        cleanup();
        resolve(duration > 0 ? duration : 0);
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error('Não foi possível ler a duração do áudio.'));
      };

      audio.src = objectUrl;
    });
  }, []);

  const generateSyncedScenes = async () => {
    if (!audioFile) { toast.error('Selecione um arquivo de áudio'); return; }
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }

    setPhase('uploading');
    try {
      const audioDurationSeconds = await getAudioDurationSeconds(audioFile);

      // Upload audio to storage
      const mimeType = audioFile.type || 'audio/mp3';
      const ext = audioFile.name.split('.').pop() || 'mp3';
      const storagePath = `audio-uploads/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, audioFile, { contentType: mimeType });
      
      if (uploadError) throw new Error(`Erro ao enviar áudio: ${uploadError.message}`);
      
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath);
      const audioUrl = urlData.publicUrl;

      // STEP 1: Transcribe (returns chunks info)
      setPhase('transcribing');

      const { data: startData, error: startError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
        body: {
          action: 'start',
          audioUrl,
          audioMimeType: mimeType,
          script: cleanScript,
          videoStyle,
          customStyleNotes,
          referenceImageUrls: referenceImageUrls?.length ? referenceImageUrls : undefined,
          characters: characters.length > 0 ? characters : undefined,
          language,
          niche,
          audioDurationSeconds,
          sceneBlueprintFromScript: sceneBlueprintJson.length > 0 ? sceneBlueprintJson : undefined,
        },
      });

      if (startError) throw startError;
      if (startData?.error) throw new Error(startData.error);
      if (!startData?.job_id) throw new Error('Falha ao iniciar processamento');

      const { job_id, totalChunks } = startData;

      // STEP 2: Generate scenes chunk by chunk (each is a lightweight request)
      setPhase('generating');
      const allScenes: any[] = [];

      for (let ci = 0; ci < totalChunks; ci++) {
        const { data: chunkData, error: chunkError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
          body: { action: 'generate_chunk', job_id, chunk_index: ci },
        });

        if (chunkError) {
          console.error(`Chunk ${ci} error:`, chunkError);
          continue;
        }
        if (chunkData?.error) {
          if (chunkData.error.includes('Créditos')) throw new Error('Créditos insuficientes.');
          console.error(`Chunk ${ci}:`, chunkData.error);
          continue;
        }

        if (chunkData?.scenes) {
          allScenes.push(...chunkData.scenes);
        }

        toast.loading(`Gerando cenas... ${ci + 1}/${totalChunks}`, { id: 'chunk-progress' });
      }

      toast.dismiss('chunk-progress');

      if (allScenes.length === 0) throw new Error('Nenhuma cena válida gerada.');

      // STEP 3: Finalize (post-process, sanitize, fill gaps)
      setPhase('analyzing');

      const { data: finalData, error: finalError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
        body: { action: 'finalize', job_id, all_scenes: allScenes },
      });

      if (finalError) throw finalError;
      if (finalData?.error) throw new Error(finalData.error);

      const scenes = (Array.isArray(finalData?.scenes) ? finalData.scenes : [])
        .filter((scene: any) => scene && typeof scene.visualPrompt === 'string' && scene.visualPrompt.trim().length > 0)
        .map((scene: any, index: number) => ({
          ...scene,
          sceneIndex: typeof scene.sceneIndex === 'number' ? scene.sceneIndex : index + 1,
          startTime: Number(scene.startTime) || 0,
          endTime: Number(scene.endTime) || (Number(scene.startTime) || 0) + 6,
        }));

      if (scenes.length === 0) throw new Error('Nenhuma cena válida foi retornada.');

      setSyncedScenes(scenes);
      setPhase('done');
      toast.success(`${scenes.length} cenas sincronizadas com o áudio!`);

      if (finalData?.metadata?.fallbackUsed) {
        toast.message('Alguns blocos foram recuperados em modo de segurança.');
      }

      setTimeout(() => setPhase('idle'), 3000);
    } catch (err: any) {
      setPhase('idle');
      if (err?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else if (err?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else if (err?.message?.toLowerCase?.().includes('timeout')) {
        toast.error('A geração demorou demais. Tente novamente.');
      }
      else toast.error(err.message || 'Erro ao processar áudio');
    }
  };

  // ═══ SRT Segmentado 8s ═══
  const generateSRT8s = useCallback(() => {
    if (syncedScenes.length === 0) { toast.error('Gere as cenas primeiro'); return; }
    
    const srtBlocks: string[] = [];
    let blockIndex = 1;
    
    for (const scene of syncedScenes) {
      const start = scene.startTime || 0;
      const end = scene.endTime || start + 8;
      const duration = end - start;
      const segments = Math.ceil(duration / 8);
      const narration = scene.narrativeText || scene.narrativeSummary || scene.visualPrompt.slice(0, 100);
      const words = narration.split(/\s+/);
      const wordsPerSeg = Math.ceil(words.length / segments);
      
      for (let s = 0; s < segments; s++) {
        const segStart = start + s * 8;
        const segEnd = Math.min(start + (s + 1) * 8, end);
        const segWords = words.slice(s * wordsPerSeg, (s + 1) * wordsPerSeg).join(' ');
        
        const fmtSrt = (sec: number) => {
          const h = String(Math.floor(sec / 3600)).padStart(2, '0');
          const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
          const sVal = String(Math.floor(sec % 60)).padStart(2, '0');
          const ms = String(Math.round((sec % 1) * 1000)).padStart(3, '0');
          return `${h}:${m}:${sVal},${ms}`;
        };
        
        srtBlocks.push(`${blockIndex}\n${fmtSrt(segStart)} --> ${fmtSrt(segEnd)}\n${segWords}\n`);
        blockIndex++;
      }
    }
    
    const srtContent = srtBlocks.join('\n');
    const blob = new Blob([srtContent], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cenas_8s_${Date.now()}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`📄 SRT com ${blockIndex - 1} blocos de 8s exportado!`);
  }, [syncedScenes]);

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

      {/* Audio Mastering - Side Panel (always visible) */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => setMasteringOpen(true)}
        disabled={!audioFile}
      >
        <Headphones className="w-4 h-4" />
        🎛️ Masterização de Áudio (Studio Grade)
        {!audioFile && <span className="text-[10px] text-muted-foreground ml-1">— envie áudio primeiro</span>}
      </Button>
      {audioFile && (
        <Sheet open={masteringOpen} onOpenChange={setMasteringOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg p-0">
            <SheetHeader className="p-6 pb-2">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Headphones className="w-5 h-5 text-amber-400" />
                Masterização de Áudio
              </SheetTitle>
              <SheetDescription className="text-xs">
                Pipeline profissional para transformar seu áudio em padrão estúdio.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)] px-6 pb-6">
              <AudioMasteringPanel audioFile={audioFile} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
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

      {/* DarkPlanner v3 — Script Pre-Analysis */}
      <ScriptPreAnalysis script={script} characters={characters} videoStyle={videoStyle} videoStyles={videoStyles} />

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

      {/* Generate + SRT Buttons */}
      <div className="flex gap-2">
        <Button onClick={generateSyncedScenes} disabled={isProcessing || !audioFile}
          className="flex-1 gap-2 h-11 text-sm gradient-hero border-0">
          {isProcessing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {PHASE_LABELS[phase]}</>
            : <><Sparkles className="w-4 h-4" /> 🧠 Gerar Cenas Sincronizadas</>}
        </Button>
        {syncedScenes.length > 0 && (
          <Button variant="outline" onClick={generateSRT8s} className="gap-2 h-11 text-xs border-accent/30 text-accent hover:bg-accent/10">
            <Download className="w-4 h-4" /> SRT 8s
          </Button>
        )}
      </div>
    </div>
  );
};

// ═══ DarkPlanner v3: Script Pre-Analysis Component (Etapa 1) ═══
function ScriptPreAnalysis({ script, characters, videoStyle, videoStyles }: {
  script: string;
  characters: Character[];
  videoStyle: string;
  videoStyles: VideoStyleOption[];
}) {
  const analysis = useMemo(() => {
    if (!script || script.length < 50) return null;
    const words = script.split(/\s+/).length;
    const estDurationMin = Math.round(words / 150); // ~150 words/min narration
    const estDurationSec = estDurationMin * 60;

    // Detect content type
    const lower = script.toLowerCase();
    const isDoc = /documentário|documentary|história real|true story|investigação/i.test(lower);
    const isAction = /perseguição|explosão|corrida|luta|chase|action|fight|escape/i.test(lower);
    const contentType = isDoc ? 'Documentário' : isAction ? 'Ação' : /ficção|fiction|história|story|conto/i.test(lower) ? 'Ficção' : 'Híbrido';

    // Prompt density
    const base = estDurationSec / 40;
    const prompts = isDoc ? Math.round(estDurationSec / 60) : isAction ? Math.round(base * 1.2) : Math.round(base);
    const clampedPrompts = Math.max(10, Math.min(200, prompts));

    // Sensitive content scan
    const triggerWords = ['gun', 'arma', 'faca', 'sangue', 'blood', 'morte', 'dead', 'matar', 'kill', 'droga', 'drug', 'violência', 'violence'];
    const foundTriggers = triggerWords.filter(tw => lower.includes(tw));

    return { words, estDurationMin, contentType, clampedPrompts, foundTriggers, isDoc, charCount: characters.length };
  }, [script, characters]);

  if (!analysis) return null;

  return (
    <div className="border border-primary/20 rounded-xl p-3 bg-primary/5 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">DarkPlanner v3 — Análise do Roteiro</span>
        <Badge className="bg-primary/20 text-primary text-[9px]">Auto</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-background/50 rounded-lg p-2 text-center">
          <FileText className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-[10px] text-muted-foreground">Tipo</p>
          <p className="text-xs font-bold text-foreground">{analysis.contentType}</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2 text-center">
          <Clock className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-[10px] text-muted-foreground">Duração Est.</p>
          <p className="text-xs font-bold text-foreground">~{analysis.estDurationMin} min</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2 text-center">
          <Sparkles className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-[10px] text-muted-foreground">Prompts Est.</p>
          <p className="text-xs font-bold text-foreground">~{analysis.clampedPrompts}</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2 text-center">
          <Users className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-[10px] text-muted-foreground">Personagens</p>
          <p className="text-xs font-bold text-foreground">{analysis.charCount}</p>
        </div>
      </div>
      {analysis.charCount > 5 && (
        <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-500">⚠️ Mais de 5 personagens pode reduzir consistência visual. Recomendado: máx 5.</p>
        </div>
      )}
      {analysis.foundTriggers.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-500">Conteúdo sensível detectado ({analysis.foundTriggers.join(', ')}). Auto-adaptação será aplicada.</p>
        </div>
      )}
      {analysis.isDoc && (
        <p className="text-[9px] text-muted-foreground">📹 Modo Documentário: foco em locações e atmosfera, densidade reduzida (~1 prompt/min).</p>
      )}
    </div>
  );
}
