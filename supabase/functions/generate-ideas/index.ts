import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, channelName, existingIdeas, count } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get viral patterns from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [viralRes, channelRes] = await Promise.all([
      sb.from("viral_titles_db").select("title, views, niche, emotional_triggers, title_pattern")
        .ilike("niche", `%${niche || ""}%`).order("views", { ascending: false }).limit(20),
      sb.from("channel_intelligence").select("channel_name, niche, avg_views, style, viral_patterns")
        .ilike("niche", `%${niche || ""}%`).limit(10),
    ]);

    const viralExamples = (viralRes.data || []).map(v => 
      `"${v.title}" (${(v.views/1000).toFixed(0)}K views, triggers: ${(v.emotional_triggers || []).join(', ')})`
    ).join('\n');

    const channelPatterns = (channelRes.data || []).map(c =>
      `${c.channel_name}: estilo ${c.style}, ${(c.avg_views/1000).toFixed(0)}K avg views`
    ).join('\n');

    const existingList = (existingIdeas || []).map((i: string) => `- ${i}`).join('\n');

    const prompt = `Você é um estrategista de YouTube especializado em canais faceless de alto crescimento.

CONTEXTO:
- Nicho: ${niche || 'geral'}
${channelName ? `- Canal do usuário: ${channelName}` : ''}
${existingList ? `- Ideias que o usuário JÁ tem (NÃO repetir):\n${existingList}` : ''}

DADOS DE MERCADO (títulos virais reais):
${viralExamples || 'Nenhum dado disponível'}

CANAIS DE REFERÊNCIA:
${channelPatterns || 'Nenhum dado disponível'}

Gere ${count || 5} ideias de vídeo ÚNICAS e ESPECÍFICAS que:
1. Tenham potencial viral comprovado (baseado nos padrões acima)
2. Sejam diferentes das ideias existentes do usuário
3. Incluam o gancho emocional principal
4. Tenham um título sugerido já otimizado para CTR

Para cada ideia, retorne título, descrição curta do conceito (1-2 frases), e prioridade (alta/média/baixa baseada no potencial viral).`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "return_ideas",
            description: "Return video ideas",
            parameters: {
              type: "object",
              properties: {
                ideas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      concept: { type: "string" },
                      priority: { type: "string", enum: ["alta", "média", "baixa"] },
                      hook: { type: "string" },
                    },
                    required: ["title", "concept", "priority", "hook"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["ideas"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_ideas" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let ideas = [];
    if (toolCall) {
      ideas = JSON.parse(toolCall.function.arguments).ideas;
    }

    return new Response(JSON.stringify({ ideas, viral_count: viralRes.data?.length || 0, channel_count: channelRes.data?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ideas error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
