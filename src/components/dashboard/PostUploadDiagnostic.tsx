import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Clock, TrendingUp, BarChart3, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface DiagnosticResult {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'SUCCESS';
  title: string;
  message: string;
  action: string;
}

interface Props {
  videoTitle?: string;
  niche?: string;
}

export function PostUploadDiagnostic({ videoTitle, niche }: Props) {
  const navigate = useNavigate();
  const [ctr, setCtr] = useState('');
  const [avgViewDuration, setAvgViewDuration] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [retention30s, setRetention30s] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const analyze = () => {
    const ctrNum = parseFloat(ctr);
    const avdNum = parseFloat(avgViewDuration);
    const totalNum = parseFloat(totalDuration);
    const ret30 = parseFloat(retention30s);
    const results: DiagnosticResult[] = [];

    if (!isNaN(ctrNum)) {
      if (ctrNum < 3.5) {
        results.push({
          severity: 'CRITICAL',
          title: '⚠️ Thumbnail/Título falhando',
          message: `CTR de ${ctrNum}% significa que o YouTube está pausando a distribuição. Troque o thumbnail AGORA — cada hora conta nas primeiras 48h.`,
          action: 'Gerar novos thumbnails',
        });
      } else if (ctrNum >= 5) {
        results.push({
          severity: 'SUCCESS',
          title: '🚀 CTR excelente!',
          message: `CTR de ${ctrNum}% está acima da média. YouTube está testando com audiências maiores.`,
          action: 'Criar próximo vídeo similar',
        });
      }
    }

    if (!isNaN(ret30)) {
      if (ret30 < 60) {
        results.push({
          severity: 'HIGH',
          title: '❌ Hook fraco',
          message: `${ret30}% das pessoas ficaram até 30 segundos. Isso sinaliza ao YouTube que a promessa do título/thumbnail não foi cumprida nos primeiros 30s.`,
          action: 'Reescrever hook do próximo roteiro',
        });
      }
    }

    if (!isNaN(avdNum) && !isNaN(totalNum) && totalNum > 0) {
      const retentionPct = (avdNum / totalNum) * 100;
      if (retentionPct < 40) {
        results.push({
          severity: 'MEDIUM',
          title: '📉 Retenção abaixo do limiar',
          message: `Retenção de ${retentionPct.toFixed(0)}% (média ${avdNum.toFixed(0)}s de ${totalNum.toFixed(0)}s). YouTube reduz distribuição para vídeos com retenção <40%.`,
          action: 'Melhorar pacing no próximo roteiro',
        });
      } else if (retentionPct >= 50) {
        results.push({
          severity: 'SUCCESS',
          title: '🎯 Retenção forte!',
          message: `Retenção de ${retentionPct.toFixed(0)}% está acima do limiar. O algoritmo favorece esse vídeo.`,
          action: 'Manter mesmo formato',
        });
      }
    }

    if (!isNaN(ctrNum) && ctrNum >= 5 && !isNaN(avdNum) && !isNaN(totalNum) && totalNum > 0) {
      const retPct = (avdNum / totalNum) * 100;
      if (retPct >= 50) {
        results.push({
          severity: 'SUCCESS',
          title: '🚀 Vídeo em distribuição ativa!',
          message: `CTR ${ctrNum}% + Retenção ${retPct.toFixed(0)}%. YouTube está empurrando para audiências maiores. Poste o próximo vídeo em 48h para manter o momentum.`,
          action: 'Gerar próximo vídeo',
        });
      }
    }

    if (results.length === 0) {
      results.push({
        severity: 'MEDIUM',
        title: '📊 Dados insuficientes',
        message: 'Preencha mais campos para um diagnóstico completo. Encontre esses dados no YouTube Studio > Analytics > Visão Geral.',
        action: 'Ver YouTube Studio',
      });
    }

    setDiagnostics(results);
    setAnalyzed(true);
  };

  const severityConfig = {
    CRITICAL: { bg: 'bg-destructive/10 border-destructive/30', icon: AlertTriangle, iconColor: 'text-destructive' },
    HIGH: { bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle, iconColor: 'text-orange-500' },
    MEDIUM: { bg: 'bg-accent/10 border-accent/30', icon: BarChart3, iconColor: 'text-accent' },
    SUCCESS: { bg: 'bg-chart-2/10 border-chart-2/30', icon: CheckCircle2, iconColor: 'text-chart-2' },
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Diagnóstico ao Vivo — 48h
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Cole os dados do YouTube Studio para diagnóstico em tempo real
        </p>
      </div>

      {/* Manual input fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">CTR (%)</label>
          <Input type="number" step="0.1" placeholder="Ex: 4.5" value={ctr} onChange={e => setCtr(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Retenção 30s (%)</label>
          <Input type="number" step="1" placeholder="Ex: 65" value={retention30s} onChange={e => setRetention30s(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">AVD — Duração média (seg)</label>
          <Input type="number" step="1" placeholder="Ex: 240" value={avgViewDuration} onChange={e => setAvgViewDuration(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Duração total (seg)</label>
          <Input type="number" step="1" placeholder="Ex: 600" value={totalDuration} onChange={e => setTotalDuration(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      <Button size="sm" onClick={analyze} className="w-full gap-2 text-xs">
        <Zap className="w-3.5 h-3.5" /> Diagnosticar Agora
      </Button>

      <p className="text-[9px] text-muted-foreground text-center">
        📍 Encontre esses dados em: YouTube Studio → Analytics → Visão Geral (após 24h do upload)
      </p>

      {/* Results */}
      <AnimatePresence>
        {analyzed && diagnostics.map((d, i) => {
          const config = severityConfig[d.severity];
          const Icon = config.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`border rounded-xl p-4 ${config.bg}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className="text-sm font-bold">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.message}</p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-[10px] gap-1"
                    onClick={() => navigate('/scripts')}>
                    {d.action} <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
