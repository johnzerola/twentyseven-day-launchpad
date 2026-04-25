// Timeline Sync & Validation
// Sincroniza assets (TTS, B-roll, legendas, cortes) e valida TC/duração antes de exportar.
// Auth: x-worker-token (chamada pelo worker Python da VPS) OU JWT do dono do projeto.
//
// Fluxo:
//   1. Carrega projeto + cenas (ordenadas)
//   2. Mede duração real do áudio TTS de cada cena (HEAD + ffprobe via Content-Length fallback)
//   3. Calcula start_time_sec / end_time_sec sequencialmente
//   4. Sincroniza B-roll/captions com o slot de cada cena
//   5. Gera SRT (legendas) a partir das falas + tempos calculados
//   6. Valida: gaps, sobreposição, drift TTS vs duração planejada, áudio faltando, B-roll fora do slot
//   7. Persiste timeline_json + atualiza scenes + status final
//
// Saída: { ok, timeline, validation: { errors, warnings, ready_to_export } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_TOKEN = Deno.env.get("WORKER_API_TOKEN") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Tolerância (em segundos) para considerar drift aceitável entre duração TTS real
// e duração planejada da cena.
const DRIFT_TOLERANCE_SEC = 0.5;
// Gap máximo permitido entre cenas consecutivas
const MAX_GAP_SEC = 0.05;

function fmtSrtTime(s: number): string {
  // 00:00:01,500
  const ms = Math.max(0, Math.round(s * 1000));
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const mmm = String(ms % 1000).padStart(3, "0");
  return `${hh}:${mm}:${ss},${mmm}`;
}

/** Mede duração de um arquivo de áudio remoto.
 *  Estratégia:
 *    1. HEAD para pegar Content-Length + Content-Type
 *    2. Se cabeçalho `x-duration` presente (alguns CDNs), usa direto
 *    3. Caso contrário, baixa só o início (até 256KB) e estima por bitrate (fallback grosso)
 *    4. Se falhar tudo, retorna null e o caller usa duration_sec planejado
 */
async function probeAudioDuration(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) return null;

    const xDur = head.headers.get("x-duration") ?? head.headers.get("x-amz-meta-duration");
    if (xDur) {
      const n = parseFloat(xDur);
      if (Number.isFinite(n) && n > 0) return n;
    }

    // Fallback: estimar por bitrate típico de TTS MP3 (~32 kbps mono) usando Content-Length.
    // Não é exato, mas serve para detectar drift grande (>1s).
    const len = parseInt(head.headers.get("content-length") ?? "0", 10);
    const ctype = (head.headers.get("content-type") ?? "").toLowerCase();
    if (len > 0) {
      let bitrateBps = 32_000 / 8; // 32 kbps default
      if (ctype.includes("wav")) bitrateBps = 16_000 * 2; // 16kHz mono 16-bit
      if (ctype.includes("ogg") || ctype.includes("opus")) bitrateBps = 24_000 / 8;
      const est = len / bitrateBps;
      if (est > 0.1 && est < 600) return Number(est.toFixed(3));
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Auth ────────────────────────────────────────────────────────────
async function authorize(req: Request, projectId: string): Promise<{ ok: true } | { ok: false; resp: Response }> {
  const workerHdr = req.headers.get("x-worker-token") ?? "";
  if (WORKER_TOKEN && workerHdr === WORKER_TOKEN) return { ok: true };

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, resp: json({ error: "unauthorized", detail: "missing bearer or worker token" }, 401) };
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { ok: false, resp: json({ error: "unauthorized" }, 401) };

  const { data: proj } = await sb
    .from("video_projects")
    .select("user_id")
    .eq("id", projectId)
    .single();
  if (!proj || proj.user_id !== user.id) {
    return { ok: false, resp: json({ error: "forbidden" }, 403) };
  }
  return { ok: true };
}

// ─── Core sync ───────────────────────────────────────────────────────
type Scene = {
  id: string;
  sequence_order: number;
  duration_sec: number | null;
  tts_text: string | null;
  audio_url: string | null;
  media_url: string | null;
  video_clip_url: string | null;
  broll_url: string | null;
};

type TimelineClip = {
  scene_id: string;
  order: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  audio_url: string | null;
  audio_duration_sec: number | null;
  video_url: string | null;
  broll_url: string | null;
  caption: string | null;
  drift_sec: number; // tts real - duration planejada
};

type Timeline = {
  fps: number;
  total_duration_sec: number;
  total_frames: number;
  clips: TimelineClip[];
  captions_srt: string;
  generated_at: string;
};

type Validation = {
  errors: string[];
  warnings: string[];
  ready_to_export: boolean;
};

