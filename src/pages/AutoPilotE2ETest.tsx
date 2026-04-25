import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Circle, ArrowRight, RefreshCw, Rocket } from "lucide-react";
import { toast } from "sonner";

type StepStatus = "idle" | "running" | "ok" | "fail";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

const INITIAL_STEPS: Step[] = [
  { id: "load",        label: "1. Carregar canais e projetos elegíveis", status: "idle" },
  { id: "select",      label: "2. Selecionar canal + projeto + horário", status: "idle" },
  { id: "claim",       label: "3. Chamar claim_publish_slot (RPC)",     status: "idle" },
  { id: "verify_proj", label: "4. Verificar status = ready_for_production no projeto", status: "idle" },
  { id: "verify_sched",label: "5. Verificar registro em channel_schedule", status: "idle" },
];

interface ChannelOpt { id: string; channel_name: string; autopilot_enabled: boolean; }
interface ProjectOpt { id: string; title: string | null; status: string; }

function tomorrow6pmISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  // formato datetime-local: yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const StatusIcon = ({ status }: { status: StepStatus }) => {
  if (status === "running") return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
  if (status === "ok")      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === "fail")    return <XCircle className="w-5 h-5 text-destructive" />;
  return <Circle className="w-5 h-5 text-muted-foreground" />;
};

