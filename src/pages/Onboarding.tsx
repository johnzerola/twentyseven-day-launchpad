import { useState, useRef, useEffect } from 'react';

const useNoIndex = () => {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
};
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Bot, User, Send, Sparkles, Youtube, ArrowRight } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { formatNumber } from '@/lib/formatters';

type Step = 'channel_type' | 'channel_url' | 'analyzing' | 'analysis_done' | 'niche' | 'time' | 'goal' | 'content_type' | 'language' | 'generating' | 'done';

interface Message {
  role: 'bot' | 'user';
  content: string;
}

const Onboarding = () => {
  useNoIndex();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('channel_type');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: t('onboarding.welcome') + '\n\n' + t('onboarding.channel_type') },
  ]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [channelAnalysis, setChannelAnalysis] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'bot' | 'user', content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const analyzeChannel = async (channelInput: string) => {
    setStep('analyzing');
    addMessage('bot', '🔍 Analisando seu canal com IA... Isso pode levar alguns segundos.');

    try {
      const authH = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-channel`, {
        method: 'POST',
        headers: authH,
        body: JSON.stringify({ channelInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na análise');

      setChannelAnalysis(data);
      setAnswers((p) => ({ ...p, channelUrl: channelInput, channelId: data.channel.id }));

      // Format analysis as readable message
      const a = data.analysis;
      const analysisMsg = `## 📊 Análise do Canal: ${data.channel.name}

**👥 Inscritos:** ${formatNumber(data.channel.subscribers)}
**👁️ Views totais:** ${formatNumber(data.channel.views)}
**🎬 Vídeos:** ${data.channel.videos}
**📊 Média de views recentes:** ${formatNumber(data.avgRecentViews)}

---

### 🎯 Scores
- **SEO:** ${a.seo_score}/100
- **Qualidade dos títulos:** ${a.title_quality_score}/100
- **Nicho detectado:** ${a.niche_detected}
- **Fit do nicho:** ${a.niche_fit_score}/100
- **Prontidão para monetização:** ${a.monetization_readiness}/100

### ✅ Pontos fortes
${a.strengths?.map((s: string) => `- ${s}`).join('\n') || 'N/A'}

### ⚠️ Pontos a melhorar
${a.weaknesses?.map((w: string) => `- ${w}`).join('\n') || 'N/A'}

### 🔧 Melhorias de SEO
${a.seo_improvements?.map((s: string) => `- ${s}`).join('\n') || 'N/A'}

### 📝 Melhorias de títulos
${a.title_improvements?.map((t: string) => `- ${t}`).join('\n') || 'N/A'}

### 🖼️ Sugestões de thumbnails
${a.thumbnail_suggestions?.map((t: string) => `- ${t}`).join('\n') || 'N/A'}

### 💡 Nichos similares (sem perder público)
${a.niche_change_suggestions?.map((n: any) => `- **${n.niche}**: ${n.reason} (Retenção: ${n.audience_retention_estimate})`).join('\n') || 'Nenhuma sugestão'}

### 💰 Estimativas
- **RPM estimado:** $${a.estimated_rpm}
- **Receita mensal estimada:** ${a.estimated_monthly_revenue}
- **Estratégia:** ${a.content_strategy}

---

${a.growth_potential}`;

      addMessage('bot', analysisMsg);
      addMessage('bot', 'Agora me conte: qual nicho você quer focar? Pode manter o atual ou mudar. Ex: finanças, gaming, tecnologia, curiosidades...');
      setStep('niche');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao analisar canal');
      addMessage('bot', '❌ Não consegui analisar o canal. Verifique a URL e tente novamente, ou diga qual nicho deseja explorar.');
      setStep('niche');
    }
  };

  const generatePlan = async (allAnswers: Record<string, string>) => {
    setStep('generating');
    addMessage('bot', '🎯 Gerando seu plano personalizado de 27 dias com IA... Isso pode levar até 30 segundos.');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const authH2 = await getAuthHeaders();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-adaptive-plan`, {
        method: 'POST',
        headers: authH2,
        body: JSON.stringify({
          answers: allAnswers,
          channelAnalysis: channelAnalysis?.analysis,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar plano');

      // Save to DB if user is logged in
      if (user) {
        // Save channel if existing
        if (channelAnalysis?.channel) {
          const ch = channelAnalysis.channel;
          await supabase.from('user_channels').upsert({
            user_id: user.id,
            youtube_channel_id: ch.id,
            channel_name: ch.name,
            thumbnail: ch.thumbnail,
            subscribers: ch.subscribers,
            views: ch.views,
            videos: ch.videos,
            niche: allAnswers.niche,
            analysis_json: channelAnalysis.analysis,
          } as any, { onConflict: 'user_id,youtube_channel_id' }).select();
        }

      // Save plan
        await supabase.from('onboarding_plans').insert({
          user_id: user.id,
          niche: allAnswers.niche,
          goal: allAnswers.goal,
          content_type: allAnswers.contentType,
          language: allAnswers.language,
          time_per_day: allAnswers.time,
          plan_json: data.plan,
          channel_analysis_json: channelAnalysis?.analysis || null,
        } as any);

        // ═══ SMART ONBOARDING: Auto-populate initial data ═══
        try {
          const onboardHeaders = await getAuthHeaders();
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-onboarding`, {
            method: 'POST',
            headers: onboardHeaders,
            body: JSON.stringify({
              userId: user.id,
              niche: allAnswers.niche,
              language: allAnswers.language,
              contentType: allAnswers.contentType,
              channelId: allAnswers.channelId,
              goal: allAnswers.goal,
            }),
          }).catch(() => {}); // Fire & forget — non-blocking
        } catch { /* non-blocking */ }
      }

      // Show plan summary
      const plan = data.plan;
      const planMsg = `# 🎯 ${plan.title || 'Seu Plano de Monetização em 27 Dias'}

**Nicho:** ${plan.niche}
**Receita estimada (30 dias):** ${plan.estimated_revenue_30d}
**Inscritos estimados (30 dias):** ${plan.estimated_subs_30d}
**RPM estimado:** $${plan.rpm_estimate}

---

${plan.summary}

### 📅 Metas semanais
${plan.weekly_goals?.map((w: any) => `- **Semana ${w.week}:** ${w.goal} (${w.videos_target} vídeos)`).join('\n') || ''}

### 🎯 Pilares de conteúdo
${plan.content_pillars?.map((p: string) => `- ${p}`).join('\n') || ''}

### 🔑 Palavras-chave SEO
${plan.seo_keywords?.map((k: string) => `\`${k}\``).join(' • ') || ''}

### 💰 Caminho de monetização
${plan.monetization_path}

---

✅ **Seu plano foi salvo!** Acesse a aba "Plano 27 Dias" para acompanhar dia a dia.`;

      addMessage('bot', planMsg);
      setStep('done');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar plano');
      addMessage('bot', '❌ Erro ao gerar o plano. Tente novamente.');
      setStep('language');
    }
  };

  const handleChoice = (value: string) => {
    if (step === 'channel_type') {
      addMessage('user', value === 'new' ? t('onboarding.new') : t('onboarding.existing'));
      setAnswers((p) => ({ ...p, channelType: value }));
      if (value === 'existing') {
        addMessage('bot', t('onboarding.url'));
        setStep('channel_url');
      } else {
        addMessage('bot', 'Qual nicho você quer explorar? Ex: finanças, gaming, tecnologia, culinária, curiosidades, histórias emocionantes...');
        setStep('niche');
      }
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage('user', input);
    const val = input.trim();
    setInput('');

    switch (step) {
      case 'channel_url':
        analyzeChannel(val);
        break;
      case 'niche':
        setAnswers((p) => ({ ...p, niche: val }));
        addMessage('bot', 'Quantas horas por dia você pode dedicar ao canal?\n\nEx: 1 hora, 2-3 horas, tempo integral...');
        setStep('time');
        break;
      case 'time':
        setAnswers((p) => ({ ...p, time: val }));
        addMessage('bot', 'Qual sua meta de ganhos mensais?\n\nEx: R$ 1.000, R$ 5.000, $500, 2000 zł...');
        setStep('goal');
        break;
      case 'goal':
        setAnswers((p) => ({ ...p, goal: val }));
        addMessage('bot', 'Que tipo de conteúdo quer criar?\n\n• **Faceless** (sem aparecer)\n• **Narração** com imagens/vídeos\n• **Vlogs / câmera**\n• **Compilações**\n• **Tutoriais**\n• **Storytelling / Histórias**');
        setStep('content_type');
        break;
      case 'content_type':
        setAnswers((p) => ({ ...p, contentType: val }));
        addMessage('bot', 'Em qual idioma vai publicar os vídeos?\n\n• Português\n• Inglês\n• Polonês\n• Alemão\n• Outro (diga qual)');
        setStep('language');
        break;
      case 'language': {
        const finalAnswers = { ...answers, language: val };
        setAnswers(finalAnswers);
        generatePlan(finalAnswers);
        break;
      }
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
          <div ref={chatRef} className="flex-1 space-y-4 overflow-y-auto mb-4 max-h-[600px] pr-2">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary/20 text-foreground'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    <div className="prose prose-sm prose-invert max-w-none [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {(step === 'analyzing' || step === 'generating') && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-11">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                {step === 'analyzing' ? 'Analisando canal...' : 'Gerando plano personalizado...'}
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

          {/* Done actions */}
          {step === 'done' && (
            <div className="flex gap-3">
              <Button onClick={() => navigate('/dashboard')} className="flex-1 gradient-hero border-0 gap-2">
                <ArrowRight className="w-4 h-4" /> Ir para o Dashboard
              </Button>
              <Button onClick={() => navigate('/scripts')} variant="outline" className="flex-1 gap-2">
                Gerar Roteiro
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Onboarding;
