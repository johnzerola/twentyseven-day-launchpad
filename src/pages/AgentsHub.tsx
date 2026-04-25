import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Activity, Bot, Brain, CheckCircle2, Clock, Flame, Loader2, Play, Radio,
  Search, Sparkles, TrendingUp, XCircle, Zap, Eye, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============= AGENT REGISTRY =============
// Static metadata enriched with live data from execution_logs.
type AgentDef = {
  function_name: string;
  display_name: string;
  description: string;
  icon: any;
  category: 'learning' | 'discovery' | 'production' | 'analytics';
  schedule_human: string;
};

const AGENTS: AgentDef[] = [
  {
    function_name: 'self-learning-engine',
    display_name: 'Engine de Auto-Aprendizado',
    description: 'Analisa vídeos top do nicho e extrai padrões virais para a base.',
    icon: Brain,
    category: 'learning',
    schedule_human: 'Diário',
  },
  {
    function_name: 'weekly-deep-research',
    display_name: 'Pesquisa Profunda Semanal',
    description: '5 domínios: algoritmo, storytelling, psicologia, nichos, formatos.',
    icon: Search,
    category: 'learning',
    schedule_human: 'Segundas 08:00 UTC',
  },
  {
    function_name: 'weekly-niche-references',
    display_name: 'Referências do Nicho',
    description: 'Busca semanal de vídeos referência (títulos, thumbs, duração).',
    icon: Eye,
    category: 'discovery',
    schedule_human: 'Segundas 06:00 UTC',
  },
  {
    function_name: 'detect-emerging-channels',
    display_name: 'Canais Emergentes',
    description: 'Detecta canais novos com crescimento explosivo no nicho.',
    icon: TrendingUp,
    category: 'discovery',
    schedule_human: 'Terças 07:00 UTC',
  },
  {
    function_name: 'pre-viral-detection',
    display_name: 'Detecção Pré-Viral',
    description: 'Encontra vídeos antes de explodirem (velocity score).',
    icon: Flame,
    category: 'discovery',
    schedule_human: 'A cada 4h',
  },
  {
    function_name: 'sync-video-metrics',
    display_name: 'Sync Métricas + Loop Viral',
    description: 'Sync de views/CTR e promoção de vencedores p/ viral_patterns.',
    icon: RefreshCw,
    category: 'analytics',
    schedule_human: 'Diário 05:00 UTC',
  },
  {
    function_name: 'enrich-video-performance',
    display_name: 'Enriquecimento de Performance',
    description: 'Extrai hook_type, title_pattern e niche dos vídeos do canal.',
    icon: Sparkles,
    category: 'analytics',
    schedule_human: 'Diário 04:00 UTC',
  },
  {
    function_name: 'intelligence-sync-engine',
    display_name: 'Sync de Inteligência',
    description: 'Sincroniza métricas e atualiza scores preditivos.',
    icon: Radio,
    category: 'analytics',
    schedule_human: 'Diário',
  },
  {
    function_name: 'autopilot-recover',
    display_name: 'AutoPilot Recovery',
    description: 'Recupera projetos travados e relança claims expirados.',
    icon: Zap,
    category: 'production',
    schedule_human: 'A cada 30min',
  },
  {
    function_name: 'weekly-channel-rescan',
    display_name: 'Rescan Semanal de Canais',
    description: 'Re-analisa DNA dos canais conectados.',
    icon: Activity,
    category: 'analytics',
    schedule_human: 'Domingos 03:00 UTC',
  },
  {
    function_name: 'weekly-strategy-agent',
    display_name: 'Agente de Estratégia',
    description: 'Sugere ajustes de estratégia baseado nos resultados da semana.',
    icon: Brain,
    category: 'learning',
    schedule_human: 'Domingos 23:00 UTC',
  },
  {
    function_name: 'track-video-performance',
    display_name: 'Tracker de Performance',
    description: 'Tracking contínuo das publicações para fechar o loop.',
    icon: TrendingUp,
    category: 'analytics',
    schedule_human: 'Contínuo',
  },
];

type LogStat = {
  function_name: string;
  total_7d: number;
  success_7d: number;
  last_run: string | null;
  last_success: boolean;
  last_error: string | null;
  avg_duration_ms: number | null;
  last_metadata: any;
};

const CATEGORY_COLORS: Record<string, string> = {
  learning: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  discovery: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  production: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  analytics: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  learning: 'Aprendizado',
  discovery: 'Descoberta',
  production: 'Produção',
  analytics: 'Análise',
};

