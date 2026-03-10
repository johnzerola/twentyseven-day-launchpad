import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, ChevronRight, ArrowRight, Lightbulb, FileText, Mic, Wand2, Film, Scissors, Upload, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WorkflowStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  tips: string[];
  status: 'completed' | 'current' | 'locked';
}

const STEPS_TEMPLATE: Omit<WorkflowStep, 'status'>[] = [
  { id: 1, title: 'Descoberta de Nicho', description: 'Encontre nichos lucrativos e analise canais virais com DubSpy e Niche Explorer.', icon: Lightbulb, route: '/niches', tips: ['Use o DubSpy para encontrar canais emergentes', 'Verifique o RPM estimado no Niche Explorer', 'Procure nichos com score > 70'] },
  { id: 2, title: 'Roteirização', description: 'Gere roteiros cinematográficos com hooks virais do Viral Database.', icon: FileText, route: '/scripts', tips: ['Selecione hooks do Viral Database', 'Use estrutura de 3 atos para retenção', 'Adicione loops abertos a cada 2-3 minutos'] },
  { id: 3, title: 'Narração', description: 'Gere narração neural com vozes profissionais via ElevenLabs.', icon: Mic, route: '/narration', tips: ['Daniel é ideal para PT-BR', 'Brian funciona bem para storytelling EN', 'Ajuste velocidade para match com cenas'] },
  { id: 4, title: 'Prompt Engine', description: 'Gere prompts visuais otimizados para cada cena do roteiro.', icon: Wand2, route: '/studio', tips: ['Defina o personagem principal para consistência', 'Use referência visual quando possível', 'Ative modo Veo3 para melhor qualidade'] },
  { id: 5, title: 'Geração de Cenas', description: 'Execute prompts no Autoflow ou gere com Veo3 direto.', icon: Film, route: '/studio', tips: ['Exporte Autoflow JSON para execução em lote', 'Use Veo3 Fast para protótipos rápidos', 'Verifique consistência de personagens'] },
  { id: 6, title: 'Edição & Revisão', description: 'Revise os segmentos, ajuste timing e faça export final.', icon: Scissors, route: '/studio', tips: ['Use preview sequencial no Studio', 'Verifique sync áudio/vídeo', 'Baixe ZIP com todos os assets'] },
  { id: 7, title: 'Publicação', description: 'Configure título, thumbnail, tags SEO e agende o upload.', icon: Upload, route: '/titles', tips: ['Gere títulos com score de CTR > 80', 'Use SEO keywords do Viral Database', 'Agende para horário de pico do nicho'] },
];

function buildSteps(completedIds: number[]): WorkflowStep[] {
  return STEPS_TEMPLATE.map((s, i) => {
    const done = completedIds.includes(s.id);
    const prevDone = i === 0 || completedIds.includes(STEPS_TEMPLATE[i - 1].id);
    return { ...s, status: done ? 'completed' : prevDone ? 'current' : 'locked' } as WorkflowStep;
  });
}

const MODULE_KEY = 'workflow';

const Workflow = () => {
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  const steps = buildSteps(completedIds);
  const completedCount = completedIds.length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const current = steps[activeStep];

  // Load from DB
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_progress')
        .select('completed_items')
        .eq('user_id', user.id)
        .eq('module', MODULE_KEY)
        .maybeSingle();
      if (data?.completed_items) {
        setCompletedIds(data.completed_items as number[]);
      }
      setLoading(false);
    })();
  }, []);

  // Persist to DB
  const persist = useCallback(async (ids: number[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_progress')
      .upsert({ user_id: user.id, module: MODULE_KEY, completed_items: ids, updated_at: new Date().toISOString() }, { onConflict: 'user_id,module' });
    if (error) console.error('persist error:', error);
  }, []);

  const toggleComplete = (idx: number) => {
    const stepId = steps[idx].id;
    setCompletedIds(prev => {
      let next: number[];
      if (prev.includes(stepId)) {
        // Uncheck this and all after
        next = prev.filter(id => id < stepId);
      } else {
        next = [...prev, stepId].sort((a, b) => a - b);
      }
      persist(next);
      return next;
    });
    toast.success(completedIds.includes(steps[idx].id) ? 'Etapa desmarcada' : 'Etapa concluída!');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground">Production Workflow</h1>
            <p className="text-muted-foreground text-sm mt-1">Fluxo completo: da ideia à publicação em 7 etapas</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{completedCount}/{steps.length} etapas</span>
            <Progress value={progress} className="w-32 h-2" />
            <Badge variant="outline" className="text-primary border-primary/30">{progress}%</Badge>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {steps.map((step, i) => (
            <button key={step.id} onClick={() => setActiveStep(i)}
              className={`relative flex flex-col items-center p-2 rounded-lg transition-all ${activeStep === i ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-card'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                step.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                step.status === 'current' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {step.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className={`text-[10px] text-center leading-tight ${step.status === 'locked' ? 'text-muted-foreground/50' : 'text-foreground'}`}>{step.title}</span>
              {i < steps.length - 1 && <ChevronRight className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30 hidden md:block" />}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeStep} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${current.status === 'completed' ? 'bg-emerald-500/20' : 'bg-primary/20'}`}>
                  <current.icon className={`w-6 h-6 ${current.status === 'completed' ? 'text-emerald-400' : 'text-primary'}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Etapa {current.id}: {current.title}</h2>
                  <p className="text-sm text-muted-foreground">{current.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={current.status === 'completed' ? 'outline' : 'default'} onClick={() => toggleComplete(activeStep)}>
                  {current.status === 'completed' ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Concluída</> : <><Circle className="w-4 h-4 mr-1" /> Marcar concluída</>}
                </Button>
                <Link to={current.route}>
                  <Button size="sm" variant="secondary"><ExternalLink className="w-4 h-4 mr-1" /> Abrir módulo</Button>
                </Link>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" /> Dicas para esta etapa
              </h3>
              <ul className="space-y-1.5">
                {current.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ArrowRight className="w-3 h-3 mt-1 text-primary shrink-0" />{tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" disabled={activeStep === 0} onClick={() => setActiveStep(p => p - 1)}>← Anterior</Button>
              <Button variant="ghost" size="sm" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep(p => p + 1)}>Próxima →</Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default Workflow;
