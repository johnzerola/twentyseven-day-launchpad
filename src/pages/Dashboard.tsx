import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { BarChart3, Youtube, FileText, ArrowUpRight, TrendingUp, DollarSign, Zap, Target, Sparkles, Rocket, Eye, Clock, Layout } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChatbotWidget } from '@/components/dashboard/ChatbotWidget';

interface OnboardingPlan {
  niche: string | null;
  goal: string | null;
  content_type: string | null;
  plan_json: any;
}

const Dashboard = () => {
  const [stats, setStats] = useState({ channels: 0, scripts: 0, projects: 0, trackedChannels: 0 });
  const [displayName, setDisplayName] = useState('Creator');
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [workflowTotal] = useState(5);
  const [recentScripts, setRecentScripts] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      const [ch, sc, proj, tracked, profile, progress, scripts, plan] = await Promise.all([
        supabase.from('user_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('video_projects').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('tracked_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles').select('display_name').eq('user_id', uid).maybeSingle(),
        supabase.from('user_progress').select('completed_items').eq('user_id', uid).eq('module', 'workflow').maybeSingle(),
        supabase.from('saved_scripts').select('id, topic, style, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(3),
        supabase.from('onboarding_plans').select('niche, goal, content_type, plan_json').eq('user_id', uid).order('created_at', { ascending: false }).maybeSingle(),
      ]);

      setStats({
        channels: ch.count ?? 0,
        scripts: sc.count ?? 0,
        projects: proj.count ?? 0,
        trackedChannels: tracked.count ?? 0,
      });
      if (profile.data?.display_name) setDisplayName(profile.data.display_name);
      if (progress.data?.completed_items) {
        const items = progress.data.completed_items as number[];
        setWorkflowProgress(Array.isArray(items) ? items.length : 0);
      }
      setRecentScripts(scripts.data || []);
      if (plan.data) setOnboarding(plan.data as OnboardingPlan);
      setLoading(false);
    };
    load();
  }, []);

  const workflowPercent = Math.round((workflowProgress / workflowTotal) * 100);

  const QUICK_ACTIONS = [
    { icon: Youtube, label: 'DubSpy', path: '/search', color: 'from-red-500 to-red-600', desc: 'Espionar canais virais' },
    { icon: Sparkles, label: 'Títulos Virais', path: '/titles', color: 'from-amber-500 to-orange-500', desc: 'Gerar títulos + SEO' },
    { icon: FileText, label: 'Roteiros', path: '/scripts', color: 'from-violet-500 to-purple-600', desc: 'Criar roteiro com IA' },
    { icon: BarChart3, label: 'Niche Explorer', path: '/niches', color: 'from-emerald-500 to-emerald-600', desc: 'Explorar nichos lucrativos' },
    { icon: Rocket, label: 'Growth Center', path: '/branding', color: 'from-blue-500 to-cyan-500', desc: 'Revenue + Brand Kit' },
    { icon: Layout, label: 'Workflow', path: '/workflow', color: 'from-pink-500 to-rose-500', desc: 'Pipeline de produção' },
  ];

  const STAT_CARDS = [
    { label: 'Roteiros', value: stats.scripts, icon: FileText, color: 'text-violet-400' },
    { label: 'Canais Vinculados', value: stats.channels, icon: Youtube, color: 'text-red-400' },
    { label: 'Canais Rastreados', value: stats.trackedChannels, icon: Eye, color: 'text-blue-400' },
    { label: 'Projetos', value: stats.projects, icon: Target, color: 'text-emerald-400' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold font-['Space_Grotesk']">
              Olá, <span className="gradient-text">{displayName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1">Seu hub de crescimento no YouTube — dados reais, ações concretas</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Workflow + Onboarding */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workflow Progress */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-primary" /> Production Workflow
                </h3>
                <Link to="/workflow">
                  <Badge variant="outline" className="text-primary border-primary/30 cursor-pointer gap-1">
                    {workflowPercent}% <ArrowUpRight className="w-3 h-3" />
                  </Badge>
                </Link>
              </div>
              <Progress value={workflowPercent} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">
                {workflowProgress}/{workflowTotal} etapas concluídas —{' '}
                <Link to="/workflow" className="text-primary hover:underline">continuar pipeline</Link>
              </p>
            </motion.div>

            {/* Onboarding Plan Summary */}
            {onboarding && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="glass rounded-xl p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-accent" /> Seu Plano de Crescimento
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {onboarding.niche && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Nicho</p>
                      <p className="text-sm font-medium">{onboarding.niche}</p>
                    </div>
                  )}
                  {onboarding.goal && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Meta</p>
                      <p className="text-sm font-medium">{onboarding.goal}</p>
                    </div>
                  )}
                  {onboarding.content_type && (
                    <div className="bg-secondary/50 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Tipo de Conteúdo</p>
                      <p className="text-sm font-medium">{onboarding.content_type}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Recent Scripts */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Atividade Recente
                </h3>
                <Link to="/scripts" className="text-xs text-primary hover:underline">Ver todos</Link>
              </div>
              {recentScripts.length > 0 ? (
                <div className="space-y-2">
                  {recentScripts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                        <p className="text-sm truncate">{s.topic}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.style && <Badge variant="secondary" className="text-[10px]">{s.style}</Badge>}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(s.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum roteiro criado ainda.{' '}
                  <Link to="/scripts" className="text-primary hover:underline">Criar primeiro roteiro →</Link>
                </p>
              )}
            </motion.div>
          </div>

          {/* Right: Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Ações Rápidas
            </h3>
            {QUICK_ACTIONS.map((card, i) => (
              <motion.div key={card.path} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                <Link to={card.path} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all group block">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shrink-0`}>
                    <card.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{card.label}</p>
                    <p className="text-[10px] text-muted-foreground">{card.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Pro Tip */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-xl p-4 border-accent/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold text-accent mb-1">Dica Pro — Monetização Rápida</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crie um <strong className="text-foreground">infoproduto</strong> (template, ebook, guia) para monetizar via link na descrição 
              <strong className="text-foreground"> antes</strong> do AdSense ser aprovado. Use o Growth Center para simular sua receita.
            </p>
          </div>
        </motion.div>
      </div>
      <ChatbotWidget />
    </DashboardLayout>
  );
};

export default Dashboard;
