// AutoPilot Scheduler
// Para cada canal com autopilot_enabled=true, cria slots futuros em channel_schedule
// respeitando posting_days, posting_hour, min_interval_hours e weekly_video_target.
//
// Estratégia (modo economia — 1x/dia):
// - Janela de planejamento: próximos 14 dias
// - Para cada canal:
//   - Calcula horário inicial = max(now, last_posted_at + min_interval_hours)
//   - Avança dia a dia, escolhendo apenas posting_days, na posting_hour
//   - Respeita min_interval_hours entre slots
//   - Limita a weekly_video_target slots por semana ISO
//   - Não duplica slots (verifica scheduled_at existente +/- 30min)
// - Atualiza user_channels.next_slot_at com o primeiro slot novo

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const PLANNING_DAYS = 14;

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function planSlotsForChannel(ch: any, existingSlots: Date[], now: Date): Date[] {
  const postingDays: string[] = Array.isArray(ch.posting_days) && ch.posting_days.length
    ? ch.posting_days
    : ['mon', 'wed', 'fri'];
  const postingHour: number = typeof ch.posting_hour === 'number' ? ch.posting_hour : 18;
  const intervalMs = (ch.min_interval_hours ?? 48) * 3600 * 1000;
  const weeklyTarget = Math.max(1, Math.min(7, ch.weekly_video_target ?? 1));

  // baseline = last_posted_at + interval, mas nunca antes de agora
  const baseline = ch.last_posted_at
    ? new Date(new Date(ch.last_posted_at).getTime() + intervalMs)
    : new Date(now.getTime() + 60 * 60 * 1000);
  let cursor = baseline > now ? baseline : new Date(now.getTime() + 60 * 60 * 1000);

  // Conta slots existentes por semana ISO (apenas scheduled/publishing)
  const weekCount: Record<string, number> = {};
  existingSlots.forEach(d => {
    const w = isoWeek(d);
    weekCount[w] = (weekCount[w] || 0) + 1;
  });

  // Considera o último slot existente para respeitar min_interval
  let lastSlot: Date | null = existingSlots.length
    ? existingSlots.reduce((a, b) => (a > b ? a : b))
    : null;

  const newSlots: Date[] = [];
  const horizon = new Date(now.getTime() + PLANNING_DAYS * 86400000);

  // Itera dia a dia
  const probe = new Date(cursor);
  probe.setUTCHours(postingHour, 0, 0, 0);
  if (probe < cursor) probe.setUTCDate(probe.getUTCDate() + 1);

  let guard = 0;
  while (probe <= horizon && guard++ < 100) {
    const dayKey = Object.keys(DAY_MAP).find(k => DAY_MAP[k] === probe.getUTCDay())!;
    const inDayList = postingDays.includes(dayKey);
    const week = isoWeek(probe);
    const underTarget = (weekCount[week] || 0) < weeklyTarget;
    const respectsInterval = !lastSlot || (probe.getTime() - lastSlot.getTime()) >= intervalMs;
    const isFuture = probe > now;

    if (inDayList && underTarget && respectsInterval && isFuture) {
      newSlots.push(new Date(probe));
      weekCount[week] = (weekCount[week] || 0) + 1;
      lastSlot = new Date(probe);
    }
    // próximo dia, mesma hora
    probe.setUTCDate(probe.getUTCDate() + 1);
    probe.setUTCHours(postingHour, 0, 0, 0);
  }

  return newSlots;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Suporta modo manual (chamado pelo frontend para um único usuário) e modo cron (todos)
  let userIdFilter: string | null = null;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body?.userId) userIdFilter = body.userId;
    }
  } catch {}

  const now = new Date();
  const reportPerChannel: any[] = [];

  // Busca canais com autopilot_enabled=true
  let q = admin.from('user_channels').select('*').eq('autopilot_enabled', true);
  if (userIdFilter) q = q.eq('user_id', userIdFilter);
  const { data: channels, error: chErr } = await q;
  if (chErr) {
    return new Response(JSON.stringify({ error: chErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  for (const ch of channels || []) {
    try {
      // Slots existentes futuros (não cancelados/falhos)
      const { data: existing } = await admin
        .from('channel_schedule')
        .select('scheduled_at, status')
        .eq('channel_id', ch.id)
        .gte('scheduled_at', now.toISOString())
        .in('status', ['scheduled', 'publishing']);

      const existingDates = (existing || []).map((r: any) => new Date(r.scheduled_at));
      const newSlots = planSlotsForChannel(ch, existingDates, now);

      if (newSlots.length === 0) {
        reportPerChannel.push({ channel_id: ch.id, channel_name: ch.channel_name, created: 0, reason: 'já completo' });
        continue;
      }

      // Pré-gera lista de tópicos sugeridos via suggest-themes (uma chamada por canal, reaproveita p/ todos os slots)
      let suggestedTopics: string[] = [];
      try {
        const suggestRes = await fetch(`${supabaseUrl}/functions/v1/suggest-themes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            niche: ch.niche || 'general',
            style: ch.character_bio || undefined,
            language: ch.language || 'pt-BR',
            count: Math.max(newSlots.length, 3),
            channelKnowledge: {
              character_name: ch.character_name,
              character_bio: ch.character_bio,
              visual_style_prompt: ch.visual_style_prompt,
              avoided_topics: ch.avoided_topics || [],
            },
          }),
        });
        if (suggestRes.ok) {
          const json: any = await suggestRes.json();
          const themes = json?.themes || json?.suggestions || json?.ideas || [];
          suggestedTopics = (Array.isArray(themes) ? themes : [])
            .map((t: any) => typeof t === 'string' ? t : (t?.title || t?.topic || t?.theme))
            .filter(Boolean);
        }
      } catch (e) {
        console.warn('suggest-themes failed', e);
      }

      // Insere slots novos (anti-duplicação +/- 30min) e cria video_project por slot
      const created: string[] = [];
      let topicIdx = 0;
      for (const slot of newSlots) {
        const lo = new Date(slot.getTime() - 30 * 60 * 1000).toISOString();
        const hi = new Date(slot.getTime() + 30 * 60 * 1000).toISOString();
        const { data: dup } = await admin
          .from('channel_schedule')
          .select('id')
          .eq('channel_id', ch.id)
          .gte('scheduled_at', lo)
          .lte('scheduled_at', hi)
          .in('status', ['scheduled', 'publishing'])
          .limit(1);
        if (dup && dup.length > 0) continue;

        const topic = suggestedTopics[topicIdx++] || null;

        // Cria video_project queued para esse slot
        let projectId: string | null = null;
        if (topic) {
          const { data: proj } = await admin
            .from('video_projects')
            .insert({
              user_id: ch.user_id,
              channel_id_ref: ch.id,
              title: topic,
              niche: ch.niche || null,
              status: 'queued',
              scheduled_at: slot.toISOString(),
            } as any)
            .select('id')
            .single();
          projectId = proj?.id || null;
        }

        const { error: insErr } = await admin.from('channel_schedule').insert({
          user_id: ch.user_id,
          channel_id: ch.id,
          project_id: projectId,
          scheduled_at: slot.toISOString(),
          status: 'scheduled',
          title: topic,
          topic,
        } as any);
        if (!insErr) created.push(slot.toISOString());
      }

      // Atualiza next_slot_at no canal
      if (created.length > 0) {
        const earliest = created.sort()[0];
        await admin.from('user_channels').update({ next_slot_at: earliest }).eq('id', ch.id);
      }

      reportPerChannel.push({
        channel_id: ch.id,
        channel_name: ch.channel_name,
        created: created.length,
        topics_used: suggestedTopics.slice(0, created.length),
        slots: created,
      });
    } catch (e: any) {
      reportPerChannel.push({ channel_id: ch.id, error: String(e?.message || e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      now: now.toISOString(),
      channels_processed: channels?.length || 0,
      report: reportPerChannel,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
