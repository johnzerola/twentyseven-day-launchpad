import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, TrendingDown, Target, BarChart3, AlertTriangle } from 'lucide-react';

interface PredictionResult {
  id: string;
  video_id: string;
  predicted_viral_score: number;
  real_views: number;
  real_likes: number;
  prediction_error_score: number;
  error_breakdown: any;
  niche: string;
  created_at: string;
}

interface CalibrationData {
  niche: string;
  weight_adjustment: number;
  bias_correction: number;
  confidence: number;
  samples_count: number;
  avg_error: number;
}

export function PredictionVsReality() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [calibration, setCalibration] = useState<CalibrationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [predRes, calRes] = await Promise.all([
      supabase.from('prediction_vs_result')
        .select('*')
        .gt('real_views', 0)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('score_calibration')
        .select('*')
        .order('samples_count', { ascending: false })
        .limit(10),
    ]);

    setPredictions((predRes.data as any[]) || []);
    setCalibration((calRes.data as any[]) || []);
    setLoading(false);
  };

  const formatViews = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const avgError = predictions.length > 0
    ? Math.round(predictions.reduce((sum, p) => sum + (p.prediction_error_score || 0), 0) / predictions.length)
    : 0;

  const overPredictions = predictions.filter(p => p.error_breakdown?.direction === 'over').length;
  const underPredictions = predictions.filter(p => p.error_breakdown?.direction === 'under').length;

  if (loading) return null;

  if (predictions.length === 0 && calibration.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-8 text-center">
          <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Sem dados de comparação ainda</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Publique vídeos e adicione ao tracking para o sistema começar a se calibrar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Truth Layer Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <p className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Camada de Verdade
        </p>
        <p className="text-[9px] text-muted-foreground mt-1">
          Scores preditivos são <strong>estimativas de IA</strong> baseadas em padrões observados.
          Resultados reais vêm do YouTube Analytics via OAuth.
          A calibração melhora com mais dados reais — publique e sincronize para refinar as previsões.
        </p>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-[8px] gap-1">🤖 Estimado por IA: {predictions.length > 0 ? `${predictions.length} comparações` : 'sem dados ainda'}</Badge>
          <Badge variant="outline" className="text-[8px] gap-1">📊 Calibrado: {calibration.filter(c => c.samples_count >= 5).length} nichos</Badge>
          <Badge variant="outline" className="text-[8px] gap-1">🎯 Erro médio: {avgError > 0 ? `${avgError}pts` : 'N/A'}</Badge>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{predictions.length}</p>
            <p className="text-[10px] text-muted-foreground">Comparações</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${avgError <= 15 ? 'text-emerald-400' : avgError <= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
              {avgError}
            </p>
            <p className="text-[10px] text-muted-foreground">Erro Médio</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              {overPredictions > underPredictions ? (
                <TrendingDown className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              )}
              <p className="text-sm font-bold">
                {overPredictions > underPredictions ? 'Superestima' : 'Subestima'}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">Tendência</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Comparisons */}
      {predictions.slice(0, 5).map(p => (
        <Card key={p.id} className="border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-[10px]">{p.niche || 'geral'}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Previsto <span className="opacity-60">(est. IA)</span></p>
                <p className="text-lg font-bold text-primary">{p.predicted_viral_score}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Real <span className="opacity-60">(dado real)</span></p>
                <p className="text-lg font-bold">{formatViews(p.real_views)} views</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px]">Erro:</span>
              <Progress value={100 - Math.min(100, p.prediction_error_score)} className="h-1.5 flex-1" />
              <span className={`text-[10px] font-medium ${
                p.prediction_error_score <= 15 ? 'text-emerald-400' : 
                p.prediction_error_score <= 30 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {p.prediction_error_score}pts
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Calibration Status */}
      {calibration.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Calibração por Nicho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {calibration.map(c => (
              <div key={c.niche} className="flex items-center justify-between text-xs">
                <span className="font-medium">{c.niche}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{c.samples_count} amostras</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    c.avg_error <= 15 ? 'border-emerald-500/30 text-emerald-400' :
                    c.avg_error <= 30 ? 'border-yellow-500/30 text-yellow-400' :
                    'border-red-500/30 text-red-400'
                  }`}>
                    ±{c.avg_error}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
