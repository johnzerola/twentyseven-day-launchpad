import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/i18n/LanguageContext';
import { HelpCircle, Shield, Clock, CreditCard, Video, Zap, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const faqIcons = [Video, Video, Clock, CreditCard, Shield, Users, Zap];

export const FaqSection = () => {
  const { t, locale } = useLanguage();
  const isPortuguese = locale === 'pt-BR';
  const faqs = [1, 2, 3, 4, 5, 6, 7];

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">
            {isPortuguese ? 'Tire suas dúvidas' : 'Got questions?'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-4">{t('faq.title')}</h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((n, i) => {
            const Icon = faqIcons[i] || HelpCircle;
            return (
              <motion.div
                key={n}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <AccordionItem value={`faq-${n}`} className="glass-premium rounded-xl px-6 border-0">
                  <AccordionTrigger className="text-left font-medium hover:no-underline gap-3">
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                      {t(`faq.q${n}`)}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pl-7">
                    {t(`faq.a${n}`)}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
};
