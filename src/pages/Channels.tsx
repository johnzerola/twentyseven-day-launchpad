import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Youtube, Plus, Trash2, BarChart3, Users, Eye, Video, RefreshCw, ExternalLink, Globe, TrendingUp, Sparkles, Loader2, Bot, Send, Search, Trophy, Lightbulb, X, AlertTriangle, CheckCircle2, Target, DollarSign, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';
import { COUNTRIES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface Channel {
  id: string;
  youtube_channel_id: string;
  channel_name: string;
  thumbnail: string | null;
  subscribers: number;
  views: number;
  videos: number;
  niche: string | null;
  analysis_json: any;
  linked_at: string;
}

interface Competitor {
  channelId: string;
  channelName: string;
  thumbnail: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  growthRate: string;
  multiplier: number;
  country: string;
  topVideos: { title: string; views: number; videoId: string }[];
  relevanceScore: number;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

// Use COUNTRIES from constants (property: .value instead of .code)

const GROWTH_COLORS: Record<string, string> = {
  explosive: 'bg-red-500/20 text-red-400',
  fast: 'bg-amber-500/20 text-amber-400',
  steady: 'bg-emerald-500/20 text-emerald-400',
};

const Channels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingChannel, setAddingChannel] = useState(false);
  const [analyzingChannel, setAnalyzingChannel] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorKeywords, setCompetitorKeywords] = useState<string[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorCountry, setCompetitorCountry] = useState('US');

  // Video suggestions
  const [videoSuggestions, setVideoSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [chatMessages]);

  const loadChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }) as any;
    const freshChannels = data || [];
    setChannels(freshChannels);
    // Re-select the currently selected channel from fresh data
    if (selectedChannel) {
      const updated = freshChannels.find((c: Channel) => c.id === selectedChannel.id);
      if (updated) setSelectedChannel(updated);
      else setSelectedChannel(null);
    }
    setLoading(false);
  };

  const addChannel = async () => {
    if (!channelInput.trim()) return;
    setAddingChannel(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login');

      // Step 1: Resolve channel
      toast.info('Buscando canal...');
      const { data: chData, error } = await supabase.functions.invoke('resolve-channel', { body: { channelInput: channelInput.trim() } });
      if (error || chData?.error) throw new Error(chData?.error || error?.message);

      // Step 2: Insert channel
      const { data: inserted } = await supabase.from('user_channels').insert({
        user_id: user.id, youtube_channel_id: chData.channelId, channel_name: chData.name,
        thumbnail: chData.thumbnail, subscribers: chData.subscribers, views: chData.views, videos: chData.videos,
      } as any).select().single() as any;

      toast.success('Canal adicionado! Analisando...');
      setChannelInput('');
      setShowAdd(false);
      await loadChannels();

      // Step 3: Auto-analyze with AI
      if (inserted) {
        setAnalyzingChannel(true);
        try {
          const { data: analysisData, error: analysisErr } = await supabase.functions.invoke('analyze-channel', {
            body: { channelInput: chData.channelId },
          });
          if (!analysisErr && analysisData && !analysisData.error) {
            const niche = analysisData.analysis?.niche_detected || null;
            await supabase.from('user_channels').update({
              analysis_json: {
                ...analysisData.analysis,
                recentVideos: analysisData.recentVideos,
                topVideos: analysisData.topVideos,
                avgRecentViews: analysisData.avgRecentViews,
              },
              niche: niche,
            } as any).eq('id', inserted.id);
            toast.success('Análise completa!');
            await loadChannels();
          }
        } catch {
          toast.warning('Análise automática falhou. Use o botão de atualizar.');
        }
        setAnalyzingChannel(false);
      }
    } catch (err: any) { toast.error(err.message || 'Erro'); }
    finally { setAddingChannel(false); }
  };

  const removeChannel = async (id: string) => {
    await supabase.from('user_channels').delete().eq('id', id);
    toast.success('Canal removido');
    if (selectedChannel?.id === id) setSelectedChannel(null);
    loadChannels();
  };

  const refreshChannel = async (ch: Channel) => {
    try {
      toast.info('Atualizando e analisando...');
      const { data, error } = await supabase.functions.invoke('analyze-channel', { body: { channelInput: ch.youtube_channel_id } });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      await supabase.from('user_channels').update({
        subscribers: data.channel?.subscribers || ch.subscribers,
        views: data.channel?.views || ch.views,
        videos: data.channel?.videos || ch.videos,
        niche: data.analysis?.niche_detected || ch.niche,
        analysis_json: {
          ...data.analysis,
          recentVideos: data.recentVideos,
          topVideos: data.topVideos,
          avgRecentViews: data.avgRecentViews,
        },
      } as any).eq('id', ch.id);
      toast.success('Canal atualizado com análise completa!');
      loadChannels();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const loadCompetitors = async (ch: Channel, country: string) => {
    setLoadingCompetitors(true);
    setCompetitors([]);
    try {
      const analysis = ch.analysis_json;
      const topTitles = [
        ...(analysis?.topVideos || []).map((v: any) => v.title),
        ...(analysis?.recentVideos || []).map((v: any) => v.title),
      ].slice(0, 10);

      if (topTitles.length === 0) {
        toast.warning('Atualize o canal primeiro para obter dados de vídeos.');
        setLoadingCompetitors(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('find-competitors', {
        body: {
          channelId: ch.youtube_channel_id,
          topVideoTitles: topTitles,
          subscribers: ch.subscribers,
          country,
        },
      });
      if (error) throw error;
      setCompetitors(data?.competitors || []);
      setCompetitorKeywords(data?.keywords || []);
    } catch (e: any) {
      toast.error('Erro ao buscar concorrentes');
    }
    setLoadingCompetitors(false);
  };

  const loadVideoSuggestions = async (ch: Channel) => {
    setLoadingSuggestions(true);
    try {
      const analysis = ch.analysis_json;
      const topTitles = (analysis?.topVideos || []).map((v: any) => v.title).slice(0, 5);
      const compTitles = competitors.flatMap(c => c.topVideos?.map(v => v.title) || []).slice(0, 10);

      const { data, error } = await supabase.functions.invoke('suggest-themes', {
        body: {
          niche: ch.niche || analysis?.niche_detected || 'faceless',
          style: analysis?.content_strategy ? 'baseado na estratégia: ' + analysis.content_strategy : 'documentário',
          language: 'português',
          count: 8,
        },
      });
      if (error) throw error;
      setVideoSuggestions(data?.themes || []);
    } catch (e: any) {
      if (e?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else if (e?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else toast.error('Erro ao gerar sugestões');
    }
    setLoadingSuggestions(false);
  };

  const selectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setActiveTab('overview');
    setCompetitors([]);
    setVideoSuggestions([]);
    setChatMessages([{
      role: 'assistant',
      content: `👋 Olá! Sou seu assistente especializado no canal **${ch.channel_name}**.\n\n📊 **Stats:** ${formatNumber(ch.subscribers)} subs · ${formatNumber(ch.views)} views · ${ch.videos} vídeos${ch.niche ? `\n🎯 **Nicho:** ${ch.niche}` : ''}${ch.analysis_json?.content_strategy ? `\n📋 **Estratégia:** ${ch.analysis_json.content_strategy}` : ''}\n\nPergunte sobre estratégias, concorrentes, ou ideias de vídeos!`
    }]);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const analysis = selectedChannel?.analysis_json;
      const channelContext = selectedChannel ? [
        `Canal: ${selectedChannel.channel_name}`,
        `${formatNumber(selectedChannel.subscribers)} subs, ${formatNumber(selectedChannel.views)} views, ${selectedChannel.videos} vídeos`,
        `Nicho: ${selectedChannel.niche || analysis?.niche_detected || 'não definido'}`,
        analysis?.seo_score ? `SEO Score: ${analysis.seo_score}/100` : '',
        analysis?.strengths ? `Forças: ${analysis.strengths.join(', ')}` : '',
        analysis?.weaknesses ? `Fraquezas: ${analysis.weaknesses.join(', ')}` : '',
        analysis?.content_strategy ? `Estratégia: ${analysis.content_strategy}` : '',
        analysis?.estimated_monthly_revenue ? `Receita estimada: ${analysis.estimated_monthly_revenue}` : '',
        analysis?.topVideos ? `Top vídeos: ${analysis.topVideos.slice(0, 3).map((v: any) => `${v.title} (${formatNumber(v.views)} views)`).join('; ')}` : '',
      ].filter(Boolean).join('. ') : '';

      const compContext = competitors.length > 0
        ? `Concorrentes reais (via YouTube): ${competitors.slice(0, 5).map(c => `${c.channelName} (${formatNumber(c.subscribers)} subs, growth: ${c.growthRate}, melhor vídeo: ${c.topVideos[0]?.title || 'N/A'})`).join('; ')}`
        : '';

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `[CONTEXTO COMPLETO DO CANAL] ${channelContext}. ${compContext}. Foque em estratégias de vídeos LONGOS (long-form). Seja específico e use os dados reais do canal.` },
            ...newMessages.slice(1).map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      if (resp.status === 429) { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Rate limit. Tente em alguns segundos.' }]); setChatLoading(false); return; }
      if (resp.status === 402) { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Créditos esgotados.' }]); setChatLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Erro');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > newMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erro. Tente novamente.' }]); }
    finally { setChatLoading(false); }
  };

  const totalSubs = channels.reduce((s, c) => s + c.subscribers, 0);
  const totalViews = channels.reduce((s, c) => s + c.views, 0);
  const totalVideos = channels.reduce((s, c) => s + c.videos, 0);

  const analysis = selectedChannel?.analysis_json;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Meus Canais</h1>
              <p className="text-sm text-muted-foreground">{channels.length} canais · {formatNumber(totalSubs)} inscritos total</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedChannel && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setChatOpen(!chatOpen)}>
                <Bot className="w-4 h-4" /> Assistente
              </Button>
            )}
            <Button onClick={() => setShowAdd(!showAdd)} className="gradient-hero border-0 gap-2">
              <Plus className="w-4 h-4" /> Adicionar Canal
            </Button>
          </div>
        </div>

        {showAdd && (
          <div className="glass rounded-xl p-5 flex gap-3">
            <Input value={channelInput} onChange={e => setChannelInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChannel()} placeholder="Cole a URL do canal ou @username" className="bg-secondary/50" />
            <Button onClick={addChannel} disabled={addingChannel} className="gradient-hero border-0">
              {addingChannel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </div>
        )}

        {analyzingChannel && (
          <div className="glass rounded-xl p-4 flex items-center gap-3 border-primary/30">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando canal com IA... SEO, concorrentes, estratégias...</p>
          </div>
        )}

        {/* Aggregate stats */}
        {channels.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{channels.length}</p>
              <p className="text-xs text-muted-foreground">Canais</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{formatNumber(totalSubs)}</p>
              <p className="text-xs text-muted-foreground">Inscritos Total</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{formatNumber(totalViews)}</p>
              <p className="text-xs text-muted-foreground">Views Total</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{totalVideos}</p>
              <p className="text-xs text-muted-foreground">Vídeos Total</p>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Channel list sidebar */}
          <div className="w-64 flex-shrink-0 space-y-2">
            {loading ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : channels.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center">
                <Youtube className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhum canal</p>
                <Button onClick={() => setShowAdd(true)} size="sm" className="mt-3 gradient-hero border-0">Adicionar</Button>
              </div>
            ) : (
              channels.map(ch => (
                <button key={ch.id} onClick={() => selectChannel(ch)}
                  className={`w-full text-left glass rounded-xl p-3 transition-all ${selectedChannel?.id === ch.id ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/20'}`}>
                  <div className="flex items-center gap-2">
                    {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-8 h-8 rounded-full" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{ch.channel_name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatNumber(ch.subscribers)} subs</p>
                    </div>
                    {ch.analysis_json && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {!selectedChannel ? (
              <div className="glass rounded-2xl p-12 text-center">
                <Youtube className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-semibold mb-2">Selecione um canal</h3>
                <p className="text-sm text-muted-foreground">Clique em um canal à esquerda para ver análise completa, concorrentes reais e sugestões.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Channel header */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    {selectedChannel.thumbnail && <img src={selectedChannel.thumbnail} alt="" className="w-16 h-16 rounded-full" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{selectedChannel.channel_name}</h2>
                        {selectedChannel.niche && <Badge variant="outline">{selectedChannel.niche}</Badge>}
                        {!analysis && <Badge variant="outline" className="text-amber-400 border-amber-500/30">Sem análise</Badge>}
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" />{formatNumber(selectedChannel.subscribers)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{formatNumber(selectedChannel.views)}</span>
                        <span className="flex items-center gap-1"><Video className="w-4 h-4" />{selectedChannel.videos}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => refreshChannel(selectedChannel)} title="Atualizar e re-analisar">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <a href={`https://youtube.com/channel/${selectedChannel.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="w-3 h-3" /> YouTube</Button>
                      </a>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeChannel(selectedChannel.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  {/* Quick scores from analysis */}
                  {analysis && (
                    <div className="grid grid-cols-5 gap-3 mt-4">
                      <div className="bg-secondary/30 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">{analysis.seo_score || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">SEO Score</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">{analysis.title_quality_score || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">Títulos</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">{analysis.monetization_readiness || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">Monetização</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">${analysis.estimated_rpm || '—'}</p>
                        <p className="text-[10px] text-muted-foreground">RPM Est.</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold">{analysis.avgRecentViews ? formatNumber(analysis.avgRecentViews) : '—'}</p>
                        <p className="text-[10px] text-muted-foreground">Avg Views</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={v => {
                  setActiveTab(v);
                  if (v === 'competitors' && competitors.length === 0 && selectedChannel) {
                    loadCompetitors(selectedChannel, competitorCountry);
                  }
                }}>
                  <TabsList className="bg-secondary/50 border border-border/50">
                    <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-4 h-4" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="competitors" className="gap-1"><Trophy className="w-4 h-4" />Concorrentes</TabsTrigger>
                    <TabsTrigger value="suggestions" className="gap-1"><Lightbulb className="w-4 h-4" />Sugestões</TabsTrigger>
                  </TabsList>

                  {/* Overview */}
                  <TabsContent value="overview" className="space-y-4">
                    {!analysis ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                        <p className="text-sm text-muted-foreground mb-3">Este canal ainda não foi analisado.</p>
                        <Button onClick={() => refreshChannel(selectedChannel)} className="gradient-hero border-0 gap-2">
                          <Sparkles className="w-4 h-4" /> Analisar Agora
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Strengths & Weaknesses */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pontos Fortes
                            </h4>
                            <ul className="space-y-1.5">
                              {(analysis.strengths || []).map((s: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="text-emerald-400 mt-0.5">✓</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 text-amber-400" /> Pontos Fracos
                            </h4>
                            <ul className="space-y-1.5">
                              {(analysis.weaknesses || []).map((w: string, i: number) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                  <span className="text-amber-400 mt-0.5">!</span> {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Strategy & Revenue */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                              <Target className="w-4 h-4 text-primary" /> Estratégia de Conteúdo
                            </h4>
                            <p className="text-xs text-muted-foreground">{analysis.content_strategy || '—'}</p>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                              <DollarSign className="w-4 h-4 text-emerald-400" /> Monetização
                            </h4>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <p>Receita estimada: <span className="text-foreground font-medium">{analysis.estimated_monthly_revenue || '—'}</span></p>
                              <p>RPM: <span className="text-foreground font-medium">${analysis.estimated_rpm || '—'}</span></p>
                              <p>Frequência ideal: <span className="text-foreground font-medium">{analysis.upload_frequency_recommendation || '—'}</span></p>
                            </div>
                          </div>
                        </div>

                        {/* SEO & Title Improvements */}
                        {(analysis.seo_improvements?.length > 0 || analysis.title_improvements?.length > 0) && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                              <Zap className="w-4 h-4 text-primary" /> Melhorias Recomendadas
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              {analysis.seo_improvements?.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase mb-1">SEO</p>
                                  <ul className="space-y-1">
                                    {analysis.seo_improvements.map((s: string, i: number) => (
                                      <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {analysis.title_improvements?.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Títulos</p>
                                  <ul className="space-y-1">
                                    {analysis.title_improvements.map((t: string, i: number) => (
                                      <li key={i} className="text-xs text-muted-foreground">• {t}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Growth & Competitor Insights */}
                        {(analysis.growth_potential || analysis.competitor_insights) && (
                          <div className="grid grid-cols-2 gap-4">
                            {analysis.growth_potential && (
                              <div className="glass rounded-xl p-4">
                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Potencial de Crescimento
                                </h4>
                                <p className="text-xs text-muted-foreground">{analysis.growth_potential}</p>
                              </div>
                            )}
                            {analysis.competitor_insights && (
                              <div className="glass rounded-xl p-4">
                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                                  <Trophy className="w-4 h-4 text-amber-400" /> Insights de Concorrência
                                </h4>
                                <p className="text-xs text-muted-foreground">{analysis.competitor_insights}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Top Videos */}
                        {analysis.topVideos?.length > 0 && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                              <TrendingUp className="w-4 h-4 text-primary" /> Top Vídeos
                            </h4>
                            <div className="space-y-2">
                              {analysis.topVideos.slice(0, 5).map((v: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-2">
                                  <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                                  <span className="text-sm flex-1 truncate">{v.title}</span>
                                  <span className="text-xs text-muted-foreground">{formatNumber(v.views)} views</span>
                                  {v.likes && <span className="text-xs text-muted-foreground">{formatNumber(v.likes)} likes</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Channel Comparison */}
                        {channels.length > 1 && (
                          <div className="glass rounded-xl p-5">
                            <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Comparação entre Canais</h3>
                            <div className="space-y-2">
                              {channels.map(ch => {
                                const maxSubs = Math.max(...channels.map(c => c.subscribers));
                                const pct = maxSubs > 0 ? (ch.subscribers / maxSubs) * 100 : 0;
                                return (
                                  <div key={ch.id} className={`flex items-center gap-3 p-2 rounded-lg ${ch.id === selectedChannel.id ? 'bg-primary/10' : 'bg-secondary/20'}`}>
                                    {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-6 h-6 rounded-full" />}
                                    <span className="text-sm font-medium w-32 truncate">{ch.channel_name}</span>
                                    <div className="flex-1 h-3 rounded-full bg-secondary/40 overflow-hidden">
                                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-20 text-right">{formatNumber(ch.subscribers)} subs</span>
                                    <span className="text-xs text-muted-foreground w-20 text-right">{formatNumber(ch.views)} views</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Competitors */}
                  <TabsContent value="competitors" className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">País:</span>
                      {COUNTRIES.filter(c => c.value).map(c => (
                        <Badge key={c.value}
                          className={`cursor-pointer text-[10px] ${competitorCountry === c.value ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground'}`}
                          onClick={() => { setCompetitorCountry(c.value); loadCompetitors(selectedChannel, c.value); }}>
                          {c.label}
                        </Badge>
                      ))}
                    </div>

                    {competitorKeywords.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">Keywords detectadas:</span>
                        {competitorKeywords.map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    )}

                    {loadingCompetitors ? (
                      <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">Buscando concorrentes reais via YouTube...</p></div>
                    ) : competitors.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">
                          {analysis ? 'Clique em um país para buscar concorrentes reais.' : 'Atualize o canal primeiro para obter dados de vídeos.'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {competitors.map((comp, i) => (
                          <motion.div key={comp.channelId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="glass rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors">
                            <div className="flex items-center gap-3">
                              {comp.thumbnail && <img src={comp.thumbnail} alt="" className="w-8 h-8 rounded-full" />}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">{comp.channelName}</h4>
                                <div className="flex gap-2 text-[10px] text-muted-foreground">
                                  <span>{formatNumber(comp.subscribers)} subs</span>
                                  <span>{formatNumber(comp.avgViews)} avg views</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge className={GROWTH_COLORS[comp.growthRate] || ''} variant="outline">{comp.growthRate}</Badge>
                                {comp.multiplier > 1 && (
                                  <span className="text-[10px] text-amber-400">{comp.multiplier}× outlier</span>
                                )}
                              </div>
                            </div>
                            {comp.topVideos?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {comp.topVideos.slice(0, 2).map((v, vi) => (
                                  <div key={vi} className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/20 rounded px-2 py-1">
                                    <span className="flex-1 truncate">{v.title}</span>
                                    <span>{formatNumber(v.views)} views</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2 mt-1">
                              <a href={`https://youtube.com/channel/${comp.channelId}`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1">
                                  <ExternalLink className="w-3 h-3" /> Ver Canal
                                </Button>
                              </a>
                              {comp.topVideos?.[0] && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-primary/30 text-primary"
                                  onClick={() => {
                                    sessionStorage.setItem('outlier_topic', comp.topVideos[0].title);
                                    window.location.href = '/scripts';
                                  }}>
                                  <Sparkles className="w-3 h-3" /> Criar Similar
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Video Suggestions */}
                  <TabsContent value="suggestions" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Sugestões contextuais baseadas nos seus vídeos e concorrentes</p>
                      <Button onClick={() => loadVideoSuggestions(selectedChannel)} disabled={loadingSuggestions} className="gradient-hero border-0 gap-2">
                        {loadingSuggestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Gerar Sugestões
                      </Button>
                    </div>

                    {loadingSuggestions ? (
                      <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                    ) : videoSuggestions.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <Lightbulb className="w-8 h-8 mx-auto mb-2 text-amber-400 opacity-40" />
                        <p className="text-sm text-muted-foreground">Clique em "Gerar Sugestões" para ideias baseadas no seu canal.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {videoSuggestions.map((theme: any, i: number) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass rounded-xl p-4 hover:border-primary/30 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm">{theme.title}</h4>
                                {theme.hook && <p className="text-xs text-primary mt-1">🪝 {theme.hook}</p>}
                                {theme.description && <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>}
                                {theme.why_viral && <p className="text-xs text-muted-foreground/70 mt-1 italic">{theme.why_viral}</p>}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {theme.viral_score && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">🔥 {theme.viral_score}/10</Badge>}
                                {theme.style && <Badge variant="outline" className="text-[10px]">{theme.style}</Badge>}
                                {theme.estimated_duration && <span className="text-[10px] text-muted-foreground">{theme.estimated_duration}</span>}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              {theme.niche_tags?.map((t: string, ti: number) => (
                                <Badge key={ti} variant="secondary" className="text-[10px]">{t}</Badge>
                              ))}
                              <div className="flex-1" />
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary"
                                onClick={() => {
                                  sessionStorage.setItem('outlier_topic', theme.title);
                                  window.location.href = '/scripts';
                                }}>
                                <Sparkles className="w-3 h-3" /> Criar Roteiro
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {chatOpen && selectedChannel && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 w-[400px] h-[520px] glass rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-primary/20">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Assistente — {selectedChannel.channel_name}</p>
                    <p className="text-[10px] text-emerald-400">● Conectado ao canal{analysis ? ' (com análise)' : ''}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(false)}><X className="w-4 h-4" /></Button>
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/80'}`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none text-foreground"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start"><div className="bg-secondary/80 rounded-xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>
                )}
              </div>

              <div className="p-3 border-t border-border/50">
                <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Pergunte sobre seu canal..."
                    className="bg-secondary/50 text-sm h-9" disabled={chatLoading} />
                  <Button type="submit" size="icon" className="h-9 w-9 gradient-hero border-0" disabled={chatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Channels;
