import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, Trophy, Calendar, CheckCircle2, TrendingUp, 
  Flame, Zap, Play, Clock, Star, ChevronLeft, ChevronRight,
  BarChart3, Video, Eye, Users, Loader2, Brain, Youtube, Trash2,
  FileText, AlertTriangle, ArrowRight, RefreshCw, Lightbulb
} from 'lucide-react';
import { YPPProgressDashboard } from '@/components/dashboard/YPPProgressDashboard';
import { PredictionVsReality } from '@/components/dashboard/PredictionVsReality';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrackerWizard } from '@/components/tracker/TrackerWizard';

interface DailyTask {
  id: string;
  day_number: number;
  title: string;
  description: string;
  task_type: string;
  video_type: string;
  completed: boolean;
  completed_at: string | null;
  target_shorts: number;
  target_longs: number;
  target_views: number;
  target_subs: number;
}

interface Milestone {
  id: string;
  milestone_type: string;
  title: string;
  target_value: number;
  current_value: number;
  reached: boolean;
  reached_at: string | null;
  day_expected: number;
  icon: string;
}

interface Plan {
  id: string;
  niche: string;
  status: string;
  started_at: string;
  current_day: number;
  total_shorts_published: number;
  total_longs_published: number;
  total_views: number;
  plan_json: any;
  strategy: string;
  channel_id: string | null;
}

interface SmartAlert {
  type: 'replicate' | 'change' | 'milestone' | 'tip';
  title: string;
  message: string;
  icon: string;
}

