import { Link } from 'react-router-dom';
import { ArrowRight, Play, Shield, Star, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const SOCIAL_PROOF = [
  { name: 'Canal Faceless Terror', result: '1.000 subs em 18 dias', niche: 'Terror' },
  { name: 'Finanças Simples', result: 'YPP em 45 dias', niche: 'Finanças' },
  { name: 'Curiosidades BR', result: '500k views no 1º mês', niche: 'Curiosidades' },
];

export const HeroSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  return (
    <section className="relative pt-28 pb-20 overflow-hidden">
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
          {/* Social proof badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-muted-foreground mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="flex -space-x-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[8px]">
                  ⭐
                </div>
              ))}
            </span>
            {t('hero.badge')}
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-['Space_Grotesk'] leading-tight mb-6">
            {t('hero.title')}{' '}
            <span className="gradient-text">{t('hero.title.highlight')}</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('hero.subtitle')}
          </p>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mb-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-emerald-400" /> {isPortuguese ? 'Sem cartão necessário' : 'No credit card required'}</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {isPortuguese ? 'Cancele quando quiser' : 'Cancel anytime'}</span>
            <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400" /> 4.9/5 (320+ reviews)</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
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
            className="grid grid-cols-3 gap-8 max-w-lg mx-auto mb-12"
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

          {/* Mini social proof cards */}
          {isPortuguese && (
            <motion.div
              className="flex flex-wrap justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {SOCIAL_PROOF.map((proof) => (
                <div key={proof.name} className="glass rounded-lg px-4 py-2.5 text-left border border-border/50">
                  <p className="text-xs font-medium text-foreground">{proof.result}</p>
                  <p className="text-[10px] text-muted-foreground">{proof.name} • {proof.niche}</p>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};
