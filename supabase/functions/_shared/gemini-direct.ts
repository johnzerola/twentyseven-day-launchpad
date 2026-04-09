// Shared Gemini Direct API helpers — Direct GOOGLE_AI_API_KEY PRIMARY, Lovable AI Gateway FALLBACK
// Uses GOOGLE_AI_API_KEY first (zero credit cost), falls back to LOVABLE_API_KEY gateway

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Check if a 429 is a quota exhaustion (not just rate limit) */
function isQuotaExhausted(responseText: string): boolean {
  return responseText.includes("RESOURCE_EXHAUSTED") || responseText.includes("exceeded your current quota");
}

/** Retry a fetch call with exponential backoff on 429/5xx errors */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  label = "API"
): Promise<globalThis.Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 403)) {
      return res;
    }
    // 403 PERMISSION_DENIED — immediate return for fallback
    if (res.status === 403) {
      const bodyText = await res.text();
      console.warn(`[${label}] 403 Permission Denied`);
      return new Response(bodyText, { status: 403 });
    }
    // 429 — check if quota exhausted
    if (res.status === 429) {
      const bodyText = await res.text();
      if (isQuotaExhausted(bodyText)) {
        console.warn(`[${label}] Quota exhausted`);
        return new Response(bodyText, { status: 429, headers: { "X-Quota-Exhausted": "true" } });
      }
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
        console.warn(`[${label}] 429 on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return new Response(bodyText, { status: 429 });
    }
    // 5xx — retry
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
      console.warn(`[${label}] ${res.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    } else {
      return res;
    }
  }
  throw new Error("Unreachable");
}

export function sanitizeUnicode(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
             .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

function shouldFallback(res: Response): boolean {
  return res.status === 429 || res.status === 403;
}

/** Map OpenAI-style model names to Gemini model names (for direct API) */
export function mapModel(model: string): string {
  const m: Record<string, string> = {
    "google/gemini-2.5-pro": "gemini-2.5-pro",
    "google/gemini-2.5-flash": "gemini-2.5-flash",
    "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "google/gemini-3-flash-preview": "gemini-2.5-flash",
    "google/gemini-3.1-flash-image-preview": "gemini-2.5-flash",
    "google/gemini-3-pro-image-preview": "gemini-2.5-pro",
    "google/gemini-3.1-pro-preview": "gemini-2.5-pro",
    "openai/gpt-5": "gemini-2.5-pro",
    "openai/gpt-5-mini": "gemini-2.5-flash",
    "openai/gpt-5-nano": "gemini-2.5-flash-lite",
    "openai/gpt-5.2": "gemini-2.5-pro",
  };
  return m[model] || model.replace("google/", "");
}

// ═══════════════════════════════════════════════════════════════
// PRIMARY: Direct Google AI API (uses GOOGLE_AI_API_KEY — zero credit cost)
// FALLBACK: Lovable AI Gateway (uses Lovable credits — only when direct fails)
// ═══════════════════════════════════════════════════════════════

/** Call Lovable AI Gateway (OpenAI-compatible) */
async function callLovableGateway(body: {
  model: string; messages: any[]; tools?: any[]; tool_choice?: any;
  stream?: boolean; temperature?: number; max_tokens?: number; response_format?: any;
}): Promise<globalThis.Response> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
  
  console.log(`[LovableGateway] Calling with model ${body.model}`);
  const res = await fetchWithRetry(LOVABLE_GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
    body: JSON.stringify(body),
  }, 2, `LovableGateway-${body.model}`);
  return res;
}

/** Call Direct Google AI API as fallback */
async function callDirectGemini(
  apiKey: string, model: string, geminiBody: any, label: string
): Promise<globalThis.Response> {
  return await fetchWithRetry(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  }, 3, label);
}

/** Convert OpenAI tool definitions to Gemini functionDeclarations */
function convertTools(openaiTools: any[]): any[] {
  return openaiTools
    .filter((t: any) => t.type === "function")
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} },
    }));
}

