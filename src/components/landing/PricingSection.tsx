import { Check, Clock, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const plans = [
  {
    key: 'starter',
    features: ['1 canal', '12 vídeos/mês', '20 conversas TubeBot', 'Busca básica de nichos', 'Narração IA (Google TTS)'],
    featuresEn: ['1 channel', '12 videos/month', '20 TubeBot chats', 'Basic niche search', 'AI narration (Google TTS)'],
  },
  {
    key: 'pro',
    features: ['3 canais', '3+ vídeos/semana', 'TTS ilimitado', 'Análise de concorrentes', 'TubeBot ilimitado', 'Veo3 prompts'],
    featuresEn: ['3 channels', '3+ videos/week', 'Unlimited TTS', 'Competitor analysis', 'Unlimited TubeBot', 'Veo3 prompts'],
    popular: true,
  },
  {
    key: 'full',
    features: ['Canais ilimitados', 'Tudo do Pro', 'Roteiros ilimitados', 'API access', 'Suporte prioritário', 'White label'],
    featuresEn: ['Unlimited channels', 'Everything in Pro', 'Unlimited scripts', 'API access', 'Priority support', 'White label'],
  },
];

const timelineSteps = [
  { icon: Target, key: 'm1', color: 'text-blue-400' },
  { icon: TrendingUp, key: 'm2', color: 'text-yellow-400' },
  { icon: Check, key: 'm3', color: 'text-green-400' },
];

export const PricingSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] mb-4">{t('pricing.title')}</h2>
          <p className="text-muted-foreground text-lg">{t('pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.key}
              className={`glass rounded-2xl p-8 relative ${plan.popular ? 'border-primary/50 scale-105' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-hero text-xs font-semibold text-primary-foreground">
                  {t('pricing.popular')}
                </div>
              )}
              <h3 className="text-xl font-bold font-['Space_Grotesk'] mb-2">{t(`pricing.${plan.key}`)}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold gradient-text">{t(`pricing.${plan.key}.price`)}</span>
                <span className="text-muted-foreground">{t('pricing.mo')}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(isPortuguese ? plan.features : plan.featuresEn).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button
                  className={`w-full ${plan.popular ? 'gradient-hero border-0 glow-primary' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  {t(`pricing.cta.${plan.key}`)}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Monetization Timeline */}
        <motion.div
          className="mt-20 max-w-3xl mx-auto glass rounded-2xl p-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-primary" />
            <h3 className="text-2xl font-bold font-['Space_Grotesk']">{t('pricing.timeline.title')}</h3>
          </div>
          <p className="text-muted-foreground mb-6">{t('pricing.timeline.subtitle')}</p>

          <div className="space-y-4">
            {timelineSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center`}>
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
