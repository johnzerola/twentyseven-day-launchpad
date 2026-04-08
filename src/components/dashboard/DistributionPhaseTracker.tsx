import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Clock, MousePointerClick, Timer, Rocket, AlertTriangle,
  CheckCircle2, TrendingUp, RefreshCw, ChevronRight, Zap, Shield, Target
} from 'lucide-react';

interface TrackedVideo {
  id: string;
  title: string;
  youtube_video_id: string;
  views_current: number;
  ctr_percent: number;
  avg_retention_percent: number;
  published_at: string | null;
  created_at: string;
  performance_grade: string;
  duration_seconds?: number;
}

type Phase = 'seed' | 'testing' | 'expanding' | 'viral' | 'archived';

interface VideoPhase {
  video: TrackedVideo;
  phase: Phase;
  hoursLive: number;
  ctrStatus: 'good' | 'warning' | 'critical';
  avdStatus: 'good' | 'warning' | 'critical';
  viewProgress: number; // 0-100 toward 1000
  recommendation: string;
  urgency: 'immediate' | 'soon' | 'monitor';
}

const PHASE_CONFIG: Record<Phase, { label: string; color: string; icon: any; desc: string }> = {
  seed: {
    label: '🌱 Semeando',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: Clock,
    desc: 'YouTube está mostrando para seus inscritos iniciais',
  },
  testing: {
    label: '🧪 Em Teste',
    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    icon: Target,
    desc: 'YouTube está medindo CTR e retenção com audiência teste',
  },
  expanding: {
    label: '🚀 Expandindo',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: TrendingUp,
    desc: 'Passando no teste! YouTube ampliando distribuição',
  },
  viral: {
    label: '🔥 Viral',
    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    icon: Rocket,
    desc: 'Distribuição massiva — o algoritmo está empurrando',
  },
  archived: {
    label: '📦 Arquivado',
    color: 'bg-muted text-muted-foreground border-border',
    icon: Shield,
    desc: 'Fase de teste encerrada — performance estabilizou',
  },
};

function classifyPhase(v: TrackedVideo): VideoPhase {
  const publishedAt = v.published_at ? new Date(v.published_at) : new Date(v.created_at);
  const hoursLive = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
  const views = v.views_current || 0;
  const ctr = v.ctr_percent || 0;
  const avd = v.avg_retention_percent || 0;

  const ctrStatus: 'good' | 'warning' | 'critical' =
    ctr >= 6 ? 'good' : ctr >= 4 ? 'warning' : 'critical';
  const avdStatus: 'good' | 'warning' | 'critical' =
    avd >= 50 ? 'good' : avd >= 40 ? 'warning' : 'critical';

  const viewProgress = Math.min(100, (views / 1000) * 100);

  let phase: Phase;
  let recommendation: string;
  let urgency: 'immediate' | 'soon' | 'monitor';

  if (views >= 10000) {
    phase = 'viral';
    recommendation = 'Seu vídeo entrou em distribuição massiva! Crie um vídeo SEQUÊNCIA agora para aproveitar o boost do algoritmo.';
    urgency = 'immediate';
  } else if (views >= 1000 && ctr >= 4 && avd >= 40) {
    phase = 'expanding';
    recommendation = 'Passando no teste! Responda TODOS os comentários nas próximas 2h para sinalizar engajamento ao algoritmo.';
    urgency = 'soon';
  } else if (hoursLive > 72 && views < 500) {
    phase = 'archived';
    if (ctr < 4) {
      recommendation = `CTR de ${ctr.toFixed(1)}% está abaixo de 4%. Troque o título e thumbnail AGORA — use cores e ângulo completamente diferentes. O vídeo ainda pode reviver.`;
      urgency = 'immediate';
    } else {
      recommendation = `Retenção de ${avd.toFixed(0)}% está fraca. Analise em qual segundo as pessoas saem e crie o próximo vídeo corrigindo esse ponto.`;
      urgency = 'soon';
    }
  } else if (hoursLive <= 2) {
    phase = 'seed';
    recommendation = 'Compartilhe em 2-3 comunidades relevantes (não spam!). Responda cada comentário imediatamente. Os primeiros 30 minutos são críticos.';
    urgency = 'immediate';
  } else {
    phase = 'testing';
    if (ctr < 4 && hoursLive > 24) {
      recommendation = `CTR de ${ctr.toFixed(1)}% está baixo. Prepare 2 variações de título mais amplas (menos nichadas) e 1 thumbnail com contraste radical. Troque no 3º dia.`;
      urgency = 'immediate';
    } else if (avd < 40 && hoursLive > 24) {
      recommendation = `Retenção de ${avd.toFixed(0)}% está abaixo do threshold de 40%. O YouTube está testando mas poucos ficam. Revise os primeiros 30 segundos do próximo vídeo.`;
      urgency = 'soon';
    } else if (ctr >= 4 && avd >= 40) {
      recommendation = 'Métricas saudáveis! Continue respondendo comentários e acompanhe. Se views estagnar em 48h, troque a embalagem.';
      urgency = 'monitor';
    } else {
      recommendation = 'Aguarde mais dados. O YouTube ainda está testando com audiência inicial. Foque em responder comentários.';
      urgency = 'monitor';
    }
  }

  return { video: v, phase, hoursLive, ctrStatus, avdStatus, viewProgress, recommendation, urgency };
}

