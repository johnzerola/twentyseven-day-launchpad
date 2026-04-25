// ════════════════════════════════════════════════════════════════════
// WEEKLY NICHE REFERENCES
// For each user channel: searches YouTube for top performing videos in
// the channel's niche over the last 14 days, extracts patterns
// (titles, thumbnails, duration, narrative structure) and saves a
// weekly dossier in `niche_reference_reports`. The dossier is later
// injected into `generate-script` to guide future scripts.
// ════════════════════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callGeminiWithFallback } from "../_shared/gemini-direct.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── ISO week start (Monday, UTC) ───────────────────────────────────
function isoWeekStart(d = new Date()): string {
  const day = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
  const monday = new Date(d);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

// ── Parse ISO 8601 duration to seconds ─────────────────────────────
function parseDuration(iso?: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return Math.round(s[base] + (s[base + 1] !== undefined ? rest * (s[base + 1] - s[base]) : 0));
}

// ── Fetch top performers for a niche ───────────────────────────────
interface TopVideo {
  video_id: string;
  title: string;
  channel_id: string;
  channel_name: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  duration_seconds: number;
  published_at: string;
  url: string;
}

async function fetchNicheTopVideos(
  niche: string,
  language: string | null,
  ytKey: string,
  maxResults = 25,
): Promise<TopVideo[]> {
  const publishedAfter = new Date(Date.now() - 14 * 86400000).toISOString();
  const langParam = language ? `&relevanceLanguage=${language.split("-")[0]}` : "";

  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(niche)}` +
    `&type=video&publishedAfter=${publishedAfter}&order=viewCount&maxResults=${maxResults}` +
    `${langParam}&key=${ytKey}`;
  const sRes = await fetch(searchUrl);
  if (!sRes.ok) {
    console.warn(`[YT search] ${sRes.status}: ${await sRes.text()}`);
    return [];
  }
  const sData = await sRes.json();
  const items = (sData.items || []).filter((i: any) => i.id?.videoId);
  if (!items.length) return [];

  const ids = items.map((i: any) => i.id.videoId).join(",");
  const statsUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet` +
    `&id=${ids}&key=${ytKey}`;
  const stRes = await fetch(statsUrl);
  if (!stRes.ok) return [];
  const stData = await stRes.json();

  const out: TopVideo[] = (stData.items || []).map((v: any) => ({
    video_id: v.id,
    title: v.snippet?.title || "",
    channel_id: v.snippet?.channelId || "",
    channel_name: v.snippet?.channelTitle || "",
    thumbnail:
      v.snippet?.thumbnails?.maxres?.url ||
      v.snippet?.thumbnails?.high?.url ||
      v.snippet?.thumbnails?.medium?.url ||
      "",
    views: parseInt(v.statistics?.viewCount || "0"),
    likes: parseInt(v.statistics?.likeCount || "0"),
    comments: parseInt(v.statistics?.commentCount || "0"),
    duration_seconds: parseDuration(v.contentDetails?.duration),
    published_at: v.snippet?.publishedAt || "",
    url: `https://www.youtube.com/watch?v=${v.id}`,
  }));

  // Filter shorts (<60s) and zero-views noise
  return out
    .filter((v) => v.duration_seconds >= 60 && v.views > 1000)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);
}

// ── Build duration insights from top performers ─────────────────────
function buildDurationInsights(videos: TopVideo[]) {
  const durations = videos.map((v) => v.duration_seconds).filter((d) => d > 0);
  if (!durations.length) return {};
  const med = median(durations);
  return {
    sweet_spot_seconds: med,
    sweet_spot_human: `${Math.floor(med / 60)}m ${med % 60}s`,
    p25_seconds: quantile(durations, 0.25),
    p75_seconds: quantile(durations, 0.75),
    min_seconds: Math.min(...durations),
    max_seconds: Math.max(...durations),
    sample_size: durations.length,
  };
}

