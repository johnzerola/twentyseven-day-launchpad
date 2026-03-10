import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Compass, Search, Star, TrendingUp, Eye, Users, DollarSign, Zap, Filter, BarChart3, Target, Layers, Shield, Crown, Globe, ArrowUpRight, Flame, CheckCircle, XCircle, AlertTriangle, Lightbulb, Brain, Copy, Clock, Rocket, BookOpen, Lock, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/formatters';
import { COUNTRIES } from '@/lib/constants';

const QUICK_NICHES = [
  'finanças pessoais', 'true crime', 'horror stories', 'motivacional', 'curiosidades',
  'crypto', 'saúde', 'tecnologia', 'gaming', 'receitas', 'educação', 'viagem',
  'beleza', 'fitness', 'negócios', 'humor', 'estoicismo', 'história', 'ciência', 'IA',
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142,76%,36%)', 'hsl(210,100%,56%)', 'hsl(45,93%,47%)'];

const NicheExplorer = () => {
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterFaceless, setFilterFaceless] = useState(false);

  const explore = async (nicheOverride?: string) => {
    const q = (nicheOverride || niche).trim();
    if (!q) return;
    setNiche(q);
    setLoading(true);
    setData(null);
    setActiveTab('overview');

    const phases = ['Buscando vídeos trending...', 'Analisando canais...', 'IA processando inteligência...', 'Calculando RPM e projeções...'];
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
      toast.success('Análise completa!');
    } catch (err: any) {
      toast.error(err.message || 'Erro na análise');
    } finally {
      clearInterval(interval);
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const a = data?.analysis;
  const channels = data?.channels || [];
  const trending = data?.trending || [];
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
            <p className="text-sm text-muted-foreground">Engenharia Reversa com dados reais do YouTube + IA com visão de CEO</p>
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
          </div>

          {/* Quick niches */}
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
              <p className="text-sm text-muted-foreground">Analisando com visão de CEO — dados reais do YouTube API</p>
              <Progress value={undefined} className="h-1 w-48 mx-auto" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {data && a && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/20"><Target className="w-4 h-4" /> Inteligência</TabsTrigger>
              <TabsTrigger value="hooks" className="gap-2 data-[state=active]:bg-primary/20"><Zap className="w-4 h-4" /> Hooks & Títulos</TabsTrigger>
              <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-primary/20"><DollarSign className="w-4 h-4" /> Projeção $</TabsTrigger>
              <TabsTrigger value="channels" className="gap-2 data-[state=active]:bg-primary/20"><Users className="w-4 h-4" /> Canais ({filteredChannels.length})</TabsTrigger>
              <TabsTrigger value="trending" className="gap-2 data-[state=active]:bg-primary/20"><Flame className="w-4 h-4" /> Trending</TabsTrigger>
              <TabsTrigger value="action" className="gap-2 data-[state=active]:bg-primary/20"><Rocket className="w-4 h-4" /> Plano 27 Dias</TabsTrigger>
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
                    <div><p className="text-2xl font-bold text-accent">${a.estimatedRpm}</p><p className="text-[10px] text-muted-foreground">RPM estimado</p></div>
                    <div><p className="text-2xl font-bold text-primary">{a.facelessViability}%</p><p className="text-[10px] text-muted-foreground">Faceless Viável</p></div>
                    <div><p className="text-2xl font-bold">{data.meta.totalChannels}</p><p className="text-[10px] text-muted-foreground">Canais analisados</p></div>
                  </div>
                </div>
              </motion.div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
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
                      <Target className="w-4 h-4 text-primary" /> Radar de Oportunidade (dados reais)
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
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Retention Blueprint */}
              {a.retentionBlueprint && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent" /> Blueprint de Retenção (Engenharia Reversa)
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

            {/* === TAB: HOOKS & TITLES === */}
            <TabsContent value="hooks" className="space-y-4">
              {/* Hook Patterns */}
              {a.hookPatterns?.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" /> Padrões de Hook Detectados (Engenharia Reversa)
                  </h3>
                  <div className="space-y-3">
                    {a.hookPatterns.map((h: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-secondary/30 rounded-xl p-4 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                          h.effectiveness >= 80 ? 'bg-emerald-500/20 text-emerald-400' : h.effectiveness >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-secondary text-muted-foreground'
                        }`}>{h.effectiveness}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{h.pattern}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">Ex: "{h.example}"</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => copyText(h.example)} className="shrink-0">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Title Formulas */}
              {a.titleFormulas?.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary" /> Fórmulas de Título Reverso-Engenhariadas
                  </h3>
                  <div className="space-y-3">
                    {a.titleFormulas.map((tf: any, i: number) => (
                      <div key={i} className="bg-secondary/30 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="bg-primary/20 text-primary text-xs">{tf.formula}</Badge>
                          <span className="text-xs font-bold text-accent">~{tf.estimatedCtr}% CTR</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground flex-1">"{tf.example}"</p>
                          <Button size="sm" variant="ghost" onClick={() => copyText(tf.example)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === TAB: REVENUE === */}
            <TabsContent value="revenue" className="space-y-4">
              {a.revenueProjection?.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-lg font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-accent" /> Projeção de Receita — {niche} ({country})
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={a.revenueProjection.map((r: any) => ({ ...r, month: `Mês ${r.month}` }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                          formatter={(v: number, name: string) => [`${name === 'revenue' ? '$' : ''}${formatNumber(v)}`, name === 'revenue' ? 'Receita' : name === 'views' ? 'Views' : 'Subs']} />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
                    {a.revenueProjection.map((r: any) => (
                      <div key={r.month} className="bg-secondary/30 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-muted-foreground">Mês {r.month}</p>
                        <p className="text-lg font-bold text-accent">${formatNumber(r.revenue)}</p>
                        <p className="text-[9px] text-muted-foreground">{formatNumber(r.views)} views · {formatNumber(r.subs)} subs</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* === TAB: CHANNELS === */}
            <TabsContent value="channels" className="space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={filterFaceless} onChange={e => setFilterFaceless(e.target.checked)} className="rounded" />
                  Apenas Faceless
                </label>
                <span className="text-xs text-muted-foreground">{filteredChannels.length} canais</span>
              </div>

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
                      <span>{fmt(ch.subscribers)} subs</span>
                      <span>{fmt(ch.totalViews)} views</span>
                      <span>{ch.videoCount} vídeos</span>
                      {ch.outlierCount > 0 && <span className="text-accent">⭐ {ch.outlierCount} outliers</span>}
                      {ch.superOutlierCount > 0 && <span className="text-yellow-400">🔥 {ch.superOutlierCount} super</span>}
                      {ch.uploadFrequency && <span>📅 {ch.uploadFrequency}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-accent" />
                      <span className="text-lg font-bold" style={{
                        color: ch.viralScore >= 70 ? 'hsl(var(--accent))' : ch.viralScore >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                      }}>{ch.viralScore}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Viral Score</p>
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
                          <span>{fmt(v.views)} views</span>
                          <span>{fmt(v.vph)} v/h</span>
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

            {/* === TAB: ACTION PLAN === */}
            <TabsContent value="action" className="space-y-4">
              {a.actionPlan?.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-lg font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-6">
                    <Rocket className="w-5 h-5 text-primary" /> Plano de Ação — 27 Dias para Monetização
                  </h3>
                  <div className="space-y-4">
                    {a.actionPlan.map((step: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                        className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                          {i + 1}
                        </div>
                        <div className="flex-1 bg-secondary/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-1">
                            <Badge className="bg-primary/20 text-primary text-xs">{step.week}</Badge>
                          </div>
                          <p className="text-sm font-semibold mt-1">{step.action}</p>
                          <p className="text-xs text-muted-foreground mt-1">🎯 Meta: {step.goal}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-20 h-20 mx-auto mb-4 opacity-15" />
            <p className="text-xl font-bold mb-2">Escolha um nicho para análise profunda</p>
            <p className="text-sm">A IA analisa dados reais do YouTube API com visão de CEO — RPM, hooks, retenção, projeção de receita</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NicheExplorer;
