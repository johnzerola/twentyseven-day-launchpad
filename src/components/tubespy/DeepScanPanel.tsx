import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Brain, Target, Copy, TrendingUp, Shield, Crosshair, 
  Loader2, X, ChevronDown, ChevronUp, Flame, Eye, Clock,
  FileText, Lightbulb, BarChart3, Sparkles, AlertTriangle,
  Palette, Film, Image, Repeat, Wrench, MonitorPlay
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface DeepScanResult {
  videoInfo: {
    id: string; title: string; channelTitle: string; channelId: string;
    thumbnail: string; views: number; likes: number; comments: number;
    duration: string; durationSeconds?: number; durationMinutes?: number;
    publishedAt: string; tags: string[];
    outlierScore: string; channelSubs: number; hasTranscript: boolean;
    capturedFrames?: number;
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
    thumbnailAnalysis?: {
      dominantColors: string[]; hasTextOverlay: boolean; textOverlayContent: string;
      composition: string; emotionalExpression: string; elements: string[];
      clickbaitLevel: number; suggestions: string[];
    };
    visualStyle?: {
      primaryStyle: string; secondaryStyles: string[]; faceless: boolean;
      editingPace: string; colorGrading: string; transitionStyle: string;
      bRollUsage: string; productionLevel: string;
      replicabilityAsFaceless: number; toolsSuggested: string[];
    };
    visualDNA?: {
      colorPalette?: string[]; lightingStyle?: string;
      cameraPatterns?: string[]; textOnScreenStyle?: string;
      imageTypes?: string[]; backgroundStyle?: string;
      overallAesthetic?: string; referenceStylePrompt?: string;
      frameAnalysis?: { framePosition: string; description: string; keyElements: string[]; mood: string }[];
    };
    sceneTimeline?: {
      sceneIndex: number; startTime: string; endTime: string; durationSeconds: number;
      narrationSummary: string; visualDescription: string; visualPrompt: string;
      cameraAngle?: string; mood: string; energyLevel: string;
      retentionTechnique?: string; textOnScreen?: string; transitionToNext?: string;
    }[];
    rewatchSegments?: {
      timeRange: string; reason: string; rewatchScore: number; contentSummary: string;
    }[];
    cloneTemplate: {
      templateStructure: string; titleVariations: string[];
      scriptOutline: string; estimatedViewsSmallChannel: string;
      suggestedDuration?: string; thumbnailRecipe?: string;
      hookScript?: string; ctaScript?: string;
      wordCountTarget?: number;
    };
    scores: {
      virality: number; replicability: number; monetization: number; overall: number;
    };
  };
}

interface DeepScanPanelProps {
  result: DeepScanResult;
  onClose: () => void;
  onCloneToScript?: () => void;
}

