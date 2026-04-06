import { X, Check, ArrowRight, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const comparisonData = {
  pt: {
    title: 'A Diferença de Quem Usa Inteligência Artificial',
    without: 'Sem Monetize AI',
    with: 'Com Monetize AI',
    items: [
      { without: '6-12 meses para YPP', with: '27-90 dias para YPP' },
      { without: '~200 views por vídeo', with: '~2.000+ views por vídeo' },
      { without: '3h+ por roteiro', with: '15 min por roteiro com IA' },
      { without: 'Nicho escolhido no achismo', with: 'Nicho validado com dados reais' },
      { without: 'Títulos genéricos', with: 'Títulos A/B testados com CTR 12%+' },
      { without: 'Retenção ~25%', with: 'Retenção ~55% com scripts otimizados' },
    ],
  },
  en: {
    title: 'The Difference AI Makes',
    without: 'Without Monetize AI',
    with: 'With Monetize AI',
    items: [
      { without: '6-12 months to YPP', with: '27-90 days to YPP' },
      { without: '~200 views per video', with: '~2,000+ views per video' },
      { without: '3h+ per script', with: '15 min per script with AI' },
      { without: 'Niche chosen by guessing', with: 'Niche validated with real data' },
      { without: 'Generic titles', with: 'A/B tested titles with 12%+ CTR' },
      { without: '~25% retention', with: '~55% retention with optimized scripts' },
    ],
  },
};

export const BeforeAfterSection = () => {
  const { locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';
  const data = isPortuguese ? comparisonData.pt : comparisonData.en;

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">{data.title}</h2>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* WITHOUT */}
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <h3 className="font-bold font-display text-lg text-destructive/80">{data.without}</h3>
            </div>
            <ul className="space-y-4">
              {data.items.map((item, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <X className="w-5 h-5 text-destructive/60 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item.without}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* WITH */}
          <div className="rounded-2xl glass-premium p-6 relative">
            <div className="absolute -top-3 right-6 px-3 py-1 rounded-full gradient-hero text-xs font-semibold text-primary-foreground">
              {isPortuguese ? '⚡ Resultado comprovado' : '⚡ Proven results'}
            </div>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold font-display text-lg text-emerald-400">{data.with}</h3>
            </div>
            <ul className="space-y-4">
              {data.items.map((item, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">{item.with}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
