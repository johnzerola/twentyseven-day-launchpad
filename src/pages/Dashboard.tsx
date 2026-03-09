import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { BarChart3, Youtube, FileText, Calendar, ArrowUpRight, TrendingUp, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({ channels: 0, scripts: 0, planDays: 0, planTotal: 27, hasPlan: false });

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const [channelsRes, scriptsRes, planRes] = await Promise.all([
        supabase.from('user_channels').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('onboarding_plans').select('plan_json').eq('user_id', uid).order('created_at', { ascending: false }).limit(1),
      ]);

      let planDays = 0;
      let planTotal = 27;
      let hasPlan = false;
      if (planRes.data && planRes.data.length > 0) {
        hasPlan = true;
        const pj = planRes.data[0].plan_json as any;
        const days = pj?.days || pj?.plan?.days || [];
        planTotal = Array.isArray(days) ? days.length : 27;
        planDays = Array.isArray(days) ? days.filter((d: any) => d.completed).length : 0;
      }

      setStats({
        channels: channelsRes.count ?? 0,
        scripts: scriptsRes.count ?? 0,
        planDays,
        planTotal,
        hasPlan,
      });
    };
    load();
  }, []);

  const cards = [
    { icon: Calendar, label: t('dash.plan'), path: '/plan', color: 'from-primary to-primary', desc: stats.hasPlan ? `${stats.planDays}/${stats.planTotal} dias` : 'Criar plano' },
    { icon: Youtube, label: t('dash.channels'), path: '/channels', color: 'from-red-500 to-red-600', desc: `${stats.channels} ${stats.channels === 1 ? 'canal' : 'canais'}` },
    { icon: FileText, label: t('dash.scripts'), path: '/scripts', color: 'from-accent to-orange-500', desc: `${stats.scripts} ${stats.scripts === 1 ? 'roteiro' : 'roteiros'}` },
    { icon: BarChart3, label: t('dash.search'), path: '/search', color: 'from-emerald-500 to-emerald-600', desc: 'Explorar' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">{t('dash.overview')}</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo ao ChannelHacker</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
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

        {!stats.hasPlan && (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-4 glow-primary">
              <TrendingUp className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold font-['Space_Grotesk'] mb-2">{t('onboarding.welcome')}</h2>
            <p className="text-muted-foreground mb-6">Comece configurando seu canal e criando seu plano de monetização personalizado.</p>
            <Link to="/onboarding">
              <button className="gradient-hero text-primary-foreground px-6 py-3 rounded-xl font-medium glow-primary hover:opacity-90 transition-opacity">
                Iniciar Onboarding →
              </button>
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
