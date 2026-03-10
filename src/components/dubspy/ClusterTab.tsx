import { useState } from 'react';
import { Network, Loader2, Users, Eye, TrendingUp, Search as SearchIcon, Lightbulb, ExternalLink, Star, SlidersHorizontal, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';
import { NICHES, COUNTRIES, LANGUAGES } from '@/lib/constants';

interface DiscoveredChannel {
  id: string; name: string; thumbnail: string;
  subscribers: number; videoCount: number; avgViews: number; totalViews: number;
}

interface Cluster {
  name: string;
  description: string;
  opportunity: string;
  channelIds: string[];
  suggestedTopics: string[];
  searchQuery?: string;
  discoveredChannels?: DiscoveredChannel[];
}

interface ChannelResult {
  id: string; name: string; thumbnail: string;
  subscribers: number; videoCount: number; avgViews: number;
  maxVideoViews: number; efficiencyScore: number;
}

export const ClusterTab = () => {
  const [niche, setNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [language, setLanguage] = useState('pt');
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  // Filters
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [minVideoViews, setMinVideoViews] = useState('');
  const [maxChannelVideos, setMaxChannelVideos] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = [minSubs, maxSubs, minVideoViews, maxChannelVideos].filter(v => v).length;

  const scan = async () => {
    const nicheQuery = niche || customNiche;
    if (!nicheQuery.trim()) { toast.error('Selecione ou digite um nicho'); return; }
    setLoading(true);
    setHasSearched(true);
    setExpandedCluster(null);
    try {
      const { data, error } = await supabase.functions.invoke('dubspy-scan', {
        body: {
          mode: 'micro-niche-drill',
          niche: nicheQuery,
          country,
          language,
          minSubs: minSubs ? parseInt(minSubs) : undefined,
          maxSubs: maxSubs ? parseInt(maxSubs) : undefined,
          minVideoViews: minVideoViews ? parseInt(minVideoViews) : undefined,
          maxChannelVideos: maxChannelVideos ? parseInt(maxChannelVideos) : undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setClusters(data?.clusters || []);
      setChannels(data?.channels || []);
      if (!data?.clusters?.length) toast.info('Poucos canais para clustering. Tente um nicho mais amplo.');
    } catch (err: any) {
      toast.error(err.message || 'Erro na varredura');
    } finally {
      setLoading(false);
    }
  };

  const getChannelById = (id: string) => channels.find(ch => ch.id === id);

  const trackChannel = async (ch: { id: string; name: string; subscribers: number; thumbnail?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('Faça login');
    const { error } = await supabase.from('tracked_channels').insert({
      user_id: user.id, youtube_channel_id: ch.id,
      channel_name: ch.name, subscribers: ch.subscribers,
      thumbnail: ch.thumbnail || '',
    } as any);
    if (error?.code === '23505') return toast.info('Canal já rastreado');
    if (error) return toast.error('Erro');
    toast.success(`${ch.name} rastreado!`);
  };

  const opportunityColor = (opp: string) => {
    if (opp === 'Alta') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (opp === 'Média') return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="glass rounded-xl p-5 space-y-4 border-primary/10">
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            A IA analisa canais do nicho, agrupa em micro-nichos e busca canais adicionais em cada um — identificando oportunidades ocultas.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">🔥 Nicho</label>
            <select value={niche} onChange={e => { setNiche(e.target.value); setCustomNiche(''); }}
              className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            {!niche && (
              <Input placeholder="Ou digite um nicho..." value={customNiche}
                onChange={e => setCustomNiche(e.target.value)} className="mt-2 bg-secondary/50 text-sm h-9" />
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">🌍 País</label>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">🗣 Idioma</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" /> 
            {showAdvanced ? 'Esconder' : 'Mostrar'} filtros avançados
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}</Badge>
            )}
          </button>
          {showAdvanced && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min inscritos</label>
                <Input type="number" placeholder="ex: 1000" value={minSubs} onChange={e => setMinSubs(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Max inscritos</label>
                <Input type="number" placeholder="ex: 500000" value={maxSubs} onChange={e => setMaxSubs(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min views (melhor vídeo)</label>
                <Input type="number" placeholder="ex: 10000" value={minVideoViews} onChange={e => setMinVideoViews(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Max vídeos do canal</label>
                <Input type="number" placeholder="ex: 100" value={maxChannelVideos} onChange={e => setMaxChannelVideos(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
            </div>
          )}
        </div>

        <Button onClick={scan} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6 w-full sm:w-auto">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          {loading ? 'Analisando micro-nichos...' : 'Detectar Micro-Nichos + Canais'}
        </Button>
      </div>

      {/* Clusters */}
      <div className="space-y-4">
        <AnimatePresence>
          {clusters.map((cluster, i) => {
            const isExpanded = expandedCluster === i;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-xl border border-border/30 overflow-hidden">
                {/* Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <Network className="w-4 h-4 text-primary" />
                        {cluster.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{cluster.description}</p>
                    </div>
                    <Badge className={`text-[10px] ${opportunityColor(cluster.opportunity)}`}>
                      {cluster.opportunity === 'Alta' ? '🟢' : cluster.opportunity === 'Média' ? '🟡' : '🔴'} {cluster.opportunity}
                    </Badge>
                  </div>

                  {/* Known channels in cluster */}
                  <div className="flex gap-3 flex-wrap mb-3">
                    {cluster.channelIds.slice(0, 6).map(chId => {
                      const ch = getChannelById(chId);
                      if (!ch) return null;
                      return (
                        <div key={chId} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-1.5">
                          {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-6 h-6 rounded-full" />}
                          <div>
                            <p className="text-[11px] font-medium">{ch.name}</p>
                            <p className="text-[9px] text-muted-foreground">{formatNumber(ch.subscribers)} subs</p>
                          </div>
                          <button onClick={() => trackChannel(ch)} className="ml-1 text-muted-foreground hover:text-primary">
                            <Star className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Suggested topics */}
                  {cluster.suggestedTopics.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Tópicos sugeridos
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.suggestedTopics.map((topic, j) => (
                          <Badge key={j} variant="outline" className="text-[10px]">{topic}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expand to see discovered channels */}
                  {cluster.discoveredChannels && cluster.discoveredChannels.length > 0 && (
                    <button
                      onClick={() => setExpandedCluster(isExpanded ? null : i)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                    >
                      <SearchIcon className="w-3 h-3" />
                      {isExpanded ? 'Esconder' : `Ver ${cluster.discoveredChannels.length} canais descobertos neste micro-nicho`}
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Discovered channels panel */}
                <AnimatePresence>
                  {isExpanded && cluster.discoveredChannels && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border/30 bg-secondary/10"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-primary flex items-center gap-1 mb-2">
                          <SearchIcon className="w-3 h-3" /> Canais explorando este micro-nicho
                        </p>
                        {cluster.discoveredChannels.map((dch) => (
                          <div key={dch.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg px-3 py-2">
                            {dch.thumbnail ? (
                              <img src={dch.thumbnail} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{dch.name}</p>
                              <div className="flex gap-3 text-[10px] text-muted-foreground">
                                <span>{formatNumber(dch.subscribers)} subs</span>
                                <span>{dch.videoCount} vídeos</span>
                                <span>{formatNumber(dch.avgViews)} avg views</span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => trackChannel(dch)}>
                                <Star className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => window.open(`https://youtube.com/channel/${dch.id}`, '_blank')}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {hasSearched && !loading && clusters.length === 0 && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Network className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhum cluster identificado. Tente um nicho com mais canais.</p>
        </div>
      )}
    </div>
  );
};
