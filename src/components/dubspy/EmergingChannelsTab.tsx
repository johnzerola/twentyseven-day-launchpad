import { useState, useEffect, useCallback } from 'react';
import { Rocket, Loader2, Filter, ExternalLink, Star, Users, Eye, Video, Clock, TrendingUp, Flame, Zap, Search as SearchIcon, BarChart3, MessageSquare, ThumbsUp, Activity, Upload, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
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
  viralScore: number;
  growthPotentialScore: number;
  algorithmBoostProbability: number;
  avgEngagement: number;
  avgCommentEngagement: number;
  avgLikeRatio: number;
  avgViewVelocity72h: number;
  uploadFrequencyDays: number;
}

interface EmergingChannelsTabProps {
  mode: 'emerging' | 'escapees';
}

const EMERGING_PRESETS = [
  { label: '< 5 vídeos', maxVideos: 5, maxAge: 90 },
  { label: '< 10 vídeos', maxVideos: 10, maxAge: 180 },
  { label: '< 1 mês', maxVideos: 50, maxAge: 30 },
  { label: '< 3 meses', maxVideos: 50, maxAge: 90 },
  { label: '< 6 meses', maxVideos: 50, maxAge: 180 },
];

const SORT_OPTIONS = [
  { value: 'viralScore', label: '🔥 Viral Score' },
  { value: 'subscribers', label: '👥 Inscritos' },
  { value: 'maxVideoViews', label: '👁 Max Views' },
  { value: 'growthVelocity', label: '📈 Crescimento' },
  { value: 'avgEngagement', label: '💬 Engajamento' },
  { value: 'avgViewVelocity72h', label: '⚡ Velocidade 72h' },
];

const ViralScoreRing = ({ score, label, size = 48 }: { score: number; label: string; size?: number }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  const stroke = score >= 70 ? 'stroke-emerald-400' : score >= 40 ? 'stroke-amber-400' : 'stroke-red-400';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth="3" className="stroke-secondary/50" />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" strokeWidth="3" className={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${color}`}>{score}</span>
      </div>
      <span className="text-[8px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
};