const StatusDot = ({ ok, pending }: { ok: boolean | null; pending?: boolean }) => {
  if (pending) return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />;
  if (ok === null) return <span className="w-2 h-2 rounded-full bg-muted inline-block" />;
  return <span className={`w-2 h-2 rounded-full inline-block ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />;
};

const formatRelative = (iso: string | null) => {
  if (!iso) return 'nunca';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return iso;
  }
};

export default function AgentsHub() {
  const [stats, setStats] = useState<Record<string, LogStat>>({});
  const [squads, setSquads] = useState<any[]>([]);
  const [agentRuns, setAgentRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fnNames = AGENTS.map((a) => a.function_name);

      // 1. Background agents stats
      const { data: logs } = await supabase
        .from('execution_logs')
        .select('function_name, success, duration_ms, error_message, metadata, created_at')
        .in('function_name', fnNames)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);

      const map: Record<string, LogStat> = {};
      for (const fn of fnNames) {
        map[fn] = {
          function_name: fn,
          total_7d: 0,
          success_7d: 0,
          last_run: null,
          last_success: false,
          last_error: null,
          avg_duration_ms: null,
          last_metadata: null,
        };
      }
      let durSum: Record<string, { sum: number; n: number }> = {};
      (logs || []).forEach((l: any) => {
        const s = map[l.function_name];
        if (!s) return;
        s.total_7d++;
        if (l.success) s.success_7d++;
        if (!s.last_run) {
          s.last_run = l.created_at;
          s.last_success = !!l.success;
          s.last_error = l.error_message || null;
          s.last_metadata = l.metadata || null;
        }
        if (l.duration_ms) {
          durSum[l.function_name] ||= { sum: 0, n: 0 };
          durSum[l.function_name].sum += l.duration_ms;
          durSum[l.function_name].n++;
        }
      });
      Object.keys(durSum).forEach((k) => {
        if (map[k]) map[k].avg_duration_ms = Math.round(durSum[k].sum / durSum[k].n);
      });
      setStats(map);

      // 2. Squad runs (live + recent)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sq } = await supabase
          .from('squad_runs')
          .select('id, squad_name, status, current_step, total_steps, started_at, completed_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15);
        setSquads(sq || []);

        const { data: ag } = await supabase
          .from('agent_runs')
          .select('id, goal, status, current_step, total_steps, error_message, created_at, completed_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15);
        setAgentRuns(ag || []);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao carregar agentes: ' + (e?.message || 'erro'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // Realtime updates on execution_logs and squad_runs
    const ch = supabase
      .channel('agents-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'execution_logs' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_runs' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, AgentDef[]> = { learning: [], discovery: [], production: [], analytics: [] };
    AGENTS.forEach((a) => g[a.category].push(a));
    return g;
  }, []);

  const summary = useMemo(() => {
    const fns = Object.values(stats);
    const active = fns.filter((s) => s.last_run && new Date(s.last_run).getTime() > Date.now() - 24 * 3600 * 1000);
    const failing = fns.filter((s) => s.total_7d > 0 && s.success_7d / s.total_7d < 0.5);
    const totalRuns = fns.reduce((acc, s) => acc + s.total_7d, 0);
    return { totalAgents: AGENTS.length, activeToday: active.length, failing: failing.length, totalRuns };
  }, [stats]);

  const triggerAgent = async (fn: string) => {
    setTriggering(fn);
    try {
      const { error } = await supabase.functions.invoke(fn, { body: { triggered_by: 'manual_dashboard' } });
      if (error) throw error;
      toast.success(`Disparado: ${fn}`);
      setTimeout(loadAll, 1500);
    } catch (e: any) {
      toast.error(`Falha ao disparar ${fn}: ${e?.message || 'erro'}`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
              <Bot className="w-7 h-7 text-primary" />
              Orquestrador de Agentes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tudo o que sua IA está fazendo nos bastidores — em tempo real.
            </p>
          </div>
          <Button onClick={loadAll} variant="outline" size="sm" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Atualizar
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard icon={Bot} label="Agentes Totais" value={summary.totalAgents} />
          <SummaryCard icon={CheckCircle2} label="Ativos hoje" value={summary.activeToday} accent="emerald" />
          <SummaryCard icon={Activity} label="Execuções (7d)" value={summary.totalRuns} accent="sky" />
          <SummaryCard icon={AlertCircle} label="Com falhas" value={summary.failing} accent={summary.failing > 0 ? 'rose' : 'muted'} />
        </div>

        <Tabs defaultValue="background" className="w-full">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="background" className="gap-2">
              <Radio className="w-3.5 h-3.5" /> Em Background ({AGENTS.length})
            </TabsTrigger>
            <TabsTrigger value="squads" className="gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Squads ({squads.length})
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Brain className="w-3.5 h-3.5" /> Agentes Interativos ({agentRuns.length})
            </TabsTrigger>
          </TabsList>

          {/* ===== Background agents ===== */}
          <TabsContent value="background" className="space-y-6 mt-4">
            {(['learning', 'discovery', 'production', 'analytics'] as const).map((cat) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={CATEGORY_COLORS[cat]} variant="outline">
                    {CATEGORY_LABELS[cat]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {grouped[cat].length} agente{grouped[cat].length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[cat].map((a) => {
                    const s = stats[a.function_name];
                    const successRate = s && s.total_7d > 0 ? Math.round((s.success_7d / s.total_7d) * 100) : null;
                    const Icon = a.icon;
                    const isFresh = s?.last_run && new Date(s.last_run).getTime() > Date.now() - 24 * 3600 * 1000;
                    return (
                      <Card key={a.function_name} className="bg-card/60 border-border hover:border-primary/40 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-primary/10">
                                <Icon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <CardTitle className="text-sm font-semibold leading-tight">
                                  {a.display_name}
                                </CardTitle>
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                                  {a.function_name}
                                </p>
                              </div>
                            </div>
                            <StatusDot ok={s?.last_run ? s.last_success : null} pending={triggering === a.function_name} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0">
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span className="truncate">{a.schedule_human}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isFresh ? (
                                <span className="text-emerald-300">● ativo</span>
                              ) : s?.last_run ? (
                                <span className="text-muted-foreground">{formatRelative(s.last_run)}</span>
                              ) : (
                                <span className="text-muted-foreground">sem execuções</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] pt-1 border-t border-border/40">
                            <span className="text-muted-foreground">
                              7d: <span className="text-foreground font-medium">{s?.total_7d ?? 0}</span> runs
                            </span>
                            {successRate !== null && (
                              <span className={successRate >= 80 ? 'text-emerald-300' : successRate >= 50 ? 'text-amber-300' : 'text-rose-300'}>
                                {successRate}% sucesso
                              </span>
                            )}
                            {s?.avg_duration_ms != null && (
                              <span className="text-muted-foreground">
                                ~{(s.avg_duration_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>

                          {s?.last_error && !s.last_success && (
                            <div className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1 line-clamp-2">
                              ⚠ {s.last_error}
                            </div>
                          )}

                          {s?.last_metadata && Object.keys(s.last_metadata).length > 0 && (
                            <details className="text-[10px]">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Último insight
                              </summary>
                              <pre className="mt-1 bg-muted/30 rounded p-2 overflow-x-auto text-[9px] leading-tight">
                                {JSON.stringify(s.last_metadata, null, 2).slice(0, 400)}
                              </pre>
                            </details>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full h-7 text-[11px] gap-1.5"
                            onClick={() => triggerAgent(a.function_name)}
                            disabled={triggering === a.function_name}
                          >
                            {triggering === a.function_name ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Rodar agora
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ===== Squads ===== */}
          <TabsContent value="squads" className="mt-4">
            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">Execuções recentes de Squads</CardTitle>
              </CardHeader>
              <CardContent>
                {squads.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum squad rodado ainda.{' '}
                    <a href="/squads" className="text-primary underline">Iniciar um squad →</a>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <div className="space-y-2">
                      {squads.map((r) => (
                        <RunRow
                          key={r.id}
                          title={r.squad_name}
                          status={r.status}
                          step={`${r.current_step ?? 0}/${r.total_steps ?? 0}`}
                          when={r.created_at}
                          completed={r.completed_at}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== Interactive agents ===== */}
          <TabsContent value="agents" className="mt-4">
            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">Agentes Interativos (Meta-Orchestrator)</CardTitle>
              </CardHeader>
              <CardContent>
                {agentRuns.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum agente interativo executado ainda.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <div className="space-y-2">
                      {agentRuns.map((r) => (
                        <RunRow
                          key={r.id}
                          title={r.goal}
                          status={r.status}
                          step={`${r.current_step ?? 0}/${r.total_steps ?? 0}`}
                          when={r.created_at}
                          completed={r.completed_at}
                          error={r.error_message}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, accent = 'primary' }: { icon: any; label: string; value: number | string; accent?: string }) {
  const colors: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    emerald: 'text-emerald-300 bg-emerald-500/10',
    sky: 'text-sky-300 bg-sky-500/10',
    rose: 'text-rose-300 bg-rose-500/10',
    muted: 'text-muted-foreground bg-muted/30',
  };
  return (
    <Card className="bg-card/60 border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RunRow({ title, status, step, when, completed, error }: any) {
  const isRunning = ['running', 'planning', 'pending'].includes(status);
  const isOk = ['completed', 'done', 'success'].includes(status);
  const isFail = ['failed', 'error'].includes(status);
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-md bg-muted/20 border border-border/40 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-300 mt-0.5 shrink-0" />
        ) : isOk ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
        ) : isFail ? (
          <XCircle className="w-4 h-4 text-rose-300 mt-0.5 shrink-0" />
        ) : (
          <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>{formatRelative(when)}</span>
            <span>•</span>
            <span>passo {step}</span>
            {completed && <><span>•</span><span>concluído {formatRelative(completed)}</span></>}
          </div>
          {error && <p className="text-[11px] text-rose-300 mt-1 line-clamp-2">⚠ {error}</p>}
        </div>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {status}
      </Badge>
    </div>
  );
}
