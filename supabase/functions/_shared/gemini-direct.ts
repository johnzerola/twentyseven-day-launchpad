// Shared Gemini Direct API helpers — bypass Lovable AI Gateway
// Uses GOOGLE_AI_API_KEY for direct access to Gemini models

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Retry a fetch call with exponential backoff on 429/5xx errors */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3,
  label = "Gemini"
): Promise<globalThis.Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      return res;
    }
    // 429 or 5xx → retry with backoff
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15000);
      console.warn(`[${label}] ${res.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    } else {
      return res; // return the failed response on last attempt
    }
  }
  throw new Error("Unreachable");
}

export function sanitizeUnicode(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '\uFFFD')
             .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

/** Map OpenAI-style model names to Gemini model names */
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

/**
 * OpenAI-compatible wrapper for Gemini API.
 * Accepts the same format as the Lovable AI Gateway and converts to Gemini native format.
 * Supports: messages, tools, tool_choice, streaming, temperature, max_tokens, JSON mode.
 * Returns OpenAI-compatible response format.
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
        
        // Add schema instruction to system prompt
        const schemaInstruction = `\n\nYou MUST respond with ONLY valid JSON matching this exact schema:\n${JSON.stringify(schema, null, 2)}\n\nDo NOT wrap in markdown. Output ONLY the JSON object.`;
        if (systemInstruction) {
          systemInstruction.parts[0].text += schemaInstruction;
        } else {
          contents.unshift({ role: "user", parts: [{ text: schemaInstruction }] });
        }
      }
    }
  } else if (body.tools?.length && !body.tool_choice) {
    // Native Gemini function calling (for chat-assistant style)
    // Convert OpenAI tools to Gemini format
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

    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
    
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

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`Gemini ${model} error ${res.status}:`, t.slice(0, 500));
    return new Response(JSON.stringify({ error: `Gemini error: ${res.status}` }), { status: res.status });
  }

  const data = await res.json();

  // For jsonMode (tool_choice), wrap result in OpenAI tool_calls format
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

/** Stream Gemini response as OpenAI SSE format */
async function streamGeminiAsOpenAI(apiKey: string, model: string, geminiBody: any): Promise<Response> {
  const res = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

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

/** Generate text embedding using Google's text-embedding-004 model */
export async function generateEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${GEMINI_BASE}/text-embedding-004:embedContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: sanitizeUnicode(text.slice(0, 2000)) }] },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const embedding = data.embedding?.values;
    if (!Array.isArray(embedding)) return null;
    // text-embedding-004 returns 768-dim by default
    return embedding;
  } catch (e) {
    console.error("Embedding generation error:", e);
    return null;
  }
}
