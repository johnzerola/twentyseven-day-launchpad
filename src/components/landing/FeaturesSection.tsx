import { Calendar, Search, FileText, Mic, BarChart3, LayoutDashboard } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const featureIcons = [Calendar, Search, FileText, Mic, BarChart3, LayoutDashboard];
const featureKeys = ['plan', 'search', 'script', 'narration', 'analytics', 'dashboard'];

export const FeaturesSection = () => {
  const { t } = useLanguage();

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] mb-4">{t('features.title')}</h2>
          <p className="text-muted-foreground text-lg">{t('features.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureKeys.map((key, i) => {
            const Icon = featureIcons[i];
            return (
              <motion.div
                key={key}
                className="glass rounded-2xl p-6 hover:border-primary/30 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:glow-primary transition-shadow">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold font-['Space_Grotesk'] mb-2">{t(`features.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`features.${key}.desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
