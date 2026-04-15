import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  runId: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Pendente', icon: '⏳' },
  running: { color: 'bg-primary/20 text-primary', label: 'Executando...', icon: '🔄' },
  approved: { color: 'bg-green-500/20 text-green-400', label: 'Concluído', icon: '✅' },
};

export function SquadPipelineStepper({ runId, onBack }: Props) {
  const [run, setRun] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    loadData();

    // Realtime subscription for live updates
    const channel = supabase
      .channel(`squad-steps-${runId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'squad_steps',
        filter: `run_id=eq.${runId}`,
      }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  async function loadData() {
    const [runRes, stepsRes] = await Promise.all([
      supabase.from('squad_runs').select('*').eq('id', runId).single(),
      supabase.from('squad_steps').select('*').eq('run_id', runId).order('step_index'),
    ]);
    if (runRes.data) setRun(runRes.data);
    if (stepsRes.data) {
      setSteps(stepsRes.data);
      // Auto-expand the last completed or running step
      const activeStep = stepsRes.data.findLast((s: any) => s.status === 'approved' || s.status === 'running');
      if (activeStep) setExpandedStep(activeStep.step_index);
    }
  }

  const completedCount = steps.filter(s => s.status === 'approved').length;
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const isRunning = run?.status === 'running';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold font-syne">{run?.squad_name || 'Squad'}</h2>
            <p className="text-sm text-muted-foreground">
              Nicho: {(run?.input_params as any)?.niche || '—'}
            </p>
          </div>
        </div>
        <Badge variant={run?.status === 'completed' ? 'default' : 'secondary'} className="text-sm">
          {run?.status === 'completed' ? '✅ Concluído' : '🔄 Executando no backend...'}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ${isRunning ? 'animate-pulse' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {completedCount}/{totalSteps} etapas concluídas
          {isRunning && ' — processando...'}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const isExpanded = expandedStep === step.step_index;
          const output = (step.output_data as any)?.content;

          return (
            <Card
              key={step.id}
              className={`border transition-all ${
                step.status === 'running' ? 'border-primary/50 shadow-lg shadow-primary/5' :
                step.status === 'approved' ? 'border-green-500/20' :
                'border-border/50'
              }`}
            >
              <CardHeader
                className="py-3 px-4 cursor-pointer"
                onClick={() => setExpandedStep(isExpanded ? null : step.step_index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      step.status === 'running' ? 'bg-primary/20 text-primary animate-pulse' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {step.status === 'approved' ? <Check className="w-4 h-4" /> :
                       step.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{step.agent_icon}</span>
                        <span className="font-medium text-sm">{step.agent_name}</span>
                        <Badge className={`text-xs ${config.color}`}>
                          {config.icon} {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.task_description}</p>
                    </div>
                  </div>
                  {output && (
                    isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> :
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && output && (
                <CardContent className="pt-0 px-4 pb-4">
                  <ScrollArea className="max-h-[400px]">
                    <div className="prose prose-sm prose-invert max-w-none text-sm bg-muted/50 rounded-lg p-4">
                      <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
