import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
  Youtube,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────
type Worker = {
  worker_id: string;
  last_seen: string;
  current_project_id: string | null;
  current_stage: string | null;
  progress_pct: number | null;
  meta: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  title: string | null;
  status: string;
  worker_id: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  scheduled_at: string | null;
  retry_count: number | null;
  max_retries: number | null;
  upload_attempts: number | null;
  next_retry_at: string | null;
  error_message: string | null;
  rendered_video_url: string | null;
  youtube_video_id: string | null;
  channel_id_ref: string | null;
};

type EventRow = {
  id: string;
  project_id: string;
  worker_id: string | null;
  stage: string;
  status: "started" | "completed" | "failed" | "progress";
  message: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type LockRow = {
  channel_id: string;
  worker_id: string;
  project_id: string | null;
  stage: string;
  acquired_at: string;
  expires_at: string;
  heartbeat_at: string;
};

// ──────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  claim: "Reservar projeto",
  generate: "Gerar cenas",
  download: "Baixar mídia",
  timeline: "Montar timeline",
  render: "Renderizar vídeo",
  upload: "Subir no YouTube",
  metadata: "Aplicar metadata",
  complete: "Concluído",
  idle: "Ocioso",
};

const STAGE_ORDER = [
  "claim",
  "generate",
  "download",
  "timeline",
  "render",
  "upload",
  "metadata",
  "complete",
];

// Heartbeat acima desse valor → worker considerado offline
const HEARTBEAT_OFFLINE_SECONDS = 120;
// Lease prestes a expirar (alerta amarelo)
const LEASE_WARN_SECONDS = 600;

const labelStage = (s?: string | null) =>
  s ? STAGE_LABELS[s] ?? s : "—";

const fmtRelative = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return iso;
  }
};

const secondsBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 1000);

