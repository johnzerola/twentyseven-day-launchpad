import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { 
  TrendingUp, Sparkles, Palette, Lightbulb, CheckSquare, LayoutGrid,
  DollarSign, Globe, Upload, Clock, Play, Copy, Check, Loader2, ChevronRight, Zap, Users,
  AlertTriangle, Target, BarChart3, Brain
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';
import { COUNTRIES, NICHES } from '@/lib/constants';
import { formatNumber } from '@/lib/formatters';

// Hook to load user's linked channel data
const useUserChannel = () => {
  const [channelData, setChannelData] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }).limit(1).maybeSingle();
      if (data) setChannelData(data);
    })();
  }, []);
  return channelData;
};

const callBranding = async (body: any) => {
  const session = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${session.data.session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) throw new Error('Rate limit. Aguarde e tente novamente.');
  if (resp.status === 402) throw new Error('Créditos insuficientes.');
  if (!resp.ok) throw new Error('Erro ao processar');
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
};

// ─── Revenue Simulator (AI + Real Data) ──────────────────────────────
const RevenueSimulator = () => {
  const channelData = useUserChannel();
  const [niche, setNiche] = useState('finanças');
  const [country, setCountry] = useState('BR');
  const [uploadsPerWeek, setUploadsPerWeek] = useState(3);
  const [avgViews, setAvgViews] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  useEffect(() => {
    if (channelData && !autoFilled) {
      const detectedNiche = (channelData.niche || '').toLowerCase();
      const nicheKeys = NICHES.map(n => n.value).filter(Boolean);
      const matched = nicheKeys.find(k => detectedNiche.includes(k));
      if (matched) setNiche(matched);
      if (channelData.views && channelData.videos && channelData.videos > 0) {
        setAvgViews(Math.round(channelData.views / channelData.videos));
      }
      setAutoFilled(true);
      toast.info('📊 Dados do seu canal aplicados ao simulador');
    }
  }, [channelData, autoFilled]);

  const simulate = async () => {
    setLoading(true);
    try {
      const data = await callBranding({
        module: 'revenue-simulator',
        niche, country, uploadsPerWeek, avgViews,
        channelData: channelData ? {
          channel_name: channelData.channel_name,
          subscribers: channelData.subscribers,
          views: channelData.views,
          videos: channelData.videos,
          niche: channelData.niche,
        } : undefined,
      });
      setResult(data);
      toast.success('Projeção gerada com dados reais!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result?.months?.map((m: any) => ({
    month: `M${m.month}`,
    adsense: m.adsenseRevenue || 0,
    affiliates: m.affiliateRevenue || 0,
    infoproduct: m.infoproductRevenue || 0,
    total: m.totalRevenue || 0,
    views: m.views || 0,
    subs: m.projectedSubs || 0,
  })) || [];

  const totalYear = chartData.reduce((s: number, m: any) => s + m.total, 0);
  const month12 = chartData[chartData.length - 1] || { total: 0, views: 0, subs: 0 };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <LayoutGrid className="w-3.5 h-3.5" /> Nicho
          </label>
          <select value={niche} onChange={e => setNiche(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
            {NICHES.filter(n => n.value).map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Globe className="w-3.5 h-3.5" /> País da Audiência
          </label>
          <select value={country} onChange={e => setCountry(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
            {COUNTRIES.filter(c => c.value).map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Upload className="w-3.5 h-3.5" /> Uploads/semana: {uploadsPerWeek}
          </label>
          <Slider value={[uploadsPerWeek]} onValueChange={v => setUploadsPerWeek(v[0])} min={1} max={7} step={1} />
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Play className="w-3.5 h-3.5" /> Views médias: {avgViews.toLocaleString()}
          </label>
          <Slider value={[avgViews]} onValueChange={v => setAvgViews(v[0])} min={500} max={500000} step={500} />
        </div>
      </div>

      <Button onClick={simulate} disabled={loading} className="w-full gradient-hero border-0 gap-2 h-12 text-base">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
        {loading ? 'Analisando dados reais...' : 'Gerar Projeção com Dados Reais'}
      </Button>

      {!result && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA vai analisar canais reais do seu nicho e dados virais para gerar uma projeção baseada em fatos.</p>
          <p className="text-xs mt-1 text-muted-foreground/60">Usa dados de {'>'}945 vídeos virais e {'>'}400 canais do banco de dados</p>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Honest Assessment */}
          {result.honestAssessment && (
            <div className="glass rounded-xl p-4 border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">Análise Honesta da IA</p>
                  <p className="text-xs text-muted-foreground">{result.honestAssessment}</p>
                </div>
              </div>
            </div>
          )}

          {/* RPM Source */}
          <div className="flex gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs gap-1">
              <DollarSign className="w-3 h-3" /> RPM Real: ${result.realRpm?.toFixed(2) || '?'}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Fonte: {result.rpmSource || 'estimativa'}
            </Badge>
          </div>

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="space-y-1.5">
              {result.warnings.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-destructive/10 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[11px] text-destructive/90">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'RPM Efetivo', value: `$${result.realRpm?.toFixed(2) || '?'}`, color: 'text-primary' },
              { label: 'Receita Mês 12', value: `$${month12.total.toLocaleString()}`, color: 'text-emerald-400' },
              { label: 'Total Ano 1', value: `$${Math.round(totalYear).toLocaleString()}`, color: 'text-accent' },
              { label: 'Subs Mês 12', value: formatNumber(month12.subs), color: 'text-blue-400' },
            ].map(kpi => (
              <div key={kpi.label} className="glass rounded-xl p-4 text-center">
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                <p className={`text-xl font-bold font-['Space_Grotesk'] ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-4">Projeção de Receita — 12 Meses (Dados Reais)</h4>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradAdsense2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(270,70%,60%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(270,70%,60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAffiliate2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(150,70%,50%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(150,70%,50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradInfo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(25,95%,55%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(25,95%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="adsense" stackId="1" stroke="hsl(270,70%,60%)" fill="url(#gradAdsense2)" name="AdSense" />
                  <Area type="monotone" dataKey="affiliates" stackId="1" stroke="hsl(150,70%,50%)" fill="url(#gradAffiliate2)" name="Afiliados" />
                  <Area type="monotone" dataKey="infoproduct" stackId="1" stroke="hsl(25,95%,55%)" fill="url(#gradInfo2)" name="Infoproduto" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[hsl(270,70%,60%)] inline-block" /> AdSense</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Afiliados</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent inline-block" /> Infoproduto</span>
              </div>
            </div>
          )}

          {/* Revenue Streams Timeline */}
          {result.revenueStreams?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" /> Fontes de Receita Recomendadas
              </h4>
              <div className="space-y-2">
                {result.revenueStreams.map((rs: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3">
                    <Badge variant="outline" className="text-[10px] shrink-0">Mês {rs.startMonth}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{rs.source}</p>
                      {rs.tip && <p className="text-[10px] text-muted-foreground">{rs.tip}</p>}
                    </div>
                    <span className="text-xs font-bold text-accent shrink-0">{rs.monthlyEstimate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Benchmark */}
          {result.competitorBenchmark?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Benchmark de Canais Reais
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {result.competitorBenchmark.map((c: any, i: number) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 text-center">
                    <p className="text-xs font-semibold truncate">{c.name}</p>
                    <p className="text-sm font-bold text-primary mt-1">{formatNumber(c.subs)} subs</p>
                    <p className="text-[10px] text-muted-foreground">{formatNumber(c.avgViews)} avg views</p>
                    {c.rpm > 0 && <p className="text-[10px] text-accent">${c.rpm} RPM</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Viral Opportunities */}
          {result.viralOpportunities?.length > 0 && (
            <div className="glass rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Oportunidades Virais Detectadas
              </h4>
              <div className="space-y-2">
                {result.viralOpportunities.map((v: any, i: number) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs font-semibold">{v.title}</p>
                    <p className="text-[10px] text-muted-foreground">Padrão: {v.pattern}</p>
                    {v.estimatedViews && <Badge variant="secondary" className="text-[9px] mt-1">{v.estimatedViews}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// ─── Brand Kit Generator (IA + Real Data) ────────────────────────────
const BrandKitGenerator = () => {
  const channelData = useUserChannel();
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (channelData?.niche && !niche) setNiche(channelData.niche);
  }, [channelData]);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const data = await callBranding({ module: 'brand-kit', niche });
      setResult(data);
      setSelectedIdx(0);
      toast.success('Brand Kit gerado com referências reais!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copy(text, id)} className="shrink-0">
      {copiedId === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold mb-2 block text-muted-foreground">Nicho do Canal</label>
          <Input placeholder="Ex: finanças, true crime, tech reviews..." value={niche} onChange={e => setNiche(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()} className="bg-secondary/50 h-11" />
        </div>
        <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Gerando...' : 'Gerar Brand Kit'}
        </Button>
      </div>

      {!result && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Palette className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA analisa canais reais do nicho e cria nomes, paletas e prompts sob medida.</p>
        </div>
      )}

      {result?.names && (
        <AnimatePresence mode="wait">
          <motion.div key="brand-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex gap-2">
              {result.names.map((n: any, i: number) => (
                <button key={i} onClick={() => setSelectedIdx(i)}
                  className={`flex-1 glass rounded-xl p-4 text-center transition-all ${selectedIdx === i ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' : 'hover:border-border'}`}>
                  <h3 className="font-bold font-['Space_Grotesk']">{n.name}</h3>
                  <p className="text-[11px] text-muted-foreground italic">"{n.tagline}"</p>
                </button>
              ))}
            </div>

            {result.names[selectedIdx] && (
              <div className="glass rounded-xl p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold font-['Space_Grotesk']">{result.names[selectedIdx].name}</h3>
                  <p className="text-sm text-muted-foreground">{result.names[selectedIdx].reason}</p>
                </div>

                {result.palettes?.[selectedIdx] && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Paleta de Cores</h4>
                    <div className="flex gap-3">
                      {result.palettes[selectedIdx].map((c: any, j: number) => (
                        <div key={j} className="flex-1 cursor-pointer group" onClick={() => copy(c.hex, `pal-${j}`)}>
                          <div className="h-14 rounded-lg border border-border group-hover:scale-105 transition-transform" style={{ backgroundColor: c.hex }} />
                          <p className="text-[10px] text-center mt-1 font-mono text-muted-foreground">{c.hex}</p>
                          <p className="text-[9px] text-center text-muted-foreground">{c.usage}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { label: 'Logo', text: result.names[selectedIdx].logoPrompt, id: `logo-${selectedIdx}` },
                    { label: 'Banner', text: result.names[selectedIdx].bannerPrompt, id: `banner-${selectedIdx}` },
                    { label: 'Thumbnail', text: result.names[selectedIdx].thumbnailPrompt, id: `thumb-${selectedIdx}` },
                  ].map(p => (
                    <div key={p.id} className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">{p.label}</span>
                        <CopyBtn text={p.text} id={p.id} />
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

// ─── Thumbnail Lab (IA + Viral Data) ─────────────────────────────────
const ThumbnailLab = () => {
  const channelData = useUserChannel();
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (channelData?.niche && !niche) setNiche(channelData.niche);
  }, [channelData]);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const data = await callBranding({ module: 'thumbnail-lab', niche });
      setConcepts(data.concepts || []);
      toast.success('Conceitos gerados com base em vídeos virais reais!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold mb-2 block text-muted-foreground">Nicho / Tema do Vídeo</label>
          <Input placeholder="Ex: investimentos, horror, receitas rápidas..." value={niche} onChange={e => setNiche(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()} className="bg-secondary/50 h-11" />
        </div>
        <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {loading ? 'Analisando virais...' : 'Gerar Conceitos'}
        </Button>
      </div>

      {concepts.length === 0 && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA analisa vídeos virais REAIS do nicho e gera conceitos baseados em padrões comprovados.</p>
        </div>
      )}

      {concepts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {concepts.map((c: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold font-['Space_Grotesk'] text-sm">{c.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                </div>
                <Badge className={`shrink-0 ${c.ctrScore >= 8 ? 'bg-emerald-500/20 text-emerald-400' : c.ctrScore >= 6 ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                  CTR {c.ctrScore}/10
                </Badge>
              </div>

              {c.inspiredBy && (
                <p className="text-[10px] text-blue-400/80">🔗 Inspirado em: {c.inspiredBy}</p>
              )}

              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">Prompt Midjourney/DALL-E</span>
                  <button onClick={() => copy(c.prompt, `thumb-${i}`)} className="shrink-0">
                    {copiedId === `thumb-${i}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{c.prompt}</p>
              </div>

              {c.psychologyTip && (
                <p className="text-[10px] text-primary/80 italic">💡 {c.psychologyTip}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Growth Checklist ────────────────────────────────────────────────
const GrowthChecklist = () => {
  const channelData = useUserChannel();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('0');
  const [checklist, setChecklist] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    if (channelData?.subscribers) {
      if (channelData.subscribers >= 100000) setStage('100000');
      else if (channelData.subscribers >= 10000) setStage('10000');
      else if (channelData.subscribers >= 1000) setStage('1000');
      else setStage('0');
    }
  }, [channelData]);

  const generateChecklist = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;

      const { data: progress } = await supabase
        .from('user_progress')
        .select('completed_items')
        .eq('module', 'growth-checklist')
        .eq('user_id', userId || '')
        .maybeSingle();
      if (progress?.completed_items) setCompletedIds(progress.completed_items as string[]);

      const data = await callBranding({
        module: 'growth-checklist',
        stage,
        channelData: channelData ? {
          channel_name: channelData.channel_name,
          subscribers: channelData.subscribers,
          views: channelData.views,
          videos: channelData.videos,
          niche: channelData.niche,
        } : undefined,
      });
      setChecklist(data.items || []);
      toast.success('Checklist personalizado gerado!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (itemId: string) => {
    const newCompleted = completedIds.includes(itemId)
      ? completedIds.filter(id => id !== itemId)
      : [...completedIds, itemId];
    setCompletedIds(newCompleted);

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) return;

    await supabase.from('user_progress').upsert({
      user_id: userId,
      module: 'growth-checklist',
      completed_items: newCompleted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,module' });
  };

  const completionPct = checklist.length > 0 ? Math.round((completedIds.length / checklist.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs font-semibold mb-2 block text-muted-foreground">Estágio do Canal</label>
          <select value={stage} onChange={e => setStage(e.target.value)}
            className="bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm">
            <option value="0">🌱 Começando (0 subs)</option>
            <option value="1000">📈 Crescendo (1K subs)</option>
            <option value="10000">🚀 Decolando (10K subs)</option>
            <option value="100000">👑 Authority (100K+ subs)</option>
          </select>
        </div>
        <Button onClick={generateChecklist} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
          {loading ? 'Gerando...' : 'Gerar Checklist'}
        </Button>
        {channelData && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Users className="w-3 h-3" /> {channelData.channel_name} detectado
          </Badge>
        )}

        {checklist.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${completionPct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{completionPct}%</span>
          </div>
        )}
      </div>

      {checklist.length === 0 && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA cria um plano de ação personalizado baseado no seu canal real.</p>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="space-y-2">
          {checklist.map((item: any, i: number) => {
            const done = completedIds.includes(item.id);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => toggleItem(item.id)}
                className={`glass rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all hover:border-primary/30 ${done ? 'opacity-60' : ''}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${done ? 'bg-primary border-primary' : 'border-border'}`}>
                  {done && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold ${done ? 'line-through' : ''}`}>{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  {item.module && <Badge variant="secondary" className="text-[9px] mt-1.5">{item.module}</Badge>}
                </div>
                <Badge className={`shrink-0 text-[10px] ${item.priority === 'alta' ? 'bg-destructive/20 text-destructive' : item.priority === 'média' ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                  {item.priority}
                </Badge>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Content Matrix ──────────────────────────────────────────────────
const ContentMatrix = () => {
  const channelData = useUserChannel();
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<any>(null);

  useEffect(() => {
    if (channelData?.niche && !niche) setNiche(channelData.niche);
  }, [channelData]);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const data = await callBranding({ module: 'content-matrix', niche });
      setMatrix(data);
      toast.success('Matriz gerada com base em padrões virais reais!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(270,70%,60%)', 'hsl(25,95%,55%)', 'hsl(150,70%,50%)', 'hsl(200,80%,55%)'];

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold mb-2 block text-muted-foreground">Nicho do Canal</label>
          <Input placeholder="Ex: finanças, true crime, gaming..." value={niche} onChange={e => setNiche(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()} className="bg-secondary/50 h-11" />
        </div>
        <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-11 px-6">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
          {loading ? 'Analisando virais...' : 'Gerar Matriz'}
        </Button>
      </div>

      {!matrix && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA analisa títulos virais e canais reais do nicho para recomendar o mix ideal de conteúdo.</p>
        </div>
      )}

      {matrix && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Data insight */}
          {matrix.dataInsight && (
            <div className="glass rounded-xl p-4 border-primary/20 bg-primary/5">
              <p className="text-xs text-primary/90 flex items-start gap-2">
                <Brain className="w-4 h-4 shrink-0 mt-0.5" />
                {matrix.dataInsight}
              </p>
            </div>
          )}

          <div className="glass rounded-xl p-5">
            <h4 className="text-sm font-semibold mb-4">Distribuição de Formato</h4>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={matrix.formats || []} dataKey="percentage" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {(matrix.formats || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 flex flex-col justify-center">
                {(matrix.formats || []).map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm flex-1">{f.type}</span>
                    <span className="text-sm font-bold font-['Space_Grotesk']">{f.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {matrix.weeklySuggestions && (
            <div className="glass rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-4">Sugestões Semanais (Baseadas em Virais Reais)</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {matrix.weeklySuggestions.map((s: any, i: number) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] shrink-0">{s.day}</Badge>
                    <div>
                      <p className="text-xs font-medium">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{s.format} • {s.duration}</p>
                      {s.inspiredBy && <p className="text-[9px] text-blue-400/70 mt-0.5">🔗 {s.inspiredBy}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matrix.strategyTip && (
            <div className="glass rounded-xl p-4 border-primary/20 bg-primary/5">
              <p className="text-xs text-primary/90">💡 {matrix.strategyTip}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────
const Branding = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              Growth Command Center <Badge className="bg-accent/20 text-accent text-[10px]">DADOS REAIS</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Projeções baseadas em 945+ vídeos virais e 400+ canais analisados</p>
          </div>
        </div>

        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-primary/20">
              <DollarSign className="w-4 h-4" /> Simulador de Receita
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-2 data-[state=active]:bg-primary/20">
              <Palette className="w-4 h-4" /> Brand Kit
            </TabsTrigger>
            <TabsTrigger value="thumbnails" className="gap-2 data-[state=active]:bg-primary/20">
              <Lightbulb className="w-4 h-4" /> Thumbnail Lab
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2 data-[state=active]:bg-primary/20">
              <CheckSquare className="w-4 h-4" /> Growth Checklist
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2 data-[state=active]:bg-primary/20">
              <LayoutGrid className="w-4 h-4" /> Content Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="revenue"><RevenueSimulator /></TabsContent>
          <TabsContent value="brand"><BrandKitGenerator /></TabsContent>
          <TabsContent value="thumbnails"><ThumbnailLab /></TabsContent>
          <TabsContent value="checklist"><GrowthChecklist /></TabsContent>
          <TabsContent value="matrix"><ContentMatrix /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Branding;
