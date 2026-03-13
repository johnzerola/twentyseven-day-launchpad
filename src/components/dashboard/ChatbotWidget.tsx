import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Loader2, Trash2, HelpCircle, ArrowRight, SkipForward, ImagePlus, Youtube, Save, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAuthHeaders } from '@/lib/auth-fetch';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

type OnboardingStep = 'idle' | 'welcome' | 'has_channel' | 'channel_link' | 'no_channel_hours' | 'no_channel_languages' | 'no_channel_niche' | 'no_channel_budget' | 'preference' | 'generating_plan' | 'plan_ready' | 'follow_up';

interface OnboardingState {
  step: OnboardingStep;
  hasChannel?: boolean;
  channelLink?: string;
  hoursPerDay?: string;
  languages?: string;
  niche?: string;
  budget?: string;
  preference?: string;
}

const QUICK_ACTIONS = [
  { emoji: '💡', label: 'Ideias de vídeo', message: 'Me sugira 5 ideias de vídeo viral para o meu nicho' },
  { emoji: '✍️', label: 'Dicas de roteiro', message: 'Quais técnicas de hook e retenção devo usar nos meus roteiros? Use dados do banco de conhecimento.' },
  { emoji: '🏷️', label: 'Título viral', message: 'Como criar títulos com alto CTR? Me dê fórmulas e exemplos do banco de títulos virais' },
  { emoji: '💰', label: 'Monetização', message: 'Como monetizar meu canal o mais rápido possível? Quero um plano realista com dados' },
  { emoji: '📊', label: 'Analisar nicho', message: 'Quais são os melhores nichos para começar hoje? Me mostre dados reais de RPM e saturação' },
  { emoji: '🧠', label: 'Algoritmo YouTube', message: 'Me explique como o algoritmo do YouTube funciona em 2025-2026 com dados dos estudos que você tem acesso' },
];

const PAGE_TOOLTIPS: Record<string, { title: string; desc: string }> = {
  '/dashboard': { title: 'Dashboard', desc: 'Visão geral do seu progresso, métricas e próximas ações inteligentes.' },
  '/search': { title: 'DubSpy', desc: 'Encontra canais que estão crescendo. Use filtros MÍN/MÁX para achar canais que você pode replicar.' },
  '/branding': { title: 'Growth Center', desc: 'Gere branding, nomes de canal e projeções de receita baseadas em nichos reais.' },
  '/niches': { title: 'Niche Explorer', desc: 'Analise nichos com dados reais de RPM, saturação e dificuldade. Encontre oportunidades.' },
  '/scripts': { title: 'Roteiros', desc: 'Gere roteiros virais com IA de nível profissional. Pipeline de 4 fases com fact-check.' },
  '/titles': { title: 'Títulos Virais', desc: 'Gere e teste títulos para máximo CTR. Compare A/B e veja padrões que funcionam.' },
  '/viral-db': { title: 'Viral Database', desc: 'Banco com 900+ títulos virais reais. Descubra padrões, hooks e gatilhos emocionais.' },
  '/workflow': { title: 'Workflow', desc: 'Organize projetos no Kanban. Gerencie do roteiro até a publicação.' },
  '/multichannel': { title: 'Multichannel', desc: 'Gerencie 50+ canais com filas de conteúdo, templates e rollouts por país.' },
  '/channels': { title: 'Meus Canais', desc: 'Vincule canais do YouTube, veja análises e acompanhe concorrentes.' },
};

export { PAGE_TOOLTIPS };

