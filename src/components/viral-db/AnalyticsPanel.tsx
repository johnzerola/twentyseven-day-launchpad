import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  Treemap, PieChart, Pie
} from 'recharts';
import { DollarSign, TrendingUp, Globe, Target, Flame, Users, Eye, Zap } from 'lucide-react';

interface ChannelIntelligence {
  id: string;
  channel_name: string;
  niche: string;
  sub_niche: string | null;
  style: string;
  country: string;
  language: string;
  subscribers: number;
  avg_views: number;
  growth_rate: string;
  is_faceless: boolean;
  rpm_estimate: number;
}

interface AnalyticsPanelProps {
  channels: ChannelIntelligence[];
}

const COUNTRY_NAMES: Record<string, string> = {
  US: '🇺🇸 EUA', BR: '🇧🇷 Brasil', GB: '🇬🇧 UK', DE: '🇩🇪 Alemanha', FR: '🇫🇷 França',
  CA: '🇨🇦 Canadá', AU: '🇦🇺 Austrália', JP: '🇯🇵 Japão', KR: '🇰🇷 Coreia', ES: '🇪🇸 Espanha',
  IT: '🇮🇹 Itália', NL: '🇳🇱 Holanda', PL: '🇵🇱 Polônia', TR: '🇹🇷 Turquia', MX: '🇲🇽 México',
  AR: '🇦🇷 Argentina', CL: '🇨🇱 Chile', PH: '🇵🇭 Filipinas', ID: '🇮🇩 Indonésia',
  SG: '🇸🇬 Singapura', NZ: '🇳🇿 Nova Zelândia', IE: '🇮🇪 Irlanda', NO: '🇳🇴 Noruega',
  SE: '🇸🇪 Suécia', DK: '🇩🇰 Dinamarca', CH: '🇨🇭 Suíça', AT: '🇦🇹 Áustria',
  BE: '🇧🇪 Bélgica', ZA: '🇿🇦 África do Sul', PT: '🇵🇹 Portugal', CO: '🇨🇴 Colômbia',
  IN: '🇮🇳 Índia', RU: '🇷🇺 Rússia', SA: '🇸🇦 Arábia Saudita',
};

const HEATMAP_COLORS = [
  'hsl(0, 70%, 50%)',    // low RPM - red
  'hsl(30, 80%, 50%)',   // orange
  'hsl(45, 90%, 50%)',   // yellow
  'hsl(120, 60%, 45%)',  // green
  'hsl(160, 70%, 40%)',  // teal - high RPM
];

const getRpmColor = (rpm: number) => {
  if (rpm >= 12) return 'hsl(160, 70%, 40%)';
  if (rpm >= 9) return 'hsl(120, 60%, 45%)';
  if (rpm >= 6) return 'hsl(45, 90%, 50%)';
  if (rpm >= 3) return 'hsl(30, 80%, 50%)';
  return 'hsl(0, 70%, 50%)';
};

