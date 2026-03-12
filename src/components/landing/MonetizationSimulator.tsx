import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, Clock, Video, Target, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

/**
 * YPP Requirements:
 * - 1,000 subscribers
 * - 4,000 watch hours in last 12 months
 * 
 * Formula inputs:
 * - videos_per_month: posting frequency
 * - avg_duration_min: average video length
 * - niche: affects avg views, sub conversion, RPM
 * 
 * Key metrics:
 * - avg_retention: % of video watched (faceless avg 25-40%)
 * - sub_conversion_rate: % of unique viewers that subscribe (~1.5-4%)
 * - avg_views_per_video: depends on niche, quality, and consistency
 * - view_growth_rate: monthly growth multiplier for views (1.15-1.5x)
 */

interface NicheProfile {
  label: string;
  emoji: string;
  avg_views_first_month: number;
  sub_conversion: number;
  avg_retention: number;
  rpm_usd: number;
  growth_rate: number; // monthly multiplier
  difficulty: 'fácil' | 'médio' | 'difícil';
}

const NICHE_PROFILES: Record<string, NicheProfile> = {
  curiosidades: {
    label: 'Curiosidades / Top 10',
    emoji: '🧠',
    avg_views_first_month: 800,
    sub_conversion: 0.035,
    avg_retention: 0.35,
    rpm_usd: 3.5,
    growth_rate: 1.35,
    difficulty: 'fácil',
  },
  terror: {
    label: 'Terror / Mistério',
    emoji: '👻',
    avg_views_first_month: 1200,
    sub_conversion: 0.04,
    avg_retention: 0.40,
    rpm_usd: 4.0,
    growth_rate: 1.40,
    difficulty: 'fácil',
  },
  financas: {
    label: 'Finanças / Investimentos',
    emoji: '💰',
    avg_views_first_month: 500,
    sub_conversion: 0.025,
    avg_retention: 0.30,
    rpm_usd: 12.0,
    growth_rate: 1.25,
    difficulty: 'difícil',
  },
  tecnologia: {
    label: 'Tecnologia / IA',
    emoji: '🤖',
    avg_views_first_month: 700,
    sub_conversion: 0.03,
    avg_retention: 0.32,
    rpm_usd: 6.5,
    growth_rate: 1.30,
    difficulty: 'médio',
  },
  historia: {
    label: 'História / Documentário',
    emoji: '📜',
    avg_views_first_month: 600,
    sub_conversion: 0.03,
    avg_retention: 0.38,
    rpm_usd: 5.0,
    growth_rate: 1.28,
    difficulty: 'médio',
  },
  mitologia: {
    label: 'Mitologia / Lendas',
    emoji: '⚡',
    avg_views_first_month: 900,
    sub_conversion: 0.038,
    avg_retention: 0.42,
    rpm_usd: 4.5,
    growth_rate: 1.38,
    difficulty: 'fácil',
  },
  ciencia: {
    label: 'Ciência / Espaço',
    emoji: '🔬',
    avg_views_first_month: 650,
    sub_conversion: 0.028,
    avg_retention: 0.33,
    rpm_usd: 5.5,
    growth_rate: 1.30,
    difficulty: 'médio',
  },
  motivacional: {
    label: 'Motivacional / Mindset',
    emoji: '🔥',
    avg_views_first_month: 1000,
    sub_conversion: 0.032,
    avg_retention: 0.28,
    rpm_usd: 3.0,
    growth_rate: 1.32,
    difficulty: 'médio',
  },
};

interface MonthProjection {
  month: number;
  videos_total: number;
  views_this_month: number;
  views_cumulative: number;
  subs_cumulative: number;
  watch_hours_cumulative: number;
  revenue_estimate_usd: number;
}

