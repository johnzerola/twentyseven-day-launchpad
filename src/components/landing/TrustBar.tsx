import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';

export const TrustBar = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';

  return (
    <section className="py-8 border-y border-border/30">
      <div className="max-w-5xl mx-auto px-4">
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <span className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            SSL {pt ? 'Seguro' : 'Secure'}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-lg">💳</span>
            Visa · Mastercard · Pix
          </span>
          <span className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            {pt ? 'Garantia 7 dias' : '7-day guarantee'}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            {pt ? '3.200+ criadores' : '3,200+ creators'}
          </span>
          <span className="flex items-center gap-2">
            <span className="text-lg">🇧🇷</span>
            {pt ? 'Feito no Brasil' : 'Made in Brazil'}
          </span>
        </motion.div>
      </div>
    </section>
  );
};