export const ChatbotWidget = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({ step: 'idle' });
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulseVisible, setPulseVisible] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedConversations, setSavedConversations] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [proactiveNudge, setProactiveNudge] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const lastActivity = useRef<number>(Date.now());

  // Proactive nudge system — detect 2+ min idle
  useEffect(() => {
    const NUDGE_MESSAGES: Record<string, string> = {
      '/dashboard': '💡 Dica: verifique as tendências do seu nicho hoje! Posso ajudar.',
      '/scripts': '✍️ Precisa de ajuda com o roteiro? Posso sugerir hooks de alta retenção.',
      '/titles': '🏷️ Quer que eu analise seus títulos? Tenho dados de 900+ títulos virais.',
      '/search': '🔍 Encontrou algo interessante? Posso fazer engenharia reversa de qualquer canal.',
      '/niches': '📊 Indeciso sobre o nicho? Me pergunte — tenho dados de RPM e saturação.',
      '/workflow': '📋 Seu pipeline está atualizado? Posso sugerir prioridades.',
    };

    const resetIdle = () => {
      lastActivity.current = Date.now();
      setProactiveNudge(null);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (!open) {
        idleTimer.current = setTimeout(() => {
          const nudge = NUDGE_MESSAGES[location.pathname];
          if (nudge) setProactiveNudge(nudge);
        }, 120_000); // 2 minutes
      }
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('click', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('click', resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [location.pathname, open]);
  // Get user and check onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      // Load most recent conversation
      const { data: recentConvo } = await supabase
        .from('chat_conversations')
        .select('id, messages, title')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      const { data: plans } = await supabase
        .from('onboarding_plans')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      if (plans && plans.length > 0) {
        setHasSeenOnboarding(true);
        setOnboarding({ step: 'idle' });
        
        if (recentConvo && recentConvo.length > 0 && Array.isArray(recentConvo[0].messages) && recentConvo[0].messages.length > 1) {
          // Restore last conversation
          setConversationId(recentConvo[0].id);
          setMessages(recentConvo[0].messages as unknown as Msg[]);
        } else {
          setMessages([
            { role: 'assistant', content: '👋 Olá! Sou o **Dotti**, seu consultor estratégico de YouTube.\n\nTenho acesso a **bases de conhecimento** com dados reais sobre algoritmo, roteiros, hooks, nichos e canais.\n\nPosso ajudar com **ideias**, **roteiros**, **títulos**, **monetização**, **algoritmo** e muito mais.\n\nO que você precisa?' },
          ]);
        }
      } else {
        setOnboarding({ step: 'welcome' });
        setMessages([
          { role: 'assistant', content: '🤖 **Precisa de ajuda?**\n\nQuer que eu te guie? Posso **analisar seu canal**, encontrar **nichos lucrativos** e montar um **plano para monetizar em 30 dias**.\n\nPode pular o tutorial e voltar depois.' },
        ]);
      }
    };
    checkOnboarding();
  }, []);

  // Auto-save conversation
  const saveConversation = useCallback(async (msgs: Msg[]) => {
    if (!userId || msgs.length < 2) return;
    
    // Generate title from first user message
    const firstUserMsg = msgs.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : 'Nova conversa';
    
    try {
      if (conversationId) {
        await supabase
          .from('chat_conversations')
          .update({ messages: msgs as any, title, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      } else {
        const { data } = await supabase
          .from('chat_conversations')
          .insert({ user_id: userId, messages: msgs as any, title })
          .select('id')
          .single();
        if (data) setConversationId(data.id);
      }
    } catch (err) {
      console.error('Failed to save conversation:', err);
    }
  }, [userId, conversationId]);

  // Debounced auto-save after each assistant response
  useEffect(() => {
    if (messages.length >= 2 && !loading) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveConversation(messages), 2000);
    }
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [messages, loading, saveConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadHistory = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('chat_conversations')
      .select('id, title, updated_at, messages')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20);
    setSavedConversations(data || []);
    setShowHistory(true);
  };

  const loadConversation = (convo: any) => {
    setConversationId(convo.id);
    setMessages(convo.messages as unknown as Msg[]);
    setShowHistory(false);
    setOnboarding({ step: 'idle' });
  };

  const startNewConversation = () => {
    setConversationId(null);
    setMessages([
      { role: 'assistant', content: '👋 Nova conversa! Como posso ajudar?\n\nTenho acesso a bases de conhecimento com **algoritmo YouTube**, **técnicas de roteiro**, **hooks virais**, **psicologia de audiência** e muito mais.' },
    ]);
    setShowHistory(false);
    setOnboarding({ step: 'idle' });
  };

  const addAssistantMsg = (content: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content }]);
  };

  const addUserMsg = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);
  };

  // ===== Onboarding flow handlers =====
  const handleOnboardingChoice = useCallback(async (choice: string) => {
    const { step } = onboarding;

    if (step === 'welcome') {
      if (choice === 'help') {
        addUserMsg('Quero ajuda');
        addAssistantMsg('🎯 Ótimo! Vamos começar.\n\n**Você já tem um canal no YouTube?**');
        setOnboarding(prev => ({ ...prev, step: 'has_channel' }));
      } else {
        addUserMsg('Pular');
        addAssistantMsg('Sem problemas! Estou aqui sempre que precisar. 😉\n\nUse os botões abaixo para tirar dúvidas rápidas.');
        setOnboarding({ step: 'idle' });
        setHasSeenOnboarding(true);
      }
      return;
    }

    if (step === 'has_channel') {
      if (choice === 'yes') {
        addUserMsg('Sim, já tenho canal');
        addAssistantMsg('📺 Perfeito! Cole o **link ou nome do seu canal** abaixo para eu analisar.');
        setOnboarding(prev => ({ ...prev, step: 'channel_link', hasChannel: true }));
      } else {
        addUserMsg('Não, ainda não tenho');
        addAssistantMsg('Sem problema! Vamos criar do zero. 💪\n\n**Quantas horas por dia** você pode dedicar ao canal?\n\n_(Ex: 1h, 2h, 4h+)_');
        setOnboarding(prev => ({ ...prev, step: 'no_channel_hours', hasChannel: false }));
      }
      return;
    }

    if (step === 'no_channel_budget') {
      addUserMsg(choice === 'low' ? 'Baixo (quase zero)' : choice === 'medium' ? 'Médio (~$50-100/mês)' : 'Alto ($200+/mês)');
      setOnboarding(prev => ({ ...prev, budget: choice, step: 'preference' }));
      addAssistantMsg('🎯 Última pergunta:\n\n**Você prefere fazer o que ama ou priorizar o que monetiza?**');
      return;
    }

    if (step === 'preference') {
      const labels: Record<string, string> = {
        passion: 'Fazer o que amo',
        money: 'Priorizar monetização',
        both: 'Tentar unir ambos'
      };
      addUserMsg(labels[choice] || choice);
      setOnboarding(prev => ({ ...prev, preference: choice, step: 'generating_plan' }));
      addAssistantMsg('⏳ **Gerando seu plano personalizado...**\n\nEstou analisando os melhores nichos, estratégias e criando um roadmap de 30 dias só para você.');
      
      await generatePlan({ ...onboarding, preference: choice });
      return;
    }
  }, [onboarding]);

  const handleOnboardingInput = useCallback(async (text: string) => {
    const { step } = onboarding;

    if (step === 'channel_link') {
      addUserMsg(text);
      setOnboarding(prev => ({ ...prev, channelLink: text, step: 'generating_plan' }));
      addAssistantMsg('⏳ **Analisando seu canal e gerando plano personalizado...**\n\nVou verificar seus vídeos, nicho e criar um roadmap de 30 dias otimizado.');
      await generatePlan({ ...onboarding, channelLink: text });
      return true;
    }

    if (step === 'no_channel_hours') {
      addUserMsg(text);
      addAssistantMsg('🌍 **Quais idiomas** você quer criar conteúdo?\n\n_(Ex: português, inglês, espanhol)_');
      setOnboarding(prev => ({ ...prev, hoursPerDay: text, step: 'no_channel_languages' }));
      return true;
    }

    if (step === 'no_channel_languages') {
      addUserMsg(text);
      addAssistantMsg('🎯 **Qual nicho te interessa?**\n\n_(Ex: histórias, finanças, curiosidades, tecnologia, horror, mitologia)_');
      setOnboarding(prev => ({ ...prev, languages: text, step: 'no_channel_niche' }));
      return true;
    }

    if (step === 'no_channel_niche') {
      addUserMsg(text);
      addAssistantMsg('💰 **Qual sua tolerância para investir?**');
      setOnboarding(prev => ({ ...prev, niche: text, step: 'no_channel_budget' }));
      return true;
    }

    return false;
  }, [onboarding]);

  const generatePlan = async (state: OnboardingState) => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [{ role: 'user', content: `MODO ONBOARDING: Gere um plano personalizado de 30 dias.
Dados do usuário:
- Tem canal: ${state.hasChannel ? 'Sim' : 'Não'}
${state.channelLink ? `- Canal: ${state.channelLink}` : ''}
${state.hoursPerDay ? `- Horas por dia: ${state.hoursPerDay}` : ''}
${state.languages ? `- Idiomas: ${state.languages}` : ''}
${state.niche ? `- Nicho interesse: ${state.niche}` : ''}
${state.budget ? `- Investimento: ${state.budget}` : ''}
${state.preference ? `- Preferência: ${state.preference}` : ''}` }],
          currentPage: location.pathname,
          mode: 'onboarding',
          onboardingData: state,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && last.content.startsWith('⏳')) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                if (last?.role === 'assistant' && !last.content.startsWith('⏳') && prev.length > 2) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      setOnboarding(prev => ({ ...prev, step: 'plan_ready' }));
      setHasSeenOnboarding(true);
    } catch {
      addAssistantMsg('❌ Ocorreu um erro ao gerar o plano. Tente novamente.');
      setOnboarding(prev => ({ ...prev, step: 'idle' }));
    } finally {
      setLoading(false);
    }
  };

  // ===== Regular chat =====
  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    if (onboarding.step !== 'idle' && onboarding.step !== 'plan_ready') {
      const handled = await handleOnboardingInput(msg);
      if (handled) {
        setInput('');
        return;
      }
    }

    const userMsg: Msg = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const authHeaders2 = await getAuthHeaders();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: authHeaders2,
        body: JSON.stringify({
          messages: newMessages.filter((_, i) => i > 0),
          currentPage: location.pathname,
          conversationId,
        }),
      });

      if (resp.status === 429) {
        addAssistantMsg('⏳ Rate limit atingido. Tente novamente em alguns segundos.');
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        addAssistantMsg('💳 Créditos esgotados. Adicione créditos ao workspace.');
        setLoading(false);
        return;
      }

      if (!resp.ok || !resp.body) throw new Error('Erro');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > newMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch {
      addAssistantMsg('Desculpe, ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    startNewConversation();
  };

  const showQuickActions = onboarding.step === 'idle' && messages.length <= 1;
  const isOnboardingActive = onboarding.step !== 'idle' && onboarding.step !== 'plan_ready';

  // ===== Onboarding buttons renderer =====
  const renderOnboardingButtons = () => {
    const { step } = onboarding;

    if (step === 'welcome') {
      return (
        <div className="flex gap-2 px-4 pb-2">
          <Button size="sm" className="flex-1 gradient-hero border-0 text-primary-foreground" onClick={() => handleOnboardingChoice('help')}>
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Quero ajuda
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleOnboardingChoice('skip')}>
            <SkipForward className="w-3.5 h-3.5 mr-1.5" /> Pular
          </Button>
        </div>
      );
    }

    if (step === 'has_channel') {
      return (
        <div className="flex gap-2 px-4 pb-2">
          <Button size="sm" className="flex-1 gradient-hero border-0 text-primary-foreground" onClick={() => handleOnboardingChoice('yes')}>
            <Youtube className="w-3.5 h-3.5 mr-1.5" /> Sim, já tenho
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleOnboardingChoice('no')}>
            Não, quero criar
          </Button>
        </div>
      );
    }

    if (step === 'no_channel_budget') {
      return (
        <div className="flex gap-2 px-4 pb-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleOnboardingChoice('low')}>
            Baixo (~$0)
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleOnboardingChoice('medium')}>
            Médio (~$50)
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleOnboardingChoice('high')}>
            Alto ($200+)
          </Button>
        </div>
      );
    }

    if (step === 'preference') {
      return (
        <div className="flex flex-col gap-1.5 px-4 pb-2">
          <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={() => handleOnboardingChoice('passion')}>
            ❤️ Fazer o que amo
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs justify-start" onClick={() => handleOnboardingChoice('money')}>
            💰 Priorizar monetização
          </Button>
          <Button size="sm" className="w-full text-xs justify-start gradient-hero border-0 text-primary-foreground" onClick={() => handleOnboardingChoice('both')}>
            🎯 Tentar unir ambos (recomendado)
          </Button>
        </div>
      );
    }

    if (step === 'follow_up') {
      return (
        <div className="flex gap-2 px-4 pb-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => send('Quero enviar minhas métricas atuais para revisão do plano')}>
            <ImagePlus className="w-3.5 h-3.5 mr-1" /> Enviar métricas
          </Button>
          <Button size="sm" className="flex-1 text-xs gradient-hero border-0 text-primary-foreground" onClick={() => send('Quero conectar meu canal do YouTube para análise automática')}>
            <Youtube className="w-3.5 h-3.5 mr-1" /> Conectar YouTube
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Proactive Nudge Bubble */}
      <AnimatePresence>
        {!open && proactiveNudge && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-50 max-w-[260px] bg-card border border-primary/20 rounded-xl p-3 shadow-xl cursor-pointer"
            onClick={() => { setOpen(true); setProactiveNudge(null); setPulseVisible(false); }}>
            <p className="text-xs text-foreground leading-relaxed">{proactiveNudge}</p>
            <p className="text-[9px] text-primary mt-1 font-medium">Clique para conversar →</p>
            <button onClick={e => { e.stopPropagation(); setProactiveNudge(null); }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => { setOpen(true); setPulseVisible(false); setProactiveNudge(null); setTimeout(() => inputRef.current?.focus(), 300); }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-hero flex items-center justify-center shadow-2xl hover:scale-105 transition-transform group">
            <Bot className="w-6 h-6 text-primary-foreground" />
            {(!hasSeenOnboarding && pulseVisible) || proactiveNudge ? (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-chart-2 items-center justify-center text-[9px] font-bold text-primary-foreground">!</span>
              </span>
            ) : hasSeenOnboarding ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-chart-2 rounded-full border-2 border-background" />
            ) : null}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full gradient-hero flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Dotti AI</p>
                  <p className="text-[10px] text-chart-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-chart-2 rounded-full inline-block" />
                    {isOnboardingActive ? 'Onboarding • Seu guia pessoal' : 'Online • RAG + 13 bases de dados'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadHistory} title="Histórico de conversas">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Nova conversa">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* History Panel */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-border bg-secondary/30 overflow-hidden"
                >
                  <div className="p-3 space-y-1 max-h-[200px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conversas salvas</p>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={startNewConversation}>
                        + Nova
                      </Button>
                    </div>
                    {savedConversations.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhuma conversa salva</p>
                    )}
                    {savedConversations.map(convo => (
                      <button
                        key={convo.id}
                        onClick={() => loadConversation(convo)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all hover:bg-secondary ${
                          conversationId === convo.id ? 'bg-primary/10 border border-primary/20' : 'bg-background/50'
                        }`}
                      >
                        <p className="font-medium text-foreground truncate">{convo.title || 'Sem título'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(convo.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {' • '}
                          {Array.isArray(convo.messages) ? convo.messages.length : 0} msgs
                        </p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/80'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none text-foreground [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-primary">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Quick Actions */}
              {showQuickActions && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {QUICK_ACTIONS.map(qa => (
                    <button key={qa.label} onClick={() => send(qa.message)}
                      className="text-left bg-secondary/60 hover:bg-secondary rounded-lg px-2.5 py-2 transition-all border border-transparent hover:border-primary/20">
                      <span className="text-base">{qa.emoji}</span>
                      <p className="text-[11px] font-medium text-foreground mt-0.5">{qa.label}</p>
                    </button>
                  ))}
                </div>
              )}

              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-secondary/80 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Consultando 13 bases de dados...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Onboarding Buttons */}
            {renderOnboardingButtons()}

            {/* Input */}
            <div className="p-3 border-t border-border bg-secondary/30">
              <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
                <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  placeholder={isOnboardingActive ? 'Digite sua resposta...' : 'Pergunte sobre algoritmo, roteiros, nichos...'}
                  className="bg-background text-sm h-9" disabled={loading} />
                <Button type="submit" size="icon" className="h-9 w-9 gradient-hero border-0 shrink-0" disabled={loading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
