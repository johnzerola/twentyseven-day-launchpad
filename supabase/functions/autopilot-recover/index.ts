// AutoPilot Recover
// Varre video_projects com error_message e tenta reprocessá-los automaticamente.
// Estratégia (1x a cada 30min via cron):
// - Seleciona projetos com error_message != null e (status IN ('error','failed') OU error_message IS NOT NULL)
// - Respeita retry_count < max_retries (default 3)
// - Backoff exponencial: 30min, 2h, 8h
// - Se já passou next_retry_at -> reseta para 'ready_for_production', limpa error_message,
//   incrementa retry_count, calcula próximo scheduled_at se o anterior já passou
// - Se atingiu max_retries -> marca status='failed_permanent' e mantém error_message
// - Atualiza channel_schedule correspondente (status / scheduled_at)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKOFF_MINUTES = [30, 120, 480]; // 30min, 2h, 8h

function nextScheduledAt(current: string | null, ch: any | null, now: Date): string {
  // Se o slot original ainda está no futuro, mantém
  if (current) {
    const t = new Date(current);
    if (t.getTime() > now.getTime() + 60 * 60 * 1000) return current;
  }
  // Senão, agenda para o próximo posting_hour disponível (mínimo +2h)
  const postingHour = typeof ch?.posting_hour === 'number' ? ch.posting_hour : 18;
  const next = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  next.setUTCHours(postingHour, 0, 0, 0);
  if (next.getTime() < now.getTime() + 2 * 60 * 60 * 1000) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Parse body: optional projectId (force single retry) or userId (filter scope)
  let projectIdFilter: string | null = null;
  let userIdFilter: string | null = null;
  let forceImmediate = false;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body?.projectId) projectIdFilter = body.projectId;
      if (body?.userId) userIdFilter = body.userId;
      if (body?.force) forceImmediate = true;
    }
  } catch {}

  const now = new Date();

  // Query projetos elegíveis
  let q = admin
    .from('video_projects')
    .select('id, user_id, status, error_message, retry_count, max_retries, next_retry_at, scheduled_at, channel_id_ref, channel_id, title')
    .not('error_message', 'is', null);
  if (projectIdFilter) q = q.eq('id', projectIdFilter);
  if (userIdFilter) q = q.eq('user_id', userIdFilter);

  const { data: projects, error: pErr } = await q;
  if (pErr) {
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const report: any[] = [];

  for (const p of projects || []) {
    try {
      const retryCount = p.retry_count || 0;
      const maxRetries = p.max_retries || 3;

      // Esgotou tentativas -> marca como permanente (a menos que force)
      if (!forceImmediate && retryCount >= maxRetries) {
        if (p.status !== 'failed_permanent') {
          await admin.from('video_projects')
            .update({ status: 'failed_permanent' })
            .eq('id', p.id);
          await admin.from('channel_schedule')
            .update({ status: 'cancelled', error_message: p.error_message })
            .eq('project_id', p.id);
          report.push({ project_id: p.id, action: 'marked_permanent', retry_count: retryCount });
        } else {
          report.push({ project_id: p.id, action: 'skip_permanent', retry_count: retryCount });
        }
        continue;
      }

      // Respeita next_retry_at (a menos que force)
      if (!forceImmediate && p.next_retry_at && new Date(p.next_retry_at).getTime() > now.getTime()) {
        report.push({ project_id: p.id, action: 'wait_backoff', next_retry_at: p.next_retry_at });
        continue;
      }

      // Busca canal para calcular novo scheduled_at se preciso
      const channelRef = (p as any).channel_id_ref || (p as any).channel_id;
      let channel: any = null;
      if (channelRef) {
        const { data: ch } = await admin
          .from('user_channels')
          .select('id, posting_hour, posting_days, min_interval_hours')
          .eq('id', channelRef)
          .maybeSingle();
        channel = ch;
      }

      const newScheduledAt = nextScheduledAt(p.scheduled_at, channel, now);
      const newRetryCount = retryCount + 1;

      // Calcula próximo backoff (para a TENTATIVA SEGUINTE, caso falhe de novo)
      const backoffMin = BACKOFF_MINUTES[Math.min(newRetryCount, BACKOFF_MINUTES.length - 1)];
      const nextRetryAt = new Date(now.getTime() + backoffMin * 60 * 1000).toISOString();

      const { error: updErr } = await admin.from('video_projects')
        .update({
          status: 'ready_for_production',
          error_message: null,
          retry_count: newRetryCount,
          last_error_at: now.toISOString(),
          next_retry_at: nextRetryAt,
          scheduled_at: newScheduledAt,
        })
        .eq('id', p.id);

      if (updErr) {
        report.push({ project_id: p.id, action: 'error', error: updErr.message });
        continue;
      }

      // Atualiza channel_schedule correspondente
      await admin.from('channel_schedule')
        .update({
          status: 'scheduled',
          scheduled_at: newScheduledAt,
          retry_count: newRetryCount,
          error_message: null,
        })
        .eq('project_id', p.id);

      // Atualiza next_slot_at do canal se este for o mais próximo
      if (channelRef) {
        const { data: ch } = await admin
          .from('user_channels')
          .select('next_slot_at')
          .eq('id', channelRef)
          .maybeSingle();
        if (!ch?.next_slot_at || new Date(ch.next_slot_at).getTime() > new Date(newScheduledAt).getTime()) {
          await admin.from('user_channels')
            .update({ next_slot_at: newScheduledAt })
            .eq('id', channelRef);
        }
      }

      report.push({
        project_id: p.id,
        action: 'retried',
        retry_count: newRetryCount,
        scheduled_at: newScheduledAt,
        next_retry_at: nextRetryAt,
      });
    } catch (e: any) {
      report.push({ project_id: p.id, action: 'exception', error: String(e?.message || e) });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      now: now.toISOString(),
      candidates: projects?.length || 0,
      processed: report.length,
      report,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
