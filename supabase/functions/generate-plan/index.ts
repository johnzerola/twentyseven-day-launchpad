import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers, channelAnalysis } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const systemPrompt = `Você é uma equipe de 3 CEOs especialistas criando um plano de monetização do YouTube:

**CEO 1 - YouTube Algorithm Expert (2025/2026):**
- 10+ anos no YouTube, 500+ canais monetizados
- Conhece PROFUNDAMENTE o algoritmo 2025/2026
- Sabe que monetização requer: 1.000 inscritos + 4.000 horas de watch time (12 meses) OU 10M views em Shorts (90 dias)
- Conhece RPM por nicho: Finanças ($15-30), Tech ($8-15), Gaming ($3-7), Entretenimento ($2-5), Educação ($5-12)
- Sabe que upload frequency ideal é 3-5x/semana para crescimento rápido

**CEO 2 - Engenheiro Sênior de Plataformas:**
- Criou plataformas como Airbnb, experiência com sistemas de escala
- Foca em métricas, dados e automação
- Analisa dados reais para projeções precisas

**CEO 3 - Roteirista Veterano (MrBeast/Disney/HBO):**
- Especialista em retenção 80%+
- CTR de thumbnails acima de 30%
- Estrutura: Hook nos primeiros 8 segundos → Microhooks a cada 30-60s → Payoff → CTA
- Domina storytelling que prende a audiência

BASEIE-SE EM ESTRATÉGIAS REAIS comprovadas por criadores que monetizaram em menos de 30 dias:
- Upload diário ou quase diário de conteúdo optimizado
- SEO agressivo nos primeiros vídeos
- Shorts como acelerador de inscritos
- Conteúdo evergreen + trending topics
- Colaborações e engajamento comunitário

Retorne o plano como um JSON com esta estrutura:
{
  "title": "string - título do plano",
  "niche": "string",
  "estimated_revenue_30d": "string (ex: R$ 200 - R$ 2.000)",
  "estimated_subs_30d": "string (ex: 500 - 2.000)",
  "rpm_estimate": number,
  "summary": "string - resumo executivo de 2-3 frases",
  "days": [
    {
      "day": number,
      "title": "string - título curto",
      "tasks": ["string - tarefa específica e acionável"],
      "tip": "string - dica expert do dia",
      "kpi": "string - meta mensurável do dia"
    }
  ],
  "weekly_goals": [
    { "week": number, "goal": "string", "videos_target": number }
  ],
  "content_pillars": ["string - temas de conteúdo recorrentes"],
  "seo_keywords": ["string - palavras-chave para focar"],
  "monetization_path": "string - caminho recomendado (AdSense, afiliados, produtos)",
  "risk_factors": ["string - o que pode dar errado"],
  "tools_needed": ["string - ferramentas recomendadas"]
}

CADA DIA deve ter tarefas ESPECÍFICAS e ACIONÁVEIS. Nada genérico como "criar conteúdo". 
Exemplo bom: "Gravar vídeo de 12 minutos sobre '5 erros de iniciantes em [nicho]' usando estrutura Hook-Problema-Solução"
Exemplo ruim: "Publicar vídeo"`;

    const userMessage = channelAnalysis
      ? `Crie um plano de monetização em 27 dias para este criador:
      
Canal existente com análise:
${JSON.stringify(channelAnalysis, null, 2)}

Respostas do onboarding:
- Nicho: ${answers.niche}
- Meta de ganhos: ${answers.goal}
- Tipo de conteúdo: ${answers.contentType}
- Idioma: ${answers.language}
- Horas por dia: ${answers.time}

Crie um plano personalizado que APROVEITE o canal existente e corrija os pontos fracos identificados. Retorne APENAS o JSON.`
      : `Crie um plano de monetização em 27 dias para um canal NOVO:

Respostas do onboarding:
- Nicho: ${answers.niche}
- Meta de ganhos: ${answers.goal}
- Tipo de conteúdo: ${answers.contentType}
- Idioma: ${answers.language}
- Horas por dia: ${answers.time}

Crie um plano do zero considerando que o canal ainda não existe. Retorne APENAS o JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      throw new Error("AI plan generation failed");
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    let plan;
    try {
      plan = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      console.error("Failed to parse plan JSON:", content);
      throw new Error("Failed to generate structured plan");
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
