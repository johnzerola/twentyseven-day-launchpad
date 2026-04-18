// Standardized inter-function caller with automatic trace propagation.
// Wraps fetch() to other edge functions and records a child span.

import { startSpan, tracingHeaders, type SpanContext } from "./tracer.ts";

export interface CallFnOptions {
  /** Parent span — used to propagate trace_id and link as child */
  parentSpan?: SpanContext;
  /** Optional original request — used if parentSpan not provided */
  parentReq?: Request;
  /** User id for the span (audit trail) */
  userId?: string | null;
  /** Timeout in ms (default 60_000) */
  timeoutMs?: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Call another edge function with trace propagation + automatic span recording.
 * Returns parsed JSON result or throws.
 */
export async function callEdgeFn<T = unknown>(
  fnName: string,
  payload: unknown,
  opts: CallFnOptions = {}
): Promise<T> {
  // Build a synthetic request that carries the parent's trace headers,
  // so startSpan can record this as a child span on the caller side.
  const headers: Record<string, string> = {};
  if (opts.parentSpan) {
    Object.assign(headers, tracingHeaders(opts.parentSpan));
  } else if (opts.parentReq) {
    const t = opts.parentReq.headers.get("x-trace-id");
    const p = opts.parentReq.headers.get("x-parent-span-id");
    if (t) headers["x-trace-id"] = t;
    if (p) headers["x-parent-span-id"] = p;
  }

  const syntheticReq = new Request("https://internal/call", { headers });
  const span = await startSpan(syntheticReq, `call:${fnName}`, {
    userId: opts.userId ?? null,
    input: payload,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        "x-trace-id": span.traceId,
        "x-parent-span-id": span.spanId,
      },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await resp.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (!resp.ok || data?.error) {
      const errMsg = data?.error || `HTTP ${resp.status}`;
      await span.end("error", data, errMsg, { http_status: resp.status });
      throw new Error(`callEdgeFn(${fnName}) failed: ${errMsg}`);
    }

    await span.end("success", data, undefined, { http_status: resp.status });
    return data as T;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      await span.end("timeout", null, `Timeout after ${opts.timeoutMs ?? 60_000}ms`);
      throw new Error(`callEdgeFn(${fnName}) timed out`);
    }
    // If we already ended (HTTP error path), this catches network errors only
    await span.end("error", null, e.message);
    throw e;
  }
}
