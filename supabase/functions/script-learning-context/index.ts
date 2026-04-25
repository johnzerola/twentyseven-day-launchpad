import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════
// SCRIPT LEARNING CONTEXT
// Returns a compact "learning brief" to be injected into
// generate-script prompts. Built from REAL channel performance:
//
//   • Top 3 hook types (by avg retention/views)
//   • Top 3 title patterns
//   • Worst-performing patterns (to avoid)
//   • Average channel CTR / retention baseline
//   • Last 7-day trend
//
// Designed to be ~300-600 tokens — small enough to inject
// in every script generation without inflating cost.
// ═══════════════════════════════════════════════════════════════

interface LearningBrief {
  has_data: boolean;
  sample_size: number;
  baseline: {
    avg_ctr: number | null;
    avg_retention: number | null;
    avg_views: number | null;
  };
  top_hooks: Array<{
    hook_type: string;
    avg_retention: number;
    avg_views: number;
    samples: number;
    example_title?: string;
  }>;
  top_title_patterns: Array<{
    pattern: string;
    avg_views: number;
    samples: number;
  }>;
  avoid_patterns: Array<{
    type: "hook" | "title";
    value: string;
    avg_retention?: number;
    avg_views?: number;
    reason: string;
  }>;
  prompt_brief: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, channel_id, niche, limit = 30 } = body || {};

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1) Fetch channel videos with performance data ──
    let q = sb
      .from("video_performance")
      .select(
        "youtube_video_id,title,niche,hook_type,title_pattern,views_current,ctr_percent,avg_retention_percent,published_at,channel_id"
      )
      .eq("user_id", user_id)
      .gt("views_current", 0)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (channel_id) q = q.eq("channel_id", channel_id);
    if (niche) q = q.eq("niche", niche);

    const { data: videos, error: vidErr } = await q;
    if (vidErr) throw vidErr;

    const sample = (videos || []) as any[];

    if (sample.length < 3) {
      const empty: LearningBrief = {
        has_data: false,
        sample_size: sample.length,
        baseline: { avg_ctr: null, avg_retention: null, avg_views: null },
        top_hooks: [],
        top_title_patterns: [],
        avoid_patterns: [],
        prompt_brief:
          "AINDA NÃO HÁ DADOS HISTÓRICOS DESTE CANAL. Use boas práticas gerais do nicho.",
      };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2) Baselines ──
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((s, x) => s + (x || 0), 0) / xs.length : 0;
    const ctrVals = sample
      .map((v) => Number(v.ctr_percent || 0))
      .filter((x) => x > 0);
    const retVals = sample
      .map((v) => Number(v.avg_retention_percent || 0))
      .filter((x) => x > 0);
    const viewVals = sample.map((v) => Number(v.views_current || 0));

    const baseline = {
      avg_ctr: ctrVals.length ? +avg(ctrVals).toFixed(2) : null,
      avg_retention: retVals.length ? +avg(retVals).toFixed(2) : null,
      avg_views: viewVals.length ? Math.round(avg(viewVals)) : null,
    };

    // ── 3) Aggregate by hook_type ──
    const byHook = new Map<
      string,
      { rets: number[]; views: number[]; titles: string[] }
    >();
    for (const v of sample) {
      const ht = (v.hook_type || "unknown").toLowerCase();
      if (!byHook.has(ht))
        byHook.set(ht, { rets: [], views: [], titles: [] });
      const e = byHook.get(ht)!;
      if (v.avg_retention_percent) e.rets.push(Number(v.avg_retention_percent));
      e.views.push(Number(v.views_current || 0));
      if (v.title) e.titles.push(v.title);
    }

    const hookStats = Array.from(byHook.entries())
      .filter(([k, e]) => k !== "unknown" && e.views.length >= 2)
      .map(([k, e]) => ({
        hook_type: k,
        avg_retention: +avg(e.rets).toFixed(2),
        avg_views: Math.round(avg(e.views)),
        samples: e.views.length,
        example_title: e.titles[0],
      }))
      .sort((a, b) => {
        // Combined score: retention is more reliable than views (less noise)
        const scoreA = a.avg_retention * 100 + Math.log10(a.avg_views + 1) * 10;
        const scoreB = b.avg_retention * 100 + Math.log10(b.avg_views + 1) * 10;
        return scoreB - scoreA;
      });

    const top_hooks = hookStats.slice(0, 3);
    const worst_hook =
      hookStats.length >= 4 ? hookStats[hookStats.length - 1] : null;

    // ── 4) Aggregate by title_pattern ──
    const byTitle = new Map<string, number[]>();
    for (const v of sample) {
      const tp = (v.title_pattern || "").trim();
      if (!tp) continue;
      if (!byTitle.has(tp)) byTitle.set(tp, []);
      byTitle.get(tp)!.push(Number(v.views_current || 0));
    }

    const titleStats = Array.from(byTitle.entries())
      .filter(([_, vs]) => vs.length >= 2)
      .map(([pattern, vs]) => ({
        pattern,
        avg_views: Math.round(avg(vs)),
        samples: vs.length,
      }))
      .sort((a, b) => b.avg_views - a.avg_views);

    const top_title_patterns = titleStats.slice(0, 3);
    const worst_title =
      titleStats.length >= 3 ? titleStats[titleStats.length - 1] : null;

    // ── 5) Build avoid list ──
    const avoid_patterns: LearningBrief["avoid_patterns"] = [];
    if (worst_hook && baseline.avg_retention &&
        worst_hook.avg_retention < baseline.avg_retention * 0.7) {
      avoid_patterns.push({
        type: "hook",
        value: worst_hook.hook_type,
        avg_retention: worst_hook.avg_retention,
        reason: `retenção ${worst_hook.avg_retention}% (${Math.round(
          (worst_hook.avg_retention / baseline.avg_retention) * 100
        )}% do baseline)`,
      });
    }
    if (worst_title && baseline.avg_views &&
        worst_title.avg_views < baseline.avg_views * 0.6) {
      avoid_patterns.push({
        type: "title",
        value: worst_title.pattern,
        avg_views: worst_title.avg_views,
        reason: `views ${worst_title.avg_views.toLocaleString()} (${Math.round(
          (worst_title.avg_views / baseline.avg_views) * 100
        )}% do baseline)`,
      });
    }

    // ── 6) Compose prompt brief (token-efficient) ──
    const lines: string[] = [];
    lines.push(`📊 APRENDIZADO REAL DO CANAL (n=${sample.length} vídeos):`);
    lines.push(
      `Baseline: CTR ${baseline.avg_ctr ?? "—"}% · Retenção ${baseline.avg_retention ?? "—"}% · Views médias ${baseline.avg_views?.toLocaleString() ?? "—"}`
    );

    if (top_hooks.length) {
      lines.push("");
      lines.push("✅ HOOKS QUE FUNCIONAM NESTE CANAL (use estes padrões):");
      top_hooks.forEach((h, i) => {
        lines.push(
          `  ${i + 1}. "${h.hook_type}" → retenção ${h.avg_retention}%, ${h.avg_views.toLocaleString()} views médias (${h.samples} vídeos)${h.example_title ? ` · ex: "${h.example_title.slice(0, 80)}"` : ""}`
        );
      });
    }

    if (top_title_patterns.length) {
      lines.push("");
      lines.push("✅ TÍTULOS QUE PERFORMAM:");
      top_title_patterns.forEach((t, i) => {
        lines.push(
          `  ${i + 1}. ${t.pattern} → ${t.avg_views.toLocaleString()} views médias (${t.samples} vídeos)`
        );
      });
    }

    if (avoid_patterns.length) {
      lines.push("");
      lines.push("⚠️ EVITE (performance comprovadamente baixa):");
      avoid_patterns.forEach((a) => {
        lines.push(`  • ${a.type}: "${a.value}" — ${a.reason}`);
      });
    }

    lines.push("");
    lines.push(
      "INSTRUÇÃO: Adapte o roteiro para SUPERAR o baseline acima. Reuse padrões vencedores; nunca repita os padrões evitados."
    );

    const brief: LearningBrief = {
      has_data: true,
      sample_size: sample.length,
      baseline,
      top_hooks,
      top_title_patterns,
      avoid_patterns,
      prompt_brief: lines.join("\n"),
    };

    return new Response(JSON.stringify(brief), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("script-learning-context error:", e);
    return new Response(
      JSON.stringify({
        error: (e as any)?.message ?? "Unknown error",
        has_data: false,
        prompt_brief: "",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
