import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface PerfRow {
  title: string | null;
  ctr_percent: number | null;
  avg_retention_percent: number | null;
  niche: string | null;
  published_at: string | null;
}

async function callGeminiJson(apiKey: string, prompt: string): Promise<any> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try { return JSON.parse(text); } catch { return {}; }
}

async function processUser(sb: any, userId: string, googleKey: string): Promise<any> {
  // Pull video performance with CTR
  const { data: performances } = await sb
    .from("video_performance")
    .select("title, ctr_percent, avg_retention_percent, niche, published_at, channel_id")
    .eq("user_id", userId)
    .not("ctr_percent", "is", null)
    .not("title", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (!performances || performances.length < 3) {
    return { user_id: userId, skipped: true, reason: "not enough data" };
  }

  // Group by niche (or 'general')
  const byNiche: Record<string, PerfRow[]> = {};
  for (const p of performances as PerfRow[]) {
    const key = (p.niche || "general").toLowerCase();
    if (!byNiche[key]) byNiche[key] = [];
    byNiche[key].push(p);
  }

  const results: any[] = [];
  for (const [niche, rows] of Object.entries(byNiche)) {
    if (rows.length < 3) continue;

    const ctrs = rows.map(r => Number(r.ctr_percent) || 0);
    const avgCtr = ctrs.reduce((a, b) => a + b, 0) / ctrs.length;
    const top = rows.filter(r => Number(r.ctr_percent) >= avgCtr * 1.2).slice(0, 30);
    const low = rows.filter(r => Number(r.ctr_percent) <= avgCtr * 0.8).slice(0, 30);
    const topCtr = top.length ? top.reduce((s, r) => s + Number(r.ctr_percent), 0) / top.length : avgCtr;

    let analysis: any = {};
    if (top.length >= 2 && low.length >= 2) {
      try {
        const prompt = `Você analisa TÍTULOS de vídeos do YouTube para extrair padrões reais que aumentam ou reduzem CTR.

NICHO: ${niche}
CTR MÉDIO DO CANAL: ${avgCtr.toFixed(2)}%

TÍTULOS COM ALTO CTR (média ${topCtr.toFixed(2)}%):
${top.map(r => `• "${r.title}" → ${Number(r.ctr_percent).toFixed(2)}%`).join('\n')}

TÍTULOS COM BAIXO CTR (abaixo de ${(avgCtr * 0.8).toFixed(2)}%):
${low.map(r => `• "${r.title}" → ${Number(r.ctr_percent).toFixed(2)}%`).join('\n')}

Retorne JSON estrito:
{
  "winning_patterns": ["padrão estrutural curto", ...],   // 4-6 itens
  "losing_patterns": ["padrão a evitar", ...],            // 3-5 itens
  "best_openers": ["palavra/frase de abertura que converte", ...], // 3-6 itens
  "niche_power_words": ["palavra1", "palavra2", ...],     // 5-10 itens em ${niche}
  "optimal_length": 60,                                    // chars do título médio dos vencedores
  "notes": "resumo de 1-2 frases sobre o que funciona neste canal"
}`;
        analysis = await callGeminiJson(googleKey, prompt);
      } catch (e) {
        console.warn(`[learn-from-ctr] gemini failed for ${userId}/${niche}:`, (e as Error).message);
      }
    }

    const { error } = await sb.from("user_ctr_patterns").upsert({
      user_id: userId,
      niche,
      winning_patterns: analysis.winning_patterns || [],
      losing_patterns: analysis.losing_patterns || [],
      best_openers: analysis.best_openers || [],
      niche_power_words: analysis.niche_power_words || [],
      optimal_length: analysis.optimal_length || null,
      data_points: rows.length,
      avg_ctr: Number(avgCtr.toFixed(2)),
      top_ctr: Number(topCtr.toFixed(2)),
      last_analysis_notes: analysis.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,niche" });

    results.push({ niche, n: rows.length, avg_ctr: avgCtr, error: error?.message });
  }

  return { user_id: userId, niches: results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const googleKey = Deno.env.get("GOOGLE_AI_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    let userIds: string[] = [];
    if (body.user_id) {
      userIds = [body.user_id];
    } else if (body.all === true) {
      // Cron mode: all users with OAuth synced perf in last 30 days
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await sb.from("video_performance")
        .select("user_id")
        .gte("synced_at", since)
        .not("ctr_percent", "is", null)
        .limit(500);
      userIds = [...new Set((data || []).map((r: any) => r.user_id))];
    } else {
      return new Response(JSON.stringify({ error: "missing user_id or all=true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const uid of userIds) {
      try {
        results.push(await processUser(sb, uid, googleKey));
      } catch (e) {
        results.push({ user_id: uid, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: userIds.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("learn-from-ctr error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
