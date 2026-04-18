import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TraceWaterfall } from "@/components/admin/TraceWaterfall";
import { MetaOrchestratorRuns } from "@/components/admin/MetaOrchestratorRuns";
import { Activity, AlertTriangle, CheckCircle2, Clock, Search, RefreshCw, Brain } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TraceRow {
  trace_id: string;
  function_name: string;
  status: string;
  started_at: string;
  duration_ms: number | null;
  error_message: string | null;
  user_id: string | null;
}

export default function AdminTraces() {
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("function_traces")
      .select("trace_id, function_name, status, started_at, duration_ms, error_message, user_id")
      .is("parent_span_id", null)
      .order("started_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) query = query.ilike("function_name", `%${search}%`);

    const { data } = await query;
    setTraces((data as TraceRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (s === "error") return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (s === "started") return <Clock className="w-4 h-4 text-yellow-500" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Observability
            </h1>
            <p className="text-sm text-muted-foreground">Distributed tracing & meta-orchestrator runs</p>
          </div>
        </div>

        <Tabs defaultValue="traces" className="space-y-4">
          <TabsList>
            <TabsTrigger value="traces"><Activity className="w-4 h-4 mr-2" />Function Traces</TabsTrigger>
            <TabsTrigger value="squads"><Brain className="w-4 h-4 mr-2" />Live Squads</TabsTrigger>
          </TabsList>

          <TabsContent value="traces" className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by function name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && load()}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="started">In progress</SelectItem>
                    <SelectItem value="timeout">Timeout</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={load} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-2 max-h-[70vh] overflow-y-auto">
                {loading && <div className="p-4 text-sm text-muted-foreground">Loading traces...</div>}
                {!loading && traces.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No traces found.</div>
                )}
                <div className="divide-y">
                  {traces.map((t) => (
                    <button
                      key={t.trace_id}
                      onClick={() => setSelectedTrace(t.trace_id)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors rounded ${
                        selectedTrace === t.trace_id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {statusIcon(t.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm truncate">{t.function_name}</span>
                            <Badge variant={t.status === "error" ? "destructive" : "secondary"} className="text-xs">
                              {t.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{formatDistanceToNow(new Date(t.started_at), { addSuffix: true })}</span>
                            {t.duration_ms != null && <span>· {t.duration_ms}ms</span>}
                          </div>
                          {t.error_message && (
                            <div className="text-xs text-destructive mt-1 truncate">{t.error_message}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-4 max-h-[70vh] overflow-y-auto">
                {selectedTrace ? (
                  <TraceWaterfall traceId={selectedTrace} />
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    Select a trace to see the call tree
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="squads">
            <MetaOrchestratorRuns />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
