import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { BarChart3, Youtube, FileText, Calendar, ArrowUpRight, TrendingUp, Mic, CheckCircle2, Circle, DollarSign, Zap, Target, Clock, Play, Film, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChatbotWidget } from '@/components/dashboard/ChatbotWidget';

const PHASES = [
  { name: 'Pesquisa & Nicho', days: [1, 2, 3, 4, 5], icon: '🔍', color: 'from-blue-500 to-cyan-500' },
  { name: 'Roteirização', days: [6, 7, 8, 9, 10, 11, 12], icon: '✍️', color: 'from-violet-500 to-purple-500' },
  { name: 'Produção', days: [13, 14, 15, 16, 17, 18, 19], icon: '🎬', color: 'from-orange-500 to-red-500' },
  { name: 'Otimização & Upload', days: [20, 21, 22, 23, 24], icon: '🚀', color: 'from-emerald-500 to-green-500' },
  { name: 'Monetização', days: [25, 26, 27], icon: '💰', color: 'from-yellow-500 to-amber-500' },
];

const DAILY_TASKS: Record<number, { id: string; text: string; done: boolean }[]> = {
  5: [
    { id: '1', text: 'Analisar 3 canais concorrentes no TubeSpy — identificar outliers 10x', done: true },
    { id: '2', text: 'Escolher nicho definitivo e validar RPM no Niche Explorer', done: true },
    { id: '3', text: 'Gerar identidade visual completa no HacksLab (nome, logo, paleta)', done: false },
    { id: '4', text: 'Criar primeiro roteiro de 10 min com ganchos de retenção a cada 30s', done: false },
    { id: '5', text: 'Configurar canal no YouTube — arte, descrição SEO, links', done: false },
  ],
};

const RPM_DATA = [
  { niche: 'Finanças Pessoais', rpm: 15.00, cpm: 12.50, flag: '💰', trend: '+12%' },
  { niche: 'Histórias de Horror', rpm: 12.00, cpm: 9.80, flag: '👻', trend: '+8%' },
  { niche: 'True Crime', rpm: 11.00, cpm: 8.50, flag: '🔍', trend: '+15%' },
  { niche: 'Self-Improvement', rpm: 13.50, cpm: 10.00, flag: '🧠', trend: '+5%' },
  { niche: 'Tecnologia', rpm: 8.50, cpm: 6.20, flag: '💻', trend: '-2%' },
  { niche: 'Gaming', rpm: 4.00, cpm: 3.10, flag: '🎮', trend: '+3%' },
];

const EARNINGS_PROJECTION = {
  views1k: { min: 4.00, max: 15.00 },
  views10k: { min: 40.00, max: 150.00 },
  views100k: { min: 400.00, max: 1500.00 },
};

