import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, Eye, Star, ExternalLink, Filter, Copy, TrendingUp, Shield, ShieldOff, Clock, Users, BarChart3, Flame, AlertTriangle, Globe, MapPin, Video, Tv, HelpCircle, Brain, Loader2 } from 'lucide-react';
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

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const calcVPH = (views: number, publishedAt: string) => {
  const hours = Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 3600000);
  return Math.round(views / hours);
};

const calcOutlierScore = (views: number, medianViews: number) => {
  if (!medianViews) return 0;
  return Math.round((views / medianViews) * 10) / 10;
};

const NICHES = [
  { value: '', label: 'Qualquer nicho' },
  { value: 'finanças', label: '💰 Finanças' },
  { value: 'tecnologia', label: '💻 Tecnologia' },
  { value: 'saúde', label: '🏥 Saúde' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'educação', label: '📚 Educação' },
  { value: 'entretenimento', label: '🎭 Entretenimento' },
  { value: 'curiosidades', label: '🔍 Curiosidades' },
  { value: 'história', label: '📜 História' },
  { value: 'ciência', label: '🔬 Ciência' },
  { value: 'motivacional', label: '🚀 Motivacional' },
  { value: 'true crime', label: '🔎 True Crime' },
  { value: 'conspiração', label: '👁️ Conspiração' },
  { value: 'top 10', label: '🏆 Top 10 / Listicle' },
  { value: 'receitas', label: '🍳 Receitas' },
  { value: 'viagem', label: '✈️ Viagem' },
];

const COUNTRIES = [
  { value: '', label: '🌍 Todos os países' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'PL', label: '🇵🇱 Polônia' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'MX', label: '🇲🇽 México' },
  { value: 'FR', label: '🇫🇷 França' },
  { value: 'IN', label: '🇮🇳 Índia' },
];

const SEARCH_TYPES = [
  { value: 'video', label: 'Vídeos', icon: Video, desc: 'Buscar vídeos por palavra-chave' },
  { value: 'channel', label: 'Canais', icon: Tv, desc: 'Espionar canal específico' },
];

const LANGUAGES = [
  { value: '', label: 'Todos idiomas' }, { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' },
  { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
];

const PERIODS = [
  { value: '', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mês' },
  { value: 'year', label: 'Último ano' },
];

const ChannelSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pre-search filter questions
  const [searchType, setSearchType] = useState('video');
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

  const medianViews = channelInfo?.avgViews || 156_000;

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
      setResults(data?.results || []);
      setChannelInfo(data?.channel || null);
      if (!data?.results?.length) toast.info('Nenhum vídeo encontrado');
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

  const deepScanVideo = async (videoId: string) => {
    setDeepScanning(videoId);
    setDeepScanResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('deep-scan-video', {
        body: { videoId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDeepScanResult(data);
      toast.success('Deep Scan completo!');
    } catch (err: any) {
      toast.error(err.message || 'Erro no Deep Scan');
    } finally {
      setDeepScanning(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center glow-accent">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">TubeSpy & Radar de Outliers</h1>
            <p className="text-sm text-muted-foreground">Espione concorrentes e descubra vídeos virais</p>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* PRE-SEARCH QUESTIONNAIRE                    */}
        {/* ═══════════════════════════════════════════ */}
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 space-y-5 border-primary/10">
          
          {/* Q1: Search Type */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-primary" /> O que você quer buscar?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SEARCH_TYPES.map(t => (
                <button key={t.value} onClick={() => setSearchType(t.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    searchType === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                  }`}>
                  <t.icon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Q2 + Q3: Niche + Country side by side */}
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

          {/* Search bar */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {searchType === 'channel' ? '🔗 Cole o link, @handle ou nome do canal' : '🔍 Palavra-chave, link ou tema'}
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={searchType === 'channel'
                    ? 'Ex: youtube.com/@MrBeast, @Fazendo_Milhoes, Fazendo Milhões'
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

          {/* Advanced Filters Toggle */}
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

        {/* Channel Card with Monetization Badge */}
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
                  {/* TODO: Real monetization check via web scraping — search for key:"is_monetization_enabled",value:"true" in YouTube page source */}
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
                <div>
                  <p className="text-lg font-bold text-accent">$15.00</p>
                  <p className="text-[10px] text-muted-foreground">RPM Est.</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs"
                onClick={() => emulateChannel(channelInfo.id)} disabled={!!emulating}>
                <Copy className="w-3 h-3" /> Modelar Canal
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs">
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

        {/* Data Table — Outlier Radar */}
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
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </div>
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

        {/* Empty state */}
        {hasSearched && !loading && results.length === 0 && !channelInfo && (
          <div className="glass rounded-xl p-12 text-center text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum resultado encontrado. Tente outra busca.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
