import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const GuaranteeSection = () => {
  const { locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';

  return (
    <section className="py-24 relative overflow-hidden aurora-bg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="glass-premium rounded-3xl p-10 md:p-14 text-center relative"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Shield icon */}
          <motion.div
            className="w-20 h-20 rounded-full gradient-hero mx-auto mb-6 flex items-center justify-center glow-primary"
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Shield className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">
            {isPortuguese
              ? '7 Dias de Garantia Total'
              : '7-Day Money-Back Guarantee'}
          </h2>
          <p className="text-lg text-muted-foreground mb-4 max-w-xl mx-auto leading-relaxed">
            {isPortuguese
              ? 'Se nos primeiros 7 dias você não sentir que o Monetize AI está transformando seu canal, devolvemos 100% do seu investimento. Sem perguntas, sem burocracia.'
              : "If in the first 7 days you don't feel Monetize AI is transforming your channel, we refund 100% of your investment. No questions asked."}
          </p>
          <p className="text-sm text-primary font-semibold mb-8">
            {isPortuguese
              ? '→ Risco ZERO para você. O risco é todo nosso.'
              : '→ ZERO risk for you. The risk is entirely ours.'}
          </p>

          <Link to="/login">
            <Button size="lg" className="gradient-hero border-0 pulse-glow shimmer text-lg px-10 py-7 font-semibold group">
              {isPortuguese ? 'Começar Agora — Sem Risco' : 'Start Now — Risk Free'}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