// ──────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────
export default function WorkerMonitor() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [locks, setLocks] = useState<LockRow[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Tick para recalcular "há X segundos" sem refetch
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), 5_000);
    return () => clearInterval(id);
  }, []);

  // ──────────────────────────────────────────────────────────────────
  const fetchAll = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);

    const [wRes, pRes, eRes, lRes] = await Promise.all([
      supabase
        .from("worker_heartbeats")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(50),
      supabase
        .from("video_projects")
        .select(
          "id,title,status,worker_id,claimed_at,claim_expires_at,scheduled_at,retry_count,max_retries,upload_attempts,next_retry_at,error_message,rendered_video_url,youtube_video_id,channel_id_ref",
        )
        .in("status", [
          "claimed",
          "rendering",
          "uploading",
          "rendered",
          "upload_failed",
          "failed",
          "ready_for_production",
        ])
        .order("updated_at", { ascending: false })
        .limit(60),
      supabase
        .from("project_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("channel_locks").select("*").order("acquired_at", { ascending: false }),
    ]);

    if (wRes.error) toast.error(`Workers: ${wRes.error.message}`);
    if (pRes.error) toast.error(`Projetos: ${pRes.error.message}`);
    if (eRes.error) toast.error(`Eventos: ${eRes.error.message}`);
    if (lRes.error) toast.error(`Locks: ${lRes.error.message}`);

    setWorkers((wRes.data ?? []) as Worker[]);
    setProjects((pRes.data ?? []) as ProjectRow[]);
    setEvents((eRes.data ?? []) as EventRow[]);
    setLocks((lRes.data ?? []) as LockRow[]);

    setLoading(false);
    setRefreshing(false);
  };

  // Initial + auto refresh + realtime
  useEffect(() => {
    fetchAll();
    const poll = setInterval(() => fetchAll(false), 15_000);

    const channel = supabase
      .channel("worker-monitor-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_events" },
        () => fetchAll(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_heartbeats" },
        () => fetchAll(false),
      )
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────
  // Derived: alerts
  // ──────────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: {
      id: string;
      severity: "error" | "warning";
      title: string;
      detail: string;
      project_id?: string;
    }[] = [];

    for (const w of workers) {
      const age = secondsBetween(now, w.last_seen);
      if (age > HEARTBEAT_OFFLINE_SECONDS) {
        list.push({
          id: `worker-offline-${w.worker_id}`,
          severity: "error",
          title: `Worker ${w.worker_id} offline`,
          detail: `Sem heartbeat há ${Math.floor(age / 60)}min ${age % 60}s`,
        });
      }
    }

    for (const p of projects) {
      if (p.status === "failed") {
        list.push({
          id: `proj-failed-${p.id}`,
          severity: "error",
          title: `Projeto falhou: ${p.title ?? p.id.slice(0, 8)}`,
          detail: p.error_message?.slice(0, 200) ?? "Sem mensagem",
          project_id: p.id,
        });
      }
      if (p.status === "upload_failed") {
        list.push({
          id: `proj-upload-failed-${p.id}`,
          severity: "warning",
          title: `Upload falhou: ${p.title ?? p.id.slice(0, 8)}`,
          detail: `Tentativa ${p.upload_attempts ?? 0} — retry ${fmtRelative(p.next_retry_at)}`,
          project_id: p.id,
        });
      }
      if (
        p.claim_expires_at &&
        ["claimed", "rendering", "uploading"].includes(p.status)
      ) {
        const remaining = secondsBetween(p.claim_expires_at, now);
        if (remaining < 0) {
          list.push({
            id: `proj-lease-expired-${p.id}`,
            severity: "error",
            title: `Lease estourado: ${p.title ?? p.id.slice(0, 8)}`,
            detail: `Worker ${p.worker_id} pode estar travado (lease expirou ${fmtRelative(p.claim_expires_at)})`,
            project_id: p.id,
          });
        } else if (remaining < LEASE_WARN_SECONDS) {
          list.push({
            id: `proj-lease-warn-${p.id}`,
            severity: "warning",
            title: `Lease quase expirando: ${p.title ?? p.id.slice(0, 8)}`,
            detail: `Restam ${Math.floor(remaining / 60)}min ${remaining % 60}s`,
            project_id: p.id,
          });
        }
      }
      if ((p.retry_count ?? 0) >= (p.max_retries ?? 3) - 1 && p.status !== "published") {
        list.push({
          id: `proj-retry-${p.id}`,
          severity: "warning",
          title: `Última tentativa: ${p.title ?? p.id.slice(0, 8)}`,
          detail: `${p.retry_count}/${p.max_retries} retries usados`,
          project_id: p.id,
        });
      }
    }

    return list;
  }, [workers, projects, now]);

  // Project events grouped by stage (para a timeline)
  const selectedProjectEvents = useMemo(() => {
    if (!selectedProject) return [];
    return events
      .filter((e) => e.project_id === selectedProject)
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [events, selectedProject]);

  // Stats
  const stats = useMemo(() => {
    const online = workers.filter(
      (w) => secondsBetween(now, w.last_seen) <= HEARTBEAT_OFFLINE_SECONDS,
    ).length;
    const failedToday = projects.filter(
      (p) =>
        ["failed", "upload_failed"].includes(p.status) &&
        // tudo que está em retry ou falhou no dia
        true,
    ).length;
    const inProgress = projects.filter((p) =>
      ["claimed", "rendering", "uploading"].includes(p.status),
    ).length;
    return { online, total: workers.length, failedToday, inProgress, locks: locks.length };
  }, [workers, projects, locks, now]);

  // ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitor de Worker</h1>
            <p className="text-sm text-muted-foreground">
              Status dos workers VPS, projetos em execução e alertas em tempo real
            </p>
          </div>
          <Button
            onClick={() => fetchAll(true)}
            variant="outline"
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            icon={<Server className="h-4 w-4" />}
            label="Workers online"
            value={`${stats.online}/${stats.total}`}
            tone={stats.online === 0 ? "danger" : "default"}
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Em execução"
            value={String(stats.inProgress)}
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label="Canais travados"
            value={String(stats.locks)}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Alertas"
            value={String(alerts.length)}
            tone={alerts.some((a) => a.severity === "error") ? "danger" : "warn"}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4" />}
            label="Falhas/Retry"
            value={String(stats.failedToday)}
          />
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alertas ativos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => a.project_id && setSelectedProject(a.project_id)}
                  className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition hover:bg-muted/50 ${
                    a.severity === "error"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-amber-500/40 bg-amber-500/5"
                  }`}
                >
                  {a.severity === "error" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="workers" className="w-full">
          <TabsList>
            <TabsTrigger value="workers">Workers ({workers.length})</TabsTrigger>
            <TabsTrigger value="projects">Projetos ({projects.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="events">Eventos recentes</TabsTrigger>
          </TabsList>

          {/* Workers */}
          <TabsContent value="workers">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <SkeletonRow />
                ) : workers.length === 0 ? (
                  <EmptyState text="Nenhum worker registrado ainda." />
                ) : (
                  <div className="divide-y">
                    {workers.map((w) => {
                      const age = secondsBetween(now, w.last_seen);
                      const offline = age > HEARTBEAT_OFFLINE_SECONDS;
                      return (
                        <div
                          key={w.worker_id}
                          className="flex flex-wrap items-center gap-4 p-4"
                        >
                          <div className={`h-2.5 w-2.5 rounded-full ${offline ? "bg-destructive" : "bg-emerald-500 animate-pulse"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium">{w.worker_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {labelStage(w.current_stage)} · heartbeat {fmtRelative(w.last_seen)}
                            </p>
                          </div>
                          {w.current_project_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedProject(w.current_project_id!)}
                            >
                              Ver projeto
                            </Button>
                          )}
                          <div className="w-32">
                            {typeof w.progress_pct === "number" ? (
                              <>
                                <Progress value={w.progress_pct} className="h-1.5" />
                                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                                  {w.progress_pct}%
                                </p>
                              </>
                            ) : null}
                          </div>
                          <Badge variant={offline ? "destructive" : "secondary"}>
                            {offline ? "offline" : "online"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <SkeletonRow />
                ) : projects.length === 0 ? (
                  <EmptyState text="Nenhum projeto em execução." />
                ) : (
                  <div className="divide-y">
                    {projects.map((p) => {
                      const remaining = p.claim_expires_at
                        ? secondsBetween(p.claim_expires_at, now)
                        : null;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProject(p.id)}
                          className={`flex w-full flex-wrap items-center gap-3 p-4 text-left transition hover:bg-muted/50 ${
                            selectedProject === p.id ? "bg-muted/40" : ""
                          }`}
                        >
                          <StatusBadge status={p.status} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {p.title ?? p.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.worker_id ? `worker: ${p.worker_id}` : "sem worker"} ·
                              retries {p.retry_count ?? 0}/{p.max_retries ?? 3}
                              {p.upload_attempts ? ` · uploads ${p.upload_attempts}` : ""}
                            </p>
                          </div>
                          {remaining !== null && (
                            <span
                              className={`text-xs ${
                                remaining < 0
                                  ? "text-destructive"
                                  : remaining < LEASE_WARN_SECONDS
                                    ? "text-amber-500"
                                    : "text-muted-foreground"
                              }`}
                            >
                              <Clock className="mr-1 inline h-3 w-3" />
                              {remaining < 0
                                ? `expirado ${fmtRelative(p.claim_expires_at)}`
                                : `lease ${Math.floor(remaining / 60)}min`}
                            </span>
                          )}
                          {p.youtube_video_id && (
                            <a
                              href={`https://youtu.be/${p.youtube_video_id}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-primary hover:underline"
                            >
                              <Youtube className="mr-1 inline h-3 w-3" />
                              {p.youtube_video_id}
                            </a>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline of selected project */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedProject ? (
                    <>
                      Timeline do projeto{" "}
                      <span className="font-mono text-sm text-muted-foreground">
                        {selectedProject.slice(0, 8)}
                      </span>
                    </>
                  ) : (
                    "Selecione um projeto na aba acima"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedProject ? (
                  <EmptyState text="Clique em um projeto na aba 'Projetos' para ver sua timeline." />
                ) : selectedProjectEvents.length === 0 ? (
                  <EmptyState text="Nenhum evento registrado para este projeto ainda." />
                ) : (
                  <StageTimeline events={selectedProjectEvents} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent events feed */}
          <TabsContent value="events">
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y">
                    {events.slice(0, 100).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedProject(e.project_id)}
                        className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-muted/50"
                      >
                        <EventIcon status={e.status} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{labelStage(e.stage)}</span>{" "}
                            <span className="text-xs text-muted-foreground">
                              · projeto {e.project_id.slice(0, 8)}
                              {e.worker_id ? ` · ${e.worker_id}` : ""}
                            </span>
                          </p>
                          {e.message && (
                            <p className="text-xs text-muted-foreground">{e.message}</p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {fmtRelative(e.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-500"
        : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    ready_for_production: { variant: "outline", label: "pronto" },
    claimed: { variant: "secondary", label: "reservado" },
    rendering: { variant: "secondary", label: "renderizando" },
    rendered: { variant: "secondary", label: "renderizado" },
    uploading: { variant: "secondary", label: "subindo" },
    upload_failed: { variant: "destructive", label: "upload falhou" },
    failed: { variant: "destructive", label: "falhou" },
    published: { variant: "default", label: "publicado" },
  };
  const cfg = map[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function EventIcon({ status }: { status: EventRow["status"] }) {
  if (status === "completed")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === "failed")
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  if (status === "started")
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />;
  return <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}

function StageTimeline({ events }: { events: EventRow[] }) {
  // Agrupa por stage e mostra started/completed/failed
  const byStage = new Map<string, EventRow[]>();
  for (const ev of events) {
    if (!byStage.has(ev.stage)) byStage.set(ev.stage, []);
    byStage.get(ev.stage)!.push(ev);
  }

  // Ordena pelas etapas conhecidas + extras
  const stagesPresent = Array.from(byStage.keys());
  const orderedStages = [
    ...STAGE_ORDER.filter((s) => stagesPresent.includes(s)),
    ...stagesPresent.filter((s) => !STAGE_ORDER.includes(s)),
  ];

  return (
    <ol className="space-y-4">
      {orderedStages.map((stage) => {
        const evs = byStage.get(stage)!;
        const last = evs[evs.length - 1];
        const started = evs.find((e) => e.status === "started");
        const finished = evs.find(
          (e) => e.status === "completed" || e.status === "failed",
        );
        const dur =
          started && finished
            ? secondsBetween(finished.created_at, started.created_at)
            : null;

        return (
          <li key={stage} className="relative pl-8">
            <span
              className={`absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                last.status === "failed"
                  ? "border-destructive bg-destructive/10"
                  : last.status === "completed"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-primary bg-primary/10"
              }`}
            >
              <EventIcon status={last.status} />
            </span>
            <div className="rounded-md border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{labelStage(stage)}</p>
                <span className="text-xs text-muted-foreground">
                  {dur !== null ? `${dur}s` : fmtRelative(last.created_at)}
                </span>
              </div>
              {last.message && (
                <p className="mt-1 text-xs text-muted-foreground">{last.message}</p>
              )}
              {evs.length > 1 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {evs.length} eventos
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {evs.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        <EventIcon status={e.status} />
                        <span className="text-muted-foreground">
                          {fmtRelative(e.created_at)}
                        </span>
                        <span>{e.message ?? e.status}</span>
                        {typeof e.cost_usd === "number" && e.cost_usd > 0 && (
                          <Badge variant="outline" className="ml-auto">
                            ${e.cost_usd.toFixed(4)}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
      <Activity className="h-6 w-6 opacity-40" />
      {text}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-2 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/50" />
      ))}
    </div>
  );
}