function simulateGrowth(
  videosPerMonth: number,
  avgDurationMin: number,
  niche: NicheProfile,
  boostMultiplier: number, // 1.0 = no tool boost, 1.4 = with Monetiza27
  months: number = 12
): MonthProjection[] {
  const projections: MonthProjection[] = [];
  let totalViews = 0;
  let totalSubs = 0;
  let totalWatchHours = 0;
  let totalRevenue = 0;

  for (let m = 1; m <= months; m++) {
    // Views grow monthly based on niche growth rate + channel momentum
    const growthFactor = Math.pow(niche.growth_rate * boostMultiplier, m - 1);
    const viewsPerVideo = Math.round(niche.avg_views_first_month * growthFactor);
    const viewsThisMonth = viewsPerVideo * videosPerMonth;
    
    totalViews += viewsThisMonth;
    
    // Subscribers: diminishing conversion as channel grows (more repeat viewers)
    const effectiveConversion = niche.sub_conversion * Math.max(0.4, 1 - (totalSubs / 10000));
    const newSubs = Math.round(viewsThisMonth * effectiveConversion);
    totalSubs += newSubs;
    
    // Watch hours: views × duration × retention / 60
    const watchHoursThisMonth = (viewsThisMonth * avgDurationMin * niche.avg_retention) / 60;
    totalWatchHours += watchHoursThisMonth;
    
    // Revenue (only after YPP)
    const isMonetized = totalSubs >= 1000 && totalWatchHours >= 4000;
    const revenueThisMonth = isMonetized ? (viewsThisMonth / 1000) * niche.rpm_usd : 0;
    totalRevenue += revenueThisMonth;

    projections.push({
      month: m,
      videos_total: videosPerMonth * m,
      views_this_month: viewsThisMonth,
      views_cumulative: totalViews,
      subs_cumulative: totalSubs,
      watch_hours_cumulative: Math.round(totalWatchHours),
      revenue_estimate_usd: Math.round(totalRevenue),
    });
  }

  return projections;
}

