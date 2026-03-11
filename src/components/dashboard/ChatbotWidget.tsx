import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { emoji: '💡', label: 'Ideias de vídeo', message: 'Me sugira 5 ideias de vídeo viral para o meu nicho' },
  { emoji: '✍️', label: 'Dicas de roteiro', message: 'Quais técnicas de hook e retenção devo usar nos meus roteiros?' },
  { emoji: '🏷️', label: 'Título viral', message: 'Como criar títulos com alto CTR? Me dê fórmulas e exemplos' },
  { emoji: '💰', label: 'Monetização', message: 'Como monetizar meu canal o mais rápido possível? Quero um plano realista' },
  { emoji: '📊', label: 'Analisar nicho', message: 'Quais são os melhores nichos para começar hoje? Me mostre dados reais' },
  { emoji: '🚀', label: 'Crescer rápido', message: 'Quais estratégias posso usar para crescer meu canal mais rápido?' },
];

export const ChatbotWidget = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: '👋 Olá! Sou o **Dotti**, seu assistente de YouTube.\n\nPosso ajudar com **ideias de vídeo**, **roteiros**, **títulos virais**, **monetização**, **análise de nichos** e muito mais.\n\nO que você precisa?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    const userMsg: Msg = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.filter((_, i) => i > 0), // skip welcome msg
          currentPage: location.pathname,
        }),
      });

      if (resp.status === 429) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⏳ Rate limit atingido. Tente novamente em alguns segundos.' }]);
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        setMessages(prev => [...prev, { role: 'assistant', content: '💳 Créditos esgotados. Adicione créditos ao workspace.' }]);
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      { role: 'assistant', content: '👋 Chat limpo! Como posso ajudar?' },
    ]);
  };

  const showQuickActions = messages.length <= 1;

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 300); }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-hero flex items-center justify-center shadow-2xl hover:scale-105 transition-transform group">
            <Bot className="w-6 h-6 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background" />
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
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /> Online • YouTube Expert
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Limpar chat">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

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
                    <span className="text-xs text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-secondary/30">
              <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
                <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  placeholder="Pergunte qualquer coisa sobre YouTube..."
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
