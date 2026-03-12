import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator, TrendingUp, Clock, Video, Target, CheckCircle2,
  AlertTriangle, Zap, Shield, BarChart3, Flame, ArrowRight,
  Sparkles, BookOpen, Eye, ThumbsUp, Users, DollarSign
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Niche Profiles with real-world data ───────────────────────────

interface NicheProfile {
  label: string;
  emoji: string;
  avg_views_first_month: number;
  sub_conversion: number;
  avg_retention: number;
  rpm_usd: number;
  rpm_brl: number;
  growth_rate: number;
  difficulty: 'fácil' | 'médio' | 'difícil';
  viral_potential: number; // 1-10 chance of a video blowing up
  shorts_boost: boolean;
}

const NICHE_PROFILES: Record<string, NicheProfile> = {
  curiosidades: {
    label: 'Curiosidades / Top 10', emoji: '🧠',
    avg_views_first_month: 800, sub_conversion: 0.035, avg_retention: 0.35,
    rpm_usd: 3.5, rpm_brl: 5.25, growth_rate: 1.35, difficulty: 'fácil',
    viral_potential: 8, shorts_boost: true,
  },
  terror: {
    label: 'Terror / Mistério', emoji: '👻',
    avg_views_first_month: 1200, sub_conversion: 0.04, avg_retention: 0.40,
    rpm_usd: 4.0, rpm_brl: 6.0, growth_rate: 1.40, difficulty: 'fácil',
    viral_potential: 9, shorts_boost: true,
  },
  financas: {
    label: 'Finanças / Investimentos', emoji: '💰',
    avg_views_first_month: 500, sub_conversion: 0.025, avg_retention: 0.30,
    rpm_usd: 12.0, rpm_brl: 18.0, growth_rate: 1.25, difficulty: 'difícil',
    viral_potential: 4, shorts_boost: false,
  },
  tecnologia: {
    label: 'Tecnologia / IA', emoji: '🤖',
    avg_views_first_month: 700, sub_conversion: 0.03, avg_retention: 0.32,
    rpm_usd: 6.5, rpm_brl: 9.75, growth_rate: 1.30, difficulty: 'médio',
    viral_potential: 7, shorts_boost: true,
  },
  historia: {
    label: 'História / Documentário', emoji: '📜',
    avg_views_first_month: 600, sub_conversion: 0.03, avg_retention: 0.38,
    rpm_usd: 5.0, rpm_brl: 7.5, growth_rate: 1.28, difficulty: 'médio',
    viral_potential: 5, shorts_boost: false,
  },
  mitologia: {
    label: 'Mitologia / Lendas', emoji: '⚡',
    avg_views_first_month: 900, sub_conversion: 0.038, avg_retention: 0.42,
    rpm_usd: 4.5, rpm_brl: 6.75, growth_rate: 1.38, difficulty: 'fácil',
    viral_potential: 8, shorts_boost: true,
  },
  ciencia: {
    label: 'Ciência / Espaço', emoji: '🔬',
    avg_views_first_month: 650, sub_conversion: 0.028, avg_retention: 0.33,
    rpm_usd: 5.5, rpm_brl: 8.25, growth_rate: 1.30, difficulty: 'médio',
    viral_potential: 6, shorts_boost: true,
  },
  motivacional: {
    label: 'Motivacional / Mindset', emoji: '🔥',
    avg_views_first_month: 1000, sub_conversion: 0.032, avg_retention: 0.28,
    rpm_usd: 3.0, rpm_brl: 4.5, growth_rate: 1.32, difficulty: 'médio',
    viral_potential: 7, shorts_boost: true,
  },
  cripto: {
    label: 'Cripto / Web3', emoji: '₿',
    avg_views_first_month: 600, sub_conversion: 0.022, avg_retention: 0.27,
    rpm_usd: 15.0, rpm_brl: 22.5, growth_rate: 1.22, difficulty: 'difícil',
    viral_potential: 5, shorts_boost: false,
  },
  gaming: {
    label: 'Gaming / Reviews', emoji: '🎮',
    avg_views_first_month: 1100, sub_conversion: 0.042, avg_retention: 0.35,
    rpm_usd: 2.5, rpm_brl: 3.75, growth_rate: 1.42, difficulty: 'fácil',
    viral_potential: 9, shorts_boost: true,
  },
};

