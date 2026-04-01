import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Zap, Loader2, Target, TrendingUp, AlertTriangle, CheckCircle2, 
  ChevronDown, ChevronUp, ArrowRight, Brain, Shield, Flame, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionItem {
  priority: 'critical' | 'high' | 'medium';
  action: string;
  reason: string;
  expectedImpact: string;
  tool: string | null;
}

interface DiagnosisData {
  channelHealth: {
    score: number;
    grade: string;
    strengths: string[];
    weaknesses: string[];
  };
  viralReadiness: {
    score: number;
    missingElements: string[];
    readyElements: string[];
  };
  monetizationPath: {
    daysToYPP: number | null;
    currentPhase: string;
    bottleneck: string;
    strategy: string;
  };
  actionPlan: {
    immediate: ActionItem[];
    thisWeek: ActionItem[];
    thisMonth: ActionItem[];
  };
  nicheIntelligence: {
    nicheStrength: number;
    topCompetitorInsight: string;
    contentGap: string;
    recommendedPivot: string | null;
  };
}

const gradeColors: Record<string, string> = {
  S: 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B: 'bg-primary/20 text-primary border-primary/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-destructive/20 text-destructive border-destructive/30',
};

const priorityStyles: Record<string, string> = {
  critical: 'border-destructive/40 bg-destructive/5',
  high: 'border-yellow-500/40 bg-yellow-500/5',
  medium: 'border-primary/40 bg-primary/5',
};

const priorityLabels: Record<string, string> = {
  critical: '🔴 Crítico',
  high: '🟡 Alto',
  medium: '🔵 Médio',
};

