import { Check, Clock, TrendingUp, Target, AlertTriangle, X, Crown, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const plans = [
  {
    key: 'starter',
    tier: 'starter',
    features: [
      '1 canal',
      '12 vídeos/mês',
      '20 conversas TubeBot',
      'Narração IA até 30 min',
      'Busca básica de nichos',
      'Veo3 prompts',
    ],
    featuresEn: [
      '1 channel',
      '12 videos/month',
      '20 TubeBot chats',
      'AI narration up to 30 min',
      'Basic niche search',
      'Veo3 prompts',
    ],
    limitations: ['Sem multilíngue', 'Sem análise de concorrentes'],
    limitationsEn: ['No multilingual', 'No competitor analysis'],
    originalPricePt: 'R$ 197',
    originalPriceEn: '$37',
    spots: null,
  },
  {
    key: 'pro',
    tier: 'pro',
    features: [
      '5 canais',
      '3 vídeos/dia',
      'Narração IA até 1 hora',
      'Análise de concorrentes',
      'TubeBot ilimitado',
      'Veo3 prompts',
      'Multilíngue liberado',
    ],
    featuresEn: [
      '5 channels',
      '3 videos/day',
      'AI narration up to 1 hour',
      'Competitor analysis',
      'Unlimited TubeBot',
      'Veo3 prompts',
      'Multilingual unlocked',
    ],
    popular: true,
    originalPricePt: 'R$ 497',
    originalPriceEn: '$97',
    spotsPt: 'Faltam 12 vagas',
    spotsEn: '12 spots left',
  },
  {
    key: 'full',
    tier: 'full',
    features: [
      'Canais ilimitados',
      'Vídeos ilimitados',
      'Narração ilimitada',
      'Tudo do Pro',
      'Roteiros ilimitados',
      'Pesquisas ilimitadas',
      'API access',
      'Suporte prioritário',
      'White label',
    ],
    featuresEn: [
      'Unlimited channels',
      'Unlimited videos',
      'Unlimited narration',
      'Everything in Pro',
      'Unlimited scripts',
      'Unlimited searches',
      'API access',
      'Priority support',
      'White label',
    ],
    originalPricePt: 'R$ 997',
    originalPriceEn: '$197',
    spotsPt: 'Faltam 5 vagas',
    spotsEn: '5 spots left',
  },
];

const timelineSteps = [
  { icon: Target, key: 'm1', color: 'text-blue-400' },
  { icon: TrendingUp, key: 'm2', color: 'text-yellow-400' },
  { icon: Check, key: 'm3', color: 'text-emerald-400' },
];

export const PricingSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  const getCardClass = (plan: typeof plans[0]) => {
    if (plan.tier === 'full') return 'glass-gold border-gold-animated';
    if (plan.tier === 'pro') return 'glass-premium border-gradient-animated scale-105';
    return 'glass';
  };

  return (
    <section id="pricing" className="py-24 relative aurora-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {isPortuguese ? 'Invista no seu canal' : 'Invest in your channel'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">{t('pricing.title')}</h2>
          <p className="text-muted-foreground text-lg">{t('pricing.subtitle')}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.key}
              className={`rounded-2xl p-8 relative ${getCardClass(plan)}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-hero text-xs font-bold text-primary-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {t('pricing.popular')}
                </div>
              )}

              {plan.tier === 'full' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-gold text-xs font-bold text-background flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {isPortuguese ? '👑 Elite' : '👑 Elite'}
                </div>
              )}

              <h3 className="text-xl font-bold font-display mb-2">{t(`pricing.${plan.key}`)}</h3>

              {/* Original price strikethrough */}
              <div className="text-sm text-muted-foreground line-through mb-1">
                {isPortuguese ? plan.originalPricePt : plan.originalPriceEn}
              </div>

              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold gradient-text">{t(`pricing.${plan.key}.price`)}</span>
                <span className="text-muted-foreground">{t('pricing.mo')}</span>
              </div>

              {/* Spots urgency */}
              {(plan.spotsPt || plan.spotsEn) && (
                <p className="text-xs text-destructive font-semibold mb-4 flex items-center gap-1">
                  <span className="live-dot !w-1.5 !h-1.5" />
                  {isPortuguese ? plan.spotsPt : plan.spotsEn}
                </p>
              )}
              {!plan.spotsPt && !plan.spotsEn && <div className="mb-4" />}

              <ul className="space-y-3 mb-4">
                {(isPortuguese ? plan.features : plan.featuresEn).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {plan.limitations && (
                <ul className="space-y-2 mb-8">
                  {(isPortuguese ? plan.limitations : plan.limitationsEn)?.map((l) => (
                    <li key={l} className="flex items-center gap-2 text-sm">
                      <X className="w-4 h-4 text-destructive/60 flex-shrink-0" />
                      <span className="text-muted-foreground/60">{l}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!plan.limitations && <div className="mb-8" />}

              <Link to="/login">
                <Button
                  className={`w-full font-semibold ${
                    plan.tier === 'full'
                      ? 'gradient-gold border-0 glow-gold text-background shimmer'
                      : plan.popular
                        ? 'gradient-hero border-0 glow-primary shimmer'
                        : ''
                  }`}
                  variant={plan.popular || plan.tier === 'full' ? 'default' : 'outline'}
                  size="lg"
                >
                  {t(`pricing.cta.${plan.key}`)}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Guarantee badge */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-10 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <Shield className="w-5 h-5 text-emerald-400" />
          <span>{isPortuguese ? '7 dias de garantia total — ou seu dinheiro de volta' : '7-day money-back guarantee — no questions asked'}</span>
        </motion.div>

        {/* Monetization Timeline */}
        <motion.div
          className="mt-20 max-w-3xl mx-auto glass-premium rounded-2xl p-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-primary" />
            <h3 className="text-2xl font-bold font-display">{t('pricing.timeline.title')}</h3>
          </div>
          <p className="text-muted-foreground mb-6">{t('pricing.timeline.subtitle')}</p>

          <div className="space-y-4">
            {timelineSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${step.color}`} />
                    </div>
                    {i < timelineSteps.length - 1 && (
                      <div className="w-px h-6 bg-border mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 pt-1">{t(`pricing.timeline.${step.key}`)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">{t('pricing.timeline.note')}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
