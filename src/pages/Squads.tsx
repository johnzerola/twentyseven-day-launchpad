import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SquadPipelineStepper } from '@/components/squads/SquadPipelineStepper';
import { Play, Bot, Zap, Flame, Film, Brain, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SQUAD_ICONS: Record<string, typeof Bot> = {
  production: Film,
  viral_detector: Flame,
  shorts_factory: Zap,
};

export default function Squads() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [inputNiche, setInputNiche] = useState('');
  const [inputContext, setInputContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [smartGoal, setSmartGoal] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);
  const navigate = useNavigate();

  async function startSmartSquad() {
    if (!smartGoal.trim()) return;
    setSmartLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-orchestrator', {
        body: { action: 'start', goal: smartGoal, context: { language: 'pt-BR' } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Squad inteligente iniciado! ${data.plan?.length || 0} passos planejados.`);
      setSmartGoal('');
      navigate('/admin/traces');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar squad inteligente');
    } finally {
      setSmartLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
    loadRuns();
  }, []);

  async function loadTemplates() {
    const { data } = await supabase.from('squad_templates').select('*').order('created_at');
    if (data) setTemplates(data);
  }

  async function loadRuns() {
    const { data } = await supabase.from('squad_runs').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) setRuns(data);
  }

  async function startSquad() {
    if (!selectedTemplate || !inputNiche.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('squad-orchestrator', {
        body: {
          action: 'start_run',
          template_id: selectedTemplate.id,
          input_params: {
            niche: inputNiche,
            context: inputContext,
            language: 'pt-BR',
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Squad iniciado! 🚀');
      setShowStartDialog(false);
      setActiveRun(data.run_id);
      loadRuns();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar squad');
    } finally {
      setLoading(false);
    }
  }

  if (activeRun) {
    return (
      <DashboardLayout>
        <SquadPipelineStepper
          runId={activeRun}
          onBack={() => { setActiveRun(null); loadRuns(); }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-syne text-foreground flex items-center gap-2">
            <Bot className="w-7 h-7 text-primary" /> AI Squads
          </h1>
          <p className="text-muted-foreground mt-1">
            Equipes de agentes IA que trabalham juntos em pipeline para criar conteúdo YouTube.
          </p>
        </div>

        {/* Smart Mode — Meta Orchestrator */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Modo Inteligente
                  <Badge variant="default" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />NEW</Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Descreva seu objetivo. Um meta-agente IA escolhe e executa os agentes necessários.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Ex: Pesquise tendências virais de finanças pessoais no Brasil esta semana e gere um roteiro de 8 minutos com hook forte e curva de retenção otimizada"
              value={smartGoal}
              onChange={(e) => setSmartGoal(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Acompanhe a execução em <button onClick={() => navigate('/admin/traces')} className="text-primary hover:underline">Observability</button>
              </p>
              <Button onClick={startSmartSquad} disabled={smartLoading || !smartGoal.trim()}>
                {smartLoading ? 'Planejando...' : <><Brain className="w-4 h-4 mr-2" />Iniciar Squad Inteligente</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Squad Templates */}
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((t) => {
            const Icon = SQUAD_ICONS[t.squad_type] || Bot;
            const agents = (t.agents as any[]) || [];
            const steps = (t.pipeline_steps as any[]) || [];
            return (
              <Card key={t.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                      {t.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{agents.length} agentes</Badge>
                        <Badge variant="outline" className="text-xs">{steps.length} etapas</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {agents.map((a: any, i: number) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {a.icon} {a.name}
                      </span>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => { setSelectedTemplate(t); setShowStartDialog(true); }}
                  >
                    <Play className="w-4 h-4 mr-2" /> Iniciar Squad
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Runs */}
        {runs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Execuções Recentes</h2>
            <div className="space-y-2">
              {runs.map((r) => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setActiveRun(r.id)}
                >
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{r.squad_name?.includes('Shorts') ? '⚡' : r.squad_name?.includes('Viral') ? '🔥' : '🎬'}</span>
                      <div>
                        <p className="text-sm font-medium">{r.squad_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(r.input_params as any)?.niche || 'Sem nicho'} • {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === 'completed' ? 'default' : r.status === 'paused' ? 'secondary' : 'outline'}>
                        {r.status === 'completed' ? '✅ Concluído' : r.status === 'paused' ? '⏸ Aguardando' : r.status === 'running' ? '🔄 Rodando' : r.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.current_step}/{r.total_steps}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Start Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.icon} {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nicho / Tema *</label>
              <Input
                placeholder="Ex: finanças pessoais, curiosidades, tecnologia..."
                value={inputNiche}
                onChange={(e) => setInputNiche(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contexto adicional (opcional)</label>
              <Textarea
                placeholder="Canal com 500 inscritos, foco em público jovem, estilo informal..."
                value={inputContext}
                onChange={(e) => setInputContext(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancelar</Button>
            <Button onClick={startSquad} disabled={loading || !inputNiche.trim()}>
              {loading ? 'Iniciando...' : '🚀 Iniciar Pipeline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
