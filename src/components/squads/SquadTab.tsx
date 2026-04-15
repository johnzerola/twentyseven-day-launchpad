import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SquadPipelineStepper } from '@/components/squads/SquadPipelineStepper';
import { Play, Bot, Loader2 } from 'lucide-react';

interface SquadTabProps {
  toolContext: string; // 'scripts' | 'titles' | 'dubspy' | 'thumbnails' | 'general'
  defaultNiche?: string;
  defaultContext?: string;
}

export function SquadTab({ toolContext, defaultNiche = '', defaultContext = '' }: SquadTabProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [niche, setNiche] = useState(defaultNiche);
  const [context, setContext] = useState(defaultContext);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [toolContext]);

  async function loadData() {
    const [tRes, rRes] = await Promise.all([
      supabase.from('squad_templates').select('*')
        .or(`tool_context.eq.${toolContext},tool_context.eq.general`)
        .order('created_at'),
      supabase.from('squad_runs').select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    if (tRes.data) setTemplates(tRes.data);
    if (rRes.data) setRuns(rRes.data);
  }

  async function startSquad() {
    if (!selectedTemplate || !niche.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('squad-orchestrator', {
        body: {
          action: 'start_run',
          template_id: selectedTemplate.id,
          input_params: { niche, context, language: 'pt-BR', tool_context: toolContext },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Squad iniciado! 🚀');
      setShowStart(false);
      setActiveRun(data.run_id);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar squad');
    } finally {
      setLoading(false);
    }
  }

  if (activeRun) {
    return (
      <SquadPipelineStepper
        runId={activeRun}
        onBack={() => { setActiveRun(null); loadData(); }}
      />
    );
  }

  // Separate tool-specific and general squads
  const toolSquads = templates.filter(t => t.tool_context === toolContext);
  const generalSquads = templates.filter(t => t.tool_context === 'general');

  return (
    <div className="space-y-4">
      {/* Tool-specific squads */}
      {toolSquads.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Squads Especializados
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {toolSquads.map(t => (
              <SquadCard key={t.id} template={t} onStart={() => { setSelectedTemplate(t); setShowStart(true); }} />
            ))}
          </div>
        </div>
      )}

      {/* General squads */}
      {generalSquads.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Squads Gerais
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            {generalSquads.map(t => (
              <SquadCard key={t.id} template={t} onStart={() => { setSelectedTemplate(t); setShowStart(true); }} />
            ))}
          </div>
        </div>
      )}

      {/* Recent runs for this context */}
      {runs.filter(r => (r.input_params as any)?.tool_context === toolContext || toolContext === 'general').length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Execuções Recentes
          </h3>
          <div className="space-y-1.5">
            {runs
              .filter(r => (r.input_params as any)?.tool_context === toolContext || toolContext === 'general')
              .slice(0, 5)
              .map(r => (
                <Card key={r.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setActiveRun(r.id)}>
                  <CardContent className="flex items-center justify-between py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.squad_name}</span>
                      <span className="text-xs text-muted-foreground">• {(r.input_params as any)?.niche}</span>
                    </div>
                    <Badge variant={r.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                      {r.status === 'completed' ? '✅' : r.status === 'paused' ? '⏸' : '🔄'} {r.current_step}/{r.total_steps}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Start dialog */}
      <Dialog open={showStart} onOpenChange={setShowStart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.icon} {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
          <div className="flex flex-wrap gap-1 my-1">
            {((selectedTemplate?.agents as any[]) || []).map((a: any, i: number) => (
              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{a.icon} {a.name}</span>
            ))}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nicho / Tema *</label>
              <Input placeholder="Ex: finanças, curiosidades, tech..." value={niche} onChange={e => setNiche(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Contexto adicional</label>
              <Textarea placeholder="Detalhes do canal, público-alvo, estilo..." value={context} onChange={e => setContext(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStart(false)}>Cancelar</Button>
            <Button onClick={startSquad} disabled={loading || !niche.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Iniciar Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SquadCard({ template, onStart }: { template: any; onStart: () => void }) {
  const agents = (template.agents as any[]) || [];
  const steps = (template.pipeline_steps as any[]) || [];

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{template.icon}</span>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{template.name}</CardTitle>
            <div className="flex gap-1 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{agents.length} agentes</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{steps.length} etapas</Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
        <div className="flex flex-wrap gap-1">
          {agents.map((a: any, i: number) => (
            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{a.icon} {a.name}</span>
          ))}
        </div>
        <Button size="sm" className="w-full" onClick={onStart}>
          <Play className="w-3 h-3 mr-1" /> Iniciar
        </Button>
      </CardContent>
    </Card>
  );
}
