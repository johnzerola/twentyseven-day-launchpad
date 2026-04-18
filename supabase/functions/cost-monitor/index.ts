import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: thresholds } = await sb.from("ai_budget_thresholds").select("*");
    if (!thresholds?.length) {
      return new Response(JSON.stringify({ status: "no_thresholds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: any[] = [];
    const alerts: any[] = [];

    for (const t of thresholds) {
      const { data: dailySpend } = await sb.rpc("get_provider_spend", { _provider: t.provider, _hours: 24 });
      const { data: monthlySpend } = await sb.rpc("get_provider_spend", { _provider: t.provider, _hours: 720 });

      const daily = Number(dailySpend) || 0;
      const monthly = Number(monthlySpend) || 0;
      const dailyPct = (daily / Number(t.daily_limit_usd)) * 100;
      const monthlyPct = (monthly / Number(t.monthly_limit_usd)) * 100;

      const status = dailyPct >= 100 || monthlyPct >= 100 ? "blocked" : dailyPct >= t.alert_at_pct ? "alert" : "ok";

      const entry = {
        provider: t.provider,
        daily_spend: daily,
        daily_limit: Number(t.daily_limit_usd),
        daily_pct: Math.round(dailyPct),
        monthly_spend: monthly,
        monthly_limit: Number(t.monthly_limit_usd),
        monthly_pct: Math.round(monthlyPct),
        status,
      };
      report.push(entry);
      if (status !== "ok") alerts.push(entry);
    }

    if (alerts.length) {
      console.warn("[COST-MONITOR] ALERTS:", JSON.stringify(alerts, null, 2));
      // Persist alert as system log
      await sb.from("api_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        service: "cost-monitor",
        endpoint: "alerts",
        response_code: 200,
        cost: 0,
        tokens_used: 0,
      }).then(() => {}, () => {});
    }

    // ═══ Per-function breakdown (last 30 days) ═══
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: ledgerRows } = await sb
      .from("ai_cost_ledger")
      .select("provider, function_name, cost_usd, tokens, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    const byFunction = new Map<string, { provider: string; function_name: string; cost_usd: number; calls: number; tokens: number; last_call: string }>();
    for (const r of (ledgerRows || []) as any[]) {
      const key = `${r.provider}::${r.function_name}`;
      const cur = byFunction.get(key) || { provider: r.provider, function_name: r.function_name, cost_usd: 0, calls: 0, tokens: 0, last_call: r.created_at };
      cur.cost_usd += Number(r.cost_usd) || 0;
      cur.calls += 1;
      cur.tokens += Number(r.tokens) || 0;
      if (r.created_at > cur.last_call) cur.last_call = r.created_at;
      byFunction.set(key, cur);
    }
    const functionBreakdown = Array.from(byFunction.values())
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .slice(0, 50)
      .map(f => ({ ...f, cost_usd: Math.round(f.cost_usd * 10000) / 10000 }));

    return new Response(JSON.stringify({ report, function_breakdown: functionBreakdown, alerts_count: alerts.length, ts: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
