import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Compass, Search, Star, TrendingUp, Eye, Users, DollarSign, Zap, Filter, BarChart3, Target, Layers, Shield, Crown, Globe, ArrowUpRight, Flame, CheckCircle, XCircle, AlertTriangle, Lightbulb, Brain, Copy, Clock, Rocket, BookOpen, Lock, Unlock, ExternalLink, Swords, Timer, BadgeDollarSign, History, Trash2, FolderOpen, Database, Sparkles, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/formatters';
import { COUNTRIES, YPP_SUBS, YPP_HOURS } from '@/lib/constants';
import { useNavigate } from 'react-router-dom';

const QUICK_NICHES = [
  'finanças pessoais', 'true crime', 'horror stories', 'motivacional', 'curiosidades',
  'crypto', 'saúde', 'tecnologia', 'gaming', 'receitas', 'educação', 'viagem',
  'beleza', 'fitness', 'negócios', 'humor', 'estoicismo', 'história', 'ciência', 'IA',
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142,76%,36%)', 'hsl(210,100%,56%)', 'hsl(45,93%,47%)'];

const NicheExplorer = () => {
  const navigate = useNavigate();
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterFaceless, setFilterFaceless] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load saved analyses on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: saved } = await supabase
        .from('saved_niche_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (saved?.length) {
        setSavedAnalyses(saved);
        // Load most recent analysis
        const latest = saved[0];
        setNiche(latest.niche);
        setCountry(latest.country || 'BR');
        setData(latest.analysis_json as any);
      }
    })();
  }, []);

  const saveAnalysis = async (nicheStr: string, countryStr: string, result: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('saved_niche_analyses').insert({
      user_id: user.id,
      niche: nicheStr,
      country: countryStr,
      analysis_json: result,
      score: result?.analysis?.score || 0,
    } as any);
    // Refresh list
    const { data: saved } = await supabase
      .from('saved_niche_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (saved) setSavedAnalyses(saved);
  };

  const deleteAnalysis = async (id: string) => {
    await supabase.from('saved_niche_analyses').delete().eq('id', id);
    setSavedAnalyses(prev => prev.filter(a => a.id !== id));
    toast.success('Análise removida');
  };

  const loadAnalysis = (saved: any) => {
    setNiche(saved.niche);
    setCountry(saved.country || 'BR');
    setData(saved.analysis_json);
    setShowHistory(false);
    setActiveTab('overview');
  };

  const explore = async (nicheOverride?: string) => {
    const q = (nicheOverride || niche).trim();
    if (!q) return;
    setNiche(q);
    setLoading(true);
    setData(null);
    setActiveTab('overview');

    const phases = ['Buscando vídeos trending...', 'Analisando canais concorrentes...', 'IA processando inteligência...', 'Calculando projeções realistas...'];
    let i = 0;
    setLoadingPhase(phases[0]);
    const interval = setInterval(() => {
      i++;
      if (i < phases.length) setLoadingPhase(phases[i]);
    }, 2500);

    try {
      const { data: result, error } = await supabase.functions.invoke('niche-explorer', {
        body: { niche: q, country, language: 'pt' },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
      await saveAnalysis(q, country, result);
      toast.success('Análise completa e salva!');
    } catch (err: any) {
      toast.error(err.message || 'Erro na análise');
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const trackChannel = async (ch: any) => {
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

  const a = data?.analysis;
  const channels = data?.channels || [];
  const trending = data?.trending || [];
  const countryMeta = data?.meta?.countryData;
  const viralDbData = data?.viralDbData;
  const searchQueries = data?.meta?.searchQueries || [];
  const filteredChannels = filterFaceless ? channels.filter((c: any) => c.faceless) : channels;

  const radarData = a?.radarMetrics ? [
    { metric: 'RPM', value: a.radarMetrics.rpm },
    { metric: 'Crescimento', value: a.radarMetrics.growth },
    { metric: 'Facilidade', value: a.radarMetrics.ease },
    { metric: 'Faceless', value: a.radarMetrics.faceless },
    { metric: 'Monet. Speed', value: a.radarMetrics.monetizationSpeed },
    { metric: 'Viralidade', value: a.radarMetrics.virality },
  ] : [];

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado!'); };

  const strategyTypeLabel = (type: string) => {
    switch (type) {
      case 'hook_pattern': return { label: 'Hook', color: 'bg-accent/20 text-accent', icon: Zap };
      case 'title_formula': return { label: 'Título', color: 'bg-primary/20 text-primary', icon: Crown };
      case 'content_gap': return { label: 'Gap', color: 'bg-emerald-500/20 text-emerald-400', icon: Target };
      case 'viral_format': return { label: 'Viral', color: 'bg-yellow-500/20 text-yellow-400', icon: Flame };
      default: return { label: type, color: 'bg-secondary', icon: Lightbulb };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              Niche Intelligence <Badge className="bg-accent/20 text-accent text-[10px]">AI CEO</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Dados reais do YouTube API — projeções realistas por país</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Digite qualquer nicho: ex. finanças, true crime, IA, estoicismo..." value={niche}
                onChange={e => setNiche(e.target.value)} onKeyDown={e => e.key === 'Enter' && explore()}
                className="pl-10 bg-secondary/50 h-11" />
            </div>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="h-11 rounded-lg border border-input bg-secondary/50 px-3 text-sm min-w-[140px]">
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button onClick={() => explore()} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
              <Brain className="w-4 h-4" /> {loading ? 'Analisando...' : 'Analisar'}
            </Button>
            {savedAnalyses.length > 0 && (
              <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="h-11 gap-2">
                <History className="w-4 h-4" /> {savedAnalyses.length}
              </Button>
            )}
          </div>

          {/* History dropdown */}
          <AnimatePresence>
            {showHistory && savedAnalyses.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground font-medium">Análises salvas:</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {savedAnalyses.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2 hover:bg-secondary/50 transition-all cursor-pointer group"
                      onClick={() => loadAnalysis(s)}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        s.score >= 75 ? 'bg-emerald-500/20 text-emerald-400' : s.score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-destructive/20 text-destructive'
                      }`}>{s.score}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium capitalize truncate">{s.niche}</p>
                        <p className="text-[10px] text-muted-foreground">{s.country} · {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteAnalysis(s.id); }}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            {QUICK_NICHES.map(n => (
              <button key={n} onClick={() => explore(n)} disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all capitalize">
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass rounded-2xl p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Brain className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <p className="text-lg font-semibold">{loadingPhase}</p>
              <p className="text-sm text-muted-foreground">Dados reais do YouTube API — cada pesquisa é única</p>
              <Progress value={undefined} className="h-1 w-48 mx-auto" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {data && a && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/20"><Target className="w-4 h-4" /> Inteligência</TabsTrigger>
              <TabsTrigger value="strategy" className="gap-2 data-[state=active]:bg-primary/20"><Zap className="w-4 h-4" /> Estratégia</TabsTrigger>
              <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-primary/20"><DollarSign className="w-4 h-4" /> Projeção $</TabsTrigger>
              <TabsTrigger value="channels" className="gap-2 data-[state=active]:bg-primary/20"><Users className="w-4 h-4" /> Concorrentes ({filteredChannels.length})</TabsTrigger>
              <TabsTrigger value="trending" className="gap-2 data-[state=active]:bg-primary/20"><Flame className="w-4 h-4" /> Trending</TabsTrigger>
            </TabsList>

            {/* === TAB: OVERVIEW === */}
            <TabsContent value="overview" className="space-y-4">
              {/* Score Hero */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-2xl p-6 border-2 ${
                  a.score >= 75 ? 'border-emerald-500/30' : a.score >= 50 ? 'border-yellow-500/30' : 'border-destructive/30'
                }`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black ${
                      a.score >= 75 ? 'bg-emerald-500/20 text-emerald-400' : a.score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-destructive/20 text-destructive'
                    }`}>
                      {a.score}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold capitalize">{niche}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{a.verdictEmoji} {a.verdict}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div><p className="text-2xl font-bold text-accent">${a.estimatedRpm}</p><p className="text-[10px] text-muted-foreground">RPM ({country})</p></div>
                    <div><p className="text-2xl font-bold text-primary">{a.facelessViability}%</p><p className="text-[10px] text-muted-foreground">Faceless Viável</p></div>
                    <div><p className="text-2xl font-bold">{data.meta.totalChannels}</p><p className="text-[10px] text-muted-foreground">Canais analisados</p></div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {a.score >= 70 && (
                      <Button onClick={() => navigate(`/scripts?niche=${encodeURIComponent(niche)}&style=${a.facelessViability > 50 ? 'faceless' : 'talking_head'}`)}
                        className="gradient-hero border-0 gap-2 h-11 px-6">
                        <Rocket className="w-4 h-4" /> Pipeline de Roteiro
                      </Button>
                    )}
                    <Button variant="outline" className="gap-2 h-11" onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return toast.error('Faça login');
                      const { data: proj, error } = await supabase.from('video_projects').insert({
                        user_id: user.id, title: `Projeto: ${niche}`, niche: niche, status: 'draft',
                      }).select().single();
                      if (error) return toast.error('Erro ao criar projeto');
                      toast.success('Projeto criado!');
                      navigate('/workflow');
                    }}>
                      <FolderOpen className="w-4 h-4" /> Salvar como Projeto
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Monetization Timeline */}
              <div className="glass rounded-2xl p-5 border border-accent/20">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent" /> Linha do Tempo de Monetização — {COUNTRIES.find(c => c.value === country)?.label || country}
                </h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-secondary/30 rounded-xl p-4 text-center">
                    <BadgeDollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-primary">{a.monthsToMonetize || countryMeta?.avgMonths || '?'} meses</p>
                    <p className="text-[10px] text-muted-foreground">Para atingir YPP</p>
                    <p className="text-[9px] text-muted-foreground mt-1">({YPP_SUBS} subs + {YPP_HOURS} watch hours)</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 text-center">
                    <DollarSign className="w-6 h-6 text-accent mx-auto mb-2" />
                    <p className="text-2xl font-bold text-accent">{a.monthsToFirstPayout || (countryMeta?.avgMonths ? countryMeta.avgMonths + 2 : '?')} meses</p>
                    <p className="text-[10px] text-muted-foreground">Primeiro pagamento</p>
                    <p className="text-[9px] text-muted-foreground mt-1">Min: {countryMeta?.currency} {countryMeta?.minPayout}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">${a.estimatedRpm}</p>
                    <p className="text-[10px] text-muted-foreground">RPM médio ({country})</p>
                    <p className="text-[9px] text-muted-foreground mt-1">Varia por nicho e conteúdo</p>
                  </div>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { icon: DollarSign, label: 'RPM', value: `$${a.estimatedRpm}`, color: 'text-accent' },
                  { icon: BarChart3, label: 'Saturação', value: a.saturation, color: a.saturation === 'Baixa' ? 'text-emerald-400' : a.saturation === 'Média' ? 'text-yellow-400' : 'text-destructive' },
                  { icon: Zap, label: 'Dificuldade', value: a.difficulty, color: a.difficulty === 'Fácil' ? 'text-emerald-400' : a.difficulty === 'Médio' ? 'text-yellow-400' : 'text-destructive' },
                  { icon: TrendingUp, label: 'Tendência', value: a.growthTrend, color: ['Explodindo', 'Crescendo'].includes(a.growthTrend) ? 'text-emerald-400' : 'text-yellow-400' },
                  { icon: Clock, label: 'Monet. Speed', value: a.monetizationSpeed, color: 'text-primary' },
                  { icon: Users, label: 'Audiência', value: a.audienceSize, color: 'text-muted-foreground' },
                ].map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-3 text-center">
                    <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
                    <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[9px] text-muted-foreground">{m.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Radar + Revenue Split */}
              <div className="grid lg:grid-cols-2 gap-4">
                {radarData.length > 0 && (
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" /> Radar de Oportunidade
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {a.revenueSplit?.length > 0 && (
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-accent" /> Fontes de Receita Projetadas
                    </h3>
                    <div className="h-52 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={a.revenueSplit.map((r: any) => ({ name: r.source, value: r.percent }))} cx="50%" cy="50%" innerRadius={45} outerRadius={85} dataKey="value" paddingAngle={3}>
                            {a.revenueSplit.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 flex-wrap mt-2">
                      {a.revenueSplit.map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground">{r.source} ({r.percent}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-niches */}
              {a.subNiches?.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Sub-nichos com Oportunidade
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {a.subNiches.map((sn: any, i: number) => (
                      <button key={i} onClick={() => explore(sn.name)}
                        className={`text-left p-3 rounded-xl border transition-all hover:shadow-md ${
                          sn.opportunity === 'Alta' ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10' :
                          sn.opportunity === 'Média' ? 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10' :
                          'border-border bg-secondary/30 hover:bg-secondary/50'
                        }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{sn.name}</span>
                          <Badge className={`text-[9px] ${
                            sn.opportunity === 'Alta' ? 'bg-emerald-500/20 text-emerald-400' : sn.opportunity === 'Média' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
                          }`}>{sn.opportunity}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{sn.reason}</p>
                        <p className="text-[9px] text-primary mt-1">Clique para analisar →</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Blueprint */}
              {a.retentionBlueprint && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent" /> Blueprint de Retenção
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Duração Ideal', value: a.retentionBlueprint.idealLength, icon: Clock },
                      { label: 'Janela de Hook', value: a.retentionBlueprint.hookWindow, icon: Zap },
                      { label: 'Open Loops', value: a.retentionBlueprint.openLoopStrategy, icon: Target },
                      { label: 'Pattern Interrupts', value: a.retentionBlueprint.patternInterrupts, icon: Flame },
                      { label: 'End Screen', value: a.retentionBlueprint.endScreenStrategy, icon: ArrowUpRight },
                    ].map((item, i) => (
                      <div key={i} className="bg-secondary/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <item.icon className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                        </div>
                        <p className="text-xs font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deep Insight */}
              {a.deepInsight && (
                <div className="glass rounded-2xl p-5 border border-primary/20">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-accent" /> Insight de CEO — Visão Brutal
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.deepInsight}</p>
                </div>
              )}

              {/* Warnings + Opportunities */}
              <div className="grid lg:grid-cols-2 gap-4">
                {a.warnings?.length > 0 && (
                  <div className="glass rounded-2xl p-5 border border-destructive/20">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" /> Riscos & Avisos
                    </h3>
                    <ul className="space-y-2">
                      {a.warnings.map((w: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.opportunities?.length > 0 && (
                  <div className="glass rounded-2xl p-5 border border-emerald-500/20">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-emerald-400">
                      <Lightbulb className="w-4 h-4" /> Oportunidades Ocultas
                    </h3>
                    <ul className="space-y-2">
                      {a.opportunities.map((o: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* === TAB: STRATEGY (replaced Hooks & Titles) === */}
            <TabsContent value="strategy" className="space-y-4">
              {a.contentStrategy?.length > 0 ? (
                <div className="space-y-3">
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent" /> Estratégias de Conteúdo (baseadas nos dados reais)
                    </h3>
                    <div className="space-y-3">
                      {a.contentStrategy.map((s: any, i: number) => {
                        const st = strategyTypeLabel(s.type);
                        return (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className="bg-secondary/30 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                                s.effectiveness >= 80 ? 'bg-emerald-500/20 text-emerald-400' : s.effectiveness >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
                              }`}>{s.effectiveness}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-[9px] ${st.color}`}>{st.label}</Badge>
                                  <p className="text-sm font-semibold truncate">{s.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 mt-2">
                              <span className="text-[10px] text-muted-foreground">Ex:</span>
                              <p className="text-xs flex-1 italic">"{s.example}"</p>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copyText(s.example)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma estratégia identificada.</p>
                </div>
              )}
            </TabsContent>

            {/* === TAB: REVENUE === */}
            <TabsContent value="revenue" className="space-y-4">
              {/* Monetization timeline */}
              <div className="glass rounded-2xl p-5 border border-accent/20">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent" /> Realidade da Monetização — {COUNTRIES.find(c => c.value === country)?.label || country}
                </h3>
                <div className="bg-secondary/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
                    <div>
                      <p className="text-sm font-medium">Requisitos do YPP</p>
                      <p className="text-xs text-muted-foreground">1.000 inscritos + 4.000 horas de exibição (ou 10M views de Shorts)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">2</div>
                    <div>
                      <p className="text-sm font-medium">Tempo estimado: ~{a.monthsToMonetize || countryMeta?.avgMonths} meses</p>
                      <p className="text-xs text-muted-foreground">Neste nicho em {country}, com uploads consistentes (2-3x/semana)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">3</div>
                    <div>
                      <p className="text-sm font-medium">Primeiro pagamento: ~{a.monthsToFirstPayout || '?'} meses</p>
                      <p className="text-xs text-muted-foreground">Mínimo para saque: {countryMeta?.currency} {countryMeta?.minPayout} | RPM médio: ${a.estimatedRpm}</p>
                    </div>
                  </div>
                </div>
              </div>

              {a.revenueProjection?.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-lg font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-accent" /> Projeção Realista — {niche} ({country})
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={a.revenueProjection.map((r: any) => ({ ...r, label: `Mês ${r.month}` }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                          formatter={(v: number, name: string) => [`${name === 'revenue' ? '$' : ''}${formatNumber(v)}`, name === 'revenue' ? 'Receita' : name === 'views' ? 'Views' : 'Subs']} />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {a.revenueProjection.map((r: any) => (
                      <div key={r.month} className="bg-secondary/30 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground">Mês {r.month}</p>
                        <p className={`text-lg font-bold ${r.revenue > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                          {r.revenue > 0 ? `$${formatNumber(r.revenue)}` : '$0'}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{formatNumber(r.views)} views · {formatNumber(r.subs)} subs</p>
                        {r.milestone && (
                          <Badge className="text-[8px] mt-1 bg-accent/20 text-accent">{r.milestone}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === TAB: CHANNELS / COMPETITORS === */}
            <TabsContent value="channels" className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={filterFaceless} onChange={e => setFilterFaceless(e.target.checked)} className="rounded" />
                  Apenas Faceless
                </label>
                <span className="text-xs text-muted-foreground">{filteredChannels.length} canais</span>
              </div>

              {/* Competitor Insights */}
              {a.competitorInsights?.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-primary/20">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" /> Análise de Concorrentes — Como Competir
                  </h3>
                  <div className="space-y-3">
                    {a.competitorInsights.map((ci: any, i: number) => {
                      const ch = channels.find((c: any) => c.id === ci.channelId);
                      return (
                        <div key={i} className="bg-secondary/30 rounded-xl p-4">
                          <div className="flex items-center gap-3 mb-2">
                            {ch?.thumbnail && <img src={ch.thumbnail} alt="" className="w-8 h-8 rounded-full" />}
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{ch?.name || `Canal ${i + 1}`}</p>
                              <p className="text-[10px] text-muted-foreground">{ch ? `${formatNumber(ch.subscribers)} subs` : ''}</p>
                            </div>
                            {ch && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => trackChannel(ch)}>
                                  <Star className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  onClick={() => window.open(`https://youtube.com/channel/${ch.id}`, '_blank')}>
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-3 gap-2 text-xs">
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                              <p className="text-[9px] text-emerald-400 font-medium mb-0.5">💪 Força</p>
                              <p className="text-muted-foreground">{ci.strength}</p>
                            </div>
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2">
                              <p className="text-[9px] text-destructive font-medium mb-0.5">⚠️ Fraqueza</p>
                              <p className="text-muted-foreground">{ci.weakness}</p>
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                              <p className="text-[9px] text-primary font-medium mb-0.5">🎯 Como competir</p>
                              <p className="text-muted-foreground">{ci.strategyToCompete}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Channel list */}
              {filteredChannels.length > 0 ? filteredChannels.map((ch: any, i: number) => (
                <motion.div key={ch.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                  <span className="text-lg font-bold text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                  {ch.thumbnail && <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`https://youtube.com/channel/${ch.id}`} target="_blank" rel="noopener noreferrer"
                        className="font-semibold text-sm hover:text-primary transition-colors truncate">{ch.name}</a>
                      {ch.faceless && <Badge className="bg-primary/20 text-primary text-[10px]">👻 FACELESS</Badge>}
                      {ch.isMonetized && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">💰 MONET.</Badge>}
                      {ch.contentStyle && <Badge className="bg-secondary text-muted-foreground text-[9px]">{ch.contentStyle}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatNumber(ch.subscribers)} subs</span>
                      <span>{formatNumber(ch.totalViews)} views</span>
                      <span>{ch.videoCount} vídeos</span>
                      {ch.outlierCount > 0 && <span className="text-accent">⭐ {ch.outlierCount} outliers</span>}
                      {ch.uploadFrequency && <span>📅 {ch.uploadFrequency}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-accent" />
                        <span className="text-lg font-bold" style={{
                          color: ch.viralScore >= 70 ? 'hsl(var(--accent))' : ch.viralScore >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                        }}>{ch.viralScore}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Viral Score</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => trackChannel(ch)}>
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )) : (
                <p className="text-center text-muted-foreground py-8">Nenhum canal encontrado.</p>
              )}
            </TabsContent>

            {/* === TAB: TRENDING === */}
            <TabsContent value="trending" className="space-y-3">
              {trending.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {trending.slice(0, 18).map((v: any) => (
                    <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                      className="glass rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
                      <div className="relative">
                        <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform" />
                        {v.isSuperOutlier && (
                          <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] gap-1">
                            <Star className="w-3 h-3" /> SUPER OUTLIER
                          </Badge>
                        )}
                        {v.isOutlier && !v.isSuperOutlier && (
                          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] gap-1">
                            <Star className="w-3 h-3" /> OUTLIER
                          </Badge>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-medium line-clamp-2 mb-2">{v.title}</h4>
                        <p className="text-[10px] text-muted-foreground mb-1">{v.channelTitle}</p>
                        <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                          <span>{formatNumber(v.views)} views</span>
                          <span>{formatNumber(v.vph)} v/h</span>
                          <span>{v.engagementRate}% eng</span>
                          {v.viewsPerSub > 1 && <span className="text-accent">{v.viewsPerSub}x subs</span>}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem vídeos trending.</p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-20 h-20 mx-auto mb-4 opacity-15" />
            <p className="text-xl font-bold mb-2">Escolha um nicho para análise profunda</p>
            <p className="text-sm">Dados reais do YouTube API — projeções realistas de monetização por país</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NicheExplorer;