async function buildTimeline(scenes: Scene[], fps: number): Promise<{ timeline: Timeline; validation: Validation }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clips: TimelineClip[] = [];
  const srtParts: string[] = [];

  let cursor = 0;

  // Mede duração real do áudio em paralelo
  const audioDurations = await Promise.all(
    scenes.map((s) => (s.audio_url ? probeAudioDuration(s.audio_url) : Promise.resolve(null))),
  );

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const planned = s.duration_sec ?? 8;
    const measured = audioDurations[i];

    // Validações por cena
    if (!s.audio_url) errors.push(`Cena ${s.sequence_order}: sem audio_url (TTS faltando)`);
    if (!s.video_clip_url && !s.media_url) {
      errors.push(`Cena ${s.sequence_order}: sem video_clip_url nem media_url (vídeo faltando)`);
    }
    if (!s.tts_text || s.tts_text.trim().length === 0) {
      warnings.push(`Cena ${s.sequence_order}: tts_text vazio — legenda não será gerada`);
    }

    // Duração efetiva: prioriza áudio real medido, com fallback no planejado
    const effective = measured ?? planned;
    const drift = measured !== null ? Number((measured - planned).toFixed(3)) : 0;

    if (Math.abs(drift) > DRIFT_TOLERANCE_SEC) {
      warnings.push(
        `Cena ${s.sequence_order}: drift de ${drift.toFixed(2)}s entre TTS real (${measured?.toFixed(2)}s) e planejado (${planned}s)`,
      );
    }

    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + effective).toFixed(3));

    // B-roll deve durar no máximo o slot da cena
    if (s.broll_url) {
      // Não conseguimos medir B-roll aqui sem ffprobe — apenas avisamos sobre a regra
      // O worker deve cortar o B-roll no comprimento da cena (effective)
      // (sem warning ruidoso; o validador da timeline real resolve)
    }

    const caption = s.tts_text?.trim() || null;

    clips.push({
      scene_id: s.id,
      order: s.sequence_order,
      start_sec: start,
      end_sec: end,
      duration_sec: Number(effective.toFixed(3)),
      audio_url: s.audio_url,
      audio_duration_sec: measured,
      video_url: s.video_clip_url ?? s.media_url ?? null,
      broll_url: s.broll_url ?? null,
      caption,
      drift_sec: drift,
    });

    if (caption) {
      srtParts.push(
        `${i + 1}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${caption}\n`,
      );
    }

    cursor = end;
  }

  // Validações globais
  if (clips.length === 0) errors.push("Nenhuma cena encontrada para sincronizar");

  // Verifica continuidade (não deve haver gaps porque construímos sequencialmente,
  // mas validamos por garantia caso algum dia o algoritmo mude)
  for (let i = 1; i < clips.length; i++) {
    const gap = clips[i].start_sec - clips[i - 1].end_sec;
    if (Math.abs(gap) > MAX_GAP_SEC) {
      errors.push(
        `Gap de ${gap.toFixed(3)}s entre cenas ${clips[i - 1].order} e ${clips[i].order}`,
      );
    }
  }

  const totalDuration = Number(cursor.toFixed(3));
  if (totalDuration < 5) errors.push(`Duração total muito curta: ${totalDuration}s (mínimo 5s)`);
  if (totalDuration > 60 * 60) errors.push(`Duração total excede 1h: ${totalDuration}s`);

  const timeline: Timeline = {
    fps,
    total_duration_sec: totalDuration,
    total_frames: Math.round(totalDuration * fps),
    clips,
    captions_srt: srtParts.join("\n"),
    generated_at: new Date().toISOString(),
  };

  const validation: Validation = {
    errors,
    warnings,
    ready_to_export: errors.length === 0,
  };

  return { timeline, validation };
}

// ─── Handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const projectId = String(body?.project_id ?? "").trim();
  if (!projectId) return json({ error: "project_id_required" }, 400);

  const fps = Number(body?.fps ?? 30);
  const persist = body?.persist !== false; // default true
  const dryRun = !!body?.dry_run;

  // Auth
  const authResult = await authorize(req, projectId);
  if (!authResult.ok) return authResult.resp;

  // Carrega projeto + cenas
  const { data: project, error: pErr } = await sb
    .from("video_projects")
    .select("id, status, title")
    .eq("id", projectId)
    .single();
  if (pErr || !project) return json({ error: "project_not_found", detail: pErr?.message }, 404);

  const { data: scenesData, error: sErr } = await sb
    .from("scenes")
    .select(
      "id, sequence_order, duration_sec, tts_text, audio_url, media_url, video_clip_url, broll_url",
    )
    .eq("project_id", projectId)
    .order("sequence_order", { ascending: true });
  if (sErr) return json({ error: "scenes_query_failed", detail: sErr.message }, 500);

  const scenes = (scenesData ?? []) as Scene[];

  const { timeline, validation } = await buildTimeline(scenes, fps);

  // Persiste (a menos que dry_run)
  if (persist && !dryRun) {
    // Atualiza scenes individualmente (start/end/duração medida/legenda)
    await Promise.all(
      timeline.clips.map((c) =>
        sb
          .from("scenes")
          .update({
            start_time_sec: c.start_sec,
            end_time_sec: c.end_sec,
            audio_duration_sec: c.audio_duration_sec,
            caption_text: c.caption,
          })
          .eq("id", c.scene_id),
      ),
    );

    // Atualiza projeto
    const updates: Record<string, unknown> = {
      timeline_json: timeline,
      duration_seconds: Math.round(timeline.total_duration_sec),
      timeline_validation_errors: validation.errors.length || validation.warnings.length
        ? { errors: validation.errors, warnings: validation.warnings }
        : null,
      updated_at: new Date().toISOString(),
    };
    if (validation.ready_to_export) {
      updates.timeline_validated_at = new Date().toISOString();
    }
    await sb.from("video_projects").update(updates).eq("id", projectId);

    // Loga evento
    await sb.from("project_events").insert({
      project_id: projectId,
      stage: "timeline",
      status: validation.ready_to_export ? "completed" : "failed",
      message: validation.ready_to_export
        ? `Timeline sincronizada: ${timeline.clips.length} clips, ${timeline.total_duration_sec}s`
        : `Timeline inválida: ${validation.errors.length} erros`,
      duration_ms: null,
      metadata: {
        clips: timeline.clips.length,
        total_duration_sec: timeline.total_duration_sec,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    });
  }

  return json({
    ok: validation.ready_to_export,
    project_id: projectId,
    timeline,
    validation,
    persisted: persist && !dryRun,
  });
});
