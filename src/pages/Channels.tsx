import { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Youtube, Plus, Trash2, BarChart3, Users, Eye, Video, RefreshCw, ExternalLink, Globe, TrendingUp, Sparkles, Loader2, Bot, Send, Search, Trophy, Lightbulb, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';
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
  channel_name: string;
  subscribers: number;
  avg_views: number;
  growth_rate: string;
  niche: string;
  country: string;
  style: string;
  rpm_estimate: number;
  viral_patterns: any;
  top_videos: any[];
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const COUNTRIES = [
  { code: 'US', label: '🇺🇸 Estados Unidos' }, { code: 'ES', label: '🇪🇸 Espanha' },
  { code: 'BR', label: '🇧🇷 Brasil' }, { code: 'DE', label: '🇩🇪 Alemanha' },
  { code: 'FR', label: '🇫🇷 França' }, { code: 'GB', label: '🇬🇧 Reino Unido' },
  { code: 'JP', label: '🇯🇵 Japão' }, { code: 'KR', label: '🇰🇷 Coreia' },
  { code: 'MX', label: '🇲🇽 México' }, { code: 'PL', label: '🇵🇱 Polônia' },
  { code: 'TR', label: '🇹🇷 Turquia' }, { code: 'NL', label: '🇳🇱 Holanda' },
  { code: 'IT', label: '🇮🇹 Itália' }, { code: 'CA', label: '🇨🇦 Canadá' },
  { code: 'AU', label: '🇦🇺 Austrália' }, { code: 'AR', label: '🇦🇷 Argentina' },
];

const GROWTH_COLORS: Record<string, string> = {
  explosive: 'bg-red-500/20 text-red-400', fast: 'bg-amber-500/20 text-amber-400', steady: 'bg-emerald-500/20 text-emerald-400',
};

const Channels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingChannel, setAddingChannel] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
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
    setChannels(data || []);
    setLoading(false);
  };

  const addChannel = async () => {
    if (!channelInput.trim()) return;
    setAddingChannel(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Faça login');
      const { data: chData, error } = await supabase.functions.invoke('resolve-channel', { body: { channelInput: channelInput.trim() } });
      if (error || chData?.error) throw new Error(chData?.error || error?.message);
      await supabase.from('user_channels').insert({
        user_id: user.id, youtube_channel_id: chData.channelId, channel_name: chData.name,
        thumbnail: chData.thumbnail, subscribers: chData.subscribers, views: chData.views, videos: chData.videos,
      } as any);
      toast.success('Canal adicionado!');
      setChannelInput(''); setShowAdd(false); loadChannels();
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
      const { data, error } = await supabase.functions.invoke('resolve-channel', { body: { channelInput: ch.youtube_channel_id } });
      if (error || data?.error) throw new Error(data?.error || 'Erro');
      await supabase.from('user_channels').update({ subscribers: data.subscribers, views: data.views, videos: data.videos } as any).eq('id', ch.id);
      toast.success('Atualizado!'); loadChannels();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const loadCompetitors = async (ch: Channel, country: string) => {
    setLoadingCompetitors(true);
    try {
      const niche = ch.niche || 'geral';
      const { data } = await supabase.from('channel_intelligence' as any)
        .select('*').eq('country', country).limit(500);
      const allChannels = (data || []) as Competitor[];
      // Filter by similar niche, prioritize small fast-growing channels
      const scored = allChannels
        .filter(c => c.channel_name !== ch.channel_name)
        .map(c => {
          let score = 0;
          if (c.niche.toLowerCase().includes(niche.toLowerCase()) || niche.toLowerCase().includes(c.niche.toLowerCase())) score += 50;
          if (c.growth_rate === 'explosive') score += 40;
          else if (c.growth_rate === 'fast') score += 25;
          if (c.subscribers < 100000 && c.subscribers > 1000) score += 30; // small channels
          score += Math.min(c.rpm_estimate * 2, 30);
          return { ...c, _score: score };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 12);
      setCompetitors(scored);
    } catch (e) { toast.error('Erro ao buscar concorrentes'); }
    setLoadingCompetitors(false);
  };

  const loadVideoSuggestions = async (ch: Channel) => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-themes', {
        body: { niche: ch.niche || 'faceless dark', style: 'documentário', language: 'português', count: 8 },
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
    loadCompetitors(ch, competitorCountry);
    // Init chat with channel context
    setChatMessages([{
      role: 'assistant',
      content: `👋 Olá! Sou seu assistente especializado no canal **${ch.channel_name}**.\n\n📊 **Stats:** ${formatNumber(ch.subscribers)} subs · ${formatNumber(ch.views)} views · ${ch.videos} vídeos${ch.niche ? `\n🎯 **Nicho:** ${ch.niche}` : ''}\n\nPergunte sobre estratégias de crescimento, análise de concorrentes, sugestões de vídeos ou qualquer coisa sobre seu canal!`
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
      // Build context from channel data + competitors
      const channelContext = selectedChannel ? `Canal: ${selectedChannel.channel_name}, ${formatNumber(selectedChannel.subscribers)} subs, ${formatNumber(selectedChannel.views)} views, ${selectedChannel.videos} videos, nicho: ${selectedChannel.niche || 'não definido'}` : '';
      const compContext = competitors.length > 0 ? `Concorrentes encontrados: ${competitors.slice(0, 5).map(c => `${c.channel_name} (${formatNumber(c.subscribers)} subs, ${c.growth_rate}, RPM $${c.rpm_estimate})`).join('; ')}` : '';

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `[CONTEXTO DO CANAL] ${channelContext}. ${compContext}. Foque as respostas neste canal e em estratégias de vídeos longos (long-form).` },
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

  // Compare stats
  const totalSubs = channels.reduce((s, c) => s + c.subscribers, 0);
  const totalViews = channels.reduce((s, c) => s + c.views, 0);
  const totalVideos = channels.reduce((s, c) => s + c.videos, 0);

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

        {/* Aggregate stats if multiple channels */}
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
                <p className="text-sm text-muted-foreground">Clique em um canal à esquerda para ver estatísticas, concorrentes e sugestões.</p>
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
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-4 h-4" />{formatNumber(selectedChannel.subscribers)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{formatNumber(selectedChannel.views)}</span>
                        <span className="flex items-center gap-1"><Video className="w-4 h-4" />{selectedChannel.videos}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => refreshChannel(selectedChannel)}><RefreshCw className="w-4 h-4" /></Button>
                      <a href={`https://youtube.com/channel/${selectedChannel.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="w-3 h-3" /> YouTube</Button>
                      </a>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeChannel(selectedChannel.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="bg-secondary/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{formatNumber(selectedChannel.subscribers)}</p>
                      <p className="text-[10px] text-muted-foreground">Inscritos</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{formatNumber(selectedChannel.views)}</p>
                      <p className="text-[10px] text-muted-foreground">Views Totais</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{selectedChannel.videos}</p>
                      <p className="text-[10px] text-muted-foreground">Vídeos</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold">{selectedChannel.views && selectedChannel.videos ? formatNumber(Math.round(selectedChannel.views / selectedChannel.videos)) : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Views/Vídeo</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-secondary/50 border border-border/50">
                    <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-4 h-4" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="competitors" className="gap-1"><Trophy className="w-4 h-4" />Concorrentes</TabsTrigger>
                    <TabsTrigger value="suggestions" className="gap-1"><Lightbulb className="w-4 h-4" />Sugestões</TabsTrigger>
                  </TabsList>

                  {/* Overview: comparison if multiple channels */}
                  <TabsContent value="overview" className="space-y-4">
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

                    {/* Analysis data if available */}
                    {selectedChannel.analysis_json && (
                      <div className="glass rounded-xl p-5 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4" /> Análise IA</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(selectedChannel.analysis_json as Record<string, any>)
                            .filter(([k]) => ['seo_score', 'title_quality_score', 'niche_fit_score', 'monetization_readiness'].includes(k))
                            .map(([key, val]) => (
                              <div key={key} className="bg-secondary/30 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</p>
                                <p className="text-lg font-bold">{String(val)}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Competitors */}
                  <TabsContent value="competitors" className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">País:</span>
                      {COUNTRIES.map(c => (
                        <Badge key={c.code}
                          className={`cursor-pointer text-[10px] ${competitorCountry === c.code ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground'}`}
                          onClick={() => { setCompetitorCountry(c.code); loadCompetitors(selectedChannel, c.code); }}>
                          {c.label}
                        </Badge>
                      ))}
                    </div>

                    {loadingCompetitors ? (
                      <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground mt-2">Buscando concorrentes...</p></div>
                    ) : competitors.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">Nenhum concorrente encontrado para {competitorCountry}.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {competitors.map((comp, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="glass rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm">{comp.channel_name}</h4>
                              <Badge className={GROWTH_COLORS[comp.growth_rate] || ''} variant="outline">{comp.growth_rate}</Badge>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span><Users className="w-3 h-3 inline mr-1" />{formatNumber(comp.subscribers)}</span>
                              <span><Eye className="w-3 h-3 inline mr-1" />{formatNumber(comp.avg_views)} avg</span>
                              <span>RPM ${comp.rpm_estimate}</span>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">{comp.niche}</Badge>
                              <Badge variant="outline" className="text-[10px]">{comp.style}</Badge>
                              <Badge variant="outline" className="text-[10px]">{comp.country}</Badge>
                            </div>
                            {comp.viral_patterns?.hooks?.length > 0 && (
                              <div className="text-[10px] text-muted-foreground italic truncate">
                                Hook: "{comp.viral_patterns.hooks[0]}"
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Video Suggestions */}
                  <TabsContent value="suggestions" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Sugestões de vídeos longos baseados em tendências e concorrentes</p>
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
                        <p className="text-sm text-muted-foreground">Clique em "Gerar Sugestões" para receber ideias de vídeos.</p>
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
                                {theme.why_viral && <p className="text-xs text-muted-foreground mt-1">{theme.why_viral}</p>}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {theme.viral_score && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">🔥 {theme.viral_score}/10</Badge>}
                                {theme.estimated_duration && <span className="text-[10px] text-muted-foreground">{theme.estimated_duration}</span>}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
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
                    <p className="text-[10px] text-emerald-400">● Conectado ao canal</p>
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
