import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export const FooterSection = () => {
  const navigate = useNavigate();

  return (
    <footer>
      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,0,0,0.1)_0%,transparent_70%)]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-3xl mx-auto px-4 text-center"
        >
          <h2 className="font-display font-extrabold text-4xl md:text-5xl text-white mb-4">
            Seu canal pode ser o próximo.
          </h2>
          <p className="text-[#A3A3A3] text-lg mb-8">
            Mais de 3.847 criadores já tomaram essa decisão. O que está esperando?
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-youtube shimmer px-12 py-5 text-xl font-display font-extrabold min-w-[300px]"
          >
            ▶ Começar meu plano grátis agora
          </button>
          <p className="text-[13px] text-[#A3A3A3] mt-4">
            Sem cartão de crédito · Resultado em 27 dias
          </p>
        </motion.div>
      </section>

      {/* SEO text */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <p className="text-xs text-[#A3A3A3]/60 leading-relaxed text-center">
          O Monetiza27 é a plataforma brasileira de inteligência artificial para YouTube especializada em monetização rápida de canais.
          Nossa IA analisa nichos, gera roteiros virais para YouTube, produz narração automática em português e cria um plano personalizado de 27 dias
          para você atingir os requisitos do YouTube Partner Program (YPP): 1.000 inscritos e 4.000 horas assistidas.
          Funciona para canais novos, canais sem aparecer (faceless) e criadores de qualquer nicho.
          Mais de 3.200 criadores já monetizaram seus canais usando o Monetiza27.
        </p>
      </div>

      {/* Footer proper */}
      <div className="border-t border-white/5" style={{ backgroundColor: '#050505' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <svg width="24" height="17" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="6" fill="#FF0000"/><path d="M11 6L19 10L11 14V6Z" fill="white"/></svg>
                <span className="font-display font-bold text-white">Monetiza27</span>
              </div>
              <p className="text-xs text-[#A3A3A3] leading-relaxed">
                A plataforma de IA que leva criadores do zero ao YPP.
              </p>
            </div>

            {/* Produto */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Produto</h4>
              <ul className="space-y-2">
                {['Features', 'Planos', 'FAQ'].map(l => (
                  <li key={l}><a href={`#${l.toLowerCase()}`} className="text-xs text-[#A3A3A3] hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Empresa */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Empresa</h4>
              <ul className="space-y-2">
                {['Sobre', 'Blog', 'Contato'].map(l => (
                  <li key={l}><span className="text-xs text-[#A3A3A3]">{l}</span></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Legal</h4>
              <ul className="space-y-2">
                {['Privacidade', 'Termos'].map(l => (
                  <li key={l}><span className="text-xs text-[#A3A3A3]">{l}</span></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 text-center">
            <p className="text-[11px] text-[#A3A3A3]">
              © 2026 Monetiza27. Feito com ▶ no Brasil.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
