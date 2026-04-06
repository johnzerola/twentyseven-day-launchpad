import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const faqs = {
  pt: [
    { q: 'Funciona mesmo que eu nunca tenha gravado um vídeo antes?', a: 'Sim. O plano de 27 dias foi projetado do zero para iniciantes. Você receberá uma missão por dia — sem jargões, sem suposições. Se você sabe usar um smartphone, consegue seguir o plano.' },
    { q: 'E se eu não aparecer nos vídeos? Posso usar a narração IA?', a: 'Pode. Nosso módulo de Narração IA gera voz em português com qualidade profissional. Centenas de canais faceless (sem rosto) monetizaram usando só nossa plataforma.' },
    { q: 'Em 27 dias realmente dá para monetizar?', a: 'Nossa taxa de monetização em 27 dias é de 73% entre usuários do plano Pro que seguem o plano diário. O segredo é o nicho certo + consistência + roteiros otimizados para o algoritmo. Fazemos os 3.' },
    { q: 'O que acontece se eu não monetizar em 27 dias?', a: 'Você continua usando a plataforma. O plano se renova automaticamente até você atingir o objetivo. E nossa garantia de 7 dias garante que você não perde nada ao testar.' },
    { q: 'Isso funciona para qualquer nicho?', a: 'Nossa IA foi treinada em 50+ nichos do YouTube brasileiro. Finance, tech, lifestyle, culinária, fitness, games — nossa busca de nicho mostrará exatamente qual sub-nicho tem menor competição e maior RPM.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim, sem burocracia. Cancele em 1 clique no painel. Sem ligação, sem email, sem justificativa.' },
  ],
  en: [
    { q: 'Does it work even if I\'ve never recorded a video?', a: 'Yes. The 27-day plan was designed from scratch for beginners. You\'ll receive one mission per day — no jargon, no assumptions. If you can use a smartphone, you can follow the plan.' },
    { q: 'What if I don\'t show my face? Can I use AI narration?', a: 'Yes. Our AI Narration module generates professional-quality voice. Hundreds of faceless channels monetized using only our platform.' },
    { q: 'Can you really monetize in 27 days?', a: 'Our 27-day monetization rate is 73% among Pro plan users who follow the daily plan. The secret is the right niche + consistency + algorithm-optimized scripts. We handle all 3.' },
    { q: 'What if I don\'t monetize in 27 days?', a: 'You keep using the platform. The plan auto-renews until you reach your goal. And our 7-day guarantee means you risk nothing testing it.' },
    { q: 'Does this work for any niche?', a: 'Our AI was trained on 50+ YouTube niches. Finance, tech, lifestyle, cooking, fitness, games — our niche search will show exactly which sub-niche has least competition and highest RPM.' },
    { q: 'Can I cancel anytime?', a: 'Yes, no strings attached. Cancel in 1 click from your dashboard. No calls, no emails, no justification needed.' },
  ],
};

export const FaqSection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';
  const items = pt ? faqs.pt : faqs.en;

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-accent font-semibold text-sm mb-3 tracking-wider uppercase">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display">
            {pt ? 'Perguntas Frequentes' : 'Frequently Asked Questions'}
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {items.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <AccordionItem value={`faq-${i}`} className="glass-premium rounded-xl px-6 border-0">
                <AccordionTrigger className="text-left font-medium hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
