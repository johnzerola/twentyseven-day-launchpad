import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Calendar, CheckCircle2, Circle, ArrowRight, TrendingUp, Target, DollarSign } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Plan = () => {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedDays, setCompletedDays] = useState<number[]>([]);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('onboarding_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1) as any;
    if (data?.[0]?.plan_json) {
      setPlan(data[0].plan_json);
      // Load completed from localStorage
      const saved = localStorage.getItem(`plan_completed_${data[0].id}`);
      if (saved) setCompletedDays(JSON.parse(saved));
    }
    setLoading(false);
  };

  const toggleDay = (day: number, planId?: string) => {
    setCompletedDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      // Persist to localStorage
      if (planId) localStorage.setItem(`plan_completed_${planId}`, JSON.stringify(next));
      return next;
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-muted-foreground">Carregando plano...</div>
      </DashboardLayout>
    );
  }

  if (!plan || !plan.days?.length) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center glow-primary">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Plano 27 Dias</h1>
              <p className="text-sm text-muted-foreground">Crie seu plano personalizado</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">Você ainda não criou seu plano. Faça o onboarding com IA para gerar um plano personalizado.</p>
            <Link to="/onboarding">
              <button className="gradient-hero text-primary-foreground px-6 py-3 rounded-xl font-medium gap-2 inline-flex items-center">
                Criar Meu Plano <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalDays = plan.days.length;
  const completed = completedDays.length;
  const progress = (completed / totalDays) * 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center glow-primary">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">{plan.title || 'Plano 27 Dias'}</h1>
            <p className="text-sm text-muted-foreground">Nicho: {plan.niche}</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inscritos estimados</p>
              <p className="font-bold">{plan.estimated_subs_30d || 'N/A'}</p>
            </div>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita estimada</p>
              <p className="font-bold">{plan.estimated_revenue_30d || 'N/A'}</p>
            </div>
          </div>
          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RPM estimado</p>
              <p className="font-bold">${plan.rpm_estimate || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{completed}/{totalDays} dias completos</span>
            <span className="text-sm text-primary font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Weekly goals */}
        {plan.weekly_goals?.length > 0 && (
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-3">📅 Metas Semanais</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {plan.weekly_goals.map((w: any) => (
                <div key={w.week} className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-primary font-medium">Semana {w.week}</p>
                  <p className="text-sm mt-1">{w.goal}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.videos_target} vídeos</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day-by-day plan */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((week) => {
            const weekDays = plan.days.filter((d: any) => d.day > (week - 1) * 7 && d.day <= Math.min(week * 7, totalDays));
            if (weekDays.length === 0) return null;
            return (
              <div key={week} className="glass rounded-xl p-5">
                <h3 className="font-semibold font-['Space_Grotesk'] mb-3">Semana {week}</h3>
                <div className="space-y-2">
                  {weekDays.map((day: any) => (
                    <button
                      key={day.day}
                      onClick={() => toggleDay(day.day)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        completedDays.includes(day.day) ? 'bg-primary/10' : 'bg-secondary/30 hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {completedDays.includes(day.day) ? (
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Dia {day.day}</span>
                            <span className={`text-sm font-medium ${completedDays.includes(day.day) ? 'line-through text-muted-foreground' : ''}`}>
                              {day.title}
                            </span>
                          </div>
                          {day.tasks && (
                            <ul className="mt-1 space-y-0.5">
                              {day.tasks.map((task: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground">• {task}</li>
                              ))}
                            </ul>
                          )}
                          {day.tip && (
                            <p className="text-xs text-primary/70 mt-1">💡 {day.tip}</p>
                          )}
                          {day.kpi && (
                            <p className="text-xs text-accent/70 mt-0.5">🎯 {day.kpi}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content pillars & SEO */}
        <div className="grid sm:grid-cols-2 gap-4">
          {plan.content_pillars?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-3">🎯 Pilares de Conteúdo</h3>
              <ul className="space-y-1">
                {plan.content_pillars.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground">• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.seo_keywords?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-3">🔑 Palavras-chave SEO</h3>
              <div className="flex flex-wrap gap-2">
                {plan.seo_keywords.map((k: string, i: number) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Monetization path */}
        {plan.monetization_path && (
          <div className="glass rounded-xl p-5">
            <h3 className="font-semibold mb-2">💰 Caminho de Monetização</h3>
            <p className="text-sm text-muted-foreground">{plan.monetization_path}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Plan;
