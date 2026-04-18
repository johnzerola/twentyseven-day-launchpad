import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, ChevronRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TraceWaterfall } from "./TraceWaterfall";

interface AgentRun {
  id: string;
  goal: string;
  status: string;
  current_step: number;
  total_steps: number;
  trace_id: string | null;
  plan: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface MemoryRow {
  id: string;
  key: string;
  value: any;
  written_by: string;
  step_index: number | null;
  created_at: string;
}

export function MetaOrchestratorRuns() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selected, setSelected] = useState<AgentRun | null>(null);
  const [memory, setMemory] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRuns((data as AgentRun[]) || []);
    setLoading(false);
  };

  const loadMemory = async (runId: string) => {
    const { data } = await supabase
      .from("agent_memory")
      .select("*")
      .eq("run_id", runId)
      .order("created_at");
    setMemory((data as MemoryRow[]) || []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (selected) loadMemory(selected.id);
  }, [selected?.id]);

  // Realtime updates for the selected run
  useEffect(() => {
    if (!selected) return;
    const ch = supabase.channel(`run-${selected.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "agent_runs",
        filter: `id=eq.${selected.id}`,
      }, (payload) => {
        setSelected((prev) => prev ? { ...prev, ...(payload.new as any) } : prev);
        load();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "agent_memory",
        filter: `run_id=eq.${selected.id}`,
      }, () => loadMemory(selected.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected?.id]);

  const statusBadge = (s: string) => {
    if (s === "completed") return <Badge variant="default" className="text-xs">✅ Completed</Badge>;
    if (s === "running") return <Badge variant="secondary" className="text-xs"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
    if (s === "planning") return <Badge variant="outline" className="text-xs">🧠 Planning</Badge>;
    if (s === "failed") return <Badge variant="destructive" className="text-xs">❌ Failed</Badge>;
    return <Badge variant="outline" className="text-xs">{s}</Badge>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-2 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between p-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Squad Runs
          </h3>
          <Button variant="ghost" size="sm" onClick={load}>Refresh</Button>
        </div>
        {loading && <div className="p-4 text-sm text-muted-foreground">Loading...</div>}
        {!loading && runs.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No runs yet.</div>
        )}
        <div className="divide-y">
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full text-left p-3 hover:bg-muted/50 transition-colors rounded ${
                selected?.id === r.id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.goal}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    <span>·</span>
                    <span>{r.current_step}/{r.total_steps} steps</span>
                  </div>
                </div>
                {statusBadge(r.status)}
              </div>
              {r.error_message && (
                <div className="text-xs text-destructive mt-1 truncate">{r.error_message}</div>
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 max-h-[70vh] overflow-y-auto">
        {!selected ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            Select a run to inspect its plan, memory, and trace
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-1">Goal</h3>
              <p className="text-sm text-muted-foreground">{selected.goal}</p>
            </div>

            {selected.plan && Array.isArray(selected.plan) && selected.plan.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Plan</h3>
                <div className="space-y-1">
                  {(selected.plan as any[]).map((step, i) => {
                    const isDone = i + 1 < selected.current_step;
                    const isCurrent = i + 1 === selected.current_step && selected.status === "running";
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-2 rounded text-xs ${
                          isCurrent ? "bg-primary/10 border border-primary/30" :
                          isDone ? "bg-muted/40" : "bg-muted/20"
                        }`}
                      >
                        <span className="font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                        <ChevronRight className="w-3 h-3 mt-1 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{step.agent}</span>
                            {isCurrent && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            {isDone && <span className="text-green-500">✓</span>}
                          </div>
                          <p className="text-muted-foreground italic">{step.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {memory.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Shared Memory ({memory.length} entries)</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {memory.map((m) => (
                    <details key={m.id} className="text-xs bg-muted/20 rounded p-2">
                      <summary className="cursor-pointer font-mono">
                        <span className="text-primary">{m.key}</span>
                        <span className="text-muted-foreground ml-2">← {m.written_by}</span>
                      </summary>
                      <pre className="mt-1 text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                        {JSON.stringify(m.value, null, 2).slice(0, 500)}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {selected.trace_id && (
              <div>
                <h3 className="font-semibold text-sm mb-2">Execution Trace</h3>
                <TraceWaterfall traceId={selected.trace_id} />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
