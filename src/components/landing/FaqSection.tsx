import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'Funciona mesmo para quem nunca gravou um vídeo?',
    a: 'Sim, e é exatamente para isso que o Monetiza27 foi criado. O plano começa do absoluto zero: escolha de nicho, nome do canal, configuração, SEO do perfil. Cada dia tem uma missão específica. Não existe "não saber por onde começar" usando nossa plataforma.',
  },
  {
    q: 'Posso ter um canal de sucesso sem aparecer na câmera?',
    a: 'Pode, e é uma das nossas especialidades. Nossa Narração IA gera voz profissional em português em segundos. Mais de 40% dos criadores monetizados no Monetiza27 têm canais 100% faceless — sem aparecer em nenhum momento.',
  },
  {
    q: 'Em 27 dias é possível mesmo ou é exagero?',
    a: '73% dos usuários do plano Pro que seguem o plano diário atingem os requisitos do YPP (1.000 inscritos + 4.000 horas) dentro de 27 dias. Os outros 27% levam entre 28 e 45 dias. O segredo é o nicho certo + consistência + roteiros que o algoritmo ama. Nossa IA faz os três.',
  },
  {
    q: 'O que acontece se eu não monetizar no prazo?',
    a: 'Você continua com acesso total à plataforma. Garantimos 7 dias de teste com devolução integral — sem perguntas. Depois disso, você continua até atingir o objetivo. Mas honestamente? A maioria das desistências acontece por não seguir o plano diário, não pelo prazo.',
  },
  {
    q: 'Por que R$47 e não R$0? Quais são os custos reais?',
    a: 'O plano gratuito existe e já entrega valor real. O Pro por R$47 é o custo de 2 roteiros freelancer (que valem R$50–R$100 cada) — mas você recebe 30 por mês, mais narração, mais análise de nicho, mais dashboard, mais suporte. O cálculo é simples: um único vídeo monetizado paga o plano inteiro.',
  },
  {
    q: 'Posso cancelar sem burocracia?',
    a: 'Um clique no painel, sem ligação, sem email, sem justificativa. E se cancelar durante os primeiros 7 dias, devolvemos 100% do valor pago. Sem letras miúdas.',
  },
];

export const FaqSection = () => (
  <section id="faq" className="py-20 md:py-28">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-red-500/10 text-red-400 border border-red-500/20 mb-6">
          TIRE SUAS DÚVIDAS
        </span>
        <h2 className="font-display font-bold text-3xl md:text-[44px] text-white leading-tight">
          Perguntas Frequentes sobre IA para YouTube
        </h2>
        <p className="text-[#A3A3A3] mt-4">
          Se ainda tiver dúvidas depois disso, nosso suporte responde em menos de 2 horas.
        </p>
      </motion.div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <AccordionItem value={`faq-${i}`} className="glass-dark rounded-xl border-none px-5">
              <AccordionTrigger className="text-left text-white font-medium text-[15px] hover:no-underline py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[#A3A3A3] text-sm leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </div>
  </section>
);
