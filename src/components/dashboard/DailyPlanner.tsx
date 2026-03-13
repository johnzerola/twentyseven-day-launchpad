import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CheckCircle2, Circle, Clock, Sparkles, Loader2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  duration: string; // e.g. "15min", "30min"
  path?: string;
  category: 'research' | 'create' | 'optimize' | 'learn';
  completed: boolean;
}

const CATEGORY_CONFIG = {
  research: { label: 'Pesquisa', color: 'text-chart-4' },
  create: { label: 'Criar', color: 'text-chart-2' },
  optimize: { label: 'Otimizar', color: 'text-chart-3' },
  learn: { label: 'Aprender', color: 'text-primary' },
};

const STORAGE_KEY = 'daily_planner_data';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function generateTasksFromPlan(plan: any, niche?: string, hoursPerDay?: string): DailyTask[] {
  const hours = parseFloat(hoursPerDay || '2') || 2;
  const tasks: DailyTask[] = [];

  // Always include these core daily tasks
  tasks.push({
    id: 'research-trends',
    title: '🔍 Pesquisar tendências do nicho',
    description: `Verifique canais emergentes e títulos virais em "${niche || 'seu nicho'}"`,
    duration: '15min',
    path: '/search',
    category: 'research',
    completed: false,
  });

  tasks.push({
    id: 'analyze-competitor',
    title: '📊 Analisar 1 vídeo viral',
    description: 'Faça engenharia reversa de um vídeo que viralizou no seu nicho',
    duration: '20min',
    path: '/viral-db',
    category: 'research',
    completed: false,
  });

  if (hours >= 1.5) {
    tasks.push({
      id: 'write-script',
      title: '✍️ Escrever/revisar roteiro',
      description: 'Crie um novo roteiro ou refine o que está em progresso',
      duration: '45min',
      path: '/scripts',
      category: 'create',
      completed: false,
    });
  }

  if (hours >= 2) {
    tasks.push({
      id: 'generate-titles',
      title: '🏷️ Gerar 10 títulos virais',
      description: 'Crie variações de título para o próximo vídeo e teste CTR',
      duration: '15min',
      path: '/titles',
      category: 'create',
      completed: false,
    });
  }

  if (hours >= 2.5) {
    tasks.push({
      id: 'optimize-seo',
      title: '📈 Otimizar SEO de 1 vídeo',
      description: 'Gere descrição, tags e hashtags otimizadas',
      duration: '15min',
      path: '/titles',
      category: 'optimize',
      completed: false,
    });
  }

  if (hours >= 3) {
    tasks.push({
      id: 'study-algorithm',
      title: '🧠 Estudar algoritmo (Dotti)',
      description: 'Pergunte ao Dotti sobre uma técnica de retenção ou algoritmo',
      duration: '10min',
      category: 'learn',
      completed: false,
    });

    tasks.push({
      id: 'workflow-review',
      title: '📋 Revisar pipeline de produção',
      description: 'Mova cards no Kanban, atualize status dos projetos',
      duration: '10min',
      path: '/workflow',
      category: 'optimize',
      completed: false,
    });
  }

  // Add time-specific tasks from onboarding plan
  if (plan?.plan_json) {
    const planData = typeof plan.plan_json === 'string' ? JSON.parse(plan.plan_json) : plan.plan_json;
    // If plan has specific daily tasks, add the first uncompleted one
    if (planData.daily_tasks && Array.isArray(planData.daily_tasks)) {
      planData.daily_tasks.slice(0, 2).forEach((t: any, i: number) => {
        tasks.push({
          id: `plan-task-${i}`,
          title: `📌 ${t.title || t}`,
          description: t.description || 'Tarefa do seu plano personalizado',
          duration: t.duration || '20min',
          category: 'create',
          completed: false,
        });
      });
    }
  }

  return tasks;
}

export const DailyPlanner = () => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Check if we have today's tasks cached
      const todayKey = getTodayKey();
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

      // Generate from onboarding plan
      const { data: plan } = await supabase
        .from('onboarding_plans')
        .select('plan_json, niche, time_per_day')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const generated = generateTasksFromPlan(plan, plan?.niche || undefined, plan?.time_per_day || undefined);
      setTasks(generated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey, tasks: generated }));
      setLoading(false);
    };
    load();
  }, []);

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
  const totalMinutes = tasks.reduce((sum, t) => {
    const m = parseInt(t.duration) || 0;
    return sum + m;
  }, 0);

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Planner Diário
              <Badge variant="outline" className="text-[9px]">{completedCount}/{tasks.length}</Badge>
            </h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{totalMinutes}min estimados
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

      {/* Tasks */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-4 space-y-1.5">
              {tasks.map((task, i) => (
                <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer group ${
                    task.completed ? 'bg-chart-2/5 opacity-60' : 'bg-secondary/30 hover:bg-secondary/50'
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

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] text-muted-foreground">
                  {progress === 100 ? '🎉 Tudo concluído! Excelente dia de trabalho.' : `Restam ${tasks.length - completedCount} tarefas`}
                </p>
                <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={resetTasks}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
