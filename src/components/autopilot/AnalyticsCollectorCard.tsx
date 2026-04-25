import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Link } from "react-router-dom";

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  mode: string;
  triggered_by: string;
  channels_processed: number;
  videos_updated: number;
  videos_failed: number;
  videos_skipped: number;
  ok: boolean;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export const AnalyticsCollectorCard = () => {
  const [lastRun, setLastRun] = useState<RunRow | null>(null);
  const [needsReauthCount, setNeedsReauthCount] = useState(0);
  const [oauthChannelCount, setOauthChannelCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const [{ data: runs }, { data: tokens }] = await Promise.all([
        supabase
          .from("analytics_collector_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(1),
        userId
          ? supabase
              .from("youtube_oauth_tokens")
              .select("id, needs_reauth")
              .eq("user_id", userId)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      setLastRun((runs?.[0] as RunRow) ?? null);
      const tokenList = (tokens as any[]) ?? [];
      setOauthChannelCount(tokenList.length);
      setNeedsReauthCount(tokenList.filter((t) => t.needs_reauth).length);
    } catch (e) {
      console.error("AnalyticsCollectorCard load error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, [load]);

  const triggerNow = async () => {
    setRunning(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke(
        "youtube-analytics-collector",
        {
          body: {
            mode: "incremental",
            user_id: userData?.user?.id,
            triggered_by: "manual",
            max_videos_per_channel: 50,
          },
        }
      );
      if (error) throw error;
      const s = (data as any)?.stats;
      toast.success(
        `Coleta concluída: ${s?.videos_updated ?? 0} atualizados, ${
          s?.videos_failed ?? 0
        } falharam`
      );
      load();
    } catch (e: any) {
      toast.error(`Falha ao coletar: ${e?.message ?? "erro desconhecido"}`);
    } finally {
      setRunning(false);
    }
  };

  const hasReauthIssue = needsReauthCount > 0;

  return (
    <Card className={hasReauthIssue ? "border-destructive/40" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Coletor de Métricas
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            auto · 4h
          </Badge>
          {lastRun?.ok === false && (
            <Badge variant="destructive" className="text-[10px]">
              última falhou
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasReauthIssue && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                {needsReauthCount} canal(is) precisa(m) reconectar
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                O acesso ao YouTube Analytics expirou. Reconecte para retomar a
                coleta automática.
              </p>
              <Button
                asChild
                size="sm"
                variant="destructive"
                className="mt-2 h-7"
              >
                <Link to="/channels">Reconectar canal</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Metric
            icon={<Clock className="w-3 h-3" />}
            label="Última coleta"
            value={
              loading
                ? "…"
                : lastRun
                ? timeAgo(lastRun.started_at)
                : "nunca"
            }
          />
          <Metric
            icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            label="Vídeos atualizados"
            value={lastRun ? String(lastRun.videos_updated) : "—"}
          />
          <Metric
            icon={<AlertTriangle className="w-3 h-3 text-destructive" />}
            label="Falhas"
            value={lastRun ? String(lastRun.videos_failed) : "—"}
          />
          <Metric
            icon={<Activity className="w-3 h-3 text-primary" />}
            label="Canais conectados"
            value={String(oauthChannelCount)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            CTR, retenção e watch time são puxados automaticamente do YouTube a
            cada 4 horas.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={triggerNow}
            disabled={running || oauthChannelCount === 0}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-2 ${running ? "animate-spin" : ""}`}
            />
            Coletar agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Metric = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="rounded-md border bg-card/40 p-2.5">
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className="text-sm font-semibold font-display">{value}</div>
  </div>
);
