import { Check, X, Crown, Zap, Shield, Clock, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';

const plans = [
  {
    key: 'explorer',
    price: { monthly: 'R$0', annual: 'R$0' },
    priceEn: { monthly: '$0', annual: '$0' },
    descPt: 'Para testar o poder da plataforma',
    descEn: 'To test the platform\'s power',
    features: ['1 canal', 'Plano 27 dias básico', '3 roteiros/mês', 'Busca limitada'],
    featuresEn: ['1 channel', 'Basic 27-day plan', '3 scripts/month', 'Limited search'],
    ctaPt: 'Começar grátis',
    ctaEn: 'Start free',
    style: 'glass',
  },
  {
    key: 'pro',
    price: { monthly: 'R$79', annual: 'R$47' },
    priceEn: { monthly: '$15', annual: '$9' },
    originalPt: 'R$79/mês',
    originalEn: '$15/mo',
    descPt: 'Para quem quer monetizar nos próximos 27 dias',
    descEn: 'For those who want to monetize in the next 27 days',
    features: ['3 canais', 'Plano 27 dias completo', '30 roteiros/mês', 'Busca ilimitada', 'Narração IA (R$0 extra)', 'Análise de concorrentes', 'Suporte prioritário'],
    featuresEn: ['3 channels', 'Full 27-day plan', '30 scripts/month', 'Unlimited search', 'AI narration ($0 extra)', 'Competitor analysis', 'Priority support'],
    ctaPt: 'Quero monetizar agora →',
    ctaEn: 'I want to monetize now →',
    popular: true,
    spotsPt: '⏰ Oferta por tempo limitado',
    spotsEn: '⏰ Limited time offer',
    style: 'glass-premium border-gradient-animated scale-105',
  },
  {
    key: 'elite',
    price: { monthly: 'R$247', annual: 'R$147' },
    priceEn: { monthly: '$47', annual: '$29' },
    descPt: 'Para agências e criadores sérios',
    descEn: 'For agencies and serious creators',
    features: ['Canais ilimitados', 'Tudo do Pro', 'Roteiros ilimitados', 'API access', 'White label', 'Account manager dedicado'],
    featuresEn: ['Unlimited channels', 'Everything in Pro', 'Unlimited scripts', 'API access', 'White label', 'Dedicated account manager'],
    ctaPt: 'Falar com consultor',
    ctaEn: 'Talk to consultant',
    style: 'glass-gold border-gold-animated',
  },
];

export const PricingSection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-24 relative aurora-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            {pt ? 'Planos para Monetizar seu YouTube — A partir de R$0' : 'Plans to Monetize your YouTube — Starting at $0'}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {pt ? 'Escolha seu plano. Cancele quando quiser.' : 'Choose your plan. Cancel anytime.'}
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 glass-premium rounded-full px-4 py-2">
            <span className={`text-sm ${!annual ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{pt ? 'Mensal' : 'Monthly'}</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{pt ? 'Anual' : 'Annual'}</span>
            {annual && <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{pt ? 'Economize 40%' : 'Save 40%'}</span>}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.key}
              className={`rounded-2xl p-8 relative ${plan.style}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-hero text-xs font-bold text-primary-foreground flex items-center gap-1 whitespace-nowrap">
                  <Zap className="w-3 h-3" />
                  🔥 {pt ? 'MAIS ESCOLHIDO — 87% dos usuários' : 'MOST CHOSEN — 87% of users'}
                </div>
              )}
              {plan.key === 'elite' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full gradient-gold text-xs font-bold text-background flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Elite
                </div>
              )}

              <h3 className="text-xl font-bold font-display mb-1">
                {plan.key === 'explorer' ? (pt ? 'Explorador' : 'Explorer') : plan.key === 'pro' ? 'Creator Pro' : 'Agency Elite'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{pt ? plan.descPt : plan.descEn}</p>

              {/* Price */}
              {plan.originalPt && annual && (
                <p className="text-sm text-muted-foreground line-through">{pt ? plan.originalPt : plan.originalEn}</p>
              )}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold gradient-text">
                  {pt ? (annual ? plan.price.annual : plan.price.monthly) : (annual ? plan.priceEn.annual : plan.priceEn.monthly)}
                </span>
                <span className="text-muted-foreground">/{pt ? 'mês' : 'mo'}</span>
              </div>
              {annual && plan.key !== 'explorer' && (
                <p className="text-xs text-muted-foreground mb-3">
                  {pt ? `ou ${plan.price.monthly}/mês no plano mensal` : `or ${plan.priceEn.monthly}/mo on monthly`}
                </p>
              )}

              {plan.spotsPt && (
                <p className="text-xs text-yellow-400 font-semibold mb-4 animate-pulse">
                  {pt ? plan.spotsPt : plan.spotsEn}
                </p>
              )}

              <ul className="space-y-3 mb-6">
                {(pt ? plan.features : plan.featuresEn).map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Link to="/login">
                <Button
                  className={`w-full font-semibold ${
                    plan.popular ? 'gradient-hero border-0 glow-primary shimmer text-base py-6' :
                    plan.key === 'elite' ? 'gradient-gold border-0 glow-gold text-background' : ''
                  }`}
                  variant={plan.popular || plan.key === 'elite' ? 'default' : 'outline'}
                  size="lg"
                >
                  {pt ? plan.ctaPt : plan.ctaEn}
                </Button>
              </Link>

              {plan.popular && (
                <p className="text-xs text-center text-emerald-400 mt-3 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  {pt ? 'Garantia de 7 dias ou seu dinheiro de volta' : '7-day money-back guarantee'}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Payment security */}
        <motion.div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-muted-foreground" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <span>🔒 {pt ? 'Pagamento 100% seguro' : '100% secure payment'}</span>
          <span>SSL</span>
          <span>{pt ? 'Dados protegidos' : 'Data protected'}</span>
        </motion.div>

        {/* Timeline */}
        <motion.div className="mt-20 max-w-3xl mx-auto glass-premium rounded-2xl p-8" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-accent" />
            <h3 className="text-2xl font-bold font-display">{pt ? 'Quanto tempo para monetizar?' : 'How long to monetize?'}</h3>
          </div>
          <p className="text-muted-foreground mb-6">{pt ? 'Cronograma realista com 3 vídeos/semana' : 'Realistic timeline with 3 videos/week'}</p>
          <div className="space-y-4">
            {[
              { icon: Target, color: 'text-accent', text: pt ? 'Mês 1: Base sólida — 12-15 roteiros otimizados, nicho validado, primeiros 100-500 subs' : 'Month 1: Solid foundation — 12-15 optimized scripts, validated niche, first 100-500 subs' },
              { icon: TrendingUp, color: 'text-yellow-400', text: pt ? 'Mês 2-3: Crescimento acelerado — Retenção >50%, 500-1.500 subs, padrões virais' : 'Month 2-3: Accelerated growth — Retention >50%, 500-1,500 subs, viral patterns' },
              { icon: Check, color: 'text-emerald-400', text: pt ? 'Mês 3-6: Monetização — 1.000+ subs, 4.000h watch time, YPP aprovado' : 'Month 3-6: Monetization — 1,000+ subs, 4,000h watch time, YPP approved' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <step.icon className={`w-4 h-4 ${step.color}`} />
                  </div>
                  {i < 2 && <div className="w-px h-6 bg-border mt-1" />}
                </div>
                <p className="text-sm text-muted-foreground pt-1">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">{pt ? '* Resultados dependem de nicho, consistência e execução. A plataforma otimiza cada variável.' : '* Results depend on niche, consistency and execution quality.'}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
