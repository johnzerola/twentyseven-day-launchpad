import { callGemini, callGeminiWithFallback } from "../_shared/gemini-direct.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toolSchemas: Record<string, any> = {
  hooks: {
    name: "return_hooks",
    description: "Return viral hook suggestions",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The hook text ready to use" },
              style: { type: "string", enum: ["curiosidade", "urgência", "polêmica", "storytelling", "choque", "empatia"] },
              tip: { type: "string", description: "Why this hook works" },
            },
            required: ["text", "style", "tip"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
  ctas: {
    name: "return_ctas",
    description: "Return call-to-action suggestions",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The CTA text ready to use" },
              style: { type: "string", description: "Type: inscrição, like, comentário, compartilhar" },
              tip: { type: "string", description: "Best placement and why it works" },
            },
            required: ["text", "style", "tip"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
  titles: {
    name: "return_titles",
    description: "Return viral title pattern suggestions",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Title pattern template" },
              example: { type: "string", description: "Concrete example for this niche" },
              style: { type: "string", enum: ["curiosidade", "urgência", "números", "contraintuitivo", "storytelling", "polêmica"] },
            },
            required: ["pattern", "example", "style"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
  stories: {
    name: "return_structures",
    description: "Return storytelling structure suggestions",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Structure name" },
              text: { type: "string", description: "Full description of how to apply" },
              tip: { type: "string", description: "Best for what type of content" },
            },
            required: ["name", "text", "tip"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
  seo: {
    name: "return_seo",
    description: "Return SEO keyword patterns",
    parameters: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Keyword pattern" },
              example: { type: "string", description: "Concrete example" },
              tip: { type: "string", description: "Search volume and competition insight" },
            },
            required: ["pattern", "example", "tip"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
};

const prompts: Record<string, string> = {
  hooks: "Gere 10 hooks virais para os primeiros 5 segundos de vídeos YouTube no nicho especificado. Cada hook deve ser pronto para usar, com variação de estilos.",
  ctas: "Gere 8 CTAs (calls-to-action) criativos e eficazes para vídeos YouTube no nicho especificado. Inclua diferentes tipos (inscrição, like, comentário, compartilhamento).",
  titles: "Gere 10 padrões de títulos virais para YouTube no nicho especificado. Cada padrão deve ter um template + exemplo concreto.",
  stories: "Gere 5 estruturas de storytelling otimizadas para retenção em vídeos YouTube no nicho especificado. Inclua fases, timing e dicas.",
  seo: "Gere 8 padrões de palavras-chave SEO para YouTube no nicho especificado. Inclua exemplos e dicas de volume/competição.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, type } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    if (!niche?.trim()) throw new Error("Niche is required");

    const schema = toolSchemas[type] || toolSchemas.hooks;
    const prompt = prompts[type] || prompts.hooks;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um especialista em YouTube viral com 25 anos de experiência. Gere conteúdo em português do Brasil. Seja criativo e prático." },
          { role: "user", content: `${prompt}\n\nNicho: ${niche}` },
        ],
        tools: [{ type: "function", function: schema }],
        tool_choice: { type: "function", function: { name: schema.name } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ results: parsed.results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-viral-db error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