// ── Run Gemini consolidation ───────────────────────────────────────
async function consolidateWithAI(
  niche: string,
  language: string,
  videos: TopVideo[],
  durationInsights: any,
) {
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
  if (!GOOGLE_AI_API_KEY) {
    return null;
  }

  const compact = videos.map((v, i) => ({
    rank: i + 1,
    title: v.title,
    channel: v.channel_name,
    views: v.views,
    duration_s: v.duration_seconds,
    engagement: v.views > 0
      ? +(((v.likes + v.comments * 5) / v.views) * 100).toFixed(2)
      : 0,
  }));

  const system = `Você é um analista de vídeos virais do YouTube.
Analise os ${videos.length} vídeos top performers do nicho "${niche}" (idioma: ${language})
e extraia padrões REUTILIZÁVEIS para um criador que quer competir nesse espaço.

Seja específico, conciso, acionável. Cite os títulos como exemplos.`;

  const user = `TOP ${videos.length} VÍDEOS DA SEMANA (ordenados por views):
${JSON.stringify(compact, null, 2)}

DURAÇÃO IDEAL (estatística): mediana=${durationInsights.sweet_spot_seconds}s · p25=${durationInsights.p25_seconds}s · p75=${durationInsights.p75_seconds}s

Extraia padrões que ajudem a próxima leva de roteiros a performar.`;

  const tool = {
    type: "function",
    function: {
      name: "save_reference_report",
      description: "Salva o relatório consolidado de referências",
      parameters: {
        type: "object",
        properties: {
          ai_summary: {
            type: "string",
            description: "Resumo de 4-6 frases em português do que está funcionando agora no nicho.",
          },
          title_patterns: {
            type: "array",
            description: "3 a 5 padrões de título que se repetem nos top videos.",
            items: {
              type: "object",
              properties: {
                pattern: { type: "string", description: "Descrição do padrão (ex: 'Pergunta + número específico')" },
                examples: { type: "array", items: { type: "string" }, description: "1-2 títulos reais que usam esse padrão" },
                why_works: { type: "string", description: "Gatilho psicológico em 1 frase" },
              },
              required: ["pattern", "examples", "why_works"],
            },
          },
          thumbnail_patterns: {
            type: "array",
            description: "2 a 4 padrões visuais inferidos pelos títulos (não vemos a thumb diretamente).",
            items: {
              type: "object",
              properties: {
                style: { type: "string", description: "ex: 'rosto chocado + texto grande'" },
                emotion: { type: "string", description: "Emoção dominante" },
                ctr_signal: { type: "string", description: "Por que esse padrão tende a ter CTR alto" },
              },
              required: ["style", "emotion", "ctr_signal"],
            },
          },
          structure_insights: {
            type: "object",
            properties: {
              hook_styles: { type: "array", items: { type: "string" }, description: "2-3 padrões de hook (0-15s)" },
              acts: {
                type: "array",
                description: "Estrutura típica em 3 atos com tempo médio em segundos.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    avg_seconds: { type: "number" },
                    purpose: { type: "string" },
                  },
                  required: ["name", "avg_seconds", "purpose"],
                },
              },
              retention_tactics: {
                type: "array",
                items: { type: "string" },
                description: "3-5 táticas concretas de retenção observadas",
              },
              payoff_styles: {
                type: "array",
                items: { type: "string" },
                description: "1-3 maneiras como esses vídeos fecham/payoff",
              },
            },
            required: ["hook_styles", "acts", "retention_tactics", "payoff_styles"],
          },
          prompt_injection: {
            type: "string",
            description:
              "Bloco compacto (<800 caracteres) PT-BR pronto para colar no prompt de geração de roteiro. Estilo: bullets curtos com 'USE: …' e 'EVITE: …'. Inclui duração ideal, top 2 padrões de título, top 2 hooks, 3 táticas de retenção.",
          },
        },
        required: [
          "ai_summary",
          "title_patterns",
          "thumbnail_patterns",
          "structure_insights",
          "prompt_injection",
        ],
      },
    },
  };

  try {
    const result = await callGeminiWithFallback(GOOGLE_AI_API_KEY, system, user, {
      model: "gemini-2.5-flash",
      maxTokens: 3000,
      temperature: 0.4,
      jsonMode: true,
    });

    // gemini-direct returns text. Try parse as JSON object first.
    const text = (typeof result === "string" ? result : result?.content || result?.text || "").trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch { /* empty */ }
      }
    }
    if (!parsed) return null;
    return parsed;
  } catch (e) {
    console.error("[consolidateWithAI] failed:", (e as any)?.message);
    return null;
  }
}

