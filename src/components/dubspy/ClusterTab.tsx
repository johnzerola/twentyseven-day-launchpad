import { useState } from 'react';
import { Network, Loader2, Users, Eye, TrendingUp, Search as SearchIcon, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';
import { NICHES, COUNTRIES, LANGUAGES } from '@/lib/constants';

interface Cluster {
  name: string;
  description: string;
  opportunity: string;
  channelIds: string[];
  suggestedTopics: string[];
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

  const scan = async () => {
    const nicheQuery = niche || customNiche;
    if (!nicheQuery.trim()) { toast.error('Selecione ou digite um nicho'); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('dubspy-scan', {
        body: { mode: 'cluster', niche: nicheQuery, country, language },
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
            A IA analisa canais do nicho e agrupa em micro-nichos, identificando oportunidades que a maioria dos criadores não vê.
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

        <Button onClick={scan} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6 w-full sm:w-auto">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
          {loading ? 'Analisando micro-nichos...' : 'Detectar Micro-Nichos'}
        </Button>
      </div>

      {/* Clusters */}
      <div className="space-y-4">
        <AnimatePresence>
          {clusters.map((cluster, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-5 border border-border/30">
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

              {/* Channels in cluster */}
              <div className="flex gap-3 flex-wrap mb-3">
                {cluster.channelIds.map(chId => {
                  const ch = getChannelById(chId);
                  if (!ch) return null;
                  return (
                    <div key={chId} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-1.5">
                      {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-6 h-6 rounded-full" />}
                      <div>
                        <p className="text-[11px] font-medium">{ch.name}</p>
                        <p className="text-[9px] text-muted-foreground">{formatNumber(ch.subscribers)} subs</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Suggested topics */}
              {cluster.suggestedTopics.length > 0 && (
                <div>
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
            </motion.div>
          ))}
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
