import { useState } from 'react';
import { motion } from 'framer-motion';
import { GitCompareArrows, Loader2, FileText, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComparisonResult {
  scriptA: { hookScore: number; retentionScore: number; emotionScore: number; pacingScore: number; totalScore: number; strengths: string[]; weaknesses: string[] };
  scriptB: { hookScore: number; retentionScore: number; emotionScore: number; pacingScore: number; totalScore: number; strengths: string[]; weaknesses: string[] };
  winner: 'A' | 'B' | 'tie';
  analysis: string;
  improvementTips: string[];
}

export const ScriptComparator = () => {
  const [scriptA, setScriptA] = useState('');
  const [scriptB, setScriptB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const compare = async () => {
    if (scriptA.trim().length < 100 || scriptB.trim().length < 100) {
      return toast.error('Cada roteiro deve ter pelo menos 100 caracteres');
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('score-script', {
        body: { type: 'compare', scriptA: scriptA.slice(0, 5000), scriptB: scriptB.slice(0, 5000) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.comparison || data);
    } catch (err: any) {
      toast.error(err.message || 'Erro na comparação');
    } finally {
      setLoading(false);
    }
  };

  const MetricBar = ({ label, valueA, valueB }: { label: string; valueA: number; valueB: number }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{valueA} vs {valueB}</span>
      </div>
      <div className="flex gap-1">
        <Progress value={valueA * 10} className="h-1.5 flex-1" />
        <Progress value={valueB * 10} className="h-1.5 flex-1" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GitCompareArrows className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Comparador de Roteiros</h3>
        <Badge variant="outline" className="text-[9px]">Antes vs Depois</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Roteiro A (seu / original)</label>
          <Textarea placeholder="Cole seu roteiro aqui..." value={scriptA}
            onChange={e => setScriptA(e.target.value)} rows={8} className="bg-secondary/50 text-xs" />
          <p className="text-[9px] text-muted-foreground mt-1">{scriptA.length} caracteres</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Roteiro B (concorrente / revisado)</label>
          <Textarea placeholder="Cole o roteiro de referência..." value={scriptB}
            onChange={e => setScriptB(e.target.value)} rows={8} className="bg-secondary/50 text-xs" />
          <p className="text-[9px] text-muted-foreground mt-1">{scriptB.length} caracteres</p>
        </div>
      </div>

      <Button onClick={compare} disabled={loading} className="gradient-hero border-0 gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
        {loading ? 'Comparando com IA...' : 'Comparar Roteiros'}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Winner */}
          <div className="glass rounded-xl p-4 text-center">
            <Trophy className={`w-6 h-6 mx-auto mb-2 ${result.winner === 'A' ? 'text-chart-2' : result.winner === 'B' ? 'text-chart-3' : 'text-muted-foreground'}`} />
            <p className="text-sm font-semibold">
              {result.winner === 'tie' ? 'Empate técnico' : `Roteiro ${result.winner} vence!`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {result.scriptA.totalScore}/100 vs {result.scriptB.totalScore}/100
            </p>
          </div>

          {/* Metrics comparison */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
              <span>Roteiro A</span>
              <span>Métricas</span>
              <span>Roteiro B</span>
            </div>
            <MetricBar label="Hook/Abertura" valueA={result.scriptA.hookScore} valueB={result.scriptB.hookScore} />
            <MetricBar label="Retenção" valueA={result.scriptA.retentionScore} valueB={result.scriptB.retentionScore} />
            <MetricBar label="Emoção" valueA={result.scriptA.emotionScore} valueB={result.scriptB.emotionScore} />
            <MetricBar label="Ritmo" valueA={result.scriptA.pacingScore} valueB={result.scriptB.pacingScore} />
          </div>

          {/* Strengths/Weaknesses */}
          <div className="grid sm:grid-cols-2 gap-4">
            {(['A', 'B'] as const).map(side => {
              const data = side === 'A' ? result.scriptA : result.scriptB;
              const isWinner = result.winner === side;
              return (
                <div key={side} className={`glass rounded-xl p-4 ${isWinner ? 'border-chart-2/30' : ''}`}>
                  <p className="text-xs font-semibold mb-2">Roteiro {side} {isWinner && '🏆'}</p>
                  <div className="space-y-2">
                    {data.strengths.length > 0 && (
                      <div>
                        <p className="text-[9px] text-chart-2 font-semibold mb-1">✅ Pontos Fortes</p>
                        {data.strengths.map((s, i) => <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>)}
                      </div>
                    )}
                    {data.weaknesses.length > 0 && (
                      <div>
                        <p className="text-[9px] text-destructive font-semibold mb-1">⚠️ Melhorias</p>
                        {data.weaknesses.map((w, i) => <p key={i} className="text-[10px] text-muted-foreground">• {w}</p>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analysis */}
          <div className="glass rounded-xl p-4">
            <p className="text-xs font-semibold mb-1">📝 Análise Detalhada</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{result.analysis}</p>
          </div>

          {result.improvementTips?.length > 0 && (
            <div className="glass rounded-xl p-4 border border-primary/20">
              <p className="text-xs font-semibold mb-2 text-primary">💡 Dicas de Melhoria</p>
              {result.improvementTips.map((tip, i) => (
                <p key={i} className="text-[10px] text-muted-foreground mb-1">• {tip}</p>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
