import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const plans = [
  {
    key: 'free',
    features: ['1 canal', 'Plano 27 dias básico', '3 roteiros/mês', 'Busca limitada'],
    featuresEn: ['1 channel', 'Basic 27-day plan', '3 scripts/month', 'Limited search'],
  },
  {
    key: 'pro',
    features: ['3 canais', 'Plano 27 dias completo', '30 roteiros/mês', 'Busca ilimitada', 'Narração IA', 'Análise de concorrentes'],
    featuresEn: ['3 channels', 'Full 27-day plan', '30 scripts/month', 'Unlimited search', 'AI narration', 'Competitor analysis'],
    popular: true,
  },
  {
    key: 'full',
    features: ['Canais ilimitados', 'Tudo do Pro', 'Roteiros ilimitados', 'API access', 'Suporte prioritário', 'White label'],
    featuresEn: ['Unlimited channels', 'Everything in Pro', 'Unlimited scripts', 'API access', 'Priority support', 'White label'],
  },
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
      </div>
    </section>
  );
};
