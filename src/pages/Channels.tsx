import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { YouTubeOAuthConnect } from '@/components/dashboard/YouTubeOAuthConnect';
import { ReferenceChannelsTab } from '@/components/dashboard/ReferenceChannelsTab';
import { Youtube, Plus, Trash2, BarChart3, Users, Eye, Video, RefreshCw, ExternalLink, Globe, TrendingUp, Sparkles, Loader2, Bot, Send, Search, Trophy, Lightbulb, X, AlertTriangle, CheckCircle2, Target, DollarSign, Clock, Zap, ArrowUpRight, ArrowDownRight, Minus, Shield, Flame, Star, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';
import { COUNTRIES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { ChannelDNAModal } from '@/components/dashboard/ChannelDNAModal';
import { Switch } from '@/components/ui/switch';

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
  why_competitor?: string;
  what_they_do_better?: string;
  content_gap?: string;
  threat_level?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const THREAT_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  high: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', icon: Shield },
  medium: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle },
  low: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
};

const GROWTH_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  explosive: { bg: 'bg-red-500/15', text: 'text-red-400', label: '🚀 Explosivo' },
  growing: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: '📈 Crescendo' },
  steady: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: '➡️ Estável' },
  declining: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', label: '📉 Declínio' },
};

const ScoreGauge = ({ value, label, max = 100, color = 'primary' }: { value: number; label: string; max?: number; color?: string }) => {
  const pct = Math.min((value / max) * 100, 100);
  const colorClass = pct >= 70 ? 'from-emerald-500 to-emerald-400' : pct >= 40 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
          <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none"
            stroke={pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'}
            strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
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
  const [dnaChannel, setDnaChannel] = useState<any>(null);

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorKeywords, setCompetitorKeywords] = useState<string[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [competitorCountry, setCompetitorCountry] = useState('US');
  const [competitorInsights, setCompetitorInsights] = useState<any>(null);

  const [videoSuggestions, setVideoSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [chatMessages]);

  const syncOAuthChannels = async (userId: string) => {
    try {
      const { data: oauthChannels } = await supabase
        .from('youtube_oauth_tokens_safe' as any)
        .select('channel_id, channel_name, channel_thumbnail')
        .eq('user_id', userId) as any;
      if (!oauthChannels || oauthChannels.length === 0) return;
      for (const ch of oauthChannels) {
        await supabase.from('user_channels').upsert({
          user_id: userId,
          youtube_channel_id: ch.channel_id,
          channel_name: ch.channel_name,
          thumbnail: ch.channel_thumbnail,
        } as any, { onConflict: 'user_id,youtube_channel_id', ignoreDuplicates: true } as any);
      }
    } catch (err) {
      console.error('OAuth sync error:', err);
    }
  };

  const loadChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    await syncOAuthChannels(user.id);
    const { data } = await supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }) as any;
    const freshChannels = data || [];
    setChannels(freshChannels);
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
      toast.info('Buscando canal...');
      const { data: chData, error } = await supabase.functions.invoke('resolve-channel', { body: { channelInput: channelInput.trim() } });
      if (error || chData?.error) throw new Error(chData?.error || error?.message);
      const { data: inserted } = await supabase.from('user_channels').insert({
        user_id: user.id, youtube_channel_id: chData.channelId, channel_name: chData.name,
        thumbnail: chData.thumbnail, subscribers: chData.subscribers, views: chData.views, videos: chData.videos,
      } as any).select().single() as any;
      toast.success('Canal adicionado! Analisando...');
      setChannelInput('');
      setShowAdd(false);
      await loadChannels();
      if (inserted) {
        setAnalyzingChannel(true);
        try {
          const { data: analysisData, error: analysisErr } = await supabase.functions.invoke('analyze-channel', { body: { channelInput: chData.channelId } });
          if (!analysisErr && analysisData && !analysisData.error) {
            await supabase.from('user_channels').update({
              analysis_json: { ...analysisData.analysis, recentVideos: analysisData.recentVideos, topVideos: analysisData.topVideos, avgRecentViews: analysisData.avgRecentViews, realMetrics: analysisData.realMetrics },
              niche: analysisData.analysis?.niche_detected || null,
            } as any).eq('id', inserted.id);
            toast.success('Análise completa!');
            await loadChannels();
          }
        } catch { toast.warning('Análise automática falhou. Use o botão de atualizar.'); }
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
        analysis_json: { ...data.analysis, recentVideos: data.recentVideos, topVideos: data.topVideos, avgRecentViews: data.avgRecentViews, realMetrics: data.realMetrics },
      } as any).eq('id', ch.id);
      toast.success('Canal atualizado!');
      loadChannels();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const loadCompetitors = async (ch: Channel, country: string) => {
    setLoadingCompetitors(true);
    setCompetitors([]);
    setCompetitorInsights(null);
    try {
      const analysis = ch.analysis_json;
      const topTitles = [...(analysis?.topVideos || []).map((v: any) => v.title), ...(analysis?.recentVideos || []).map((v: any) => v.title)].slice(0, 10);
      if (topTitles.length === 0) { toast.warning('Atualize o canal primeiro.'); setLoadingCompetitors(false); return; }
      const { data, error } = await supabase.functions.invoke('find-competitors-ai', {
        body: { channelId: ch.youtube_channel_id, channelName: ch.channel_name, topVideoTitles: topTitles, subscribers: ch.subscribers, niche: ch.niche || analysis?.niche_detected || '', country },
      });
      if (error) throw error;
      setCompetitors(data?.competitors || []);
      setCompetitorKeywords(data?.keywords || []);
      setCompetitorInsights(data?.insights || null);
    } catch { toast.error('Erro ao buscar concorrentes'); }
    setLoadingCompetitors(false);
  };

  const loadVideoSuggestions = async (ch: Channel) => {
    setLoadingSuggestions(true);
    try {
      const analysis = ch.analysis_json;
      const compTitles = competitors.flatMap(c => c.topVideos?.map(v => v.title) || []).slice(0, 10);
      const { data, error } = await supabase.functions.invoke('suggest-themes', {
        body: {
          niche: ch.niche || analysis?.niche_detected || 'faceless',
          style: analysis?.content_strategy ? 'baseado na estratégia: ' + analysis.content_strategy : 'documentário',
          language: 'português', count: 8,
          topic: compTitles.length > 0 ? `Inspirado nos concorrentes: ${compTitles.slice(0, 3).join(', ')}` : undefined,
          channelStrengths: analysis?.strengths?.slice(0, 3),
          channelWeaknesses: analysis?.weaknesses?.slice(0, 3),
          contentGaps: competitorInsights?.content_gaps?.slice(0, 3),
          realMetrics: analysis?.realMetrics ? {
            sub_watch_ratio: analysis.realMetrics.sub_watch_ratio,
            engagement_health: analysis.realMetrics.engagement_health,
            best_upload_day: analysis.realMetrics.best_upload_day,
            avg_duration_seconds: analysis.realMetrics.avg_duration_seconds,
          } : undefined,
          viralTopics: analysis?.viral_potential_topics?.slice(0, 3),
          bestContentType: analysis?.best_content_type,
          recommendedLength: analysis?.recommended_video_length,
        },
      });
      if (error) throw error;
      setVideoSuggestions(data?.themes || []);
    } catch (e: any) {
      if (e?.message?.includes('429')) toast.error('Rate limit.');
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
      content: `👋 Sou seu assistente para **${ch.channel_name}**.\n\n📊 ${formatNumber(ch.subscribers)} subs · ${formatNumber(ch.views)} views${ch.niche ? ` · ${ch.niche}` : ''}\n\nPergunte sobre estratégias, concorrentes, ou ideias!`
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
        `Canal: ${selectedChannel.channel_name}`, `${formatNumber(selectedChannel.subscribers)} subs`,
        `Nicho: ${selectedChannel.niche || analysis?.niche_detected || 'N/A'}`,
        analysis?.strengths ? `Forças: ${analysis.strengths.join(', ')}` : '',
        analysis?.weaknesses ? `Fraquezas: ${analysis.weaknesses.join(', ')}` : '',
        analysis?.content_strategy ? `Estratégia: ${analysis.content_strategy}` : '',
      ].filter(Boolean).join('. ') : '';
      const compContext = competitors.length > 0
        ? `Concorrentes: ${competitors.slice(0, 5).map(c => `${c.channelName} (${formatNumber(c.subscribers)} subs)`).join('; ')}`
        : '';
      const authH = await (await import('@/lib/auth-fetch')).getAuthHeaders();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: authH,
        body: JSON.stringify({ messages: [
          { role: 'user', content: `[CONTEXTO] ${channelContext}. ${compContext}. Foque em vídeos LONGOS. Use dados reais.` },
          ...newMessages.slice(1).map(m => ({ role: m.role, content: m.content })),
        ]}),
      });
      if (resp.status === 429) { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Rate limit. Tente em alguns segundos.' }]); setChatLoading(false); return; }
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
                if (last?.role === 'assistant' && prev.length > newMessages.length) return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
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
              <p className="text-sm text-muted-foreground">{channels.length} canais · {formatNumber(totalSubs)} inscritos</p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedChannel && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setChatOpen(!chatOpen)}>
                <Bot className="w-4 h-4" /> Assistente
              </Button>
            )}
            <Button onClick={() => setShowAdd(!showAdd)} className="gradient-hero border-0 gap-2">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>
        </div>

        {/* YouTube OAuth Connect */}
        <YouTubeOAuthConnect />

        {showAdd && (
          <div className="glass rounded-xl p-5 flex gap-3">
            <Input value={channelInput} onChange={e => setChannelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addChannel()} placeholder="URL do canal ou @username" className="bg-secondary/50" />
            <Button onClick={addChannel} disabled={addingChannel} className="gradient-hero border-0">
              {addingChannel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </div>
        )}

        {analyzingChannel && (
          <div className="glass rounded-xl p-4 flex items-center gap-3 border-primary/30">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando canal com IA...</p>
          </div>
        )}

        {/* Aggregate stats */}
        {channels.length > 1 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { v: channels.length, l: 'Canais', icon: Youtube },
              { v: formatNumber(totalSubs), l: 'Inscritos', icon: Users },
              { v: formatNumber(totalViews), l: 'Views', icon: Eye },
              { v: totalVideos, l: 'Vídeos', icon: Video },
            ].map((s, i) => (
              <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{s.v}</p>
                  <p className="text-[10px] text-muted-foreground">{s.l}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          {/* Channel list sidebar */}
          <div className="w-64 flex-shrink-0 space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
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
                <p className="text-sm text-muted-foreground">Clique em um canal para ver análise, concorrentes e sugestões.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Channel header */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-4">
                    {selectedChannel.thumbnail && <img src={selectedChannel.thumbnail} alt="" className="w-14 h-14 rounded-full ring-2 ring-primary/20" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{selectedChannel.channel_name}</h2>
                        {selectedChannel.niche && <Badge variant="outline" className="text-primary border-primary/30">{selectedChannel.niche}</Badge>}
                        {!analysis && <Badge variant="outline" className="text-amber-400 border-amber-500/30">Sem análise</Badge>}
                      </div>
                      <div className="flex gap-4 mt-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{formatNumber(selectedChannel.subscribers)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{formatNumber(selectedChannel.views)}</span>
                        <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" />{selectedChannel.videos}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => refreshChannel(selectedChannel)} title="Atualizar"><RefreshCw className="w-4 h-4" /></Button>
                      <a href={`https://youtube.com/channel/${selectedChannel.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1"><ExternalLink className="w-3 h-3" /> YouTube</Button>
                      </a>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeChannel(selectedChannel.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={v => {
                  setActiveTab(v);
                  if (v === 'competitors' && competitors.length === 0 && selectedChannel) loadCompetitors(selectedChannel, competitorCountry);
                  if (v === 'suggestions' && videoSuggestions.length === 0 && selectedChannel) loadVideoSuggestions(selectedChannel);
                }}>
                  <TabsList className="bg-secondary/50 border border-border/50">
                    <TabsTrigger value="overview" className="gap-1"><BarChart3 className="w-4 h-4" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="competitors" className="gap-1"><Trophy className="w-4 h-4" />Concorrentes</TabsTrigger>
                    <TabsTrigger value="suggestions" className="gap-1"><Lightbulb className="w-4 h-4" />Sugestões</TabsTrigger>
                    <TabsTrigger value="references" className="gap-1"><Target className="w-4 h-4" />Referências</TabsTrigger>
                  </TabsList>

                  {/* ==================== OVERVIEW TAB ==================== */}
                  <TabsContent value="overview" className="space-y-4 mt-4">
                    {!analysis ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                        <p className="text-sm text-muted-foreground mb-3">Este canal ainda não foi analisado.</p>
                        <Button onClick={() => refreshChannel(selectedChannel)} className="gradient-hero border-0 gap-2"><Sparkles className="w-4 h-4" /> Analisar Agora</Button>
                      </div>
                    ) : (
                      <>
                        {/* Health Gauges */}
                        <div className="glass rounded-xl p-5">
                          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Saúde do Canal</h3>
                          <div className="flex justify-around">
                            <ScoreGauge value={analysis.seo_score || 0} label="SEO" />
                            <ScoreGauge value={analysis.title_quality_score || 0} label="Títulos" />
                            <ScoreGauge value={analysis.niche_fit_score || 0} label="Fit do Nicho" />
                            <ScoreGauge value={analysis.monetization_readiness || 0} label="Monetização" />
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="w-16 h-16 rounded-full bg-secondary/50 flex flex-col items-center justify-center">
                                <span className="text-sm font-bold text-emerald-400">${analysis.estimated_rpm || '—'}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">RPM Est.</span>
                            </div>
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="w-16 h-16 rounded-full bg-secondary/50 flex flex-col items-center justify-center">
                                <span className="text-xs font-bold">{analysis.avgRecentViews ? formatNumber(analysis.avgRecentViews) : '—'}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">Avg Views</span>
                            </div>
                          </div>
                        </div>

                        {/* Real Engagement Metrics */}
                        {analysis.realMetrics && (
                          <div className="glass rounded-xl p-5">
                            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Métricas Reais de Engajamento</h3>
                            <div className="grid grid-cols-4 gap-3 mb-4">
                              {[
                                { label: '👥 Inscritos que Assistem', value: `${analysis.realMetrics.sub_watch_ratio}%`, sub: analysis.realMetrics.sub_loyalty === 'alta' ? '🟢 Lealdade Alta' : analysis.realMetrics.sub_loyalty === 'média' ? '🟡 Lealdade Média' : '🔴 Lealdade Baixa', color: analysis.realMetrics.sub_loyalty === 'alta' ? 'border-emerald-500/30 bg-emerald-500/5' : analysis.realMetrics.sub_loyalty === 'média' ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5' },
                                { label: '💬 Taxa Engajamento', value: `${analysis.realMetrics.avg_engagement_rate}%`, sub: analysis.realMetrics.engagement_health === 'excelente' ? '🟢 Excelente' : analysis.realMetrics.engagement_health === 'bom' ? '🟢 Bom' : '🟡 Regular', color: analysis.realMetrics.engagement_health === 'excelente' || analysis.realMetrics.engagement_health === 'bom' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5' },
                                { label: '📅 Frequência Upload', value: `${analysis.realMetrics.avg_days_between_uploads}d`, sub: analysis.realMetrics.consistency_score === 'excelente' ? '🟢 Excelente' : analysis.realMetrics.consistency_score === 'bom' ? '🟢 Bom' : '🟡 Regular', color: analysis.realMetrics.consistency_score === 'excelente' || analysis.realMetrics.consistency_score === 'bom' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5' },
                                { label: '⏱ Duração Média', value: analysis.realMetrics.avg_duration_seconds > 3600 ? `${Math.round(analysis.realMetrics.avg_duration_seconds / 60)}min` : `${Math.floor(analysis.realMetrics.avg_duration_seconds / 60)}:${String(analysis.realMetrics.avg_duration_seconds % 60).padStart(2, '0')}`, sub: `📊 ${analysis.realMetrics.total_recent_videos} vídeos analisados`, color: 'border-border/50 bg-secondary/20' },
                              ].map((m, i) => (
                                <div key={i} className={`rounded-lg p-3 border ${m.color}`}>
                                  <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                                  <p className="text-lg font-bold">{m.value}</p>
                                  <p className="text-[9px] mt-1">{m.sub}</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-secondary/20 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground">❤️ Taxa de Likes</p>
                                <p className="text-sm font-bold">{analysis.realMetrics.avg_like_rate}%</p>
                              </div>
                              <div className="bg-secondary/20 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground">💬 Taxa Comentários</p>
                                <p className="text-sm font-bold">{analysis.realMetrics.avg_comment_rate}%</p>
                              </div>
                              <div className="bg-secondary/20 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground">📆 Melhor Dia</p>
                                <p className="text-sm font-bold">{analysis.realMetrics.best_upload_day}</p>
                              </div>
                            </div>
                            {(analysis.realMetrics.outlier_count > 0 || analysis.realMetrics.underperforming_count > 0) && (
                              <div className="flex gap-3 mt-3">
                                {analysis.realMetrics.outlier_count > 0 && (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">🚀 {analysis.realMetrics.outlier_count} vídeos virais (3x+ média)</Badge>
                                )}
                                {analysis.realMetrics.underperforming_count > 0 && (
                                  <Badge className="bg-red-500/10 text-red-400 border-red-500/30">📉 {analysis.realMetrics.underperforming_count} abaixo de 30% da média</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Engagement Diagnosis */}
                        {(analysis.engagement_diagnosis || analysis.subscriber_loyalty_analysis) && (
                          <div className="grid grid-cols-2 gap-4">
                            {analysis.engagement_diagnosis && (
                              <div className="glass rounded-xl p-4">
                                <h4 className="font-semibold text-xs flex items-center gap-1.5 mb-2"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Diagnóstico de Engajamento</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.engagement_diagnosis}</p>
                              </div>
                            )}
                            {analysis.subscriber_loyalty_analysis && (
                              <div className="glass rounded-xl p-4">
                                <h4 className="font-semibold text-xs flex items-center gap-1.5 mb-2"><Users className="w-3.5 h-3.5 text-primary" /> Lealdade dos Inscritos</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.subscriber_loyalty_analysis}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Viral Potential Topics */}
                        {analysis.viral_potential_topics?.length > 0 && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><Flame className="w-4 h-4 text-primary" /> Tópicos com Potencial Viral</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {analysis.viral_potential_topics.map((t: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 bg-primary/5 rounded-lg p-2.5">
                                  <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">{t}</span>
                                </div>
                              ))}
                            </div>
                            {(analysis.best_content_type || analysis.recommended_video_length) && (
                              <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
                                {analysis.best_content_type && <span>📹 Melhor formato: <strong className="text-foreground">{analysis.best_content_type}</strong></span>}
                                {analysis.recommended_video_length && <span>⏱ Duração ideal: <strong className="text-foreground">{analysis.recommended_video_length}</strong></span>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Strengths & Weaknesses — side by side with icons */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Pontos Fortes</h4>
                            <div className="space-y-2">
                              {(analysis.strengths || []).map((s: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 bg-emerald-500/5 rounded-lg p-2">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-400" /> Pontos Fracos</h4>
                            <div className="space-y-2">
                              {(analysis.weaknesses || []).map((w: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 bg-amber-500/5 rounded-lg p-2">
                                  <ArrowDownRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">{w}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Strategy + Revenue + Growth in 3 cols */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-xs flex items-center gap-1.5 mb-2"><Target className="w-3.5 h-3.5 text-primary" /> Estratégia</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{analysis.content_strategy || '—'}</p>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-xs flex items-center gap-1.5 mb-2"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Monetização</h4>
                            <div className="space-y-1.5 text-xs text-muted-foreground">
                              <p>Receita: <span className="text-foreground font-medium">{analysis.estimated_monthly_revenue || '—'}</span></p>
                              <p>Frequência: <span className="text-foreground font-medium">{analysis.upload_frequency_recommendation || '—'}</span></p>
                            </div>
                          </div>
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-xs flex items-center gap-1.5 mb-2"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Crescimento</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">{analysis.growth_potential || '—'}</p>
                          </div>
                        </div>

                        {/* SEO + Title improvements */}
                        {(analysis.seo_improvements?.length > 0 || analysis.title_improvements?.length > 0) && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><Zap className="w-4 h-4 text-primary" /> Ações Recomendadas</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {analysis.seo_improvements?.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-primary uppercase font-medium mb-1.5">SEO</p>
                                  {analysis.seo_improvements.map((s: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 mb-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground">{s}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {analysis.title_improvements?.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-amber-400 uppercase font-medium mb-1.5">Títulos</p>
                                  {analysis.title_improvements.map((t: string, i: number) => (
                                    <div key={i} className="flex items-start gap-2 mb-1.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground">{t}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Top Videos with visual bars */}
                        {analysis.topVideos?.length > 0 && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><Flame className="w-4 h-4 text-red-400" /> Top Vídeos por Views</h4>
                            <div className="space-y-2">
                              {analysis.topVideos.slice(0, 5).map((v: any, i: number) => {
                                const maxViews = analysis.topVideos[0]?.views || 1;
                                const pct = (v.views / maxViews) * 100;
                                return (
                                  <div key={i} className="relative">
                                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/10 to-transparent" style={{ width: `${pct}%` }} />
                                    <div className="relative flex items-center gap-3 p-2.5 rounded-lg">
                                      <span className="text-xs font-bold text-primary w-5">#{i + 1}</span>
                                      <span className="text-sm flex-1 truncate">{v.title}</span>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{formatNumber(v.views)}</span>
                                        {v.likes && <span>❤️ {formatNumber(v.likes)}</span>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Recent Videos performance */}
                        {analysis.recentVideos?.length > 0 && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-muted-foreground" /> Vídeos Recentes</h4>
                            <div className="space-y-2">
                              {analysis.recentVideos.slice(0, 5).map((v: any, i: number) => {
                                const avgV = analysis.avgRecentViews || 1;
                                const ratio = v.views / avgV;
                                const isOutlier = ratio >= 2;
                                const isBelow = ratio < 0.5;
                                return (
                                  <div key={i} className={`flex items-center gap-3 rounded-lg p-2.5 ${isOutlier ? 'bg-emerald-500/5 border border-emerald-500/20' : isBelow ? 'bg-red-500/5 border border-red-500/10' : 'bg-secondary/20'}`}>
                                    <span className="text-sm flex-1 truncate">{v.title}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{formatNumber(v.views)}</span>
                                      <Badge variant="outline" className={`text-[9px] ${isOutlier ? 'text-emerald-400 border-emerald-500/30' : isBelow ? 'text-red-400 border-red-500/30' : 'text-muted-foreground'}`}>
                                        {ratio.toFixed(1)}x avg
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Niche suggestions */}
                        {analysis.niche_change_suggestions?.length > 0 && (
                          <div className="glass rounded-xl p-4">
                            <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-primary" /> Nichos Alternativos</h4>
                            <div className="grid grid-cols-3 gap-3">
                              {analysis.niche_change_suggestions.map((n: any, i: number) => (
                                <div key={i} className="bg-secondary/30 rounded-lg p-3">
                                  <p className="text-sm font-medium">{n.niche}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{n.reason}</p>
                                  <Badge variant="outline" className="text-[9px] mt-2">{n.audience_retention_estimate}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Multi-channel comparison */}
                        {channels.length > 1 && (
                          <div className="glass rounded-xl p-5">
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Comparação</h3>
                            <div className="space-y-2">
                              {channels.map(ch => {
                                const maxSubs = Math.max(...channels.map(c => c.subscribers));
                                const pct = maxSubs > 0 ? (ch.subscribers / maxSubs) * 100 : 0;
                                return (
                                  <div key={ch.id} className={`flex items-center gap-3 p-2 rounded-lg ${ch.id === selectedChannel.id ? 'bg-primary/10' : 'bg-secondary/20'}`}>
                                    {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-6 h-6 rounded-full" />}
                                    <span className="text-sm font-medium w-28 truncate">{ch.channel_name}</span>
                                    <div className="flex-1 h-2.5 rounded-full bg-secondary/40 overflow-hidden">
                                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-20 text-right">{formatNumber(ch.subscribers)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* ==================== COMPETITORS TAB ==================== */}
                  <TabsContent value="competitors" className="space-y-4 mt-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground font-medium">País:</span>
                      {COUNTRIES.filter(c => c.value).map(c => (
                        <Badge key={c.value}
                          className={`cursor-pointer text-[10px] transition-all ${competitorCountry === c.value ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}`}
                          onClick={() => { setCompetitorCountry(c.value); loadCompetitors(selectedChannel, c.value); }}>
                          {c.label}
                        </Badge>
                      ))}
                      <Button size="sm" variant="outline" className="gap-1 ml-auto h-7 text-xs" onClick={() => loadCompetitors(selectedChannel, competitorCountry)}>
                        <RefreshCw className="w-3 h-3" /> Recarregar
                      </Button>
                    </div>

                    {competitorKeywords.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-medium">Queries IA:</span>
                        {competitorKeywords.map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Market Intelligence Panel */}
                    {competitorInsights && (
                      <div className="glass rounded-xl p-5 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent space-y-3">
                        <h4 className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Inteligência de Mercado</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Saturação</p>
                            <Badge variant="outline" className={`text-xs ${competitorInsights.market_saturation === 'high' ? 'text-red-400 border-red-500/30' : competitorInsights.market_saturation === 'medium' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                              {competitorInsights.market_saturation === 'high' ? '🔴 Alta' : competitorInsights.market_saturation === 'medium' ? '🟡 Média' : '🟢 Baixa'}
                            </Badge>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Maior Oportunidade</p>
                            <p className="text-xs font-medium">{competitorInsights.biggest_opportunity}</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Diferenciação</p>
                            <p className="text-xs">{competitorInsights.recommended_differentiation}</p>
                          </div>
                        </div>
                        {competitorInsights.content_gaps?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase mb-1.5">🎯 Gaps de Conteúdo — Oportunidades para você</p>
                            <div className="flex flex-wrap gap-1.5">
                              {competitorInsights.content_gaps.map((g: string, i: number) => (
                                <Badge key={i} className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] cursor-pointer hover:bg-emerald-500/20"
                                  onClick={() => { sessionStorage.setItem('outlier_topic', g); window.location.href = '/scripts'; }}>
                                  {g} →
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {loadingCompetitors ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-3">IA analisando concorrentes reais via YouTube...</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Buscando canais, analisando conteúdo, comparando métricas...</p>
                      </div>
                    ) : competitors.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">
                          {analysis ? 'Selecione um país para buscar concorrentes com IA.' : 'Atualize o canal primeiro.'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Comparison bar: Your channel vs competitors */}
                        <div className="glass rounded-xl p-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Seu canal vs Concorrentes (inscritos)</h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-primary w-24 truncate">{selectedChannel.channel_name}</span>
                              <div className="flex-1 h-3 rounded-full bg-secondary/40 overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((selectedChannel.subscribers / Math.max(...competitors.map(c => c.subscribers), selectedChannel.subscribers)) * 100, 100)}%` }} />
                              </div>
                              <span className="text-[10px] w-16 text-right">{formatNumber(selectedChannel.subscribers)}</span>
                            </div>
                            {competitors.slice(0, 6).map((c, i) => (
                              <div key={c.channelId} className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-24 truncate">{c.channelName}</span>
                                <div className="flex-1 h-3 rounded-full bg-secondary/40 overflow-hidden">
                                  <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${Math.min((c.subscribers / Math.max(...competitors.map(cc => cc.subscribers), selectedChannel.subscribers)) * 100, 100)}%` }} />
                                </div>
                                <span className="text-[10px] w-16 text-right">{formatNumber(c.subscribers)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Competitor cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {competitors.map((comp, i) => {
                            const threat = THREAT_STYLES[comp.threat_level || 'medium'] || THREAT_STYLES.medium;
                            const growth = GROWTH_STYLES[comp.growthRate || 'steady'] || GROWTH_STYLES.steady;
                            const ThreatIcon = threat.icon;
                            return (
                              <motion.div key={comp.channelId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                className={`glass rounded-xl p-4 space-y-3 border ${threat.bg} transition-colors`}>
                                <div className="flex items-start gap-3">
                                  {comp.thumbnail && <img src={comp.thumbnail} alt="" className="w-10 h-10 rounded-full" />}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate">{comp.channelName}</h4>
                                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                                      <span>{formatNumber(comp.subscribers)} subs</span>
                                      <span>{formatNumber(comp.avgViews)} avg views</span>
                                      <span>{comp.videoCount} vídeos</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge className={`${growth.bg} ${growth.text} border-0 text-[9px]`}>{growth.label}</Badge>
                                    <div className={`flex items-center gap-1 ${threat.text} text-[9px]`}>
                                      <ThreatIcon className="w-3 h-3" />
                                      <span className="font-medium">{comp.threat_level === 'high' ? 'Alto risco' : comp.threat_level === 'low' ? 'Baixo risco' : 'Risco médio'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* AI insights */}
                                {comp.why_competitor && (
                                  <div className="bg-primary/5 rounded-lg p-2.5">
                                    <p className="text-[10px] text-primary font-medium mb-0.5">💡 Por que é concorrente</p>
                                    <p className="text-[10px] text-muted-foreground">{comp.why_competitor}</p>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  {comp.what_they_do_better && (
                                    <div className="bg-amber-500/5 rounded-lg p-2">
                                      <p className="text-[9px] text-amber-400 font-medium">O que fazem melhor</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{comp.what_they_do_better}</p>
                                    </div>
                                  )}
                                  {comp.content_gap && (
                                    <div className="bg-emerald-500/5 rounded-lg p-2">
                                      <p className="text-[9px] text-emerald-400 font-medium">🎯 Gap para explorar</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">{comp.content_gap}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Top videos */}
                                {comp.topVideos?.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[9px] text-muted-foreground uppercase font-medium">Melhores vídeos</p>
                                    {comp.topVideos.slice(0, 3).map((v, vi) => (
                                      <a key={vi} href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/20 rounded px-2 py-1.5 hover:bg-secondary/40 transition-colors">
                                        <span className="flex-1 truncate">{v.title}</span>
                                        <span className="font-medium text-foreground">{formatNumber(v.views)}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <a href={`https://youtube.com/channel/${comp.channelId}`} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"><ExternalLink className="w-3 h-3" /> Canal</Button>
                                  </a>
                                  {comp.topVideos?.[0] && (
                                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-primary/30 text-primary"
                                      onClick={() => { sessionStorage.setItem('outlier_topic', comp.topVideos[0].title); window.location.href = '/scripts'; }}>
                                      <Sparkles className="w-3 h-3" /> Criar Similar
                                    </Button>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* ==================== SUGGESTIONS TAB ==================== */}
                  <TabsContent value="suggestions" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Sugestões de Vídeos</p>
                        <p className="text-[10px] text-muted-foreground">Baseadas no seu canal, concorrentes e gaps de mercado</p>
                      </div>
                      <Button onClick={() => loadVideoSuggestions(selectedChannel)} disabled={loadingSuggestions} size="sm" className="gradient-hero border-0 gap-2">
                        {loadingSuggestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Gerar Novas
                      </Button>
                    </div>

                    {loadingSuggestions ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-3">IA gerando sugestões contextuais...</p>
                      </div>
                    ) : videoSuggestions.length === 0 ? (
                      <div className="glass rounded-xl p-8 text-center">
                        <Lightbulb className="w-8 h-8 mx-auto mb-2 text-amber-400 opacity-40" />
                        <p className="text-sm text-muted-foreground">Carregando sugestões baseadas no seu canal...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {videoSuggestions.map((theme: any, i: number) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className="glass rounded-xl p-4 hover:border-primary/30 transition-colors group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm">{theme.title}</h4>
                                  {theme.viral_score && (
                                    <Badge className={`text-[9px] border-0 ${theme.viral_score >= 8 ? 'bg-red-500/15 text-red-400' : theme.viral_score >= 6 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-500/15 text-zinc-400'}`}>
                                      🔥 {theme.viral_score}/10
                                    </Badge>
                                  )}
                                </div>
                                {theme.hook && (
                                  <p className="text-xs text-primary mt-1.5 bg-primary/5 rounded-lg px-2.5 py-1.5 inline-block">
                                    🪝 Hook: "{theme.hook}"
                                  </p>
                                )}
                                {theme.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{theme.description}</p>}
                                {theme.why_viral && <p className="text-[10px] text-muted-foreground/60 mt-1 italic">📊 {theme.why_viral}</p>}
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                {theme.style && <Badge variant="outline" className="text-[10px]">{theme.style}</Badge>}
                                {theme.estimated_duration && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{theme.estimated_duration}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/30">
                              {theme.niche_tags?.map((t: string, ti: number) => (
                                <Badge key={ti} variant="secondary" className="text-[10px]">{t}</Badge>
                              ))}
                              <div className="flex-1" />
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 text-primary opacity-70 group-hover:opacity-100 transition-opacity"
                                onClick={() => { sessionStorage.setItem('outlier_topic', theme.title); window.location.href = '/scripts'; }}>
                                <Sparkles className="w-3 h-3" /> Criar Roteiro
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ==================== REFERENCES TAB ==================== */}
                  <TabsContent value="references" className="mt-4">
                    <ReferenceChannelsTab />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <AnimatePresence>
          {chatOpen && selectedChannel && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-6 right-6 z-50 w-[400px] h-[520px] glass rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-primary/20">
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Assistente — {selectedChannel.channel_name}</p>
                    <p className="text-[10px] text-emerald-400">● Online</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatOpen(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/80'}`}>
                      {msg.role === 'assistant' ? <div className="prose prose-sm prose-invert max-w-none text-foreground"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start"><div className="bg-secondary/80 rounded-xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>
                )}
              </div>
              <div className="p-3 border-t border-border/50">
                <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="flex gap-2">
                  <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Pergunte sobre seu canal..." className="bg-secondary/50 text-sm h-9" disabled={chatLoading} />
                  <Button type="submit" size="icon" className="h-9 w-9 gradient-hero border-0" disabled={chatLoading || !chatInput.trim()}><Send className="w-4 h-4" /></Button>
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
