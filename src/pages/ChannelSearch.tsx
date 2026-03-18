import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, Eye, Star, ExternalLink, Filter, Copy, TrendingUp, Shield, ShieldOff, Clock, Users, BarChart3, Flame, AlertTriangle, Globe, MapPin, Video, Tv, HelpCircle, Brain, Loader2, Rocket, Zap, Network, History, Trash2, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { DeepScanPanel } from '@/components/tubespy/DeepScanPanel';
import { EmergingChannelsTab } from '@/components/dubspy/EmergingChannelsTab';
import { ClusterTab } from '@/components/dubspy/ClusterTab';
import { formatNumber } from '@/lib/formatters';
import { NICHES, COUNTRIES, LANGUAGES, PERIODS } from '@/lib/constants';

interface VideoResult {
  id: string; title: string; channelTitle: string; channelId: string;
  thumbnail: string; views: number; likes: number; subscribers: number;
  publishedAt: string; duration: string; isOutlier?: boolean;
  engagementRate: string; viewsPerSub: string;
}

interface ChannelInfo {
  id: string; name: string; thumbnail: string; subscribers: number;
  totalViews: number; videoCount: number; avgViews: number;
  description?: string; country?: string; isMonetized: boolean;
}

const calcVPH = (views: number, publishedAt: string) => {
  const hours = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3600000);
  return Math.round(views / hours);
};

const calcOutlierScore = (views: number, medianViews: number) => {
  if (!medianViews) return 0;
  return Math.round((views / medianViews) * 10) / 10;
};

const TABS = [
  { id: 'videos', label: 'Vídeos', icon: Video, desc: 'Buscar vídeos virais por palavra-chave' },
  { id: 'channel', label: 'Canais', icon: Tv, desc: 'Espionar canal específico' },
  { id: 'emerging', label: 'Emergentes', icon: Rocket, desc: 'Canais novos com crescimento rápido' },
  { id: 'escapees', label: 'Algorithm Escapees', icon: Zap, desc: 'Canais que escaparam da bolha' },
  { id: 'cluster', label: 'Micro-Nichos', icon: Network, desc: 'Clustering de canais por IA' },
];

