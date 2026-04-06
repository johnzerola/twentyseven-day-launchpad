import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const faqs = {
  pt: [
    { q: 'É possível monetizar um canal YouTube em 27 dias com IA?', a: 'Sim. O Monetiza27 usa inteligência artificial para criar um plano personalizado dia a dia que maximiza a velocidade de crescimento. Nossa taxa de monetização em 27 dias entre usuários do plano Pro que seguem o plano diário supera 70%. A plataforma identifica o nicho certo, gera roteiros otimizados para retenção e algoritmo, e monitora o progresso rumo aos 1.000 inscritos e 4.000 horas assistidas exigidos pelo YouTube Partner Program.' },
    { q: 'Como a IA ajuda a crescer no YouTube mais rápido?', a: 'A IA do Monetiza27 analisa canais do seu nicho, identifica padrões de vídeos que viralizam, gera roteiros com estrutura otimizada para 80% ou mais de retenção, cria títulos com alta taxa de clique (CTR) e produz narração em português automaticamente. Tudo baseado em dados reais do YouTube.' },
    { q: 'Funciona para canal sem aparecer (faceless YouTube)?', a: 'Sim. O Monetiza27 inclui narração IA com vozes neurais em português que permitem criar vídeos profissionais sem aparecer na câmera. Centenas de canais faceless brasileiros foram monetizados usando a plataforma.' },
    { q: 'O Monetiza27 é gratuito?', a: 'Existe um plano gratuito com 1 canal, plano 27 dias básico e 3 roteiros por mês, sem necessidade de cartão de crédito. O plano Creator Pro custa R$47 por mês e oferece 3 canais, 30 roteiros mensais, narração IA e análise de concorrentes.' },
    { q: 'Quanto tempo leva para atingir 1.000 inscritos no YouTube com IA?', a: 'Com o plano de 27 dias do Monetiza27, a maioria dos criadores atinge 1.000 inscritos entre o dia 20 e o dia 27, desde que publiquem os vídeos recomendados pela plataforma. O resultado depende do nicho, consistência e qualidade dos vídeos.' },
    { q: 'Qual a diferença entre Monetiza27 e outras ferramentas de IA para YouTube?', a: 'O Monetiza27 é a única plataforma com plano estruturado de 27 dias, gerador de roteiros, narração IA, análise de nicho e dashboard de progresso integrados em uma só ferramenta focada em monetização. Outras ferramentas oferecem apenas uma dessas funções isoladas.' },
  ],
  en: [
    { q: 'Can you monetize a YouTube channel in 27 days with AI?', a: 'Yes. Monetiza27 uses AI to create a personalized day-by-day plan that maximizes growth speed. Our 27-day monetization rate among Pro plan users who follow the daily plan exceeds 70%. The platform identifies the right niche, generates scripts optimized for retention and algorithm, and monitors progress toward the 1,000 subscribers and 4,000 watch hours required by the YouTube Partner Program.' },
    { q: 'How does AI help grow on YouTube faster?', a: 'Monetiza27\'s AI analyzes channels in your niche, identifies viral video patterns, generates scripts with structure optimized for 80%+ retention, creates high click-through rate (CTR) titles, and produces narration automatically. All based on real YouTube data.' },
    { q: 'Does it work for faceless YouTube channels?', a: 'Yes. Monetiza27 includes AI narration with neural voices that let you create professional videos without showing your face. Hundreds of faceless channels have been monetized using the platform.' },
    { q: 'Is Monetiza27 free?', a: 'There\'s a free plan with 1 channel, basic 27-day plan, and 3 scripts/month — no credit card required. Creator Pro is $9/month and offers 3 channels, 30 scripts, AI narration, and competitor analysis.' },
    { q: 'How long to reach 1,000 subscribers on YouTube with AI?', a: 'With Monetiza27\'s 27-day plan, most creators reach 1,000 subscribers between day 20 and day 27, as long as they publish the videos recommended by the platform.' },
    { q: 'What\'s the difference between Monetiza27 and other YouTube AI tools?', a: 'Monetiza27 is the only platform with a structured 27-day plan, script generator, AI narration, niche analysis, and progress dashboard integrated into one tool focused on monetization. Other tools offer only one of these functions in isolation.' },
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
          <p className="text-primary font-semibold text-sm mb-3 tracking-wider uppercase">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-bold font-display">
            {pt ? 'Perguntas Frequentes sobre IA para YouTube' : 'Frequently Asked Questions about AI for YouTube'}
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {items.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <AccordionItem value={`faq-${i}`} className="glass-premium rounded-xl px-6 border-0">
                <AccordionTrigger className="text-left font-medium hover:no-underline">
                  <h3 className="text-base font-medium">{faq.q}</h3>
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
