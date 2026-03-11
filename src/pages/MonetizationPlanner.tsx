import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Send, Loader2, CheckCircle2, Circle, Target, Calendar, Video, MessageSquare, Zap, TrendingUp, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

interface ActionPlan {
  planName: string;
  timeline: string;
  weeklySchedule: { longForm: number; shorts: number; communityPosts: number };
  phases: { name: string; duration: string; tasks: { task: string; type: string; frequency: string }[]; goal: string; expectedResults: string }[];
  monetizationPath: { month: number; source: string; expectedRevenue: string }[];
  communityPostIdeas: { type: string; example: string; timing: string }[];
  shortVideoIdeas: { linkedTo: string; hookIdea: string }[];
}

const MODULE_KEY = 'monetization';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monetization-coach`;

const QUICK_STARTS = [
  { label: '🚀 Quero monetizar do zero', message: 'Quero começar um canal do zero e monetizar o mais rápido possível. Me ajuda a criar um plano realista?' },
  { label: '💰 Já tenho canal, quero escalar', message: 'Já tenho um canal com alguns vídeos mas não estou ganhando dinheiro. Como posso monetizar melhor?' },
  { label: '🎯 Validar minha ideia de nicho', message: 'Tenho uma ideia de nicho e quero saber se vale a pena investir tempo nele. Posso te contar?' },
  { label: '📊 Entender a regra dos 10-12 vídeos', message: 'Me explica essa história de que o YouTube só entende seu canal depois de 10-12 vídeos. Como furar essa bolha?' },
];

interface UserChannelData {
  channel_name: string;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  niche: string | null;
}

const MonetizationPlanner = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number>(0);
  const [showPlan, setShowPlan] = useState(false);
  const [userChannels, setUserChannels] = useState<UserChannelData[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedPlanIdRef = useRef<string | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load saved plan + chat + progress + user channels on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Load user channels for context
      const { data: channels } = await supabase
        .from('user_channels')
        .select('channel_name, subscribers, views, videos, niche')
        .eq('user_id', user.id);
      if (channels?.length) setUserChannels(channels);

      // Load monetization plan
      const { data: saved } = await supabase
        .from('monetization_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (saved) {
        savedPlanIdRef.current = saved.id;
        if (saved.chat_history) setMessages((saved.chat_history as any) || []);
        if (saved.plan_json && Object.keys(saved.plan_json as object).length > 0) {
          setActionPlan(saved.plan_json as any);
          setShowPlan(true);
        }
      }
      
      // Load progress
      const { data: progress } = await supabase
        .from('user_progress')
        .select('completed_items')
        .eq('user_id', user.id)
        .eq('module', MODULE_KEY)
        .maybeSingle();
      if (progress?.completed_items) {
        setCompletedTasks(progress.completed_items as string[]);
      }
    })();
  }, []);

  const persistPlan = useCallback(async (msgs: Msg[], plan: ActionPlan | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (savedPlanIdRef.current) {
      await supabase.from('monetization_plans').update({
        chat_history: msgs as any,
        plan_json: (plan || {}) as any,
        updated_at: new Date().toISOString(),
      } as any).eq('id', savedPlanIdRef.current);
    } else {
      const { data: inserted } = await supabase.from('monetization_plans').insert({
        user_id: user.id,
        chat_history: msgs as any,
        plan_json: (plan || {}) as any,
      } as any).select('id').single();
      if (inserted) savedPlanIdRef.current = inserted.id;
    }
  }, []);

  const persistProgress = useCallback(async (ids: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_progress').upsert(
      { user_id: user.id, module: MODULE_KEY, completed_items: ids, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,module' }
    );
  }, []);

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => {
      const next = prev.includes(taskId) ? prev.filter(x => x !== taskId) : [...prev, taskId];
      persistProgress(next);
      return next;
    });
  };

  // Parse action plan from message content
  const extractActionPlan = (content: string): ActionPlan | null => {
    const match = content.match(/```actionplan\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  };

  const streamChat = async (userMessage: string) => {
    const userMsg: Msg = { role: 'user', content: userMessage };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erro na comunicação');
      }

      if (!resp.body) throw new Error('No stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial */ }
        }
      }

      // Check for action plan
      const plan = extractActionPlan(assistantContent);
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
      if (plan) {
        setActionPlan(plan);
        setShowPlan(true);
        await persistPlan(finalMessages, plan);
      } else {
        await persistPlan(finalMessages, actionPlan);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    streamChat(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const removeActionPlanBlock = (content: string) => {
    return content.replace(/```actionplan[\s\S]*?```/g, '').trim();
  };

  const totalPlanTasks = actionPlan?.phases.reduce((sum, p) => sum + p.tasks.length, 0) || 0;
  const completedPlanTasks = actionPlan?.phases.reduce((sum, p) => sum + p.tasks.filter((_, i) => completedTasks.includes(`${p.name}-${i}`)).length, 0) || 0;
  const planProgress = totalPlanTasks > 0 ? Math.round((completedPlanTasks / totalPlanTasks) * 100) : 0;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-3.5 h-3.5 text-red-400" />;
      case 'short': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'community': return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
      default: return <Target className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-4 border-b border-border bg-card/50">
            <h1 className="text-xl font-bold font-['Space_Grotesk'] text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" /> Coach de Monetização
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Converse comigo — vou te ajudar a criar um plano realista baseado em dados reais
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">💡 Antes de começar, saiba:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <TrendingUp className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>O YouTube só entende seu canal após <strong className="text-foreground">10-12 vídeos</strong> consistentes no mesmo nicho</span>
                    </div>
                    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>Monetização real leva <strong className="text-foreground">3-6 meses</strong> com consistência (3+ vídeos/semana)</span>
                    </div>
                    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <Users className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>Community posts e Shorts são <strong className="text-foreground">complementos</strong>, não substitutos do long-form</span>
                    </div>
                    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                      <DollarSign className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>Comece vendendo infoprodutos <strong className="text-foreground">antes</strong> do AdSense — não espere a monetização oficial</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Comece por aqui:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUICK_STARTS.map((qs, i) => (
                      <button key={i} onClick={() => streamChat(qs.message)}
                        className="text-left text-sm p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all">
                        {qs.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h3]:text-foreground [&>h3]:mt-3 [&>h3]:mb-1">
                      <ReactMarkdown>{removeActionPlanBlock(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </motion.div>
            ))}

            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card/50">
            <div className="flex gap-2">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Me conta seu nicho, país, expectativas..."
                rows={1}
                className="flex-1 resize-none rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button onClick={handleSend} disabled={isStreaming || !input.trim()} size="icon" className="shrink-0">
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Action Plan Panel */}
        <AnimatePresence>
          {actionPlan && showPlan && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
              className="w-full lg:w-[420px] border-l border-border bg-card overflow-y-auto">
              <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-accent" /> {actionPlan.planName}
                  </h2>
                  <button onClick={() => setShowPlan(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Progress value={planProgress} className="flex-1 h-2" />
                  <span className="text-xs text-muted-foreground">{completedPlanTasks}/{totalPlanTasks}</span>
                </div>

                {/* Weekly Schedule */}
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px] gap-1"><Video className="w-3 h-3 text-red-400" />{actionPlan.weeklySchedule.longForm} vídeos/sem</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1"><Zap className="w-3 h-3 text-yellow-400" />{actionPlan.weeklySchedule.shorts} shorts/sem</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1"><MessageSquare className="w-3 h-3 text-blue-400" />{actionPlan.weeklySchedule.communityPosts} posts/sem</Badge>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Phases */}
                {actionPlan.phases.map((phase, pi) => (
                  <div key={pi} className="border border-border rounded-lg overflow-hidden">
                    <button onClick={() => setExpandedPhase(expandedPhase === pi ? -1 : pi)}
                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">{phase.name}</p>
                        <p className="text-[10px] text-muted-foreground">{phase.duration} · {phase.expectedResults}</p>
                      </div>
                      {expandedPhase === pi ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <AnimatePresence>
                      {expandedPhase === pi && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="p-2 space-y-1">
                            <p className="text-[10px] text-accent px-2 py-1 font-medium">🎯 {phase.goal}</p>
                            {phase.tasks.map((task, ti) => {
                              const taskId = `${phase.name}-${ti}`;
                              const done = completedTasks.includes(taskId);
                              return (
                                <div key={ti} onClick={() => toggleTask(taskId)}
                                  className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-all ${done ? 'opacity-60' : 'hover:bg-muted/30'}`}>
                                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.task}</p>
                                    <div className="flex gap-1 mt-0.5">
                                      <span className="flex items-center gap-0.5">{typeIcon(task.type)}</span>
                                      <span className="text-[10px] text-muted-foreground">{task.frequency}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}

                {/* Monetization Path */}
                {actionPlan.monetizationPath.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Caminho de Receita
                    </h4>
                    <div className="space-y-1.5">
                      {actionPlan.monetizationPath.map((mp, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Mês {mp.month}: {mp.source}</span>
                          <Badge variant="secondary" className="text-[10px]">{mp.expectedRevenue}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Community Post Ideas */}
                {actionPlan.communityPostIdeas?.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Ideias de Community Posts
                    </h4>
                    <div className="space-y-2">
                      {actionPlan.communityPostIdeas.map((cp, i) => (
                        <div key={i} className="bg-muted/30 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="outline" className="text-[9px]">{cp.type}</Badge>
                            <span className="text-[10px] text-muted-foreground">{cp.timing}</span>
                          </div>
                          <p className="text-xs text-foreground">{cp.example}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Short Video Ideas */}
                {actionPlan.shortVideoIdeas?.length > 0 && (
                  <div className="border border-border rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" /> Shorts Vinculados
                    </h4>
                    <div className="space-y-2">
                      {actionPlan.shortVideoIdeas.map((sv, i) => (
                        <div key={i} className="text-xs">
                          <p className="text-muted-foreground">📹 {sv.linkedTo}</p>
                          <p className="text-foreground ml-4">↳ Hook: {sv.hookIdea}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle plan button when plan exists but hidden */}
        {actionPlan && !showPlan && (
          <button onClick={() => setShowPlan(true)}
            className="fixed bottom-20 right-4 bg-primary text-primary-foreground rounded-full px-4 py-2 text-xs font-medium shadow-lg flex items-center gap-2 z-50 hover:opacity-90">
            <Target className="w-4 h-4" /> Ver Plano de Ação
          </button>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MonetizationPlanner;
