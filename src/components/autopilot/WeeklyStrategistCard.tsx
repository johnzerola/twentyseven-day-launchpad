import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Sparkles, Brain, RefreshCw, Calendar, Loader2 } from "lucide-react";

interface ChannelLite {
  id: string;
  channel_name: string | null;
  weekly_video_target: number | null;
  strategist_enabled: boolean | null;
  strategist_last_run_at: string | null;
}

interface PlanRow {
  id: string;
  channel_id: string;
  week_start: string;
  themes: any[];
  status: string;
  applied_project_ids: string[] | null;
  cost_usd: number | null;
  created_at: string;
}

function nextMondayLabel(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysUntilMonday = ((1 - day + 7) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export const WeeklyStrategistCard = () => {
  const [channels, setChannels] = useState<ChannelLite[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: chs } = await supabase
        .from("user_channels")
        .select("id, channel_name, weekly_video_target, strategist_enabled, strategist_last_run_at")
        .eq("user_id", userId)
        .order("channel_name", { ascending: true });

      const list = (chs || []) as ChannelLite[];
      setChannels(list);
      const current = selectedChannelId || list[0]?.id || null;
      setSelectedChannelId(current);

      if (current) {
        const { data: plans } = await supabase
          .from("weekly_strategy_plans")
          .select("id, channel_id, week_start, themes, status, applied_project_ids, cost_usd, created_at")
          .eq("channel_id", current)
          .order("week_start", { ascending: false })
          .limit(1);
        setPlan(((plans || [])[0] as PlanRow) || null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedChannelId]);

  useEffect(() => { load(); }, [load]);

  const onToggle = async (channelId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("user_channels")
      .update({ strategist_enabled: enabled })
      .eq("id", channelId);
    if (error) toast.error(`Erro: ${error.message}`);
    else {
      toast.success(enabled ? "Agente ativado" : "Agente desativado");
      load();
    }
  };

  const runNow = async () => {
    if (!selectedChannelId) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-strategy-agent", {
        body: { channel_id: selectedChannelId, force: true },
      });
      if (error) throw error;
      const result = (data?.results || [])[0];
      if (result?.status === "applied") {
        toast.success(`Plano criado: ${result.project_count} vídeos para a próxima semana`);
      } else if (result?.error) {
        toast.error(`Falhou: ${result.error}`);
      } else {
        toast.info(`Status: ${result?.status || "ok"}`);
      }
      await load();
    } catch (e: any) {
      toast.error(`Erro ao rodar: ${e?.message || e}`);
    } finally {
      setRunning(false);
    }
  };

  const selected = channels.find((c) => c.id === selectedChannelId) || null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Agente Estratégico Semanal
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            <Calendar className="h-3 w-3 mr-1" />
            próx. semana: {nextMondayLabel()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum canal configurado.</p>
        ) : (
          <>
            {/* Channel selector */}
            <div className="flex flex-wrap gap-2">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChannelId(c.id)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition ${
                    selectedChannelId === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 hover:bg-muted border-border"
                  }`}
                >
                  {c.channel_name || "Sem nome"}
                </button>
              ))}
            </div>

            {selected && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{selected.channel_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Meta: {selected.weekly_video_target ?? 1} vídeo(s)/semana · Última rodada: {timeAgo(selected.strategist_last_run_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={selected.strategist_enabled ? "default" : "secondary"}>
                      {selected.strategist_enabled ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggle(selected.id, !selected.strategist_enabled)}
                    >
                      {selected.strategist_enabled ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" onClick={runNow} disabled={running || !selected.strategist_enabled}>
                      {running ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Rodar agora
                    </Button>
                  </div>
                </div>

                {plan ? (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Plano para a semana de <strong className="text-foreground">{plan.week_start}</strong>
                      <Badge variant="outline" className="text-[10px]">
                        {plan.themes?.length || 0} temas · {plan.status}
                      </Badge>
                      {plan.cost_usd ? (
                        <span className="text-[10px]">${Number(plan.cost_usd).toFixed(4)}</span>
                      ) : null}
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                      {(plan.themes || []).map((t: any, idx: number) => (
                        <AccordionItem key={idx} value={`t-${idx}`} className="border-border/50">
                          <AccordionTrigger className="text-left text-sm py-2 hover:no-underline">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-mono text-muted-foreground mt-0.5">{idx + 1}.</span>
                              <span className="font-medium">{t.title}</span>
                              <Badge variant="outline" className="text-[10px] ml-1">
                                {t.video_type} · {t.duration_seconds}s
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-xs space-y-1 pl-6">
                            <div><strong>Tópico:</strong> {t.topic}</div>
                            <div><strong>Ângulo:</strong> {t.angle}</div>
                            <div><strong>Hook:</strong> {t.hook}</div>
                            <div className="text-muted-foreground italic"><strong>Por quê:</strong> {t.reasoning}</div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic pt-1">
                    Nenhum plano gerado ainda. Clique em "Rodar agora" ou aguarde o cron de domingo 23:00 UTC.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
