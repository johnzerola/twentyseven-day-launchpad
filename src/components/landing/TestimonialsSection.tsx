import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: '@CriadorDark_YT',
    initial: 'C',
    bg: '#FF0000',
    quote: 'O pipeline de roteiro me poupa pelo menos 2 horas por vídeo. A estrutura narrativa que a IA sugere é muito mais sofisticada do que o que eu fazia sozinho.',
    badge: 'Usuário ativo',
    subs: 'Canal de True Crime',
  },
  {
    name: '@TechExplorer',
    initial: 'T',
    bg: '#F5C518',
    quote: 'Canal faceless de tecnologia. O sistema de análise de títulos concorrentes me ajuda a encontrar ângulos que eu não pensaria. A narração IA é um bônus.',
    badge: 'Usuário ativo',
    subs: 'Canal de Tech',
  },
  {
    name: '@HistóriaViva',
    initial: 'H',
    bg: '#22C55E',
    quote: 'A curva de retenção estimada me ajudou a reestruturar meus roteiros. Antes eu perdia o público na metade, agora eu sei onde reforçar.',
    badge: 'Usuário ativo',
    subs: 'Canal de História',
  },
  {
    name: '@InvestidorReal',
    initial: 'I',
    bg: '#CC0000',
    quote: 'Nicho de finanças é concorrido. A pesquisa de concorrentes no gerador de títulos me mostra gaps reais que ninguém está cobrindo.',
    badge: 'Usuário ativo',
    subs: 'Canal de Finanças',
  },
  {
    name: '@MitoGrego',
    initial: 'M',
    bg: '#E8A800',
    quote: 'A Dotti entende meu canal de mitologia e sugere temas com base nos meus vídeos anteriores. Virou minha assistente de produção.',
    badge: 'Usuário ativo',
    subs: 'Canal de Mitologia',
  },
  {
    name: '@CriadorIniciante',
    initial: 'D',
    bg: '#FF0000',
    quote: 'O plano de 30 dias me deu direção quando eu não sabia por onde começar. Sem promessas milagrosas, só estrutura clara.',
    badge: 'Usuário ativo',
    subs: 'Canal novo',
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
