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

    return new Response(JSON.stringify({ report, alerts_count: alerts.length, ts: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