/** Convert OpenAI messages to Gemini contents */
function convertMessages(messages: any[]): { systemInstruction?: any; contents: any[] } {
  let systemText = "";
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemText += (systemText ? "\n\n" : "") + msg.content;
    } else if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: sanitizeUnicode(msg.content || "") }] });
    } else if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        const parts = msg.content ? [{ text: msg.content }] : [];
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}"),
            },
          });
        }
        contents.push({ role: "model", parts });
      } else {
        contents.push({ role: "model", parts: [{ text: sanitizeUnicode(msg.content || "") }] });
      }
    } else if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: msg.name || "tool_result",
            response: { result: msg.content },
          },
        }],
      });
    }
  }

  const result: any = { contents };
  if (systemText) {
    result.systemInstruction = { parts: [{ text: sanitizeUnicode(systemText) }] };
  }
  return result;
}

/** Helper: convert messages to OpenAI format for gateway */
function toOpenAIMessages(systemInstruction: any, contents: any[]): any[] {
  const msgs: any[] = [];
  if (systemInstruction?.parts?.[0]?.text) {
    msgs.push({ role: "system", content: systemInstruction.parts[0].text });
  }
  for (const c of contents) {
    const role = c.role === "model" ? "assistant" : "user";
    const text = c.parts?.[0]?.text || c.parts?.[0]?.functionResponse?.response?.result || "";
    msgs.push({ role, content: text });
  }
  return msgs;
}

/**
 * OpenAI-compatible wrapper for Gemini API.
 * PRIMARY: Direct Google AI API. FALLBACK: Lovable AI Gateway.
 */
