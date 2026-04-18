// Distributed tracing for edge functions.
// Usage:
//   const span = await startSpan(req, "my-function", { userId, input });
//   try { ...; await span.end("success", { result }); }
//   catch (e) { await span.end("error", null, e.message); throw e; }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const sb = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TRACE_HEADER = "x-trace-id";
const PARENT_SPAN_HEADER = "x-parent-span-id";

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  functionName: string;
  startedAt: number;
  end: (
    status: "success" | "error" | "timeout",
    output?: unknown,
    errorMessage?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}

const truncate = (data: unknown, maxLen = 500): unknown => {
  if (data == null) return null;
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return str.length > maxLen ? str.slice(0, maxLen) + "...[truncated]" : data;
  } catch {
    return "[unserializable]";
  }
};

export function getTraceContext(req: Request): { traceId: string; parentSpanId: string | null } {
  const headerTraceId = req.headers.get(TRACE_HEADER);
  const parentSpanId = req.headers.get(PARENT_SPAN_HEADER);
  return {
    traceId: headerTraceId || crypto.randomUUID(),
    parentSpanId: parentSpanId || null,
  };
}

export async function startSpan(
  req: Request,
  functionName: string,
  opts: { userId?: string | null; input?: unknown } = {}
): Promise<SpanContext> {
  const { traceId, parentSpanId } = getTraceContext(req);
  const spanId = crypto.randomUUID();
  const startedAt = Date.now();

  // Fire-and-forget insert
  sb().from("function_traces").insert({
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: parentSpanId,
    function_name: functionName,
    status: "started",
    user_id: opts.userId ?? null,
    input_summary: opts.input ? { preview: truncate(opts.input) } : null,
    started_at: new Date(startedAt).toISOString(),
  }).then(() => {}).catch(() => {});

  return {
    traceId,
    spanId,
    parentSpanId,
    functionName,
    startedAt,
    end: async (status, output, errorMessage, metadata) => {
      const endedAt = Date.now();
      sb().from("function_traces")
        .update({
          status,
          ended_at: new Date(endedAt).toISOString(),
          duration_ms: endedAt - startedAt,
          output_summary: output ? { preview: truncate(output) } : null,
          error_message: errorMessage?.slice(0, 1000) ?? null,
          metadata: metadata ?? {},
        })
        .eq("span_id", spanId)
        .then(() => {}).catch(() => {});
    },
  };
}

/**
 * Build headers for outbound calls so the trace_id propagates to children.
 */
export function tracingHeaders(span: SpanContext, extra: Record<string, string> = {}): Record<string, string> {
  return {
    [TRACE_HEADER]: span.traceId,
    [PARENT_SPAN_HEADER]: span.spanId,
    ...extra,
  };
}
