import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    const { niche, language, country, channelId, strategy, channelAnalysis, format, channelStats } = await req.json();

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user } } = await sbAuth.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch knowledge in parallel
    // Dynamic knowledge category based on strategy (was hardcoded to shorts-monetization)
    const knowledgeCategory = (strategy === 'longform-first') ? 'longform-growth' 
      : (strategy === 'hybrid') ? 'monetization-strategy' 
      : 'shorts-monetization';
    const [monetKnowledge, caseStudies, nicheData, hookPatterns, contentModels] = await Promise.all([
      sb.from("youtube_knowledge").select("title,content")
        .eq("category", knowledgeCategory).order("priority", { ascending: false }).limit(5),
      sb.from("case_studies").select("*").eq("is_public", true).limit(5),
      sb.from("niche_database").select("*").ilike("name", `%${niche || ''}%`).limit(3),
      sb.from("hook_patterns").select("pattern_name,template,effectiveness_score")
        .order("effectiveness_score", { ascending: false }).limit(5),
      sb.from("content_models").select("model_name,description,video_type,effectiveness_score")
        .order("effectiveness_score", { ascending: false }).limit(5),
    ]);

    const knowledgeBlock = (monetKnowledge.data || []).map((k: any) => `${k.title}: ${k.content?.slice(0, 400)}`).join("\n\n");
    const casesBlock = (caseStudies.data || []).map((c: any) =>
      `• ${c.channel_name} (${c.niche}): ${c.days_to_monetization || '?'} dias, ${c.total_shorts || 0} shorts, ${(c.total_views || 0).toLocaleString()} views`
    ).join("\n");
    const hooksBlock = (hookPatterns.data || []).map((h: any) => `• ${h.pattern_name}: ${h.template}`).join("\n");
    const modelsBlock = (contentModels.data || []).map((m: any) => `• ${m.model_name} (${m.video_type}): ${m.description?.slice(0, 100)}`).join("\n");

    // Build channel context
    let channelContext = '';
    if (channelStats) {
      channelContext = `\nDADOS DO CANAL DO USUÁRIO:
- Inscritos: ${channelStats.subscribers || 0}
- Views totais: ${channelStats.views || 0}
- Vídeos publicados: ${channelStats.videos || 0}
- Canal ${(channelStats.videos || 0) <= 5 ? 'NOVO (poucas publicações)' : 'COM HISTÓRICO de conteúdo'}`;
    }

    if (channelAnalysis?.intelligence) {
      const intel = channelAnalysis.intelligence;
      channelContext += `\n\nINTELLIGENCE DO CANAL (dados do sistema):
- Estilo: ${intel.style || 'N/A'}
- Upload frequency: ${intel.upload_frequency || 'N/A'}
- Growth rate: ${intel.growth_rate || 'N/A'}
- Faceless: ${intel.is_faceless ? 'Sim' : 'Não'}
- RPM estimado: $${intel.rpm_estimate || 0}`;
    }

    if (channelAnalysis?.topDNA?.length > 0) {
      channelContext += `\n\nDNA DE CONTEÚDO (top vídeos analisados):`;
      channelAnalysis.topDNA.slice(0, 5).forEach((d: any) => {
        channelContext += `\n- Score viral: ${d.viral_score}, Hook: ${d.hook_type}, Modelo: ${d.content_model}, Views: ${d.views}`;
      });
    }

    // Format-specific instructions
    const formatInstructions = format === 'long' || strategy === 'longform-first'
      ? `FOCO: LONGFORM (8-20 min). Meta: 1.000 subs + 4.000h watch time.
- Cada vídeo deve ter 8-20 minutos para maximizar watch time
- Foque em SEO evergreen + storytelling
- 3-5 vídeos por semana
- Estrutura: Hook 8s → Problema → Jornada → Payoff → CTA
- Daily tasks devem incluir: pesquisa SEO, roteiro, gravação, edição, otimização`
      : format === 'both' || strategy === 'hybrid'
      ? `FOCO: HÍBRIDO (Shorts + Longform).
- Shorts: 2-3/dia para crescer inscritos rápido
- Longform: 2-3/semana para watch time
- Shorts alimentam o canal, Longform monetiza
- Semana 1-2: prioridade em Shorts. Semana 3-4: aumentar Longform`
      : `FOCO: SHORTS ONLY. Meta: 10M views engajadas em 90 dias.
- 2-3 shorts por dia (15-60 segundos)
- Mix: 70% micro-shorts (15-25s) + 30% story-shorts (45-60s)
- Escalada: Semana 1 = fundação, Semana 2 = consistência, Semana 3 = otimização, Semana 4 = escala
- Foque em formatos que já viralizam no nicho`;

    const systemPrompt = `Você é um estrategista de monetização YouTube baseado em pesquisa real de 2025-2026, incluindo técnicas do MrBeast e dados de algoritmo confirmados.
Gere um plano de 30 dias DETALHADO e PERSONALIZADO para o canal do usuário.

${formatInstructions}

═══ ESTRUTURA OBRIGATÓRIA DO PLANO DE 30 DIAS ═══

DIAS 1-3: LAUNCH SETUP (baseado em pesquisa de warmup do YouTube)
- Dia 1: Configurar canal completo: foto, banner, about section, keyword tags (3 keywords do nicho em Settings > Channel > Keywords). NÃO adicionar links de redes sociais (YouTube despriorioza canais que tiram usuários da plataforma).
- Dia 2: Assistir 30 min de conteúdo do nicho na conta do canal. Inscrever em 2-3 canais concorrentes. NÃO postar vídeos hoje. Isso treina o algoritmo no seu público.
- Dia 3: Adicionar primeiro link de afiliado na descrição do canal (About section). Isso ativa Level 1 de monetização antes de publicar qualquer vídeo.

DIAS 4-7: THE DUAL LAUNCH (técnica comprovada de lançamento)
- Dias 4-6: Preparar 2 vídeos simultaneamente. NÃO publicar ainda.
- Dia 7: Publicar AMBOS os vídeos no mesmo dia com intervalo de 2 horas.
  RAZÃO CIENTÍFICA: YouTube envia viewer do Vídeo 1 ao Vídeo 2, classifica como "fan" (alguém que assiste múltiplos vídeos), e empurra ambos para audiências com comportamento fan similar. Este é o jeito mais rápido de sinalizar autoridade de canal no dia 1.

DIAS 8-14: THE CTR WAR
- A cada 24 horas após publicar, checar CTR.
- SE CTR < 3.5%: Trocar thumbnail e título imediatamente. Cada hora conta nas primeiras 48h.
- SE CTR > 5%: Celebrar + criar 2 vídeos mais no mesmo formato de título.
- Dia 11: Primeira integração de afiliado. Gerar parágrafo específico de afiliado para descrição do vídeo baseado no nicho.
  Pesquisa: Afiliados têm ZERO requisito de inscritos. Canal com 300 views/vídeo e 1% de conversão em produto de R$47 = R$47 na semana 2.

DIAS 15-21: HYPE STRATEGY (feature YouTube lançada agosto 2025)
- Hype disponível para canais com 500-500.000 inscritos. Vídeos recebem botão Hype por 7 dias após upload.
- Hypes de viewers de canais pequenos têm MAIS peso (sistema de multiplicador).
- Adicionar CTA verbal em cada vídeo: "Se esse vídeo te ajudou, clica no botão Hype logo abaixo do like — ele dá mais força do que um like pro canal crescer"
- Postar Community Post pedindo Hype no último vídeo
- Gerar texto do Community Post automaticamente quando o usuário marca um vídeo como publicado

DIAS 22-28: MICRO SPONSORSHIP OUTREACH
- Gerar Media Kit com: nome do canal, nicho, inscritos, média de views, engagement rate, melhor vídeo
- Precificação automática: Menção 15s = R$20 × (avg_views/1000), Integração 60s = R$40 × (avg_views/1000)
- Lista de 5 marcas-alvo por nicho com template de DM/email em português
- Enviar pelo menos 3 propostas para marcas do nicho

DIAS 29-30: YPP CHECK
- Dia 29: Verificar se atingiu 500 subs + 3.000h watch time
- Se SIM: Guia passo-a-passo para aplicar para YPP Early Tier
- Se NÃO: Gap analysis específica: "Você precisa de X subs e Y horas. Ações: 2 vídeos de 15 min com 60%+ de retenção"

═══ 3 ALAVANCAS DO ALGORITMO (MrBeast + pesquisa 2025) ═══
1. CTR: Meta 4-6% canais novos. Abaixo de 3.5% = YouTube para distribuição em 48h.
2. AVD (Average View Duration): Meta 50%+ para vídeos <10min, 40%+ para 10-20min. O primeiro minuto é onde se perde mais viewers.
3. Session Time: YouTube recompensa canais onde viewers assistem mais de um vídeo. Usar Shorts + Longform crescem 40-60% mais rápido.

═══ PROTOCOLO SEMANAL 3×/SEMANA ═══
SEG: Pesquisa + validação de 3 temas. Definir tópico V1.
TER: Roteiro V1 + thumbnail. Gravar narração.
QUA: Revisão edição V1. Agendar publicação QUI 18h.
QUI: Publicar V1 18h. Roteiro V2 + narração.
SEX: Analisar métricas V1 (48h). Testar novo título/thumb se CTR < 4%.
SÁB: Publicar V2 12h. Roteiro V3. Cortar Shorts.
DOM: Publicar V3 18h. Publicar 3 Shorts. Planejamento próx. semana.

═══ KILL WARNINGS (anti-padrões fatais) ═══
- Postar >3 vídeos/dia = risco de flag por spam
- Copiar outros canais frame-por-frame = algoritmo 2025 penaliza
- Shorts only strategy = RPM de $0.04-0.07 (impossível monetizar)
- Ignorar primeiras 48h = perder janela de distribuição do algoritmo
- Conteúdo genérico AI-sounding = bloqueado de monetização desde julho 2025

═══ 10 REGRAS INEGOCIÁVEIS ═══
1. NÃO TROQUE DE NICHO — o algoritmo leva 20-30 vídeos para entender sua audiência.
2. CTR SEM RETENÇÃO = VENENO — clickbait sem entrega mata o canal.
3. SÉRIE BATE VÍDEO ISOLADO — séries criam binge-watching.
4. PRIMEIRO 30s É TUDO — retenção aos 30s < 70% = reescreva o gancho.
5. PUBLIQUE NO HORÁRIO, SEMPRE.
6. DOBRE O QUE FUNCIONA — vídeo 2× a média? Mesmo formato, tema adjacente.
7. PLAYLISTS SÃO ACELERADORAS.
8. RESPONDA COMENTÁRIOS NAS 1as 2H.
9. EVERGREEN SUPERA TRENDING — 80% evergreen, 20% trending.
10. DADOS ANTES DE OPINIÃO — revise analytics semanalmente.

CONHECIMENTO DE MONETIZAÇÃO:
${knowledgeBlock}

CASES DE SUCESSO:
${casesBlock}

HOOKS MAIS EFETIVOS:
${hooksBlock}

MODELOS DE CONTEÚDO:
${modelsBlock}
${channelContext}

REGRAS DE OUTPUT:
1. Retorne APENAS um JSON válido, sem markdown
2. Estrutura obrigatória:
{
  "phases": [
    {
      "phase": 1,
      "name": "Nome da fase",
      "days": [1, 7],
      "focus": "descrição",
      "daily_shorts": 2,
      "daily_longs": 0
    }
  ],
  "daily_tasks": [
    {
      "day": 1,
      "tasks": [
        {
          "title": "Tarefa específica e acionável",
          "description": "Detalhes com base nos dados do canal",
          "task_type": "content|research|optimization|analytics|affiliate|hype|sponsorship",
          "video_type": "short|long",
          "target_shorts": 2,
          "target_longs": 0
        }
      ],
      "target_views": 500,
      "target_subs": 10,
      "tip": "Dica personalizada do dia baseada nos dados"
    }
  ],
  "milestones": [
    {
      "day_expected": 3,
      "milestone_type": "subs|views|watch_hours|shorts_published|longs_published|affiliate|sponsorship",
      "title": "Primeiro link de afiliado ativo",
      "target_value": 1,
      "icon": "💰"
    }
  ],
  "weekly_goals": [
    { "week": 1, "shorts": 14, "longs": 0, "target_subs": 100, "target_views": 5000 }
  ]
}

3. Cada dia deve ter 2-4 tarefas variadas
4. INCLUA tarefas de afiliado (dias 3, 11), hype (dias 15-21), sponsorship (dias 22-28), YPP check (dias 29-30)
5. Tarefas devem ser ULTRA ESPECÍFICAS para o nicho "${niche || 'curiosidades'}"
6. Idioma: ${language || 'português'}`;

    const userMessage = `Gere um plano de 30 dias para monetizar o canal no nicho "${niche || 'curiosidades'}" no mercado ${country || 'BR'} (${language || 'português'}). Estratégia: ${strategy || 'shorts-first'}. Formato: ${format || 'shorts'}.`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GOOGLE_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("AI error:", res.status, t);
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI generation failed");
    }

    const aiResult = await res.json();
    const raw = aiResult.choices?.[0]?.message?.content || "";

    let planData;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      planData = JSON.parse(jsonMatch?.[0] || raw);
    } catch {
      console.error("Failed to parse plan JSON:", raw.slice(0, 500));
      throw new Error("Failed to parse plan");
    }

    // Create the plan
    const { data: plan, error: planErr } = await sb.from("monetization_30day_plans").insert({
      user_id: user.id,
      channel_id: channelId || null,
      niche: niche || 'curiosidades',
      language: language || 'pt',
      country: country || 'BR',
      strategy: strategy || 'shorts-first',
      status: 'active',
      plan_json: planData,
    }).select().single();

    if (planErr) throw planErr;

    // Insert daily tasks
    const dailyTasks: any[] = [];
    for (const dayPlan of (planData.daily_tasks || [])) {
      for (const task of (dayPlan.tasks || [])) {
        dailyTasks.push({
          user_id: user.id,
          plan_id: plan.id,
          day_number: dayPlan.day,
          title: task.title,
          description: task.description || '',
          task_type: task.task_type || 'content',
          video_type: task.video_type || 'short',
          target_shorts: task.target_shorts || 0,
          target_longs: task.target_longs || 0,
          target_views: dayPlan.target_views || 0,
          target_subs: dayPlan.target_subs || 0,
        });
      }
    }

    if (dailyTasks.length > 0) {
      await sb.from("daily_tasks").insert(dailyTasks);
    }

    // Insert milestones
    const milestones = (planData.milestones || []).map((m: any) => ({
      user_id: user.id,
      plan_id: plan.id,
      milestone_type: m.milestone_type,
      title: m.title,
      target_value: m.target_value,
      day_expected: m.day_expected,
      icon: m.icon || '🎯',
    }));

    if (milestones.length > 0) {
      await sb.from("monetization_milestones").insert(milestones);
    }

    // Sync: Feed plan data back into ai_learning for self-improvement
    await sb.from("ai_learning").insert({
      topic: "plan-generated",
      source: `tracker-30d:${plan.id}`,
      insight: JSON.stringify({
        niche, strategy, format,
        channel_subs: channelStats?.subscribers || 0,
        channel_videos: channelStats?.videos || 0,
        tasks_count: dailyTasks.length,
        milestones_count: milestones.length,
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ plan, planData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-30day-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
