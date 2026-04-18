import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, ChevronRight } from "lucide-react";

interface Span {
  id: string;
  span_id: string;
  parent_span_id: string | null;
  function_name: string;
  status: string;
  duration_ms: number | null;
  started_at: string;
  ended_at: string | null;
  error_message: string | null;
  input_summary: any;
  output_summary: any;
}

interface TreeNode extends Span {
  children: TreeNode[];
  depth: number;
  offsetPct: number;
  widthPct: number;
}

export const TraceWaterfall = ({ traceId }: { traceId: string }) => {
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("function_traces")
        .select("id, span_id, parent_span_id, function_name, status, duration_ms, started_at, ended_at, error_message, input_summary, output_summary")
        .eq("trace_id", traceId)
        .order("started_at", { ascending: true });
      setSpans((data as Span[]) || []);
      setLoading(false);
    };
    load();
  }, [traceId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading spans...</div>;
  if (spans.length === 0) return <div className="text-sm text-muted-foreground">No spans recorded.</div>;

  // Build tree
  const rootStart = Math.min(...spans.map(s => new Date(s.started_at).getTime()));
  const rootEnd = Math.max(...spans.map(s => s.ended_at ? new Date(s.ended_at).getTime() : Date.now()));
  const totalSpan = Math.max(rootEnd - rootStart, 1);

  const byParent = new Map<string | null, Span[]>();
  spans.forEach(s => {
    const arr = byParent.get(s.parent_span_id) || [];
    arr.push(s);
    byParent.set(s.parent_span_id, arr);
  });

  const buildTree = (parentId: string | null, depth: number): TreeNode[] => {
    const children = byParent.get(parentId) || [];
    return children.map(s => {
      const start = new Date(s.started_at).getTime();
      const end = s.ended_at ? new Date(s.ended_at).getTime() : start + (s.duration_ms || 100);
      return {
        ...s,
        depth,
        offsetPct: ((start - rootStart) / totalSpan) * 100,
        widthPct: Math.max(((end - start) / totalSpan) * 100, 0.5),
        children: buildTree(s.span_id, depth + 1),
      };
    });
  };

  const tree = buildTree(null, 0);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const statusColor = (s: string) => {
    if (s === "success") return "bg-green-500/70";
    if (s === "error") return "bg-destructive";
    if (s === "started") return "bg-yellow-500/70";
    if (s === "timeout") return "bg-orange-500/70";
    return "bg-muted-foreground";
  };

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    if (s === "error") return <AlertTriangle className="w-3 h-3 text-destructive" />;
    return <Clock className="w-3 h-3 text-yellow-500" />;
  };

  const renderNode = (node: TreeNode): JSX.Element => {
    const isExpanded = expanded.has(node.span_id);
    const hasDetails = node.error_message || node.input_summary || node.output_summary;

    return (
      <div key={node.span_id}>
        <div
          className="group hover:bg-muted/50 rounded p-2 cursor-pointer"
          onClick={() => hasDetails && toggleExpand(node.span_id)}
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        >
          <div className="flex items-center gap-2 mb-1">
            {hasDetails && (
              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            )}
            {statusIcon(node.status)}
            <span className="font-mono text-xs truncate flex-1">{node.function_name}</span>
            <Badge variant="outline" className="text-[10px]">{node.duration_ms ?? "?"}ms</Badge>
          </div>
          <div className="relative h-2 bg-muted rounded overflow-hidden">
            <div
              className={`absolute h-full ${statusColor(node.status)} rounded`}
              style={{ left: `${node.offsetPct}%`, width: `${node.widthPct}%` }}
            />
          </div>
          {isExpanded && (
            <div className="mt-2 space-y-1 text-xs bg-muted/30 p-2 rounded">
              {node.error_message && (
                <div className="text-destructive">
                  <span className="font-semibold">Error:</span> {node.error_message}
                </div>
              )}
              {node.input_summary && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Input</summary>
                  <pre className="text-[10px] overflow-x-auto mt-1">{JSON.stringify(node.input_summary, null, 2)}</pre>
                </details>
              )}
              {node.output_summary && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Output</summary>
                  <pre className="text-[10px] overflow-x-auto mt-1">{JSON.stringify(node.output_summary, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </div>
        {node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground mb-2 font-mono break-all">trace: {traceId}</div>
      <div className="text-xs text-muted-foreground mb-3">
        {spans.length} span{spans.length !== 1 ? "s" : ""} · total {Math.round(totalSpan)}ms
      </div>
      {tree.map(renderNode)}
    </div>
  );
};