export function ViralDiagnosisPanel() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [channelInfo, setChannelInfo] = useState<any>(null);
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'niche' | 'viral'>('plan');

  const runDiagnosis = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('viral-diagnosis');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDiagnosis(data.diagnosis);
      setChannelInfo(data.channel);
      setBenchmarks(data.benchmarks);
      setExpanded(true);
      toast.success('Diagnóstico completo!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateToTool = (tool: string | null) => {
    if (!tool) return;
    const toolRoutes: Record<string, string> = {
      'DubSpy': '/viral-database',
      'Gerador de Roteiros': '/scripts',
      'Daily Planner': '/dashboard',
      'Dotti': '/dashboard',
      'Niche Explorer': '/niche-explorer',
      'TubeRush': '/tracker-30-days',
      'Títulos': '/titles',
    };
    const route = Object.entries(toolRoutes).find(([key]) => 
      tool.toLowerCase().includes(key.toLowerCase())
    )?.[1];
    if (route) window.location.href = route;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Diagnóstico Viral & Monetização
          </CardTitle>
          <div className="flex items-center gap-2">
            {diagnosis && (
              <Badge className={gradeColors[diagnosis.channelHealth.grade] || gradeColors.C}>
                Nota {diagnosis.channelHealth.grade} — {diagnosis.channelHealth.score}/100
              </Badge>
            )}
            <Button
              size="sm"
              onClick={diagnosis ? () => setExpanded(!expanded) : runDiagnosis}
              disabled={loading}
              variant={diagnosis ? "ghost" : "default"}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : diagnosis ? (
                expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1" /> Diagnosticar
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && diagnosis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="space-y-4 pt-0">
              {/* Health Score Bar */}
              <div className="grid grid-cols-3 gap-3">
                <ScoreCard
                  label="Saúde do Canal"
                  score={diagnosis.channelHealth.score}
                  icon={<Shield className="w-4 h-4" />}
                />
                <ScoreCard
                  label="Prontidão Viral"
                  score={diagnosis.viralReadiness.score}
                  icon={<Flame className="w-4 h-4" />}
                />
                <ScoreCard
                  label="Força do Nicho"
                  score={diagnosis.nicheIntelligence.nicheStrength}
                  icon={<Target className="w-4 h-4" />}
                />
              </div>

              {/* Monetization Path */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Caminho para Monetização</span>
                  {diagnosis.monetizationPath.daysToYPP && (
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      <Clock className="w-3 h-3 mr-1" />
                      ~{diagnosis.monetizationPath.daysToYPP} dias p/ YPP
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Fase:</span>{' '}
                    <span className="font-medium capitalize">{diagnosis.monetizationPath.currentPhase}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Gargalo #1:</span>{' '}
                    <span className="font-medium text-destructive">{diagnosis.monetizationPath.bottleneck}</span>
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Estratégia:</span>{' '}
                    <span className="font-medium text-primary">{diagnosis.monetizationPath.strategy}</span>
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
                {[
                  { key: 'plan', label: 'Plano de Ação' },
                  { key: 'viral', label: 'Prontidão Viral' },
                  { key: 'niche', label: 'Intel. do Nicho' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${
                      activeTab === tab.key
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'plan' && (
                <div className="space-y-3">
                  <ActionSection title="🔥 AGORA" items={diagnosis.actionPlan.immediate} onNavigate={navigateToTool} />
                  <ActionSection title="📅 Esta Semana" items={diagnosis.actionPlan.thisWeek} onNavigate={navigateToTool} />
                  <ActionSection title="📆 Este Mês" items={diagnosis.actionPlan.thisMonth} onNavigate={navigateToTool} />
                </div>
              )}

              {activeTab === 'viral' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-emerald-400 mb-1.5">✅ Elementos Prontos</p>
                    {diagnosis.viralReadiness.readyElements.map((el, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> {el}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1.5">❌ Elementos Faltando</p>
                    {diagnosis.viralReadiness.missingElements.map((el, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-destructive shrink-0" /> {el}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1.5">💪 Forças</p>
                    {diagnosis.channelHealth.strengths.map((s, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {s}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1.5">⚠️ Fraquezas</p>
                    {diagnosis.channelHealth.weaknesses.map((w, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-1">• {w}</p>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'niche' && (
                <div className="space-y-3">
                  {benchmarks && (
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="Média de Subs no Nicho" value={benchmarks.nicheAvgSubs.toLocaleString()} />
                      <MiniStat label="Média de Views no Nicho" value={benchmarks.nicheAvgViews.toLocaleString()} />
                      <MiniStat label="Taxa de Monetização" value={`${benchmarks.monetizationRate}%`} />
                      <MiniStat label="Canais Analisados" value={benchmarks.totalNicheChannels} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Insight dos Top Performers</p>
                      <p className="text-xs">{diagnosis.nicheIntelligence.topCompetitorInsight}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Gap de Conteúdo (Oportunidade)</p>
                      <p className="text-xs text-primary">{diagnosis.nicheIntelligence.contentGap}</p>
                    </div>
                    {diagnosis.nicheIntelligence.recommendedPivot && (
                      <div className="p-2.5 rounded-lg bg-chart-4/5 border border-chart-4/20">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Pivô Recomendado</p>
                        <p className="text-xs">{diagnosis.nicheIntelligence.recommendedPivot}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Re-run */}
              <Button variant="outline" size="sm" className="w-full" onClick={runDiagnosis} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                Reanalisar Canal
              </Button>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function ScoreCard({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-destructive';
  return (
    <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-center">
      <div className={`flex items-center justify-center gap-1 mb-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold">{score}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <Progress value={score} className="h-1 mt-1" />
    </div>
  );
}

function ActionSection({ title, items, onNavigate }: { title: string; items: ActionItem[]; onNavigate: (tool: string | null) => void }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5">{title}</p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className={`p-2.5 rounded-lg border ${priorityStyles[item.priority] || priorityStyles.medium}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px]">{priorityLabels[item.priority]}</span>
                </div>
                <p className="text-xs font-medium">{item.action}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.reason}</p>
                <p className="text-[10px] text-primary mt-0.5">→ {item.expectedImpact}</p>
              </div>
              {item.tool && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-[10px]"
                  onClick={() => onNavigate(item.tool)}
                >
                  Ir <ArrowRight className="w-3 h-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-lg bg-muted/30 border border-border">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
