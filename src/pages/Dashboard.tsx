import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { BarChart3, Youtube, FileText, ArrowUpRight, TrendingUp, DollarSign, Zap, Target, Sparkles, Rocket, Eye, Clock, Layout, Brain, CheckCircle2, Lightbulb, Activity } from 'lucide-react';
import { ApiUsageDashboard } from '@/components/dashboard/ApiUsageDashboard';
import { ProductivityDashboard } from '@/components/dashboard/ProductivityDashboard';
import { DashboardSkeleton } from '@/components/PageSkeletons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '@/lib/formatters';

interface OnboardingPlan {
  niche: string | null;
  goal: string | null;
  content_type: string | null;
  plan_json: any;
}

const Dashboard = () => {
  const [stats, setStats] = useState({ channels: 0, scripts: 0, projects: 0, trackedChannels: 0, titles: 0, nicheAnalyses: 0 });
  const [displayName, setDisplayName] = useState('Creator');
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [workflowTotal] = useState(5);
  const [recentScripts, setRecentScripts] = useState<any[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingPlan | null>(null);
  const [latestNiche, setLatestNiche] = useState<any>(null);
  const [channelData, setChannelData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      const [ch, sc, proj, tracked, profile, progress, scripts, plan, titles, niches, channel, latestNicheData] = await Promise.all([
        supabase.from('user_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('video_projects').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('tracked_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles').select('display_name').eq('user_id', uid).maybeSingle(),
        supabase.from('user_progress').select('completed_items').eq('user_id', uid).eq('module', 'workflow').maybeSingle(),
        supabase.from('saved_scripts').select('id, topic, style, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
        supabase.from('onboarding_plans').select('niche, goal, content_type, plan_json').eq('user_id', uid).order('created_at', { ascending: false }).maybeSingle(),
        supabase.from('saved_titles').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_niche_analyses').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('user_channels').select('*').eq('user_id', uid).order('linked_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('saved_niche_analyses').select('niche, score, country, created_at, analysis_json').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setStats({
        channels: ch.count ?? 0,
        scripts: sc.count ?? 0,
        projects: proj.count ?? 0,
        trackedChannels: tracked.count ?? 0,
        titles: titles.count ?? 0,
        nicheAnalyses: niches.count ?? 0,
      });
      if (profile.data?.display_name) setDisplayName(profile.data.display_name);
      if (progress.data?.completed_items) {
        const items = progress.data.completed_items as number[];
        setWorkflowProgress(Array.isArray(items) ? items.length : 0);
      }
      setRecentScripts(scripts.data || []);
      if (plan.data) setOnboarding(plan.data as OnboardingPlan);
      if (channel.data) setChannelData(channel.data);
      if (latestNicheData.data) setLatestNiche(latestNicheData.data);

      // Build activity chart from scripts creation dates (last 30 days)
      const allScripts = scripts.data || [];
      const days: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        days[d.toISOString().slice(5, 10)] = 0;
      }
      allScripts.forEach((s: any) => {
        const key = new Date(s.created_at).toISOString().slice(5, 10);
        if (days[key] !== undefined) days[key]++;
      });
      setActivityData(Object.entries(days).map(([date, count]) => ({ date, atividade: count })));

      setLoading(false);
    };
    load();
  }, []);

  const workflowPercent = Math.round((workflowProgress / workflowTotal) * 100);

  // Smart next actions based on user state
  const getNextActions = () => {
    const actions: { icon: any; label: string; desc: string; path: string; priority: 'alta' | 'média' | 'baixa' }[] = [];
    if (stats.channels === 0) actions.push({ icon: Youtube, label: 'Vincular Canal', desc: 'Conecte seu canal para análise automática', path: '/channels', priority: 'alta' });
    if (stats.nicheAnalyses === 0) actions.push({ icon: Brain, label: 'Explorar Nichos', desc: 'Descubra o melhor nicho para monetizar', path: '/niches', priority: 'alta' });
    if (stats.scripts === 0) actions.push({ icon: FileText, label: 'Criar Roteiro', desc: 'Seu primeiro roteiro com pesquisa YouTube', path: '/scripts', priority: 'alta' });
    if (stats.titles === 0 && stats.scripts > 0) actions.push({ icon: Sparkles, label: 'Gerar Títulos SEO', desc: 'Otimize seus títulos para mais cliques', path: '/titles', priority: 'média' });
    if (stats.trackedChannels === 0) actions.push({ icon: Eye, label: 'Rastrear Concorrentes', desc: 'Espione canais do seu nicho', path: '/search', priority: 'média' });
    if (workflowProgress < workflowTotal) actions.push({ icon: Layout, label: 'Continuar Workflow', desc: `${workflowProgress}/${workflowTotal} etapas concluídas`, path: '/workflow', priority: 'média' });
    return actions.slice(0, 4);
  };

  const STAT_CARDS = [
    { label: 'Roteiros', value: stats.scripts, icon: FileText, color: 'text-violet-400' },
    { label: 'Canais', value: stats.channels, icon: Youtube, color: 'text-red-400' },
    { label: 'Rastreados', value: stats.trackedChannels, icon: Eye, color: 'text-blue-400' },
    { label: 'Projetos', value: stats.projects, icon: Target, color: 'text-emerald-400' },
    { label: 'Títulos', value: stats.titles, icon: Sparkles, color: 'text-amber-400' },
    { label: 'Análises', value: stats.nicheAnalyses, icon: Brain, color: 'text-primary' },
  ];

  const QUICK_ACTIONS = [
    { icon: Youtube, label: 'DubSpy', path: '/search', color: 'from-red-500 to-red-600', desc: 'Espionar canais virais' },
    { icon: Sparkles, label: 'Títulos Virais', path: '/titles', color: 'from-amber-500 to-orange-500', desc: 'Gerar títulos + SEO' },
    { icon: FileText, label: 'Roteiros', path: '/scripts', color: 'from-violet-500 to-purple-600', desc: 'Criar roteiro com IA' },
    { icon: BarChart3, label: 'Niche Explorer', path: '/niches', color: 'from-emerald-500 to-emerald-600', desc: 'Explorar nichos lucrativos' },
    { icon: Rocket, label: 'Growth Center', path: '/branding', color: 'from-blue-500 to-cyan-500', desc: 'Revenue + Brand Kit' },
    { icon: Layout, label: 'Workflow', path: '/workflow', color: 'from-pink-500 to-rose-500', desc: 'Pipeline de produção' },
  ];

  const nextActions = getNextActions();

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAT_CARDS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass rounded-xl p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Productivity Dashboard */}
        <ProductivityDashboard />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Smart Next Actions */}
            {nextActions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="glass rounded-xl p-5 border border-primary/20">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-accent" /> Próximas Ações Recomendadas
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {nextActions.map((action, i) => (
                    <motion.div key={action.path} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                      <Link to={action.path} className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3 hover:bg-secondary/50 transition-all group">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          action.priority === 'alta' ? 'bg-primary/20' : 'bg-secondary/50'
                        }`}>
                          <action.icon className={`w-5 h-5 ${action.priority === 'alta' ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-[10px] text-muted-foreground">{action.desc}</p>
                        </div>
                        <Badge className={`text-[9px] shrink-0 ${action.priority === 'alta' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                          {action.priority}
                        </Badge>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Workflow Progress */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
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

            {/* Channel Summary + Latest Niche */}
            <div className="grid sm:grid-cols-2 gap-4">
              {channelData && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="glass rounded-xl p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Youtube className="w-4 h-4 text-red-400" /> Seu Canal
                  </h3>
                  <div className="flex items-center gap-3 mb-3">
                    {channelData.thumbnail && <img src={channelData.thumbnail} className="w-10 h-10 rounded-full" alt="" />}
                    <div>
                      <p className="text-sm font-semibold">{channelData.channel_name}</p>
                      <p className="text-[10px] text-muted-foreground">{channelData.niche || 'Nicho não detectado'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-sm font-bold">{formatNumber(channelData.subscribers || 0)}</p>
                      <p className="text-[9px] text-muted-foreground">Subs</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-sm font-bold">{formatNumber(channelData.views || 0)}</p>
                      <p className="text-[9px] text-muted-foreground">Views</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-sm font-bold">{channelData.videos || 0}</p>
                      <p className="text-[9px] text-muted-foreground">Vídeos</p>
                    </div>
                  </div>
                  <Link to="/channels" className="text-[10px] text-primary hover:underline mt-2 block">Ver detalhes →</Link>
                </motion.div>
              )}

              {latestNiche && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
                  className="glass rounded-xl p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-primary" /> Última Análise de Nicho
                  </h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black ${
                      latestNiche.score >= 75 ? 'bg-emerald-500/20 text-emerald-400' : latestNiche.score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {latestNiche.score}
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{latestNiche.niche}</p>
                      <p className="text-[10px] text-muted-foreground">{latestNiche.country} · {new Date(latestNiche.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {latestNiche.score >= 70 && (
                    <Button size="sm" variant="outline" className="w-full gap-2 text-xs"
                      onClick={() => navigate(`/scripts?niche=${encodeURIComponent(latestNiche.niche)}`)}>
                      <Rocket className="w-3 h-3" /> Criar Roteiro para "{latestNiche.niche}"
                    </Button>
                  )}
                  <Link to="/niches" className="text-[10px] text-primary hover:underline mt-2 block">Ver análise completa →</Link>
                </motion.div>
              )}
            </div>

            {/* Activity Chart */}
            {activityData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="glass rounded-xl p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" /> Atividade — Últimos 30 dias
                </h3>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="gradActivity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} interval={6} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    <Area type="monotone" dataKey="atividade" stroke="hsl(var(--primary))" fill="url(#gradActivity)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Recent Scripts */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
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

            {/* Onboarding Plan Summary */}
            {onboarding && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="glass rounded-xl p-4 border border-accent/20">
                <h4 className="text-xs font-semibold flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-accent" /> Plano de Crescimento
                </h4>
                <div className="space-y-1.5">
                  {onboarding.niche && <p className="text-[10px] text-muted-foreground">Nicho: <span className="text-foreground font-medium">{onboarding.niche}</span></p>}
                  {onboarding.goal && <p className="text-[10px] text-muted-foreground">Meta: <span className="text-foreground font-medium">{onboarding.goal}</span></p>}
                  {onboarding.content_type && <p className="text-[10px] text-muted-foreground">Tipo: <span className="text-foreground font-medium">{onboarding.content_type}</span></p>}
                </div>
              </motion.div>
            )}
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

        {/* Infrastructure Monitoring */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Infraestrutura & Monitoramento
          </h3>
          <ApiUsageDashboard />
        </motion.div>
      </div>
      
    </DashboardLayout>
  );
};

export default Dashboard;
