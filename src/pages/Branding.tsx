import { useState, useMemo, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { 
  TrendingUp, Sparkles, Palette, Lightbulb, CheckSquare, LayoutGrid,
  DollarSign, Globe, Upload, Clock, Play, Copy, Check, Loader2, ChevronRight, Zap, Users
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
import { 
  RPM_BY_NICHE, RPM_COUNTRY_MULTIPLIER, GROWTH_CURVE, COUNTRIES, NICHES 
} from '@/lib/constants';

// Hook to load user's linked channel data for auto-fill
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
// ─── Revenue Simulator (auto-fills from user channel) ────────────────
const RevenueSimulator = () => {
  const channelData = useUserChannel();
  const [niche, setNiche] = useState('finanças');
  const [country, setCountry] = useState('BR');
  const [uploadsPerWeek, setUploadsPerWeek] = useState(3);
  const [avgDuration, setAvgDuration] = useState(10);
  const [avgViews, setAvgViews] = useState(5000);
  const [autoFilled, setAutoFilled] = useState(false);

  // Auto-fill when channel data loads
  useEffect(() => {
    if (channelData && !autoFilled) {
      const detectedNiche = (channelData.niche || '').toLowerCase();
      const matched = Object.keys(RPM_BY_NICHE).find(k => detectedNiche.includes(k));
      if (matched) setNiche(matched);
      if (channelData.views && channelData.videos && channelData.videos > 0) {
        setAvgViews(Math.round(channelData.views / channelData.videos));
      }
      setAutoFilled(true);
      toast.info('📊 Dados do seu canal aplicados ao simulador');
    }
  }, [channelData, autoFilled]);

  const projection = useMemo(() => {
    const nicheRpm = RPM_BY_NICHE[niche] || { min: 3, max: 10, avg: 5 };
    const countryMult = RPM_COUNTRY_MULTIPLIER[country] || 0.3;
    const effectiveRpm = nicheRpm.avg * countryMult;
    const monthlyVideos = uploadsPerWeek * 4.3;

    return GROWTH_CURVE.map((mult, i) => {
      const monthViews = avgViews * monthlyVideos * mult;
      const adsense = (monthViews / 1000) * effectiveRpm;
      const affiliates = adsense * 0.4 * (i > 2 ? 1 : 0);
      const infoproduct = i > 1 ? (monthViews * 0.001 * 27) : 0;
      return {
        month: `M${i + 1}`,
        adsense: Math.round(adsense),
        affiliates: Math.round(affiliates),
        infoproduct: Math.round(infoproduct),
        total: Math.round(adsense + affiliates + infoproduct),
        views: Math.round(monthViews),
      };
    });
  }, [niche, country, uploadsPerWeek, avgDuration, avgViews]);

  const nicheRpm = RPM_BY_NICHE[niche] || { min: 3, max: 10, avg: 5 };
  const countryMult = RPM_COUNTRY_MULTIPLIER[country] || 0.3;
  const totalYear = projection.reduce((s, m) => s + m.total, 0);
  const month12 = projection[11];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <LayoutGrid className="w-3.5 h-3.5" /> Nicho
          </label>
          <select value={niche} onChange={e => setNiche(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm">
            {Object.keys(RPM_BY_NICHE).map(n => (
              <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
            ))}
          </select>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>RPM: ${nicheRpm.min}-${nicheRpm.max}</span>
            <Badge variant="secondary" className="text-[10px]">Avg ${nicheRpm.avg}</Badge>
          </div>
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
          <div className="text-xs text-muted-foreground">
            Multiplicador: {(countryMult * 100).toFixed(0)}% do RPM base
          </div>
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Upload className="w-3.5 h-3.5" /> Uploads/semana: {uploadsPerWeek}
          </label>
          <Slider value={[uploadsPerWeek]} onValueChange={v => setUploadsPerWeek(v[0])} min={1} max={7} step={1} />
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> Duração média: {avgDuration} min
          </label>
          <Slider value={[avgDuration]} onValueChange={v => setAvgDuration(v[0])} min={3} max={60} step={1} />
        </div>

        <div className="glass rounded-xl p-4 space-y-3 md:col-span-2 lg:col-span-3">
          <label className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Play className="w-3.5 h-3.5" /> Views médias por vídeo: {avgViews.toLocaleString()}
          </label>
          <Slider value={[avgViews]} onValueChange={v => setAvgViews(v[0])} min={500} max={500000} step={500} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'RPM Efetivo', value: `$${(nicheRpm.avg * countryMult).toFixed(2)}`, color: 'text-primary' },
          { label: 'Receita Mês 12', value: `$${month12.total.toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Total Ano 1', value: `$${totalYear.toLocaleString()}`, color: 'text-accent' },
          { label: 'Views Mês 12', value: month12.views.toLocaleString(), color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="glass rounded-xl p-4 text-center">
            <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold font-['Space_Grotesk'] ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass rounded-xl p-4">
        <h4 className="text-sm font-semibold mb-4">Projeção de Receita — 12 Meses</h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={projection}>
            <defs>
              <linearGradient id="gradAdsense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(270,70%,60%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(270,70%,60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradAffiliate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(150,70%,50%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(150,70%,50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradInfo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(25,95%,55%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(25,95%,55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,10%,16%)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(240,5%,55%)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(240,5%,55%)' }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: 'hsl(240,10%,6%)', border: '1px solid hsl(240,10%,16%)', borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="adsense" stackId="1" stroke="hsl(270,70%,60%)" fill="url(#gradAdsense)" name="AdSense" />
            <Area type="monotone" dataKey="affiliates" stackId="1" stroke="hsl(150,70%,50%)" fill="url(#gradAffiliate)" name="Afiliados" />
            <Area type="monotone" dataKey="infoproduct" stackId="1" stroke="hsl(25,95%,55%)" fill="url(#gradInfo)" name="Infoproduto" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> AdSense</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Afiliados</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent inline-block" /> Infoproduto</span>
        </div>
      </div>
    </div>
  );
};

// ─── Brand Kit Generator (IA) ────────────────────────────────────────
const BrandKitGenerator = () => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ module: 'brand-kit', niche }),
      });
      if (resp.status === 429) throw new Error('Rate limit. Aguarde e tente novamente.');
      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      if (!resp.ok) throw new Error('Erro ao gerar brand kit');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setSelectedIdx(0);
      toast.success('Brand Kit gerado!');
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
          <p className="text-sm">Informe seu nicho e a IA vai criar nomes, paletas e prompts visuais sob medida.</p>
        </div>
      )}

      {result?.names && (
        <AnimatePresence mode="wait">
          <motion.div key="brand-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Name selector */}
            <div className="flex gap-2">
              {result.names.map((n: any, i: number) => (
                <button key={i} onClick={() => setSelectedIdx(i)}
                  className={`flex-1 glass rounded-xl p-4 text-center transition-all ${selectedIdx === i ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' : 'hover:border-border'}`}>
                  <h3 className="font-bold font-['Space_Grotesk']">{n.name}</h3>
                  <p className="text-[11px] text-muted-foreground italic">"{n.tagline}"</p>
                </button>
              ))}
            </div>

            {/* Selected detail */}
            {result.names[selectedIdx] && (
              <div className="glass rounded-xl p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold font-['Space_Grotesk']">{result.names[selectedIdx].name}</h3>
                  <p className="text-sm text-muted-foreground">{result.names[selectedIdx].reason}</p>
                </div>

                {/* Palette */}
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

                {/* Prompts */}
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

// ─── Thumbnail Lab (IA) ──────────────────────────────────────────────
const ThumbnailLab = () => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ module: 'thumbnail-lab', niche }),
      });
      if (!resp.ok) throw new Error('Erro ao gerar thumbnails');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setConcepts(data.concepts || []);
      toast.success('Conceitos gerados!');
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
          {loading ? 'Analisando...' : 'Gerar Conceitos'}
        </Button>
      </div>

      {concepts.length === 0 && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA vai gerar conceitos de thumbnail com score de CTR e prompts prontos.</p>
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

// ─── Growth Checklist (persisted) ────────────────────────────────────
const GrowthChecklist = () => {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('0');
  const [checklist, setChecklist] = useState<any[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const generateChecklist = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      
      // Load existing progress
      const { data: progress } = await supabase
        .from('user_progress')
        .select('completed_items')
        .eq('module', 'growth-checklist')
        .eq('user_id', session.data.session?.user?.id || '')
        .maybeSingle();
      
      if (progress?.completed_items) {
        setCompletedIds(progress.completed_items as string[]);
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ module: 'growth-checklist', stage }),
      });
      if (!resp.ok) throw new Error('Erro ao gerar checklist');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
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
          <p className="text-sm">Escolha o estágio do seu canal e a IA vai criar um plano de ação personalizado.</p>
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
                  {item.module && (
                    <Badge variant="secondary" className="text-[9px] mt-1.5">{item.module}</Badge>
                  )}
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

// ─── Content Matrix (IA) ─────────────────────────────────────────────
const ContentMatrix = () => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<any>(null);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ module: 'content-matrix', niche }),
      });
      if (!resp.ok) throw new Error('Erro ao gerar matriz');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setMatrix(data);
      toast.success('Matriz de conteúdo gerada!');
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
          {loading ? 'Gerando...' : 'Gerar Matriz'}
        </Button>
      </div>

      {!matrix && !loading && (
        <div className="glass rounded-xl p-12 text-center text-muted-foreground">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">A IA vai analisar o mix ideal de conteúdo para maximizar crescimento e receita.</p>
        </div>
      )}

      {matrix && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Format distribution */}
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
                    <Tooltip contentStyle={{ background: 'hsl(240,10%,6%)', border: '1px solid hsl(240,10%,16%)', borderRadius: 12, fontSize: 12 }} />
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

          {/* Weekly suggestions */}
          {matrix.weeklySuggestions && (
            <div className="glass rounded-xl p-5">
              <h4 className="text-sm font-semibold mb-4">Sugestões Semanais</h4>
              <div className="grid md:grid-cols-2 gap-3">
                {matrix.weeklySuggestions.map((s: any, i: number) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] shrink-0">{s.day}</Badge>
                    <div>
                      <p className="text-xs font-medium">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{s.format} • {s.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy tip */}
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
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              Growth Command Center <Badge className="bg-accent/20 text-accent text-[10px]">PRO</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Simulador de receita, branding, thumbnails e estratégia — tudo em um hub</p>
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
