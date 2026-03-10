import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Brain, Target, Copy, TrendingUp, Shield, Crosshair, 
  Loader2, X, ChevronDown, ChevronUp, Flame, Eye, Clock,
  FileText, Lightbulb, BarChart3, Sparkles, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface DeepScanResult {
  videoInfo: {
    id: string; title: string; channelTitle: string; channelId: string;
    thumbnail: string; views: number; likes: number; comments: number;
    duration: string; publishedAt: string; tags: string[];
    outlierScore: string; channelSubs: number; hasTranscript: boolean;
  };
  analysis: {
    hookAnalysis: {
      hookType: string; hookText: string; whyItWorks: string; powerScore: number;
    };
    retentionMap: {
      structure: { phase: string; timeRange: string; technique: string; retentionEstimate: number }[];
      openLoops: string[]; patternInterrupts: string[]; dropPoints: string[];
    };
    contentDNA: {
      format: string; emotionalTone: string; psychTriggers: string[];
      targetPersona: string; nicheCategory: string;
    };
    titleAnalysis: {
      ctrScore: number; powerWords: string[];
      copywritingTechnique: string; thumbnailSuggestion: string;
    };
    cloneTemplate: {
      templateStructure: string; titleVariations: string[];
      scriptOutline: string; estimatedViewsSmallChannel: string;
    };
    scores: {
      virality: number; replicability: number; monetization: number; overall: number;
    };
  };
}

interface DeepScanPanelProps {
  result: DeepScanResult;
  onClose: () => void;
  onCloneToScript?: (outline: string) => void;
}