export async function callGeminiOpenAICompat(
  apiKey: string,
  body: {
    model: string;
    messages: any[];
    tools?: any[];
    tool_choice?: any;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    response_format?: any;
  }
): Promise<Response> {
  // ═══ PRIMARY: Direct Google AI API (zero credit cost) ═══
  const directApiKey = apiKey || Deno.env.get("GOOGLE_AI_API_KEY");
  const model = mapModel(body.model);
  const { systemInstruction, contents } = convertMessages(body.messages);
  const genConfig: Record<string, unknown> = {};
  
  if (body.temperature !== undefined) genConfig.temperature = body.temperature;
  if (body.max_tokens) genConfig.maxOutputTokens = body.max_tokens;

  let directFailed = false;

  if (directApiKey) {
    try {
      // Handle tool_choice → force JSON mode with schema in prompt
      if (body.tools?.length && body.tool_choice) {
        const toolName = typeof body.tool_choice === "object" ? body.tool_choice?.function?.name : null;
        
        if (toolName) {
          const targetTool = body.tools.find((t: any) => t.function?.name === toolName);
          if (targetTool) {
            const schema = targetTool.function.parameters;
            genConfig.responseMimeType = "application/json";
            
            const schemaInstruction = `\n\nYou MUST respond with ONLY valid JSON matching this exact schema:\n${JSON.stringify(schema, null, 2)}\n\nDo NOT wrap in markdown. Output ONLY the JSON object.`;
            if (systemInstruction) {
              systemInstruction.parts[0].text += schemaInstruction;
            } else {
              contents.unshift({ role: "user", parts: [{ text: schemaInstruction }] });
            }
          }
        }
      }

      if (body.tools?.length && !body.tool_choice) {
        const geminiTools = [{
          functionDeclarations: convertTools(body.tools),
        }];
        
        const geminiBody: any = {
          contents,
          tools: geminiTools,
          generationConfig: genConfig,
        };
        if (systemInstruction) geminiBody.systemInstruction = systemInstruction;

        if (body.stream) {
          return streamGeminiAsOpenAI(directApiKey, model, geminiBody);
        }

        const res = await callDirectGemini(directApiKey, model, geminiBody, `Gemini-tools-${model}`);
        
        if (res.ok) {
          const data = await res.json();
          return new Response(JSON.stringify(convertGeminiToOpenAI(data)), {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!shouldFallback(res)) {
          const t = await res.text();
          console.error(`Gemini ${model} error ${res.status}:`, t.slice(0, 500));
          return new Response(JSON.stringify({ error: `Gemini error: ${res.status}` }), { status: res.status });
        }
        directFailed = true;
        console.warn(`[callGeminiOpenAICompat] Direct API ${res.status}, falling back to Lovable Gateway`);
      } else {
        // Standard (non-tool) request
        const geminiBody: any = { contents, generationConfig: genConfig };
        if (systemInstruction) geminiBody.systemInstruction = systemInstruction;

        if (body.stream) {
          const streamRes = await fetchWithRetry(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${directApiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(geminiBody),
          }, 3, `Gemini-stream-${model}`);
          if (streamRes.ok) {
            return new Response(geminiSseToOpenAi(streamRes.body!), { headers: { "Content-Type": "text/event-stream" } });
          }
          if (!shouldFallback(streamRes)) {
            const t = await streamRes.text();
            return new Response(JSON.stringify({ error: `Gemini streaming error: ${streamRes.status}` }), { status: streamRes.status });
          }
          directFailed = true;
          console.warn(`[callGeminiOpenAICompat] Direct stream ${streamRes.status}, falling back to Gateway`);
        } else {
          const res = await callDirectGemini(directApiKey, model, geminiBody, `Gemini-std-${model}`);
          if (res.ok) {
            const data = await res.json();
            if (body.tool_choice && typeof body.tool_choice === "object" && body.tool_choice?.function?.name) {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
              return new Response(JSON.stringify({
                choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: `call_${Date.now()}`, type: "function", function: { name: body.tool_choice.function.name, arguments: text } }] } }],
              }), { headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify(convertGeminiToOpenAI(data)), { headers: { "Content-Type": "application/json" } });
          }
          if (!shouldFallback(res)) {
            const t = await res.text();
            return new Response(JSON.stringify({ error: `Gemini error: ${res.status}` }), { status: res.status });
          }
          directFailed = true;
          console.warn(`[callGeminiOpenAICompat] Direct API ${res.status}, falling back to Gateway`);
        }
      }
    } catch (e) {
      directFailed = true;
      console.warn(`[callGeminiOpenAICompat] Direct API error, falling back to Gateway:`, e);
    }
  } else {
    directFailed = true;
  }

  // ═══ FALLBACK: Lovable AI Gateway (uses credits) ═══
  if (directFailed) {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey) {
      try {
        const gatewayRes = await callLovableGateway(body);
        if (gatewayRes.ok) {
          if (body.stream && gatewayRes.body) {
            return new Response(gatewayRes.body, { headers: { "Content-Type": "text/event-stream" } });
          }
          return gatewayRes;
        }
        if (gatewayRes.status === 402) {
          console.error(`[callGeminiOpenAICompat] Lovable Gateway 402 — INSUFFICIENT_CREDITS`);
          return new Response(JSON.stringify({ error: "INSUFFICIENT_CREDITS" }), { status: 402 });
        }
        console.warn(`[callGeminiOpenAICompat] Lovable Gateway returned ${gatewayRes.status}`);
      } catch (e) {
        console.warn(`[callGeminiOpenAICompat] Lovable Gateway error:`, e);
      }
    }
  }

  return new Response(JSON.stringify({ error: "All AI providers failed" }), { status: 500 });

  // ═══ FALLBACK: Direct Google AI API ═══
  const model = mapModel(body.model);
  const { systemInstruction, contents } = convertMessages(body.messages);
  const genConfig: Record<string, unknown> = {};
  
  if (body.temperature !== undefined) genConfig.temperature = body.temperature;
  if (body.max_tokens) genConfig.maxOutputTokens = body.max_tokens;

  // Handle tool_choice → force JSON mode with schema in prompt
  if (body.tools?.length && body.tool_choice) {
    const toolName = typeof body.tool_choice === "object" ? body.tool_choice?.function?.name : null;
    
    if (toolName) {
      const targetTool = body.tools.find((t: any) => t.function?.name === toolName);
      if (targetTool) {
        const schema = targetTool.function.parameters;
        genConfig.responseMimeType = "application/json";
        
        const schemaInstruction = `\n\nYou MUST respond with ONLY valid JSON matching this exact schema:\n${JSON.stringify(schema, null, 2)}\n\nDo NOT wrap in markdown. Output ONLY the JSON object.`;
        if (systemInstruction) {
          systemInstruction.parts[0].text += schemaInstruction;
        } else {
          contents.unshift({ role: "user", parts: [{ text: schemaInstruction }] });
        }
      }
    }
  } else if (body.tools?.length && !body.tool_choice) {
    const geminiTools = [{
      functionDeclarations: convertTools(body.tools),
    }];
    
    const geminiBody: any = {
      contents,
      tools: geminiTools,
      generationConfig: genConfig,
    };
    if (systemInstruction) geminiBody.systemInstruction = systemInstruction;

    if (body.stream) {
      return streamGeminiAsOpenAI(apiKey, model, geminiBody);
    }

    const res = await callDirectGemini(apiKey, model, geminiBody, `Gemini-tools-${model}`);
    
    if (!res.ok) {
      const t = await res.text();
      console.error(`Gemini ${model} error ${res.status}:`, t.slice(0, 500));
      return new Response(JSON.stringify({ error: `Gemini error: ${res.status}` }), { status: res.status });
    }
    
    const data = await res.json();
    return new Response(JSON.stringify(convertGeminiToOpenAI(data)), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Standard (non-tool) request
  const geminiBody: any = {
    contents,
    generationConfig: genConfig,
  };
  if (systemInstruction) geminiBody.systemInstruction = systemInstruction;

  if (body.stream) {
    return streamGeminiAsOpenAI(apiKey, model, geminiBody);
  }

  const res = await callDirectGemini(apiKey, model, geminiBody, `Gemini-std-${model}`);

  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini ${model} error ${res.status}:`, t.slice(0, 500));
    return new Response(JSON.stringify({ error: `Gemini error: ${res.status}` }), { status: res.status });
  }

  const data = await res.json();

  if (body.tool_choice && typeof body.tool_choice === "object" && body.tool_choice?.function?.name) {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return new Response(JSON.stringify({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: `call_${Date.now()}`,
            type: "function",
            function: {
              name: body.tool_choice.function.name,
              arguments: text,
            },
          }],
        },
      }],
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(convertGeminiToOpenAI(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

/** Convert Gemini response to OpenAI format */
function convertGeminiToOpenAI(geminiData: any): any {
  const candidate = geminiData.candidates?.[0];
  if (!candidate) {
    return { choices: [{ message: { role: "assistant", content: "" } }] };
  }

  const parts = candidate.content?.parts || [];
  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const functionCalls = parts.filter((p: any) => p.functionCall);

  if (functionCalls.length > 0) {
    return {
      choices: [{
        message: {
          role: "assistant",
          content: textParts.join("") || null,
          tool_calls: functionCalls.map((fc: any, i: number) => ({
            id: `call_${Date.now()}_${i}`,
            type: "function",
            function: {
              name: fc.functionCall.name,
              arguments: JSON.stringify(fc.functionCall.args || {}),
            },
          })),
        },
      }],
    };
  }

  return {
    choices: [{
      message: {
        role: "assistant",
        content: textParts.join("") || "",
      },
    }],
  };
}

/** Stream Gemini response as OpenAI SSE format — FALLBACK only (direct API) */
async function streamGeminiAsOpenAI(apiKey: string, model: string, geminiBody: any): Promise<Response> {
  const res = await fetchWithRetry(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  }, 3, `Gemini-stream-${model}`);

  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini streaming ${model} error ${res.status}:`, t.slice(0, 500));
    return new Response(JSON.stringify({ error: `Gemini streaming error: ${res.status}` }), { status: res.status });
  }

  return new Response(geminiSseToOpenAi(res.body!), {
    headers: { "Content-Type": "text/event-stream" },
  });
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

