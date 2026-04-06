import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: '@PedroFinance_YT',
    initial: 'P',
    bg: '#FF0000',
    quote: 'Monetizei no dia 23. Meu canal de finanças saiu do zero. O plano diário me disse EXATAMENTE o que fazer.',
    badge: '✓ Monetizado em 23 dias',
    subs: '12.400 inscritos',
  },
  {
    name: '@MarianaTech',
    initial: 'M',
    bg: '#F5C518',
    quote: 'Canal faceless. Nunca apareci na câmera. A narração IA é absurda — parece voz humana de verdade.',
    badge: '✓ Monetizado em 19 dias',
    subs: '8.900 inscritos',
  },
  {
    name: '@RafaelCulinaria',
    initial: 'R',
    bg: '#22C55E',
    quote: 'Já tentei outras plataformas. Nenhuma chegou perto. O roteiro de IA aumentou minha retenção de 38% para 71%.',
    badge: '✓ Monetizado em 27 dias',
    subs: '5.200 inscritos',
  },
  {
    name: '@LucasGames',
    initial: 'L',
    bg: '#CC0000',
    quote: 'Nicho de games é concorrido. A IA encontrou um sub-nicho que ninguém explorava. Virei referência em 30 dias.',
    badge: '✓ Monetizado em 31 dias',
    subs: '22.100 inscritos',
  },
  {
    name: '@AnaFitness_YT',
    initial: 'A',
    bg: '#E8A800',
    quote: 'R$2.300 no primeiro mês de monetização. Isso foi suficiente para largar o emprego.',
    badge: '✓ Monetizado em 25 dias',
    subs: '9.700 inscritos',
  },
  {
    name: '@DiogoMindset',
    initial: 'D',
    bg: '#FF0000',
    quote: 'O melhor investimento que fiz para meu canal. Retorno em uma semana de monetização.',
    badge: '✓ Monetizado em 22 dias',
    subs: '18.300 inscritos',
  },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <div className="glass-dark rounded-2xl p-6 min-w-[320px] max-w-[360px] flex-shrink-0 hover:border-red-500/30 transition-colors">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: t.bg }}>
        {t.initial}
      </div>
      <div>
        <div className="text-white text-sm font-medium">{t.name}</div>
        <div className="flex gap-0.5 mt-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={12} fill="#F5C518" stroke="none" />
          ))}
        </div>
      </div>
    </div>
    <p className="text-[#A3A3A3] text-sm leading-relaxed mb-4">"{t.quote}"</p>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[#22C55E]">{t.badge}</span>
      <span className="text-xs text-[#A3A3A3]">{t.subs}</span>
    </div>
  </div>
);

export const TestimonialsSection = () => (
  <section id="testimonials" className="py-20 overflow-hidden">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="text-center mb-12 px-4"
    >
      <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
        Criadores que já monetizaram com o Monetiza27
      </h2>
    </motion.div>

    <div className="relative">
      <div className="flex animate-marquee gap-6 w-max">
        {[...testimonials, ...testimonials].map((t, i) => (
          <TestimonialCard key={i} t={t} />
        ))}
      </div>
    </div>
  </section>
);
