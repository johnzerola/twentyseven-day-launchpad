import { useState } from 'react';
import { Rocket, Loader2, Filter, ExternalLink, Star, Users, Eye, Video, Clock, TrendingUp, Flame, Zap, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';
import { NICHES, COUNTRIES, LANGUAGES } from '@/lib/constants';

interface ChannelResult {
  id: string; name: string; thumbnail: string; description: string;
  subscribers: number; totalViews: number; videoCount: number; avgViews: number;
  ageDays: number; createdAt: string; isMonetized: boolean;
  maxVideoViews: number; avgVideoViews: number; avgVph: number;
  viewsPerSub: number; efficiencyScore: number; outlierCount: number;
  growthVelocity: number; isEmerging: boolean; isAlgorithmEscapee: boolean;
  videos: any[];
}

interface EmergingChannelsTabProps {
  mode: 'emerging' | 'escapees';
}

const EMERGING_PRESETS = [
  { label: '< 5 vídeos', maxVideos: 5, maxAge: 90 },
  { label: '< 10 vídeos', maxVideos: 10, maxAge: 180 },
  { label: '< 1 mês', maxVideos: 50, maxAge: 30 },
  { label: '< 3 meses', maxVideos: 50, maxAge: 90 },
];

export const EmergingChannelsTab = ({ mode }: EmergingChannelsTabProps) => {
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [language, setLanguage] = useState('pt');
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Emerging-specific
  const [maxVideos, setMaxVideos] = useState(10);
  const [maxAge, setMaxAge] = useState(90);
  const [maxSubs, setMaxSubs] = useState('');
  const [customNiche, setCustomNiche] = useState('');

  const scan = async () => {
    const nicheQuery = niche || customNiche;
    if (!nicheQuery.trim()) { toast.error('Selecione ou digite um nicho'); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('dubspy-scan', {
        body: {
          mode,
          niche: nicheQuery,
          country,
          language,
          maxVideos: mode === 'emerging' ? maxVideos : undefined,
          maxChannelAgeDays: mode === 'emerging' ? maxAge : undefined,
          maxSubs: maxSubs ? parseInt(maxSubs) : undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setChannels(data?.channels || []);
      setMeta(data?.meta || null);
      if (!data?.channels?.length) toast.info('Nenhum canal encontrado com esses filtros');
    } catch (err: any) {
      toast.error(err.message || 'Erro na varredura');
    } finally {
      setLoading(false);
    }
  };

  const trackChannel = async (ch: ChannelResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('Faça login');
    const { error } = await supabase.from('tracked_channels').insert({
      user_id: user.id, youtube_channel_id: ch.id,
      channel_name: ch.name, subscribers: ch.subscribers,
      thumbnail: ch.thumbnail,
    } as any);
    if (error?.code === '23505') return toast.info('Canal já rastreado');
    if (error) return toast.error('Erro');
    toast.success(`${ch.name} rastreado!`);
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="glass rounded-xl p-5 space-y-4 border-primary/10">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">🔥 Nicho</label>
            <select value={niche} onChange={e => { setNiche(e.target.value); setCustomNiche(''); }}
              className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
              {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            {!niche && (
              <Input placeholder="Ou digite um nicho personalizado..." value={customNiche}
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

        {/* Mode-specific filters */}
        {mode === 'emerging' && (
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Filtros de Canal Emergente
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {EMERGING_PRESETS.map((preset, i) => (
                <button key={i}
                  onClick={() => { setMaxVideos(preset.maxVideos); setMaxAge(preset.maxAge); }}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    maxVideos === preset.maxVideos && maxAge === preset.maxAge
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                  }`}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Max vídeos:</span>
                <Input type="number" value={maxVideos} onChange={e => setMaxVideos(parseInt(e.target.value) || 10)}
                  className="h-8 w-20 bg-secondary/50 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Max idade (dias):</span>
                <Input type="number" value={maxAge} onChange={e => setMaxAge(parseInt(e.target.value) || 90)}
                  className="h-8 w-20 bg-secondary/50 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Max subs:</span>
                <Input type="number" placeholder="Sem limite" value={maxSubs} onChange={e => setMaxSubs(e.target.value)}
                  className="h-8 w-28 bg-secondary/50 text-sm" />
              </div>
            </div>
          </div>
        )}

        {mode === 'escapees' && (
          <div className="bg-accent/5 rounded-lg p-3 border border-accent/20">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Detecta canais com crescimento de 200%+ em views/subs nos últimos 30 dias — canais que "escaparam da bolha do algoritmo"
            </p>
          </div>
        )}

        <Button onClick={scan} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6 w-full sm:w-auto">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          {loading ? 'Escaneando...' : mode === 'emerging' ? 'Detectar Canais Emergentes' : 'Detectar Algorithm Escapees'}
        </Button>
      </div>

      {/* Stats bar */}
      {meta && (
        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary">{meta.totalFound} canais encontrados</Badge>
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
            {meta.emergingCount} emergentes
          </Badge>
          <Badge variant="outline" className="text-accent border-accent/30">
            {meta.escapeeCount} algorithm escapees
          </Badge>
        </div>
      )}

      {/* Channel Cards */}
      <div className="space-y-4">
        <AnimatePresence>
          {channels.map((ch, i) => (
            <motion.div key={ch.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-5 border border-border/30 hover:border-primary/30 transition-all">
              <div className="flex gap-4 flex-wrap">
                {/* Channel avatar */}
                <div className="relative flex-shrink-0">
                  {ch.thumbnail ? (
                    <img src={ch.thumbnail} alt={ch.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  {ch.isAlgorithmEscapee && (
                    <span className="absolute -top-1 -right-1 bg-accent text-[8px] font-bold text-accent-foreground px-1.5 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5 inline" />
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm">{ch.name}</h3>
                    {ch.isEmerging && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                        <Rocket className="w-2.5 h-2.5" /> Emergente
                      </Badge>
                    )}
                    {ch.isAlgorithmEscapee && (
                      <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px] gap-1">
                        <Zap className="w-2.5 h-2.5" /> Escapee
                      </Badge>
                    )}
                    {ch.ageDays <= 30 && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                        🆕 {ch.ageDays}d
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ch.description}</p>

                  {/* Metrics row */}
                  <div className="flex gap-4 mt-3 flex-wrap text-center">
                    <div>
                      <p className="text-sm font-bold">{formatNumber(ch.subscribers)}</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> Subs</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{ch.videoCount}</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Video className="w-2.5 h-2.5" /> Vídeos</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{formatNumber(ch.avgViews)}</p>
                      <p className="text-[9px] text-muted-foreground">Média views</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{formatNumber(ch.maxVideoViews)}</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> Max views</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{ch.ageDays}d</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> Idade</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${ch.growthVelocity >= 500 ? 'text-accent' : ch.growthVelocity >= 200 ? 'text-emerald-400' : ''}`}>
                        {ch.growthVelocity}%
                      </p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> Growth</p>
                    </div>
                  </div>

                  {/* Efficiency bar */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[10px] text-muted-foreground">Eficiência:</span>
                    <Progress value={ch.efficiencyScore} className="h-1.5 flex-1" />
                    <span className="text-xs font-mono font-bold">{ch.efficiencyScore}/100</span>
                  </div>

                  {/* Top videos */}
                  {ch.videos.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Top vídeos recentes:</p>
                      {ch.videos.slice(0, 3).map((v: any) => (
                        <div key={v.id} className="flex items-center gap-2 text-xs">
                          <Flame className="w-3 h-3 text-accent flex-shrink-0" />
                          <span className="line-clamp-1 flex-1">{v.title}</span>
                          <span className="text-muted-foreground font-mono flex-shrink-0">{formatNumber(v.views)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => trackChannel(ch)}>
                    <Star className="w-3 h-3" /> Rastrear
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs"
                    onClick={() => window.open(`https://youtube.com/channel/${ch.id}`, '_blank')}>
                    <ExternalLink className="w-3 h-3" /> YouTube
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {hasSearched && !loading && channels.length === 0 && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Rocket className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhum canal emergente encontrado. Tente outro nicho ou amplie os filtros.</p>
        </div>
      )}
    </div>
  );
};
