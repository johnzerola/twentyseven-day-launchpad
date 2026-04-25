import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Telescope,
  RefreshCw,
  Loader2,
  ExternalLink,
  Clock,
  Image as ImageIcon,
  Type,
  Film,
} from "lucide-react";

interface ChannelLite {
  id: string;
  channel_name: string | null;
  niche: string | null;
}

interface ReportRow {
  id: string;
  channel_id: string;
  niche: string | null;
  week_start: string;
  status: "queued" | "running" | "done" | "failed";
  videos_analyzed: number;
  top_videos: any[];
  title_patterns: any[];
  thumbnail_patterns: any[];
  duration_insights: any;
  structure_insights: any;
  ai_summary: string | null;
  prompt_injection: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function formatViews(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r.toString().padStart(2, "0")}s`;
}

export const WeeklyReferencesCard = () => {
  const [channels, setChannels] = useState<ChannelLite[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [history, setHistory] = useState<ReportRow[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadChannels = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return [];
    const { data } = await supabase
      .from("user_channels")
      .select("id, channel_name, niche")
      .eq("user_id", userId)
      .not("niche", "is", null)
      .order("channel_name", { ascending: true });
    return (data || []) as ChannelLite[];
  }, []);

  const loadReports = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from("niche_reference_reports")
      .select("*")
      .eq("channel_id", channelId)
      .order("week_start", { ascending: false })
      .limit(8);
    const rows = (data || []) as ReportRow[];
    setHistory(rows);
    setReport(rows.find((r) => r.status === "done") || rows[0] || null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadChannels();
      setChannels(list);
      const current = selectedChannelId || list[0]?.id || null;
      setSelectedChannelId(current);
      if (current) await loadReports(current);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar referências");
    } finally {
      setLoading(false);
    }
  }, [loadChannels, loadReports, selectedChannelId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedChannelId) loadReports(selectedChannelId);
  }, [selectedChannelId, loadReports]);

  const runNow = useCallback(async () => {
    if (!selectedChannelId) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-niche-references", {
        body: { channel_id: selectedChannelId },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.ok) {
        toast.success(`Relatório atualizado (${r.videos_analyzed} vídeos analisados)`);
      } else {
        toast.warning(r?.reason || "Não foi possível gerar relatório");
      }
      await loadReports(selectedChannelId);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar relatório");
    } finally {
      setRunning(false);
    }
  }, [selectedChannelId, loadReports]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-card/50">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Telescope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Referências Virais Semanais</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vídeos top do seu nicho · padrões de título, thumbnail, duração e estrutura
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runNow}
            disabled={running || !selectedChannelId}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">
              {running ? "Coletando…" : "Atualizar agora"}
            </span>
          </Button>
        </div>

        {channels.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedChannelId || undefined}
              onValueChange={(v) => setSelectedChannelId(v)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Selecione um canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.channel_name || "Canal"}{" "}
                    {c.niche ? <span className="text-muted-foreground">· {c.niche}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {report?.week_start && (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Semana de {report.week_start}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {!loading && channels.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cadastre um canal com nicho definido para receber referências semanais.
          </div>
        )}

        {!loading && selectedChannel && !report && (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhum relatório ainda para <strong>{selectedChannel.channel_name}</strong>.
            </p>
            <Button onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Coletar referências agora
            </Button>
          </div>
        )}

        {!loading && report?.status === "running" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Coletando vídeos do nicho…
          </div>
        )}

        {!loading && report?.status === "failed" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <strong>Falha:</strong> {report.error_message || "Erro desconhecido"}
          </div>
        )}

        {!loading && report?.status === "done" && (
          <>
            {report.ai_summary && (
              <div className="rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                {report.ai_summary}
              </div>
            )}

            {/* Top videos grid */}
            {Array.isArray(report.top_videos) && report.top_videos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Film className="h-4 w-4" /> Top {report.top_videos.length} vídeos da semana
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {report.top_videos.slice(0, 8).map((v: any) => (
                    <a
                      key={v.video_id}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg overflow-hidden border bg-card hover:border-primary/50 transition-colors"
                    >
                      {v.thumbnail && (
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <img
                            src={v.thumbnail}
                            alt={v.title}
                            loading="lazy"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute bottom-1 right-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                            {formatDuration(v.duration_seconds)}
                          </div>
                        </div>
                      )}
                      <div className="p-2 space-y-1">
                        <p className="text-xs font-medium line-clamp-2 leading-snug">
                          {v.title}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{formatViews(v.views)} views</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Title patterns */}
              {Array.isArray(report.title_patterns) && report.title_patterns.length > 0 && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" /> Padrões de título
                  </h4>
                  <ul className="space-y-2 text-xs">
                    {report.title_patterns.map((p: any, i: number) => (
                      <li key={i} className="leading-relaxed">
                        <strong className="text-foreground">{p.pattern}</strong>
                        {p.why_works && (
                          <span className="text-muted-foreground"> — {p.why_works}</span>
                        )}
                        {Array.isArray(p.examples) && p.examples[0] && (
                          <div className="text-muted-foreground italic mt-0.5 truncate">
                            ex: "{p.examples[0]}"
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thumbnail patterns */}
              {Array.isArray(report.thumbnail_patterns) && report.thumbnail_patterns.length > 0 && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Padrões visuais
                  </h4>
                  <ul className="space-y-2 text-xs">
                    {report.thumbnail_patterns.map((p: any, i: number) => (
                      <li key={i} className="leading-relaxed">
                        <strong className="text-foreground">{p.style}</strong>
                        <span className="text-muted-foreground">
                          {" "}· {p.emotion} — {p.ctr_signal}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duration */}
              {report.duration_insights?.sweet_spot_seconds && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Duração ideal
                  </h4>
                  <div className="text-2xl font-bold">
                    {formatDuration(report.duration_insights.sweet_spot_seconds)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faixa típica: {formatDuration(report.duration_insights.p25_seconds)} —{" "}
                    {formatDuration(report.duration_insights.p75_seconds)} · baseado em{" "}
                    {report.duration_insights.sample_size} vídeos
                  </p>
                </div>
              )}

              {/* Structure */}
              {report.structure_insights && Object.keys(report.structure_insights).length > 0 && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Film className="h-4 w-4 text-primary" /> Estrutura narrativa
                  </h4>
                  {Array.isArray(report.structure_insights.hook_styles) && (
                    <div className="text-xs">
                      <span className="font-medium">Hooks:</span>{" "}
                      <span className="text-muted-foreground">
                        {report.structure_insights.hook_styles.slice(0, 3).join(" · ")}
                      </span>
                    </div>
                  )}
                  {Array.isArray(report.structure_insights.acts) && (
                    <div className="text-xs space-y-0.5">
                      {report.structure_insights.acts.map((a: any, i: number) => (
                        <div key={i}>
                          <span className="font-medium">
                            {a.name} ({Math.round(a.avg_seconds)}s):
                          </span>{" "}
                          <span className="text-muted-foreground">{a.purpose}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {Array.isArray(report.structure_insights.retention_tactics) && (
                    <div className="text-xs">
                      <span className="font-medium">Retenção:</span>
                      <ul className="list-disc pl-5 text-muted-foreground mt-0.5">
                        {report.structure_insights.retention_tactics.slice(0, 4).map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {history.length > 1 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Semanas anteriores:</p>
                <div className="flex flex-wrap gap-1.5">
                  {history.map((h) => (
                    <Badge
                      key={h.id}
                      variant={h.id === report.id ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setReport(h)}
                    >
                      {h.week_start}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