export default function AutoPilotE2ETest() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  const [channels, setChannels] = useState<ChannelOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>(tomorrow6pmISO());

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [finalReport, setFinalReport] = useState<any>(null);

  const updateStep = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));
  const resetSteps = () => { setSteps(INITIAL_STEPS); setFinalReport(null); };

  const loadCandidates = async () => {
    updateStep("load", { status: "running", detail: undefined });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para usar o teste E2E.");
      setUserId(user.id);

      const [{ data: ch, error: chErr }, { data: pr, error: prErr }] = await Promise.all([
        supabase
          .from("user_channels")
          .select("id, channel_name, autopilot_enabled")
          .eq("user_id", user.id),
        supabase
          .from("video_projects")
          .select("id, title, status")
          .eq("user_id", user.id)
          .in("status", ["draft", "script", "scenes", "audio", "videos", "assembling"])
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (chErr) throw chErr;
      if (prErr) throw prErr;

      setChannels(ch || []);
      setProjects(pr || []);
      updateStep("load", {
        status: "ok",
        detail: `${ch?.length ?? 0} canais, ${pr?.length ?? 0} projetos elegíveis encontrados.`,
      });
    } catch (e: any) {
      updateStep("load", { status: "fail", detail: e.message });
      toast.error(e.message);
    }
  };

  useEffect(() => { loadCandidates(); }, []);

  const runE2E = async () => {
    if (!userId) { toast.error("Sem userId"); return; }
    if (!selectedChannel || !selectedProject || !scheduledAt) {
      toast.error("Selecione canal, projeto e horário antes de rodar.");
      return;
    }
    setRunning(true);
    setFinalReport(null);

    // 2. select
    updateStep("select", {
      status: "ok",
      detail: `Canal ${selectedChannel.slice(0, 8)}… · Projeto ${selectedProject.slice(0, 8)}… · ${scheduledAt}`,
    });

    // 3. claim_publish_slot
    updateStep("claim", { status: "running", detail: undefined });
    let claimResult: any = null;
    try {
      const { data, error } = await supabase.rpc("claim_publish_slot", {
        _user_id: userId,
        _project_id: selectedProject,
        _channel_id: selectedChannel,
        _scheduled_at: new Date(scheduledAt).toISOString(),
        _topic: null,
        _slot_window_minutes: 30,
      });
      if (error) throw error;
      claimResult = data;
      if (!data?.ok) {
        updateStep("claim", {
          status: "fail",
          detail: `RPC retornou ok=false: reason=${data?.reason}`,
        });
        setFinalReport({ failed_at: "claim", claimResult });
        setRunning(false);
        return;
      }
      updateStep("claim", { status: "ok", detail: `RPC ok=true · scheduled_at=${data.scheduled_at}` });
    } catch (e: any) {
      updateStep("claim", { status: "fail", detail: e.message });
      setFinalReport({ failed_at: "claim", error: e.message });
      setRunning(false);
      return;
    }

    // 4. verify project status
    updateStep("verify_proj", { status: "running" });
    let projRow: any = null;
    try {
      const { data, error } = await supabase
        .from("video_projects")
        .select("id, status, channel_id_ref, scheduled_at")
        .eq("id", selectedProject)
        .maybeSingle();
      if (error) throw error;
      projRow = data;
      if (data?.status === "ready_for_production") {
        updateStep("verify_proj", {
          status: "ok",
          detail: `status=ready_for_production · channel_id_ref=${data.channel_id_ref?.slice(0,8)}… · scheduled_at=${data.scheduled_at}`,
        });
      } else {
        updateStep("verify_proj", {
          status: "fail",
          detail: `Esperado 'ready_for_production', recebido '${data?.status}'`,
        });
      }
    } catch (e: any) {
      updateStep("verify_proj", { status: "fail", detail: e.message });
    }

    // 5. verify channel_schedule
    updateStep("verify_sched", { status: "running" });
    let schedRow: any = null;
    try {
      const { data, error } = await supabase
        .from("channel_schedule")
        .select("id, status, scheduled_at, project_id, channel_id")
        .eq("project_id", selectedProject)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      schedRow = data;
      if (data?.id && data.status === "scheduled") {
        updateStep("verify_sched", {
          status: "ok",
          detail: `schedule_id=${data.id.slice(0,8)}… · status=${data.status}`,
        });
      } else {
        updateStep("verify_sched", {
          status: "fail",
          detail: data
            ? `Encontrado mas status='${data.status}' (esperado 'scheduled')`
            : "Nenhum registro em channel_schedule para este projeto.",
        });
      }
    } catch (e: any) {
      updateStep("verify_sched", { status: "fail", detail: e.message });
    }

    setFinalReport({
      claimResult,
      project: projRow,
      schedule: schedRow,
    });
    setRunning(false);

    const allOk = ["claim","verify_proj","verify_sched"].every(
      (id) => steps.find(s => s.id === id)?.status !== "fail"
    );
    if (allOk) toast.success("Fluxo E2E completo ✅");
  };

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Teste E2E — Enviar para Produção
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Roda o fluxo completo de agendamento de 1 projeto e valida que <code>claim_publish_slot</code>{" "}
              criou o registro em <code>channel_schedule</code> e mudou o status do projeto para{" "}
              <code>ready_for_production</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { resetSteps(); loadCandidates(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recarregar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração do teste</CardTitle>
            <CardDescription>
              Escolha um canal e um projeto em rascunho. O teste vai marcá-lo como pronto para produção
              no horário escolhido (não publica de verdade — só agenda).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger><SelectValue placeholder="Escolha um canal" /></SelectTrigger>
                  <SelectContent>
                    {channels.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Nenhum canal encontrado na sua conta.
                      </div>
                    )}
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.channel_name}{c.autopilot_enabled ? " · 🤖" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Projeto (em draft / pré-produção)</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger><SelectValue placeholder="Escolha um projeto" /></SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Nenhum projeto elegível. Crie um roteiro primeiro.
                      </div>
                    )}
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="truncate">
                          [{p.status}] {p.title?.slice(0, 60) ?? "Sem título"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sched">Publicar em</Label>
              <Input
                id="sched"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Default = amanhã 18:00. Pode usar qualquer data &gt; agora.
              </p>
            </div>

            <Button onClick={runE2E} disabled={running} className="w-full gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {running ? "Rodando teste E2E…" : "Executar teste E2E"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <StatusIcon status={s.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{s.label}</div>
                  {s.detail && (
                    <div className="text-xs text-muted-foreground mt-1 break-words">{s.detail}</div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    s.status === "ok"   ? "text-emerald-500 border-emerald-500/30" :
                    s.status === "fail" ? "text-destructive border-destructive/30" :
                    s.status === "running" ? "text-primary border-primary/30" :
                    "text-muted-foreground"
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {finalReport && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado bruto (debug)</CardTitle>
              <CardDescription>Resposta completa de cada etapa</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-[11px] bg-secondary/30 p-3 rounded overflow-auto max-h-96 border border-border">
{JSON.stringify(finalReport, null, 2)}
              </pre>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => navigate("/autopilot")}>
                  Ver projeto no AutoPilot
                </Button>
                <Button size="sm" variant="outline" onClick={() => { resetSteps(); }}>
                  Resetar e rodar de novo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
