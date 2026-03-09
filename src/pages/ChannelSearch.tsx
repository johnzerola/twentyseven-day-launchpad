import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, Eye, ThumbsUp, Star, ExternalLink, Filter, Copy, TrendingUp, Shield, ShieldOff, Clock, Users, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

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

const calcOutlierScore = (views: number, subscribers: number) => {
  if (!subscribers) return 0;
  return Math.round((views / subscribers) * 10) / 10;
};

const LANGUAGES = [
  { value: '', label: 'Todos idiomas' }, { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' },
  { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
];

const COUNTRIES = [
  { value: '', label: 'Todos' }, { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'EUA' }, { value: 'DE', label: 'Alemanha' },
  { value: 'PL', label: 'Polônia' }, { value: 'GB', label: 'UK' },
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
  const [showFilters, setShowFilters] = useState(false);
  const [language, setLanguage] = useState('');
  const [country, setCountry] = useState('');
  const [period, setPeriod] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [emulating, setEmulating] = useState<string | null>(null);
  const [emulationResult, setEmulationResult] = useState<any>(null);

  const searchVideos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setChannelInfo(null);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('search-videos', {
        body: { query, language, country, period, minViews, minSubs, maxSubs },
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

  const isUrlInput = query.includes('youtube.com') || query.includes('youtu.be') || query.startsWith('@') || query.startsWith('UC');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">TubeSpy & Radar de Outliers</h1>
            <p className="text-sm text-muted-foreground">Cole o link de um canal, vídeo ou @handle para espionar</p>
          </div>
        </div>

        {/* Channel Card */}
        {channelInfo && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-5 flex items-center gap-5">
            {channelInfo.thumbnail && (
              <img src={channelInfo.thumbnail} alt={channelInfo.name} className="w-16 h-16 rounded-full object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{channelInfo.name}</h3>
                {/* TODO: monetization check via web scraping for 'is_monetization_enabled' in YouTube page source */}
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
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold">{formatNumber(channelInfo.subscribers)}</p>
                <p className="text-[10px] text-muted-foreground">Inscritos</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatNumber(channelInfo.totalViews)}</p>
                <p className="text-[10px] text-muted-foreground">Views Total</p>
              </div>
              <div>
                <p className="text-lg font-bold">{channelInfo.videoCount}</p>
                <p className="text-[10px] text-muted-foreground">Vídeos</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatNumber(channelInfo.avgViews)}</p>
                <p className="text-[10px] text-muted-foreground">Média Views</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cole: youtube.com/@canal, youtube.com/watch?v=..., ou busque por palavra-chave"
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
              className="pl-10 bg-secondary/50 h-12 text-base" />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-12">
            <Filter className="w-4 h-4" />
          </Button>
          <Button onClick={searchVideos} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-6">
            <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Espionar'}
          </Button>
        </div>

        {isUrlInput && (
          <p className="text-xs text-primary">🔗 URL/handle detectado — vamos buscar os vídeos desse canal</p>
        )}

        {showFilters && (
          <div className="glass rounded-xl p-4 flex gap-4 flex-wrap">
            <select value={language} onChange={e => setLanguage(e.target.value)} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={country} onChange={e => setCountry(e.target.value)} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <Input placeholder="Min views" value={minViews} onChange={e => setMinViews(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
            <Input placeholder="Min subs" value={minSubs} onChange={e => setMinSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
            <Input placeholder="Max subs" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
          </div>
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
        {results.length > 0 && !channelInfo && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{results.length} vídeos encontrados</Badge>
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
                    const outlierScore = calcOutlierScore(v.views, v.subscribers);
                    return (
                      <TableRow key={v.id} className="border-border/30 hover:bg-secondary/30">
                        <TableCell>
                          <div className="relative w-16 h-10 rounded overflow-hidden">
                            <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                            {v.isOutlier && (
                              <span className="absolute -top-1 -right-1 bg-accent text-[8px] font-bold text-accent-foreground px-1 rounded-full">
                                10x
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium line-clamp-1">{v.title}</p>
                            <p className="text-xs text-muted-foreground">{v.channelTitle} • {formatNumber(v.subscribers)} subs</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1 text-sm">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {formatNumber(vph)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatNumber(v.views)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(v.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={outlierScore >= 5 ? 'default' : 'secondary'}
                            className={outlierScore >= 5 ? 'bg-accent text-accent-foreground' : ''}>
                            {outlierScore}x {outlierScore >= 5 && '🔥'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => emulateChannel(v.channelId)} disabled={emulating === v.channelId}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => trackChannel(v)}>
                              <TrendingUp className="w-3 h-3" />
                            </Button>
                            <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
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

        {results.length === 0 && !loading && (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Cole um link ou busque uma palavra-chave</p>
            <p className="text-sm mt-1">Suporta: youtube.com/@canal, youtube.com/watch?v=..., ou keywords</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
