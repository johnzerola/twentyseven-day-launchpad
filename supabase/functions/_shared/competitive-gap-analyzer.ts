/**
 * COMPETITIVE GAP ANALYZER
 * 
 * Identifies gaps between a channel and top performers in the niche.
 * Used by: channel-intelligence, next-best-action, generate-ideas
 */

export interface CompetitiveGap {
  dimension: string;
  user_value: number | string;
  benchmark_value: number | string;
  gap_severity: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  estimated_impact: string;
}

export interface GapAnalysisResult {
  gaps: CompetitiveGap[];
  overall_competitive_score: number; // 0-100
  strongest_dimensions: string[];
  weakest_dimensions: string[];
  quick_wins: string[];
  strategic_moves: string[];
}

export function analyzeCompetitiveGaps(
  channelData: {
    avg_views: number;
    subscribers: number;
    upload_frequency_days: number;
    avg_engagement_rate: number;
    avg_retention?: number;
    avg_ctr?: number;
    short_ratio: number;
    long_ratio: number;
    outlier_ratio: number;
    niche: string;
  },
  benchmarks: {
    niche_avg_views: number;
    niche_avg_subs: number;
    niche_avg_upload_freq: number;
    niche_avg_engagement: number;
    niche_avg_retention?: number;
    niche_avg_ctr?: number;
    top_channel_views: number;
    top_channel_subs: number;
  },
  topPatterns: { pattern: string; avg_views: number; frequency: number }[] = []
): GapAnalysisResult {
  const gaps: CompetitiveGap[] = [];
  const scores: Record<string, number> = {};

  // 1. Views vs benchmark
  const viewsRatio = channelData.avg_views / Math.max(benchmarks.niche_avg_views, 1);
  scores['views'] = Math.min(100, viewsRatio * 100);
  if (viewsRatio < 0.5) {
    gaps.push({
      dimension: 'Views médias',
      user_value: channelData.avg_views,
      benchmark_value: benchmarks.niche_avg_views,
      gap_severity: viewsRatio < 0.2 ? 'critical' : 'high',
      action: `Aumentar views médias de ${fmt(channelData.avg_views)} para ${fmt(benchmarks.niche_avg_views)}`,
      estimated_impact: 'Duplicar alcance orgânico',
    });
  }

  // 2. Upload frequency
  const freqRatio = benchmarks.niche_avg_upload_freq / Math.max(channelData.upload_frequency_days, 0.5);
  scores['frequency'] = Math.min(100, freqRatio * 100);
  if (channelData.upload_frequency_days > benchmarks.niche_avg_upload_freq * 1.5) {
    gaps.push({
      dimension: 'Frequência de upload',
      user_value: `${channelData.upload_frequency_days.toFixed(1)} dias`,
      benchmark_value: `${benchmarks.niche_avg_upload_freq.toFixed(1)} dias`,
      gap_severity: channelData.upload_frequency_days > benchmarks.niche_avg_upload_freq * 3 ? 'critical' : 'medium',
      action: `Reduzir intervalo entre uploads para ${benchmarks.niche_avg_upload_freq.toFixed(0)} dias`,
      estimated_impact: '+30% impressões semanais',
    });
  }

  // 3. Engagement rate
  const engRatio = channelData.avg_engagement_rate / Math.max(benchmarks.niche_avg_engagement, 0.01);
  scores['engagement'] = Math.min(100, engRatio * 100);
  if (engRatio < 0.7) {
    gaps.push({
      dimension: 'Taxa de engajamento',
      user_value: `${(channelData.avg_engagement_rate * 100).toFixed(1)}%`,
      benchmark_value: `${(benchmarks.niche_avg_engagement * 100).toFixed(1)}%`,
      gap_severity: engRatio < 0.4 ? 'high' : 'medium',
      action: 'Melhorar CTAs, perguntas ao público e hooks de engajamento',
      estimated_impact: '+20% sugerido pelo algoritmo',
    });
  }

  // 4. Retention
  if (channelData.avg_retention && benchmarks.niche_avg_retention) {
    const retRatio = channelData.avg_retention / benchmarks.niche_avg_retention;
    scores['retention'] = Math.min(100, retRatio * 100);
    if (retRatio < 0.8) {
      gaps.push({
        dimension: 'Retenção média',
        user_value: `${channelData.avg_retention.toFixed(0)}%`,
        benchmark_value: `${benchmarks.niche_avg_retention.toFixed(0)}%`,
        gap_severity: retRatio < 0.6 ? 'critical' : 'high',
        action: 'Implementar pattern interrupts a cada 30s e hooks de retenção',
        estimated_impact: '+50% watch time → mais Browse traffic',
      });
    }
  }

  // 5. CTR
  if (channelData.avg_ctr && benchmarks.niche_avg_ctr) {
    const ctrRatio = channelData.avg_ctr / benchmarks.niche_avg_ctr;
    scores['ctr'] = Math.min(100, ctrRatio * 100);
    if (ctrRatio < 0.8) {
      gaps.push({
        dimension: 'CTR',
        user_value: `${channelData.avg_ctr.toFixed(1)}%`,
        benchmark_value: `${benchmarks.niche_avg_ctr.toFixed(1)}%`,
        gap_severity: ctrRatio < 0.5 ? 'critical' : 'high',
        action: 'A/B testar títulos com curiosity gap + thumbnails com 3 elementos',
        estimated_impact: '+100% impressões convertidas',
      });
    }
  }

  // 6. Outlier production
  if (channelData.outlier_ratio < 0.1) {
    scores['outliers'] = channelData.outlier_ratio * 500;
    gaps.push({
      dimension: 'Produção de outliers (>3x média)',
      user_value: `${(channelData.outlier_ratio * 100).toFixed(0)}%`,
      benchmark_value: '15-20%',
      gap_severity: channelData.outlier_ratio < 0.05 ? 'high' : 'medium',
      action: 'Focar em temas com potencial viral comprovado no nicho',
      estimated_impact: '1 outlier = 10 vídeos normais em crescimento',
    });
  }

  // 7. Format mix
  const idealShortRatio = 0.3; // Most niches benefit from 30% shorts
  if (channelData.short_ratio < 0.1 && channelData.subscribers < 10000) {
    gaps.push({
      dimension: 'Diversificação de formatos (Shorts)',
      user_value: `${(channelData.short_ratio * 100).toFixed(0)}% shorts`,
      benchmark_value: `${(idealShortRatio * 100).toFixed(0)}% shorts`,
      gap_severity: 'medium',
      action: 'Adicionar 2-3 Shorts/semana para ampliar descoberta',
      estimated_impact: '+40% novos inscritos via Shorts feed',
    });
  }

  // Calculate overall score
  const scoreValues = Object.values(scores);
  const overallScore = scoreValues.length > 0
    ? Math.round(scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length)
    : 50;

  // Sort dimensions
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const strongest = sorted.slice(0, 2).map(([k]) => k);
  const weakest = sorted.slice(-2).map(([k]) => k);

  // Quick wins (low effort, high impact)
  const quickWins: string[] = [];
  if (gaps.some(g => g.dimension.includes('CTR'))) quickWins.push('Reescrever títulos dos 5 vídeos mais vistos com curiosity gap');
  if (gaps.some(g => g.dimension.includes('engajamento'))) quickWins.push('Adicionar CTA de pergunta nos primeiros 30s');
  if (gaps.some(g => g.dimension.includes('frequência'))) quickWins.push('Criar batch de 3 vídeos num dia e agendar');
  if (gaps.some(g => g.dimension.includes('Shorts'))) quickWins.push('Cortar melhores momentos de longforms em Shorts');

  // Strategic moves (high effort, transformative)
  const strategicMoves: string[] = [];
  if (gaps.some(g => g.gap_severity === 'critical')) strategicMoves.push('Redefir formato principal baseado no que gera outliers');
  if (topPatterns.length > 0) {
    const unusedPattern = topPatterns[0];
    strategicMoves.push(`Adotar padrão "${unusedPattern.pattern}" (média ${fmt(unusedPattern.avg_views)} views no nicho)`);
  }
  strategicMoves.push('Vincular OAuth para calibração com dados reais de CTR/retenção');

  return {
    gaps: gaps.sort((a, b) => severityOrder(a.gap_severity) - severityOrder(b.gap_severity)),
    overall_competitive_score: overallScore,
    strongest_dimensions: strongest,
    weakest_dimensions: weakest,
    quick_wins: quickWins.slice(0, 5),
    strategic_moves: strategicMoves.slice(0, 3),
  };
}

function severityOrder(s: string): number {
  return s === 'critical' ? 0 : s === 'high' ? 1 : s === 'medium' ? 2 : 3;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