const ScoreCircle = ({ score, label, color }: { score: number; label: string; color: string }) => (
  <div className="text-center">
    <div className="relative w-16 h-16 mx-auto">
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

const fmtNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const Section = ({ id, icon: Icon, iconColor, label, badge, expanded, onToggle, children }: {
  id: string; icon: any; iconColor: string; label: string; badge?: React.ReactNode;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <button onClick={onToggle} className="flex items-center justify-between w-full text-left">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {label} {badge}
      </h4>
      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
    <AnimatePresence>
      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="bg-secondary/30 rounded-lg p-4 space-y-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export const DeepScanPanel = ({ result, onClose, onCloneToScript }: DeepScanPanelProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hook: true, retention: false, dna: false, title: false, thumbnail: true, visual: true, visualDna: false, sceneTimeline: false, rewatch: false, clone: true,
  });
  const { videoInfo, analysis } = result;
  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="glass rounded-xl border border-primary/20 overflow-hidden">
      
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
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Video Clone Engine — Engenharia Reversa</span>
              </div>
              <h3 className="font-bold text-sm line-clamp-2">{videoInfo.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {videoInfo.channelTitle} • {fmtNum(videoInfo.views)} views • {fmtNum(videoInfo.likes)} likes • Outlier {videoInfo.outlierScore}x
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {videoInfo.hasTranscript && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-emerald-400 border-emerald-500/30">
                    <FileText className="w-2.5 h-2.5" /> Transcrição
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px]">{videoInfo.duration}</Badge>
                {analysis.visualStyle && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-purple-400 border-purple-500/30">
                    <Film className="w-2.5 h-2.5" /> {analysis.visualStyle.primaryStyle}
                  </Badge>
                )}
                {analysis.visualStyle?.faceless && (
                  <Badge variant="outline" className="text-[9px] gap-1 text-blue-400 border-blue-500/30">
                    👤 Faceless
                  </Badge>
                )}
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

      <div className="p-5 space-y-4 max-h-[700px] overflow-y-auto custom-scrollbar">

        {/* ══════ VISUAL STYLE ══════ */}
        {analysis.visualStyle && (
          <Section id="visual" icon={Film} iconColor="text-purple-400" label="Estilo Visual"
            badge={<Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">{analysis.visualStyle.primaryStyle}</Badge>}
            expanded={expandedSections.visual} onToggle={() => toggle('visual')}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Estilo Principal</p>
                <p className="text-xs font-medium">{analysis.visualStyle.primaryStyle}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ritmo de Edição</p>
                <p className="text-xs font-medium">{analysis.visualStyle.editingPace}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Produção</p>
                <p className="text-xs font-medium">{analysis.visualStyle.productionLevel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Color Grading</p>
                <p className="text-xs font-medium">{analysis.visualStyle.colorGrading}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Transições</p>
                <p className="text-xs font-medium">{analysis.visualStyle.transitionStyle}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">B-Roll</p>
                <p className="text-xs font-medium">{analysis.visualStyle.bRollUsage}</p>
              </div>
            </div>
            {analysis.visualStyle.secondaryStyles.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1.5">Estilos Secundários</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.visualStyle.secondaryStyles.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Replicabilidade Faceless:</span>
              <Progress value={analysis.visualStyle.replicabilityAsFaceless} className="h-1.5 flex-1" />
              <span className="text-xs font-mono font-bold">{analysis.visualStyle.replicabilityAsFaceless}%</span>
            </div>
            {analysis.visualStyle.toolsSuggested.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Ferramentas Sugeridas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.visualStyle.toolsSuggested.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ══════ THUMBNAIL ANALYSIS ══════ */}
        {analysis.thumbnailAnalysis && (
          <Section id="thumbnail" icon={Image} iconColor="text-pink-400" label="Análise de Thumbnail"
            badge={<Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-[10px]">Clickbait: {analysis.thumbnailAnalysis.clickbaitLevel}/10</Badge>}
            expanded={expandedSections.thumbnail} onToggle={() => toggle('thumbnail')}>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Composição</p>
                <p className="text-xs font-medium">{analysis.thumbnailAnalysis.composition}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expressão</p>
                <p className="text-xs font-medium">{analysis.thumbnailAnalysis.emotionalExpression}</p>
              </div>
            </div>

            {analysis.thumbnailAnalysis.hasTextOverlay && analysis.thumbnailAnalysis.textOverlayContent && (
              <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-pink-400">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Texto Overlay</p>
                <p className="text-xs font-medium">"{analysis.thumbnailAnalysis.textOverlayContent}"</p>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-pink-400 mb-1.5">Cores Dominantes</p>
              <div className="flex flex-wrap gap-2">
                {analysis.thumbnailAnalysis.dominantColors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/50 rounded px-2 py-1">
                    <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c.startsWith('#') ? c : undefined }} />
                    <span className="text-[10px]">{c}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Elementos Visuais</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.thumbnailAnalysis.elements.map((e, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{e}</Badge>
                ))}
              </div>
            </div>

            {analysis.thumbnailAnalysis.suggestions.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" /> Sugestões de Melhoria
                </p>
                {analysis.thumbnailAnalysis.suggestions.map((s, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
                    <span className="text-emerald-400 mt-0.5">→</span> {s}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ══════ REWATCH SEGMENTS ══════ */}
        {analysis.rewatchSegments && analysis.rewatchSegments.length > 0 && (
          <Section id="rewatch" icon={Repeat} iconColor="text-cyan-400" label="Segmentos Mais Assistidos"
            badge={<Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">{analysis.rewatchSegments.length} picos</Badge>}
            expanded={expandedSections.rewatch} onToggle={() => toggle('rewatch')}>
            <div className="space-y-3">
              {analysis.rewatchSegments.map((seg, i) => (
                <div key={i} className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-400">{seg.timeRange}</span>
                      <div className="flex items-center gap-1">
                        <MonitorPlay className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] font-bold">{seg.rewatchScore}/10</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-medium">{seg.contentSummary}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Motivo: {seg.reason}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ══════ HOOK ANALYSIS ══════ */}
        <Section id="hook" icon={Crosshair} iconColor="text-red-400" label="Análise do Hook"
          badge={<Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Poder: {analysis.hookAnalysis.powerScore}/10</Badge>}
          expanded={expandedSections.hook} onToggle={() => toggle('hook')}>
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
        </Section>

        {/* ══════ RETENTION MAP ══════ */}
        <Section id="retention" icon={BarChart3} iconColor="text-blue-400" label="Mapa de Retenção"
          expanded={expandedSections.retention} onToggle={() => toggle('retention')}>
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
          {analysis.retentionMap.openLoops.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Open Loops
              </p>
              {analysis.retentionMap.openLoops.map((loop, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-blue-400 mt-0.5">→</span> {loop}</div>
              ))}
            </div>
          )}
          {analysis.retentionMap.patternInterrupts.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-yellow-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Pattern Interrupts
              </p>
              {analysis.retentionMap.patternInterrupts.map((pi, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-yellow-400 mt-0.5">⚡</span> {pi}</div>
              ))}
            </div>
          )}
          {analysis.retentionMap.dropPoints.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Pontos de Queda
              </p>
              {analysis.retentionMap.dropPoints.map((dp, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-destructive mt-0.5">↓</span> {dp}</div>
              ))}
            </div>
          )}
        </Section>

        {/* ══════ CONTENT DNA ══════ */}
        <Section id="dna" icon={Target} iconColor="text-purple-400" label="DNA do Conteúdo"
          expanded={expandedSections.dna} onToggle={() => toggle('dna')}>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Formato</p><p className="text-xs font-medium">{analysis.contentDNA.format}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tom Emocional</p><p className="text-xs font-medium">{analysis.contentDNA.emotionalTone}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nicho</p><p className="text-xs font-medium">{analysis.contentDNA.nicheCategory}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Persona</p><p className="text-xs font-medium">{analysis.contentDNA.targetPersona}</p></div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1.5">Gatilhos Psicológicos</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.contentDNA.psychTriggers.map((t, i) => (
                <Badge key={i} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{t}</Badge>
              ))}
            </div>
          </div>
        </Section>

        {/* ══════ TITLE ══════ */}
        <Section id="title" icon={Eye} iconColor="text-amber-400" label="Título & CTR"
          badge={<Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">CTR: {analysis.titleAnalysis.ctrScore}/10</Badge>}
          expanded={expandedSections.title} onToggle={() => toggle('title')}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Técnica de Copywriting</p>
            <p className="text-xs">{analysis.titleAnalysis.copywritingTechnique}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5">Palavras de Poder</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.titleAnalysis.powerWords.map((w, i) => (
                <Badge key={i} className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">{w}</Badge>
              ))}
            </div>
          </div>
        </Section>

        {/* ══════ CLONE TEMPLATE ══════ */}
        <Section id="clone" icon={Copy} iconColor="text-emerald-400" label="Clonagem Acelerada"
          badge={<Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Template Pronto</Badge>}
          expanded={expandedSections.clone} onToggle={() => toggle('clone')}>
          
          {/* Hook Script */}
          {analysis.cloneTemplate.hookScript && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-red-400">Hook Pronto para Usar</p>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                  onClick={() => copy(analysis.cloneTemplate.hookScript!, 'Hook')}>
                  <Copy className="w-2.5 h-2.5" /> Copiar
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-red-400">
                <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.hookScript}</p>
              </div>
            </div>
          )}

          {/* Template Structure */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400">Template de Replicação</p>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                onClick={() => copy(analysis.cloneTemplate.templateStructure, 'Template')}>
                <Copy className="w-2.5 h-2.5" /> Copiar
              </Button>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-emerald-400">
              <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.templateStructure}</p>
            </div>
          </div>

          {/* Title Variations */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1.5">Variações de Título</p>
            <div className="space-y-1.5">
              {analysis.cloneTemplate.titleVariations.map((title, i) => (
                <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium flex-1">{title}</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copy(title, 'Título')}>
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
                  onClick={() => copy(analysis.cloneTemplate.scriptOutline, 'Roteiro')}>
                  <Copy className="w-2.5 h-2.5" /> Copiar
                </Button>
                {onCloneToScript && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1 text-primary"
                    onClick={() => onCloneToScript()}>
                    <Sparkles className="w-2.5 h-2.5" /> Usar no Roteiro
                  </Button>
                )}
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-primary/50">
              <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.scriptOutline}</p>
            </div>
          </div>

          {/* Thumbnail Recipe */}
          {analysis.cloneTemplate.thumbnailRecipe && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-pink-400 flex items-center gap-1">
                  <Image className="w-3 h-3" /> Receita de Thumbnail
                </p>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                  onClick={() => copy(analysis.cloneTemplate.thumbnailRecipe!, 'Thumbnail')}>
                  <Copy className="w-2.5 h-2.5" /> Copiar
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-pink-400">
                <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.thumbnailRecipe}</p>
              </div>
            </div>
          )}

          {/* CTA Script */}
          {analysis.cloneTemplate.ctaScript && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-amber-400">CTA Pronto</p>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 gap-1"
                  onClick={() => copy(analysis.cloneTemplate.ctaScript!, 'CTA')}>
                  <Copy className="w-2.5 h-2.5" /> Copiar
                </Button>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-amber-400">
                <p className="text-xs whitespace-pre-line">{analysis.cloneTemplate.ctaScript}</p>
              </div>
            </div>
          )}

          {/* Estimated views + duration */}
          <div className="flex gap-3 flex-wrap">
            <div className="bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-2 flex-1">
              <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Views estimadas (1K-10K subs):</p>
                <p className="text-sm font-bold text-emerald-400">{analysis.cloneTemplate.estimatedViewsSmallChannel}</p>
              </div>
            </div>
            {analysis.cloneTemplate.suggestedDuration && (
              <div className="bg-blue-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Duração sugerida:</p>
                  <p className="text-sm font-bold text-blue-400">{analysis.cloneTemplate.suggestedDuration}</p>
                </div>
              </div>
            )}
          </div>

          {/* 🎬 MODELAR VÍDEO — Main CTA */}
          {onCloneToScript && (
            <Button className="w-full gap-2 h-12 text-sm gradient-hero border-0 mt-3" 
              onClick={() => onCloneToScript()}>
              <Film className="w-5 h-5" /> 🎬 Modelar Vídeo — Criar Roteiro Similar
            </Button>
          )}
        </Section>
      </div>
    </motion.div>
  );
};

export default DeepScanPanel;
