import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, style, language, count, topic, narrativeStyle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch intelligence from DB
    const [channelRes, ytRes] = await Promise.all([
      sb.from("channel_intelligence")
        .select("channel_name,niche,style,viral_patterns,top_videos,avg_views,growth_rate")
        .eq("is_faceless", true)
        .order("avg_views", { ascending: false })
        .limit(20),
      sb.from("youtube_knowledge")
        .select("title,content")
        .order("priority", { ascending: false })
        .limit(5),
    ]);

    const channelContext = (channelRes.data || []).map((c: any) => {
      const tops = Array.isArray(c.top_videos) ? c.top_videos.slice(0, 2).map((v: any) => v.title).join(", ") : "";
      return `${c.channel_name} (${c.style}, ${c.growth_rate}): ${tops}`;
    }).join("\n");

    const ytContext = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content}`).join("\n");

    const now = new Date();
    const month = now.toLocaleString("pt-BR", { month: "long" });
    const year = now.getFullYear();

    const prompt = `Você é um estrategista de conteúdo YouTube com 15 anos de experiência em canais faceless/dark.

DADOS DE CANAIS VIRAIS REAIS (use como referência):
${channelContext}

TENDÊNCIAS YOUTUBE ${year}:
${ytContext}

Gere ${count || 10} ideias de vídeos ÚNICOS e VIRAIS para ${month} ${year}.

Requisitos:
- Nicho: ${niche || "geral (faceless/dark)"}
- Estilo: ${style || "qualquer estilo faceless"}
- Idioma: ${language || "português"}
- Cada ideia deve ter potencial viral REAL baseado nos padrões dos canais analisados
- NÃO repita temas genéricos. Seja ESPECÍFICO e ATUAL.
- Pense em temas que ninguém está cobrindo ainda mas que têm DEMANDA.
- Considere sazonalidade, notícias recentes, tendências emergentes.
- Para cada ideia, sugira o estilo de roteiro ideal (documentário, listicle, storytelling, etc).

IMPORTANTE: Gere temas que fariam o espectador clicar IMEDIATAMENTE.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Retorne APENAS JSON válido." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_themes",
            description: "Return video theme suggestions",
            parameters: {
              type: "object",
              properties: {
                themes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Título viral do vídeo" },
                      hook: { type: "string", description: "Hook dos primeiros 5 segundos" },
                      description: { type: "string", description: "Breve descrição do conteúdo (2 frases)" },
                      style: { type: "string", enum: ["documentário", "listicle", "tutorial", "true crime", "motivacional", "storytelling", "educativo", "horror", "comparação", "desafio", "shorts"] },
                      estimated_duration: { type: "string", description: "Duração sugerida ex: 15min" },
                      viral_score: { type: "number", description: "Score de potencial viral 1-10" },
                      niche_tags: { type: "array", items: { type: "string" }, description: "2-3 tags de nicho" },
                      why_viral: { type: "string", description: "1 frase explicando por que esse tema vai viralizar" },
                    },
                    required: ["title", "hook", "description", "style", "estimated_duration", "viral_score", "niche_tags", "why_viral"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["themes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_themes" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return errResp("Rate limit. Tente novamente.", 429);
      if (aiRes.status === 402) return errResp("Créditos insuficientes.", 402);
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      throw new Error("AI generation failed");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let themes: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        themes = parsed.themes || [];
      } catch { /* empty */ }
    }

    return new Response(JSON.stringify({ themes, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-themes error:", e);
    return errResp(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function errResp(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
