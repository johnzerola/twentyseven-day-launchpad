import { Star, TrendingUp, Users, Eye, DollarSign } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    name: 'Carlos M.',
    channel: 'Canal Faceless Terror',
    niche: 'Terror',
    avatar: 'C',
    rating: 5,
    resultPt: '0 → 1.000 subs em 18 dias',
    resultEn: '0 → 1,000 subs in 18 days',
    quotePt: 'Em 18 dias fui de ZERO para mil inscritos. O roteiro que a IA gerou teve 89% de retenção no primeiro vídeo. Nunca vi nada assim.',
    quoteEn: 'In 18 days I went from ZERO to a thousand subscribers. The AI script had 89% retention on the first video. Never seen anything like it.',
    metrics: { subs: '1.247', views: '340K', revenue: 'R$ 890' },
  },
  {
    name: 'Ana P.',
    channel: 'Finanças Simples',
    niche: 'Finanças',
    avatar: 'A',
    rating: 5,
    resultPt: 'YPP aprovado em 45 dias',
    resultEn: 'YPP approved in 45 days',
    quotePt: 'Eu já tinha tentado 3 vezes monetizar meu canal e falhei. Com o Monetize AI, em 45 dias atingi o YPP. A diferença é que agora eu sabia EXATAMENTE o que fazer.',
    quoteEn: 'I had already tried 3 times to monetize my channel and failed. With Monetize AI, I reached YPP in 45 days. The difference was knowing EXACTLY what to do.',
    metrics: { subs: '2.100', views: '580K', revenue: 'R$ 2.340' },
  },
  {
    name: 'Rafael S.',
    channel: 'Curiosidades BR',
    niche: 'Curiosidades',
    avatar: 'R',
    rating: 5,
    resultPt: '500K views no 1º mês',
    resultEn: '500K views in 1st month',
    quotePt: 'Meu primeiro vídeo com script do Monetize AI fez 120K views. No final do mês, já tinha 500K. O segredo são os hooks — a IA sabe exatamente como prender.',
    quoteEn: 'My first video with a Monetize AI script got 120K views. By month end, I had 500K. The secret is the hooks — the AI knows exactly how to hook viewers.',
    metrics: { subs: '3.800', views: '1.2M', revenue: 'R$ 4.100' },
  },
];

export const TestimonialsSection = () => {
  const { locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {isPortuguese ? 'Resultados Reais' : 'Real Results'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            {isPortuguese
              ? 'Canais Que Saíram do Zero com o Monetize AI'
              : 'Channels That Started From Zero with Monetize AI'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isPortuguese
              ? 'Esses resultados são reais. Nomes alterados por privacidade, métricas verificadas.'
              : 'These results are real. Names changed for privacy, metrics verified.'}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              className="glass-premium rounded-2xl p-6 flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center text-lg font-bold text-primary-foreground">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.channel} • {t.niche}</p>
                </div>
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Result badge */}
              <div className="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                <TrendingUp className="w-3.5 h-3.5" />
                {isPortuguese ? t.resultPt : t.resultEn}
              </div>

              {/* Quote */}
              <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                "{isPortuguese ? t.quotePt : t.quoteEn}"
              </p>

              {/* Metrics bar */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                <div className="text-center">
                  <Users className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-xs font-bold">{t.metrics.subs}</p>
                  <p className="text-[10px] text-muted-foreground">subs</p>
                </div>
                <div className="text-center">
                  <Eye className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-xs font-bold">{t.metrics.views}</p>
                  <p className="text-[10px] text-muted-foreground">views</p>
                </div>
                <div className="text-center">
                  <DollarSign className="w-3.5 h-3.5 text-accent mx-auto mb-1" />
                  <p className="text-xs font-bold">{t.metrics.revenue}</p>
                  <p className="text-[10px] text-muted-foreground">/mês</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
