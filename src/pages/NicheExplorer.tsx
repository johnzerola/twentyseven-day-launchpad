import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Compass, Search, Star, TrendingUp, Eye, Users, DollarSign, Zap, Filter, BarChart3, Target, Layers, Shield, ShieldOff, Crown, Globe, ArrowUpRight, ArrowDownRight, Minus, Flame, CheckCircle, XCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const COUNTRIES = [
  { value: 'BR', label: '🇧🇷 Brasil', rpm: 1.5 }, { value: 'US', label: '🇺🇸 EUA', rpm: 7.5 },
  { value: 'PL', label: '🇵🇱 Polônia', rpm: 2.5 }, { value: 'DE', label: '🇩🇪 Alemanha', rpm: 5.5 },
  { value: 'GB', label: '🇬🇧 Reino Unido', rpm: 6.0 }, { value: 'PT', label: '🇵🇹 Portugal', rpm: 3.0 },
  { value: 'ES', label: '🇪🇸 Espanha', rpm: 3.0 }, { value: 'FR', label: '🇫🇷 França', rpm: 4.0 },
  { value: 'JP', label: '🇯🇵 Japão', rpm: 4.5 }, { value: 'IN', label: '🇮🇳 Índia', rpm: 0.5 },
];

const NICHE_DATABASE: Record<string, {
  rpm: number; saturation: string; difficulty: string; facelessFriendly: boolean;
  growthTrend: string; audienceSize: string; monetizationSpeed: string;
  subNiches: string[]; topCountries: string[]; score: number;
}> = {
  'finanças pessoais': { rpm: 15, saturation: 'Alta', difficulty: 'Médio', facelessFriendly: true, growthTrend: 'Estável', audienceSize: '50M+', monetizationSpeed: 'Rápida', subNiches: ['Dividendos', 'Criptomoedas', 'Frugalismo', 'Day Trade', 'FIIs'], topCountries: ['BR', 'US', 'PT'], score: 87 },
  'true crime': { rpm: 12, saturation: 'Média', difficulty: 'Fácil', facelessFriendly: true, growthTrend: 'Crescendo', audienceSize: '30M+', monetizationSpeed: 'Rápida', subNiches: ['Serial Killers', 'Casos Não Resolvidos', 'Documentários', 'Mistérios'], topCountries: ['US', 'BR', 'GB'], score: 92 },
  'horror stories': { rpm: 10, saturation: 'Média', difficulty: 'Fácil', facelessFriendly: true, growthTrend: 'Crescendo', audienceSize: '25M+', monetizationSpeed: 'Média', subNiches: ['Creepypasta', 'Lendas Urbanas', 'Histórias Reais', 'Paranormal'], topCountries: ['US', 'BR', 'MX'], score: 88 },
  'tecnologia': { rpm: 8, saturation: 'Alta', difficulty: 'Difícil', facelessFriendly: false, growthTrend: 'Estável', audienceSize: '80M+', monetizationSpeed: 'Média', subNiches: ['Reviews', 'Tutoriais', 'IA', 'Gadgets'], topCountries: ['US', 'IN', 'BR'], score: 65 },
  'gaming': { rpm: 4, saturation: 'Muito Alta', difficulty: 'Difícil', facelessFriendly: true, growthTrend: 'Saturando', audienceSize: '200M+', monetizationSpeed: 'Lenta', subNiches: ['Gameplay', 'Reviews', 'Esports', 'Tutoriais'], topCountries: ['US', 'BR', 'JP'], score: 45 },
  'motivacional': { rpm: 8, saturation: 'Média', difficulty: 'Fácil', facelessFriendly: true, growthTrend: 'Crescendo', audienceSize: '40M+', monetizationSpeed: 'Rápida', subNiches: ['Mindset', 'Produtividade', 'Estoicismo', 'Autobiografias'], topCountries: ['BR', 'US', 'IN'], score: 85 },
  'curiosidades': { rpm: 6, saturation: 'Média', difficulty: 'Fácil', facelessFriendly: true, growthTrend: 'Crescendo', audienceSize: '60M+', monetizationSpeed: 'Média', subNiches: ['Ciência', 'História', 'Top 10', 'Fatos'], topCountries: ['BR', 'US', 'ES'], score: 82 },
  'crypto': { rpm: 25, saturation: 'Alta', difficulty: 'Médio', facelessFriendly: true, growthTrend: 'Volátil', audienceSize: '15M+', monetizationSpeed: 'Muito Rápida', subNiches: ['Bitcoin', 'DeFi', 'NFTs', 'Trading'], topCountries: ['US', 'DE', 'BR'], score: 78 },
  'saúde': { rpm: 12, saturation: 'Média', difficulty: 'Médio', facelessFriendly: false, growthTrend: 'Crescendo', audienceSize: '45M+', monetizationSpeed: 'Média', subNiches: ['Nutrição', 'Exercícios', 'Saúde Mental', 'Longevidade'], topCountries: ['US', 'BR', 'GB'], score: 75 },
  'receitas': { rpm: 5, saturation: 'Alta', difficulty: 'Médio', facelessFriendly: true, growthTrend: 'Estável', audienceSize: '70M+', monetizationSpeed: 'Lenta', subNiches: ['Fit', 'Vegano', 'Sobremesas', 'Air Fryer'], topCountries: ['BR', 'US', 'MX'], score: 58 },
};

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const NicheExplorer = () => {
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterFaceless, setFilterFaceless] = useState(false);
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  const explore = async (nicheOverride?: string) => {
    const searchNiche = nicheOverride || niche;
    if (!searchNiche.trim()) return;
    setNiche(searchNiche);
    setSelectedNiche(searchNiche.toLowerCase());
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('niche-explorer', {
        body: { niche: searchNiche, country, language: 'pt' },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      setApiData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erro na exploração');
    } finally {
      setLoading(false);
    }
  };

  const nicheData = selectedNiche ? NICHE_DATABASE[selectedNiche] : null;
  const countryData = COUNTRIES.find(c => c.value === country);
  const channels = apiData?.channels || [];
  const filteredChannels = channels.filter((ch: any) => {
    if (filterFaceless && !ch.faceless) return false;
    if (minSubs && ch.subscribers < parseInt(minSubs)) return false;
    if (maxSubs && ch.subscribers > parseInt(maxSubs)) return false;
    return true;
  });

  const facelessCount = channels.filter((ch: any) => ch.faceless).length;
  const facelessPercent = channels.length > 0 ? Math.round((facelessCount / channels.length) * 100) : 0;
  const totalOutliers = channels.reduce((s: number, c: any) => s + (c.outlierCount || 0), 0);

  // Radar chart data
  const radarData = nicheData ? [
    { metric: 'RPM', value: Math.min(100, (nicheData.rpm / 25) * 100) },
    { metric: 'Faceless', value: nicheData.facelessFriendly ? 90 : 20 },
    { metric: 'Crescimento', value: nicheData.growthTrend === 'Crescendo' ? 85 : nicheData.growthTrend === 'Estável' ? 50 : 30 },
    { metric: 'Facilidade', value: nicheData.difficulty === 'Fácil' ? 90 : nicheData.difficulty === 'Médio' ? 60 : 30 },
    { metric: 'Velocidade $', value: nicheData.monetizationSpeed === 'Muito Rápida' ? 95 : nicheData.monetizationSpeed === 'Rápida' ? 80 : nicheData.monetizationSpeed === 'Média' ? 55 : 30 },
    { metric: 'Score', value: nicheData.score },
  ] : [];

  // RPM comparison
  const rpmComparison = Object.entries(NICHE_DATABASE)
    .map(([name, d]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), rpm: d.rpm, score: d.score }))
    .sort((a, b) => b.rpm - a.rpm);

  // Revenue projection
  const revenueProjection = [1, 3, 6, 12].map(months => {
    const rpm = nicheData?.rpm || apiData?.estimatedRpm || 5;
    const viewsPerMonth = months <= 3 ? 10000 * months : months <= 6 ? 50000 * (months - 2) : 100000 * (months - 5);
    return { month: `Mês ${months}`, views: viewsPerMonth, revenue: Math.round(viewsPerMonth * rpm / 1000) };
  });

  // Top niches ranking
  const nicheRanking = Object.entries(NICHE_DATABASE)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.score - a.score);

  const pieData = nicheData ? [
    { name: 'AdSense', value: 40 },
    { name: 'Infoproduto', value: 30 },
    { name: 'Afiliados', value: 20 },
    { name: 'Sponsors', value: 10 },
  ] : [];
  const PIE_COLORS = ['hsl(270,70%,60%)', 'hsl(25,95%,55%)', 'hsl(142,76%,36%)', 'hsl(210,100%,56%)'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Compass className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              Niche Intelligence <Badge className="bg-accent/20 text-accent text-[10px]">PRO</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Centro de Inteligência — RPM, Saturação, Projeção de Receita e Oportunidades</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar nicho: finanças, true crime, horror, crypto..." value={niche}
                onChange={(e) => setNiche(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && explore()}
                className="pl-10 bg-secondary/50 h-11" />
            </div>
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="h-11 rounded-lg border border-input bg-secondary/50 px-3 text-sm min-w-[150px]">
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label} (${c.rpm} RPM)</option>)}
            </select>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-11">
              <Filter className="w-4 h-4" />
            </Button>
            <Button onClick={() => explore()} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
              <Compass className="w-4 h-4" /> {loading ? 'Analisando...' : 'Analisar Nicho'}
            </Button>
          </div>

          {showFilters && (
            <div className="flex gap-4 flex-wrap items-center bg-secondary/30 rounded-xl p-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={filterFaceless} onChange={e => setFilterFaceless(e.target.checked)} className="rounded" />
                Apenas Faceless
              </label>
              <Input placeholder="Min subs" value={minSubs} onChange={e => setMinSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
              <Input placeholder="Max subs" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
            </div>
          )}
        </div>

        {/* Niche Quick Grid — Always Visible */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-accent" /> Top Nichos por Monetiza27 Score
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {nicheRanking.map((n, i) => (
              <button key={n.name} onClick={() => explore(n.name)}
                className={`glass rounded-xl p-3 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${
                  selectedNiche === n.name ? 'border-primary/50 bg-primary/5' : ''
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                  <span className={`text-lg font-bold ${
                    n.score >= 85 ? 'text-emerald-400' : n.score >= 70 ? 'text-primary' : n.score >= 50 ? 'text-yellow-400' : 'text-muted-foreground'
                  }`}>{n.score}</span>
                </div>
                <p className="text-sm font-semibold capitalize truncate">{n.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-accent font-bold">${n.rpm}</span>
                  <span className="text-[10px] text-muted-foreground">RPM</span>
                  {n.facelessFriendly && <Badge className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0">👻</Badge>}
                </div>
                <Progress value={n.score} className="h-1 mt-2" />
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {(nicheData || apiData) && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary/20"><BarChart3 className="w-4 h-4" /> Visão Geral</TabsTrigger>
              <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-primary/20"><DollarSign className="w-4 h-4" /> Projeção $</TabsTrigger>
              <TabsTrigger value="channels" className="gap-2 data-[state=active]:bg-primary/20"><Users className="w-4 h-4" /> Canais ({filteredChannels.length})</TabsTrigger>
              <TabsTrigger value="trending" className="gap-2 data-[state=active]:bg-primary/20"><Flame className="w-4 h-4" /> Trending</TabsTrigger>
            </TabsList>

            {/* TAB: Overview */}
            <TabsContent value="overview" className="space-y-4">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { icon: DollarSign, label: 'RPM', value: `$${nicheData?.rpm || apiData?.estimatedRpm || '?'}`, color: 'text-accent' },
                  { icon: Target, label: 'Score', value: nicheData?.score || '—', color: (nicheData?.score || 0) >= 80 ? 'text-emerald-400' : 'text-primary' },
                  { icon: BarChart3, label: 'Saturação', value: nicheData?.saturation || '—', color: nicheData?.saturation === 'Baixa' ? 'text-emerald-400' : nicheData?.saturation === 'Média' ? 'text-yellow-400' : 'text-destructive' },
                  { icon: Zap, label: 'Dificuldade', value: nicheData?.difficulty || '—', color: nicheData?.difficulty === 'Fácil' ? 'text-emerald-400' : nicheData?.difficulty === 'Médio' ? 'text-yellow-400' : 'text-destructive' },
                  { icon: Layers, label: 'Faceless', value: nicheData?.facelessFriendly ? '✅ Sim' : '❌ Não', color: nicheData?.facelessFriendly ? 'text-emerald-400' : 'text-destructive' },
                  { icon: TrendingUp, label: 'Tendência', value: nicheData?.growthTrend || '—', color: nicheData?.growthTrend === 'Crescendo' ? 'text-emerald-400' : 'text-yellow-400' },
                  { icon: Users, label: 'Audiência', value: nicheData?.audienceSize || '—', color: 'text-primary' },
                  { icon: Flame, label: 'Monet. Speed', value: nicheData?.monetizationSpeed || '—', color: 'text-accent' },
                ].map((m, i) => (
                  <div key={i} className="glass rounded-xl p-3 text-center">
                    <m.icon className={`w-4 h-4 mx-auto mb-1 ${m.color}`} />
                    <p className={`text-sm font-bold ${m.color}`}>{String(m.value)}</p>
                    <p className="text-[9px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Radar Chart */}
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

                {/* Revenue Split Pie */}
                {pieData.length > 0 && (
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-accent" /> Fontes de Receita Projetadas
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={4}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span className="text-muted-foreground">{d.name} ({d.value}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-niches */}
              {nicheData?.subNiches && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Sub-nichos com Oportunidade
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {nicheData.subNiches.map((sn, i) => (
                      <button key={i} onClick={() => explore(sn)}
                        className="bg-primary/10 text-primary text-sm px-4 py-2 rounded-xl border border-primary/20 hover:bg-primary/20 transition-colors flex items-center gap-2">
                        {sn} <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Verdict */}
              {nicheData && (
                <div className={`glass rounded-2xl p-5 border ${
                  nicheData.score >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' :
                  nicheData.score >= 60 ? 'border-yellow-500/30 bg-yellow-500/5' :
                  'border-destructive/30 bg-destructive/5'
                }`}>
                  <div className="flex items-start gap-3">
                    {nicheData.score >= 80 ? <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" /> :
                     nicheData.score >= 60 ? <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" /> :
                     <XCircle className="w-6 h-6 text-destructive shrink-0" />}
                    <div>
                      <h3 className="font-bold text-lg capitalize">{selectedNiche} — Veredicto</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {nicheData.score >= 80
                          ? `🟢 ALTAMENTE RECOMENDADO. RPM de $${nicheData.rpm}, ${nicheData.facelessFriendly ? 'compatível com faceless' : 'requer presença'}, com tendência ${nicheData.growthTrend.toLowerCase()}. Monetização ${nicheData.monetizationSpeed.toLowerCase()} — ideal para o Blueprint de 27 dias.`
                          : nicheData.score >= 60
                          ? `🟡 VIÁVEL COM ESTRATÉGIA. RPM de $${nicheData.rpm} é razoável, mas a saturação ${nicheData.saturation.toLowerCase()} exige diferenciação forte. Foque em sub-nichos menos explorados.`
                          : `🔴 ALTO RISCO. Saturação ${nicheData.saturation.toLowerCase()} e RPM de $${nicheData.rpm} tornam difícil monetizar rapidamente. Considere nichos alternativos com score superior a 70.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB: Revenue Projection */}
            <TabsContent value="revenue" className="space-y-4">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                  <DollarSign className="w-6 h-6 text-accent" /> Projeção de Receita — {niche}
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueProjection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                        formatter={(v: number) => [`$${v}`, 'Receita']} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RPM Comparison */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> RPM por Nicho (Comparativo)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rpmComparison} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`$${v}`, 'RPM']} />
                      <Bar dataKey="rpm" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Channels */}
            <TabsContent value="channels" className="space-y-3">
              {filteredChannels.length > 0 ? filteredChannels.map((ch: any, i: number) => (
                <motion.div key={ch.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                  {ch.thumbnail && <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`https://youtube.com/channel/${ch.id}`} target="_blank" rel="noopener noreferrer"
                        className="font-semibold text-sm hover:text-primary transition-colors truncate">{ch.name}</a>
                      {ch.faceless && <Badge className="bg-primary/20 text-primary text-[10px]">FACELESS</Badge>}
                      {ch.isMonetized && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">💰 MONETIZADO</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatNumber(ch.subscribers)} subs</span>
                      <span>{formatNumber(ch.totalViews)} views</span>
                      <span>{ch.videoCount} vídeos</span>
                      {ch.outlierCount > 0 && <span className="text-accent">⭐ {ch.outlierCount} outliers</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-accent" />
                      <span className="text-lg font-bold" style={{
                        color: ch.viralScore >= 70 ? 'hsl(var(--accent))' : ch.viralScore >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                      }}>{ch.viralScore}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Viral Score</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-accent">${ch.estimatedRpm}/RPM</p>
                    <p className="text-xs text-muted-foreground">~${formatNumber(ch.estimatedMonthlyRevenue)}/mês</p>
                  </div>
                </motion.div>
              )) : (
                <p className="text-center text-muted-foreground py-8">Nenhum canal encontrado. Clique em "Analisar Nicho" para buscar.</p>
              )}
            </TabsContent>

            {/* TAB: Trending */}
            <TabsContent value="trending" className="space-y-3">
              {apiData?.trending?.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {apiData.trending.slice(0, 12).map((v: any) => (
                    <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                      className="glass rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
                      <div className="relative">
                        <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform" />
                        {v.isOutlier && (
                          <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] gap-1">
                            <Star className="w-3 h-3" /> OUTLIER
                          </Badge>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-medium line-clamp-2 mb-2">{v.title}</h4>
                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                          <span>{formatNumber(v.views)} views</span>
                          <span>{v.vph} v/h</span>
                          <span>{v.engagementRate}% eng.</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Clique em "Analisar Nicho" para ver vídeos trending.</p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!selectedNiche && !apiData && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Compass className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Escolha um nicho acima ou pesquise para iniciar a análise</p>
            <p className="text-sm mt-1">O sistema analisa RPM, saturação, tendência e oportunidades faceless</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NicheExplorer;
