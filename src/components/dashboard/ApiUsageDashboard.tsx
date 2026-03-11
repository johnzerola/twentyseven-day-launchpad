import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface ApiUsageRow {
  api_name: string;
  requests_used: number;
  daily_limit: number;
  date: string;
}

interface ExecutionLog {
  function_name: string;
  duration_ms: number;
  success: boolean;
  api_calls_made: number;
  created_at: string;
  error_message?: string;
}

interface TaskQueueSummary {
  pending: number;
  running: number;
  done: number;
  failed: number;
}

export const ApiUsageDashboard = () => {
  const [usage, setUsage] = useState<ApiUsageRow[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskQueueSummary>({ pending: 0, running: 0, done: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [usageRes, logsRes, tasksRes] = await Promise.all([
      supabase.from("api_usage").select("*").eq("date", today),
      supabase.from("execution_logs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("task_queue").select("status"),
    ]);

    setUsage((usageRes.data || []) as ApiUsageRow[]);
    setLogs((logsRes.data || []) as ExecutionLog[]);

    const tasks = (tasksRes.data || []) as { status: string }[];
    setTaskSummary({
      pending: tasks.filter(t => t.status === "pending").length,
      running: tasks.filter(t => t.status === "running").length,
      done: tasks.filter(t => t.status === "done").length,
      failed: tasks.filter(t => t.status === "failed").length,
    });

    setLoading(false);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Carregando métricas...</div>;
  }

  return (
    <div className="space-y-4">
      {/* API Usage Cards */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" /> Uso de APIs Hoje
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {usage.map((u) => {
            const pct = u.daily_limit > 0 ? (u.requests_used / u.daily_limit) * 100 : 0;
            const isWarning = pct > 80;
            const isExceeded = pct >= 100;
            return (
              <motion.div key={u.api_name} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium capitalize">{u.api_name}</span>
                    {isExceeded ? (
                      <Badge variant="destructive" className="text-[8px]">LIMIT</Badge>
                    ) : isWarning ? (
                      <Badge className="text-[8px] bg-chart-4/20 text-chart-4">⚠️</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[8px]">OK</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-1">
                    {u.requests_used} / {u.daily_limit}
                  </div>
                  <Progress value={Math.min(100, pct)} className="h-1" />
                </Card>
              </motion.div>
            );
          })}
          {usage.length === 0 && (
            <p className="text-xs text-muted-foreground col-span-full">Nenhum uso registrado hoje.</p>
          )}
        </div>
      </div>

      {/* Task Queue Summary */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-primary" /> Fila de Tarefas
        </h3>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">⏳ Pendentes: {taskSummary.pending}</Badge>
          <Badge className="text-xs bg-chart-4/20 text-chart-4">🔄 Rodando: {taskSummary.running}</Badge>
          <Badge className="text-xs bg-chart-2/20 text-chart-2">✅ Concluídas: {taskSummary.done}</Badge>
          {taskSummary.failed > 0 && (
            <Badge variant="destructive" className="text-xs">❌ Falharam: {taskSummary.failed}</Badge>
          )}
        </div>
        {taskSummary.pending > 100 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="w-3 h-3" /> Backpressure alta! {taskSummary.pending} tasks pendentes.
          </div>
        )}
      </div>

      {/* Recent Execution Logs */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" /> Logs Recentes
        </h3>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] py-1 px-2 rounded bg-muted/30 border border-border">
              {log.success ? (
                <CheckCircle className="w-3 h-3 text-chart-2 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
              )}
              <span className="font-mono font-medium">{log.function_name}</span>
              <span className="text-muted-foreground">{log.duration_ms}ms</span>
              {log.api_calls_made > 0 && (
                <Badge variant="outline" className="text-[8px]">
                  <Zap className="w-2 h-2 mr-0.5" />{log.api_calls_made} calls
                </Badge>
              )}
              <span className="ml-auto text-muted-foreground">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
              {log.error_message && (
                <span className="text-destructive truncate max-w-[120px]" title={log.error_message}>
                  {log.error_message}
                </span>
              )}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum log de execução ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
};
