import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Brain, Search, Loader2, TrendingUp, Target, Eye, Users, Video, Zap, Shield, Clock, DollarSign, Star, ArrowUpRight, Lightbulb, AlertTriangle, CheckCircle2, Flame, BarChart3, Layers, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

// ─── Score Gauge ──────────────────────────
const ScoreRing = ({ value, label, size = 64 }: { value: number; label: string; size?: number }) => {
  const pct = Math.min(value, 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" viewBox="0 0 36 36" style={{ width: size, height: size }}>
          <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <path d="M18 2.5a15.5 15.5 0 1 1 0 31 15.5 15.5 0 0 1 0-31" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[70px]">{label}</span>
    </div>
  );
};

const SATURATION_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-emerald-500/15 text-emerald-400' },
  medium: { label: 'Média', color: 'bg-amber-500/15 text-amber-400' },
  high: { label: 'Alta', color: 'bg-red-500/15 text-red-400' },
  very_high: { label: 'Muito Alta', color: 'bg-red-600/20 text-red-500' },
};

const ChannelIntelligence = () => {
  const [channelInput, setChannelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('scores');

  const analyze = async () => {
    if (!channelInput.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const { data: result, error } = await supabase.functions.invoke('channel-intelligence', {
        body: { channelInput: channelInput.trim() },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
      toast.success('Relatório gerado!');
    } catch (e: any) {
      if (e?.message?.includes('429')) toast.error('Rate limit. Tente novamente em alguns segundos.');
      else if (e?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else toast.error(e?.message || 'Erro ao analisar');
    }
    setLoading(false);
  };

  const report = data?.report;
  const channel = data?.channel;
  const metrics = data?.metrics;

  const radarData = report ? [
    { subject: 'Conteúdo', value: report.channelScore.content },
    { subject: 'SEO', value: report.channelScore.seo },
    { subject: 'Engagement', value: report.channelScore.engagement },
    { subject: 'Monetização', value: report.channelScore.monetization },
    { subject: 'Consistência', value: report.channelScore.consistency },
    { subject: 'Crescimento', value: report.channelScore.growth },
  ] : [];

  const outlierChartData = (data?.outliers || []).map((v: any) => ({
    name: v.title?.length > 30 ? v.title.slice(0, 30) + '…' : v.title,
    views: v.views,
    multiplier: metrics?.avgViews > 0 ? +(v.views / metrics.avgViews).toFixed(1) : 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Channel Intelligence</h1>
            <p className="text-sm text-muted-foreground">Análise estratégica completa com IA</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass rounded-xl p-5 flex gap-3">
          <Input
            value={channelInput}
            onChange={e => setChannelInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
            placeholder="Cole a URL do canal, @handle ou ID..."
            className="bg-secondary/50"
          />
          <Button onClick={analyze} disabled={loading} className="gradient-hero border-0 gap-2 min-w-[140px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Analisando...' : 'Analisar'}
          </Button>
        </div>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Analisando canal com IA... Isso pode levar ~30s</p>
            <div className="w-64">
              <Progress value={45} className="h-1.5" />
            </div>
          </motion.div>
        )}

        {/* Results */}
        {data && report && (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* Channel Header Card */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-4">
                  {channel?.thumbnail && <img src={channel.thumbnail} alt="" className="w-16 h-16 rounded-full border-2 border-primary/30" />}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold font-['Space_Grotesk']">{channel?.name}</h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {formatNumber(channel?.subscribers)}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {formatNumber(channel?.totalViews)}</span>
                      <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> {channel?.videoCount} vídeos</span>
                      {channel?.country && <Badge variant="outline" className="text-xs">{channel.country}</Badge>}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold gradient-text font-['Space_Grotesk']">{report.channelScore.overall}</div>
                    <p className="text-xs text-muted-foreground">Score Geral</p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Média de Views', value: formatNumber(metrics?.avgViews), icon: Eye, color: 'text-blue-400' },
                  { label: 'Outliers', value: `${metrics?.outlierCount} (${metrics?.superOutlierCount} super)`, icon: Flame, color: 'text-orange-400' },
                  { label: 'Upload', value: `${metrics?.avgDaysBetweenUploads}d`, icon: Clock, color: 'text-emerald-400' },
                  { label: 'RPM Est.', value: `$${report.nicheAnalysis?.estimatedRPM || 0}`, icon: DollarSign, color: 'text-amber-400' },
                ].map((m, i) => (
                  <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                    <m.icon className={`w-5 h-5 ${m.color}`} />
                    <div>
                      <p className="text-sm font-semibold">{m.value}</p>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-secondary/50 p-1 w-full grid grid-cols-5">
                  <TabsTrigger value="scores" className="gap-1 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Scores</TabsTrigger>
                  <TabsTrigger value="outliers" className="gap-1 text-xs"><Flame className="w-3.5 h-3.5" /> Outliers</TabsTrigger>
                  <TabsTrigger value="niche" className="gap-1 text-xs"><Target className="w-3.5 h-3.5" /> Nicho</TabsTrigger>
                  <TabsTrigger value="strategy" className="gap-1 text-xs"><TrendingUp className="w-3.5 h-3.5" /> Estratégia 90d</TabsTrigger>
                  <TabsTrigger value="topics" className="gap-1 text-xs"><Lightbulb className="w-3.5 h-3.5" /> Tópicos</TabsTrigger>
                </TabsList>

                {/* ─── SCORES TAB ─── */}
                <TabsContent value="scores" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Radar Chart */}
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Radar de Performance</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                          <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Score Rings */}
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Scores Detalhados</h3>
                      <div className="grid grid-cols-3 gap-6 place-items-center">
                        <ScoreRing value={report.channelScore.content} label="Conteúdo" size={72} />
                        <ScoreRing value={report.channelScore.seo} label="SEO" size={72} />
                        <ScoreRing value={report.channelScore.engagement} label="Engagement" size={72} />
                        <ScoreRing value={report.channelScore.monetization} label="Monetização" size={72} />
                        <ScoreRing value={report.channelScore.consistency} label="Consistência" size={72} />
                        <ScoreRing value={report.channelScore.growth} label="Crescimento" size={72} />
                      </div>

                      {/* Strengths / Weaknesses */}
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Forças</p>
                          {(report.strengths || []).slice(0, 4).map((s: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground mb-1">• {s}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Fraquezas</p>
                          {(report.weaknesses || []).slice(0, 4).map((w: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground mb-1">• {w}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Critical Fixes */}
                  {report.criticalFixes?.length > 0 && (
                    <div className="glass rounded-xl p-5 border-red-500/20">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-400"><Zap className="w-4 h-4" /> Correções Críticas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {report.criticalFixes.map((fix: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{fix}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── OUTLIERS TAB ─── */}
                <TabsContent value="outliers" className="space-y-4">
                  <div className="glass rounded-xl p-6">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Vídeos Outliers</h3>

                    {/* Chart */}
                    {outlierChartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={outlierChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                          <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Views" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}

                    {/* Table */}
                    <div className="mt-4 overflow-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left p-2">Título</th>
                            <th className="text-right p-2">Views</th>
                            <th className="text-right p-2">Engagement</th>
                            <th className="text-right p-2">Multiplicador</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.outliers || []).map((v: any, i: number) => (
                            <tr key={i} className="border-b border-border/20 hover:bg-secondary/30">
                              <td className="p-2 max-w-[300px] truncate">{v.title}</td>
                              <td className="p-2 text-right font-semibold">{formatNumber(v.views)}</td>
                              <td className="p-2 text-right">{v.engagementRate?.toFixed(1)}%</td>
                              <td className="p-2 text-right">
                                <Badge variant="outline" className={v.views / metrics?.avgViews > 10 ? 'border-red-500/50 text-red-400' : 'border-amber-500/50 text-amber-400'}>
                                  {(v.views / metrics?.avgViews).toFixed(1)}x
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Outlier Analysis */}
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Análise de Outliers</h3>
                    <p className="text-xs text-muted-foreground mb-3">{report.outlierAnalysis?.whatMakesOutliers}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold mb-2 text-primary">Padrões Comuns</p>
                        {(report.outlierAnalysis?.commonPatterns || []).map((p: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 mb-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{p}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-2 text-emerald-400">Elementos Replicáveis</p>
                        {(report.outlierAnalysis?.replicableElements || []).map((e: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 mb-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{e}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ─── NICHE TAB ─── */}
                <TabsContent value="niche" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Análise de Nicho</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Nicho Detectado</span>
                          <Badge className="gradient-hero border-0 text-xs">{report.nicheAnalysis?.detectedNiche}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Sub-Nicho</span>
                          <span className="text-xs font-medium">{report.nicheAnalysis?.detectedSubNiche}</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Fit do Nicho</span>
                            <span className="text-xs font-semibold">{report.nicheAnalysis?.nicheFit}%</span>
                          </div>
                          <Progress value={report.nicheAnalysis?.nicheFit} className="h-1.5" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">RPM Estimado</span>
                          <span className="text-sm font-bold text-emerald-400">${report.nicheAnalysis?.estimatedRPM}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Saturação</span>
                          <Badge className={SATURATION_LABELS[report.nicheAnalysis?.saturation]?.color || ''}>
                            {SATURATION_LABELS[report.nicheAnalysis?.saturation]?.label || report.nicheAnalysis?.saturation}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Faceless Friendly</span>
                          <span className="text-xs">{report.nicheAnalysis?.facelessFriendly ? '✅ Sim' : '❌ Não'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Better Niches */}
                    <div className="glass rounded-xl p-6">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-emerald-400" /> Nichos Alternativos</h3>
                      <div className="space-y-3">
                        {(report.nicheAnalysis?.betterNiches || []).map((n: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold">{n.niche}</span>
                              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">${n.estimatedRPM} RPM</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{n.reason}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{n.difficulty}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content Format */}
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Formato de Conteúdo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { l: 'Formato Principal', v: report.contentFormat?.primaryFormat },
                        { l: 'Melhor Performance', v: report.contentFormat?.bestPerformingFormat },
                        { l: 'Duração Ideal', v: report.contentFormat?.optimalDuration },
                        { l: 'Estilo Narrativo', v: report.contentFormat?.storytellingStyle },
                      ].map((item, i) => (
                        <div key={i} className="p-3 rounded-lg bg-secondary/30">
                          <p className="text-[10px] text-muted-foreground mb-1">{item.l}</p>
                          <p className="text-xs font-semibold">{item.v}</p>
                        </div>
                      ))}
                    </div>
                    {report.contentFormat?.recommendedFormats?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-muted-foreground mr-1">Formatos Recomendados:</span>
                        {report.contentFormat.recommendedFormats.map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{f}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ─── STRATEGY TAB ─── */}
                <TabsContent value="strategy" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Immediate */}
                    <div className="glass rounded-xl p-5 border-red-500/20">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-400"><Zap className="w-4 h-4" /> Esta Semana</h3>
                      <div className="space-y-2">
                        {(report.growthStrategy?.immediate || []).map((a: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5">
                            <span className="text-xs font-bold text-red-400 shrink-0">{i + 1}.</span>
                            <p className="text-xs text-muted-foreground">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Short Term */}
                    <div className="glass rounded-xl p-5 border-amber-500/20">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-400"><TrendingUp className="w-4 h-4" /> Próximos 30 Dias</h3>
                      <div className="space-y-2">
                        {(report.growthStrategy?.shortTerm || []).map((a: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5">
                            <span className="text-xs font-bold text-amber-400 shrink-0">{i + 1}.</span>
                            <p className="text-xs text-muted-foreground">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Long Term */}
                    <div className="glass rounded-xl p-5 border-emerald-500/20">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-400"><Target className="w-4 h-4" /> Próximos 90 Dias</h3>
                      <div className="space-y-2">
                        {(report.growthStrategy?.longTerm || []).map((a: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5">
                            <span className="text-xs font-bold text-emerald-400 shrink-0">{i + 1}.</span>
                            <p className="text-xs text-muted-foreground">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strategy Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass rounded-xl p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Pilares de Conteúdo</h3>
                      <div className="space-y-2">
                        {(report.growthStrategy?.contentPillars || []).map((p: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="w-6 h-6 rounded-full gradient-hero flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                            </div>
                            <span className="text-xs">{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass rounded-xl p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> Monetização</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Caminho</span>
                          <span className="text-xs font-semibold">{report.growthStrategy?.monetizationPath}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Tempo p/ Monetização</span>
                          <Badge variant="outline" className="text-xs">{report.growthStrategy?.estimatedTimeToMonetization}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Frequência Ideal</span>
                          <span className="text-xs font-semibold">{report.growthStrategy?.uploadFrequency}</span>
                        </div>
                        {report.growthStrategy?.estimatedMonthlyRevenue30d && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Receita Est. 30d</span>
                            <span className="text-xs font-bold text-emerald-400">{report.growthStrategy.estimatedMonthlyRevenue30d}</span>
                          </div>
                        )}
                        {report.growthStrategy?.estimatedMonthlyRevenue90d && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Receita Est. 90d</span>
                            <span className="text-xs font-bold text-emerald-400">{report.growthStrategy.estimatedMonthlyRevenue90d}</span>
                          </div>
                        )}
                      </div>

                      {/* SEO + Thumbnail Tips */}
                      <div className="mt-4 pt-4 border-t border-border/30">
                        <p className="text-xs font-semibold mb-2 text-primary">SEO</p>
                        {(report.seoImprovements || []).slice(0, 3).map((s: string, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground mb-1">• {s}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ─── TOPICS TAB ─── */}
                <TabsContent value="topics" className="space-y-4">
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-400" /> Tópicos Recomendados</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(report.recommendedTopics || []).map((t: any, i: number) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-semibold flex-1">{t.topic}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{t.format}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{t.whyNow}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-primary font-medium">💡 {t.titleSuggestion}</p>
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">{t.estimatedViews} views</Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Competitors */}
                  {report.competitors?.length > 0 && (
                    <div className="glass rounded-xl p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Concorrentes Detectados</h3>
                      <div className="space-y-2">
                        {report.competitors.map((c: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                            <p className="text-sm font-semibold">{c.channelName}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{c.whyCompetitor}</p>
                            <p className="text-[10px] text-primary mt-1">📚 {c.whatToLearn}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thumbnail Advice */}
                  {report.thumbnailAdvice?.length > 0 && (
                    <div className="glass rounded-xl p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Dicas de Thumbnail</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {report.thumbnailAdvice.map((tip: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ChannelIntelligence;
