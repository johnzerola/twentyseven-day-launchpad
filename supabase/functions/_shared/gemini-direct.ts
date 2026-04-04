// Shared Gemini Direct API helpers — bypass Lovable AI Gateway
// Uses GOOGLE_AI_API_KEY for direct access to Gemini models

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function sanitizeUnicode(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
             .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

/** Transform Gemini SSE stream to OpenAI-compatible SSE stream */
export function geminiSseToOpenAi(geminiBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = geminiBody.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';

  function processLine(line: string, ctrl: ReadableStreamDefaultController<Uint8Array>) {
    if (!line.startsWith('data: ')) return;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') return;
    try {
      const p = JSON.parse(jsonStr);
      const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      }
    } catch { /* partial JSON, skip */ }
  }

  return new ReadableStream({
    async pull(ctrl) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buf.trim()) for (const l of buf.split('\n')) processLine(l.trim(), ctrl);
          ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
          ctrl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          processLine(buf.slice(0, idx).trim(), ctrl);
          buf = buf.slice(idx + 1);
        }
      }
    }
  });
}

/** Non-streaming Gemini call. Returns text content. */
export async function callGemini(
  apiKey: string, system: string, userMsg: string,
  opts: { model?: string; maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const model = opts.model || 'gemini-2.5-pro';
  const s = sanitizeUnicode(system);
  const u = sanitizeUnicode(userMsg);
  const genConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.8,
    maxOutputTokens: opts.maxTokens || 8192,
  };
  if (opts.jsonMode) genConfig.responseMimeType = "application/json";

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: s }] },
      contents: [{ role: "user", parts: [{ text: u }] }],
      generationConfig: genConfig,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini ${model} error ${res.status}:`, t);
    throw new Error(`GEMINI_ERROR_${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/** Non-streaming with fallback model */
export async function callGeminiWithFallback(
  apiKey: string, system: string, userMsg: string,
  opts: { primaryModel?: string; fallbackModel?: string; maxTokens?: number; label?: string; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const models = [opts.primaryModel || 'gemini-2.5-pro', opts.fallbackModel].filter(Boolean) as string[];
  for (const model of models) {
    try {
      return await callGemini(apiKey, system, userMsg, { model, maxTokens: opts.maxTokens, temperature: opts.temperature, jsonMode: opts.jsonMode });
    } catch (e) {
      console.error(`[${opts.label || 'Gemini'}] ${model} failed:`, e);
      if (model === models[models.length - 1]) throw e;
    }
  }
  throw new Error("All Gemini models failed");
}

/** Streaming Gemini call. Returns Response with OpenAI-compatible SSE body. */
export async function callGeminiStreaming(
  apiKey: string, system: string, userMsg: string,
  opts: { primaryModel?: string; fallbackModel?: string; maxTokens?: number; label?: string }
): Promise<Response> {
  const models = [opts.primaryModel || 'gemini-2.5-pro', opts.fallbackModel].filter(Boolean) as string[];
  const s = sanitizeUnicode(system);
  const u = sanitizeUnicode(userMsg);

  for (const model of models) {
    const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: s }] },
        contents: [{ role: "user", parts: [{ text: u }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: opts.maxTokens || 16384 },
      }),
    });
    if (res.ok) {
      console.log(`[${opts.label || 'Gemini'}] Streaming with ${model}`);
      return new Response(geminiSseToOpenAi(res.body!));
    }
    const t = await res.text();
    console.error(`[${opts.label || 'Gemini'}] ${model} streaming error ${res.status}:`, t);
    if (model === models[models.length - 1]) throw new Error(`Gemini streaming error: ${res.status}`);
  }
  throw new Error("All Gemini streaming models failed");
}
