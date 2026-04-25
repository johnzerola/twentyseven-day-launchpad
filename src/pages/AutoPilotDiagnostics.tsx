import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Calendar, FileText, Youtube, ExternalLink, PlayCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface CronRun {
  jobname: string;
  runid: number;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
}

interface ChannelDiag {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  autopilot_enabled: boolean;
  next_slot_at: string | null;
  last_posted_at: string | null;
  total_videos_posted: number | null;
  queued_count: number;
  scheduled_count: number;
  error_count: number;
  recent_projects: Array<{ id: string; title: string; status: string; scheduled_at: string | null; created_at: string; error_message: string | null }>;
  recent_schedule: Array<{ id: string; status: string; scheduled_at: string; project_id: string | null }>;
}

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtRelative = (iso?: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.round(h / 24)}d atrás`;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { cls: string; label: string }> = {
    succeeded: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'OK' },
    failed:    { cls: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Falhou' },
    running:   { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Rodando' },
  };
  const m = map[status] || { cls: 'bg-muted text-muted-foreground border-border', label: status };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
};

const AutoPilotDiagnostics = () => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [channels, setChannels] = useState<ChannelDiag[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [runsRes, channelsRes, projectsRes, scheduleRes] = await Promise.all([
        supabase.rpc('get_autopilot_cron_runs' as any, { _limit: 30 }),
        supabase
          .from('user_channels' as any)
          .select('id, channel_name, channel_thumbnail, autopilot_enabled, next_slot_at, last_posted_at, total_videos_posted')
          .eq('user_id', user.id)
          .order('autopilot_enabled', { ascending: false }),
        supabase
          .from('video_projects')
          .select('id, title, status, scheduled_at, created_at, error_message, channel_id_ref')
          .eq('user_id', user.id)
          .not('channel_id_ref', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('channel_schedule' as any)
          .select('id, status, scheduled_at, project_id, channel_id')
          .eq('user_id', user.id)
          .order('scheduled_at', { ascending: false })
          .limit(200),
      ]);

      if (runsRes.error) {
        console.warn('cron runs error', runsRes.error);
      } else {
        setRuns((runsRes.data as any) || []);
      }

      const projects = (projectsRes.data as any[]) || [];
      const schedules = (scheduleRes.data as any[]) || [];

      const diag: ChannelDiag[] = ((channelsRes.data as any[]) || []).map((c: any) => {
        const chProjects = projects.filter(p => p.channel_id_ref === c.id);
        const chSchedule = schedules.filter(s => s.channel_id === c.id);
        return {
          id: c.id,
          channel_name: c.channel_name,
          thumbnail: c.channel_thumbnail,
          autopilot_enabled: !!c.autopilot_enabled,
          next_slot_at: c.next_slot_at,
          last_posted_at: c.last_posted_at,
          total_videos_posted: c.total_videos_posted,
          queued_count: chProjects.filter(p => ['queued', 'ready_for_production'].includes(p.status)).length,
          scheduled_count: chSchedule.filter(s => s.status === 'scheduled').length,
          error_count: chProjects.filter(p => p.error_message && p.status !== 'failed_permanent').length,
          recent_projects: chProjects.slice(0, 5),
          recent_schedule: chSchedule.slice(0, 5),
        };
      });

      setChannels(diag);
    } catch (e: any) {
      toast.error('Erro ao carregar diagnóstico: ' + (e?.message || 'erro'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const triggerScheduler = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('autopilot-scheduler', { body: {} });
      if (error) throw error;
      toast.success('Scheduler disparado — recarregando…');
      setTimeout(load, 2000);
    } catch (e: any) {
      toast.error('Falha ao disparar: ' + (e?.message || 'erro'));
    } finally {
      setRunning(false);
    }
  };

  const dailyRuns = runs.filter(r => r.jobname === 'autopilot-scheduler-daily');
  const recoverRuns = runs.filter(r => r.jobname === 'autopilot-recover-30min');
  const lastDaily = dailyRuns[0];
  const successRate = runs.length
    ? Math.round((runs.filter(r => r.status === 'succeeded').length / runs.length) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">AutoPilot — Diagnóstico</h1>
              <p className="text-sm text-muted-foreground">
                Status do scheduler diário, runs recentes e geração por canal
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={load} variant="outline" size="sm" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
            <Button onClick={triggerScheduler} disabled={running} size="sm" className="gradient-hero text-primary-foreground">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Rodar agora
            </Button>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            icon={<Clock className="w-4 h-4" />}
            label="Último run diário"
            value={lastDaily ? fmtRelative(lastDaily.start_time) : '—'}
            sub={lastDaily ? <StatusBadge status={lastDaily.status} /> : null}
          />
          <Kpi
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Taxa de sucesso (30 runs)"
            value={`${successRate}%`}
          />
          <Kpi
            icon={<Youtube className="w-4 h-4" />}
            label="Canais com AutoPilot"
            value={`${channels.filter(c => c.autopilot_enabled).length}/${channels.length}`}
          />
          <Kpi
            icon={<AlertCircle className="w-4 h-4" />}
            label="Projetos com erro"
            value={String(channels.reduce((a, c) => a + c.error_count, 0))}
          />
        </div>

        {/* Cron history */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Histórico de execuções
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">
              Diário: {dailyRuns.length} runs • Recover: {recoverRuns.length} runs
            </span>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                {loading ? 'Carregando…' : 'Nenhuma execução registrada ainda.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {runs.slice(0, 30).map(r => (
                  <div key={`${r.jobname}-${r.runid}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted/30 text-xs border-l-2 border-transparent hover:border-primary/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {r.status === 'succeeded' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : r.status === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="font-mono text-muted-foreground truncate">{r.jobname}</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-foreground/80">{fmtDate(r.start_time)}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {r.duration_ms != null && (
                        <span className="text-muted-foreground/70 font-mono">{Math.round(r.duration_ms)}ms</span>
                      )}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per channel */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Youtube className="w-4 h-4 text-primary" />
            Por canal ({channels.length})
          </h2>

          {channels.length === 0 && !loading && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              Nenhum canal conectado.{' '}
              <Link to="/channels" className="text-primary hover:underline">Adicionar canal</Link>
            </CardContent></Card>
          )}

          <div className="space-y-3">
            {channels.map(ch => (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={ch.autopilot_enabled ? 'border-primary/30' : 'border-border/40'}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {ch.thumbnail && <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full ring-1 ring-border" />}
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{ch.channel_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {ch.autopilot_enabled ? (
                              <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">AutoPilot ON</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">AutoPilot OFF</Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              Próximo slot: <strong className="text-foreground/80">{fmtDate(ch.next_slot_at)}</strong>
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Último post: {fmtRelative(ch.last_posted_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link to={`/channels/${ch.id}/settings`} className="text-[11px] text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                        Configurar <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <Stat icon={<FileText className="w-3 h-3" />} label="Em fila" value={ch.queued_count} tone={ch.queued_count > 0 ? 'primary' : 'muted'} />
                      <Stat icon={<Calendar className="w-3 h-3" />} label="Agendados" value={ch.scheduled_count} tone={ch.scheduled_count > 0 ? 'primary' : 'muted'} />
                      <Stat icon={<AlertCircle className="w-3 h-3" />} label="Erros" value={ch.error_count} tone={ch.error_count > 0 ? 'danger' : 'muted'} />
                    </div>
                  </CardHeader>

                  {(ch.recent_projects.length > 0 || ch.recent_schedule.length > 0) && (
                    <CardContent className="pt-0 grid md:grid-cols-2 gap-4">
                      {/* Projects */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Projetos recentes
                        </p>
                        {ch.recent_projects.length === 0 ? (
                          <p className="text-[11px] italic text-muted-foreground">Nenhum projeto gerado</p>
                        ) : (
                          <ul className="space-y-1">
                            {ch.recent_projects.map(p => (
                              <li key={p.id} className="text-[11px] flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-muted/30">
                                <Link to={`/scripts?project=${p.id}`} className="truncate text-foreground/90 hover:text-primary flex-1">
                                  {p.title || '(sem título)'}
                                </Link>
                                <Badge variant="outline" className="text-[9px] flex-shrink-0">{p.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Schedule */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Agenda recente
                        </p>
                        {ch.recent_schedule.length === 0 ? (
                          <p className="text-[11px] italic text-muted-foreground">Nada agendado</p>
                        ) : (
                          <ul className="space-y-1">
                            {ch.recent_schedule.map(s => (
                              <li key={s.id} className="text-[11px] flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-muted/30">
                                <span className="text-foreground/80">{fmtDate(s.scheduled_at)}</span>
                                <Badge variant="outline" className="text-[9px] flex-shrink-0">{s.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const Kpi = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold mt-1 font-display">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </CardContent>
  </Card>
);

const Stat = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'muted' | 'danger' }) => {
  const cls = tone === 'primary' ? 'border-primary/30 bg-primary/5 text-primary' :
              tone === 'danger'  ? 'border-destructive/30 bg-destructive/5 text-destructive' :
                                   'border-border/40 bg-muted/20 text-muted-foreground';
  return (
    <div className={`rounded-md border px-2 py-1.5 ${cls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">{icon}{label}</div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
};

export default AutoPilotDiagnostics;
