import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface CostRow {
  provider: string;
  daily_spend: number;
  daily_limit: number;
  daily_pct: number;
  monthly_spend: number;
  monthly_limit: number;
  monthly_pct: number;
  status: 'ok' | 'alert' | 'blocked';
}

interface FunctionRow {
  provider: string;
  function_name: string;
  cost_usd: number;
  calls: number;
  tokens: number;
  last_call: string;
}

export const AiCostPanel = () => {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [funcs, setFuncs] = useState<FunctionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('cost-monitor', { body: {} });
        if (data?.report) setRows(data.report);
        if (data?.function_breakdown) setFuncs(data.function_breakdown);
      } catch (e) {
        console.error('cost-monitor fetch failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando custos…</CardContent></Card>;
  }

  const totalMonthly = funcs.reduce((s, f) => s + f.cost_usd, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="w-4 h-4 text-primary" />
          Custos AI · ${totalMonthly.toFixed(2)} últimos 30d
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="providers">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="providers">Por Provider</TabsTrigger>
            <TabsTrigger value="functions">Por Função</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-3 mt-4">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
            {rows.map((r) => (
              <div key={r.provider} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{r.provider}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      ${r.daily_spend.toFixed(2)} / ${r.daily_limit.toFixed(0)} dia
                    </span>
                    {r.status === 'blocked' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" /> Bloqueado
                      </Badge>
                    )}
                    {r.status === 'alert' && (
                      <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-300">
                        <AlertTriangle className="w-3 h-3" /> Alerta
                      </Badge>
                    )}
                    {r.status === 'ok' && (
                      <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-500/40">
                        <ShieldCheck className="w-3 h-3" /> OK
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={r.daily_pct} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">
                  Mês: ${r.monthly_spend.toFixed(2)} / ${r.monthly_limit.toFixed(0)} ({r.monthly_pct}%)
                </p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="functions" className="mt-4">
            {funcs.length === 0 && <p className="text-sm text-muted-foreground">Sem chamadas registradas ainda.</p>}
            <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
              {funcs.map((f) => (
                <div
                  key={`${f.provider}-${f.function_name}`}
                  className="flex items-center justify-between p-2 rounded-md border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{f.function_name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{f.provider}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {f.calls} chamadas · {(f.tokens / 1000).toFixed(1)}k tokens
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">${f.cost_usd.toFixed(4)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {totalMonthly > 0 ? ((f.cost_usd / totalMonthly) * 100).toFixed(1) : '0'}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
