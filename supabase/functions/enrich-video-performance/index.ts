import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// ENRICH VIDEO PERFORMANCE
// Backfill + ongoing enrichment of video_performance:
//   • Resolves channel_id (via video_projects or user_channels)
//   • Resolves niche
//   • Extracts hook_type + title_pattern via Gemini Flash Lite
//
// Body: { user_id?, channel_id?, limit?: 20, force?: false }
// Returns: { processed, hooks_extracted, channels_resolved, errors[] }
// ═══════════════════════════════════════════════════════════════

const HOOK_TYPES = [
  "pergunta",
  "choque",
  "historia",
  "dado",
  "polemica",
  "curiosidade",
  "lista",
  "misterio",
  "negacao",
  "promessa",
] as const;

const SYSTEM_PROMPT = `Você é um analista de roteiros virais do YouTube.
Classifique o vídeo a seguir e retorne APENAS JSON válido (sem markdown, sem comentários).

Schema obrigatório:
{
  "hook_type": "pergunta" | "choque" | "historia" | "dado" | "polemica" | "curiosidade" | "lista" | "misterio" | "negacao" | "promessa",
  "title_pattern": "STRING normalizada de até 40 chars descrevendo o template do título (ex: 'PERGUNTA + REVELAÇÃO', 'NÚMERO + CHOQUE', 'NEGAÇÃO + AUTORIDADE', 'LISTA + SUPERLATIVO', 'NOME PRÓPRIO + TRANSFORMAÇÃO')",
  "niche_inferred": "STRING curta (ex: 'true_crime', 'curiosidades', 'financas', 'documentario', 'entretenimento')"
}`;

interface EnrichResult {
  processed: number;
  hooks_extracted: number;
  channels_resolved: number;
  niches_resolved: number;
  errors: Array<{ id: string; error: string }>;
  duration_ms: number;
}

async function classifyVideo(
  apiKey: string,
  title: string,
  scriptIntro?: string,
): Promise<{
  hook_type: string;
  title_pattern: string;
  niche_inferred: string;
} | null> {
  const userPayload = scriptIntro
    ? `Título: "${title}"\nIntrodução do roteiro: "${scriptIntro.slice(0, 300)}"`
    : `Título: "${title}"`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.warn(`[enrich] gemini ${r.status}: ${errText.slice(0, 200)}`);
      return null;
    }
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ht = String(parsed.hook_type || "").toLowerCase().trim();
    return {
      hook_type: HOOK_TYPES.includes(ht as any) ? ht : "curiosidade",
      title_pattern: String(parsed.title_pattern || "").slice(0, 80) || "GENERIC",
      niche_inferred:
        String(parsed.niche_inferred || "").toLowerCase().trim() || "general",
    };
  } catch (e) {
    console.warn(`[enrich] classify failed: ${(e as Error).message}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, channel_id, limit = 20, force = false } = body || {};

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1) Find candidates needing enrichment ──
    let q = sb
      .from("video_performance")
      .select("id, user_id, youtube_video_id, title, hook_type, title_pattern, niche, channel_id, script_id")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (user_id) q = q.eq("user_id", user_id);
    if (channel_id) q = q.eq("channel_id", channel_id);
    if (!force) q = q.is("hook_type", null);

    const { data: candidates, error: selErr } = await q;
    if (selErr) throw selErr;

    const list = (candidates || []) as any[];
    const result: EnrichResult = {
      processed: 0,
      hooks_extracted: 0,
      channels_resolved: 0,
      niches_resolved: 0,
      errors: [],
      duration_ms: 0,
    };

    if (list.length === 0) {
      result.duration_ms = Date.now() - t0;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2) Pre-fetch channel/project mappings in bulk ──
    const ytIds = list.map((v) => v.youtube_video_id).filter(Boolean);
    const userIds = Array.from(new Set(list.map((v) => v.user_id).filter(Boolean)));

    const [{ data: projects }, { data: channels }] = await Promise.all([
      ytIds.length
        ? sb
            .from("video_projects")
            .select("id, user_id, channel_id_ref, niche, youtube_video_id, script")
            .in("youtube_video_id", ytIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? sb
            .from("user_channels")
            .select("id, user_id, niche, youtube_channel_id")
            .in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const projByYt = new Map<string, any>();
    for (const p of projects || []) {
      if (p.youtube_video_id) projByYt.set(p.youtube_video_id, p);
    }

    // Fallback: 1 channel per user → use it when project mapping is missing
    const channelsByUser = new Map<string, any[]>();
    for (const c of channels || []) {
      if (!channelsByUser.has(c.user_id)) channelsByUser.set(c.user_id, []);
      channelsByUser.get(c.user_id)!.push(c);
    }

    // ── 3) Process each candidate ──
    for (const v of list) {
      try {
        result.processed += 1;

        const proj = v.youtube_video_id ? projByYt.get(v.youtube_video_id) : null;
        const userChannels = channelsByUser.get(v.user_id) || [];
        const fallbackChannel = userChannels.length === 1 ? userChannels[0] : null;

        const resolvedChannelId =
          v.channel_id || proj?.channel_id_ref || fallbackChannel?.id || null;
        const resolvedNiche =
          v.niche || proj?.niche || fallbackChannel?.niche || null;

        // Pull script intro if available (for better hook classification)
        let scriptIntro: string | undefined;
        if (proj?.script && typeof proj.script === "string") {
          scriptIntro = proj.script.slice(0, 300);
        }

        const classification = await classifyVideo(apiKey, v.title || "", scriptIntro);

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (resolvedChannelId && !v.channel_id) {
          updates.channel_id = resolvedChannelId;
          result.channels_resolved += 1;
        }
        if (resolvedNiche && !v.niche) {
          updates.niche = resolvedNiche;
          result.niches_resolved += 1;
        }
        if (proj?.id && !v.script_id) {
          updates.script_id = proj.id;
        }
        if (classification) {
          updates.hook_type = classification.hook_type;
          updates.title_pattern = classification.title_pattern;
          if (!resolvedNiche && classification.niche_inferred) {
            updates.niche = classification.niche_inferred;
            result.niches_resolved += 1;
          }
          result.hooks_extracted += 1;
        }

        if (Object.keys(updates).length > 1) {
          const { error: upErr } = await sb
            .from("video_performance")
            .update(updates)
            .eq("id", v.id);
          if (upErr) throw upErr;
        }
      } catch (e) {
        result.errors.push({
          id: v.id,
          error: (e as Error).message,
        });
      }
    }

    result.duration_ms = Date.now() - t0;
    console.log(
      `[enrich-video-performance] processed=${result.processed} hooks=${result.hooks_extracted} channels=${result.channels_resolved} errors=${result.errors.length} (${result.duration_ms}ms)`,
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enrich-video-performance] fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
