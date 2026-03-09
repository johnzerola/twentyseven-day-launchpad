import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Search, Users, Eye, TrendingUp, ExternalLink, Filter, Star, Video, ThumbsUp, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VideoResult {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnail: string;
  views: number;
  likes: number;
  publishedAt: string;
  duration: string;
  isOutlier?: boolean;
}

const YOUTUBE_API_KEY = 'AIzaSyBxMtFibQNPqNP3q_SussnxFmPmwXbhkRw';

const LANGUAGES = [
  { value: '', label: 'Todos idiomas' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polski' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

const COUNTRIES = [
  { value: '', label: 'Todos os países' },
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'PL', label: 'Polônia' },
  { value: 'DE', label: 'Alemanha' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'PT', label: 'Portugal' },
  { value: 'ES', label: 'Espanha' },
  { value: 'FR', label: 'França' },
  { value: 'IN', label: 'Índia' },
  { value: 'JP', label: 'Japão' },
];

const PERIODS = [
  { value: '', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Última semana' },
  { value: 'month', label: 'Último mês' },
  { value: 'year', label: 'Último ano' },
];

const ChannelSearch = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Filters
  const [language, setLanguage] = useState('');
  const [country, setCountry] = useState('');
  const [period, setPeriod] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minLikes, setMinLikes] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');

  const getPeriodDate = (p: string) => {
    const now = new Date();
    switch (p) {
      case 'today': return new Date(now.setDate(now.getDate() - 1)).toISOString();
      case 'week': return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case 'month': return new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      case 'year': return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
      default: return '';
    }
  };

  const searchVideos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=24&order=viewCount&key=${YOUTUBE_API_KEY}`;
      if (language) url += `&relevanceLanguage=${language}`;
      if (country) url += `&regionCode=${country}`;
      const publishedAfter = getPeriodDate(period);
      if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;

      const searchRes = await fetch(url);
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error.message);
      if (!searchData.items?.length) { setResults([]); setLoading(false); return; }

      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
      );
      const statsData = await statsRes.json();

      // Get channel stats for outlier detection and sub filtering
      const channelIds = [...new Set(statsData.items?.map((v: any) => v.snippet.channelId) || [])] as string[];
      const channelStatsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`
      );
      const channelStatsData = await channelStatsRes.json();
      const channelMap: Record<string, any> = {};
      channelStatsData.items?.forEach((ch: any) => {
        channelMap[ch.id] = {
          subscribers: parseInt(ch.statistics.subscriberCount || '0'),
          totalViews: parseInt(ch.statistics.viewCount || '0'),
          videoCount: parseInt(ch.statistics.videoCount || '0'),
        };
      });

      let videos: VideoResult[] = (statsData.items || []).map((v: any) => {
        const views = parseInt(v.statistics?.viewCount || '0');
        const chStats = channelMap[v.snippet.channelId];
        const avgViews = chStats ? Math.floor(chStats.totalViews / Math.max(chStats.videoCount, 1)) : 0;
        
        return {
          id: v.id,
          title: v.snippet.title,
          channelTitle: v.snippet.channelTitle,
          channelId: v.snippet.channelId,
          thumbnail: v.snippet.thumbnails?.medium?.url || '',
          views,
          likes: parseInt(v.statistics?.likeCount || '0'),
          publishedAt: v.snippet.publishedAt,
          duration: v.contentDetails?.duration || '',
          isOutlier: views >= avgViews * 5,
        };
      });

      // Apply client-side filters
      if (minViews) videos = videos.filter(v => v.views >= parseInt(minViews));
      if (minLikes) videos = videos.filter(v => v.likes >= parseInt(minLikes));
      if (minSubs) videos = videos.filter(v => (channelMap[v.channelId]?.subscribers || 0) >= parseInt(minSubs));
      if (maxSubs) videos = videos.filter(v => (channelMap[v.channelId]?.subscribers || 0) <= parseInt(maxSubs));

      setResults(videos);
    } catch (err: any) {
      toast.error(err.message || 'Erro na busca');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatDuration = (d: string) => {
    const match = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    const h = match[1] ? `${match[1]}:` : '';
    const m = match[2] || '0';
    const s = match[3]?.padStart(2, '0') || '00';
    return `${h}${m}:${s}`;
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'hoje';
    if (days < 7) return `${days}d atrás`;
    if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
    if (days < 365) return `${Math.floor(days / 30)}m atrás`;
    return `${Math.floor(days / 365)}a atrás`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">{t('search.title')}</h1>
          <p className="text-muted-foreground mt-1">Encontre vídeos, canais, nichos e outliers — estilo TubeMine</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Use 1-4 palavras-chave. Ex: finanças pessoais, gaming highlights..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchVideos()}
              className="pl-10 bg-secondary/50"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </Button>
          <Button onClick={searchVideos} disabled={loading} className="gradient-hero border-0 gap-2">
            <Search className="w-4 h-4" />
            {loading ? 'Buscando...' : 'Buscar Vídeos'}
          </Button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="glass rounded-xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('search.language')}</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('search.country')}</label>
              <select value={country} onChange={e => setCountry(e.target.value)} className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Views mínimas</label>
              <Input type="number" placeholder="Ex: 10000" value={minViews} onChange={e => setMinViews(e.target.value)} className="bg-secondary/50 h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Likes mínimos</label>
              <Input type="number" placeholder="Ex: 100" value={minLikes} onChange={e => setMinLikes(e.target.value)} className="bg-secondary/50 h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Inscritos mínimos</label>
              <Input type="number" placeholder="Ex: 1000" value={minSubs} onChange={e => setMinSubs(e.target.value)} className="bg-secondary/50 h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Inscritos máximos</label>
              <Input type="number" placeholder="Ex: 100000" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="bg-secondary/50 h-9" />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => { setLanguage(''); setCountry(''); setPeriod(''); setMinViews(''); setMinLikes(''); setMinSubs(''); setMaxSubs(''); }} className="text-xs">
                Limpar filtros
              </Button>
            </div>
          </div>
        )}

        {/* Results counter */}
        {results.length > 0 && (
          <p className="text-sm text-muted-foreground">{results.length} resultados encontrados</p>
        )}

        {/* Results grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((v) => (
            <div key={v.id} className="glass rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
              <div className="relative">
                <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover" />
                {v.duration && (
                  <span className="absolute bottom-2 right-2 bg-background/80 text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(v.duration)}
                  </span>
                )}
                {v.isOutlier && (
                  <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> OUTLIER
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">{v.title}</h3>
                <a
                  href={`https://youtube.com/channel/${v.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {v.channelTitle}
                </a>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(v.views)}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {formatNumber(v.likes)}</span>
                  <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {timeAgo(v.publishedAt)}</span>
                </div>
                <a
                  href={`https://youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 mt-3 text-xs text-primary hover:underline"
                >
                  Assistir <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Pesquise por um nicho ou palavra-chave para encontrar vídeos e canais</p>
            <p className="text-xs mt-2">Dica: use 1-4 palavras para melhores resultados</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelSearch;
