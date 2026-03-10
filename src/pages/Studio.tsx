import { useState, useRef, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Film, Sparkles, Download, Send, Loader2, Volume2, Wand2, Zap, RefreshCcw, Play, Pause, SkipForward, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import SegmentCard, { type Segment } from '@/components/studio/SegmentCard';
import JSZip from 'jszip';

const VOICES = [
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', lang: 'EN-US' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', lang: 'EN-US' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', lang: 'PT-BR' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', lang: 'DE' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', lang: 'PL' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', lang: 'ES' },
];

const Studio = () => {
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState(VOICES[2].id);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [veo3Mode, setVeo3Mode] = useState(false);
  const [characterDesc, setCharacterDesc] = useState('');

  // Sync preview state
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const segmentsRef = useRef(segments);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const addLog = (msg: string) => {
    setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const sliceScript = (): Segment[] | null => {
    if (!script.trim()) { toast.error('Cole ou digite o roteiro primeiro'); return null; }
    const words = script.split(/\s+/).filter(Boolean);
    const WORDS_PER_SEGMENT = 20;
    const newSegments: Segment[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_SEGMENT) {
      newSegments.push({
        index: newSegments.length,
        text: words.slice(i, i + WORDS_PER_SEGMENT).join(' '),
        visualPrompt: '',
        referenceImage: null,
        generatedImage: null,
        audioBase64: null,
        status: 'pending',
      });
    }
    setSegments(newSegments);
    toast.success(`Roteiro fatiado em ${newSegments.length} segmentos de ~8s`);
    return newSegments;
  };

  const updateSegment = useCallback((index: number, field: keyof Segment, value: any) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, [field]: value } : s));
  }, []);

  const autoGeneratePrompts = async (segs?: Segment[]) => {
    const targetSegs = segs || segmentsRef.current;
    if (!targetSegs.length) return toast.error('Fatie o roteiro primeiro');
    setGeneratingPrompts(true);
    addLog('🎨 Gerando prompts visuais com IA...');

    try {
      const fnName = veo3Mode ? 'generate-veo3-prompts' : 'generate-visual-prompts';
      const body = veo3Mode
        ? { segments: targetSegs.map(s => ({ text: s.text })), characterDescription: characterDesc }
        : { segments: targetSegs.map(s => ({ text: s.text })) };

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const prompts = data?.prompts || [];
      prompts.forEach((p: any) => {
        const prompt = veo3Mode ? p.veo3Prompt : p.visualPrompt;
        updateSegment(p.segmentIndex, 'visualPrompt', prompt);
      });
      addLog(`✅ ${prompts.length} prompts ${veo3Mode ? 'Veo3' : 'visuais'} gerados!`);
      toast.success(`Prompts ${veo3Mode ? 'Veo3' : 'visuais'} gerados!`);
    } catch (err: any) {
      addLog(`⚠️ Erro nos prompts: ${err.message}`);
      toast.error(err.message);
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const generateAllAudio = async (segs?: Segment[]) => {
    const targetSegs = segs || segmentsRef.current;
    if (!targetSegs.length) return toast.error('Fatie o roteiro primeiro');
    setGeneratingAudio(true);
    addLog('🎙️ Gerando narração com ElevenLabs...');

    for (let i = 0; i < targetSegs.length; i++) {
      addLog(`🔊 Narração segmento ${i + 1}/${targetSegs.length}...`);
      try {
        const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
          body: { text: targetSegs[i].text, voiceId: voice, segmentIndex: i },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (data?.audioBase64) {
          updateSegment(i, 'audioBase64', data.audioBase64);
          addLog(`✅ Áudio segmento ${i + 1} pronto`);
        }
      } catch (err: any) {
        addLog(`⚠️ Áudio segmento ${i + 1} falhou: ${err.message}`);
      }
      if (i < targetSegs.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    setGeneratingAudio(false);
    toast.success('Narração gerada!');
  };

  const generateSegmentImage = async (seg: Segment) => {
    setGeneratingImage(seg.index);
    updateSegment(seg.index, 'status', 'generating');
    try {
      const { data, error } = await supabase.functions.invoke('generate-segment-image', {
        body: { visualPrompt: seg.visualPrompt, textContent: seg.text, segmentIndex: seg.index },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.imageUrl) {
        updateSegment(seg.index, 'generatedImage', data.imageUrl);
        updateSegment(seg.index, 'status', 'success');
        toast.success(`Imagem #${seg.index + 1} gerada!`);
      } else throw new Error('No image returned');
    } catch (err: any) {
      updateSegment(seg.index, 'status', 'failed');
      toast.error(err.message);
    } finally {
      setGeneratingImage(null);
    }
  };

  const runBatchImages = async (targetSegs?: Segment[]) => {
    const segs = targetSegs || segmentsRef.current;
    setBatchRunning(true);
    setBatchProgress(0);
    for (let i = 0; i < segs.length; i++) {
      updateSegment(i, 'status', 'generating');
      addLog(`🎬 Gerando imagem cena ${i + 1}/${segs.length}...`);
      try {
        const { data, error } = await supabase.functions.invoke('generate-segment-image', {
          body: { visualPrompt: segs[i].visualPrompt, textContent: segs[i].text, segmentIndex: i },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        if (data?.imageUrl) {
          updateSegment(i, 'generatedImage', data.imageUrl);
          updateSegment(i, 'status', 'success');
          addLog(`✅ Cena ${i + 1} pronta`);
        } else throw new Error('No image');
      } catch (err: any) {
        updateSegment(i, 'status', 'failed');
        addLog(`⚠️ Cena ${i + 1} falhou: ${err.message}`);
      }
      setBatchProgress(Math.round(((i + 1) / segs.length) * 100));
      if (i < segs.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    setBatchRunning(false);
  };

  const retryFailed = async () => {
    const failed = segmentsRef.current.filter(s => s.status === 'failed');
    if (!failed.length) return toast.info('Nenhum segmento falhou');
    addLog(`🔄 Regenerando ${failed.length} segmentos falhados...`);
    setBatchRunning(true);
    for (const seg of failed) {
      updateSegment(seg.index, 'status', 'generating');
      try {
        const { data, error } = await supabase.functions.invoke('generate-segment-image', {
          body: { visualPrompt: seg.visualPrompt, textContent: seg.text, segmentIndex: seg.index },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        if (data?.imageUrl) {
          updateSegment(seg.index, 'generatedImage', data.imageUrl);
          updateSegment(seg.index, 'status', 'success');
          addLog(`✅ Cena ${seg.index + 1} recuperada`);
        }
      } catch (err: any) {
        updateSegment(seg.index, 'status', 'failed');
        addLog(`⚠️ Cena ${seg.index + 1} falhou novamente`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    setBatchRunning(false);
    toast.success('Retry completo!');
  };

  const downloadAll = async () => {
    const segs = segmentsRef.current;
    const hasContent = segs.some(s => s.generatedImage || s.audioBase64);
    if (!hasContent) return toast.error('Nenhum conteúdo para baixar');

    const zip = new JSZip();
    for (const seg of segs) {
      if (seg.generatedImage) {
        try {
          const resp = await fetch(seg.generatedImage);
          const blob = await resp.blob();
          zip.file(`cena-${String(seg.index + 1).padStart(2, '0')}.png`, blob);
        } catch { /* skip */ }
      }
      if (seg.audioBase64) {
        const binary = atob(seg.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        zip.file(`audio-${String(seg.index + 1).padStart(2, '0')}.mp3`, bytes);
      }
    }
    // Add prompts as txt
    if (veo3Mode) {
      const promptsTxt = segs.map(s => `[Cena ${s.index + 1}]\n${s.visualPrompt}\n`).join('\n');
      zip.file('veo3-prompts.txt', promptsTxt);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dotti-studio-assets.zip';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download iniciado!');
  };

  const runFullPipeline = async () => {
    if (!script.trim()) return toast.error('Cole ou digite o roteiro primeiro');
    setPipelineRunning(true);
    setShowLogs(true);
    setBatchLogs([]);
    addLog('🚀 Pipeline Completo Iniciado');

    addLog('📝 Passo 1/3: Fatiando roteiro...');
    const newSegs = sliceScript();
    if (!newSegs) { setPipelineRunning(false); return; }
    await new Promise(r => setTimeout(r, 300));

    addLog('🎙️ Passo 2/3: Gerando áudio + prompts visuais...');
    await Promise.all([
      generateAllAudio(newSegs),
      autoGeneratePrompts(newSegs),
    ]);

    addLog('🎨 Passo 3/3: Gerando imagens em lote...');
    await runBatchImages(newSegs);

    addLog('🎉 Pipeline completo! Todos os assets foram gerados.');
    setPipelineRunning(false);
    toast.success('Pipeline completo! 🎬');
  };

  // Sync Preview Player
  const playPreview = () => {
    const segs = segmentsRef.current;
    if (!segs.length) return;
    setPreviewPlaying(true);
    setPreviewIndex(0);
    playSegmentAudio(0);
  };

  const playSegmentAudio = (idx: number) => {
    const segs = segmentsRef.current;
    if (idx >= segs.length) { setPreviewPlaying(false); return; }
    setPreviewIndex(idx);
    if (segs[idx].audioBase64) {
      const audio = new Audio(`data:audio/mpeg;base64,${segs[idx].audioBase64}`);
      audioPreviewRef.current = audio;
      audio.onended = () => playSegmentAudio(idx + 1);
      audio.play();
    } else {
      setTimeout(() => playSegmentAudio(idx + 1), 3000);
    }
  };

  const stopPreview = () => {
    audioPreviewRef.current?.pause();
    setPreviewPlaying(false);
  };

  const successCount = segments.filter(s => s.status === 'success').length;
  const failedCount = segments.filter(s => s.status === 'failed').length;
  const audioCount = segments.filter(s => s.audioBase64).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center glow-primary">
              <Film className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Dotti Sync & Studio</h1>
              <p className="text-sm text-muted-foreground">Roteiro → Áudio → Imagens → Vídeo sincronizado</p>
            </div>
          </div>

          {segments.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {failedCount > 0 && (
                <Button variant="outline" onClick={retryFailed} disabled={batchRunning} className="gap-2 border-destructive/30 text-destructive">
                  <RefreshCcw className="w-4 h-4" /> Regenerar {failedCount} Falhados
                </Button>
              )}
              <Button onClick={() => runBatchImages()} disabled={batchRunning || pipelineRunning} className="gradient-hero border-0 gap-2">
                <Send className="w-4 h-4" /> Gerar Imagens em Lote
              </Button>
              <Button variant="outline" className="gap-2" onClick={downloadAll}>
                <Download className="w-4 h-4" /> Baixar ZIP
              </Button>
            </div>
          )}
        </div>

        {/* Pipeline Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-5 border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Pipeline Completo (1 clique)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Fatiar → Gerar Áudio (ElevenLabs) + Prompts {veo3Mode ? 'Veo3' : 'Visuais'} (IA) → Gerar Imagens em Lote
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={() => setVeo3Mode(!veo3Mode)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-secondary/50 border border-border hover:border-primary/30 transition-all">
                {veo3Mode ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                Modo Veo3
              </button>
              <Button onClick={runFullPipeline} disabled={pipelineRunning || !script.trim()}
                className="gradient-hero border-0 gap-2 px-6">
                {pipelineRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {pipelineRunning ? 'Executando...' : 'Pipeline Completo'}
              </Button>
            </div>
          </div>
          {veo3Mode && (
            <div className="mt-3">
              <Input placeholder="Descrição do personagem principal (para consistência entre cenas)..."
                value={characterDesc} onChange={e => setCharacterDesc(e.target.value)}
                className="bg-secondary/50 text-sm" />
            </div>
          )}
        </motion.div>

        {/* Sync Preview Player */}
        {segments.length > 0 && segments.some(s => s.audioBase64 || s.generatedImage) && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={previewPlaying ? stopPreview : playPreview}
                className="h-10 w-10 rounded-full">
                {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">Preview Sincronizado</span>
                  {previewPlaying && <Badge variant="secondary" className="text-[10px]">Cena {previewIndex + 1}/{segments.length}</Badge>}
                </div>
                <Progress value={previewPlaying ? ((previewIndex + 1) / segments.length) * 100 : 0} className="h-1.5" />
              </div>
              {previewPlaying && segments[previewIndex]?.generatedImage && (
                <img src={segments[previewIndex].generatedImage!} alt="" className="h-14 w-24 rounded object-cover border border-border/50" />
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {(batchRunning || pipelineRunning) && (
          <div className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{batchProgress}%</span>
            </div>
            <Progress value={batchProgress} className="h-3" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-400">✅ {successCount} imagens</span>
              <span className="text-primary">🔊 {audioCount} áudios</span>
              <span className="text-destructive">❌ {failedCount} falhas</span>
            </div>
          </div>
        )}

        {/* Terminal Log */}
        {showLogs && batchLogs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-[hsl(var(--secondary))] rounded-xl p-4 font-mono text-xs max-h-40 overflow-y-auto border border-border/50">
            {batchLogs.map((log, i) => (
              <div key={i} className={`${log.includes('⚠️') ? 'text-yellow-400' : log.includes('✅') ? 'text-emerald-400' : log.includes('🎉') ? 'text-primary' : 'text-muted-foreground'}`}>
                {log}
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Roteiro
            </h3>
            <Textarea value={script} onChange={e => setScript(e.target.value)}
              placeholder="Cole seu roteiro completo aqui..."
              className="bg-secondary/50 min-h-[200px] text-sm" />
            <p className="text-xs text-muted-foreground">{script.split(/\s+/).filter(Boolean).length} palavras • ~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 20)} segmentos</p>

            <div className="border-t border-border/50 pt-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Voz Neural (ElevenLabs)
              </h3>
              <select value={voice} onChange={e => setVoice(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm mb-3">
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} ({v.lang})</option>)}
              </select>
              <Button variant="outline" className="w-full gap-2" onClick={() => generateAllAudio()}
                disabled={generatingAudio || !segments.length}>
                <Volume2 className="w-4 h-4" />
                {generatingAudio ? 'Gerando Áudio...' : 'Gerar Áudio (ElevenLabs)'}
              </Button>
            </div>

            <div className="space-y-2">
              <Button onClick={() => sliceScript()} className="w-full gradient-hero border-0 gap-2">
                <Film className="w-4 h-4" /> Fatiar Roteiro
              </Button>
              {segments.length > 0 && (
                <Button variant="outline" className="w-full gap-2" onClick={() => autoGeneratePrompts()}
                  disabled={generatingPrompts}>
                  <Wand2 className="w-4 h-4" />
                  {generatingPrompts ? 'Gerando Prompts...' : `Auto-gerar Prompts ${veo3Mode ? 'Veo3' : 'Visuais'}`}
                </Button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {segments.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Timeline — {segments.length} blocos de 8s</h3>
                  <Badge variant="secondary">{Math.ceil(segments.length * 8 / 60)} min total</Badge>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {segments.map((seg) => (
                      <SegmentCard key={seg.index} seg={seg}
                        onUpdateSegment={updateSegment}
                        onGenerateImage={generateSegmentImage}
                        generatingImage={generatingImage}
                        batchRunning={batchRunning} />
                    ))}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="glass rounded-xl p-16 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                <Film className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Cole o roteiro e clique "Pipeline Completo"</p>
                <p className="text-sm mt-1">Fluxo: Roteiro → Áudio → Prompts → Imagens</p>
                <p className="text-xs mt-3 text-primary">ElevenLabs + Gemini AI integrados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Studio;
