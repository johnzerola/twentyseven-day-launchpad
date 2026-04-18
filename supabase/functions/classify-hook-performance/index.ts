import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const HOOK_TYPES = [
  "cold_open",
  "dado_impossivel",
  "contradicao",
  "confissao",
  "pergunta_provocativa",
  "conflito_imediato",
  "promessa_direta",
  "cena_in_medias_res",
] as const;

async function classifyHook(apiKey: string, hookText: string): Promise<{ hook_type: string; hook_excerpt: string }> {
  const prompt = `Classifique o HOOK abaixo em UM dos tipos: ${HOOK_TYPES.join(", ")}.
Retorne JSON estrito: { "hook_type": "<um dos tipos>", "hook_excerpt": "<primeiras 1-2 frases do hook>" }

HOOK:
"""${hookText.slice(0, 1500)}"""`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 256,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const parsed = JSON.parse(text);
    return {
      hook_type: HOOK_TYPES.includes(parsed.hook_type) ? parsed.hook_type : "promessa_direta",
      hook_excerpt: (parsed.hook_excerpt || "").slice(0, 500),
    };
  } catch {
    return { hook_type: "promessa_direta", hook_excerpt: hookText.slice(0, 500) };
  }
}

async function processVideo(sb: any, userId: string, ytVideoId: string, googleKey: string): Promise<any> {
  // Skip if already classified
  const { data: existing } = await sb.from("hook_performance_real")
    .select("id").eq("user_id", userId).eq("youtube_video_id", ytVideoId).maybeSingle();
  if (existing) return { skipped: true, reason: "already classified" };

  // Fetch performance metrics + real retention curve
  const { data: perf } = await sb.from("video_performance")
    .select("avg_retention_percent, views_current, niche, published_at, title, retention_curve")
    .eq("user_id", userId).eq("youtube_video_id", ytVideoId).maybeSingle();
  if (!perf) return { skipped: true, reason: "no perf row" };

  // ⭐ Extract REAL retention at 30s and 60s from curve (if available)
  // Curve rows: [{ t: elapsedRatio (0..1), ratio: audienceWatchRatio, rel: relative }]
  const curve: any[] = Array.isArray(perf.retention_curve) ? perf.retention_curve : [];
  function retAt(targetSec: number, totalSec: number): number {
    if (!curve.length || !totalSec) return Number(perf.avg_retention_percent) || 0;
    const targetT = Math.min(targetSec / totalSec, 1);
    // Find closest bucket
    const closest = curve.reduce((best, row) =>
      Math.abs(row.t - targetT) < Math.abs(best.t - targetT) ? row : best
    , curve[0]);
    return Math.round((closest.ratio || 0) * 1000) / 10; // 0..100
  }
  // Estimate video duration from views/avg if no explicit duration; assume 600s for longs as fallback
  const estDuration = 600;

  // Fetch linked script
  const { data: link } = await sb.from("script_performance_link")
    .select("script_id").eq("user_id", userId).eq("youtube_video_id", ytVideoId).maybeSingle();

  let hookText = "";
  let scriptId: string | null = null;
  if (link?.script_id) {
    scriptId = link.script_id;
    const { data: proj } = await sb.from("video_projects")
      .select("script_text, script_content").eq("id", link.script_id).maybeSingle();
    hookText = (proj?.script_text || proj?.script_content || "").slice(0, 2000);
  }

  if (!hookText) return { skipped: true, reason: "no script text" };

  let classified = { hook_type: "promessa_direta", hook_excerpt: hookText.slice(0, 300) };
  try {
    classified = await classifyHook(googleKey, hookText);
  } catch (e) {
    console.warn(`[classify-hook] gemini failed:`, (e as Error).message);
  }

  const avgRet = Number(perf.avg_retention_percent) || 0;
  // ⭐ REAL retention from per-second curve (with avg_retention fallback)
  const ret30 = curve.length ? retAt(30, estDuration) : avgRet;
  const ret60 = curve.length ? retAt(60, estDuration) : avgRet;

  const { error } = await sb.from("hook_performance_real").insert({
    user_id: userId,
    youtube_video_id: ytVideoId,
    script_id: scriptId,
    hook_type: classified.hook_type,
    hook_text: classified.hook_excerpt,
    retention_30s: ret30,
    retention_60s: ret60,
    avg_retention: avgRet,
    views: perf.views_current || 0,
    niche: perf.niche || null,
    published_at: perf.published_at || null,
  });

  return { classified: true, hook_type: classified.hook_type, error: error?.message };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    // Modes:
    // - { user_id, youtube_video_id }  → single
    // - { user_id }                    → all of user
    // - { all: true }                  → backfill everyone
    let toProcess: { user_id: string; youtube_video_id: string }[] = [];

    if (body.user_id && body.youtube_video_id) {
      toProcess = [{ user_id: body.user_id, youtube_video_id: body.youtube_video_id }];
    } else {
      let q = sb.from("video_performance")
        .select("user_id, youtube_video_id")
        .eq("oauth_synced", true)
        .not("avg_retention_percent", "is", null)
        .limit(200);
      if (body.user_id) q = q.eq("user_id", body.user_id);
      const { data } = await q;
      toProcess = (data || []) as any[];
    }

    const results: any[] = [];
    for (const item of toProcess) {
      try {
        results.push({ ...item, ...(await processVideo(sb, item.user_id, item.youtube_video_id, googleKey)) });
      } catch (e) {
        results.push({ ...item, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.filter(r => r.classified).length,
      skipped: results.filter(r => r.skipped).length,
      total: results.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("classify-hook-performance error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