const StatusDot = ({ status }: { status: 'good' | 'warning' | 'critical' }) => {
  const colors = {
    good: 'bg-emerald-400',
    warning: 'bg-yellow-400',
    critical: 'bg-red-400 animate-pulse',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
};

const MetricPill = ({ label, value, status, target }: {
  label: string; value: string; status: 'good' | 'warning' | 'critical'; target: string;
}) => (
  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
    <StatusDot status={status} />
    <div className="min-w-0">
      <div className="text-xs font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label} (meta: {target})</div>
    </div>
  </div>
);

function VideoPhaseCard({ data }: { data: VideoPhase }) {
  const { video, phase, hoursLive, ctrStatus, avdStatus, viewProgress, recommendation, urgency } = data;
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  const urgencyColors = {
    immediate: 'border-red-500/30 bg-red-500/5',
    soon: 'border-yellow-500/30 bg-yellow-500/5',
    monitor: 'border-border bg-transparent',
  };

  const hoursText = hoursLive < 1
    ? `${Math.round(hoursLive * 60)}min`
    : hoursLive < 48
      ? `${Math.round(hoursLive)}h`
      : `${Math.round(hoursLive / 24)}d`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-4 space-y-3 ${urgencyColors[urgency]}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{video.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-[10px] ${config.color}`}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Timer className="w-3 h-3" /> {hoursText} no ar
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-foreground">{(video.views_current || 0).toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">views</div>
        </div>
      </div>

      {/* Progress toward 1000 views */}
      {phase !== 'viral' && phase !== 'expanding' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Progresso para 1.000 views (threshold)</span>
            <span className="text-[10px] font-medium text-foreground">{Math.round(viewProgress)}%</span>
          </div>
          <Progress value={viewProgress} className="h-2" />
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricPill
          label="CTR"
          value={`${(video.ctr_percent || 0).toFixed(1)}%`}
          status={ctrStatus}
          target=">4%"
        />
        <MetricPill
          label="Retenção"
          value={`${(video.avg_retention_percent || 0).toFixed(0)}%`}
          status={avdStatus}
          target=">40%"
        />
      </div>

      {/* Recommendation */}
      <div className={`rounded-lg p-3 text-xs leading-relaxed ${
        urgency === 'immediate'
          ? 'bg-red-500/10 border border-red-500/20 text-foreground'
          : urgency === 'soon'
            ? 'bg-yellow-500/10 border border-yellow-500/20 text-foreground'
            : 'bg-muted/30 text-muted-foreground'
      }`}>
        <div className="flex items-start gap-2">
          {urgency === 'immediate' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          {urgency === 'soon' && <Zap className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />}
          {urgency === 'monitor' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          <p>{recommendation}</p>
        </div>
      </div>

      {/* Phase explanation */}
      <p className="text-[10px] text-muted-foreground italic">{config.desc}</p>
    </motion.div>
  );
}

export function DistributionPhaseTracker() {
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase
      .from('video_performance')
      .select('id, title, youtube_video_id, views_current, ctr_percent, avg_retention_percent, published_at, created_at, performance_grade, duration_seconds')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setVideos((data as TrackedVideo[]) || []);
    setLoading(false);
  };

  const phases = useMemo(() => {
    return videos.map(classifyPhase).sort((a, b) => {
      const order: Record<Phase, number> = { seed: 0, testing: 1, expanding: 2, viral: 3, archived: 4 };
      if (a.urgency === 'immediate' && b.urgency !== 'immediate') return -1;
      if (b.urgency === 'immediate' && a.urgency !== 'immediate') return 1;
      return order[a.phase] - order[b.phase];
    });
  }, [videos]);

  // Split active vs archived
  const activePhases = phases.filter(p => p.phase !== 'archived');
  const archivedPhases = phases.filter(p => p.phase === 'archived');

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary animate-pulse" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <Card className="p-5 text-center space-y-2 border-dashed">
        <Eye className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum vídeo rastreado</p>
        <p className="text-[10px] text-muted-foreground/60">
          Adicione vídeos no Performance Tracker para ver a fase de distribuição
        </p>
      </Card>
    );
  }

  const immediateCount = phases.filter(p => p.urgency === 'immediate').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              Fase de Distribuição
              {immediateCount > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] animate-pulse">
                  {immediateCount} ação urgente
                </Badge>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground">O YouTube testa cada vídeo com ~1000 views. Aqui você vê em qual fase cada vídeo está.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadVideos}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PHASE_CONFIG).map(([key, cfg]) => (
          <Badge key={key} variant="outline" className={`text-[10px] ${cfg.color}`}>
            {cfg.label}
          </Badge>
        ))}
      </div>

      {/* Active videos */}
      <AnimatePresence>
        {activePhases.length > 0 && (
          <div className="space-y-3">
            {activePhases.map(p => (
              <VideoPhaseCard key={p.video.id} data={p} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Archived (collapsed) */}
      {archivedPhases.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
            {archivedPhases.length} vídeo(s) com teste encerrado
          </summary>
          <div className="space-y-3 mt-3">
            {archivedPhases.map(p => (
              <VideoPhaseCard key={p.video.id} data={p} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
