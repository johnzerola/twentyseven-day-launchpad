import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type = "generate" } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const headers = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    // ========== GENERATE TITLES ==========
    if (type === "generate") {
      const { niche, topic } = body;

      // Fetch reference titles from viral DB
      let viralRefBlock = '';
      try {
        let query = sb.from('viral_titles_db').select('title,views,why_viral,title_pattern,niche').order('views', { ascending: false }).limit(30);
        if (niche) query = query.ilike('niche', `%${niche}%`);
        const { data: viralTitles } = await query;
        if (viralTitles?.length) {
          viralRefBlock = `\n\nTÍTULOS VIRAIS REAIS DE REFERÊNCIA (${viralTitles.length} títulos com 350k+ views):\n${viralTitles.map((t: any) => `• "${t.title}" (${t.views?.toLocaleString()} views) — Pattern: ${t.title_pattern || '?'} | Why: ${t.why_viral || 'N/A'}`).join('\n')}\n\nUse estes padrões REAIS como inspiração. Não copie, mas aplique as mesmas técnicas.`;
        }
      } catch { /* viral DB optional */ }

      const prompt = `Gere exatamente 20 títulos virais para YouTube.
${niche ? `Nicho: ${niche}` : ''}
${topic ? `Tema específico: ${topic}` : ''}
${viralRefBlock}

Use estas metodologias virais:
- Curiosidade: perguntas abertas, "O que acontece quando...", "A verdade sobre..."
- Urgência: "Antes que seja tarde", "Pare de fazer isso AGORA"
- Números: "7 formas de...", "Os 3 erros que..."
- Contraintuitivo: "Por que [coisa boa] está te destruindo", opiniões contrárias
- Storytelling: "Como eu...", "O dia que...", narrativas pessoais
- Polêmica: títulos que geram debate, "Ninguém quer que você saiba..."

Para cada título, classifique o estilo e estime o CTR de 3 a 15%.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: "Você é um especialista em YouTube viral com foco em copywriting de alta conversão. Responda APENAS com JSON válido." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_titles",
              description: "Return viral title suggestions",
              parameters: {
                type: "object",
                properties: {
                  titles: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        style: { type: "string", enum: ["curiosidade", "urgência", "números", "contraintuitivo", "storytelling", "polêmica"] },
                        estimatedCTR: { type: "number" },
                      },
                      required: ["title", "style", "estimatedCTR"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["titles"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_titles" } },
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
      return new Response(JSON.stringify({ titles: parsed.titles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== A/B TEST ==========
    if (type === "ab-test") {
      const { titleA, titleB } = body;
      const prompt = `Analise estes 2 títulos de YouTube e determine qual performaria melhor:

Título A: "${titleA}"
Título B: "${titleB}"

Analise: CTR estimado (3-15%), gatilhos emocionais usados, SEO score (1-10), score de comprimento (1-10, ideal 50-65 chars), e uma análise comparativa detalhada de 2-3 frases explicando por que o vencedor é melhor.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um especialista em YouTube analytics e CTR optimization." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_ab_result",
              description: "Return A/B test comparison result",
              parameters: {
                type: "object",
                properties: {
                  winner: { type: "string", enum: ["A", "B"] },
                  titleA: {
                    type: "object",
                    properties: {
                      ctr: { type: "number" },
                      emotionalTriggers: { type: "array", items: { type: "string" } },
                      seoScore: { type: "number" },
                      lengthScore: { type: "number" },
                    },
                    required: ["ctr", "emotionalTriggers", "seoScore", "lengthScore"],
                    additionalProperties: false,
                  },
                  titleB: {
                    type: "object",
                    properties: {
                      ctr: { type: "number" },
                      emotionalTriggers: { type: "array", items: { type: "string" } },
                      seoScore: { type: "number" },
                      lengthScore: { type: "number" },
                    },
                    required: ["ctr", "emotionalTriggers", "seoScore", "lengthScore"],
                    additionalProperties: false,
                  },
                  analysis: { type: "string" },
                },
                required: ["winner", "titleA", "titleB", "analysis"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_ab_result" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== SEO DESCRIPTION ==========
    if (type === "seo-description") {
      const { title, niche } = body;
      const prompt = `Gere uma descrição SEO completa e otimizada para um vídeo do YouTube com o título: "${title}"
${niche ? `Nicho: ${niche}` : ''}

A descrição deve incluir:
1. Primeira linha: keyword principal + benefício (aparece no search)
2. Parágrafo de contexto (2-3 linhas)
3. Timestamps/capítulos sugeridos (00:00 formato)
4. Links placeholder para redes sociais
5. 3 hashtags relevantes
6. 8-12 keywords SEO relevantes

Formato profissional, 200-400 palavras.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um especialista em YouTube SEO. Gere descrições otimizadas para máximo alcance." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_seo_description",
              description: "Return SEO optimized description",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["description", "hashtags", "keywords"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_seo_description" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call response");
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ result: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown type: ${type}`);
  } catch (e) {
    console.error("generate-titles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
