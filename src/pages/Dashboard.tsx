import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { BarChart3, Youtube, FileText, Calendar, ArrowUpRight, TrendingUp, Mic, CheckCircle2, Circle, DollarSign, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { ChatbotWidget } from '@/components/dashboard/ChatbotWidget';

// Mock data for the 27-day blueprint
const PHASES = [
  { name: 'Pesquisa & Nicho', days: [1, 2, 3, 4, 5] },
  { name: 'Roteirização', days: [6, 7, 8, 9, 10, 11, 12] },
  { name: 'Produção', days: [13, 14, 15, 16, 17, 18, 19] },
  { name: 'Otimização & Upload', days: [20, 21, 22, 23, 24] },
  { name: 'Monetização', days: [25, 26, 27] },
];

const MOCK_TASKS = [
  { id: '1', text: 'Analisar 3 canais concorrentes no TubeSpy', done: true },
  { id: '2', text: 'Escolher nicho e validar RPM no Niche Explorer', done: true },
  { id: '3', text: 'Gerar identidade visual no HacksLab', done: false },
  { id: '4', text: 'Criar primeiro roteiro de 10 minutos', done: false },
];

const RPM_DATA = [
  { niche: 'Finanças Pessoais', rpm: 15.00, cpm: 12.50, flag: '💰' },
  { niche: 'Histórias de Horror', rpm: 12.00, cpm: 9.80, flag: '👻' },
  { niche: 'Tecnologia', rpm: 8.50, cpm: 6.20, flag: '💻' },
  { niche: 'Gaming', rpm: 4.00, cpm: 3.10, flag: '🎮' },
  { niche: 'True Crime', rpm: 11.00, cpm: 8.50, flag: '🔍' },
  { niche: 'Self-Improvement', rpm: 13.50, cpm: 10.00, flag: '🧠' },
];

const Dashboard = () => {
  const { t } = useLanguage();
  const [currentDay] = useState(5);
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [stats, setStats] = useState({ channels: 0, scripts: 0, projects: 0 });

  const currentPhase = PHASES.find(p => p.days.includes(currentDay))?.name || 'Pesquisa';
  const progressPercent = Math.round((currentDay / 27) * 100);
  const completedTasks = tasks.filter(t => t.done).length;

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      const [ch, sc] = await Promise.all([
        supabase.from('user_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ]);
      setStats({ channels: ch.count ?? 0, scripts: sc.count ?? 0, projects: 0 });
    };
    load();
  }, []);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Blueprint 27 Dias</h1>
          <p className="text-muted-foreground mt-1">Seu progresso rumo à monetização</p>
        </div>

        {/* Progress Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                  strokeDasharray={`${progressPercent * 2.64} 264`} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{currentDay}/27</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary font-medium">Dia {currentDay} — {currentPhase}</span>
              </div>
              <h2 className="text-xl font-bold font-['Space_Grotesk']">Fase de {currentPhase}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {progressPercent}% completo • {27 - currentDay} dias restantes para monetização
              </p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 27 }, (_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-full transition-all ${
                    i < currentDay ? 'bg-primary' : i === currentDay ? 'bg-primary/50 animate-pulse' : 'bg-secondary'
                  }`} />
                ))}
              </div>
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
              <span className="text-xs text-muted-foreground">{completedTasks}/{tasks.length} completas</span>
            </div>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <motion.button key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} onClick={() => toggleTask(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all text-left ${
                    task.done ? 'bg-primary/10 line-through text-muted-foreground' : 'bg-secondary/50 hover:bg-secondary'
                  }`}>
                  {task.done ? <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
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
            <div className="space-y-3">
              {RPM_DATA.map((item) => (
                <div key={item.niche} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.flag}</span>
                    <div>
                      <p className="text-xs font-medium">{item.niche}</p>
                      <p className="text-[10px] text-muted-foreground">CPM ${item.cpm.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary">${item.rpm.toFixed(2)} RPM</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              * Valores médios estimados por 1.000 visualizações
            </p>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Youtube, label: 'TubeSpy', path: '/search', color: 'from-red-500 to-red-600', desc: 'Espionar canais' },
            { icon: FileText, label: 'Dotti Studio', path: '/studio', color: 'from-primary to-primary', desc: 'Criar vídeo' },
            { icon: Calendar, label: 'Planner', path: '/planner', color: 'from-accent to-orange-500', desc: 'Kanban' },
            { icon: BarChart3, label: 'Niche Explorer', path: '/niches', color: 'from-emerald-500 to-emerald-600', desc: 'Explorar nichos' },
          ].map((card, i) => (
            <motion.div key={card.path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Link to={card.path} className="glass rounded-xl p-5 block hover:border-primary/30 transition-all group">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                  <card.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-semibold">{card.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
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