const Dashboard = () => {
  const [currentDay] = useState(5);
  const [tasks, setTasks] = useState(DAILY_TASKS[5] || []);
  const [stats, setStats] = useState({ channels: 0, scripts: 0, projects: 0 });
  const [displayName, setDisplayName] = useState('Creator');

  const currentPhaseObj = PHASES.find(p => p.days.includes(currentDay));
  const currentPhase = currentPhaseObj?.name || 'Pesquisa';
  const progressPercent = Math.round((currentDay / 27) * 100);
  const completedTasks = tasks.filter(t => t.done).length;

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const [ch, sc, profile] = await Promise.all([
        supabase.from('user_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles').select('display_name').eq('user_id', uid).maybeSingle(),
      ]);
      setStats({ channels: ch.count ?? 0, scripts: sc.count ?? 0, projects: 0 });
      if (profile.data?.display_name) setDisplayName(profile.data.display_name);
    };
    load();
  }, []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with greeting */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold font-['Space_Grotesk']">
              Olá, <span className="gradient-text">{displayName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1">Blueprint 27 Dias — Seu progresso rumo à monetização</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Canais', value: stats.channels, icon: Youtube },
              { label: 'Roteiros', value: stats.scripts, icon: FileText },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl px-4 py-2 flex items-center gap-2">
                <s.icon className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Card — Cinematic */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-60 h-60 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
            {/* Circular Progress */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
                  strokeDasharray={`${progressPercent * 2.64} 264`} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{currentDay}</span>
                <span className="text-[10px] text-muted-foreground">de 27</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                  <Zap className="w-3 h-3" /> Dia {currentDay}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {currentPhaseObj?.icon} {currentPhase}
                </Badge>
              </div>
              <h2 className="text-xl font-bold font-['Space_Grotesk']">Fase de {currentPhase}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {progressPercent}% completo • {27 - currentDay} dias restantes para monetização
              </p>

              {/* Phase timeline */}
              <div className="mt-4 flex gap-1">
                {PHASES.map((phase) => (
                  <div key={phase.name} className="flex-1 flex flex-col items-center">
                    <div className="flex gap-[2px] w-full">
                      {phase.days.map((day) => (
                        <div key={day} className={`h-2 flex-1 rounded-full transition-all ${
                          day < currentDay ? `bg-gradient-to-r ${phase.color}` :
                          day === currentDay ? 'bg-primary animate-pulse' : 'bg-secondary'
                        }`} />
                      ))}
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-1 hidden sm:block">{phase.icon}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Infoproduct CTA */}
            <div className="glass rounded-xl p-4 border-accent/20 max-w-[220px]">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold text-accent">Dica Pro</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Crie um <strong className="text-foreground">infoproduto</strong> (template/guia) para monetizar via link na descrição <strong className="text-foreground">antes</strong> do AdSense ser aprovado.
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's Tasks */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Tarefas do Dia {currentDay}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{completedTasks}/{tasks.length}</span>
                <Badge variant={completedTasks === tasks.length ? 'default' : 'secondary'} className="text-[10px]">
                  {completedTasks === tasks.length ? '✅ Completo!' : `${Math.round((completedTasks / tasks.length) * 100)}%`}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <motion.button key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all text-left group ${
                    task.done ? 'bg-primary/10 line-through text-muted-foreground' : 'bg-secondary/50 hover:bg-secondary hover:border-primary/20 border border-transparent'
                  }`}>
                  {task.done ? (
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  )}
                  {task.text}
                </motion.button>
              ))}
            </div>
            <Progress value={(completedTasks / tasks.length) * 100} className="mt-4 h-2" />
          </motion.div>

          {/* Revenue Estimator */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-accent" /> Estimativa de Ganhos
            </h3>
            <div className="space-y-2">
              {RPM_DATA.map((item) => (
                <div key={item.niche} className="flex items-center justify-between bg-secondary/30 rounded-lg p-2.5 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.flag}</span>
                    <div>
                      <p className="text-xs font-medium">{item.niche}</p>
                      <p className="text-[10px] text-muted-foreground">CPM ${item.cpm.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-primary">${item.rpm.toFixed(2)}</span>
                    <p className={`text-[10px] ${item.trend.startsWith('+') ? 'text-emerald-400' : 'text-destructive'}`}>
                      {item.trend}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-secondary/30 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] text-muted-foreground mb-2">Projeção com 100K views/mês:</p>
              <p className="text-lg font-bold text-accent">
                ${EARNINGS_PROJECTION.views100k.min} — ${EARNINGS_PROJECTION.views100k.max}
              </p>
              <p className="text-[10px] text-muted-foreground">RPM médio por 1.000 visualizações</p>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Youtube, label: 'TubeSpy', path: '/search', color: 'from-red-500 to-red-600', desc: 'Espionar canais', stat: '12 outliers' },
            { icon: Film, label: 'Dotti Studio', path: '/studio', color: 'from-violet-500 to-purple-600', desc: 'Criar vídeo', stat: '8s timeline' },
            { icon: Sparkles, label: 'Títulos Virais', path: '/titles', color: 'from-amber-500 to-orange-500', desc: 'Gerar títulos', stat: 'CTR boost' },
            { icon: BarChart3, label: 'Niche Explorer', path: '/niches', color: 'from-emerald-500 to-emerald-600', desc: 'Explorar nichos', stat: '6000+ nichos' },
          ].map((card, i) => (
            <motion.div key={card.path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Link to={card.path} className="glass rounded-xl p-5 block hover:border-primary/30 transition-all group">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  <card.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{card.label}</p>
                    <p className="text-xs text-muted-foreground">{card.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <Badge variant="secondary" className="mt-2 text-[10px]">{card.stat}</Badge>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
      <ChatbotWidget />
    </DashboardLayout>
  );
};

export default Dashboard;
