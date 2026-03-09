import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { BarChart3, Youtube, FileText, Calendar, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { t } = useLanguage();

  const cards = [
    { icon: Calendar, label: t('dash.plan'), path: '/plan', color: 'from-primary to-primary', desc: '0/27 dias' },
    { icon: Youtube, label: t('dash.channels'), path: '/channels', color: 'from-red-500 to-red-600', desc: '0 canais' },
    { icon: FileText, label: t('dash.scripts'), path: '/scripts', color: 'from-accent to-orange-500', desc: '0 roteiros' },
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

        {/* Quick start */}
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
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
