import { Link } from 'react-router-dom';
import { ArrowRight, Play, Shield, Star, CheckCircle2, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const useAnimatedCounter = (target: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

const SOCIAL_PROOF = [
  { name: 'Canal Faceless Terror', result: '1.000 subs em 18 dias', niche: 'Terror' },
  { name: 'Finanças Simples', result: 'YPP em 45 dias', niche: 'Finanças' },
  { name: 'Curiosidades BR', result: '500k views no 1º mês', niche: 'Curiosidades' },
  { name: 'Tech Explained', result: '2.000 subs em 30 dias', niche: 'Tecnologia' },
];

export const HeroSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';
  const channelsCount = useAnimatedCounter(2437, 2500);
  const todaySignups = 247;

  return (
    <section className="relative pt-28 pb-24 overflow-hidden aurora-bg">
      {/* Enhanced background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[160px] float" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/6 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/4 rounded-full blur-[200px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* Live badge with pulse */}
          <motion.div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-premium text-sm mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="live-dot" />
            <span className="text-muted-foreground">
              <span className="text-primary font-semibold ticker">{todaySignups}</span>
              {isPortuguese ? ' pessoas criaram conta hoje' : ' people signed up today'}
            </span>
          </motion.div>

          {/* Social proof avatars */}
          <motion.div
            className="flex items-center justify-center gap-3 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex -space-x-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {['M','J','A','R','L'][i-1]}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('hero.badge')}
              </p>
            </div>
          </motion.div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display leading-[1.1] mb-6 tracking-tight">
            {t('hero.title')}{' '}
            <span className="gradient-text">{t('hero.title.highlight')}</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* Trust indicators row */}
          <div className="flex flex-wrap items-center justify-center gap-5 mb-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              {isPortuguese ? 'Garantia 7 dias' : '7-day guarantee'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {isPortuguese ? 'Sem cartão necessário' : 'No credit card required'}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-400" />
              4.9/5 (320+ reviews)
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link to="/login">
              <Button size="lg" className="gradient-hero border-0 glow-primary shimmer text-lg px-10 py-7 group font-semibold">
                {t('hero.cta')}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-7 group border-border/80 hover:border-primary/50 transition-colors">
              <Play className="w-5 h-5 mr-2" />
              {t('hero.cta2')}
            </Button>
          </div>

          {/* Platform Mockup Preview */}
          <motion.div
            className="relative max-w-3xl mx-auto mb-14"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <div className="glass-premium rounded-2xl p-1 glow-primary">
              <div className="bg-card rounded-xl overflow-hidden">
                {/* Mock browser bar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-1 rounded-full">app.monetizeai.com</span>
                  </div>
                </div>
                {/* Mock dashboard content */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">{isPortuguese ? 'Inscritos' : 'Subscribers'}</p>
                      <p className="text-xl font-bold text-emerald-400">2.847</p>
                      <p className="text-[10px] text-emerald-400">+342 {isPortuguese ? 'esta semana' : 'this week'}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">{isPortuguese ? 'Views Mês' : 'Monthly Views'}</p>
                      <p className="text-xl font-bold text-primary">124K</p>
                      <p className="text-[10px] text-primary">+89% ↑</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">{isPortuguese ? 'Receita' : 'Revenue'}</p>
                      <p className="text-xl font-bold text-accent">R$ 1.247</p>
                      <p className="text-[10px] text-accent">{isPortuguese ? 'projeção mês' : 'monthly est.'}</p>
                    </div>
                  </div>
                  {/* Mini chart bars */}
                  <div className="flex items-end gap-1 h-16 px-2">
                    {[30, 45, 35, 55, 50, 65, 60, 80, 70, 85, 75, 95, 90, 100].map((h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{ height: `${h}%`, background: i >= 10 ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 1 + i * 0.05, duration: 0.4 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating badge */}
            <motion.div
              className="absolute -right-4 top-12 glass-premium rounded-xl px-4 py-3 shadow-lg"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5 }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">+89% {isPortuguese ? 'retenção' : 'retention'}</p>
                  <p className="text-[10px] text-muted-foreground">{isPortuguese ? 'com IA otimizada' : 'with AI optimization'}</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="absolute -left-4 bottom-16 glass-premium rounded-xl px-4 py-3 shadow-lg"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.8 }}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-primary">+1.000 subs</p>
                  <p className="text-[10px] text-muted-foreground">{isPortuguese ? 'em 27 dias' : 'in 27 days'}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

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
              {SOCIAL_PROOF.map((proof, i) => (
                <motion.div
                  key={proof.name}
                  className="glass-premium rounded-xl px-4 py-3 text-left hover:scale-105 transition-transform cursor-default"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                >
                  <p className="text-xs font-semibold text-foreground">{proof.result}</p>
                  <p className="text-[10px] text-muted-foreground">{proof.name} • {proof.niche}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};
