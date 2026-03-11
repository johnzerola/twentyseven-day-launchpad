import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, TrendingUp, Users, Eye, ExternalLink, Zap, Trophy, Filter, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Outlier {
  video_title: string;
  video_url: string;
  channel_name: string;
  channel_id: string;
  subscribers: number;
  views: number;
  multiplier: number;
  niche: string;
  thumbnail_url: string;
  published_at: string;
}

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const PRESET_NICHES = [
  'true crime mysteries', 'dark history secrets', 'unsolved disappearances',
  'urban legends creepy', 'haunted places tour', 'psychology manipulation',
  'space unexplained', 'ocean mysteries deep', 'ancient civilizations lost',
  'conspiracy theories debunked', 'forensic science cases', 'creepypasta horror',
];

export const OutlierFinderPanel = () => {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [outliers, setOutliers] = useState<Outlier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [maxSubs, setMaxSubs] = useState('50000');
  const [minMultiplier, setMinMultiplier] = useState('5');
  const [stats, setStats] = useState({ total_searched: 0, total_outliers: 0 });

  const search = async (query?: string) => {
    const q = query || keywords;
    if (!q.trim()) return toast.error('Digite keywords do nicho');
    setLoading(true);
    setSearched(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-outliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          keywords: q,
          maxSubs: parseInt(maxSubs) || 50000,
          minMultiplier: parseFloat(minMultiplier) || 5,
          maxResults: 50,
        }),
      });
      if (!resp.ok) throw new Error('Erro na busca');
      const data = await resp.json();
      setOutliers(data.outliers || []);
      setStats({ total_searched: data.total_searched || 0, total_outliers: data.total_outliers || 0 });
      if (data.outliers?.length) {
        toast.success(`${data.outliers.length} outliers encontrados!`);
      } else {
        toast.info('Nenhum outlier encontrado. Tente keywords diferentes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar outliers');
    } finally {
      setLoading(false);
    }
  };

  const getMultiplierColor = (m: number) => {
    if (m >= 50) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (m >= 20) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (m >= 10) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-lg font-['Space_Grotesk']">Outlier Finder</h2>
          <Badge variant="outline" className="text-[10px]">YouTube API</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Encontre canais pequenos (&lt;50K subs) com vídeos virais. Modelo o sucesso deles para crescer rápido.
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Ex: true crime mysteries, dark history, unsolved cases..."
              className="pl-10 bg-secondary/50"
            />
          </div>
          <Button onClick={() => search()} disabled={loading} className="gradient-hero border-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Buscar Outliers
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Max subs:</span>
            <Input value={maxSubs} onChange={e => setMaxSubs(e.target.value)}
              className="w-24 h-7 text-xs bg-secondary/50" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Min multiplier:</span>
            <Input value={minMultiplier} onChange={e => setMinMultiplier(e.target.value)}
              className="w-20 h-7 text-xs bg-secondary/50" />
          </div>
        </div>

        {/* Preset niches */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_NICHES.map(n => (
            <Badge key={n} variant="outline"
              className="text-[10px] cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
              onClick={() => { setKeywords(n); search(n); }}>
              {n}
            </Badge>
          ))}
        </div>
      </div>

      {/* Stats */}
      {searched && !loading && (
        <div className="flex gap-3">
          <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm"><strong>{stats.total_searched}</strong> vídeos analisados</span>
          </div>
          <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm"><strong>{stats.total_outliers}</strong> outliers detectados</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando vídeos virais via YouTube API...</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {!loading && outliers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {outliers.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                {/* Thumbnail */}
                {o.thumbnail_url && (
                  <div className="relative h-36 overflow-hidden">
                    <img src={o.thumbnail_url} alt={o.video_title}
                      className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2">
                      <Badge className={`${getMultiplierColor(o.multiplier)} font-bold`}>
                        {o.multiplier}x viral
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm line-clamp-2">{o.video_title}</h3>
                  <p className="text-xs text-muted-foreground">{o.channel_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{formatNumber(o.subscribers)} subs</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(o.views)} views</span>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-400" />{o.multiplier}x</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <Badge variant="outline" className="text-[10px]">{o.niche}</Badge>
                    <a href={o.video_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <ExternalLink className="w-3 h-3" /> Ver no YouTube
                      </Button>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {searched && !loading && outliers.length === 0 && (
        <div className="text-center py-12 glass rounded-xl">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum outlier encontrado para essas keywords.</p>
          <p className="text-xs text-muted-foreground mt-1">Tente termos mais amplos ou reduza o multiplier mínimo.</p>
        </div>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div className="text-center py-12 glass rounded-xl">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-3 opacity-60" />
          <p className="font-semibold text-sm">Descubra canais pequenos com vídeos virais</p>
          <p className="text-xs text-muted-foreground mt-1">
            Digite keywords do seu nicho ou clique em um preset acima para começar.
          </p>
        </div>
      )}
    </div>
  );
};
