import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, ShieldCheck } from 'lucide-react';

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

export const AiCostPanel = () => {
  const [rows, setRows] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('cost-monitor', { body: {} });
        if (data?.report) setRows(data.report);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="w-4 h-4 text-primary" />
          Custos AI (24h / mês)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
};
