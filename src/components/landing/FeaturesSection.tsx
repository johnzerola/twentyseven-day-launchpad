import { Calendar, Search, FileText, Mic, BarChart3, Rocket } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';
import { YouTubePlayIcon } from './YouTubePlayIcon';

const features = [
  { key: 'plan', Icon: Calendar, tagPt: 'IA Powered', tagEn: 'AI Powered', color: 'text-primary' },
  { key: 'search', Icon: Search, tagPt: 'Exclusivo', tagEn: 'Exclusive', color: 'text-accent' },
  { key: 'script', Icon: FileText, tagPt: 'IA Powered', tagEn: 'AI Powered', color: 'text-primary' },
  { key: 'narration', Icon: Mic, tagPt: 'Novo', tagEn: 'New', color: 'text-accent' },
  { key: 'analytics', Icon: BarChart3, tagPt: 'Dados Reais', tagEn: 'Real Data', color: 'text-yellow-400' },
  { key: 'dashboard', Icon: Rocket, tagPt: 'IA 24/7', tagEn: 'AI 24/7', color: 'text-primary' },
];

export const FeaturesSection = () => {
  const { t, locale } = useLanguage();
  const pt = locale === 'pt-BR';

  return (
    <section id="features" className="py-24 relative">
      {/* Decorative YouTube icons */}
      <div className="absolute top-12 left-8 hidden lg:block">
        <YouTubePlayIcon size={44} opacity={0.04} />
      </div>
      <div className="absolute bottom-16 right-12 hidden lg:block">
        <YouTubePlayIcon size={36} opacity={0.05} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {pt ? 'Plataforma completa' : 'Complete platform'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            {pt ? 'Tudo que você precisa para monetizar. Numa só plataforma.' : 'Everything you need to monetize. One platform.'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {pt ? 'Enquanto você dorme, nossa IA trabalha no seu canal.' : 'While you sleep, our AI works on your channel.'}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const { Icon } = f;
            return (
              <motion.div
                key={f.key}
                className="glass-premium rounded-2xl p-6 group hover:-translate-y-1 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center group-hover:glow-primary transition-shadow">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${f.color} bg-current/10 px-2 py-1 rounded-full border border-current/20`}
                    style={{ backgroundColor: 'transparent' }}>
                    {pt ? f.tagPt : f.tagEn}
                  </span>
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{t(`features.${f.key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(`features.${f.key}.desc`)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