export default function Tracker30Days() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [channelName, setChannelName] = useState('');
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);
  const [syncingMetrics, setSyncingMetrics] = useState(false);

  const loadPlan = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: plans } = await supabase
      .from('monetization_30day_plans' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    const activePlan = (plans as any)?.[0];
    if (activePlan) {
      setPlan(activePlan);
      const started = new Date(activePlan.started_at);
      const now = new Date();
      const diffDays = Math.min(30, Math.max(1, Math.ceil((now.getTime() - started.getTime()) / 86400000)));
      setSelectedDay(diffDays);

      const [tasksRes, milestonesRes, channelRes] = await Promise.all([
        supabase.from('daily_tasks' as any).select('*').eq('plan_id', activePlan.id).order('day_number'),
        supabase.from('monetization_milestones' as any).select('*').eq('plan_id', activePlan.id).order('day_expected'),
        activePlan.channel_id
          ? supabase.from('user_channels' as any).select('channel_name,subscribers,views,videos').eq('id', activePlan.channel_id).limit(1)
          : Promise.resolve({ data: null }),
      ]);
      setTasks((tasksRes.data as any) || []);
      setMilestones((milestonesRes.data as any) || []);
      
      const ch = (channelRes.data as any)?.[0];
      if (ch?.channel_name) setChannelName(ch.channel_name);

      // Generate smart alerts based on data
      generateSmartAlerts(activePlan, (tasksRes.data as any) || [], (milestonesRes.data as any) || [], ch, diffDays);
    }
    setLoading(false);
  }, []);

  const generateSmartAlerts = (plan: any, tasks: DailyTask[], milestones: Milestone[], channel: any, currentDay: number) => {
    const alerts: SmartAlert[] = [];
    
    // Check milestone proximity
    const upcomingMilestone = milestones.find(m => !m.reached && m.day_expected <= currentDay + 3 && m.day_expected >= currentDay);
    if (upcomingMilestone) {
      alerts.push({
        type: 'milestone',
        title: `Marco próximo: ${upcomingMilestone.title}`,
        message: `Meta de ${upcomingMilestone.target_value} esperada para o dia ${upcomingMilestone.day_expected}. Atual: ${upcomingMilestone.current_value}.`,
        icon: '🎯',
      });
    }

    // Check if behind schedule
    const dayTasks = tasks.filter(t => t.day_number <= currentDay);
    const completedRate = dayTasks.length > 0 ? dayTasks.filter(t => t.completed).length / dayTasks.length : 1;
    if (completedRate < 0.5 && currentDay > 3) {
      alerts.push({
        type: 'change',
        title: 'Progresso abaixo do esperado',
        message: `Apenas ${Math.round(completedRate * 100)}% das tarefas concluídas. Considere ajustar a estratégia ou reduzir a frequência de upload.`,
        icon: '⚠️',
      });
    }

    // Check for content tasks that could use the pipeline
    const contentTasksToday = tasks.filter(t => t.day_number === currentDay && t.task_type === 'content' && !t.completed);
    if (contentTasksToday.length > 0) {
      alerts.push({
        type: 'tip',
        title: `${contentTasksToday.length} conteúdo(s) para produzir hoje`,
        message: 'Use o botão "Produzir" para abrir o gerador de roteiros com o contexto do seu plano.',
        icon: '🚀',
      });
    }

    // Replicate format alert if past day 10
    if (currentDay >= 10 && plan.strategy === 'shorts-first') {
      const completedContentTasks = tasks.filter(t => t.task_type === 'content' && t.completed);
      if (completedContentTasks.length >= 5) {
        alerts.push({
          type: 'replicate',
          title: 'Replique o que funciona',
          message: 'Você já tem dados suficientes. Analise quais formatos tiveram mais engajamento e duplique-os.',
          icon: '🔄',
        });
      }
    }

    setSmartAlerts(alerts);
  };

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const toggleTask = async (taskId: string, completed: boolean) => {
    const now = completed ? new Date().toISOString() : null;
    await supabase.from('daily_tasks' as any).update({ 
      completed, completed_at: now, updated_at: new Date().toISOString(),
    } as any).eq('id', taskId);
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed, completed_at: now } : t));
    
    if (completed && plan) {
      toast.success('Tarefa concluída! 🎉');
      const completedTasks = tasks.filter(t => t.completed || t.id === taskId);
      const shortsCompleted = completedTasks.filter(t => t.video_type === 'short' && t.task_type === 'content').length;
      const longsCompleted = completedTasks.filter(t => t.video_type === 'long' && t.task_type === 'content').length;
      
      // Sync plan progress + content_queue
      await Promise.all([
        supabase.from('monetization_30day_plans' as any).update({
          total_shorts_published: shortsCompleted,
          total_longs_published: longsCompleted,
          current_day: selectedDay,
          updated_at: new Date().toISOString(),
        } as any).eq('id', plan.id),
        // Auto-add to content queue when content task is completed
        (async () => {
          const task = tasks.find(t => t.id === taskId);
          if (completed && task?.task_type === 'content') {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (u) {
              await supabase.from('content_queue' as any).insert({
                user_id: u.id,
                title: task.title || '',
                video_type: task.video_type === 'short' ? 'short' : 'long',
                status: 'done',
                niche: plan.niche,
                channel_id: plan.channel_id,
              } as any);
            }
          }
        })(),
      ]);
    }
  };

  // v2.2: Navigate to Scripts with context from the plan
  const handleProduce = (task?: DailyTask) => {
    const params = new URLSearchParams();
    if (plan?.niche) params.set('niche', plan.niche);
    if (task?.video_type) params.set('type', task.video_type === 'short' ? 'short' : 'long');
    if (task?.title) params.set('topic', task.title);
    if (plan?.strategy) params.set('strategy', plan.strategy);
    navigate(`/scripts?${params.toString()}`);
  };

  // v2.3: Sync YouTube metrics  
  const syncYouTubeMetrics = async () => {
    if (!plan?.channel_id) return;
    setSyncingMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-analytics', {
        body: { channelId: plan.channel_id },
      });
      if (error) throw error;
      
      if (data?.analytics) {
        // Update milestones with real data
        const subs = data.analytics.subscribers || 0;
        const views = data.analytics.views || 0;
        
        for (const m of milestones) {
          let newValue = m.current_value;
          if (m.milestone_type === 'subs') newValue = subs;
          if (m.milestone_type === 'views') newValue = views;
          
          if (newValue !== m.current_value) {
            const reached = newValue >= m.target_value;
            await supabase.from('monetization_milestones' as any).update({
              current_value: newValue,
              reached,
              reached_at: reached && !m.reached ? new Date().toISOString() : m.reached_at,
            } as any).eq('id', m.id);
          }
        }
        
        // Update plan total views
        await supabase.from('monetization_30day_plans' as any).update({
          total_views: views,
          updated_at: new Date().toISOString(),
        } as any).eq('id', plan.id);

        toast.success('Métricas sincronizadas do YouTube!');
        await loadPlan();
      }
    } catch (e: any) {
      toast.error('Conecte o YouTube OAuth para sincronizar métricas reais.');
    } finally {
      setSyncingMetrics(false);
    }
  };

  const resetPlan = async () => {
    if (!plan) return;
    if (!confirm('Tem certeza que deseja resetar o plano? Isso apagará todo o progresso.')) return;
    await supabase.from('monetization_30day_plans' as any).update({ status: 'archived' } as any).eq('id', plan.id);
    setPlan(null);
    setTasks([]);
    setMilestones([]);
    toast.success('Plano arquivado. Você pode gerar um novo.');
  };

  const dayTasks = tasks.filter(t => t.day_number === selectedDay);
  const completedTotal = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? (completedTotal / totalTasks) * 100 : 0;

  const dayCompletionMap = new Map<number, { total: number; completed: number }>();
  tasks.forEach(t => {
    const curr = dayCompletionMap.get(t.day_number) || { total: 0, completed: 0 };
    curr.total++;
    if (t.completed) curr.completed++;
    dayCompletionMap.set(t.day_number, curr);
  });

  const reachedMilestones = milestones.filter(m => m.reached).length;
  const planJson = plan?.plan_json || {};
  const phases = planJson.phases || [];
  const currentPhase = phases.find((p: any) => selectedDay >= p.days?.[0] && selectedDay <= p.days?.[1]);
  const strategyLabel = plan?.strategy === 'shorts-first' ? '⚡ Shorts' :
    plan?.strategy === 'longform-first' ? '🎬 Longform' : '🔄 Híbrido';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <TrackerWizard onPlanGenerated={loadPlan} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Tracker 30 Dias
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {plan.niche} • {new Date(plan.started_at).toLocaleDateString('pt-BR')}
              </p>
              {channelName && (
                <Badge variant="outline" className="text-[10px]">
                  <Youtube className="w-3 h-3 mr-1" />{channelName}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">{strategyLabel}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button variant="outline" size="sm" onClick={syncYouTubeMetrics} disabled={syncingMetrics}>
              {syncingMetrics ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5 hidden sm:inline text-xs">Sync</span>
            </Button>
            <Badge variant="outline" className="text-sm px-3 py-1">
              <Flame className="w-3.5 h-3.5 mr-1 text-orange-500" />
              Dia {selectedDay}/30
            </Badge>
            <Button variant="ghost" size="sm" onClick={resetPlan} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* v2.3: Smart Alerts */}
        {smartAlerts.length > 0 && (
          <div className="space-y-2">
            {smartAlerts.map((alert, i) => (
              <Card key={i} className={`transition-all ${
                alert.type === 'change' ? 'border-destructive/30 bg-destructive/5' :
                alert.type === 'replicate' ? 'border-primary/30 bg-primary/5' :
                alert.type === 'milestone' ? 'border-yellow-500/30 bg-yellow-500/5' :
                'border-border'
              }`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-lg">{alert.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                  {alert.type === 'tip' && (
                    <Button size="sm" variant="outline" onClick={() => handleProduce()}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> Produzir
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Progress Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Progresso</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(overallProgress)}%</p>
              <Progress value={overallProgress} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Concluídas</span>
              </div>
              <p className="text-2xl font-bold">{completedTotal}</p>
              <p className="text-[10px] text-muted-foreground">de {totalTasks} tarefas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Milestones</span>
              </div>
              <p className="text-2xl font-bold">{reachedMilestones}/{milestones.length}</p>
              <p className="text-[10px] text-muted-foreground">conquistados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Fase Atual</span>
              </div>
              <p className="text-sm font-bold truncate">{currentPhase?.name || 'Fase 1'}</p>
              <p className="text-[10px] text-muted-foreground">{currentPhase?.focus?.slice(0, 50) || ''}</p>
            </CardContent>
          </Card>
        </div>

        {/* Day Calendar Strip */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(d => Math.max(1, d - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium">Dia {selectedDay}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(d => Math.min(30, d + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-30 gap-1">
              {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                const info = dayCompletionMap.get(day);
                const isComplete = info && info.completed === info.total && info.total > 0;
                const isPartial = info && info.completed > 0 && !isComplete;
                const isSelected = day === selectedDay;
                const hasMilestone = milestones.some(m => m.day_expected === day);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`relative aspect-square rounded-md text-[10px] font-medium transition-all flex items-center justify-center
                      ${isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : ''}
                      ${isComplete && !isSelected ? 'bg-emerald-500/20 text-emerald-400' : ''}
                      ${isPartial && !isSelected ? 'bg-yellow-500/20 text-yellow-400' : ''}
                      ${!isComplete && !isPartial && !isSelected ? 'bg-muted/50 text-muted-foreground hover:bg-muted' : ''}
                    `}
                  >
                    {day}
                    {hasMilestone && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Daily Tasks */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Dia {selectedDay} — Tarefas
                {dayTasks.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                  </Badge>
                )}
              </h2>
              {/* v2.2: Produce button */}
              <Button size="sm" variant="outline" onClick={() => handleProduce()}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Produzir Conteúdo
              </Button>
            </div>

            {dayTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa para este dia</p>
                </CardContent>
              </Card>
            ) : (
              dayTasks.map(task => (
                <Card key={task.id} className={`transition-all ${task.completed ? 'opacity-60 border-emerald-500/30' : 'hover:border-primary/30'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked) => toggleTask(task.id, !!checked)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {task.task_type === 'content' ? '📹' : task.task_type === 'research' ? '🔍' : task.task_type === 'optimization' ? '⚡' : '📊'}
                            {task.task_type}
                          </Badge>
                          {task.video_type === 'short' && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-0">Short</Badge>
                          )}
                          {task.video_type === 'long' && (
                            <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-0">Longform</Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {(task.target_shorts > 0 || task.target_longs > 0) && (
                            <div className="flex gap-3 text-[10px] text-muted-foreground">
                              {task.target_shorts > 0 && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{task.target_shorts} shorts</span>}
                              {task.target_longs > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{task.target_longs} longos</span>}
                            </div>
                          )}
                          {/* v2.2: Per-task produce button for content tasks */}
                          {task.task_type === 'content' && !task.completed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-6 text-[10px] text-primary"
                              onClick={(e) => { e.stopPropagation(); handleProduce(task); }}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" /> Produzir
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Day tip */}
            {planJson.daily_tasks?.[selectedDay - 1]?.tip && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4">
                  <p className="text-sm flex items-start gap-2">
                    <Star className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{planJson.daily_tasks[selectedDay - 1].tip}</span>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            <Tabs defaultValue="ypp" className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="ypp" className="text-xs">YPP</TabsTrigger>
                <TabsTrigger value="milestones" className="text-xs">Marcos</TabsTrigger>
                <TabsTrigger value="calibration" className="text-xs">
                  <Brain className="w-3 h-3 mr-1" />IA
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ypp" className="mt-3">
                <YPPProgressDashboard />
              </TabsContent>

              <TabsContent value="milestones" className="mt-3 space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Milestones
                </h2>
                {milestones.map(m => (
                  <Card key={m.id} className={`transition-all ${m.reached ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${m.reached ? 'text-yellow-400' : ''}`}>
                            {m.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={Math.min(100, (m.current_value / m.target_value) * 100)} 
                              className="h-1 flex-1" 
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {m.current_value}/{m.target_value}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Meta: Dia {m.day_expected}
                          </p>
                        </div>
                        {m.reached && <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="calibration" className="mt-3">
                <PredictionVsReality />
              </TabsContent>
            </Tabs>

            {/* Weekly Summary */}
            {planJson.weekly_goals && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Metas Semanais
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  {(planJson.weekly_goals || []).map((wg: any) => (
                    <div key={wg.week} className={`p-2 rounded-lg text-xs ${
                      Math.ceil(selectedDay / 7) === wg.week ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                    }`}>
                      <div className="flex justify-between font-medium">
                        <span>Semana {wg.week}</span>
                        <span className="text-muted-foreground">
                          {wg.shorts || 0} shorts {wg.longs ? `+ ${wg.longs} longos` : ''}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{wg.target_subs} subs</span>
                        <span>{(wg.target_views || 0).toLocaleString()} views</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
