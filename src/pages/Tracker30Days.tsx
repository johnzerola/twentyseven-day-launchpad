import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Rocket, Trophy, Calendar, CheckCircle2, Target, TrendingUp, 
  Flame, Zap, Play, Clock, Star, ChevronLeft, ChevronRight,
  BarChart3, Video, Eye, Users, Loader2, Brain
} from 'lucide-react';
import { YPPProgressDashboard } from '@/components/dashboard/YPPProgressDashboard';
import { PredictionVsReality } from '@/components/dashboard/PredictionVsReality';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

export default function Tracker30Days() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [niche, setNiche] = useState('curiosidades');

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
      // Calculate current day
      const started = new Date(activePlan.started_at);
      const now = new Date();
      const diffDays = Math.min(30, Math.max(1, Math.ceil((now.getTime() - started.getTime()) / 86400000)));
      setSelectedDay(diffDays);

      // Load tasks and milestones
      const [tasksRes, milestonesRes] = await Promise.all([
        supabase.from('daily_tasks' as any).select('*').eq('plan_id', activePlan.id).order('day_number'),
        supabase.from('monetization_milestones' as any).select('*').eq('plan_id', activePlan.id).order('day_expected'),
      ]);
      setTasks((tasksRes.data as any) || []);
      setMilestones((milestonesRes.data as any) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-30day-plan', {
        body: { niche, language: 'pt', country: 'BR', strategy: 'shorts-first' },
      });
      if (error) throw error;
      toast.success('Plano de 30 dias gerado!');
      await loadPlan();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar plano');
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    const now = completed ? new Date().toISOString() : null;
    await supabase.from('daily_tasks' as any).update({ 
      completed, 
      completed_at: now,
      updated_at: new Date().toISOString(),
    } as any).eq('id', taskId);
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed, completed_at: now } : t));
    if (completed) toast.success('Tarefa concluída! 🎉');
  };

  const dayTasks = tasks.filter(t => t.day_number === selectedDay);
  const completedTotal = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const overallProgress = totalTasks > 0 ? (completedTotal / totalTasks) * 100 : 0;

  // Day completion map
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // No active plan - show creation wizard
  if (!plan) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-['Space_Grotesk'] mb-2">
              Monetize em 30 Dias
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Plano diário personalizado com metas, checklist e milestones para atingir o YPP com Shorts.
            </p>
          </div>

          <Card className="border-primary/20">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nicho do canal</label>
                <Input 
                  value={niche} 
                  onChange={e => setNiche(e.target.value)}
                  placeholder="Ex: curiosidades, terror, mitologia..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <Video className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">60+ Shorts</p>
                  <p className="text-[10px] text-muted-foreground/70">em 30 dias</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">1.000 Subs</p>
                  <p className="text-[10px] text-muted-foreground/70">meta YPP</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">4.000h Watch</p>
                  <p className="text-[10px] text-muted-foreground/70">tempo total</p>
                </div>
              </div>

              <Button onClick={generatePlan} disabled={generating} className="w-full" size="lg">
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando plano com IA...</>
                ) : (
                  <><Rocket className="w-4 h-4 mr-2" /> Gerar Meu Plano de 30 Dias</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
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
            <p className="text-sm text-muted-foreground mt-1">
              {plan.niche} • Iniciado em {new Date(plan.started_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1 self-start">
            <Flame className="w-3.5 h-3.5 mr-1 text-orange-500" />
            Dia {selectedDay}/30
          </Badge>
        </div>

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
                <span className="text-xs text-muted-foreground">Publicados</span>
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
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Dia {selectedDay} — Tarefas
              {dayTasks.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                </Badge>
              )}
            </h2>

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
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                        )}
                        {(task.target_shorts > 0 || task.target_longs > 0) && (
                          <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                            {task.target_shorts > 0 && <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{task.target_shorts} shorts</span>}
                            {task.target_longs > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{task.target_longs} longos</span>}
                          </div>
                        )}
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

          {/* Milestones Sidebar */}
          <div className="space-y-3">
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
                        <span className="text-muted-foreground">{wg.shorts} shorts</span>
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
