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

    const systemPrompt = `Você é um estrategista de monetização YouTube.
Gere um plano de 30 dias DETALHADO e PERSONALIZADO para o canal do usuário.

${formatInstructions}

═══ PROTOCOLO SEMANAL 3×/SEMANA (OBRIGATÓRIO) ═══
SEG: Pesquisa + validação de 3 temas (Google Trends + VidIQ). Definir tópico V1.
TER: Roteiro V1 + thumbnail. Gravar narração. Enviar para edição.
QUA: Revisão edição V1. Ajustes. Agendar publicação QUI 18h.
QUI: Publicar V1 18h. Roteiro V2 + narração. Enviar edição.
SEX: Analisar métricas V1 (48h). Testar novo título/thumb se CTR < 4%.
SÁB: Publicar V2 12h. Roteiro V3. Cortar Shorts dos 2 vídeos anteriores.
DOM: Publicar V3 18h. Publicar 3 Shorts. Planejamento próx. semana.

HORÁRIOS DE PICO BR: QUI 18h-20h e DOM 15h-20h (melhores). SÁB 12h (bom para curiosidades).
REGRA DAS 48H: Se CTR < 4% nas primeiras 48h, trocar título + thumb no 3º dia exato.
CONSISTÊNCIA > QUALIDADE: Nos primeiros 30 vídeos, velocidade de aprendizado supera perfeição.

═══ 10 REGRAS INEGOCIÁVEIS DO SISTEMA ═══
1. NÃO TROQUE DE NICHO — o algoritmo leva 20-30 vídeos para entender sua audiência.
2. CTR SEM RETENÇÃO = VENENO — clickbait sem entrega mata o canal.
3. SÉRIE BATE VÍDEO ISOLADO — séries criam binge-watching e treinam o algoritmo.
4. PRIMEIRO 30s É TUDO — retenção aos 30s < 70% = reescreva o gancho.
5. PUBLIQUE NO HORÁRIO, SEMPRE — consistência dobra a velocidade de recomendação.
6. DOBRE O QUE FUNCIONA — vídeo 2× a média? Mesmo arquétipo, tema adjacente.
7. PLAYLISTS SÃO ACELERADORAS — autoplay encadeia episódios.
8. RESPONDA COMENTÁRIOS NAS 1as 2H — sinal de engajamento mais forte.
9. EVERGREEN SUPERA TRENDING — 80% evergreen, 20% trending.
10. DADOS ANTES DE OPINIÃO — revise analytics a cada 7 dias.

═══ CHECKPOINTS PÓS-PUBLICAÇÃO ═══
- 2h: Verificar velocity. CTR < 2% = problema de embalagem.
- 24h: Analisar curva de retenção. Queda nos 30s = gancho fraco.
- 48h: Decisão manter ou trocar título/thumb.
- Semana 4: Análise de padrões — duplicar formato vencedor.

CONHECIMENTO DE MONETIZAÇÃO:
${knowledgeBlock}

CASES DE SUCESSO:
${casesBlock}

HOOKS MAIS EFETIVOS:
${hooksBlock}

MODELOS DE CONTEÚDO:
${modelsBlock}
${channelContext}

REGRAS:
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
          "task_type": "content|research|optimization|analytics",
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
      "milestone_type": "subs|views|watch_hours|shorts_published|longs_published",
      "title": "Primeiros 50 inscritos",
      "target_value": 50,
      "icon": "🎯"
    }
  ],
  "weekly_goals": [
    { "week": 1, "shorts": 14, "longs": 0, "target_subs": 100, "target_views": 5000 }
  ]
}

3. Cada dia deve ter 2-4 tarefas variadas (conteúdo, pesquisa, otimização, análise)
4. Tarefas devem ser ULTRA ESPECÍFICAS para o nicho "${niche || 'curiosidades'}"
5. Se canal é NOVO: foco em setup, branding, primeiros uploads
6. Se canal TEM CONTEÚDO: foco em otimização, padrões virais, escala
7. Milestones: adapte ao formato escolhido
8. Idioma: ${language || 'português'}
9. Dicas diárias baseadas nos dados reais do canal quando disponíveis`;

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
