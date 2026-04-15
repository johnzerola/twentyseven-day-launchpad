import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Check, X, RotateCcw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  runId: string;
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Pendente', icon: '⏳' },
  running: { color: 'bg-primary/20 text-primary', label: 'Executando...', icon: '🔄' },
  completed: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Aguardando Aprovação', icon: '👀' },
  approved: { color: 'bg-green-500/20 text-green-400', label: 'Aprovado', icon: '✅' },
  rejected: { color: 'bg-destructive/20 text-destructive', label: 'Revisão Solicitada', icon: '🔄' },
  skipped: { color: 'bg-muted text-muted-foreground', label: 'Pulado', icon: '⏭' },
};

export function SquadPipelineStepper({ runId, onBack }: Props) {
  const [run, setRun] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    loadData();

    // Realtime subscription for step updates
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
      // Auto-expand the current active step
      const activeStep = stepsRes.data.find((s: any) => s.status === 'completed' || s.status === 'running');
      if (activeStep) setExpandedStep(activeStep.step_index);
    }
  }

  async function approveStep(stepIndex: number) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('squad-orchestrator', {
        body: { action: 'approve_step', run_id: runId, step_index: stepIndex, feedback },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Etapa aprovada! Próximo agente iniciando...');
      setFeedback('');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao aprovar');
    } finally {
      setLoading(false);
    }
  }

  async function rejectStep(stepIndex: number) {
    if (!feedback.trim()) {
      toast.error('Adicione um feedback para o agente refazer a tarefa');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('squad-orchestrator', {
        body: { action: 'reject_step', run_id: runId, step_index: stepIndex, feedback },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Revisão solicitada ao agente');
      setFeedback('');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao solicitar revisão');
    } finally {
      setLoading(false);
    }
  }

  const completedCount = steps.filter(s => s.status === 'approved').length;
  const totalSteps = steps.length;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

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
          {run?.status === 'completed' ? '✅ Concluído' : run?.status === 'paused' ? '⏸ Aguardando aprovação' : '🔄 Executando'}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {completedCount}/{totalSteps} etapas concluídas
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const isExpanded = expandedStep === step.step_index;
          const output = (step.output_data as any)?.content;
          const needsApproval = step.status === 'completed' && step.requires_approval;

          return (
            <Card
              key={step.id}
              className={`border transition-all ${
                needsApproval ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/5' :
                step.status === 'running' ? 'border-primary/50 shadow-lg shadow-primary/5' :
                'border-border/50'
              }`}
            >
              <CardHeader
                className="py-3 px-4 cursor-pointer"
                onClick={() => setExpandedStep(isExpanded ? null : step.step_index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Step indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      step.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      step.status === 'running' ? 'bg-primary/20 text-primary animate-pulse' :
                      needsApproval ? 'bg-yellow-500/20 text-yellow-400' :
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
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  {/* Output */}
                  <ScrollArea className="max-h-[400px]">
                    <div className="prose prose-sm prose-invert max-w-none text-sm bg-muted/50 rounded-lg p-4">
                      <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                  </ScrollArea>

                  {/* Approval controls */}
                  {needsApproval && (
                    <div className="space-y-2 border-t border-border/50 pt-3">
                      <Textarea
                        placeholder="Feedback para o agente (obrigatório para revisão)..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveStep(step.step_index)}
                          disabled={loading}
                          className="flex-1"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          Aprovar e Continuar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => rejectStep(step.step_index)}
                          disabled={loading || !feedback.trim()}
                          className="flex-1"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> Solicitar Revisão
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
