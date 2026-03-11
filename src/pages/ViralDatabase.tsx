import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Copy, Zap, Target, BookOpen, Search as SearchIcon, Sparkles, Loader2,
  MessageSquare, ThumbsUp, Share2, Bell, ListOrdered, Lightbulb, TrendingUp, Hash,
  Globe, Eye, Users, Play, ChevronDown, ChevronUp, Palette, Brain, ExternalLink,
  Filter, BarChart3, Tv, ScanSearch
} from 'lucide-react';
import {
  VIRAL_HOOKS, VIRAL_CTAS, VIRAL_TITLE_PATTERNS, STORY_STRUCTURES, SEO_KEYWORD_PATTERNS,
  type ViralHook, type CallToAction, type TitlePattern, type StoryStructure,
  HOOK_STYLES, CTA_TYPES, TITLE_STYLES,
} from '@/lib/viralDatabase';

// ========== Types ==========
interface ChannelIntelligence {
  id: string;
  channel_name: string;
  youtube_channel_id: string;
  niche: string;
  sub_niche: string | null;
  style: string;
  country: string;
  language: string;
  subscribers: number;
  avg_views: number;
  growth_rate: string;
  is_faceless: boolean;
  is_monetized: boolean;
  viral_patterns: any;
  top_videos: any[];
  visual_style_notes: string | null;
  upload_frequency: string | null;
  rpm_estimate: number;
  analyzed_at: string | null;
}

const STYLES = ['all', 'pov', 'stickmen', 'wojak', 'cinematic', 'documentary', 'horror', 'whiteboard', 'animation', 'mrbeast', 'voce_sabia', 'fatos'] as const;
const GROWTH_COLORS: Record<string, string> = {
  explosive: 'bg-red-500/20 text-red-400 border-red-500/30',
  fast: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  steady: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};
const STYLE_LABELS: Record<string, string> = {
  pov: 'POV/Stories', stickmen: 'Stickmen', wojak: 'Wojak/Meme', cinematic: 'Cinematográfico',
  documentary: 'Documentário', horror: 'Dark/Horror', whiteboard: 'Whiteboard', animation: 'Animação',
  mrbeast: 'MrBeast-style', voce_sabia: 'Voce Sabia', fatos: 'Fatos/Lists',
};