// ── Process a single channel ───────────────────────────────────────
async function processChannel(sb: any, channel: any) {
  const week = isoWeekStart();
  const ytKey =
    Deno.env.get("YOUTUBE_API_KEY") ||
    Deno.env.get("YOUTUBE_API_KEY_2") ||
    Deno.env.get("YOUTUBE_API_KEY_3") ||
    Deno.env.get("YOUTUBE_API_KEY_4");
  if (!ytKey) throw new Error("YOUTUBE_API_KEY not configured");
  if (!channel.niche) {
    return { ok: false, reason: "channel has no niche" };
  }

  // Upsert as 'running'
  await sb.from("niche_reference_reports").upsert(
    {
      user_id: channel.user_id,
      channel_id: channel.id,
      niche: channel.niche,
      language: channel.language || "pt-BR",
      week_start: week,
      status: "running",
      error_message: null,
    },
    { onConflict: "channel_id,week_start" },
  );

  try {
    const videos = await fetchNicheTopVideos(channel.niche, channel.language, ytKey, 25);
    if (videos.length < 3) {
      await sb.from("niche_reference_reports").update({
        status: "failed",
        error_message: `Only ${videos.length} videos found for niche "${channel.niche}"`,
        videos_analyzed: videos.length,
      }).eq("channel_id", channel.id).eq("week_start", week);
      return { ok: false, reason: "insufficient videos" };
    }

    const durationInsights = buildDurationInsights(videos);
    const ai = await consolidateWithAI(
      channel.niche,
      channel.language || "pt-BR",
      videos,
      durationInsights,
    );

    const update: any = {
      status: "done",
      videos_analyzed: videos.length,
      top_videos: videos,
      duration_insights: durationInsights,
    };

    if (ai) {
      update.ai_summary = ai.ai_summary || null;
      update.title_patterns = ai.title_patterns || [];
      update.thumbnail_patterns = ai.thumbnail_patterns || [];
      update.structure_insights = ai.structure_insights || {};
      update.prompt_injection = ai.prompt_injection || null;
    } else {
      // Fallback brief: still produce something usable
      const titles = videos.slice(0, 3).map((v) => `"${v.title}"`).join(" · ");
      update.prompt_injection = `📅 REFERÊNCIAS DA SEMANA (${channel.niche}):\n` +
        `Duração ideal: ~${durationInsights.sweet_spot_human}\n` +
        `Top títulos: ${titles}`;
      update.ai_summary = `${videos.length} vídeos top no nicho ${channel.niche} esta semana. Mediana de duração: ${durationInsights.sweet_spot_human}.`;
    }

    await sb.from("niche_reference_reports").update(update)
      .eq("channel_id", channel.id).eq("week_start", week);

    return { ok: true, videos_analyzed: videos.length, ai_used: !!ai };
  } catch (e) {
    const msg = (e as any)?.message || "unknown error";
    await sb.from("niche_reference_reports").update({
      status: "failed",
      error_message: msg.slice(0, 500),
    }).eq("channel_id", channel.id).eq("week_start", week);
    return { ok: false, reason: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const { mode, channel_id, user_id } = body || {};

    let channels: any[] = [];

    if (channel_id) {
      const { data } = await sb
        .from("user_channels")
        .select("id,user_id,channel_name,niche,language,autopilot_enabled")
        .eq("id", channel_id)
        .limit(1);
      channels = data || [];
    } else {
      let q = sb
        .from("user_channels")
        .select("id,user_id,channel_name,niche,language,autopilot_enabled")
        .not("niche", "is", null);
      if (mode === "all") {
        // every channel with a niche
      } else if (user_id) {
        q = q.eq("user_id", user_id);
      } else {
        q = q.eq("autopilot_enabled", true);
      }
      const { data } = await q.limit(50);
      channels = data || [];
    }

    if (!channels.length) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "no eligible channels" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: any[] = [];
    for (const ch of channels) {
      console.log(`[weekly-niche-references] Processing channel ${ch.id} (${ch.channel_name}) niche=${ch.niche}`);
      const r = await processChannel(sb, ch);
      results.push({ channel_id: ch.id, channel_name: ch.channel_name, ...r });
      // Throttle YouTube API
      await new Promise((res) => setTimeout(res, 800));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: results.length,
        succeeded: results.filter((r) => r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[weekly-niche-references] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as any)?.message || "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