export const EmergingChannelsTab = ({ mode }: EmergingChannelsTabProps) => {
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [language, setLanguage] = useState('pt');
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [maxVideos, setMaxVideos] = useState(10);
  const [maxAge, setMaxAge] = useState(90);
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [maxChannelVideos, setMaxChannelVideos] = useState('');
  const [minVideoViews, setMinVideoViews] = useState('');
  const [minEngagement, setMinEngagement] = useState('');
  const [minViralScore, setMinViralScore] = useState('');
  const [sortBy, setSortBy] = useState(mode === 'escapees' ? 'growthVelocity' : 'viralScore');
  const [customNiche, setCustomNiche] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = [minSubs, maxSubs, maxChannelVideos, minVideoViews, minEngagement, minViralScore].filter(v => v).length;

  const tabKey = mode === 'emerging' ? 'emerging' : 'escapees';

  // Load last saved search for this mode on mount
  useEffect(() => {
    const loadLast = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .eq('tab', tabKey)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.results_json) {
        setChannels((data.results_json as any) || []);
        setMeta((data.channel_info_json as any) || null);
        const f = (data.filters_json as any) || {};
        if (f.niche) setNiche(f.niche);
        if (f.country) setCountry(f.country);
        if (f.language) setLanguage(f.language);
        setHasSearched(true);
      }
    };
    loadLast();
  }, [tabKey]);

  const persistSearch = useCallback(async (nicheQ: string, chs: ChannelResult[], metaData: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const filters = { niche: nicheQ, country, language, sortBy, maxVideos, maxAge, minSubs, maxSubs, maxChannelVideos, minVideoViews, minEngagement, minViralScore };
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('user_id', user.id)
      .eq('query', nicheQ)
      .eq('tab', tabKey)
      .maybeSingle();
    if (existing) {
      await supabase.from('saved_searches').update({
        results_json: chs as any,
        channel_info_json: metaData as any,
        filters_json: filters as any,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('saved_searches').insert({
        user_id: user.id, query: nicheQ, tab: tabKey,
        results_json: chs as any, channel_info_json: metaData as any, filters_json: filters as any,
      });
    }
  }, [country, language, sortBy, maxVideos, maxAge, minSubs, maxSubs, maxChannelVideos, minVideoViews, minEngagement, minViralScore, tabKey]);

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
          sortBy,
          maxVideos: mode === 'emerging' ? maxVideos : undefined,
          maxChannelAgeDays: mode === 'emerging' ? maxAge : undefined,
          minSubs: minSubs ? parseInt(minSubs) : undefined,
          maxSubs: maxSubs ? parseInt(maxSubs) : undefined,
          maxChannelVideos: maxChannelVideos ? parseInt(maxChannelVideos) : undefined,
          minVideoViews: minVideoViews ? parseInt(minVideoViews) : undefined,
          minEngagement: minEngagement ? parseFloat(minEngagement) : undefined,
          minViralScore: minViralScore ? parseInt(minViralScore) : undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const chs = data?.channels || [];
      const metaData = data?.meta || null;
      setChannels(chs);
      setMeta(metaData);
      if (!chs.length) toast.info('Nenhum canal encontrado. Tente ampliar os filtros.');
      await persistSearch(nicheQuery, chs, metaData);
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

        {/* Advanced Filters — shared across modes */}
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
            <div className="grid sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/30">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min inscritos</label>
                <Input type="number" placeholder="ex: 1000" value={minSubs} onChange={e => setMinSubs(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Max inscritos</label>
                <Input type="number" placeholder="ex: 100000" value={maxSubs} onChange={e => setMaxSubs(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Max vídeos do canal</label>
                <Input type="number" placeholder="ex: 50" value={maxChannelVideos} onChange={e => setMaxChannelVideos(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min views (melhor vídeo)</label>
                <Input type="number" placeholder="ex: 10000" value={minVideoViews} onChange={e => setMinVideoViews(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min engajamento (%)</label>
                <Input type="number" step="0.1" placeholder="ex: 3.0" value={minEngagement} onChange={e => setMinEngagement(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Min Viral Score</label>
                <Input type="number" placeholder="ex: 30" value={minViralScore} onChange={e => setMinViralScore(e.target.value)}
                  className="h-8 bg-secondary/50 text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Sort + Scan */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="h-9 rounded-md border border-input bg-secondary/50 px-2 text-xs">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Button onClick={scan} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6 flex-1 sm:flex-none">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
            {loading ? 'Escaneando...' : mode === 'emerging' ? 'Detectar Emergentes' : 'Detectar Escapees'}
          </Button>
        </div>
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
                    <div>
                      <p className="text-sm font-bold">{ch.uploadFrequencyDays || '—'}d</p>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Upload className="w-2.5 h-2.5" /> Freq.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-3 items-start">
                    <ViralScoreRing score={ch.viralScore || 0} label="Viral Score" />
                    <ViralScoreRing score={ch.growthPotentialScore || 0} label="Growth" />
                    <ViralScoreRing score={ch.algorithmBoostProbability || 0} label="Algo Boost" />
                    <div className="flex flex-col gap-1 text-[10px] ml-2">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ThumbsUp className="w-3 h-3" /> Like: {ch.avgLikeRatio || 0}%
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="w-3 h-3" /> Comments: {ch.avgCommentEngagement || 0}%
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="w-3 h-3" /> V72h: {formatNumber(ch.avgViewVelocity72h || 0)}
                      </span>
                    </div>
                  </div>

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

      {hasSearched && !loading && channels.length === 0 && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Rocket className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhum canal encontrado. Tente outro nicho ou amplie os filtros.</p>
        </div>
      )}
    </div>
  );
};
