import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { niche, subNiche, style, language, count, topic, narrativeStyle, channelKnowledge, videoFormat, shortsDuration } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ═══ FETCH INTELLIGENCE (parallel) ═══
    const fetchPromises: Promise<any>[] = [
      sb.from("channel_intelligence")
        .select("channel_name,niche,style,viral_patterns,top_videos,avg_views,growth_rate")
        .eq("is_faceless", true)
        .order("avg_views", { ascending: false })
        .limit(20),
      sb.from("youtube_knowledge")
        .select("title,content")
        .order("priority", { ascending: false })
        .limit(10),
      sb.from("content_dna")
        .select("video_title,views,hook_pattern,why_viral,niche,video_type")
        .order("views", { ascending: false })
        .limit(10),
    ];

    // For shorts, fetch ALL shorts-specific intelligence + monetization cases
    if (videoFormat === 'short') {
      fetchPromises.push(
        sb.from("content_models").select("model_name,description,hook_pattern,pacing_guide,best_for_duration,effectiveness_score")
          .eq("video_type", "short").order("effectiveness_score", { ascending: false }).limit(8),
        sb.from("hook_library").select("hook_text,hook_type,retention_score,niche")
          .order("retention_score", { ascending: false }).limit(20),
        sb.from("audience_psychology_patterns").select("trigger_type,description,storytelling_pattern")
          .order("retention_score", { ascending: false }).limit(8),
        sb.from("attention_engineering").select("pattern_name,technique,category,retention_impact")
          .order("retention_impact", { ascending: false }).limit(10),
        sb.from("youtube_knowledge").select("title,content")
          .ilike("title", "%shorts%")
          .order("priority", { ascending: false }).limit(5),
        // Monetization-specific knowledge
        sb.from("youtube_knowledge").select("title,content")
          .eq("category", "shorts-monetization")
          .order("priority", { ascending: false }).limit(5),
        // Case studies of successful Shorts channels
        sb.from("case_studies" as any).select("channel_name,niche,total_shorts,total_views,days_to_monetization,strategy_used,lessons_learned")
          .not("days_to_monetization", "is", null)
          .order("days_to_monetization", { ascending: true }).limit(5),
      );
    }

    const results = await Promise.all(fetchPromises);
    const [channelRes, ytRes, contentDnaRes] = results;

    // Shorts-specific data
    const shortsModels = results[3]?.data || [];
    const shortsHooks = results[4]?.data || [];
    const shortsPsych = results[5]?.data || [];
    const shortsAttention = results[6]?.data || [];
    const shortsKnowledge = results[7]?.data || [];
    const monetizationKnowledge = results[8]?.data || [];
    const caseStudies = results[9]?.data || [];

    // ═══ BUILD CONTEXT BLOCKS ═══
    const channelContext = (channelRes.data || []).map((c: any) => {
      const tops = Array.isArray(c.top_videos) ? c.top_videos.slice(0, 2).map((v: any) => v.title).join(", ") : "";
      return `${c.channel_name} (${c.style}, ${c.growth_rate}): ${tops}`;
    }).join("\n");

    const ytContext = (ytRes.data || []).map((r: any) => `${r.title}: ${r.content?.slice(0, 300)}`).join("\n\n");

    const contentDnaContext = (contentDnaRes.data || []).slice(0, 5).map((d: any) =>
      `• "${d.video_title}" (${(d.views || 0).toLocaleString()} views) — Hook: ${d.hook_pattern || 'N/A'}, Viral: ${d.why_viral || 'N/A'}`
    ).join("\n");

    const now = new Date();
    const month = now.toLocaleString("pt-BR", { month: "long" });
    const year = now.getFullYear();

    // ═══ CONTEXTUAL INJECTIONS ═══
    const topicContext = topic ? `\nTÓPICO DO USUÁRIO: "${topic}" — gere temas que EXPANDEM, COMPLEMENTAM ou dão ângulos diferentes sobre este tópico. NÃO repita o tópico, mas crie variações e ramificações surpreendentes.` : '';
    const narrativeContext = narrativeStyle ? `\nESTILO NARRATIVO PREFERIDO: ${narrativeStyle}` : '';
    const subNicheContext = subNiche ? `\nSUB-NICHO ESPECÍFICO: "${subNiche}" — TODOS os temas devem focar neste sub-nicho.` : '';
    const channelContext2 = channelKnowledge ? `\nCONHECIMENTO DO CANAL (insights do Dotti + análise IA):\n${channelKnowledge}\n\nUse estes insights para personalizar os temas ao estilo, tom e estratégia do canal. Sugira temas que COMPLEMENTEM o que o canal já faz bem.` : '';

    // ═══ SHORTS-SPECIFIC INTELLIGENCE BLOCK ═══
    let formatContext = '';
    if (videoFormat === 'short') {
      const durHint = shortsDuration || 'auto';

      const modelsBlock = shortsModels.map((m: any) =>
        `• ${m.model_name} (${m.best_for_duration}): ${m.hook_pattern} — Score: ${m.effectiveness_score}/10`
      ).join('\n');

      const hooksBlock = shortsHooks.slice(0, 12).map((h: any) =>
        `• [${h.hook_type}] "${h.hook_text}" (retenção: ${h.retention_score}/10)`
      ).join('\n');

      const psychBlock = shortsPsych.map((p: any) =>
        `• ${p.trigger_type}: ${p.storytelling_pattern || p.description?.slice(0, 100)}`
      ).join('\n');

      const attBlock = shortsAttention.map((a: any) =>
        `• ${a.pattern_name} [${a.category}] (+${a.retention_impact}%): ${a.technique?.slice(0, 120)}`
      ).join('\n');

      const shortsKnowledgeBlock = shortsKnowledge.map((k: any) =>
        `${k.title}: ${k.content?.slice(0, 400)}`
      ).join('\n\n');

      // ═══ MONETIZATION INTELLIGENCE ═══
      const monetizationBlock = monetizationKnowledge.map((k: any) =>
        `${k.title}: ${k.content?.slice(0, 500)}`
      ).join('\n\n');

      const caseStudiesBlock = caseStudies.map((c: any) => {
        const lessons = Array.isArray(c.lessons_learned) ? c.lessons_learned.slice(0, 3).join('; ') : '';
        return `• ${c.channel_name} (${c.niche}): ${c.total_shorts || '?'} shorts, ${(c.total_views || 0).toLocaleString()} views, monetizado em ${c.days_to_monetization} dias${lessons ? ` — Lições: ${lessons}` : ''}`;
      }).join('\n');

      formatContext = `
═══════════════════════════════════
📱 FORMATO: SHORTS (15-60 segundos)
═══════════════════════════════════

🔑 INTELIGÊNCIA DE VIRALIZAÇÃO DE SHORTS:
${shortsKnowledgeBlock}

💰 ESTRATÉGIA DE MONETIZAÇÃO COM SHORTS:
${monetizationBlock}

${caseStudiesBlock ? `🏆 CASES DE SUCESSO REAIS:\n${caseStudiesBlock}\n` : ''}

📐 MODELOS ESTRUTURAIS DE SHORTS:
${modelsBlock}

🎣 HOOKS DE ALTA PERFORMANCE:
${hooksBlock}

🧠 GATILHOS PSICOLÓGICOS:
${psychBlock}

⚡ TÉCNICAS DE ATENÇÃO:
${attBlock}

📊 ESTRATÉGIA DE DURAÇÃO (CRÍTICO PARA MONETIZAÇÃO):
${durHint === 'micro' ? `- MICRO-SHORTS (15-30s): Foco em completion rate >90%. MELHOR para viralizar rápido.
- DADO: Shorts de 15-25s têm 40% mais chance de entrar no feed For You
- DADO: Completion >85% nos primeiros 200 views = escala para 20K+ em 1h
- IDEAL PARA: Monetização rápida via volume (10M views em 30 dias)`
  : durHint === 'story' ? `- STORY-SHORTS (45-60s): Narrativas com alta carga emocional. 
- QUANDO USAR: Histórias de milionários, true crime, tragédias, mitologia
- IMPORTANTE: Funciona para watch time (4.000 horas), não para views rápidas
- COMBINE: 70% micro-shorts (viralização) + 30% story-shorts (watch time)`
  : `- AUTO: Sugira a duração IDEAL para cada tema baseado na complexidade:
  • Tema simples (1 fato/ideia) → 15-25s (MICRO) — MELHOR para monetizar rápido
  • Tema com twist (2 elementos) → 25-40s (FLASH) — Sweet spot
  • Tema narrativo (personagem + conflito) → 45-60s (STORY) — Watch time
  PRIORIZE 70% MICRO para acelerar monetização!`}

REGRAS CRÍTICAS PARA TEMAS DE SHORTS:
1. Cada tema DEVE funcionar em formato ultra-curto
2. Hook de 0.3s — o tema precisa ter uma frase de abertura IMPOSSÍVEL de ignorar
3. Potencial de loop (>200% watch time)
4. Deve especificar a duração recomendada para cada tema
5. Temas com UMA ideia central, ângulo chocante ou contraintuitivo
6. Pensar em SÉRIES: cada tema pode virar "Parte 1, 2, 3..."`;
    }

    // ═══ CONTENT DNA CONTEXT ═══
    const dnaContext = contentDnaContext ? `\n🧬 DNA DE CONTEÚDO VIRAL (padrões reais):\n${contentDnaContext}` : '';

    const prompt = `Você é um estrategista de conteúdo YouTube com 15 anos de experiência em canais faceless/dark.

DADOS DE CANAIS VIRAIS REAIS:
${channelContext}

TENDÊNCIAS YOUTUBE ${year}:
${ytContext}
${dnaContext}
${topicContext}
${narrativeContext}
${subNicheContext}
${channelContext2}
${formatContext}

Gere ${count || 10} ideias de vídeos ÚNICOS e VIRAIS para ${month} ${year}.

Requisitos:
- Nicho: ${niche || "geral (faceless/dark)"}${subNiche ? ` → Sub-nicho: ${subNiche}` : ''}
- Estilo: ${style || "qualquer estilo faceless"}
- Idioma: ${language || "português"}
- Cada ideia deve ter potencial viral REAL baseado nos padrões dos canais analisados
- NÃO repita temas genéricos. Seja ESPECÍFICO e ATUAL.
${topic ? `- TODOS os temas devem estar relacionados ao tópico "${topic}"` : '- Pense em temas que ninguém está cobrindo ainda mas que têm DEMANDA.'}
- Considere sazonalidade, notícias recentes, tendências emergentes.
${videoFormat === 'short' ? `- FORMATO SHORTS: Para cada tema, indique a duração ideal (15s, 25s, 30s, 45s ou 60s) baseado na complexidade.
- Temas simples = 15-25s | Temas com twist = 25-40s | Histórias = 45-60s
- Cada hook deve ter NO MÁXIMO 8 palavras e ser impossível de scrollar.` : '- Para cada ideia, sugira o estilo de roteiro ideal.'}

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
                      hook: { type: "string", description: "Hook dos primeiros 0.3-5 segundos (max 8 palavras para shorts)" },
                      description: { type: "string", description: "Breve descrição do conteúdo (2 frases)" },
                      style: { type: "string", enum: ["documentário", "listicle", "tutorial", "true crime", "motivacional", "storytelling", "educativo", "horror", "comparação", "desafio", "shorts", "dopaminérgico", "cinematográfico"] },
                      estimated_duration: { type: "string", description: "Duração sugerida: 15s, 25s, 30s, 45s, 60s para shorts ou 8min, 15min para longform" },
                      viral_score: { type: "number", description: "Score de potencial viral 1-10" },
                      niche_tags: { type: "array", items: { type: "string" }, description: "2-3 tags de nicho" },
                      why_viral: { type: "string", description: "1 frase explicando por que esse tema vai viralizar" },
                      duration_category: { type: "string", enum: ["micro", "flash", "story", "longform"], description: "micro=15-25s, flash=25-40s, story=45-60s, longform=5min+" },
                      series_potential: { type: "string", description: "Como esse tema pode virar uma série de 5-10 partes" },
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
