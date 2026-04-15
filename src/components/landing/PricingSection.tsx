import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, Shield, Star, RotateCcw, X } from 'lucide-react';
import { useStripeCheckout } from '@/hooks/useStripeCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { supabase } from '@/integrations/supabase/client';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

export const PricingSection = () => {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);
  const { openCheckout, closeCheckout, isOpen, CheckoutForm } = useStripeCheckout();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email });
    });
  }, []);

  const handleSubscribe = (priceId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    openCheckout({
      priceId,
      quantity: 1,
      customerEmail: user.email,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  // Checkout overlay
  if (isOpen && CheckoutForm) {
    return (
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4">
          <PaymentTestModeBanner />
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-2xl text-foreground">Finalizar assinatura</h2>
            <button onClick={closeCheckout} className="p-2 rounded-lg hover:bg-muted transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          <CheckoutForm />
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 md:py-28">
      <PaymentTestModeBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-red-500/10 text-red-400 border border-red-500/20 mb-6">
            INVESTIMENTO
          </span>
          <h2 className="font-display font-bold text-3xl md:text-[44px] text-white leading-tight">
            Planos para Monetizar seu YouTube
          </h2>
          <p className="text-[#A3A3A3] mt-4 max-w-xl mx-auto">
            1 mês de monetização no YouTube rende R$500–R$3.000. Seu plano custa R$97.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm ${!annual ? 'text-white' : 'text-[#A3A3A3]'}`}>Mensal</span>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-14 h-7 rounded-full bg-[#1A1A1A] border border-white/10 transition-colors"
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-200 ${annual ? 'left-7 bg-[#FF0000]' : 'left-0.5 bg-[#A3A3A3]'}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-white' : 'text-[#A3A3A3]'}`}>Anual</span>
            {annual && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-[#0A0A0A]" style={{ background: 'linear-gradient(135deg, #F5C518, #E8A800)' }}>
                💰 Economize 38%
              </span>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
          {/* Starter plan */}
          <motion.div {...fadeUp(0.1)} className="glass-dark rounded-2xl p-6 h-full">
            <div className="mb-6">
              <svg width="20" height="14" viewBox="0 0 28 20" fill="none" className="mb-3 opacity-40"><rect width="28" height="20" rx="6" fill="#FF0000"/><path d="M11 6L19 10L11 14V6Z" fill="white"/></svg>
              <h3 className="font-display font-bold text-xl text-white">Starter</h3>
              <p className="text-sm text-[#A3A3A3] mt-1">1 vídeo de 60min por dia — tudo que precisa pra começar</p>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-bold text-4xl text-white">R${annual ? '60' : '97'}</span>
                <span className="text-[#A3A3A3] text-sm">/{annual ? 'mês no anual' : 'mês'}</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '1 canal do YouTube',
                '30 vídeos/mês (1/dia)',
                'Vídeos até 60 minutos',
                'Narração Neural2 (6 vozes PT-BR)',
                'Roteiro completo IA',
                'Título SEO + Thumbnail prompt',
                'Tracker 30 dias + Dashboard YPP',
                'Viral Database básica',
                'TubeBot (20 msgs/dia)',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-[#A3A3A3]">
                  <Check size={14} className="text-[#22C55E] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(annual ? 'starter_yearly' : 'starter_monthly')}
              className="w-full py-3 rounded-xl border border-white/15 text-white text-sm font-medium hover:border-white/30 transition-colors"
            >
              Começar agora
            </button>
            <p className="text-center text-[11px] text-[#A3A3A3] mt-2">7 dias de garantia total</p>
          </motion.div>

          {/* Creator Pro plan — HERO */}
          <motion.div {...fadeUp(0.15)} className="relative rounded-2xl p-6 md:scale-[1.04] md:z-10" style={{ background: '#1A1A1A', border: '2px solid #FF0000', boxShadow: '0 0 0 1px #FF0000, 0 20px 60px rgba(255,0,0,0.25)' }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap btn-youtube px-4 py-1.5 text-xs font-bold rounded-full">
              🔥 MAIS ESCOLHIDO • 89% dos usuários
            </div>

            <div className="mt-4 mb-6">
              <h3 className="font-display font-bold text-xl text-white">Creator Pro</h3>
              <p className="text-sm text-[#F5C518] mt-1">Para quem quer escalar com Veo3 + DubSpy</p>
            </div>

            <div className="mb-6">
              <div className="text-[#A3A3A3] text-sm line-through">R$347/mês</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-display font-extrabold text-5xl gradient-text-fire">R${annual ? '122' : '197'}</span>
                <span className="text-[#A3A3A3] text-sm">/{annual ? 'mês no anual' : 'mês'}</span>
              </div>
              <div className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold text-[#0A0A0A]" style={{ background: 'linear-gradient(135deg, #F5C518, #E8A800)' }}>
                = R${annual ? '4,07' : '6,57'} por dia • menos que um café
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {[
                '2 canais do YouTube',
                '30 vídeos/mês (1/dia por canal)',
                'Vídeos até 60 minutos',
                'Narração Neural2 (todas as vozes)',
                '90 prompts Veo3 por vídeo',
                'DubSpy — scanner canais virais',
                'Análise de concorrentes',
                'Growth Tools completo',
                'Viral Database completa',
                'Estilo visual personalizado',
                'TubeBot ilimitado',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/90">
                  <span className="text-red-500 flex-shrink-0 mt-0.5">▶</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Bonuses */}
            <div className="border-t border-dashed border-white/10 pt-4 mb-6">
              <p className="text-xs text-[#A3A3A3] mb-3">Bônus exclusivos desta semana:</p>
              {[
                'Masterclass "Nicho Perfeito em 24h" (R$197) — GRÁTIS',
                'Template de Thumbnail que converte (R$97) — GRÁTIS',
                'Grupo VIP no WhatsApp com criadores — GRÁTIS',
              ].map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[#F5C518] mb-2">
                  <span>🎁</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe(annual ? 'creator_pro_yearly' : 'creator_pro_monthly')}
              className="w-full btn-youtube shimmer py-4 text-lg font-display font-bold"
            >
              ▶ Quero monetizar em 27 dias
            </button>
            <p className="text-center text-[11px] text-[#A3A3A3] mt-3">
              🔒 Garantia total de 7 dias — não gostou, devolvemos 100%
            </p>
            <p className="text-center text-[11px] text-[#A3A3A3] mt-1">Pix • Cartão • Boleto</p>
          </motion.div>

          {/* Studio plan */}
          <motion.div {...fadeUp(0.2)} className="glass-dark rounded-2xl p-6 h-full">
            <div className="mb-6">
              <h3 className="font-display font-bold text-xl text-white">Studio</h3>
              <p className="text-sm text-[#A3A3A3] mt-1">Para agências e criadores sérios</p>
            </div>
            <div className="mb-6">
              <span className="font-display font-bold text-4xl text-white">R${annual ? '215' : '347'}</span>
              <span className="text-[#A3A3A3] text-sm">/mês</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                '5 canais do YouTube',
                '90 vídeos/mês (3/dia)',
                'Vídeos até 60 minutos',
                'Tudo do Creator Pro',
                'Claude deep analysis (5x/mês)',
                'Weekly deep research (Brave + Perplexity)',
                'Multilíngue (8 idiomas)',
                'Suporte prioritário',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-[#A3A3A3]">
                  <Check size={14} className="text-[#22C55E] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(annual ? 'studio_yearly' : 'studio_monthly')}
              className="w-full py-3 rounded-xl border border-white/15 text-white text-sm font-medium hover:border-white/30 transition-colors"
            >
              Assinar Studio
            </button>
          </motion.div>
        </div>

        {/* Trust strip */}
        <motion.div {...fadeUp(0.3)} className="flex flex-wrap justify-center gap-6 md:gap-10 mt-12 text-[#A3A3A3] text-xs">
          <span className="flex items-center gap-1.5"><Shield size={14} /> Pagamento 100% seguro</span>
          <span className="flex items-center gap-1.5"><RotateCcw size={14} /> Garantia de 7 dias</span>
          <span className="flex items-center gap-1.5"><Star size={14} /> 4.9/5 em 847 avaliações</span>
          <span className="flex items-center gap-1.5">🇧🇷 Plataforma brasileira</span>
        </motion.div>
      </div>
    </section>
  );
};