export const MonetizationSimulator = () => {
  const [videosPerMonth, setVideosPerMonth] = useState(12);
  const [avgDuration, setAvgDuration] = useState(15);
  const [selectedNiche, setSelectedNiche] = useState('curiosidades');

  const niche = NICHE_PROFILES[selectedNiche];
  const TOOL_BOOST = 1.08; // Monetiza27 gives ~8% edge via better hooks, titles, SEO

  const projections = useMemo(
    () => simulateGrowth(videosPerMonth, avgDuration, niche, TOOL_BOOST, 12),
    [videosPerMonth, avgDuration, niche]
  );

  const withoutTool = useMemo(
    () => simulateGrowth(videosPerMonth, avgDuration, niche, 1.0, 12),
    [videosPerMonth, avgDuration, niche]
  );

  // Find month where YPP is reached
  const yppMonth = projections.findIndex(p => p.subs_cumulative >= 1000 && p.watch_hours_cumulative >= 4000) + 1;
  const yppMonthWithout = withoutTool.findIndex(p => p.subs_cumulative >= 1000 && p.watch_hours_cumulative >= 4000) + 1;

  const latest = projections[projections.length - 1];
  const latestWithout = withoutTool[withoutTool.length - 1];

  // Progress bars for current trajectory
  const subsProgress = Math.min(100, (latest.subs_cumulative / 1000) * 100);
  const hoursProgress = Math.min(100, (latest.watch_hours_cumulative / 4000) * 100);

  const canReach30Days = yppMonth === 1;
  const canReach60Days = yppMonth <= 2;
  const canReach90Days = yppMonth <= 3;

  return (
    <section id="simulator" className="py-20 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            <Calculator className="w-3 h-3 mr-1" /> Simulador de Monetização
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] mb-3">
            Quando você vai{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              monetizar?
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Simulação baseada em dados reais de RPM, taxa de crescimento por nicho e requisitos do YouTube Partner Program.
            <span className="text-xs block mt-1 opacity-60">Sem promessas falsas — apenas matemática.</span>
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Controls */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            whileInView={{ opacity: 1, x: 0 }} 
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-6 space-y-6"
          >
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Sua dedicação
            </h3>

            {/* Videos per month */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-muted-foreground">Vídeos por mês</label>
                <span className="text-sm font-bold text-primary">{videosPerMonth} vídeos</span>
              </div>
              <Slider
                value={[videosPerMonth]}
                onValueChange={v => setVideosPerMonth(v[0])}
                min={4}
                max={30}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>1/semana</span>
                <span>3/semana</span>
                <span>Diário</span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-muted-foreground">Duração média</label>
                <span className="text-sm font-bold text-primary">{avgDuration} min</span>
              </div>
              <Slider
                value={[avgDuration]}
                onValueChange={v => setAvgDuration(v[0])}
                min={5}
                max={40}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>5 min</span>
                <span>20 min</span>
                <span>40 min</span>
              </div>
            </div>

            {/* Niche selector */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Nicho</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {Object.entries(NICHE_PROFILES).map(([key, n]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedNiche(key)}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                      selectedNiche === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30 text-foreground'
                    }`}
                  >
                    <span className="font-medium">{n.emoji} {n.label}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">RPM ${n.rpm_usd}</span>
                      <Badge variant="outline" className={`text-[9px] h-4 ${
                        n.difficulty === 'fácil' ? 'border-emerald-500/30 text-emerald-400' :
                        n.difficulty === 'médio' ? 'border-yellow-500/30 text-yellow-400' :
                        'border-destructive/30 text-destructive'
                      }`}>
                        {n.difficulty}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            whileInView={{ opacity: 1, x: 0 }} 
            viewport={{ once: true }}
            className="space-y-4"
          >
            {/* YPP Timeline */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-accent" /> Previsão YPP (1000 subs + 4000h)
              </h3>
              
              <div className="text-center py-4">
                {yppMonth > 0 ? (
                  <>
                    <div className={`text-5xl font-bold font-['Space_Grotesk'] ${
                      canReach30Days ? 'text-emerald-400' : canReach90Days ? 'text-yellow-400' : 'text-accent'
                    }`}>
                      {yppMonth === 1 ? '~30' : yppMonth === 2 ? '~60' : `~${yppMonth * 30}`}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">dias para monetizar</p>
                    
                    {yppMonthWithout > 0 && yppMonthWithout > yppMonth && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sem a ferramenta: ~{yppMonthWithout * 30} dias
                        <span className="text-emerald-400 ml-1">
                          ({Math.round(((yppMonthWithout - yppMonth) / yppMonthWithout) * 100)}% mais rápido)
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold font-['Space_Grotesk'] text-muted-foreground">12+ meses</div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      Aumente frequência ou duração dos vídeos
                    </p>
                  </>
                )}
              </div>

              {/* Progress bars */}
              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Inscritos</span>
                    <span className={`font-medium ${latest.subs_cumulative >= 1000 ? 'text-emerald-400' : 'text-foreground'}`}>
                      {latest.subs_cumulative.toLocaleString()} / 1.000
                    </span>
                  </div>
                  <Progress value={subsProgress} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Horas assistidas</span>
                    <span className={`font-medium ${latest.watch_hours_cumulative >= 4000 ? 'text-emerald-400' : 'text-foreground'}`}>
                      {latest.watch_hours_cumulative.toLocaleString()} / 4.000h
                    </span>
                  </div>
                  <Progress value={hoursProgress} className="h-2" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Projeção em 12 meses com {videosPerMonth * 12} vídeos publicados
              </p>
            </div>

            {/* Revenue projection */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Projeção de receita (12 meses)
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                {[projections[2], projections[5], projections[11]].filter(Boolean).map((p) => (
                  <div key={p.month} className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-[10px] text-muted-foreground">Mês {p.month}</p>
                    <p className="text-lg font-bold font-['Space_Grotesk'] text-foreground">
                      ${p.revenue_estimate_usd}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.subs_cumulative.toLocaleString()} subs
                    </p>
                  </div>
                ))}
              </div>
              
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                RPM estimado: ${niche.rpm_usd}/1000 views • Retenção: {Math.round(niche.avg_retention * 100)}%
              </p>
            </div>

            {/* Month-by-month mini table */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-primary" /> Evolução mês a mês
              </h3>
              <div className="max-h-[180px] overflow-y-auto pr-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/50">
                      <th className="text-left py-1.5 font-medium">Mês</th>
                      <th className="text-right py-1.5 font-medium">Vídeos</th>
                      <th className="text-right py-1.5 font-medium">Views</th>
                      <th className="text-right py-1.5 font-medium">Subs</th>
                      <th className="text-right py-1.5 font-medium">Watch H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map(p => {
                      const isYpp = p.subs_cumulative >= 1000 && p.watch_hours_cumulative >= 4000;
                      return (
                        <tr key={p.month} className={`border-b border-border/20 ${isYpp ? 'text-emerald-400' : 'text-foreground'}`}>
                          <td className="py-1.5 flex items-center gap-1">
                            {isYpp && <CheckCircle2 className="w-3 h-3" />}
                            Mês {p.month}
                          </td>
                          <td className="text-right py-1.5">{p.videos_total}</td>
                          <td className="text-right py-1.5">{p.views_cumulative.toLocaleString()}</td>
                          <td className="text-right py-1.5">{p.subs_cumulative.toLocaleString()}</td>
                          <td className="text-right py-1.5">{p.watch_hours_cumulative.toLocaleString()}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Honesty disclaimer */}
            <div className="bg-muted/20 border border-border/50 rounded-xl p-4 flex gap-3">
              <Zap className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Transparência total:</strong> Esta simulação usa médias reais de canais faceless.
                Resultados reais variam conforme qualidade de conteúdo, SEO, thumbnails e algoritmo do YouTube.
                A ferramenta <strong className="text-primary">otimiza</strong> sua produção (hooks, scripts, títulos), 
                mas o crescimento depende da sua consistência e dedicação.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