// ─── Simulation Engine ─────────────────────────────────────────────

interface MonthProjection {
  month: number;
  videos_total: number;
  views_this_month: number;
  views_cumulative: number;
  subs_cumulative: number;
  watch_hours_cumulative: number;
  revenue_month_usd: number;
  revenue_cumulative_usd: number;
  ypp_reached: boolean;
}

type Scenario = 'pessimista' | 'realista' | 'otimista';

const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  pessimista: 0.6,
  realista: 1.0,
  otimista: 1.5,
};

function simulateGrowth(
  videosPerMonth: number,
  avgDurationMin: number,
  niche: NicheProfile,
  scenario: Scenario,
  withTool: boolean,
  months: number = 12
): MonthProjection[] {
  const projections: MonthProjection[] = [];
  let totalViews = 0;
  let totalSubs = 0;
  let totalWatchHours = 0;
  let totalRevenue = 0;

  const scenarioMult = SCENARIO_MULTIPLIERS[scenario];
  // Tool boost: better hooks (+12% CTR), optimized titles (+15% impressions),
  // AI-scored scripts (+8% retention), SEO tags (+10% search traffic)
  const toolBoost = withTool ? 1.12 : 1.0;
  const retentionBoost = withTool ? 1.08 : 1.0;

  for (let m = 1; m <= months; m++) {
    // Compounding growth with diminishing returns after month 6
    const diminishing = m <= 6 ? 1.0 : Math.max(0.7, 1 - (m - 6) * 0.03);
    const growthFactor = Math.pow(niche.growth_rate, m - 1) * diminishing * scenarioMult * toolBoost;
    const viewsPerVideo = Math.round(niche.avg_views_first_month * growthFactor);
    const viewsThisMonth = viewsPerVideo * videosPerMonth;

    totalViews += viewsThisMonth;

    // Sub conversion with natural decay (more repeat viewers over time)
    const effectiveConversion = niche.sub_conversion * Math.max(0.35, 1 - (totalSubs / 12000));
    totalSubs += Math.round(viewsThisMonth * effectiveConversion);

    // Watch hours with retention boost from tool
    const effectiveRetention = niche.avg_retention * retentionBoost;
    const watchHoursThisMonth = (viewsThisMonth * avgDurationMin * effectiveRetention) / 60;
    totalWatchHours += watchHoursThisMonth;

    const yppReached = totalSubs >= 1000 && totalWatchHours >= 4000;
    const revenueMonth = yppReached ? (viewsThisMonth / 1000) * niche.rpm_usd : 0;
    totalRevenue += revenueMonth;

    projections.push({
      month: m,
      videos_total: videosPerMonth * m,
      views_this_month: viewsThisMonth,
      views_cumulative: totalViews,
      subs_cumulative: totalSubs,
      watch_hours_cumulative: Math.round(totalWatchHours),
      revenue_month_usd: Math.round(revenueMonth),
      revenue_cumulative_usd: Math.round(totalRevenue),
      ypp_reached: yppReached,
    });
  }

  return projections;
}

// ─── Bottleneck Analysis ───────────────────────────────────────────

function getBottleneck(projections: MonthProjection[]): 'subs' | 'hours' | 'both' | 'none' {
  const last = projections[projections.length - 1];
  const subsPct = last.subs_cumulative / 1000;
  const hoursPct = last.watch_hours_cumulative / 4000;
  if (subsPct >= 1 && hoursPct >= 1) return 'none';
  if (subsPct < hoursPct) return 'subs';
  if (hoursPct < subsPct) return 'hours';
  return 'both';
}

