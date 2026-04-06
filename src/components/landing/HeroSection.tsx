import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Circle } from 'lucide-react';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, delay },
});

const avatars = [
  { initial: 'MC', bg: '#FF0000' },
  { initial: 'RS', bg: '#F5C518' },
  { initial: 'JP', bg: '#22C55E' },
  { initial: 'AF', bg: '#CC0000' },
  { initial: 'TL', bg: '#E8A800' },
];

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen pt-24 pb-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-texture" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,0,0,0.12)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-12 lg:gap-16 items-center min-h-[70vh]">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark border border-red-500/30 text-sm text-[#A3A3A3]">
                <svg width="20" height="14" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="6" fill="#FF0000"/><path d="M11 6L19 10L11 14V6Z" fill="white"/></svg>
                A plataforma #1 de monetização YouTube no Brasil
              </span>
            </motion.div>

            <motion.h1 {...fadeUp(0.1)} className="font-display font-extrabold text-[44px] md:text-[68px] leading-[1.05] tracking-[-0.03em]">
              <span className="text-white">Monetize seu canal</span>
              <br />
              <span className="shimmer-text">em 27 dias.</span>
              <br />
              <span className="text-white/70 font-sans font-medium text-lg md:text-[22px] block mt-4 tracking-normal">Com inteligência artificial. Do zero ao YPP.</span>
            </motion.h1>

            <motion.p {...fadeUp(0.2)} className="text-[#A3A3A3] text-lg max-w-[480px] leading-relaxed">
              A única IA que analisa seu nicho, cria seu plano do dia 1 ao YPP, escreve seus roteiros e até narra seus vídeos. Você só precisa publicar.
            </motion.p>

            <motion.div {...fadeUp(0.3)} className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {avatars.map((a, i) => (
                  <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0A0A0A]" style={{ backgroundColor: a.bg, zIndex: 5 - i }}>
                    {a.initial}
                  </div>
                ))}
              </div>
              <span className="text-sm text-[#A3A3A3]"><strong className="text-white">3.847</strong> criadores monetizados este mês</span>
            </motion.div>

            <motion.div {...fadeUp(0.4)} className="flex flex-col sm:flex-row gap-3 mt-2">
              <button onClick={() => navigate('/login')} className="btn-youtube shimmer px-8 py-4 text-lg font-display font-bold flex items-center justify-center gap-2">
                ▶ Começar meu plano grátis
              </button>
              <button className="px-6 py-4 rounded-xl border border-white/15 text-white text-sm font-medium hover:border-white/40 transition-colors">
                Ver como funciona em 90s
              </button>
            </motion.div>

            <motion.p {...fadeUp(0.5)} className="text-[13px] text-[#A3A3A3] flex flex-wrap gap-x-4 gap-y-1">
              <span>✓ Sem cartão</span>
              <span>✓ Resultado em 27 dias</span>
              <span>✓ Cancele quando quiser</span>
            </motion.p>
          </div>

          {/* Right column — floating planner card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="float glass-dark rounded-[20px] p-6 border border-red-500/20 relative">
              <div className="text-sm text-[#A3A3A3] mb-1">Plano de Monetização</div>
              <div className="text-white font-display font-bold text-lg mb-4">Dia 14 de 27</div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#A3A3A3]">Progresso</span>
                  <span className="text-white font-medium">52%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#FF0000] to-[#F5C518] w-[52%]" />
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Check size={16} className="text-[#22C55E]" />
                  <span className="text-white/90">Roteiro gerado pela IA</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Check size={16} className="text-[#22C55E]" />
                  <span className="text-white/90">Thumbnail criada</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Circle size={16} className="text-[#F5C518]" />
                  <span className="text-white/60">Publicar às 18:00</span>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full text-xs font-display font-bold text-[#0A0A0A] shadow-lg" style={{ background: 'linear-gradient(135deg, #F5C518, #E8A800)' }}>
                🏆 1.247 inscritos
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div {...fadeUp(0.5)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 lg:mt-20">
          {[
            { num: '3.847+', label: 'Criadores monetizados' },
            { num: '27 dias', label: 'Tempo médio para YPP' },
            { num: '4.9★', label: 'Avaliação na App Store' },
          ].map((s, i) => (
            <div key={i} className="glass-dark rounded-2xl p-6 text-center">
              <div className="font-display font-extrabold text-3xl md:text-4xl gradient-text-fire">{s.num}</div>
              <div className="text-sm text-[#A3A3A3] mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
