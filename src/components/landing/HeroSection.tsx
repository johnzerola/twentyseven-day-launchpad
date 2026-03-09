import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

export const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t('hero.badge')}
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-['Space_Grotesk'] leading-tight mb-6">
            {t('hero.title')}{' '}
            <span className="gradient-text">{t('hero.title.highlight')}</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/login">
              <Button size="lg" className="gradient-hero border-0 glow-primary text-lg px-8 py-6 group">
                {t('hero.cta')}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 group">
              <Play className="w-5 h-5 mr-2" />
              {t('hero.cta2')}
            </Button>
          </div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-3 gap-8 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {[
              { value: t('hero.stat1'), label: t('hero.stat1.label') },
              { value: t('hero.stat2'), label: t('hero.stat2.label') },
              { value: t('hero.stat3'), label: t('hero.stat3.label') },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl sm:text-4xl font-bold gradient-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
