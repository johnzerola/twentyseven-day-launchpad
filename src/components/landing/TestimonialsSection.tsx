import { Star, TrendingUp, Users, Eye, DollarSign } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';
import { YouTubePlayIcon } from './YouTubePlayIcon';

const TESTIMONIALS = [
  {
    name: '@CarlosVieira_YT',
    niche: 'Terror',
    avatar: 'C',
    quotePt: '1.200 inscritos em 24 dias. O plano diário me disse exatamente o que fazer cada dia. Incrível.',
    quoteEn: '1,200 subscribers in 24 days. The daily plan told me exactly what to do each day. Incredible.',
    resultPt: '0 → 1.200 subs em 24 dias',
    resultEn: '0 → 1,200 subs in 24 days',
    metrics: { subs: '1.200', views: '340K', revenue: 'R$ 890' },
  },
  {
    name: '@FernandaMktDigital',
    niche: 'Marketing',
    avatar: 'F',
    quotePt: 'Monetizei no dia 23. Nunca pensei que fosse possível tão rápido.',
    quoteEn: 'Monetized on day 23. Never thought it would be possible this fast.',
    resultPt: 'YPP no dia 23',
    resultEn: 'YPP on day 23',
    metrics: { subs: '2.100', views: '580K', revenue: 'R$ 2.340' },
  },
  {
    name: '@TechComRodrigo',
    niche: 'Tech',
    avatar: 'R',
    quotePt: 'Os roteiros com IA são absurdamente bons. Meus vídeos passaram de 200 para 8.000 views.',
    quoteEn: 'The AI scripts are insanely good. My videos went from 200 to 8,000 views.',
    resultPt: '200 → 8.000 views por vídeo',
    resultEn: '200 → 8,000 views per video',
    metrics: { subs: '3.800', views: '1.2M', revenue: 'R$ 4.100' },
  },
];

export const TestimonialsSection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';

  return (
    <section className="py-20 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* YouTube icon decoration */}
      <div className="absolute top-10 right-16 hidden lg:block">
        <YouTubePlayIcon size={48} opacity={0.04} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div className="text-center mb-14" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {pt ? 'Resultados Reais' : 'Real Results'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            {pt ? 'O que dizem os criadores que monetizaram' : 'What creators who monetized say'}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              className="glass-premium rounded-2xl p-6 flex flex-col hover:-translate-y-1 transition-transform duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full gradient-hero flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm text-primary">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.niche}</p>
                </div>
              </div>

              <div className="flex gap-0.5 mb-3">
                {[1,2,3,4,5].map(j => <Star key={j} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
              </div>

              <div className="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-4">
                <TrendingUp className="w-3.5 h-3.5" />
                {pt ? t.resultPt : t.resultEn}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                "{pt ? t.quotePt : t.quoteEn}"
              </p>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/40">
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
