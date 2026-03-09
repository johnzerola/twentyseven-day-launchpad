import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, Eye, ThumbsUp, Star, ExternalLink, Filter, Calendar as CalendarIcon, Copy, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VideoResult {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnail: string;
  views: number;
  likes: number;
  subscribers: number;
  publishedAt: string;
  duration: string;
  isOutlier?: boolean;
  engagementRate: string;
  viewsPerSub: string;
}

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

const ChannelSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [emulating, setEmulating] = useState<string | null>(null);
  const [emulationResult, setEmulationResult] = useState<any>(null);

  const [language, setLanguage] = useState('');
  const [country, setCountry] = useState('');
  const [period, setPeriod] = useState('');
  const [minViews, setMinViews] = useState('');
  const [minLikes, setMinLikes] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');

  const searchVideos = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-videos', {
        body: { query, language, country, period, minViews, minLikes, minSubs, maxSubs },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResults(data?.results || []);
    } catch (err: any) {
      toast.error(err.message || 'Erro na busca');
    } finally {
      setLoading(false);
    }
  };

  const emulateChannel = async (channelId: string) => {
    setEmulating(channelId);
    try {
      const { data, error } = await supabase.functions.invoke('emulate-channel', {
        body: { channelId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setEmulationResult(data);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao emular canal');
    } finally {
      setEmulating(null);
    }
  };

  const trackChannel = async (video: VideoResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return toast.error('Faça login primeiro');
      
      const { error } = await supabase.from('tracked_channels').insert({
        user_id: user.id,
        youtube_channel_id: video.channelId,
        channel_name: video.channelTitle,
        subscribers: video.subscribers,
      } as any);
      if (error) {
        if (error.code === '23505') return toast.info('Canal já está sendo rastreado');
        throw error;
      }
      toast.success(`${video.channelTitle} adicionado aos rastreados!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao rastrear canal');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">🔍 Busca de Vídeos</h1>
          <p className="text-muted-foreground mt-1">Encontre vídeos, canais, nichos e outliers com dados reais</p>
        </div>

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
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>

        {showFilters && (
          <div className="glass rounded-xl p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Idioma</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">País</label>
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

        {results.length > 0 && (
          <p className="text-sm text-muted-foreground">{results.length} resultados encontrados</p>
        )}

        {/* Emulation Result Modal */}
        {emulationResult && (
          <div className="glass rounded-xl p-6 border border-primary/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-['Space_Grotesk'] flex items-center gap-2">
                <Copy className="w-5 h-5 text-primary" /> Roadmap de Emulação: {emulationResult.channel?.name}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setEmulationResult(null)}>✕</Button>
            </div>
            <p className="text-sm text-muted-foreground">{emulationResult.roadmap?.strategy}</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">📝 Títulos Sugeridos</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {emulationResult.roadmap?.suggestedTitles?.map((t: string, i: number) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">🔑 Keywords</h4>
                <div className="flex flex-wrap gap-1">
                  {emulationResult.roadmap?.keywords?.map((k: string, i: number) => (
                    <span key={i} className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{k}</span>
                  ))}
                </div>
              </div>
            </div>
            {emulationResult.roadmap?.weeklyPlan && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">📅 Plano Semanal</h4>
                {emulationResult.roadmap.weeklyPlan.slice(0, 4).map((w: any) => (
                  <div key={w.week} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-sm font-medium">Semana {w.week}: {w.focus}</p>
                    <ul className="text-xs text-muted-foreground mt-1">
                      {w.videos?.map((v: string, i: number) => <li key={i}>• {v}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                <a href={`https://youtube.com/channel/${v.channelId}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  {v.channelTitle} • {formatNumber(v.subscribers)} subs
                </a>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNumber(v.views)}</span>
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {formatNumber(v.likes)}</span>
                  <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {timeAgo(v.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Assistir <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => emulateChannel(v.channelId)}
                    disabled={emulating === v.channelId}>
                    <Copy className="w-3 h-3 mr-1" /> {emulating === v.channelId ? '...' : 'Emular'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => trackChannel(v)}>
                    <TrendingUp className="w-3 h-3 mr-1" /> Rastrear
                  </Button>
                </div>
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
