import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Bot, User, Send, Sparkles, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'channel_type' | 'channel_url' | 'niche' | 'time' | 'goal' | 'content_type' | 'language' | 'generating' | 'done';

interface Message {
  role: 'bot' | 'user';
  content: string;
}

const Onboarding = () => {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('channel_type');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: t('onboarding.welcome') + '\n\n' + t('onboarding.channel_type') },
  ]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const addMessage = (role: 'bot' | 'user', content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const handleChoice = (value: string) => {
    switch (step) {
      case 'channel_type':
        addMessage('user', value === 'new' ? t('onboarding.new') : t('onboarding.existing'));
        setAnswers((p) => ({ ...p, channelType: value }));
        if (value === 'existing') {
          addMessage('bot', t('onboarding.url'));
          setStep('channel_url');
        } else {
          addMessage('bot', 'Qual nicho você quer explorar? Ex: finanças, gaming, tecnologia, culinária...');
          setStep('niche');
        }
        break;
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage('user', input);
    const val = input.trim();
    setInput('');

    switch (step) {
      case 'channel_url':
        setAnswers((p) => ({ ...p, channelUrl: val }));
        addMessage('bot', t('onboarding.analyzing') + '\n\nQual nicho você quer explorar?');
        setStep('niche');
        break;
      case 'niche':
        setAnswers((p) => ({ ...p, niche: val }));
        addMessage('bot', 'Quantas horas por dia você pode dedicar ao canal?');
        setStep('time');
        break;
      case 'time':
        setAnswers((p) => ({ ...p, time: val }));
        addMessage('bot', 'Qual sua meta de ganhos mensais? Ex: R$ 1.000, $500...');
        setStep('goal');
        break;
      case 'goal':
        setAnswers((p) => ({ ...p, goal: val }));
        addMessage('bot', 'Que tipo de conteúdo quer criar?\n\n• Faceless (sem aparecer)\n• Narração com imagens\n• Vlogs / câmera\n• Compilações\n• Tutoriais');
        setStep('content_type');
        break;
      case 'content_type':
        setAnswers((p) => ({ ...p, contentType: val }));
        addMessage('bot', 'Em qual idioma vai publicar os vídeos?\n\n• Português\n• Inglês\n• Polonês\n• Alemão\n• Outro');
        setStep('language');
        break;
      case 'language':
        setAnswers((p) => ({ ...p, language: val }));
        addMessage('bot', '🎯 Perfeito! Analisando seus dados e gerando seu plano personalizado de 27 dias...\n\nIsso pode levar alguns segundos.');
        setStep('generating');
        // Simulate AI plan generation
        setTimeout(() => {
          const plan = generateMockPlan({ ...answers, language: val });
          addMessage('bot', plan);
          setStep('done');
        }, 3000);
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center glow-primary">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Onboarding IA</h1>
            <p className="text-sm text-muted-foreground">Plano de monetização em 27 dias</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 min-h-[500px] flex flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto mb-4 max-h-[500px]">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary/20 text-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {step === 'generating' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                Gerando plano...
              </div>
            )}
          </div>

          {/* Choice buttons */}
          {step === 'channel_type' && (
            <div className="flex gap-3">
              <Button onClick={() => handleChoice('new')} variant="outline" className="flex-1 gap-2">
                <Youtube className="w-4 h-4" /> {t('onboarding.new')}
              </Button>
              <Button onClick={() => handleChoice('existing')} variant="outline" className="flex-1 gap-2">
                <Youtube className="w-4 h-4" /> {t('onboarding.existing')}
              </Button>
            </div>
          )}

          {/* Text input */}
          {['channel_url', 'niche', 'time', 'goal', 'content_type', 'language'].includes(step) && (
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua resposta..."
                className="bg-secondary/50"
              />
              <Button onClick={handleSend} size="icon" className="gradient-hero border-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

function generateMockPlan(answers: Record<string, string>): string {
  const niche = answers.niche || 'seu nicho';
  return `# 🎯 Seu Plano de Monetização em 27 Dias

## Nicho: ${niche}
## Meta: ${answers.goal || 'Monetização'}

---

### 📅 Semana 1 — Fundação (Dias 1-7)
- **Dia 1**: Configurar canal, banner, foto, descrição otimizada
- **Dia 2**: Pesquisar 10 canais concorrentes no nicho "${niche}"
- **Dia 3**: Definir 5 palavras-chave principais (SEO)
- **Dia 4**: Criar primeiro roteiro usando ChannelHacker AI
- **Dia 5**: Gravar/produzir primeiro vídeo (+8 min)
- **Dia 6**: Criar thumbnail com CTR 30%+ e publicar
- **Dia 7**: Analisar métricas iniciais e ajustar

### 📅 Semana 2 — Aceleração (Dias 8-14)
- **Dia 8-9**: Publicar 2 vídeos (frequência 3x/semana)
- **Dia 10**: Criar Shorts a partir dos vídeos longos
- **Dia 11-12**: Publicar mais 2 vídeos + Shorts
- **Dia 13**: Analisar outliers do nicho para inspiração
- **Dia 14**: Review semanal e ajuste de estratégia

### 📅 Semana 3 — Crescimento (Dias 15-21)
- **Dia 15-17**: 3 vídeos de alta retenção (80%+)
- **Dia 18**: Colaboração ou resposta a vídeos trending
- **Dia 19-20**: Otimizar SEO de todos os vídeos
- **Dia 21**: Review e ajuste

### 📅 Semana 4 — Monetização (Dias 22-27)
- **Dia 22-24**: Publicar vídeos optimizados para watch time
- **Dia 25**: Aplicar para monetização (se elegível)
- **Dia 26**: Configurar links de afiliados e descrições
- **Dia 27**: Review final e plano de longo prazo

---

💰 **Estimativa de ganhos**: Com base em RPM médio do nicho "${niche}", seus primeiros 30 dias podem gerar entre R$ 50 - R$ 500 dependendo do tráfego.

✅ Seu plano foi salvo! Acesse a aba "Plano 27 Dias" para acompanhar.`;
}

export default Onboarding;