const styleColors: Record<string, string> = {
  curiosidade: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  urgência: 'bg-red-500/20 text-red-400 border-red-500/30',
  polêmica: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  storytelling: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  choque: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  empatia: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  números: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  contraintuitivo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado!'); };

const formatNumber = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const RetentionBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 rounded-full bg-secondary/50 overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${value}%` }} />
    </div>
    <span className="text-xs font-mono text-emerald-400">{value}%</span>
  </div>
);

// ========== Channel Card ==========
const ChannelCard = ({ channel, onUsePatterns }: { channel: ChannelIntelligence; onUsePatterns: (c: ChannelIntelligence) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const patterns = channel.viral_patterns || {};
  const hooks = patterns.hooks || [];
  const topVids = Array.isArray(channel.top_videos) ? channel.top_videos : [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm truncate">{channel.channel_name}</h3>
            {channel.is_faceless && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Faceless</Badge>}
            <Badge className={GROWTH_COLORS[channel.growth_rate] || ''} variant="outline">{channel.growth_rate}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{formatNumber(channel.subscribers)}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(channel.avg_views)} avg</span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{channel.country}</span>
            <span className="flex items-center gap-1">RPM ${channel.rpm_estimate}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Badge className="bg-secondary/60 text-foreground text-[10px]">{STYLE_LABELS[channel.style] || channel.style}</Badge>
        </div>
      </div>

      {/* Niche */}
      <div className="flex gap-1.5 flex-wrap">
        <Badge variant="secondary" className="text-[10px]">{channel.niche}</Badge>
        {channel.sub_niche && <Badge variant="outline" className="text-[10px]">{channel.sub_niche}</Badge>}
        {channel.upload_frequency && <Badge variant="outline" className="text-[10px]">📅 {channel.upload_frequency}</Badge>}
      </div>

      {/* Hooks preview */}
      {hooks.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Hooks</p>
          <div className="flex flex-wrap gap-1.5">
            {hooks.slice(0, 3).map((h: string, i: number) => (
              <button key={i} onClick={() => copyText(h)}
                className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-[200px]">
                "{h}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expand */}
      <div className="flex items-center justify-between pt-1">
        <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Menos' : 'Detalhes'}
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1 h-7 border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => onUsePatterns(channel)}>
          <Sparkles className="w-3 h-3" /> Usar no Roteiro
        </Button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden">
            {/* Visual style */}
            {channel.visual_style_notes && (
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Estilo Visual</p>
                <p className="text-xs">{channel.visual_style_notes}</p>
              </div>
            )}

            {/* Pacing & Transitions */}
            {(patterns.pacing || patterns.transitions) && (
              <div className="grid grid-cols-2 gap-2">
                {patterns.pacing && (
                  <div className="p-2 rounded-lg bg-secondary/20 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Pacing</p>
                    <p className="text-xs font-medium">{patterns.pacing}</p>
                  </div>
                )}
                {patterns.thumbnail_style && (
                  <div className="p-2 rounded-lg bg-secondary/20 border border-border/20">
                    <p className="text-[10px] text-muted-foreground">Thumbnail</p>
                    <p className="text-xs font-medium">{patterns.thumbnail_style}</p>
                  </div>
                )}
              </div>
            )}

            {/* Top videos */}
            {topVids.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Vídeos</p>
                {topVids.slice(0, 3).map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 border border-border/20">
                    {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="w-16 h-9 rounded object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{v.title}</p>
                      <p className="text-[10px] text-muted-foreground">{formatNumber(v.views)} views</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ========== Main Component ==========
const ViralDatabase = () => {
  const [channels, setChannels] = useState<ChannelIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [styleFilter, setStyleFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [facelessOnly, setFacelessOnly] = useState(false);
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [patternFilter, setPatternFilter] = useState('');
  const [patternStyleFilter, setPatternStyleFilter] = useState('');
  const [nicheFilter, setNicheFilter] = useState('');

  // Load channels from DB
  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('channel_intelligence' as any)
      .select('*')
      .order('subscribers', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error loading channels:', error);
      toast.error('Erro ao carregar canais');
    } else {
      setChannels((data as any[]) || []);
    }
    setLoading(false);
  };

  // Filter channels
  // Niches for filter
  const niches = useMemo(() => {
    const map = new Map<string, number>();
    channels.forEach(c => map.set(c.niche, (map.get(c.niche) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      if (styleFilter !== 'all' && ch.style !== styleFilter) return false;
      if (nicheFilter && ch.niche !== nicheFilter) return false;
      if (facelessOnly && !ch.is_faceless) return false;
      if (countryFilter && ch.country !== countryFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return ch.channel_name.toLowerCase().includes(q) ||
               ch.niche.toLowerCase().includes(q) ||
               (ch.sub_niche || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [channels, styleFilter, nicheFilter, searchFilter, countryFilter, facelessOnly]);

  // Extract patterns from all channels
  const allPatterns = useMemo(() => {
    const hookMap = new Map<string, { text: string; count: number; avgViews: number; styles: Set<string> }>();
    channels.forEach(ch => {
      const hooks = ch.viral_patterns?.hooks || [];
      hooks.forEach((h: string) => {
        const key = h.toLowerCase().trim();
        if (!hookMap.has(key)) {
          hookMap.set(key, { text: h, count: 0, avgViews: 0, styles: new Set() });
        }
        const entry = hookMap.get(key)!;
        entry.count++;
        entry.avgViews += ch.avg_views;
        entry.styles.add(ch.style);
      });
    });
    return Array.from(hookMap.values())
      .map(e => ({ ...e, avgViews: Math.round(e.avgViews / e.count), styles: Array.from(e.styles) }))
      .sort((a, b) => b.count - a.count);
  }, [channels]);

  const filteredPatterns = useMemo(() => {
    return allPatterns.filter(p => {
      if (patternFilter && !p.text.toLowerCase().includes(patternFilter.toLowerCase())) return false;
      if (patternStyleFilter && !p.styles.includes(patternStyleFilter)) return false;
      return true;
    });
  }, [allPatterns, patternFilter, patternStyleFilter]);

  // Visual styles from channels
  const visualStyles = useMemo(() => {
    const styleMap = new Map<string, { channels: ChannelIntelligence[]; descriptions: string[] }>();
    channels.forEach(ch => {
      if (!styleMap.has(ch.style)) styleMap.set(ch.style, { channels: [], descriptions: [] });
      const entry = styleMap.get(ch.style)!;
      entry.channels.push(ch);
      if (ch.visual_style_notes) entry.descriptions.push(ch.visual_style_notes);
    });
    return styleMap;
  }, [channels]);

  // Countries for filter
  const countries = useMemo(() => {
    const set = new Set(channels.map(c => c.country));
    return Array.from(set).sort();
  }, [channels]);

  // Analyze new channel
  const analyzeChannel = async () => {
    if (!analyzeUrl.trim()) return toast.error('Cole a URL do canal');
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-viral-channels', {
        body: { channelUrl: analyzeUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Canal "${data?.channel?.channel_name}" analisado!`);
      setAnalyzeUrl('');
      loadChannels();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('402')) toast.error('Créditos insuficientes.');
      else if (msg.includes('429')) toast.error('Rate limit. Tente novamente.');
      else toast.error(msg || 'Erro ao analisar canal');
    } finally {
      setAnalyzing(false);
    }
  };

  const usePatterns = (ch: ChannelIntelligence) => {
    const patterns = ch.viral_patterns || {};
    const text = [
      `🎯 Canal Referência: ${ch.channel_name} (${formatNumber(ch.subscribers)} subs)`,
      `📊 Style: ${ch.style} | Growth: ${ch.growth_rate}`,
      patterns.hooks ? `🪝 Hooks: ${(patterns.hooks as string[]).join(' | ')}` : '',
      patterns.pacing ? `⏱ Pacing: ${patterns.pacing}` : '',
      patterns.thumbnail_style ? `🖼 Thumbnail: ${patterns.thumbnail_style}` : '',
      ch.visual_style_notes ? `🎨 Visual: ${ch.visual_style_notes}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Padrões copiados! Cole no campo "Contexto Viral" do Script Engine.');
  };

  const ctaIcons: Record<string, any> = {
    inscrição: Bell, like: ThumbsUp, comentário: MessageSquare,
    compartilhar: Share2, playlist: ListOrdered, produto: Lightbulb,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Viral Database</h1>
            <p className="text-sm text-muted-foreground">
              {channels.length} canais analisados · Inteligência de canais dark/faceless
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList className="bg-secondary/50 border border-border/50">
            <TabsTrigger value="channels" className="gap-1.5"><Brain className="w-4 h-4" />Channel Intelligence</TabsTrigger>
            <TabsTrigger value="patterns" className="gap-1.5"><Zap className="w-4 h-4" />Patterns Library</TabsTrigger>
            <TabsTrigger value="styles" className="gap-1.5"><Palette className="w-4 h-4" />Visual Style Guide</TabsTrigger>
          </TabsList>

          {/* ========== TAB 1: Channel Intelligence ========== */}
          <TabsContent value="channels" className="space-y-4">
            {/* Analyze new channel */}
            <div className="glass rounded-xl p-4 space-y-3 border-primary/10">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Filtrar canais por nome, nicho..." value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)} className="pl-10 bg-secondary/50" />
                </div>
                <div className="flex gap-2 items-center">
                  <Input placeholder="URL do canal YouTube..." value={analyzeUrl}
                    onChange={e => setAnalyzeUrl(e.target.value)} className="w-64 bg-secondary/50"
                    onKeyDown={e => e.key === 'Enter' && analyzeChannel()} />
                  <Button onClick={analyzeChannel} disabled={analyzing} className="gradient-hero border-0 gap-2 whitespace-nowrap">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                    Analisar Canal
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap items-center">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                {STYLES.map(s => (
                  <Badge key={s}
                    className={`cursor-pointer text-[10px] ${styleFilter === s ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground'}`}
                    onClick={() => setStyleFilter(s)}>
                    {s === 'all' ? 'Todos' : STYLE_LABELS[s] || s}
                  </Badge>
                ))}
                <Badge className={`cursor-pointer text-[10px] ${facelessOnly ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => setFacelessOnly(!facelessOnly)}>
                  👤 Faceless
                </Badge>
                {countries.length > 0 && (
                  <select className="text-[10px] bg-secondary/50 border border-border/50 rounded px-2 py-1 text-foreground"
                    value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
                    <option value="">🌍 Todos países</option>
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {niches.length > 0 && (
                  <select className="text-[10px] bg-secondary/50 border border-border/50 rounded px-2 py-1 text-foreground"
                    value={nicheFilter} onChange={e => setNicheFilter(e.target.value)}>
                    <option value="">🎯 Todos nichos</option>
                    {niches.map(([n, count]) => <option key={n} value={n}>{n} ({count})</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Canais', value: channels.length, icon: Tv },
                { label: 'Filtrados', value: filteredChannels.length, icon: Filter },
                { label: 'Nichos', value: niches.length, icon: Target },
                { label: 'Crescimento Explosivo', value: channels.filter(c => c.growth_rate === 'explosive').length, icon: TrendingUp },
              ].map((stat, i) => (
                <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Channel grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredChannels.map(ch => (
                  <ChannelCard key={ch.id} channel={ch} onUsePatterns={usePatterns} />
                ))}
                {filteredChannels.length === 0 && (
                  <p className="col-span-2 text-center text-muted-foreground py-8">Nenhum canal encontrado com esses filtros.</p>
                )}
              </div>
            )}
          </TabsContent>

          {/* ========== TAB 2: Patterns Library ========== */}
          <TabsContent value="patterns" className="space-y-4">
            {/* Extracted hooks from channels */}
            <div className="glass rounded-xl p-4 space-y-3 border-primary/10">
              <h3 className="font-bold flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Hooks Extraídos de {channels.length} Canais</h3>
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar hook..." value={patternFilter}
                    onChange={e => setPatternFilter(e.target.value)} className="pl-10 bg-secondary/50" />
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  <Badge className={`cursor-pointer text-[10px] ${!patternStyleFilter ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'}`}
                    onClick={() => setPatternStyleFilter('')}>Todos</Badge>
                  {Object.keys(STYLE_LABELS).map(s => (
                    <Badge key={s} className={`cursor-pointer text-[10px] ${patternStyleFilter === s ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground'}`}
                      onClick={() => setPatternStyleFilter(patternStyleFilter === s ? '' : s)}>
                      {STYLE_LABELS[s]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {filteredPatterns.slice(0, 50).map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                  className="glass rounded-xl p-4 space-y-2 hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">"{p.text}"</p>
                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => copyText(p.text)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] gap-1"><BarChart3 className="w-2.5 h-2.5" />{p.count} canais</Badge>
                      <Badge variant="outline" className="text-[10px]">{formatNumber(p.avgViews)} avg views</Badge>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {p.styles.slice(0, 2).map(s => (
                        <Badge key={s} variant="outline" className="text-[9px]">{STYLE_LABELS[s] || s}</Badge>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Classic hooks, CTAs, titles, structures */}
            <div className="border-t border-border/30 pt-6 space-y-4">
              <h3 className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Biblioteca Clássica</h3>

              <Tabs defaultValue="hooks" className="space-y-3">
                <TabsList className="bg-secondary/30">
                  <TabsTrigger value="hooks" className="text-xs">Hooks ({VIRAL_HOOKS.length})</TabsTrigger>
                  <TabsTrigger value="ctas" className="text-xs">CTAs ({VIRAL_CTAS.length})</TabsTrigger>
                  <TabsTrigger value="titles" className="text-xs">Títulos ({VIRAL_TITLE_PATTERNS.length})</TabsTrigger>
                  <TabsTrigger value="stories" className="text-xs">Estruturas ({STORY_STRUCTURES.length})</TabsTrigger>
                  <TabsTrigger value="seo" className="text-xs">SEO ({SEO_KEYWORD_PATTERNS.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="hooks">
                  <div className="grid gap-3 md:grid-cols-2">
                    {VIRAL_HOOKS.map((hook, i) => (
                      <motion.div key={hook.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">{hook.text}</p>
                          <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => copyText(hook.text)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={styleColors[hook.style]}>{hook.style}</Badge>
                          {hook.niches.slice(0, 3).map(n => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}
                        </div>
                        <RetentionBar value={hook.estimatedRetention} />
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="ctas">
                  <div className="grid gap-3 md:grid-cols-2">
                    {VIRAL_CTAS.map((cta, i) => {
                      const Icon = ctaIcons[cta.type] || Target;
                      return (
                        <motion.div key={cta.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">{cta.text}</p>
                            <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => copyText(cta.text)}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                              <Badge variant="outline" className="gap-1"><Icon className="w-3 h-3" />{cta.type}</Badge>
                              <Badge variant="secondary">{cta.placement}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 10 }).map((_, j) => (
                                <div key={j} className={`w-1.5 h-3 rounded-sm ${j < cta.effectiveness ? 'bg-emerald-400' : 'bg-secondary/50'}`} />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="titles">
                  <div className="grid gap-3 md:grid-cols-2">
                    {VIRAL_TITLE_PATTERNS.map((t, i) => (
                      <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-medium font-mono">{t.pattern}</p>
                            <p className="text-xs text-muted-foreground italic">"{t.example}"</p>
                          </div>
                          <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => copyText(t.pattern)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className={styleColors[t.style]}>{t.style}</Badge>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-sm font-mono text-emerald-400">{t.avgCTR}% CTR</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="stories">
                  <div className="space-y-4">
                    {STORY_STRUCTURES.map((s, i) => (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="glass rounded-xl p-5 space-y-4 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg">{s.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => copyText(s.phases.map(p => `[${p.duration}] ${p.name}: ${p.tip}`).join('\n'))}>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {s.phases.map((phase, j) => (
                            <div key={j} className="flex gap-3 items-start p-3 rounded-lg bg-secondary/30 border border-border/30">
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{j + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{phase.name}</span>
                                  <Badge variant="outline" className="text-[10px]">{phase.duration}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{phase.tip}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                          <div className="flex gap-1.5 flex-wrap">
                            {s.bestFor.map(b => <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>)}
                          </div>
                          <p className="text-[10px] text-muted-foreground max-w-xs text-right">{s.retentionCurve}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="seo">
                  <div className="grid gap-3 md:grid-cols-2">
                    {SEO_KEYWORD_PATTERNS.map((seo, i) => (
                      <motion.div key={seo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="glass rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium font-mono">{seo.pattern}</p>
                          <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => copyText(seo.pattern)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {seo.examples.map((ex, j) => <Badge key={j} variant="outline" className="text-[10px]">{ex}</Badge>)}
                        </div>
                        <div className="flex gap-2">
                          <Badge className={seo.searchVolume === 'alto' ? 'bg-emerald-500/20 text-emerald-400' : seo.searchVolume === 'médio' ? 'bg-amber-500/20 text-amber-400' : 'bg-secondary text-muted-foreground'}>
                            Vol: {seo.searchVolume}
                          </Badge>
                          <Badge className={seo.competition === 'baixa' ? 'bg-emerald-500/20 text-emerald-400' : seo.competition === 'média' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                            Comp: {seo.competition}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* ========== TAB 3: Visual Style Guide ========== */}
          <TabsContent value="styles" className="space-y-4">
            {Array.from(visualStyles.entries()).map(([style, data]) => (
              <Card key={style} className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Palette className="w-5 h-5 text-primary" />
                      {STYLE_LABELS[style] || style}
                    </CardTitle>
                    <Badge variant="secondary">{data.channels.length} canais</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Common visual patterns */}
                  {data.descriptions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Características Visuais</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {data.descriptions.slice(0, 4).map((desc, i) => (
                          <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                            <p className="text-xs">{desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reference channels */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Canais de Referência</p>
                    <div className="flex gap-2 flex-wrap">
                      {data.channels.slice(0, 6).map(ch => (
                        <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/20 border border-border/20">
                          <span className="text-xs font-medium">{ch.channel_name}</span>
                          <span className="text-[10px] text-muted-foreground">{formatNumber(ch.subscribers)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Common hooks for style */}
                  {(() => {
                    const styleHooks = allPatterns.filter(p => p.styles.includes(style)).slice(0, 5);
                    if (styleHooks.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Hooks Mais Usados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {styleHooks.map((h, i) => (
                            <button key={i} onClick={() => copyText(h.text)}
                              className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              "{h.text}" <span className="text-[10px] text-muted-foreground">({h.count}x)</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Thumbnail patterns for style */}
                  {(() => {
                    const thumbPatterns = data.channels
                      .filter(c => c.viral_patterns?.thumbnail_style)
                      .map(c => c.viral_patterns.thumbnail_style)
                      .slice(0, 3);
                    if (thumbPatterns.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Estilo de Thumbnail</p>
                        <div className="space-y-1.5">
                          {thumbPatterns.map((t: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-secondary/20">
                              <Play className="w-3 h-3 text-primary shrink-0" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ViralDatabase;
