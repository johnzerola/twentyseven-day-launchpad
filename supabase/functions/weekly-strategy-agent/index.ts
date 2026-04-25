// ═══════════════════════════════════════════════════════════════
// WEEKLY STRATEGY AGENT
// Para cada canal com strategist_enabled=true, lê performance dos
// últimos 7 dias + sinais do nicho e cria N (=weekly_video_target)
// projetos draft para a próxima semana.
//
// Cron sugerido: Domingo 23:00 UTC
// Service-role only (chamado pelo pg_cron com Bearer ANON_KEY).
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiWithFallback } from "../_shared/gemini-direct.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gemini-2.5-pro";
const CONCURRENCY = 3;

interface ChannelRow {
  id: string;
  user_id: string;
  channel_name: string | null;
  niche: string | null;
  language: string | null;
  character_name: string | null;
  character_bio: string | null;
  visual_style_prompt: string | null;
  weekly_video_target: number | null;
  strategist_enabled: boolean | null;
  competitor_benchmark_json: any;
  posting_days: string[] | null;
  posting_hour: number | null;
  default_video_type: string | null;
}

interface ThemeDecision {
  title: string;
  topic: string;
  angle: string;
  hook: string;
  video_type: "long" | "short";
  duration_seconds: number;
  reasoning: string;
}

function nextMondayUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=sun..6=sat
  const daysUntilMonday = ((1 - day + 7) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function processChannel(
  admin: any,
  channel: ChannelRow,
  weekStart: Date,
  force: boolean,
  dryRun: boolean,
): Promise<{ channel_id: string; status: string; reason?: string; plan_id?: string; project_count?: number }> {
  const weekStartISO = weekStart.toISOString().slice(0, 10);

  // 1. Idempotência
  const { data: existing } = await admin
    .from("weekly_strategy_plans")
    .select("id, status, applied_project_ids")
    .eq("channel_id", channel.id)
    .eq("week_start", weekStartISO)
    .maybeSingle();

  if (existing && existing.status === "applied" && !force) {
    return { channel_id: channel.id, status: "skipped", reason: "already_applied", plan_id: existing.id };
  }

  const N = Math.max(1, Math.min(7, channel.weekly_video_target ?? 1));
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // 2. Performance (paralelo)
  const [perfRes, refsRes, emergingRes, nicheRes] = await Promise.all([
    admin
      .from("video_performance")
      .select("title,topic,hook_type,title_pattern,views_current,ctr_percent,avg_retention_percent,avg_view_duration_s,subscribers_gained,published_at,performance_grade,video_type,duration_seconds")
      .eq("channel_id", channel.id)
      .gte("published_at", sevenDaysAgo)
      .order("views_current", { ascending: false })
      .limit(15),
    admin
      .from("user_reference_channels")
      .select("channel_name, role, latest_intel")
      .eq("user_id", channel.user_id)
      .limit(8),
    channel.niche
      ? admin
          .from("emerging_videos")
          .select("title,channel_name,views,velocity_score,pre_viral_score,niche,published_at")
          .ilike("niche", `%${channel.niche.split(" ")[0]}%`)
          .gte("detected_at", sevenDaysAgo)
          .order("pre_viral_score", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] }),
    channel.niche
      ? admin
          .from("niche_database")
          .select("name,saturation,growth_rate,rpm_estimate,trending_topics,sub_niches")
          .ilike("name", `%${channel.niche.split(" ")[0]}%`)
          .limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  const perf = perfRes.data || [];
  const refs = refsRes.data || [];
  const emerging = emergingRes.data || [];
  const nicheData = nicheRes.data || [];

  // 3. Resumos compactos
  const topPerformers = perf.slice(0, 5).map((v: any) => ({
    title: v.title,
    views: v.views_current,
    ctr: v.ctr_percent,
    retention: v.avg_retention_percent,
    hook: v.hook_type,
    pattern: v.title_pattern,
    grade: v.performance_grade,
  }));
  const avgCtr = perf.length ? perf.reduce((s: number, v: any) => s + (Number(v.ctr_percent) || 0), 0) / perf.length : null;
  const avgRetention = perf.length ? perf.reduce((s: number, v: any) => s + (Number(v.avg_retention_percent) || 0), 0) / perf.length : null;

  const refSignals = refs
    .filter((r: any) => r.latest_intel)
    .map((r: any) => ({
      channel: r.channel_name,
      role: r.role,
      titles: (r.latest_intel?.title_patterns || []).slice(0, 3),
      hooks: (r.latest_intel?.hook_types || []).slice(0, 3),
      format_shift: r.latest_intel?.format_shift,
      recent: (r.latest_intel?.recent_videos || []).slice(0, 3).map((v: any) => ({ title: v.title, views: v.views })),
    }));

  const emergingTop = emerging.slice(0, 8).map((e: any) => ({
    title: e.title,
    channel: e.channel_name,
    views: e.views,
    velocity: e.velocity_score,
    pre_viral: e.pre_viral_score,
  }));

  const nicheCtx = nicheData.map((n: any) => ({
    name: n.name,
    saturation: n.saturation,
    growth: n.growth_rate,
    rpm: n.rpm_estimate,
    trending: (n.trending_topics || []).slice(0, 5),
  }));

  const performanceSummary = {
    videos_analyzed: perf.length,
    top_performers: topPerformers,
    avg_ctr_percent: avgCtr,
    avg_retention_percent: avgRetention,
    week_window_days: 7,
  };
  const nicheSignals = {
    user_reference_channels: refSignals,
    emerging_videos: emergingTop,
    niche_database: nicheCtx,
    competitor_benchmark: channel.competitor_benchmark_json || null,
  };

  // 4. Prompt LLM
  const language = channel.language || "pt-BR";
  const defaultType = (channel.default_video_type as "long" | "short") || "long";
  const defaultDuration = defaultType === "short" ? 60 : 480;

  const systemPrompt = `Você é o Estrategista Semanal do canal "${channel.channel_name}". Sua missão: escolher os ${N} próximos vídeos da semana que MAXIMIZAM views, retenção e crescimento de inscritos, com base em dados reais de performance e tendências do nicho.

Regras:
- Idioma dos títulos/hooks: ${language}
- Nicho: ${channel.niche || "geral"}
- Personagem/voz: ${channel.character_name || "não definido"} — ${channel.character_bio || "sem bio"}
- Estilo visual: ${channel.visual_style_prompt || "não definido"}
- Tipo padrão: ${defaultType} (~${defaultDuration}s)
- Cada tema deve: explorar ÂNGULO inédito, ter HOOK forte (curiosity gap, contradição, número absurdo, transformação), título <60 chars com palavra emocional.
- NÃO repetir temas dos últimos 7 dias listados.
- Justifique cada escolha em 1-2 frases citando o dado que motivou (ex: "hook X teve CTR Y% no canal", "vídeo similar Z bombou no nicho").

Retorne EXATAMENTE ${N} temas via tool call.`;

  const userPrompt = `# DADOS

## Performance do canal (últimos 7 dias) — ${perf.length} vídeos
${JSON.stringify(performanceSummary, null, 2)}

## Sinais do nicho
${JSON.stringify(nicheSignals, null, 2)}

Decida agora os ${N} temas da próxima semana (week_start=${weekStartISO}).`;

  const aiResponse = await callGeminiWithFallback({
    apiKey: Deno.env.get("GOOGLE_AI_API_KEY")!,
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "submit_weekly_themes",
          description: `Submit exactly ${N} video themes for the upcoming week.`,
          parameters: {
            type: "object",
            properties: {
              themes: {
                type: "array",
                minItems: N,
                maxItems: N,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Título final do vídeo, <60 chars" },
                    topic: { type: "string", description: "Tema central em 1 frase" },
                    angle: { type: "string", description: "Ângulo único / abordagem" },
                    hook: { type: "string", description: "Hook dos primeiros 3 segundos" },
                    video_type: { type: "string", enum: ["long", "short"] },
                    duration_seconds: { type: "number" },
                    reasoning: { type: "string", description: "Por que este tema, com base nos dados" },
                  },
                  required: ["title", "topic", "angle", "hook", "video_type", "duration_seconds", "reasoning"],
                },
              },
            },
            required: ["themes"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_weekly_themes" } },
    temperature: 0.7,
  });

  // Extrai tool call
  const toolCall = aiResponse?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("LLM did not return tool call");
  }
  let themes: ThemeDecision[] = [];
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    themes = parsed.themes || [];
  } catch (e) {
    throw new Error(`Failed to parse tool args: ${e instanceof Error ? e.message : e}`);
  }
  if (!themes.length) throw new Error("Empty themes from LLM");

  const tokensUsed = aiResponse?.usage?.total_tokens || 0;
  const costUsd = (tokensUsed / 1_000_000) * 5; // pro estimate

  // 5. Persiste plano
  const planPayload = {
    user_id: channel.user_id,
    channel_id: channel.id,
    week_start: weekStartISO,
    performance_summary: performanceSummary,
    niche_signals: nicheSignals,
    themes,
    model_used: MODEL,
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    status: "draft",
  };

  let planId: string;
  if (existing) {
    const { data: updated, error: updErr } = await admin
      .from("weekly_strategy_plans")
      .update({ ...planPayload, error_message: null })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updErr) throw updErr;
    planId = updated.id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("weekly_strategy_plans")
      .insert(planPayload)
      .select("id")
      .single();
    if (insErr) throw insErr;
    planId = inserted.id;
  }

  if (dryRun) {
    return { channel_id: channel.id, status: "dry_run", plan_id: planId, project_count: themes.length };
  }

  // 6. Cria projetos
  const projectsToInsert = themes.map((t) => ({
    user_id: channel.user_id,
    channel_id_ref: channel.id,
    title: t.title,
    topic: t.topic,
    description: `${t.angle}\n\nHook: ${t.hook}`,
    niche: channel.niche,
    video_type: t.video_type,
    duration_seconds: t.duration_seconds,
    status: "draft",
    created_by_agent: true,
    strategy_plan_id: planId,
    intelligence_json: {
      hook: t.hook,
      angle: t.angle,
      reasoning: t.reasoning,
      generated_by: "weekly-strategy-agent",
      week_start: weekStartISO,
    },
  }));

  const { data: createdProjects, error: projErr } = await admin
    .from("video_projects")
    .insert(projectsToInsert)
    .select("id");

  if (projErr) {
    await admin
      .from("weekly_strategy_plans")
      .update({ status: "failed", error_message: `project_insert: ${projErr.message}` })
      .eq("id", planId);
    throw projErr;
  }

  const projectIds = (createdProjects || []).map((p: any) => p.id);

  await admin
    .from("weekly_strategy_plans")
    .update({ status: "applied", applied_project_ids: projectIds })
    .eq("id", planId);

  await admin
    .from("user_channels")
    .update({ strategist_last_run_at: new Date().toISOString() })
    .eq("id", channel.id);

  return { channel_id: channel.id, status: "applied", plan_id: planId, project_count: projectIds.length };
}

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<any>) {
  const results: any[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const myIdx = idx++;
      try {
        results[myIdx] = await fn(items[myIdx]);
      } catch (e) {
        results[myIdx] = { error: e instanceof Error ? e.message : String(e), item: items[myIdx] };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const { channel_id, dry_run = false, force = false } = body || {};

    const weekStart = nextMondayUTC(new Date());

    let query = admin
      .from("user_channels")
      .select("id,user_id,channel_name,niche,language,character_name,character_bio,visual_style_prompt,weekly_video_target,strategist_enabled,competitor_benchmark_json,posting_days,posting_hour,default_video_type")
      .eq("strategist_enabled", true);

    if (channel_id) query = query.eq("id", channel_id);

    const { data: channels, error: chErr } = await query;
    if (chErr) throw chErr;
    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({ ok: true, channels_processed: 0, message: "no_eligible_channels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eligible = channels.filter((c: any) => (c.weekly_video_target ?? 1) >= 1);

    const results = await runWithConcurrency(eligible, CONCURRENCY, (ch) =>
      processChannel(admin, ch as ChannelRow, weekStart, force, dry_run),
    );

    const summary = {
      ok: true,
      duration_ms: Date.now() - startedAt,
      week_start: weekStart.toISOString().slice(0, 10),
      channels_total: eligible.length,
      applied: results.filter((r) => r?.status === "applied").length,
      skipped: results.filter((r) => r?.status === "skipped").length,
      failed: results.filter((r) => r?.error).length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[weekly-strategy-agent] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