/**
 * Non-streaming call.
 * PRIMARY: Lovable AI Gateway. FALLBACK: Direct Google AI API.
 */
export async function callGemini(
  apiKey: string, system: string, userMsg: string,
  opts: { model?: string; maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const model = opts.model || 'gemini-2.5-pro';
  const s = sanitizeUnicode(system);
  const u = sanitizeUnicode(userMsg);

  // ═══ PRIMARY: Lovable AI Gateway ═══
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      console.log(`[callGemini] PRIMARY: Lovable Gateway with google/${model}`);
      const gatewayBody: any = {
        model: `google/${model}`,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.maxTokens || 8192,
      };
      if (opts.jsonMode) {
        gatewayBody.response_format = { type: "json_object" };
      }
      const res = await callLovableGateway(gatewayBody);
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) return content;
      }
      // 402 = credits exhausted — do NOT fallback, fail immediately
      if (res.status === 402) {
        console.error(`[callGemini] Lovable Gateway 402 — INSUFFICIENT_CREDITS, stopping`);
        throw new Error("INSUFFICIENT_CREDITS");
      }
      console.warn(`[callGemini] Lovable Gateway returned ${res.status}, trying direct API`);
    } catch (e) {
      if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") throw e;
      console.warn(`[callGemini] Lovable Gateway error, trying direct API:`, e);
    }
  }

  // ═══ FALLBACK: Direct Google AI API ═══
  console.log(`[callGemini] FALLBACK: Direct API with ${model}`);
  const genConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.8,
    maxOutputTokens: opts.maxTokens || 8192,
  };
  if (opts.jsonMode) genConfig.responseMimeType = "application/json";

  const res = await callDirectGemini(apiKey, model, {
    systemInstruction: { parts: [{ text: s }] },
    contents: [{ role: "user", parts: [{ text: u }] }],
    generationConfig: genConfig,
  }, `Gemini-callDirect-${model}`);

  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini ${model} error ${res.status}:`, t);
    throw new Error(`GEMINI_ERROR_${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Non-streaming with fallback model.
 * PRIMARY: Lovable AI Gateway. FALLBACK: Direct Google AI API with model chain.
 */
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
  throw new Error("All models failed");
}