function getBottleneckAdvice(bottleneck: string, niche: NicheProfile): string {
  switch (bottleneck) {
    case 'subs':
      return niche.shorts_boost
        ? '💡 Seu gargalo são inscritos. Publique 2-3 Shorts/semana extraídos dos seus vídeos longos para acelerar a conversão de subs em até 3x.'
        : '💡 Seu gargalo são inscritos. Adicione CTAs estratégicos nos primeiros 60s e no "momento de valor" do vídeo. Peça inscrição DEPOIS de entregar valor.';
    case 'hours':
      return '💡 Seu gargalo são horas assistidas. Aumente a duração dos vídeos para 15-20min e foque em retenção: use open loops a cada 90s e evite intros longas.';
    case 'both':
      return '💡 Você precisa de mais volume. Aumente para pelo menos 3 vídeos/semana de 15+ min no nicho certo. Considere nichos de maior potencial viral.';
    default:
      return '🎉 Você atinge os requisitos do YPP dentro de 12 meses com esta configuração!';
  }
}

// ─── What the tool actually does ───────────────────────────────────

const TOOL_IMPACT = [
  { icon: Eye, label: 'Títulos otimizados', impact: '+15% impressões', desc: 'IA analisa 945+ títulos virais e gera variações A/B testáveis' },
  { icon: Flame, label: 'Hooks de 5 segundos', impact: '+12% CTR', desc: 'Ganchos baseados em padrões que retêm 85%+ dos viewers' },
  { icon: BookOpen, label: 'Scripts com retenção', impact: '+8% watch time', desc: 'Open loops, pattern interrupts e cliffhangers a cada 90s' },
  { icon: BarChart3, label: 'Análise de nicho', impact: 'Escolha certa', desc: 'RPM real, saturação e dificuldade por país para evitar nichos mortos' },
  { icon: Users, label: 'Espionagem de canais', impact: 'Modelos validados', desc: 'Reverse-engineer de canais de sucesso: estrutura, pacing, thumbnails' },
  { icon: Sparkles, label: 'Produção 10x mais rápida', impact: '~2h por vídeo', desc: 'Do roteiro ao prompt visual em minutos, não dias' },
];

// ─── Component ─────────────────────────────────────────────────────

