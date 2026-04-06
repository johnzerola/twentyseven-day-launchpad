import { Link } from 'react-router-dom';
import { ArrowRight, Play, Shield, Star, CheckCircle2, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion, useInView } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

const useAnimatedCounter = (target: number, duration: number = 2000, start = true) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let v = 0;
    const inc = target / (duration / 16);
    const timer = setInterval(() => {
      v += inc;
      if (v >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(v));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, start]);
  return count;
};

export const HeroSection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true });
  const days = useAnimatedCounter(27, 1500, statsInView);
  const creators = useAnimatedCounter(3200, 2000, statsInView);
  const [showDemo, setShowDemo] = useState(false);

  return (
    <section className="relative pt-24 pb-20 overflow-hidden particles-bg grid-texture">
      {/* BG effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[200px]" style={{ background: 'radial-gradient(circle, hsl(263 70% 20% / 0.25), transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[180px]" style={{ background: 'radial-gradient(circle, hsl(187 94% 30% / 0.1), transparent 70%)' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            {/* Social proof avatars */}
            <motion.div className="flex items-center gap-3 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <div className="flex -space-x-2.5">
                {['M','J','A','R','L','K'].map((l, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{pt ? 'Criadores que monetizaram:' : 'Creators who monetized:'}</p>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
                  <span className="text-xs text-muted-foreground ml-1">4.9/5 (847 {pt ? 'avaliações' : 'reviews'})</span>
                </div>
              </div>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold font-display leading-[1.05] mb-6 tracking-tight">
              {pt ? (
                <>De 0 a monetizado no YouTube em <span className="gradient-text">27 dias.</span></>
              ) : (
                <>From 0 to monetized on YouTube in <span className="gradient-text">27 days.</span></>
              )}
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              {pt
                ? 'A única plataforma com IA que planeja, roteiriza, narra e analisa seu canal — do dia 1 até o YPP. Mais de 3.200 criadores já monetizaram.'
                : 'The only AI platform that plans, scripts, narrates and analyzes your channel — from day 1 to YPP. Over 3,200 creators already monetized.'}
            </p>

            {/* Trust row */}
            <div className="flex flex-wrap items-center gap-4 mb-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{pt ? 'Grátis para começar' : 'Free to start'}</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" />{pt ? 'Sem cartão de crédito' : 'No credit card'}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{pt ? 'Cancele quando quiser' : 'Cancel anytime'}</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-10">
              <Link to="/login">
                <Button size="lg" className="gradient-hero border-0 glow-primary shimmer text-lg px-8 py-7 group font-semibold rounded-lg">
                  {pt ? 'Começar meu plano de 27 dias' : 'Start my 27-day plan'} →
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-base px-6 py-7 group border-border/60 hover:border-primary/40 rounded-lg" onClick={() => setShowDemo(true)}>
                <Play className="w-4 h-4 mr-2 text-accent" />
                {pt ? 'Ver demonstração' : 'Watch demo'}
              </Button>
            </div>
          </motion.div>

          {/* Right — Mockup */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            <div className="glass-premium rounded-2xl p-1 glow-primary">
              <div className="bg-card rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/20">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-1 rounded-full">app.monetiza27.com</span>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? 'Plano Diário' : 'Daily Plan'}</p>
                      <p className="text-lg font-bold font-display">{pt ? 'Dia 12 de 27' : 'Day 12 of 27'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{pt ? 'Progresso' : 'Progress'}</p>
                      <p className="text-lg font-bold text-primary">44%</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full gradient-hero rounded-full" initial={{ width: 0 }} animate={{ width: '44%' }} transition={{ delay: 1, duration: 1.2 }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">{pt ? 'Inscritos' : 'Subs'}</p>
                      <p className="text-xl font-bold text-emerald-400">847</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">Views</p>
                      <p className="text-xl font-bold text-primary">32K</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">{pt ? 'Próxima ação' : 'Next action'}</p>
                      <p className="text-xs font-semibold text-accent mt-1">{pt ? 'Gravar roteiro viral' : 'Record viral script'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute -right-2 top-16 glass-premium rounded-xl px-3 py-2 shadow-lg"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }}
            >
              <p className="text-xs font-semibold">🎯 {pt ? 'Canal atingiu 1.000 subs' : 'Channel hit 1,000 subs'}</p>
            </motion.div>
            <motion.div
              className="absolute -left-2 bottom-20 glass-premium rounded-xl px-3 py-2 shadow-lg"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.8 }}
              style={{ animation: 'float-anim 4s ease-in-out infinite' }}
            >
              <p className="text-xs font-semibold">💰 {pt ? 'YPP aprovado!' : 'YPP approved!'}</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          ref={statsRef}
          className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {[
            { value: `${days}`, suffix: pt ? ' dias' : ' days', label: pt ? 'Tempo médio para monetização' : 'Avg time to monetize' },
            { value: `${creators.toLocaleString()}`, suffix: '+', label: pt ? 'Criadores monetizados' : 'Creators monetized' },
            { value: '4.9', suffix: '★', label: pt ? 'Avaliação média' : 'Average rating' },
          ].map((stat, i) => (
            <motion.div key={i} className="glass-premium rounded-xl p-5 text-center glow-primary" transition={{ delay: i * 0.1 }}>
              <div className="text-3xl sm:text-4xl font-bold font-display gradient-text">{stat.value}{stat.suffix}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Demo modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDemo(false)}>
          <div className="glass-premium rounded-2xl p-2 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
              <p className="text-muted-foreground text-sm">{pt ? 'Vídeo demo em breve' : 'Demo video coming soon'}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
