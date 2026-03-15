import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, TrendingUp, Eye, Clock, AlertTriangle, CheckCircle2, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrustMetrics {
  lov: number; // Length of Video (seconds)
  avd: number; // Average View Duration (seconds)
  swipeRatio: number; // % who stay (not swipe away)
  totalViews: number;
  engagedViews: number;
  subscribers: number;
  casualViewerPct: number;
  regularViewerPct: number;
}

interface ScoreResult {
  trustScore: number;
  retention: number;
  cvRvRating: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  recommendations: string[];
  monetizationReady: boolean;
  engagedViewPct: number;
  snowballMultiplier: number;
  daysToMonetize: string;
  viewsProgress: number;
  estimatedEngagedViews: number;
}

const calculateScore = (m: TrustMetrics): ScoreResult => {
  const retention = m.lov > 0 ? (m.avd / m.lov) * 100 : 0;
  const cvRvRating = m.casualViewerPct + m.regularViewerPct;
  const engagedViewPct = m.totalViews > 0 ? (m.engagedViews / m.totalViews) * 100 : 50;

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Scoring components (0-100 each)
  let retentionScore = Math.min(retention, 150) / 1.5; // 100% retention = 66, 150%+ = 100
  let swipeScore = Math.min(m.swipeRatio / 81.1, 1) * 100;
  let cvRvScore = Math.min(cvRvRating / 55, 1) * 100;
  let lovScore = m.lov >= 28 && m.lov <= 36 ? 100 : m.lov >= 20 && m.lov <= 45 ? 70 : 40;

  // Issues detection
  if (retention < 100) {
    issues.push(`Retenção em ${retention.toFixed(0)}% — precisa estar acima de 100%`);
    recommendations.push('Reduza a duração do vídeo para ~32s ou melhore o conteúdo para gerar rewatches');
  }
  if (m.swipeRatio < 81.1) {
    issues.push(`Swipe ratio em ${m.swipeRatio.toFixed(1)}% — meta: 81.1%+`);
    recommendations.push('Melhore os primeiros 0.5s do vídeo — use hooks visuais mais impactantes');
  }
  if (cvRvRating < 55) {
    issues.push(`CV+RV em ${cvRvRating.toFixed(0)}% — meta: 55%+`);
    recommendations.push('Implemente o método 2CTA: Visual CTA sutil + Audio CTA com tensão emocional');
  }
  if (m.lov < 28 || m.lov > 36) {
    issues.push(`Duração em ${m.lov}s — sweet spot: 32s`);
    recommendations.push('Ajuste para 32 segundos — é o LOV ideal para maximizar retenção em shorts');
  }
  
  // Snowball effect estimation
  const snowballMultiplier = cvRvRating >= 55 && retention >= 100 && m.swipeRatio >= 81.1 ? 3.5 : 
    cvRvRating >= 45 && retention >= 80 ? 2.0 : 
    cvRvRating >= 35 ? 1.3 : 1.0;
  
  // Monetization timeline estimation
  const daysToMonetize = snowballMultiplier >= 3 ? '15-30 dias' : 
    snowballMultiplier >= 2 ? '30-60 dias' : 
    snowballMultiplier >= 1.3 ? '60-90 dias' : '90+ dias';

  // Engaged views estimation (50% rule)
  const estimatedEngagedViews = Math.round(m.totalViews * 0.5);
  const engagedViewsNeeded = 10_000_000;
  const viewsProgress = Math.min((estimatedEngagedViews / engagedViewsNeeded) * 100, 100);

  if (cvRvRating >= 55) {
    recommendations.push('✅ CV+RV saudável! Efeito snowball ativo — multiplicador de ' + snowballMultiplier.toFixed(1) + 'x');
  }
  if (retention >= 100) {
    recommendations.push('✅ Retenção excelente! Seus vídeos estão gerando rewatches');
  }
  if (snowballMultiplier < 2) {
    issues.push(`Snowball fraco (${snowballMultiplier.toFixed(1)}x) — monetização estimada: ${daysToMonetize}`);
    recommendations.push(`Otimize Trust Score para ativar o efeito snowball (crescimento exponencial vs linear)`);
  } else {
    recommendations.push(`🚀 Snowball ativo! Multiplicador ${snowballMultiplier.toFixed(1)}x — monetização estimada: ${daysToMonetize}`);
  }

  const trustScore = (retentionScore * 0.35) + (swipeScore * 0.3) + (cvRvScore * 0.2) + (lovScore * 0.15);

  const grade: ScoreResult['grade'] = trustScore >= 90 ? 'S' : trustScore >= 75 ? 'A' : trustScore >= 60 ? 'B' : trustScore >= 45 ? 'C' : trustScore >= 30 ? 'D' : 'F';

  const monetizationReady = m.engagedViews >= 10_000_000 && m.subscribers >= 1000;

  return { trustScore, retention, cvRvRating, grade, issues, recommendations, monetizationReady, engagedViewPct, snowballMultiplier, daysToMonetize, viewsProgress, estimatedEngagedViews };
};

const gradeColors: Record<string, string> = {
  S: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  D: 'bg-red-500/20 text-red-400 border-red-500/30',
  F: 'bg-red-700/20 text-red-500 border-red-700/30',
};

