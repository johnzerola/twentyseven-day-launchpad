import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Loader2, TrendingDown, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CurvePoint {
  second: number;
  label: string;
  attention: number;
}

interface DropOff {
  timestamp: string;
  from: number;
  to: number;
  drop: number;
  fix: string;
}

interface PredictedCurve {
  points: CurvePoint[];
  avgRetention: number;
  dropOffs: DropOff[];
  bestMoment: { second: number; label: string; attention: number };
  worstMoment: { second: number; label: string; attention: number };
}

interface ReferenceCurve {
  name: string;
  points: CurvePoint[];
  avgRetention: number;
}

interface RetentionCurveAnalyzerProps {
  script: string;
  topic: string;
  niche: string;
  style: string;
  duration: string;
  videoType: 'short' | 'long';
  language: string;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
};

export const RetentionCurveAnalyzer = ({ script, topic, niche, style, duration, videoType, language }: RetentionCurveAnalyzerProps) => {
  const [loading, setLoading] = useState(false);
  const [predicted, setPredicted] = useState<PredictedCurve | null>(null);
  const [references, setReferences] = useState<ReferenceCurve[]>([]);
  const [showRefs, setShowRefs] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  // Load reference curves on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('attention_curves')
        .select('curve_name, curve_data, avg_retention, video_type, niche')
        .order('avg_retention', { ascending: false });

      if (data?.length) {
        setReferences(data.map((c: any) => ({
          name: c.curve_name,
          points: (c.curve_data || []) as CurvePoint[],
          avgRetention: Math.round((c.avg_retention || 0) * 100),
        })));
      }
    })();
  }, []);

  const analyze = async () => {
    if (!script || script.length < 100) {
      toast.error('Roteiro precisa ter pelo menos 100 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Login necessário');

      const { data, error } = await supabase.functions.invoke('predict-retention', {
        body: {
          topic, niche, style, language, duration,
          videoType, script,
          returnCurve: true,
        },
      });

      if (error) throw error;

      if (data?.curve) {
        setPredicted(data.curve);
        setExpanded(true);
        toast.success('Curva de retenção gerada!');
      } else if (data?.prediction) {
        // Build curve from basic prediction (fallback)
        const durSec = videoType === 'short'
          ? parseInt(duration) || 45
          : (parseInt(duration) || 15) * 60;
        const p = data.prediction;
        const fallbackPoints: CurvePoint[] = [
          { second: 0, label: 'Início', attention: 1.0 },
          { second: 5, label: 'Hook', attention: (p.retention_prediction?.first_30s || 85) / 100 },
          { second: Math.round(durSec * 0.1), label: 'Setup', attention: (p.retention_prediction?.first_30s || 80) / 100 },
          { second: Math.round(durSec * 0.25), label: 'Contexto', attention: ((p.retention_prediction?.first_30s || 75) - 5) / 100 },
          { second: Math.round(durSec * 0.4), label: 'Desenvolvimento', attention: (p.retention_prediction?.mid_video || 60) / 100 },
          { second: Math.round(durSec * 0.5), label: 'Ponto Médio', attention: (p.retention_prediction?.mid_video || 58) / 100 },
          { second: Math.round(durSec * 0.65), label: 'Clímax Build', attention: ((p.retention_prediction?.mid_video || 55) + 5) / 100 },
          { second: Math.round(durSec * 0.8), label: 'Clímax', attention: ((p.retention_prediction?.last_30s || 55) + 10) / 100 },
          { second: Math.round(durSec * 0.9), label: 'Resolução', attention: (p.retention_prediction?.last_30s || 50) / 100 },
          { second: durSec, label: 'Fim', attention: ((p.retention_prediction?.last_30s || 45) - 5) / 100 },
        ];

        const avgRet = Math.round(fallbackPoints.reduce((s, p) => s + p.attention, 0) / fallbackPoints.length * 100);
        const sorted = [...fallbackPoints].sort((a, b) => a.attention - b.attention);

        setPredicted({
          points: fallbackPoints,
          avgRetention: avgRet,
          dropOffs: [],
          bestMoment: sorted[sorted.length - 1],
          worstMoment: sorted[0],
        });
        setExpanded(true);
        toast.success('Curva estimada a partir da predição básica');
      }
    } catch (e: any) {
      console.error('Retention curve error:', e);
      toast.error(e.message || 'Erro ao analisar retenção');
    } finally {
      setLoading(false);
    }
  };

  // Merge predicted + reference for chart
  const chartData = useMemo(() => {
    if (!predicted?.points?.length) return [];

    const refCurve = selectedRef ? references.find(r => r.name === selectedRef) : null;
    const maxSecond = Math.max(...predicted.points.map(p => p.second));

    return predicted.points.map(p => {
      const entry: any = {
        second: p.second,
        time: formatTime(p.second),
        label: p.label,
        retention: Math.round(p.attention * 100),
      };

      if (refCurve?.points?.length) {
        // Interpolate reference curve to match predicted timestamps
        const refMaxSec = Math.max(...refCurve.points.map(rp => rp.second));
        const normalizedSec = (p.second / maxSecond) * refMaxSec;
        let closest = refCurve.points[0];
        for (const rp of refCurve.points) {
          if (Math.abs(rp.second - normalizedSec) < Math.abs(closest.second - normalizedSec)) {
            closest = rp;
          }
        }
        entry.reference = Math.round(closest.attention * 100);
      }

      return entry;
    });
  }, [predicted, references, selectedRef]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-chart-2" />
          <span className="font-semibold text-sm">Curva de Retenção Estimada (IA)</span>
          {predicted && (
            <Badge variant="outline" className={`text-[10px] ${
              predicted.avgRetention >= 60 ? 'bg-chart-2/10 text-chart-2 border-chart-2/30' :
              predicted.avgRetention >= 40 ? 'bg-chart-4/10 text-chart-4 border-chart-4/30' :
              'bg-destructive/10 text-destructive border-destructive/30'
            }`}>
              {predicted.avgRetention}% média <span className="text-[8px] opacity-60">(est.)</span>
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">

              {/* Action bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={analyze} disabled={loading || !script || script.length < 100}
                  className="gap-2" size="sm">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  {loading ? 'Analisando...' : predicted ? 'Reanalisar' : 'Analisar Retenção'}
                </Button>

                {references.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-muted-foreground">Comparar com:</span>
                    {references.map(r => (
                      <Badge key={r.name} variant="outline"
                        className={`text-[9px] cursor-pointer transition-colors ${
                          selectedRef === r.name ? 'bg-chart-4/15 border-chart-4/40 text-chart-4' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedRef(selectedRef === r.name ? null : r.name)}>
                        {r.name.split(' ').slice(0, 2).join(' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Chart */}
              {predicted && chartData.length > 0 && (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={(value: number, name: string) => [
                          `${value}%`,
                          name === 'retention' ? 'Seu Roteiro' : 'Referência',
                        ]}
                        labelFormatter={(label, payload) => {
                          const point = payload?.[0]?.payload;
                          return point?.label ? `${label} — ${point.label}` : label;
                        }}
                      />
                      <ReferenceLine y={50} stroke="hsl(var(--destructive))" strokeDasharray="5 5" opacity={0.4} />
                      <ReferenceLine y={predicted.avgRetention} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" opacity={0.5} />

                      {selectedRef && (
                        <Area type="monotone" dataKey="reference" stroke="hsl(var(--chart-4))"
                          fill="url(#refGrad)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      )}
                      <Area type="monotone" dataKey="retention" stroke="hsl(var(--chart-2))"
                        fill="url(#retentionGrad)" strokeWidth={2.5}
                        dot={{ r: 3, fill: 'hsl(var(--chart-2))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: 'hsl(var(--chart-2))' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Metrics */}
              {predicted && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Retenção Média</p>
                    <p className={`text-xl font-bold ${
                      predicted.avgRetention >= 60 ? 'text-chart-2' : predicted.avgRetention >= 40 ? 'text-chart-4' : 'text-destructive'
                    }`}>{predicted.avgRetention}%</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Melhor Momento</p>
                    <p className="text-sm font-semibold text-chart-2">{formatTime(predicted.bestMoment.second)}</p>
                    <p className="text-[10px] text-muted-foreground">{predicted.bestMoment.label} ({Math.round(predicted.bestMoment.attention * 100)}%)</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Pior Momento</p>
                    <p className="text-sm font-semibold text-destructive">{formatTime(predicted.worstMoment.second)}</p>
                    <p className="text-[10px] text-muted-foreground">{predicted.worstMoment.label} ({Math.round(predicted.worstMoment.attention * 100)}%)</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Drop-offs</p>
                    <p className="text-xl font-bold text-chart-4">{predicted.dropOffs.length}</p>
                  </div>
                </div>
              )}

              {/* Drop-off Analysis */}
              {predicted?.dropOffs?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-chart-4" />
                    <p className="text-xs font-semibold text-chart-4">Pontos de Queda Detectados</p>
                  </div>
                  {predicted.dropOffs.map((d, i) => (
                    <div key={i} className="bg-chart-4/5 border border-chart-4/20 rounded-lg p-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-chart-4/15 flex items-center justify-center shrink-0">
                        <TrendingDown className="w-4 h-4 text-chart-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">
                          {d.timestamp} — queda de {d.from}% → {d.to}%
                          <Badge variant="outline" className="ml-2 text-[8px] border-chart-4/30 text-chart-4">-{d.drop}%</Badge>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">💡 {d.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!predicted && !loading && (
                <div className="text-center py-6 space-y-2">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-xs text-muted-foreground">
                    Gere um roteiro e clique em "Analisar Retenção" para ver a curva de atenção segundo a segundo.
                  </p>
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3" />
                    Comparação com {references.length} curvas de referência (Netflix, TikTok, MrBeast...)
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};