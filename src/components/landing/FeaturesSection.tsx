import { motion } from 'framer-motion';
import { Check, Search, Pen, Mic, BarChart3, LayoutDashboard } from 'lucide-react';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

export const FeaturesSection = () => (
  <section id="features" className="py-20 md:py-28">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div {...fadeUp(0)} className="text-center mb-16">
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-red-500/10 text-red-400 border border-red-500/20 mb-6">
          O QUE ESTÁ INCLUSO
        </span>
        <h2 className="font-display font-bold text-3xl md:text-[44px] text-white leading-tight">
          Ferramentas de IA para Crescer no YouTube mais Rápido
        </h2>
        <p className="text-[#A3A3A3] mt-4 max-w-lg mx-auto">
          Enquanto seus concorrentes adivinham, você executa com dados.
        </p>
      </motion.div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1 — Large, spans 2 cols */}
        <motion.div {...fadeUp(0.1)} className="md:col-span-2 glass-dark rounded-2xl p-8 hover:border-red-500/30 transition-colors group">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
              <svg width="24" height="17" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="6" fill="#FF0000"/><path d="M11 6L19 10L11 14V6Z" fill="white"/></svg>
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white">Plano de 27 Dias com IA</h3>
              <p className="text-[#A3A3A3] text-sm mt-1.5 leading-relaxed">
                Plano de monetização YouTube com inteligência artificial. Cada dia tem uma missão personalizada baseada no seu nicho, país e estilo de conteúdo.
              </p>
            </div>
          </div>
          {/* Timeline preview */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { day: 'Dia 1', label: 'Nicho definido', done: true },
              { day: 'Dia 7', label: 'Primeiros vídeos', done: true },
              { day: 'Dia 14', label: '500 inscritos', done: false },
              { day: 'Dia 27', label: 'YPP aprovado ★', done: false },
            ].map((m, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2">
                <div className={`px-3 py-2 rounded-lg text-xs font-medium ${m.done ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' : 'bg-white/5 text-[#A3A3A3] border border-white/10'}`}>
                  <span className="block font-bold">{m.day}</span>
                  <span>{m.label}</span>
                </div>
                {i < 3 && <div className="w-6 h-px bg-white/10 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Card 2 — Roteiros */}
        <motion.div {...fadeUp(0.15)} className="glass-dark rounded-2xl p-6 hover:border-red-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
            <Pen size={20} className="text-red-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white">Roteiros que Retêm 80%+</h3>
          <p className="text-[#A3A3A3] text-sm mt-2 leading-relaxed">
            Roteiros virais para YouTube gerados por IA com estrutura de hook, retenção e CTA otimizados para o algoritmo.
          </p>
        </motion.div>

        {/* Card 3 — Análise de Nicho */}
        <motion.div {...fadeUp(0.2)} className="glass-dark rounded-2xl p-6 hover:border-red-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
            <Search size={20} className="text-red-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white">Nichos com 0 Concorrência</h3>
          <p className="text-[#A3A3A3] text-sm mt-2 leading-relaxed">
            Análise de nicho YouTube e espionagem de concorrentes. Descubra sub-nichos inexplorados com alto RPM.
          </p>
          {/* Mini bar chart */}
          <div className="flex items-end gap-1.5 mt-4 h-12">
            {[40, 65, 30, 85, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-red-500/40 to-red-500/20" style={{ height: `${h}%` }} />
            ))}
          </div>
        </motion.div>

        {/* Card 4 — Narração IA (gold accent) */}
        <motion.div {...fadeUp(0.25)} className="glass-dark rounded-2xl p-6 border-[#F5C518]/20 hover:border-[#F5C518]/40 transition-colors group" style={{ boxShadow: '0 0 40px -10px rgba(245,197,24,0.15)' }}>
          <div className="w-10 h-10 rounded-xl bg-[#F5C518]/10 flex items-center justify-center mb-4 group-hover:bg-[#F5C518]/20 transition-colors">
            <Mic size={20} className="text-[#F5C518]" />
          </div>
          <h3 className="font-display font-bold text-lg text-white">Narração IA Profissional</h3>
          <p className="text-[#A3A3A3] text-sm mt-2 leading-relaxed">
            Narração automática em português para canal sem aparecer. Vozes neurais que soam 100% humanas.
          </p>
          <span className="inline-block mt-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/20">
            EXCLUSIVO
          </span>
        </motion.div>

        {/* Card 5 — Analytics */}
        <motion.div {...fadeUp(0.3)} className="glass-dark rounded-2xl p-6 hover:border-red-500/30 transition-colors group">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
            <BarChart3 size={20} className="text-red-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white">Analytics Preditivo</h3>
          <p className="text-[#A3A3A3] text-sm mt-2 leading-relaxed">
            Estimativa de ganhos e RPM por nicho YouTube. Preveja qual vídeo vai viralizar antes de publicar.
          </p>
        </motion.div>

        {/* Card 6 — Dashboard, spans 2 cols */}
        <motion.div {...fadeUp(0.35)} className="md:col-span-2 glass-dark rounded-2xl p-8 hover:border-red-500/30 transition-colors group">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
              <LayoutDashboard size={24} className="text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-bold text-xl text-white">Dashboard de Crescimento Completo</h3>
              <p className="text-[#A3A3A3] text-sm mt-1.5 leading-relaxed">
                Acompanhamento de progresso rumo ao YPP em tempo real. Cada ação, cada métrica, tudo num painel único.
              </p>
              {/* YPP progress preview */}
              <div className="mt-5 grid grid-cols-3 gap-4">
                {[
                  { label: 'Inscritos', value: '847 / 1.000', pct: 85 },
                  { label: 'Horas assistidas', value: '3.200 / 4.000', pct: 80 },
                  { label: 'Vídeos publicados', value: '18', pct: 100 },
                ].map((m, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">{m.label}</div>
                    <div className="text-white font-bold text-sm mt-1">{m.value}</div>
                    <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#FF0000] to-[#F5C518]" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);