export const TrustScoreCalculator = () => {
  const [metrics, setMetrics] = useState<TrustMetrics>({
    lov: 32, avd: 35, swipeRatio: 82, totalViews: 500000,
    engagedViews: 250000, subscribers: 500, casualViewerPct: 45, regularViewerPct: 5,
  });
  const [result, setResult] = useState<ScoreResult | null>(null);

  const update = (key: keyof TrustMetrics, val: string) => {
    setMetrics(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  };

  const calc = () => setResult(calculateScore(metrics));

  const fields: { key: keyof TrustMetrics; label: string; icon: any; suffix: string; hint: string }[] = [
    { key: 'lov', label: 'Duração do Vídeo (LOV)', icon: Clock, suffix: 's', hint: 'Meta: 32s' },
    { key: 'avd', label: 'Duração Média (AVD)', icon: Eye, suffix: 's', hint: 'Deve ser > LOV' },
    { key: 'swipeRatio', label: 'Swipe-Through Ratio', icon: Target, suffix: '%', hint: 'Meta: 81.1%+' },
    { key: 'totalViews', label: 'Views Totais', icon: TrendingUp, suffix: '', hint: '' },
    { key: 'engagedViews', label: 'Views Engajadas', icon: Zap, suffix: '', hint: '~50% do total' },
    { key: 'subscribers', label: 'Inscritos', icon: Shield, suffix: '', hint: 'Meta: 1.000+' },
    { key: 'casualViewerPct', label: 'Casual Viewers (CV)', icon: Eye, suffix: '%', hint: '' },
    { key: 'regularViewerPct', label: 'Regular Viewers (RV)', icon: Eye, suffix: '%', hint: 'CV+RV ≥ 55%' },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            Trust Score Calculator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Calcule o Trust Score do seu canal baseado nas métricas de Shorts. Fórmula baseada no método de canais que monetizam em 15-30 dias.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <f.icon className="w-3 h-3" /> {f.label}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={metrics[f.key]}
                    onChange={e => update(f.key, e.target.value)}
                    className="bg-secondary border-border text-foreground pr-8"
                  />
                  {f.suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{f.suffix}</span>
                  )}
                </div>
                {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
          <Button onClick={calc} className="mt-6 w-full bg-primary hover:bg-primary/90">
            <Shield className="w-4 h-4 mr-2" /> Calcular Trust Score
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Score Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border bg-card col-span-1">
                <CardContent className="pt-6 text-center">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl text-3xl font-bold border-2 ${gradeColors[result.grade]}`}>
                    {result.grade}
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-2">{result.trustScore.toFixed(0)}/100</p>
                  <p className="text-xs text-muted-foreground">Trust Score</p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-1">Retenção</p>
                  <p className={`text-2xl font-bold ${result.retention >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                    {result.retention.toFixed(0)}%
                  </p>
                  <Progress value={Math.min(result.retention, 150) / 1.5} className="mt-2 h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">Meta: ≥100% (rewatches)</p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-1">CV + RV Rating</p>
                  <p className={`text-2xl font-bold ${result.cvRvRating >= 55 ? 'text-green-400' : 'text-orange-400'}`}>
                    {result.cvRvRating.toFixed(0)}%
                  </p>
                  <Progress value={Math.min(result.cvRvRating / 55 * 100, 100)} className="mt-2 h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">Meta: ≥55%</p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-1">Monetização</p>
                  {result.monetizationReady ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-lg font-bold">Pronto!</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Views engajadas: {(result.estimatedEngagedViews / 1_000_000).toFixed(1)}M / 10M
                      </p>
                      <Progress value={result.viewsProgress} className="h-1.5" />
                      <p className="text-sm text-muted-foreground">
                        Inscritos: {metrics.subscribers.toLocaleString()} / 1.000
                      </p>
                      <Progress value={Math.min(metrics.subscribers / 1000 * 100, 100)} className="h-1.5" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Snowball Effect Card */}
            <Card className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Efeito Snowball
                    </p>
                    <p className="text-xs text-muted-foreground">Crescimento exponencial vs linear</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${result.snowballMultiplier >= 3 ? 'text-green-400' : result.snowballMultiplier >= 2 ? 'text-primary' : 'text-orange-400'}`}>
                      {result.snowballMultiplier.toFixed(1)}x
                    </p>
                    <p className="text-xs text-muted-foreground">multiplicador</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border text-center">
                    <p className="text-lg font-bold text-foreground">{result.daysToMonetize}</p>
                    <p className="text-[10px] text-muted-foreground">Monetização estimada</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border text-center">
                    <p className="text-lg font-bold text-foreground">{result.engagedViewPct.toFixed(0)}%</p>
                    <p className="text-[10px] text-muted-foreground">Views engajadas</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border text-center">
                    <p className="text-lg font-bold text-foreground">{Math.round(20_000_000 / result.snowballMultiplier).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Views necessárias</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Issues & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.issues.length > 0 && (
                <Card className="border-destructive/30 bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" /> Problemas Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.issues.map((issue, i) => (
                      <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-destructive mt-0.5">•</span> {issue}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="border-primary/30 bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-primary">
                    <Zap className="w-4 h-4" /> Recomendações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">→</span> {rec}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 2CTA Method Card */}
            <Card className="border-accent/30 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-accent">
                  <Target className="w-4 h-4" /> Método 2CTA — Maximize Inscritos sem Perder Retenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-xs font-semibold text-foreground mb-1">🎯 CTA 1 — Visual (VCTA)</p>
                    <p className="text-xs text-muted-foreground">
                      Sutil, integrado à cena. Ex: personagem segurando placa "Subscribe", texto no cenário do vídeo. <strong>NÃO peça verbalmente</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-xs font-semibold text-foreground mb-1">🎤 CTA 2 — Visual + Áudio (VACTA)</p>
                    <p className="text-xs text-muted-foreground">
                      No momento de maior tensão: "Subscribe se acha que ele vai sobreviver!" Integre com a narrativa. <strong>Nunca pare o vídeo</strong>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
