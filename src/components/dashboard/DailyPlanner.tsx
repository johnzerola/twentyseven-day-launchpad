import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CheckCircle2, Circle, Clock, Sparkles, Loader2, ChevronDown, ChevronUp, RotateCcw, Zap, TrendingUp, AlertTriangle, BarChart3, Copy, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

/** Zero-friction: shows latest ready scripts with copy buttons */
const ReadyToProduce = () => {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('saved_scripts')
        .select('id, topic, script_content, video_type, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      setScripts(data || []);
      setLoading(false);
    })();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (loading || scripts.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">Pronto para produzir</span>
        <Badge variant="outline" className="text-[8px]">{scripts.length} roteiros</Badge>
      </div>
      <div className="space-y-1.5">
        {scripts.map((s) => (
          <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10 group">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{s.topic}</p>
              <p className="text-[9px] text-muted-foreground">
                {s.video_type === 'short' ? '📱 Short' : '🎬 Longform'} • {new Date(s.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] gap-1 opacity-70 group-hover:opacity-100"
              onClick={() => copyToClipboard(s.script_content, 'Roteiro')}>
              <Copy className="w-3 h-3" /> Copiar
            </Button>
            <Link to="/scripts" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] gap-1 opacity-70 group-hover:opacity-100">
                <ExternalLink className="w-3 h-3" /> Editar
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DailyTask {
  id: string;
  title: string;
  description: string;
  duration: string;
  path?: string;
  category: 'research' | 'create' | 'optimize' | 'learn';
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
}

interface PerformanceInsight {
  insight: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
}

interface AdaptationData {
  assessment?: string;
  pace?: string;
  performance_insights?: PerformanceInsight[];
  duration_recommendation?: { best_format: string; reason: string; optimal_minutes: number };
  virality_mode_active?: boolean;
  ypp_sprint_tips?: string[];
  strategy_tips?: string[];
  focus_shift?: string;
}

interface PlanAdaptation {
  performanceSummary?: Record<string, { avgViews: number; avgRetention: number; videoCount: number }>;
  nicheBenchmark?: { avgRetention: number; avgViews: number; topRetention: number };
  yppProximity?: { subscribers: number; subsRemaining: number; estimatedWatchHours: number; watchRemaining: number; subsClose: boolean; watchClose: boolean };
  viralityMode?: boolean;
  adaptation?: AdaptationData;
}

const CATEGORY_CONFIG = {
  research: { label: 'Pesquisa', color: 'text-chart-4' },
  create: { label: 'Criar', color: 'text-chart-2' },
  optimize: { label: 'Otimizar', color: 'text-chart-3' },
  learn: { label: 'Aprender', color: 'text-primary' },
};

const STORAGE_KEY = 'daily_planner_data';
const ADAPTATION_KEY = 'daily_planner_adaptation';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function generateTasksFromPlan(plan: any, niche?: string, hoursPerDay?: string, adaptation?: AdaptationData): DailyTask[] {
  const hours = parseFloat(hoursPerDay || '2') || 2;
  const tasks: DailyTask[] = [];
  const viralMode = adaptation?.virality_mode_active;

  if (viralMode) {
    // VIRALITY MODE — max reach tasks
    tasks.push({
      id: 'viral-trend-hunt',
      title: '🔥 Caçar trending topics AGORA',
      description: 'Identifique temas em aceleração nas últimas 24h para capitalizar',
      duration: '20min', path: '/search', category: 'research', completed: false, priority: 'high',
    });
    tasks.push({
      id: 'viral-short-blitz',
      title: '⚡ Produzir 2 Shorts de alto impacto',
      description: 'Shorts com hooks provados para spike de inscritos — YPP sprint',
      duration: '40min', path: '/scripts', category: 'create', completed: false, priority: 'high',
    });
    tasks.push({
      id: 'viral-title-test',
      title: '🎯 Gerar 15 títulos de máximo CTR',
      description: 'Foque em curiosidade gap e números — cliques > qualidade editorial',
      duration: '15min', path: '/titles', category: 'create', completed: false, priority: 'high',
    });
  } else {
    tasks.push({
      id: 'research-trends',
      title: '🔍 Pesquisar tendências do nicho',
      description: `Verifique canais emergentes e títulos virais em "${niche || 'seu nicho'}"`,
      duration: '15min', path: '/search', category: 'research', completed: false,
    });
    tasks.push({
      id: 'analyze-competitor',
      title: '📊 Analisar 1 vídeo viral',
      description: 'Faça engenharia reversa de um vídeo que viralizou no seu nicho',
      duration: '20min', path: '/viral-db', category: 'research', completed: false,
    });
  }

  // Duration-adaptive tasks based on AI recommendation
  const bestFormat = adaptation?.duration_recommendation?.best_format;
  const optMins = adaptation?.duration_recommendation?.optimal_minutes;

  if (hours >= 1.5) {
    tasks.push({
      id: 'write-script',
      title: bestFormat === 'long' 
        ? `✍️ Escrever roteiro longo (~${optMins || 18}min)` 
        : bestFormat === 'short'
        ? '✍️ Produzir 3 roteiros de Shorts'
        : '✍️ Escrever/revisar roteiro',
      description: bestFormat 
        ? `IA recomenda formato "${bestFormat}" — seus vídeos desse tipo retêm ${adaptation?.duration_recommendation?.reason || 'melhor'}`
        : 'Crie um novo roteiro ou refine o que está em progresso',
      duration: '45min', path: '/scripts', category: 'create', completed: false,
      priority: bestFormat ? 'high' : undefined,
    });
  }

  if (hours >= 2) {
    tasks.push({
      id: 'generate-titles',
      title: '🏷️ Gerar 10 títulos virais',
      description: 'Crie variações de título para o próximo vídeo e teste CTR',
      duration: '15min', path: '/titles', category: 'create', completed: false,
    });
  }

  if (hours >= 2.5) {
    tasks.push({
      id: 'optimize-seo',
      title: '📈 Otimizar SEO de 1 vídeo',
      description: 'Gere descrição, tags e hashtags otimizadas',
      duration: '15min', path: '/titles', category: 'optimize', completed: false,
    });
  }

  if (hours >= 3 && !viralMode) {
    tasks.push({
      id: 'study-algorithm',
      title: '🧠 Estudar algoritmo (Dotti)',
      description: 'Pergunte ao Dotti sobre uma técnica de retenção ou algoritmo',
      duration: '10min', category: 'learn', completed: false,
    });
    tasks.push({
      id: 'workflow-review',
      title: '📋 Revisar pipeline de produção',
      description: 'Mova cards no Kanban, atualize status dos projetos',
      duration: '10min', path: '/workflow', category: 'optimize', completed: false,
    });
  }

  // Add custom plan tasks
  if (plan?.plan_json) {
    const planData = typeof plan.plan_json === 'string' ? JSON.parse(plan.plan_json) : plan.plan_json;
    if (planData.daily_tasks && Array.isArray(planData.daily_tasks)) {
      planData.daily_tasks.slice(0, 2).forEach((t: any, i: number) => {
        tasks.push({
          id: `plan-task-${i}`,
          title: `📌 ${t.title || t}`,
          description: t.description || 'Tarefa do seu plano personalizado',
          duration: t.duration || '20min', category: 'create', completed: false,
        });
      });
    }
  }

  return tasks;
}

export const DailyPlanner = () => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [adapting, setAdapting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [adaptationData, setAdaptationData] = useState<PlanAdaptation | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const todayKey = getTodayKey();
    
    // Check cached adaptation
    try {
      const storedAdapt = localStorage.getItem(ADAPTATION_KEY);
      if (storedAdapt) {
        const parsed = JSON.parse(storedAdapt);
        if (parsed.date === todayKey) setAdaptationData(parsed.data);
      }
    } catch {}

    // Check cached tasks
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === todayKey && parsed.tasks?.length > 0) {
          setTasks(parsed.tasks);
          setLoading(false);
          return;
        }
      }
    } catch {}

    const { data: plan } = await supabase
      .from('onboarding_plans')
      .select('plan_json, niche, time_per_day')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Try to use cached adaptation for task generation
    let cachedAdapt: AdaptationData | undefined;
    try {
      const s = localStorage.getItem(ADAPTATION_KEY);
      if (s) { const p = JSON.parse(s); if (p.date === todayKey) cachedAdapt = p.data?.adaptation; }
    } catch {}

    const generated = generateTasksFromPlan(plan, plan?.niche || undefined, plan?.time_per_day || undefined, cachedAdapt);
    setTasks(generated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey, tasks: generated }));
    setLoading(false);
  }, []);

  const runAdaptation = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setAdapting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('adapt-30day-plan', {
        body: { userId: session.user.id },
      });

      if (error) throw error;
      if (result?.error === 'no_plan') {
        toast.info('Nenhum plano de 30 dias encontrado. Crie um plano primeiro na aba Tracker.');
        return;
      }
      if (result?.success) {
        const todayKey = getTodayKey();
        setAdaptationData(result);
        localStorage.setItem(ADAPTATION_KEY, JSON.stringify({ date: todayKey, data: result }));

        // Regenerate tasks with adaptation data
        const { data: plan } = await supabase
          .from('onboarding_plans')
          .select('plan_json, niche, time_per_day')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const newTasks = generateTasksFromPlan(plan, plan?.niche, plan?.time_per_day, result.adaptation);
        setTasks(newTasks);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey, tasks: newTasks }));

        if (result.viralityMode) {
          toast.warning('🔥 Modo Viralidade ATIVADO — canal próximo do YPP!', {
            description: 'Tarefas ajustadas para máximo alcance.',
            duration: 8000,
          });
        } else {
          toast.success('Plano adaptado com dados reais!');
        }
      }
    } catch (e: any) {
      console.error('Adaptation error:', e);
      toast.error('Erro ao adaptar plano. Tente novamente.');
    } finally {
      setAdapting(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Auto-adapt once per day after first week
  useEffect(() => {
    const todayKey = getTodayKey();
    const lastAdapt = localStorage.getItem('last_adaptation_date');
    if (lastAdapt !== todayKey && tasks.length > 0) {
      // Only auto-adapt if we haven't today
      const timer = setTimeout(() => {
        localStorage.setItem('last_adaptation_date', todayKey);
        runAdaptation();
      }, 3000); // 3s after load
      return () => clearTimeout(timer);
    }
  }, [tasks.length, runAdaptation]);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), tasks: updated }));
      return updated;
    });
  }, []);

  const resetTasks = () => {
    setTasks(prev => {
      const reset = prev.map(t => ({ ...t, completed: false }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), tasks: reset }));
      return reset;
    });
    toast.success('Tarefas resetadas!');
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const totalMinutes = tasks.reduce((sum, t) => sum + (parseInt(t.duration) || 0), 0);
  const viralityActive = adaptationData?.viralityMode;
  const insights = adaptationData?.adaptation?.performance_insights;

  if (loading) {
    return (
      <div className="glass rounded-xl p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (tasks.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-xl overflow-hidden ${viralityActive ? 'ring-2 ring-destructive/50' : ''}`}>
      
      {/* Virality Mode Banner */}
      {viralityActive && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-destructive animate-pulse" />
          <span className="text-xs font-bold text-destructive">MODO VIRALIDADE</span>
          <span className="text-[10px] text-destructive/80">— Canal próximo do YPP. Foco em máximo alcance.</span>
          {adaptationData?.yppProximity && (
            <Badge variant="outline" className="ml-auto text-[8px] border-destructive/30 text-destructive">
              {adaptationData.yppProximity.subsRemaining} subs • {adaptationData.yppProximity.watchRemaining}h restantes
            </Badge>
          )}
        </div>
      )}

      {/* Header */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${viralityActive ? 'bg-destructive/15' : 'bg-primary/15'}`}>
            {viralityActive ? <Zap className="w-5 h-5 text-destructive" /> : <CalendarCheck className="w-5 h-5 text-primary" />}
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Planner Diário {viralityActive ? '⚡' : ''}
              <Badge variant="outline" className="text-[9px]">{completedCount}/{tasks.length}</Badge>
              {adaptationData?.adaptation?.pace && (
                <Badge variant={adaptationData.adaptation.pace === 'ahead' ? 'default' : adaptationData.adaptation.pace === 'behind' || adaptationData.adaptation.pace === 'critical' ? 'destructive' : 'secondary'}
                  className="text-[8px]">
                  {adaptationData.adaptation.pace === 'ahead' ? '🚀 Adiantado' :
                   adaptationData.adaptation.pace === 'on_track' ? '✅ No Ritmo' :
                   adaptationData.adaptation.pace === 'behind' ? '⚠️ Atrasado' : '🚨 Crítico'}
                </Badge>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{totalMinutes}min estimados
              {adaptationData?.adaptation?.duration_recommendation && (
                <span className="text-primary ml-1">
                  • Melhor formato: {adaptationData.adaptation.duration_recommendation.optimal_minutes}min
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24">
            <Progress value={progress} className="h-1.5" />
          </div>
          <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Performance Insights */}
      <AnimatePresence>
        {!collapsed && insights && insights.length > 0 && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-2">
              <button onClick={() => setShowInsights(!showInsights)}
                className="flex items-center gap-2 text-[11px] text-primary hover:underline">
                <BarChart3 className="w-3.5 h-3.5" />
                {showInsights ? 'Ocultar' : 'Ver'} insights de performance ({insights.length})
              </button>
              <AnimatePresence>
                {showInsights && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="mt-2 space-y-1.5">
                    {/* Assessment */}
                    {adaptationData?.adaptation?.assessment && (
                      <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-[11px] text-foreground">{adaptationData.adaptation.assessment}</p>
                      </div>
                    )}
                    {insights.map((ins, i) => (
                      <div key={i} className={`p-2 rounded-lg flex items-start gap-2 ${
                        ins.impact === 'high' ? 'bg-destructive/5 border border-destructive/10' :
                        ins.impact === 'medium' ? 'bg-chart-3/5 border border-chart-3/10' : 'bg-muted/30'
                      }`}>
                        <TrendingUp className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          ins.impact === 'high' ? 'text-destructive' : 'text-chart-3'
                        }`} />
                        <div>
                          <p className="text-[10px] font-medium">{ins.insight}</p>
                          <p className="text-[9px] text-muted-foreground">→ {ins.action}</p>
                        </div>
                      </div>
                    ))}
                    {/* Niche benchmark comparison */}
                    {adaptationData?.nicheBenchmark && adaptationData?.performanceSummary && (
                      <div className="p-2 rounded-lg bg-muted/30 text-[10px] text-muted-foreground">
                        📊 Benchmark do nicho: {adaptationData.nicheBenchmark.avgRetention}% retenção média
                        {Object.entries(adaptationData.performanceSummary).map(([bucket, stats]) => (
                          <span key={bucket} className={`ml-1 ${
                            stats.avgRetention > adaptationData.nicheBenchmark!.avgRetention ? 'text-chart-2' : 'text-destructive'
                          }`}>
                            | {bucket}: {stats.avgRetention}%
                            {stats.avgRetention > adaptationData.nicheBenchmark!.avgRetention ? ' ✅' : ' ⬇️'}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-4 space-y-1.5">
              {tasks.map((task, i) => (
                <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group ${
                    task.completed ? 'bg-chart-2/5 opacity-60' :
                    task.priority === 'high' ? 'bg-destructive/5 hover:bg-destructive/10 border border-destructive/10' :
                    'bg-secondary/30 hover:bg-secondary/50'
                  }`}
                  onClick={() => toggleTask(task.id)}>
                  <button className="shrink-0">
                    {task.completed
                      ? <CheckCircle2 className="w-5 h-5 text-chart-2" />
                      : <Circle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.priority === 'high' && (
                      <Badge variant="destructive" className="text-[7px] px-1 py-0">
                        PRIORIDADE
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[8px] ${CATEGORY_CONFIG[task.category].color}`}>
                      {CATEGORY_CONFIG[task.category].label}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">{task.duration}</span>
                    {task.path && !task.completed && (
                      <Link to={task.path} onClick={e => e.stopPropagation()}
                        className="text-[9px] text-primary hover:underline">
                        Ir →
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Ready-to-Produce Section */}
              <ReadyToProduce />

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] text-muted-foreground">
                  {progress === 100 ? '🎉 Tudo concluído! Excelente dia de trabalho.' : `Restam ${tasks.length - completedCount} tarefas`}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={runAdaptation} disabled={adapting}>
                    {adapting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {adapting ? 'Adaptando...' : 'Adaptar com IA'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={resetTasks}>
                    <RotateCcw className="w-3 h-3" /> Reset
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