const ScoreCircle = ({ score, label, color }: { score: number; label: string; color: string }) => (
  <div className="text-center">
    <div className={`relative w-16 h-16 mx-auto`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${score}, 100`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{score}</span>
    </div>
    <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
  </div>
);

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

export const DeepScanPanel = ({ result, onClose, onCloneToScript }: DeepScanPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hook: true, retention: true, dna: true, title: true, clone: true,
  });
  const { videoInfo, analysis } = result;

  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass rounded-xl border border-primary/20 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 p-5 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 flex-1 min-w-0">
            {videoInfo.thumbnail && (
              <img src={videoInfo.thumbnail} alt="" className="w-32 aspect-video rounded-lg object-cover border border-border/30 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Deep Scan — Engenharia Reversa</span>
              </div>
              <h3 className="font-bold text-sm line-clamp-2">{videoInfo.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {videoInfo.channelTitle} • {formatNumber(videoInfo.views)} views • {formatNumber(videoInfo.likes)} likes • Outlier {videoInfo.outlierScore}x
              </p>
              <div className="flex gap-1 mt-2">
                {videoInfo.hasTranscript && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-emerald-400 border-emerald-500/30">
                    <FileText className="w-2.5 h-2.5" /> Transcrição analisada
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px]">
                  {videoInfo.duration}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Score Dashboard */}
        <div className="flex justify-center gap-6 mt-5">
          <ScoreCircle score={analysis.scores.virality} label="Viralidade" color="hsl(var(--primary))" />
          <ScoreCircle score={analysis.scores.replicability} label="Replicável" color="#22c55e" />
          <ScoreCircle score={analysis.scores.monetization} label="Monetização" color="#f59e0b" />
          <ScoreCircle score={analysis.scores.overall} label="Score Geral" color="#a855f7" />
        </div>
      </div>

      <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">

        {/* ══════ HOOK ANALYSIS ══════ */}
        <div className="space-y-2">
          <button onClick={() => toggle('hook')} className="flex items-center justify-between w-full text-left">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-red-400" /> Análise do Hook
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                Poder: {analysis.hookAnalysis.powerScore}/10
              </Badge>
            </h4>
            {expandedSections.hook ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedSections.hook && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{analysis.hookAnalysis.hookType}</Badge>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-red-400">
                    <p className="text-xs italic">"{analysis.hookAnalysis.hookText}"</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Por que funciona:</p>
                    <p className="text-xs text-muted-foreground">{analysis.hookAnalysis.whyItWorks}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Poder:</span>
                    <Progress value={analysis.hookAnalysis.powerScore * 10} className="h-2 flex-1" />
                    <span className="text-xs font-bold">{analysis.hookAnalysis.powerScore}/10</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════ RETENTION MAP ══════ */}
        <div className="space-y-2">
          <button onClick={() => toggle('retention')} className="flex items-center justify-between w-full text-left">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" /> Mapa de Retenção
            </h4>
            {expandedSections.retention ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedSections.retention && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                  {/* Retention Timeline */}
                  <div className="space-y-2">
                    {analysis.retentionMap.structure.map((phase, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 text-[10px] text-muted-foreground font-mono flex-shrink-0">{phase.timeRange}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-medium">{phase.phase}</span>
                            <span className="text-[10px] text-muted-foreground">{phase.retentionEstimate}%</span>
                          </div>
                          <Progress value={phase.retentionEstimate} className="h-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Open Loops */}
                  {analysis.retentionMap.openLoops.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Open Loops Detectados
                      </p>
                      <div className="space-y-1">
                        {analysis.retentionMap.openLoops.map((loop, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-blue-400 mt-0.5">→</span> {loop}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pattern Interrupts */}
                  {analysis.retentionMap.patternInterrupts.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-yellow-400 mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Pattern Interrupts
                      </p>
                      <div className="space-y-1">
                        {analysis.retentionMap.patternInterrupts.map((pi, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-yellow-400 mt-0.5">⚡</span> {pi}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drop Points */}
                  {analysis.retentionMap.dropPoints.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Pontos de Queda
                      </p>
                      <div className="space-y-1">
                        {analysis.retentionMap.dropPoints.map((dp, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-destructive mt-0.5">↓</span> {dp}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════ CONTENT DNA ══════ */}
        <div className="space-y-2">
          <button onClick={() => toggle('dna')} className="flex items-center justify-between w-full text-left">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" /> DNA do Conteúdo
            </h4>
            {expandedSections.dna ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedSections.dna && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Formato</p>
                      <p className="text-xs font-medium">{analysis.contentDNA.format}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tom Emocional</p>
                      <p className="text-xs font-medium">{analysis.contentDNA.emotionalTone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nicho</p>
                      <p className="text-xs font-medium">{analysis.contentDNA.nicheCategory}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Persona</p>
                      <p className="text-xs font-medium">{analysis.contentDNA.targetPersona}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1.5">Gatilhos Psicológicos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.contentDNA.psychTriggers.map((trigger, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                          {trigger}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════ TITLE & THUMBNAIL ══════ */}
        <div className="space-y-2">
          <button onClick={() => toggle('title')} className="flex items-center justify-between w-full text-left">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" /> Título & Thumbnail
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                CTR: {analysis.titleAnalysis.ctrScore}/10
              </Badge>
            </h4>
            {expandedSections.title ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedSections.title && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Técnica de Copywriting</p>
                    <p className="text-xs">{analysis.titleAnalysis.copywritingTechnique}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">Palavras de Poder</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.titleAnalysis.powerWords.map((word, i) => (
                        <Badge key={i} className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">{word}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sugestão de Thumbnail</p>
                    <p className="text-xs text-muted-foreground">{analysis.titleAnalysis.thumbnailSuggestion}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════ CLONE TEMPLATE ══════ */}
        <div className="space-y-2">
          <button onClick={() => toggle('clone')} className="flex items-center justify-between w-full text-left">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Copy className="w-4 h-4 text-emerald-400" /> Clonagem Acelerada
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                Template Pronto
              </Badge>
            </h4>
            {expandedSections.clone ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedSections.clone && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-secondary/30 rounded-lg p-4 space-y-4">
                  {/* Template Structure */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400">Template de Replicação</p>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                        onClick={() => copyToClipboard(analysis.cloneTemplate.templateStructure, 'Template')}>
                        <Copy className="w-2.5 h-2.5" /> Copiar
                      </Button>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-emerald-400">
                      <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.templateStructure}</p>
                    </div>
                  </div>

                  {/* Title Variations */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1.5">Variações de Título para Clonar</p>
                    <div className="space-y-1.5">
                      {analysis.cloneTemplate.titleVariations.map((title, i) => (
                        <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium flex-1">{title}</span>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
                            onClick={() => copyToClipboard(title, 'Título')}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Script Outline */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400">Estrutura de Roteiro</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                          onClick={() => copyToClipboard(analysis.cloneTemplate.scriptOutline, 'Roteiro')}>
                          <Copy className="w-2.5 h-2.5" /> Copiar
                        </Button>
                        {onCloneToScript && (
                          <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1 text-primary"
                            onClick={() => onCloneToScript(analysis.cloneTemplate.scriptOutline)}>
                            <Sparkles className="w-2.5 h-2.5" /> Usar no Roteiro
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-primary/50">
                      <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.scriptOutline}</p>
                    </div>
                  </div>

                  {/* Estimated views */}
                  <div className="bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Estimativa de views (canal 1K-10K subs):</p>
                      <p className="text-sm font-bold text-emerald-400">{analysis.cloneTemplate.estimatedViewsSmallChannel}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default DeepScanPanel;
