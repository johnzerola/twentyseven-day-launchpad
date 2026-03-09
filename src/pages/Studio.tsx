import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Film, Sparkles, Upload, Play, Download, Send, CheckCircle, XCircle, Loader2, Clock, Volume2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

// ElevenLabs voices
const VOICES = [
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', lang: 'EN-US' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', lang: 'EN-US' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', lang: 'PT-BR' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', lang: 'DE' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', lang: 'PL' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', lang: 'ES' },
];

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pendente' },
  generating: { icon: Loader2, color: 'text-yellow-400', label: 'Gerando' },
  success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Sucesso' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou' },
};

interface Segment {
  index: number;
  text: string;
  visualPrompt: string;
  referenceImage: string | null;
  generatedImage: string | null;
  status: 'pending' | 'generating' | 'success' | 'failed';
}

const Studio = () => {
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState(VOICES[2].id); // Daniel PT-BR default
  const [segments, setSegments] = useState<Segment[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchLogs, setBatchLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);

  const sliceScript = () => {
    if (!script.trim()) return toast.error('Cole ou digite o roteiro primeiro');
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
        status: 'pending',
      });
    }
    setSegments(newSegments);
    toast.success(`Roteiro fatiado em ${newSegments.length} segmentos de ~8s`);
  };

  const updateSegment = (index: number, field: keyof Segment, value: any) => {
    setSegments(prev => prev.map(s => s.index === index ? { ...s, [field]: value } : s));
  };

  // Generate image for a single segment using AI
  const generateSegmentImage = async (seg: Segment) => {
    setGeneratingImage(seg.index);
    updateSegment(seg.index, 'status', 'generating');
    try {
      const { data, error } = await supabase.functions.invoke('generate-segment-image', {
        body: {
          visualPrompt: seg.visualPrompt,
          textContent: seg.text,
          segmentIndex: seg.index,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.imageUrl) {
        updateSegment(seg.index, 'generatedImage', data.imageUrl);
        updateSegment(seg.index, 'status', 'success');
        toast.success(`Imagem do segmento #${seg.index + 1} gerada!`);
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      updateSegment(seg.index, 'status', 'failed');
      toast.error(err.message || `Erro no segmento #${seg.index + 1}`);
    } finally {
      setGeneratingImage(null);
    }
  };

  // Batch: generate images for all segments
  const runBatch = async () => {
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchLogs([]);
    setShowLogs(true);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      updateSegment(i, 'status', 'generating');
      setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎬 Gerando imagem para cena ${i + 1} de ${segments.length}...`]);

      try {
        const { data, error } = await supabase.functions.invoke('generate-segment-image', {
          body: { visualPrompt: seg.visualPrompt, textContent: seg.text, segmentIndex: i },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        if (data?.imageUrl) {
          updateSegment(i, 'generatedImage', data.imageUrl);
          updateSegment(i, 'status', 'success');
          setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Cena ${i + 1} gerada com sucesso`]);
        } else {
          throw new Error('No image');
        }
      } catch (err: any) {
        updateSegment(i, 'status', 'failed');
        setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Cena ${i + 1} falhou: ${err.message}`]);
      }

      setBatchProgress(Math.round(((i + 1) / segments.length) * 100));
      // Small delay between requests to avoid rate limiting
      if (i < segments.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    const successCount = segments.filter(s => s.status === 'success').length;
    setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 Lote finalizado! ${successCount}/${segments.length} cenas prontas.`]);
    setBatchRunning(false);
  };

  // TODO: ElevenLabs TTS integration - requires connector
  const generateAudio = () => {
    toast.info('Integração ElevenLabs: conecte o connector ElevenLabs para gerar áudio real');
  };

  const successCount = segments.filter(s => s.status === 'success').length;
  const failedCount = segments.filter(s => s.status === 'failed').length;

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
            <div className="flex gap-2">
              <Button onClick={runBatch} disabled={batchRunning} className="gradient-hero border-0 gap-2">
                <Send className="w-4 h-4" /> {batchRunning ? 'Gerando...' : 'Gerar Imagens em Lote'}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => toast.info('Download disponível quando todas as cenas estiverem prontas')}>
                <Download className="w-4 h-4" /> Baixar Todos
              </Button>
            </div>
          )}
        </div>

        {/* Batch Progress */}
        {batchRunning && (
          <div className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do lote</span>
              <span className="font-medium">{batchProgress}%</span>
            </div>
            <Progress value={batchProgress} className="h-3" />
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-emerald-400">✅ {successCount} sucesso</span>
              <span className="text-destructive">❌ {failedCount} falhas</span>
              <span>⏳ {segments.length - successCount - failedCount} pendentes</span>
            </div>
          </div>
        )}

        {/* Terminal Log */}
        {showLogs && batchLogs.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-[#0a0a0a] rounded-xl p-4 font-mono text-xs max-h-40 overflow-y-auto border border-border/50">
            {batchLogs.map((log, i) => (
              <div key={i} className={`${log.includes('⚠️') ? 'text-yellow-400' : log.includes('✅') ? 'text-emerald-400' : log.includes('🎉') ? 'text-primary' : 'text-muted-foreground'}`}>
                {log}
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Area 1: Script Editor */}
          <div className="glass rounded-xl p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Roteiro
            </h3>
            <Textarea value={script} onChange={e => setScript(e.target.value)}
              placeholder="Cole seu roteiro completo aqui. O sistema vai fatiar automaticamente em blocos de ~8 segundos..."
              className="bg-secondary/50 min-h-[250px] text-sm" />
            <p className="text-xs text-muted-foreground">{script.split(/\s+/).filter(Boolean).length} palavras • ~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 20)} segmentos</p>

            {/* Area 2: Voice Selection */}
            <div className="border-t border-border/50 pt-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Voz Neural (ElevenLabs)
              </h3>
              <select value={voice} onChange={e => setVoice(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm mb-3">
                {VOICES.map(v => <option key={v.id} value={v.id}>{v.name} ({v.lang})</option>)}
              </select>
              {/* TODO: Connect ElevenLabs via connector for real TTS: /v1/text-to-speech/{voice_id}/with-timestamps */}
              <Button variant="outline" className="w-full gap-2" onClick={generateAudio}>
                <Volume2 className="w-4 h-4" /> Gerar Áudio e Sincronizar
              </Button>
            </div>

            <Button onClick={sliceScript} className="w-full gradient-hero border-0 gap-2">
              <Film className="w-4 h-4" /> Fatiar Roteiro em Segmentos
            </Button>
          </div>

          {/* Area 3: Timeline */}
          <div className="lg:col-span-2 space-y-3">
            {segments.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Timeline de Sincronia — {segments.length} blocos de 8s</h3>
                  <Badge variant="secondary">{Math.ceil(segments.length * 8 / 60)} min total</Badge>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {segments.map((seg) => {
                      const statusCfg = STATUS_CONFIG[seg.status];
                      const StatusIcon = statusCfg.icon;
                      return (
                        <motion.div key={seg.index} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: seg.index * 0.03 }}
                          className={`glass rounded-xl p-4 space-y-3 relative ${
                            seg.status === 'generating' ? 'border-yellow-400/30' :
                            seg.status === 'success' ? 'border-emerald-400/30' :
                            seg.status === 'failed' ? 'border-destructive/30' : ''
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="bg-secondary text-xs font-mono px-2 py-0.5 rounded">#{seg.index + 1}</span>
                              <span className="text-xs text-muted-foreground">8s</span>
                            </div>
                            <Badge variant="outline" className={`gap-1 ${statusCfg.color}`}>
                              <StatusIcon className={`w-3 h-3 ${seg.status === 'generating' ? 'animate-spin' : ''}`} />
                              {statusCfg.label}
                            </Badge>
                          </div>

                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-sm">{seg.text}</p>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Prompt Visual da Cena</label>
                              <Input placeholder="Ex: Close-up do personagem na chuva..."
                                value={seg.visualPrompt} onChange={e => updateSegment(seg.index, 'visualPrompt', e.target.value)}
                                className="bg-secondary/50 text-xs h-8" />
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Gerar Imagem IA</label>
                                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1"
                                  onClick={() => generateSegmentImage(seg)}
                                  disabled={generatingImage === seg.index || batchRunning}>
                                  <ImageIcon className="w-3 h-3" />
                                  {generatingImage === seg.index ? 'Gerando...' : 'Gerar'}
                                </Button>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-1 block uppercase tracking-wider">Referência</label>
                                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1"
                                  onClick={() => toast.info('Upload de referência (em breve)')}>
                                  <Upload className="w-3 h-3" /> Upload
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Generated Image Preview */}
                          {seg.generatedImage && (
                            <div className="rounded-lg overflow-hidden border border-emerald-400/20">
                              <img src={seg.generatedImage} alt={`Cena ${seg.index + 1}`}
                                className="w-full aspect-video object-cover" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="glass rounded-xl p-16 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                <Film className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Cole o roteiro e clique "Fatiar"</p>
                <p className="text-sm mt-1">Fluxo: Roteiro → Áudio → Imagens IA → Vídeo sincronizado</p>
                <p className="text-xs mt-3 text-primary">Compatível com Veo 3 / Kling / Sora</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Studio;