/**
 * Streaming call.
 * PRIMARY: Lovable AI Gateway (streaming). FALLBACK: Direct Google AI API.
 */
export async function callGeminiStreaming(
  apiKey: string, system: string, userMsg: string,
  opts: { primaryModel?: string; fallbackModel?: string; maxTokens?: number; label?: string }
): Promise<Response> {
  const models = [opts.primaryModel || 'gemini-2.5-pro', opts.fallbackModel].filter(Boolean) as string[];
  const label = opts.label || 'Streaming';

  // ═══ PRIMARY: Lovable AI Gateway (streaming) ═══
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    try {
      console.log(`[${label}] PRIMARY: Lovable Gateway streaming with google/${models[0]}`);
      const res = await fetchWithRetry(LOVABLE_GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: `google/${models[0]}`,
          messages: [{ role: "system", content: system }, { role: "user", content: userMsg }],
          stream: true,
          max_tokens: opts.maxTokens || 16384,
        }),
      }, 2, `LovableGateway-stream-${models[0]}`);

      if (res.ok && res.body) {
        console.log(`[${label}] Streaming via Lovable Gateway with google/${models[0]}`);
        return new Response(res.body, { headers: { "Content-Type": "text/event-stream" } });
      }
      // 402 = credits exhausted — return 402 immediately, do NOT fallback
      if (res.status === 402) {
        console.error(`[${label}] Lovable Gateway 402 — INSUFFICIENT_CREDITS, NOT falling back`);
        return new Response(JSON.stringify({ error: "INSUFFICIENT_CREDITS" }), { status: 402 });
      }
      console.warn(`[${label}] Lovable Gateway returned ${res.status}, falling back to direct API`);
    } catch (e) {
      console.warn(`[${label}] Lovable Gateway error, falling back to direct API:`, e);
    }
  }

  // ═══ FALLBACK: Direct Google AI API ═══
  const s = sanitizeUnicode(system);
  const u = sanitizeUnicode(userMsg);

  for (const model of models) {
    const res = await fetchWithRetry(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: s }] },
        contents: [{ role: "user", parts: [{ text: u }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: opts.maxTokens || 16384 },
      }),
    }, 3, `Gemini-streamFallback-${model}`);

    if (res.ok) {
      console.log(`[${label}] Streaming via direct API with ${model}`);
      return new Response(geminiSseToOpenAi(res.body!));
    }
    const t = await res.text();
    console.error(`[${label}] ${model} streaming error ${res.status}:`, t.slice(0, 300));
    if (model === models[models.length - 1]) throw new Error(`All streaming models failed: ${res.status}`);
  }
  throw new Error("All streaming models failed");
}

/**
 * Call Lovable AI Gateway directly (for non-Gemini models like GPT-5).
 * No fallback — only works via gateway.
 */
export async function callLovableAI(
  system: string, userMsg: string,
  opts: { model?: string; maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

  const model = opts.model || 'google/gemini-2.5-flash';
  const body: any = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens || 8192,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetchWithRetry(LOVABLE_GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
    body: JSON.stringify(body),
  }, 2, `LovableAI-${model}`);

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LovableAI ${model} error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Generate text embedding using Google's text-embedding-004 model */
export async function generateEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const res = await fetchWithRetry(`${GEMINI_BASE}/text-embedding-004:embedContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: sanitizeUnicode(text.slice(0, 2000)) }] },
      }),
    }, 2, "Gemini-embedding");
    if (!res.ok) return null;
    const data = await res.json();
    const embedding = data.embedding?.values;
    if (!Array.isArray(embedding)) return null;
    return embedding;
  } catch (e) {
    console.error("Embedding generation error:", e);
    return null;
  }
}
