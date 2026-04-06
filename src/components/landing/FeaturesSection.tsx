import { Calendar, Search, FileText, Mic, BarChart3, LayoutDashboard, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const features = [
  {
    key: 'plan',
    Icon: Calendar,
    impactPt: '27 dias até YPP',
    impactEn: '27 days to YPP',
    mockupBars: [30, 50, 45, 60, 55, 75, 70, 85, 80, 95],
  },
  {
    key: 'search',
    Icon: Search,
    impactPt: 'Espione antes de todos',
    impactEn: 'Spy before everyone',
    mockupBars: [90, 40, 70, 85, 30, 60, 95, 50, 75, 65],
  },
  {
    key: 'script',
    Icon: FileText,
    impactPt: '+89% retenção',
    impactEn: '+89% retention',
    mockupBars: [20, 35, 50, 55, 60, 65, 70, 75, 85, 90],
  },
  {
    key: 'narration',
    Icon: Mic,
    impactPt: '4 idiomas, voz neural',
    impactEn: '4 languages, neural voice',
    mockupBars: [60, 70, 65, 80, 75, 85, 80, 90, 85, 95],
  },
  {
    key: 'analytics',
    Icon: BarChart3,
    impactPt: 'RPM real do nicho',
    impactEn: 'Real niche RPM',
    mockupBars: [40, 45, 55, 50, 65, 60, 75, 80, 85, 90],
  },
  {
    key: 'dashboard',
    Icon: LayoutDashboard,
    impactPt: 'Consultor 24/7',
    impactEn: '24/7 consultant',
    mockupBars: [50, 55, 60, 65, 70, 72, 78, 82, 88, 92],
  },
];

export const FeaturesSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {isPortuguese ? 'Ferramentas que convertem' : 'Tools that convert'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">{t('features.title')}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('features.subtitle')}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const { Icon } = f;
            return (
              <motion.div
                key={f.key}
                className="glass-premium rounded-2xl p-6 group hover:scale-[1.02] transition-all duration-300 cursor-default"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center group-hover:glow-primary transition-shadow">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    {isPortuguese ? f.impactPt : f.impactEn}
                  </span>
                </div>

                <h3 className="text-lg font-semibold font-display mb-2">{t(`features.${f.key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{t(`features.${f.key}.desc`)}</p>

                {/* Mini chart preview */}
                <div className="flex items-end gap-[3px] h-10 mt-auto opacity-40 group-hover:opacity-70 transition-opacity">
                  {f.mockupBars.map((h, j) => (
                    <div
                      key={j}
                      className="flex-1 rounded-t-sm bg-primary/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