const ChannelSearch = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('videos');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [period, setPeriod] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');

  const [emulating, setEmulating] = useState<string | null>(null);
  const [emulationResult, setEmulationResult] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [deepScanning, setDeepScanning] = useState<string | null>(null);
  const [deepScanResult, setDeepScanResult] = useState<any>(null);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const medianViews = channelInfo?.avgViews || 156_000;
  const searchType = activeTab === 'channel' ? 'channel' : 'video';

  // Load saved searches on mount
  useEffect(() => {
    const loadSaved = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (data) setSavedSearches(data);
    };
    loadSaved();
  }, []);

  const saveSearch = useCallback(async (q: string, tab: string, res: VideoResult[], ch: ChannelInfo | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !q.trim()) return;
    const filters = { niche, country, language, period, minViews, minSubs, maxSubs };
    
    // Upsert by query+tab
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('user_id', user.id)
      .eq('query', q)
      .eq('tab', tab)
      .maybeSingle();

    if (existing) {
      await supabase.from('saved_searches').update({
        results_json: res as any,
        channel_info_json: ch as any,
        filters_json: filters as any,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('saved_searches').insert({
        user_id: user.id,
        query: q,
        tab,
        results_json: res as any,
        channel_info_json: ch as any,
        filters_json: filters as any,
      });
    }

    // Refresh list
    const { data: refreshed } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (refreshed) setSavedSearches(refreshed);
  }, [niche, country, language, period, minViews, minSubs, maxSubs]);

  const loadSearch = (saved: any) => {
    setQuery(saved.query);
    setActiveTab(saved.tab);
    setResults((saved.results_json as VideoResult[]) || []);
    setChannelInfo((saved.channel_info_json as ChannelInfo) || null);
    const f = (saved.filters_json as any) || {};
    setNiche(f.niche || '');
    setCountry(f.country || '');
    setLanguage(f.language || '');
    setPeriod(f.period || '');
    setMinViews(f.minViews || '');
    setMinSubs(f.minSubs || '');
    setMaxSubs(f.maxSubs || '');
    setHasSearched(true);
    setShowSaved(false);
    toast.success('Pesquisa carregada!');
  };

  const deleteSearch = async (id: string) => {
    await supabase.from('saved_searches').delete().eq('id', id);
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    toast.success('Pesquisa removida');
  };

  const searchVideos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setChannelInfo(null);
    setResults([]);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-videos', {
        body: { query, searchType, niche, language, country, period, minViews, minSubs, maxSubs },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const r = data?.results || [];
      const ch = data?.channel || null;
      setResults(r);
      setChannelInfo(ch);
      if (!r.length) toast.info('Nenhum vídeo encontrado');
      // Auto-save
      await saveSearch(query, activeTab, r, ch);
      // Auto-learn from search results (fire-and-forget)
      if (r.length > 0) {
        supabase.functions.invoke('learn-from-user', {
          body: { type: 'search', data: { query, niche, results: r.slice(0, 15) } },
        }).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na busca');
    } finally {
      setLoading(false);
    }
  };

  const emulateChannel = async (channelId: string) => {
    setEmulating(channelId);
    try {
      const { data, error } = await supabase.functions.invoke('emulate-channel', { body: { channelId } });
      if (error) throw error;
      setEmulationResult(data);
    } catch {
      toast.error('Erro ao emular canal');
    } finally {
      setEmulating(null);
    }
  };

  const trackChannel = async (video: VideoResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('Faça login');
    const { error } = await supabase.from('tracked_channels').insert({
      user_id: user.id, youtube_channel_id: video.channelId,
      channel_name: video.channelTitle, subscribers: video.subscribers,
    } as any);
    if (error?.code === '23505') return toast.info('Canal já rastreado');
    if (error) return toast.error('Erro');
    toast.success(`${video.channelTitle} rastreado!`);
  };

  const deepScanRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const deepScanVideo = async (videoId: string) => {
    setDeepScanning(videoId);
    setDeepScanResult(null);
    toast.info('🧠 Deep Scan iniciado! Analisando vídeo...');
    try {
      const { data, error } = await supabase.functions.invoke('deep-scan-video', {
        body: { videoId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDeepScanResult(data);
      toast.success('✅ Deep Scan completo! Veja o resultado abaixo.');
      // Auto-learn from video analysis (fire-and-forget)
      if (data?.analysis) {
        supabase.functions.invoke('learn-from-user', {
          body: { type: 'video_analysis', data: { videoInfo: data.videoInfo, analysis: data.analysis } },
        }).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro no Deep Scan');
    } finally {
      setDeepScanning(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center glow-accent">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">DubSpy — Inteligência YouTube Avançada</h1>
            <p className="text-sm text-muted-foreground">Descubra canais emergentes, algorithm escapees, micro-nichos e engenharia reversa de virais</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                activeTab === tab.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border/50 bg-secondary/30 hover:border-primary/30 text-muted-foreground'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Saved Searches Toggle + Panel */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <History className="w-3.5 h-3.5" />
            {showSaved ? 'Esconder' : 'Ver'} pesquisas salvas
            {savedSearches.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{savedSearches.length}</Badge>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showSaved && savedSearches.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="glass rounded-xl p-4 space-y-2 border-primary/10">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <Save className="w-3 h-3" /> Pesquisas salvas automaticamente
                </p>
                {savedSearches.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2 group">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadSearch(s)}>
                      <p className="text-sm font-medium truncate">{s.query}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground">
                        <span>{s.tab === 'channel' ? '📺 Canal' : '🎬 Vídeos'}</span>
                        <span>{((s.results_json as any[]) || []).length} resultados</span>
                        <span>{new Date(s.updated_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteSearch(s.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Content */}
        {(activeTab === 'videos' || activeTab === 'channel') && (
          <>
            {/* Search Form */}
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5 space-y-4 border-primary/10">
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-accent" /> Qual nicho?
                  </label>
                  <select value={niche} onChange={e => setNiche(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                    {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-accent" /> Qual país?
                  </label>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {activeTab === 'channel' ? '🔗 Cole o link, @handle ou nome do canal' : '🔍 Palavra-chave, link ou tema'}
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={activeTab === 'channel'
                        ? 'Ex: youtube.com/@MrBeast, @Fazendo_Milhoes'
                        : 'Ex: como ganhar dinheiro online, renda passiva 2026'}
                      value={query} onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
                      className="pl-10 bg-secondary/50 h-12 text-base" />
                  </div>
                  <Button onClick={searchVideos} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-6">
                    <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Espionar'}
                  </Button>
                </div>
              </div>

              {/* Advanced Filters */}
              <div>
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  <Filter className="w-3 h-3" /> {showAdvancedFilters ? 'Esconder' : 'Mostrar'} filtros avançados
                </button>
                <AnimatePresence>
                  {showAdvancedFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="flex gap-3 flex-wrap mt-3 pt-3 border-t border-border/30">
                        <select value={language} onChange={e => setLanguage(e.target.value)}
                          className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                        <select value={period} onChange={e => setPeriod(e.target.value)}
                          className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <Input placeholder="Min views" value={minViews} onChange={e => setMinViews(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
                        <Input placeholder="Min subs" value={minSubs} onChange={e => setMinSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
                        <Input placeholder="Max subs" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Channel Card */}
            {channelInfo && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-5">
                <div className="flex items-center gap-5 flex-wrap">
                  {channelInfo.thumbnail && (
                    <img src={channelInfo.thumbnail} alt={channelInfo.name} className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg">{channelInfo.name}</h3>
                      {channelInfo.isMonetized ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                          <Shield className="w-3 h-3" /> Monetização: ATIVADA
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldOff className="w-3 h-3" /> Monetização: DESATIVADA
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{channelInfo.description}</p>
                  </div>
                  <div className="flex gap-6 text-center flex-wrap">
                    <div>
                      <p className="text-lg font-bold">{formatNumber(channelInfo.subscribers)}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Inscritos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{formatNumber(channelInfo.totalViews)}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Views Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{channelInfo.videoCount}</p>
                      <p className="text-[10px] text-muted-foreground">Vídeos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{formatNumber(channelInfo.avgViews)}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Média</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1 text-xs"
                    onClick={() => emulateChannel(channelInfo.id)} disabled={!!emulating}>
                    <Copy className="w-3 h-3" /> Modelar Canal
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs"
                    onClick={() => {
                      if (channelInfo) {
                        setQuery(channelInfo.name);
                        setActiveTab('emerging');
                        toast.info(`Buscando canais similares a ${channelInfo.name}...`);
                      }
                    }}>
                    <TrendingUp className="w-3 h-3" /> Canais Similares
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Emulation Result */}
            {emulationResult && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-xl p-6 border border-primary/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><Copy className="w-4 h-4 text-primary" /> Roadmap de Emulação</h3>
                  <Button variant="ghost" size="sm" onClick={() => setEmulationResult(null)}>✕</Button>
                </div>
                <p className="text-sm text-muted-foreground">{emulationResult.roadmap?.strategy}</p>
              </motion.div>
            )}

            {/* Results info */}
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{results.length} vídeos encontrados</Badge>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                  {results.filter(v => calcOutlierScore(v.views, medianViews) >= 3).length} outliers detectados
                </Badge>
              </div>
            )}

            {/* Data Table */}
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead className="w-16">Thumb</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="text-right">VPH</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Publicado</TableHead>
                        <TableHead className="text-right">Outlier Score</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((v) => {
                        const vph = calcVPH(v.views, v.publishedAt);
                        const outlierScore = calcOutlierScore(v.views, medianViews);
                        const isHot = outlierScore >= 3;
                        return (
                          <TableRow key={v.id} className={`border-border/30 transition-colors ${isHot ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-secondary/30'}`}>
                            <TableCell>
                              <div className="relative w-16 h-10 rounded overflow-hidden">
                                {v.thumbnail ? (
                                  <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                {isHot && (
                                  <span className="absolute -top-1 -right-1 bg-accent text-[8px] font-bold text-accent-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Flame className="w-2 h-2" /> {Math.round(outlierScore)}x
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium line-clamp-1">{v.title}</p>
                                <p className="text-xs text-muted-foreground">{v.channelTitle} • {formatNumber(v.subscribers)} subs • {v.duration}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-mono ${vph >= 1000 ? 'text-accent font-bold' : ''}`}>
                                {formatNumber(vph)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {formatNumber(v.views)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {new Date(v.publishedAt).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-right">
                              {isHot ? (
                                <Badge className="bg-accent/20 text-accent border-accent/30 gap-1">
                                  <Flame className="w-3 h-3" /> Outlier {Math.round(outlierScore)}x
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">{outlierScore}x</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7" 
                                  onClick={() => deepScanVideo(v.id)} 
                                  disabled={deepScanning === v.id}
                                  title="Deep Scan — Engenharia Reversa">
                                  {deepScanning === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3 text-primary" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => trackChannel(v)} title="Rastrear canal">
                                  <Star className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => window.open(`https://youtube.com/watch?v=${v.id}`, '_blank')} title="Abrir no YouTube">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}

            {/* Deep Scan Result Panel */}
            <AnimatePresence>
              {deepScanResult && (
                <div ref={deepScanRef}>
                <DeepScanPanel result={deepScanResult} onClose={() => setDeepScanResult(null)} onCloneToScript={() => {
                  // Store FULL clone data for Scripts page
                  // Parse duration string to seconds (e.g. "36:12" -> 2172)
                  const durStr = deepScanResult.videoInfo.duration || '';
                  const durParts = durStr.split(':').map(Number);
                  let durationSeconds = 0;
                  if (durParts.length === 3) durationSeconds = durParts[0] * 3600 + durParts[1] * 60 + durParts[2];
                  else if (durParts.length === 2) durationSeconds = durParts[0] * 60 + durParts[1];
                  
                  const cloneData = {
                    videoTitle: deepScanResult.videoInfo.title,
                    channelTitle: deepScanResult.videoInfo.channelTitle,
                    views: deepScanResult.videoInfo.views,
                    duration: deepScanResult.videoInfo.duration,
                    durationSeconds,
                    durationMinutes: Math.round(durationSeconds / 60),
                    visualStyle: deepScanResult.analysis.visualStyle?.primaryStyle || 'cinematográfico',
                    visualDna: deepScanResult.analysis.visualStyle || {},
                    niche: deepScanResult.analysis.contentDNA?.nicheCategory || '',
                    emotionalTone: deepScanResult.analysis.contentDNA?.emotionalTone || '',
                    format: deepScanResult.analysis.contentDNA?.format || '',
                    psychTriggers: deepScanResult.analysis.contentDNA?.psychTriggers || [],
                    hookType: deepScanResult.analysis.hookAnalysis?.hookType || '',
                    hookText: deepScanResult.analysis.hookAnalysis?.hookText || '',
                    hookScript: deepScanResult.analysis.cloneTemplate?.hookScript || '',
                    whyItWorks: deepScanResult.analysis.hookAnalysis?.whyItWorks || '',
                    templateStructure: deepScanResult.analysis.cloneTemplate?.templateStructure || '',
                    scriptOutline: deepScanResult.analysis.cloneTemplate?.scriptOutline || '',
                    ctaScript: deepScanResult.analysis.cloneTemplate?.ctaScript || '',
                    titleVariations: deepScanResult.analysis.cloneTemplate?.titleVariations || [],
                    thumbnailRecipe: deepScanResult.analysis.cloneTemplate?.thumbnailRecipe || '',
                    suggestedDuration: deepScanResult.analysis.cloneTemplate?.suggestedDuration || '',
                    retentionMap: deepScanResult.analysis.retentionMap || {},
                    rewatchSegments: deepScanResult.analysis.rewatchSegments || [],
                    scores: deepScanResult.analysis.scores || {},
                  };
                  sessionStorage.setItem('clone_full_data', JSON.stringify(cloneData));
                  navigate('/scripts');
                  toast.success('🎬 Engenharia reversa completa! Gerando roteiro modelado...');
                }} />
                </div>
              )}
            </AnimatePresence>

            {/* Deep Scanning Loader */}
            {deepScanning && (
              <motion.div ref={deepScanRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-xl p-8 text-center border border-primary/20">
                <Brain className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
                <h3 className="font-bold text-lg">Deep Scan em Andamento...</h3>
                <p className="text-sm text-muted-foreground mt-1">Analisando hooks, retenção, DNA do conteúdo e gerando template de clonagem</p>
                <div className="flex justify-center gap-2 mt-4">
                  {['Hook', 'Retenção', 'DNA', 'CTR', 'Clone'].map((step, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
                      {step}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {hasSearched && !loading && results.length === 0 && !channelInfo && (
              <div className="glass rounded-xl p-12 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum resultado encontrado. Tente outra busca.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'emerging' && <EmergingChannelsTab mode="emerging" />}
        {activeTab === 'escapees' && <EmergingChannelsTab mode="escapees" />}
        {activeTab === 'cluster' && <ClusterTab />}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
