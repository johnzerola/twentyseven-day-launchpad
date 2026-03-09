import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/i18n/LanguageContext';

export const FaqSection = () => {
  const { t } = useLanguage();
  const faqs = [1, 2, 3, 4];

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-center mb-12">{t('faq.title')}</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((n) => (
            <AccordionItem key={n} value={`faq-${n}`} className="glass rounded-xl px-6 border-0">
              <AccordionTrigger className="text-left font-medium hover:no-underline">{t(`faq.q${n}`)}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{t(`faq.a${n}`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