const getGrowthColor = (rate: string) => {
  if (rate === 'explosive') return 'hsl(0, 80%, 55%)';
  if (rate === 'fast') return 'hsl(35, 90%, 55%)';
  return 'hsl(150, 60%, 45%)';
};

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const AnalyticsPanel = ({ channels }: AnalyticsPanelProps) => {
  // RPM by Country
  const rpmByCountry = useMemo(() => {
    const map = new Map<string, { total: number; count: number; channels: number; avgViews: number }>();
    channels.forEach(ch => {
      if (!map.has(ch.country)) map.set(ch.country, { total: 0, count: 0, channels: 0, avgViews: 0 });
      const e = map.get(ch.country)!;
      e.total += (ch.rpm_estimate || 0);
      e.count++;
      e.channels++;
      e.avgViews += ch.avg_views;
    });
    return Array.from(map.entries())
      .map(([country, d]) => ({
        country,
        name: COUNTRY_NAMES[country] || country,
        rpm: Math.round((d.total / d.count) * 10) / 10,
        channels: d.channels,
        avgViews: Math.round(d.avgViews / d.count),
      }))
      .sort((a, b) => b.rpm - a.rpm);
  }, [channels]);

  // Best niches by growth
  const nichesByGrowth = useMemo(() => {
    const map = new Map<string, { explosive: number; fast: number; steady: number; total: number; avgRpm: number; totalRpm: number; avgViews: number; totalViews: number }>();
    channels.forEach(ch => {
      if (!map.has(ch.niche)) map.set(ch.niche, { explosive: 0, fast: 0, steady: 0, total: 0, avgRpm: 0, totalRpm: 0, avgViews: 0, totalViews: 0 });
      const e = map.get(ch.niche)!;
      e[ch.growth_rate as 'explosive' | 'fast' | 'steady']++;
      e.total++;
      e.totalRpm += (ch.rpm_estimate || 0);
      e.totalViews += ch.avg_views;
    });
    return Array.from(map.entries())
      .map(([niche, d]) => ({
        niche,
        ...d,
        avgRpm: Math.round((d.totalRpm / d.total) * 10) / 10,
        avgViews: Math.round(d.totalViews / d.total),
        growthScore: (d.explosive * 3 + d.fast * 2 + d.steady) / d.total,
      }))
      .sort((a, b) => b.growthScore - a.growthScore);
  }, [channels]);

  // Opportunity matrix (niche × country combos)
  const opportunities = useMemo(() => {
    const map = new Map<string, { niche: string; country: string; rpm: number; growth: number; channels: number; avgViews: number }>();
    channels.forEach(ch => {
      const key = `${ch.niche}|${ch.country}`;
      if (!map.has(key)) map.set(key, { niche: ch.niche, country: ch.country, rpm: 0, growth: 0, channels: 0, avgViews: 0 });
      const e = map.get(key)!;
      e.rpm += (ch.rpm_estimate || 0);
      e.growth += (ch.growth_rate === 'explosive' ? 3 : ch.growth_rate === 'fast' ? 2 : 1);
      e.channels++;
      e.avgViews += ch.avg_views;
    });
    return Array.from(map.values())
      .map(d => ({
        ...d,
        rpm: Math.round((d.rpm / d.channels) * 10) / 10,
        growth: Math.round((d.growth / d.channels) * 10) / 10,
        avgViews: Math.round(d.avgViews / d.channels),
        score: Math.round(((d.rpm / d.channels) * (d.growth / d.channels)) * 10) / 10,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }, [channels]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalSubs = channels.reduce((a, c) => a + c.subscribers, 0);
    const avgRpm = channels.length > 0 ? Math.round(channels.reduce((a, c) => a + (c.rpm_estimate || 0), 0) / channels.length * 10) / 10 : 0;
    const explosive = channels.filter(c => c.growth_rate === 'explosive').length;
    const faceless = channels.filter(c => c.is_faceless).length;
    return { totalSubs, avgRpm, explosive, faceless, countries: new Set(channels.map(c => c.country)).size, niches: new Set(channels.map(c => c.niche)).size };
  }, [channels]);

  // Treemap data for niche distribution
  const treemapData = useMemo(() => {
    return nichesByGrowth.slice(0, 20).map(n => ({
      name: n.niche,
      size: n.total,
      rpm: n.avgRpm,
      growth: n.growthScore,
    }));
  }, [nichesByGrowth]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card/95 backdrop-blur border border-border/50 rounded-lg p-3 shadow-xl text-xs space-y-1">
        <p className="font-bold">{d.name || d.niche || d.country}</p>
        {d.rpm !== undefined && <p>💰 RPM: <span className="text-emerald-400">${d.rpm}</span></p>}
        {d.channels !== undefined && <p>📺 Canais: {d.channels}</p>}
        {d.avgViews !== undefined && <p>👁 Avg Views: {formatNumber(d.avgViews)}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Canais', value: channels.length, icon: Users, color: 'text-blue-400' },
          { label: 'Países', value: globalStats.countries, icon: Globe, color: 'text-emerald-400' },
          { label: 'Nichos', value: globalStats.niches, icon: Target, color: 'text-amber-400' },
          { label: 'RPM Médio', value: `$${globalStats.avgRpm}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Explosivos', value: globalStats.explosive, icon: Flame, color: 'text-red-400' },
          { label: 'Faceless', value: `${Math.round(globalStats.faceless / channels.length * 100)}%`, icon: Eye, color: 'text-purple-400' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
            <p className="text-lg font-bold font-['Space_Grotesk']">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* RPM by Country Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              RPM Médio por País
            </CardTitle>
            <p className="text-xs text-muted-foreground">Receita estimada por 1000 views (USD)</p>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rpmByCountry.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rpm" radius={[0, 6, 6, 0]}>
                    {rpmByCountry.slice(0, 15).map((entry, i) => (
                      <Cell key={i} fill={getRpmColor(entry.rpm)} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Best Niches by Growth */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Melhores Nichos por Crescimento
            </CardTitle>
            <p className="text-xs text-muted-foreground">Score baseado em velocidade de crescimento dos canais</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {nichesByGrowth.slice(0, 20).map((n, i) => (
                <motion.div key={n.niche} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: i < 3 ? 'hsl(0, 80%, 55%)' : i < 8 ? 'hsl(35, 90%, 55%)' : 'hsl(var(--secondary))', color: i < 8 ? 'white' : 'hsl(var(--foreground))' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{n.niche}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{n.total} canais</Badge>
                    </div>
                    {/* Growth bar */}
                    <div className="flex gap-0.5 mt-1">
                      <div className="h-1.5 rounded-l bg-red-500/80" style={{ width: `${(n.explosive / n.total) * 100}%` }} title={`${n.explosive} explosive`} />
                      <div className="h-1.5 bg-amber-500/80" style={{ width: `${(n.fast / n.total) * 100}%` }} title={`${n.fast} fast`} />
                      <div className="h-1.5 rounded-r bg-emerald-500/80" style={{ width: `${(n.steady / n.total) * 100}%` }} title={`${n.steady} steady`} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-emerald-400">${n.avgRpm}</p>
                    <p className="text-[10px] text-muted-foreground">{formatNumber(n.avgViews)} views</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/80" /> Explosive</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/80" /> Fast</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" /> Steady</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Opportunity Heatmap */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Mapa de Oportunidades Globais
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Score = RPM × Velocidade de Crescimento. Quanto maior, mais oportunidade de monetização rápida.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.map((op, i) => (
              <motion.div key={`${op.niche}-${op.country}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                className="relative p-4 rounded-xl border transition-all hover:scale-[1.02]"
                style={{
                  borderColor: getRpmColor(op.rpm),
                  background: `linear-gradient(135deg, ${getRpmColor(op.rpm)}10, transparent)`,
                }}>
                {/* Rank badge */}
                {i < 3 && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                    {i + 1}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-bold">{op.niche}</p>
                    <p className="text-xs text-muted-foreground">{COUNTRY_NAMES[op.country] || op.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold font-['Space_Grotesk']" style={{ color: getRpmColor(op.rpm) }}>
                      {op.score}
                    </p>
                    <p className="text-[10px] text-muted-foreground">score</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <DollarSign className="w-3 h-3" />${op.rpm}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <TrendingUp className="w-3 h-3" />{op.growth.toFixed(1)}x
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="w-3 h-3" />{formatNumber(op.avgViews)}
                  </span>
                  <Badge variant="outline" className="text-[9px]">{op.channels} ch</Badge>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
            <p className="text-[10px] text-muted-foreground">RPM:</p>
            {[
              { label: '< $3', color: HEATMAP_COLORS[0] },
              { label: '$3-6', color: HEATMAP_COLORS[1] },
              { label: '$6-9', color: HEATMAP_COLORS[2] },
              { label: '$9-12', color: HEATMAP_COLORS[3] },
              { label: '> $12', color: HEATMAP_COLORS[4] },
            ].map((l, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Niche Distribution Treemap */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            Distribuição de Nichos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tamanho = quantidade de canais · Cor = RPM médio</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                stroke="hsl(var(--border))"
                content={({ x, y, width, height, name, rpm }: any) => {
                  if (width < 40 || height < 30) return null;
                  return (
                    <g>
                      <rect x={x} y={y} width={width} height={height} rx={6}
                        fill={getRpmColor(rpm || 0)} fillOpacity={0.25}
                        stroke="hsl(var(--border))" strokeWidth={1} />
                      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle"
                        fill="hsl(var(--foreground))" fontSize={width < 80 ? 9 : 11} fontWeight="bold">
                        {name}
                      </text>
                      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle"
                        fill="hsl(var(--muted-foreground))" fontSize={9}>
                        ${rpm}
                      </text>
                    </g>
                  );
                }}
              />
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
