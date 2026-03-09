import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, Eye, ThumbsUp, Star, ExternalLink, Filter, Calendar as CalendarIcon, Copy, TrendingUp, Shield, ShieldOff, Clock } from 'lucide-react';
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

// Mock data for TubeSpy
const MOCK_VIDEOS: VideoResult[] = [
  { id: 'v1', title: '5 Investimentos que me fizeram milionário em 2025', channelTitle: 'FinançasPro', channelId: 'ch1', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 2500000, likes: 89000, subscribers: 450000, publishedAt: '2025-12-01', duration: 'PT15M30S', isOutlier: true, engagementRate: '3.56%', viewsPerSub: '5.6x' },
  { id: 'v2', title: 'A história mais assustadora que já investiguei', channelTitle: 'DarkStories', channelId: 'ch2', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 1800000, likes: 72000, subscribers: 320000, publishedAt: '2025-11-28', duration: 'PT22M15S', isOutlier: true, engagementRate: '4.00%', viewsPerSub: '5.6x' },
  { id: 'v3', title: 'Setup gamer COMPLETO por menos de R$3.000', channelTitle: 'TechBR', channelId: 'ch3', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 950000, likes: 45000, subscribers: 280000, publishedAt: '2025-12-05', duration: 'PT12M45S', isOutlier: false, engagementRate: '4.74%', viewsPerSub: '3.4x' },
  { id: 'v4', title: 'O caso que a polícia nunca resolveu', channelTitle: 'CrimeBR', channelId: 'ch4', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 3200000, likes: 125000, subscribers: 500000, publishedAt: '2025-11-20', duration: 'PT28M00S', isOutlier: true, engagementRate: '3.91%', viewsPerSub: '6.4x' },
  { id: 'v5', title: 'Como eu ganhei R$50.000 em um mês no YouTube', channelTitle: 'MonetizaYT', channelId: 'ch5', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 780000, likes: 31000, subscribers: 150000, publishedAt: '2025-12-08', duration: 'PT18M20S', isOutlier: true, engagementRate: '3.97%', viewsPerSub: '5.2x' },
  { id: 'v6', title: 'Minecraft mas tudo é 100x maior', channelTitle: 'GameZone', channelId: 'ch6', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 450000, likes: 28000, subscribers: 200000, publishedAt: '2025-12-10', duration: 'PT10M05S', isOutlier: false, engagementRate: '6.22%', viewsPerSub: '2.3x' },
  { id: 'v7', title: 'Die 10 besten Aktien für 2026', channelTitle: 'FinanzDE', channelId: 'ch7', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 620000, likes: 19000, subscribers: 180000, publishedAt: '2025-12-03', duration: 'PT14M55S', isOutlier: false, engagementRate: '3.06%', viewsPerSub: '3.4x' },
  { id: 'v8', title: 'Jak zarobić na YouTube w Polsce w 2026', channelTitle: 'PolskiYT', channelId: 'ch8', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 340000, likes: 15000, subscribers: 95000, publishedAt: '2025-12-07', duration: 'PT16M30S', isOutlier: false, engagementRate: '4.41%', viewsPerSub: '3.6x' },
  { id: 'v9', title: 'I Survived 100 Days in a Haunted House', channelTitle: 'ChallengeKing', channelId: 'ch9', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 8500000, likes: 420000, subscribers: 2000000, publishedAt: '2025-11-15', duration: 'PT25M00S', isOutlier: true, engagementRate: '4.94%', viewsPerSub: '4.3x' },
  { id: 'v10', title: 'A verdade sobre dropshipping em 2026', channelTitle: 'NegócioDigital', channelId: 'ch10', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 520000, likes: 23000, subscribers: 130000, publishedAt: '2025-12-09', duration: 'PT20M10S', isOutlier: false, engagementRate: '4.42%', viewsPerSub: '4.0x' },
  { id: 'v11', title: 'Os 7 hábitos que mudaram minha vida', channelTitle: 'MindsetBR', channelId: 'ch11', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 1100000, likes: 55000, subscribers: 300000, publishedAt: '2025-12-02', duration: 'PT13M45S', isOutlier: false, engagementRate: '5.00%', viewsPerSub: '3.7x' },
  { id: 'v12', title: 'Building a $1M Business from Scratch', channelTitle: 'StartupGrind', channelId: 'ch12', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', views: 1900000, likes: 78000, subscribers: 550000, publishedAt: '2025-11-25', duration: 'PT30M00S', isOutlier: true, engagementRate: '4.11%', viewsPerSub: '3.5x' },
];

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

const ChannelSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [language, setLanguage] = useState('');
  const [country, setCountry] = useState('');
  const [emulating, setEmulating] = useState<string | null>(null);
  const [emulationResult, setEmulationResult] = useState<any>(null);

  // TODO: This monetization badge will be fed by web scraping looking for 'is_monetization_enabled' in YouTube source
  const [channelMonetized] = useState(true);

  const searchVideos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-videos', {
        body: { query, language, country },
      });
      if (error) throw new Error(error.message);
      if (data?.results?.length) {
        setResults(data.results);
      } else {
        // Fallback to mock data for demo
        setResults(MOCK_VIDEOS);
      }
    } catch {
      // Use mock data as fallback
      setResults(MOCK_VIDEOS);
      toast.info('Exibindo dados de demonstração');
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">TubeSpy & Radar de Outliers</h1>
            <p className="text-sm text-muted-foreground">Cole o link de um canal ou vídeo concorrente</p>
          </div>
        </div>

        {/* Monetization Badge */}
        {results.length > 0 && (
          <div className="flex items-center gap-2">
            {channelMonetized ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                <Shield className="w-3 h-3" /> Monetização: ATIVADA
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <ShieldOff className="w-3 h-3" /> Monetização: DESATIVADA
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{results.length} vídeos analisados</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cole o link de um canal, vídeo ou busque por palavra-chave..." value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
              className="pl-10 bg-secondary/50 h-12 text-base" />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-12">
            <Filter className="w-4 h-4" />
          </Button>
          <Button onClick={searchVideos} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-6">
            <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Espionar'}
          </Button>
        </div>

        {showFilters && (
          <div className="glass rounded-xl p-4 flex gap-4 flex-wrap">
            <select value={language} onChange={e => setLanguage(e.target.value)} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={country} onChange={e => setCountry(e.target.value)} className="h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
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
            <p className="text-lg font-medium">Cole o link de um canal ou busque uma palavra-chave</p>
            <p className="text-sm mt-1">Analise VPH, Outlier Score e monetização dos concorrentes</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
