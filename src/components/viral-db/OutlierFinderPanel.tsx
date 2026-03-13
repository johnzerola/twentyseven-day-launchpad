import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, TrendingUp, Users, Eye, ExternalLink, Zap, Trophy, Filter, Sparkles, Dna, ThumbsUp, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Outlier {
  video_title: string;
  video_url: string;
  video_id: string;
  channel_name: string;
  channel_id: string;
  subscribers: number;
  views: number;
  likes: number;
  comments: number;
  multiplier: number;
  engagement_rate: number;
  likes_ratio: number;
  gold_score: number;
  niche: string;
  thumbnail_url: string;
  published_at: string;
  duration: string;
  channel_video_count: number;
}

interface ContentDNA {
  title: string;
  hook_type: string;
  title_pattern: string;
  thumbnail_pattern?: string;
  story_structure: string;
  pacing?: string;
  emotion_primary: string;
  emotion_secondary?: string;
  visual_style?: string;
  why_viral: string;
  replication_template?: string;
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
  const [contentDNA, setContentDNA] = useState<ContentDNA[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [maxSubs, setMaxSubs] = useState('100000');
  const [minMultiplier, setMinMultiplier] = useState('10');
  const [showDNA, setShowDNA] = useState(false);
  const [stats, setStats] = useState({ total_searched: 0, total_outliers: 0 });

  const search = async (query?: string) => {
    const q = query || keywords;
    if (!q.trim()) return toast.error('Digite keywords do nicho');
    setLoading(true);
    setSearched(true);
    setShowDNA(false);
    try {
      const authHeaders = await (await import('@/lib/auth-fetch')).getAuthHeaders();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-outliers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          keywords: q,
          maxSubs: parseInt(maxSubs) || 100000,
          minMultiplier: parseFloat(minMultiplier) || 10,
          maxResults: 50,
          extractDNA: true,
        }),
      });
      if (!resp.ok) throw new Error('Erro na busca');
      const data = await resp.json();
      setOutliers(data.outliers || []);
      setContentDNA(data.content_dna || []);
      setStats({ total_searched: data.total_searched || 0, total_outliers: data.total_outliers || 0 });
      if (data.outliers?.length) {
        toast.success(`${data.outliers.length} outliers encontrados! ${data.content_dna?.length ? `${data.content_dna.length} DNA extraídos.` : ''}`);
      } else {
        toast.info('Nenhum outlier encontrado. Tente keywords diferentes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar outliers');
    } finally {
      setLoading(false);
    }
  };

  const getGoldColor = (s: number) => {
    if (s >= 70) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (s >= 50) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (s >= 30) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getMultiplierColor = (m: number) => {
    if (m >= 50) return 'text-red-400';
    if (m >= 20) return 'text-amber-400';
    if (m >= 10) return 'text-emerald-400';
    return 'text-blue-400';
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-lg font-['Space_Grotesk']">Outlier Intelligence Engine</h2>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-400">v2</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Detecta canais &lt;100K subs com vídeos 10x+ acima da média. Extrai automaticamente o <strong>Content DNA</strong> — hooks, padrões de título, estrutura e estilo visual — e alimenta o banco viral.
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

      {/* Stats + DNA toggle */}
      {searched && !loading && (
        <div className="flex gap-3 flex-wrap">
          <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm"><strong>{stats.total_searched}</strong> vídeos analisados</span>
          </div>
          <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm"><strong>{stats.total_outliers}</strong> outliers detectados</span>
          </div>
          {contentDNA.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 border-primary/30"
              onClick={() => setShowDNA(!showDNA)}>
              <Dna className="w-3.5 h-3.5" />
              {showDNA ? 'Ocultar' : 'Ver'} Content DNA ({contentDNA.length})
            </Button>
          )}
        </div>
      )}

      {/* Content DNA Panel */}
      <AnimatePresence>
        {showDNA && contentDNA.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="space-y-3">
            <div className="glass rounded-xl p-4 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Dna className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm font-['Space_Grotesk']">Content DNA Extraído</h3>
                <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">Auto-feed ativo</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {contentDNA.map((dna, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 space-y-2 text-xs">
                    <p className="font-semibold text-sm line-clamp-1">{dna.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[9px] bg-amber-500/10 border-amber-500/30 text-amber-400">
                        Hook: {dna.hook_type}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] bg-blue-500/10 border-blue-500/30 text-blue-400">
                        {dna.story_structure}
                      </Badge>
                      {dna.visual_style && (
                        <Badge variant="outline" className="text-[9px] bg-purple-500/10 border-purple-500/30 text-purple-400">
                          {dna.visual_style}
                        </Badge>
                      )}
                    </div>
                    {dna.title_pattern && (
                      <p className="text-muted-foreground italic">Padrão: "{dna.title_pattern}"</p>
                    )}
                    <p className="text-muted-foreground">{dna.emotion_primary}{dna.emotion_secondary ? ` + ${dna.emotion_secondary}` : ''}</p>
                    <p className="text-foreground/80">{dna.why_viral}</p>
                    {dna.replication_template && (
                      <p className="text-primary/80 text-[10px] mt-1">💡 {dna.replication_template}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando vídeos virais + extraindo Content DNA...</p>
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
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge className={`${getGoldColor(o.gold_score)} font-bold`}>
                        <Star className="w-3 h-3 mr-0.5" /> {o.gold_score}
                      </Badge>
                      <Badge className={`bg-black/60 ${getMultiplierColor(o.multiplier)} font-bold`}>
                        {o.multiplier}x
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm line-clamp-2">{o.video_title}</h3>
                  <p className="text-xs text-muted-foreground">{o.channel_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{formatNumber(o.subscribers)}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(o.views)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatNumber(o.likes)}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{formatNumber(o.comments)}</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="w-3 h-3" />{o.engagement_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 gap-1">
                    <Badge variant="outline" className="text-[10px]">{o.niche}</Badge>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => {
                          const ref = `${o.video_title} (${formatNumber(o.views)} views, ${o.multiplier}x viral, canal: ${o.channel_name}, engagement: ${o.engagement_rate}%)`;
                          sessionStorage.setItem('outlier_topic', ref);
                          navigate('/scripts');
                          toast.success('Referência enviada ao Script Engine!');
                        }}>
                        <Sparkles className="w-3 h-3" /> Clonar DNA
                      </Button>
                      <a href={o.video_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    </div>
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
        <div className="text-center py-12 glass rounded-xl space-y-3">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto opacity-60" />
          <p className="font-semibold text-sm">Outlier Intelligence Engine</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Descubra canais &lt;100K subs com vídeos 10x+ virais. O sistema extrai automaticamente o <strong>Content DNA</strong> (hook, estrutura, emoção, estilo) e alimenta o banco viral para gerar conteúdo com padrões comprovados.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Badge variant="outline" className="text-[10px]">🔍 Outlier Detection</Badge>
            <Badge variant="outline" className="text-[10px]">🧬 Content DNA</Badge>
            <Badge variant="outline" className="text-[10px]">📊 Gold Score</Badge>
            <Badge variant="outline" className="text-[10px]">🔄 Auto-feed</Badge>
          </div>
        </div>
      )}
    </div>
  );
};
