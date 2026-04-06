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
            <svg width="20" height="14" viewBox="0 0 68 48" fill="none" className="opacity-60">
              <path d="M66.52 7.74C65.77 4.81 63.48 2.52 60.55 1.77C55.22 0.27 34 0.27 34 0.27S12.78 0.27 7.45 1.77C4.52 2.52 2.23 4.81 1.48 7.74C0 13.09 0 24.13 0 24.13S0 35.17 1.48 40.52C2.23 43.45 4.52 45.74 7.45 46.49C12.78 47.99 34 47.99 34 47.99S55.22 47.99 60.55 46.49C63.48 45.74 65.77 43.45 66.52 40.52C68 35.17 68 24.13 68 24.13S68 13.09 66.52 7.74Z" fill="hsl(0, 72%, 51%)"/>
              <path d="M27.16 34.33L44.84 24.13L27.16 13.93V34.33Z" fill="white"/>
            </svg>
            YouTube Partner
          </span>
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
            <span className="text-lg">💰</span>
            {pt ? '3.200+ monetizados' : '3,200+ monetized'}
          </span>
        </motion.div>
      </div>
    </section>
  );
};