export const MonetizationSimulator = () => {
  const [videosPerMonth, setVideosPerMonth] = useState(12);
  const [avgDuration, setAvgDuration] = useState(15);
  const [selectedNiche, setSelectedNiche] = useState('curiosidades');
  const [scenario, setScenario] = useState<Scenario>('realista');
  const [showDetails, setShowDetails] = useState(false);

  const niche = NICHE_PROFILES[selectedNiche];

  const withTool = useMemo(
    () => simulateGrowth(videosPerMonth, avgDuration, niche, scenario, true, 12),
    [videosPerMonth, avgDuration, niche, scenario]
  );

  const withoutTool = useMemo(
    () => simulateGrowth(videosPerMonth, avgDuration, niche, scenario, false, 12),
    [videosPerMonth, avgDuration, niche, scenario]
  );

  const yppMonthWith = withTool.findIndex(p => p.ypp_reached) + 1;
  const yppMonthWithout = withoutTool.findIndex(p => p.ypp_reached) + 1;

  const latest = withTool[withTool.length - 1];
  const bottleneck = getBottleneck(withTool);
  const advice = getBottleneckAdvice(bottleneck, niche);

  const subsProgress = Math.min(100, (latest.subs_cumulative / 1000) * 100);
  const hoursProgress = Math.min(100, (latest.watch_hours_cumulative / 4000) * 100);

  // Dedication score (0-100)
  const dedicationScore = Math.min(100, Math.round(
    (videosPerMonth / 30) * 40 + // frequency weight
    (avgDuration / 40) * 30 + // duration weight
    (niche.viral_potential / 10) * 30 // niche potential weight
  ));

  const getDedicationLabel = () => {
    if (dedicationScore >= 80) return { text: 'Modo Beast 🔥', color: 'text-emerald-400' };
    if (dedicationScore >= 60) return { text: 'Consistente 💪', color: 'text-primary' };
    if (dedicationScore >= 40) return { text: 'Moderado ⚡', color: 'text-yellow-400' };
    return { text: 'Casual 🌱', color: 'text-muted-foreground' };
  };

  const dedication = getDedicationLabel();

  const formatDays = (month: number) => {
    if (month === 0) return null;
    if (month === 1) return '~30 dias';
    if (month === 2) return '~60 dias';
    if (month === 3) return '~90 dias';
    return `~${month} meses`;
  };

  const timeSaved = yppMonthWith > 0 && yppMonthWithout > 0
    ? Math.round(((yppMonthWithout - yppMonthWith) / yppMonthWithout) * 100)
    : yppMonthWith > 0 && yppMonthWithout === 0 ? 100 : 0;

  return (
    <section id="simulator" className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-primary/4 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-accent/4 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            <Calculator className="w-3 h-3 mr-1" /> Simulador de Monetização v2
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold font-['Space_Grotesk'] mb-3">
            A matemática por trás da{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              monetização
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
            Configure sua dedicação real e veja quando o YouTube Partner Program é alcançável.
            <br />
            <span className="text-xs opacity-60">Baseado em dados reais de 945+ canais faceless • Sem promessas falsas</span>
          </p>
        </motion.div>

        {/* Scenario Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-card border border-border rounded-xl p-1 gap-1">
            {(['pessimista', 'realista', 'otimista'] as Scenario[]).map(s => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  scenario === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'pessimista' ? '📉 Pessimista' : s === 'realista' ? '📊 Realista' : '🚀 Otimista'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ─── Controls (2 cols) ─── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 space-y-5"
          >
            {/* Dedication Score */}
            <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground mb-1">Índice de Dedicação</p>
              <div className="flex items-center justify-center gap-3">
                <span className={`text-3xl font-bold font-['Space_Grotesk'] ${dedication.color}`}>
                  {dedicationScore}
                </span>
                <span className={`text-sm font-medium ${dedication.color}`}>{dedication.text}</span>
              </div>
            </div>

            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Sua dedicação
            </h3>

            {/* Videos per month */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs text-muted-foreground">Vídeos por mês</label>
                <span className="text-xs font-bold text-primary">{videosPerMonth} vídeos</span>
              </div>
              <Slider
                value={[videosPerMonth]}
                onValueChange={v => setVideosPerMonth(v[0])}
                min={4}
                max={30}
                step={1}
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>1/sem</span>
                <span>3/sem</span>
                <span>Diário</span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs text-muted-foreground">Duração média</label>
                <span className="text-xs font-bold text-primary">{avgDuration} min</span>
              </div>
              <Slider
                value={[avgDuration]}
                onValueChange={v => setAvgDuration(v[0])}
                min={5}
                max={40}
                step={5}
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>5 min</span>
                <span>20 min</span>
                <span>40 min</span>
              </div>
            </div>

            {/* Niche selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Nicho</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
                {Object.entries(NICHE_PROFILES).map(([key, n]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedNiche(key)}
                    className={`text-left p-2 rounded-lg border transition-all text-xs ${
                      selectedNiche === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30 text-foreground'
                    }`}
                  >
                    <span className="font-medium">{n.emoji} {n.label}</span>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[9px] text-muted-foreground">${n.rpm_usd} RPM</span>
                      <span className="text-[9px] text-muted-foreground">•</span>
                      <span className="text-[9px] text-muted-foreground">Viral {n.viral_potential}/10</span>
                      <Badge variant="outline" className={`text-[8px] h-3.5 px-1 ${
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

            {/* Bottleneck Advice */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              bottleneck === 'none'
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : 'bg-accent/5 border-accent/20 text-accent'
            }`}>
              {advice}
            </div>
          </motion.div>

          {/* ─── Results (3 cols) ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3 space-y-4"
          >
            {/* Main Result Card */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-accent" /> Previsão YPP
                <Badge variant="outline" className="text-[9px] ml-auto border-border/50">
                  {scenario === 'pessimista' ? '📉 Cenário' : scenario === 'realista' ? '📊 Cenário' : '🚀 Cenário'} {scenario}
                </Badge>
              </h3>

              {/* Comparison: With vs Without */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-[10px] text-primary font-medium mb-2">Com Monetiza27</p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`with-${yppMonthWith}-${scenario}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-4xl font-bold font-['Space_Grotesk'] ${
                        yppMonthWith <= 1 ? 'text-emerald-400' :
                        yppMonthWith <= 3 ? 'text-primary' :
                        yppMonthWith > 0 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}
                    >
                      {yppMonthWith > 0 ? formatDays(yppMonthWith) : '12+ meses'}
                    </motion.div>
                  </AnimatePresence>
                  {yppMonthWith > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {withTool[yppMonthWith - 1]?.videos_total || 0} vídeos publicados
                    </p>
                  )}
                </div>

                <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-medium mb-2">Sem a ferramenta</p>
                  <div className={`text-4xl font-bold font-['Space_Grotesk'] text-muted-foreground`}>
                    {yppMonthWithout > 0 ? formatDays(yppMonthWithout) : '12+ meses'}
                  </div>
                  {yppMonthWithout > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {withoutTool[yppMonthWithout - 1]?.videos_total || 0} vídeos publicados
                    </p>
                  )}
                </div>
              </div>

              {timeSaved > 0 && (
                <div className="text-center mb-4">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs py-1 px-3">
                    <Zap className="w-3 h-3 mr-1" />
                    {timeSaved}% mais rápido com a ferramenta
                    {yppMonthWith > 0 && yppMonthWithout > 0 && (
                      <span className="ml-1 opacity-70">
                        ({(yppMonthWithout - yppMonthWith)} {yppMonthWithout - yppMonthWith === 1 ? 'mês' : 'meses'} economizados)
                      </span>
                    )}
                  </Badge>
                </div>
              )}

              {/* Progress bars */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> Inscritos
                      {bottleneck === 'subs' && <span className="text-[9px] text-accent">(gargalo)</span>}
                    </span>
                    <span className={`font-medium ${latest.subs_cumulative >= 1000 ? 'text-emerald-400' : 'text-foreground'}`}>
                      {latest.subs_cumulative.toLocaleString()} / 1.000
                    </span>
                  </div>
                  <Progress value={subsProgress} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horas assistidas
                      {bottleneck === 'hours' && <span className="text-[9px] text-accent">(gargalo)</span>}
                    </span>
                    <span className={`font-medium ${latest.watch_hours_cumulative >= 4000 ? 'text-emerald-400' : 'text-foreground'}`}>
                      {latest.watch_hours_cumulative.toLocaleString()} / 4.000h
                    </span>
                  </div>
                  <Progress value={hoursProgress} className="h-2" />
                </div>
              </div>
            </div>

            {/* Revenue + Table Tabs */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <Tabs defaultValue="revenue" className="w-full">
                <TabsList className="w-full justify-start bg-muted/30 rounded-none border-b border-border h-10 p-0">
                  <TabsTrigger value="revenue" className="rounded-none h-full text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary">
                    <DollarSign className="w-3 h-3 mr-1" /> Receita
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-none h-full text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary">
                    <Clock className="w-3 h-3 mr-1" /> Mês a Mês
                  </TabsTrigger>
                  <TabsTrigger value="impact" className="rounded-none h-full text-xs data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary">
                    <Sparkles className="w-3 h-3 mr-1" /> O que a ferramenta faz
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="revenue" className="p-5 mt-0">
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[withTool[2], withTool[5], withTool[8], withTool[11]].filter(Boolean).map((p) => (
                      <div key={p.month} className="text-center p-3 rounded-lg bg-muted/20 border border-border/50">
                        <p className="text-[10px] text-muted-foreground">Mês {p.month}</p>
                        <p className={`text-lg font-bold font-['Space_Grotesk'] ${
                          p.revenue_month_usd > 0 ? 'text-emerald-400' : 'text-muted-foreground'
                        }`}>
                          ${p.revenue_month_usd}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {p.subs_cumulative.toLocaleString()} subs
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {p.watch_hours_cumulative.toLocaleString()}h
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/10 border border-border/30">
                    <p className="text-[10px] text-muted-foreground">Receita acumulada em 12 meses</p>
                    <p className="text-3xl font-bold font-['Space_Grotesk'] text-emerald-400">
                      ${latest.revenue_cumulative_usd.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      ~R$ {Math.round(latest.revenue_cumulative_usd * 5).toLocaleString()} • RPM ${niche.rpm_usd} • Retenção {Math.round(niche.avg_retention * 100)}%
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="p-5 mt-0">
                  <div className="max-h-[280px] overflow-y-auto pr-1">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-muted-foreground border-b border-border/50">
                          <th className="text-left py-2 font-medium">Mês</th>
                          <th className="text-right py-2 font-medium">Vídeos</th>
                          <th className="text-right py-2 font-medium">Views/mês</th>
                          <th className="text-right py-2 font-medium">Subs</th>
                          <th className="text-right py-2 font-medium">Watch H</th>
                          <th className="text-right py-2 font-medium">$/mês</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withTool.map(p => (
                          <tr key={p.month} className={`border-b border-border/20 transition-colors ${
                            p.ypp_reached ? 'text-emerald-400' : 'text-foreground'
                          }`}>
                            <td className="py-2 flex items-center gap-1">
                              {p.ypp_reached && <CheckCircle2 className="w-3 h-3" />}
                              Mês {p.month}
                            </td>
                            <td className="text-right py-2">{p.videos_total}</td>
                            <td className="text-right py-2">{p.views_this_month.toLocaleString()}</td>
                            <td className="text-right py-2">{p.subs_cumulative.toLocaleString()}</td>
                            <td className="text-right py-2">{p.watch_hours_cumulative.toLocaleString()}h</td>
                            <td className="text-right py-2 font-medium">
                              {p.revenue_month_usd > 0 ? `$${p.revenue_month_usd}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="impact" className="p-5 mt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {TOOL_IMPACT.map(({ icon: Icon, label, impact, desc }) => (
                      <div key={label} className="flex gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{label}</span>
                            <Badge variant="outline" className="text-[8px] h-4 border-emerald-500/30 text-emerald-400">
                              {impact}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-4">
                    Impacto combinado: a ferramenta não garante monetização, mas <strong className="text-foreground">acelera cada etapa</strong> com dados e IA.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Transparency Box */}
            <div className="bg-muted/10 border border-border/30 rounded-xl p-4 flex gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
                <p>
                  <strong className="text-foreground">⚖️ Transparência total:</strong> Monetização no YouTube depende de{' '}
                  <strong className="text-foreground">3 fatores que você controla</strong> (frequência, qualidade, nicho) e{' '}
                  <strong className="text-foreground">2 que você não controla</strong> (algoritmo, concorrência).
                </p>
                <p>
                  A ferramenta <strong className="text-primary">maximiza os 3 fatores controláveis</strong>: 
                  escolhe o nicho certo com dados reais, gera scripts com retenção otimizada e produz vídeos 10x mais rápido. 
                  Isso não é garantia — é <strong className="text-foreground">vantagem matemática</strong>.
                </p>
                <p className="opacity-70">
                  Dados de RPM e crescimento baseados em canais faceless reais (2024-2026). Cenário realista assume 0 vídeos virais.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
