import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    const { niche, language, country, channelId, strategy } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user
    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user } } = await sbAuth.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Fetch knowledge in parallel
    const [monetKnowledge, caseStudies, nicheData] = await Promise.all([
      sb.from("youtube_knowledge").select("title,content")
        .eq("category", "shorts-monetization").order("priority", { ascending: false }).limit(3),
      sb.from("case_studies").select("*").eq("is_public", true).limit(5),
      sb.from("niche_database").select("*").ilike("name", `%${niche || ''}%`).limit(3),
    ]);

    const knowledgeBlock = (monetKnowledge.data || []).map((k: any) => `${k.title}: ${k.content?.slice(0, 400)}`).join("\n\n");
    const casesBlock = (caseStudies.data || []).map((c: any) => 
      `• ${c.channel_name} (${c.niche}): ${c.days_to_monetization || '?'} dias, ${c.total_shorts || 0} shorts, ${(c.total_views || 0).toLocaleString()} views`
    ).join("\n");

    const systemPrompt = `Você é um estrategista de monetização YouTube especializado em canais faceless. 
Gere um plano de 30 dias DETALHADO e REALISTA para monetização.

CONHECIMENTO DE MONETIZAÇÃO:
${knowledgeBlock}

CASES DE SUCESSO:
${casesBlock}

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
          "title": "Criar 2 micro-shorts sobre [tema]",
          "description": "Detalhes...",
          "task_type": "content",
          "video_type": "short",
          "target_shorts": 2,
          "target_longs": 0
        }
      ],
      "target_views": 500,
      "target_subs": 10,
      "tip": "Dica do dia"
    }
  ],
  "milestones": [
    {
      "day_expected": 3,
      "milestone_type": "subs",
      "title": "Primeiros 50 inscritos",
      "target_value": 50,
      "icon": "🎯"
    }
  ],
  "weekly_goals": [
    { "week": 1, "shorts": 14, "longs": 0, "target_subs": 100, "target_views": 5000 }
  ]
}

3. Mix: 70% micro-shorts (15-25s) + 30% story-shorts (45-60s)
4. Escalada realista: Semana 1 = fundação, Semana 2 = consistência, Semana 3 = otimização, Semana 4 = escala
5. Milestones: 50 subs, 100 subs, 500 subs, 1000 subs, 10h watch, 100h watch, 1000h watch, 4000h watch
6. Cada dia deve ter 2-4 tarefas variadas (conteúdo, pesquisa, otimização, análise)
7. Idioma: ${language || 'português'}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere um plano de 30 dias para monetizar um canal faceless no nicho "${niche || 'curiosidades'}" no mercado ${country || 'BR'} (${language || 'português'}). Estratégia: ${strategy || 'shorts-first'}.` }
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("AI error:", res.status, t);
      throw new Error("AI generation failed");
    }

    const aiResult = await res.json();
    const raw = aiResult.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
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
