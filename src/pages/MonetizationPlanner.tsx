import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Target, Calendar, CheckCircle2, Circle, Zap, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Milestone {
  id: string;
  day: number;
  title: string;
  description: string;
  kpi: string;
  done: boolean;
}

const PLANS: Record<string, { label: string; milestones: Milestone[]; revenueEstimate: string }> = {
  '30': {
    label: '30 Dias',
    revenueEstimate: '$0 - $50',
    milestones: [
      { id: 'm1', day: 1, title: 'Escolher nicho', description: 'Validar nicho com RPM > $8 e baixa saturação.', kpi: 'Nicho definido', done: false },
      { id: 'm2', day: 3, title: 'Criar canal', description: 'Nome, arte, descrição SEO, links.', kpi: 'Canal configurado', done: false },
      { id: 'm3', day: 5, title: 'Primeiro roteiro', description: 'Script de 10min com hooks de retenção.', kpi: '1 roteiro pronto', done: false },
      { id: 'm4', day: 8, title: 'Primeiro vídeo', description: 'Produzir e publicar primeiro vídeo.', kpi: '1 vídeo publicado', done: false },
      { id: 'm5', day: 12, title: '3 vídeos publicados', description: 'Manter cadência de 1 vídeo a cada 3-4 dias.', kpi: '3 vídeos', done: false },
      { id: 'm6', day: 18, title: 'Analisar métricas', description: 'Verificar retenção, CTR e impressões.', kpi: 'CTR > 4%', done: false },
      { id: 'm7', day: 25, title: '7 vídeos publicados', description: 'Catálogo inicial para o algoritmo indexar.', kpi: '7 vídeos', done: false },
      { id: 'm8', day: 30, title: 'Infoproduto', description: 'Criar guia/template de baixo custo para vender via link.', kpi: 'Primeira venda', done: false },
    ],
  },
  '60': {
    label: '60 Dias',
    revenueEstimate: '$50 - $300',
    milestones: [
      { id: 'm9', day: 35, title: '12 vídeos', description: 'Atingir massa crítica de conteúdo.', kpi: '12 vídeos', done: false },
      { id: 'm10', day: 40, title: '500 inscritos', description: 'Primeiro milestone de comunidade.', kpi: '500 subs', done: false },
      { id: 'm11', day: 45, title: 'Primeiro vídeo viral', description: 'Pelo menos 1 vídeo com 10x a média de views.', kpi: '1 outlier', done: false },
      { id: 'm12', day: 50, title: 'Afiliados ativos', description: 'Integrar links de afiliados nas descrições.', kpi: '3+ links ativos', done: false },
      { id: 'm13', day: 55, title: 'Shorts strategy', description: 'Publicar 5 Shorts derivados dos long-form.', kpi: '5 shorts', done: false },
      { id: 'm14', day: 60, title: '1.000 inscritos', description: 'Primeiro requisito para monetização YouTube.', kpi: '1K subs', done: false },
    ],
  },
  '90': {
    label: '90 Dias',
    revenueEstimate: '$300 - $2.000',
    milestones: [
      { id: 'm15', day: 65, title: '25 vídeos', description: 'Catálogo robusto com long-form + shorts.', kpi: '25 vídeos', done: false },
      { id: 'm16', day: 70, title: '4.000h watch time', description: 'Segundo requisito para monetização.', kpi: '4K horas', done: false },
      { id: 'm17', day: 75, title: 'Monetização aprovada', description: 'AdSense ativado no canal.', kpi: 'Partner Program', done: false },
      { id: 'm18', day: 80, title: 'Primeiro patrocínio', description: 'Negociar deal com marca relevante ao nicho.', kpi: '$100+ deal', done: false },
      { id: 'm19', day: 85, title: 'Segundo canal', description: 'Replicar o processo em nicho complementar.', kpi: '2º canal criado', done: false },
      { id: 'm20', day: 90, title: 'Revenue diversificado', description: 'AdSense + Afiliados + Infoproduto + Patrocínio.', kpi: '4 fontes de renda', done: false },
    ],
  },
};

const REVENUE_CHART = [
  { day: 0, revenue: 0 },
  { day: 15, revenue: 0 },
  { day: 30, revenue: 25 },
  { day: 45, revenue: 80 },
  { day: 60, revenue: 200 },
  { day: 75, revenue: 500 },
  { day: 90, revenue: 1200 },
];

const MonetizationPlanner = () => {
  const [plans, setPlans] = useState(PLANS);
  const [activePlan, setActivePlan] = useState('30');
  const [generating, setGenerating] = useState(false);

  const currentPlan = plans[activePlan];
  const completedCount = currentPlan.milestones.filter(m => m.done).length;
  const totalCount = currentPlan.milestones.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  const toggleMilestone = (id: string) => {
    setPlans(prev => ({
      ...prev,
      [activePlan]: {
        ...prev[activePlan],
        milestones: prev[activePlan].milestones.map(m =>
          m.id === id ? { ...m, done: !m.done } : m
        ),
      },
    }));
  };

  const generateAIPlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: { niche: 'general', duration: parseInt(activePlan) },
      });
      if (error) throw error;
      toast.success('Plano AI gerado! Confira as milestones atualizadas.');
    } catch (e) {
      toast.error('Erro ao gerar plano AI');
    } finally {
      setGenerating(false);
    }
  };

  // Simple SVG revenue curve
  const maxRev = Math.max(...REVENUE_CHART.map(d => d.revenue));
  const svgW = 600;
  const svgH = 120;
  const points = REVENUE_CHART.map((d, i) => {
    const x = (d.day / 90) * svgW;
    const y = svgH - (d.revenue / (maxRev || 1)) * (svgH - 10);
    return `${x},${y}`;
  }).join(' ');

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] text-foreground flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-accent" /> Monetization Planner
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Plano de crescimento e monetização com milestones acionáveis</p>
          </div>
          <Button onClick={generateAIPlan} disabled={generating} size="sm" variant="secondary">
            <Zap className="w-4 h-4 mr-1" />
            {generating ? 'Gerando...' : 'Gerar plano com AI'}
          </Button>
        </div>

        {/* Revenue projection */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Projeção de Receita (90 dias)
            </h3>
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
              Est. $1.200/mês
            </Badge>
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-28">
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${svgH} ${points} ${svgW},${svgH}`}
              fill="url(#revGrad)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            {REVENUE_CHART.map((d, i) => {
              const x = (d.day / 90) * svgW;
              const y = svgH - (d.revenue / (maxRev || 1)) * (svgH - 10);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="3" fill="hsl(var(--primary))" />
                  {d.revenue > 0 && (
                    <text x={x} y={y - 8} textAnchor="middle" className="text-[9px] fill-muted-foreground">
                      ${d.revenue}
                    </text>
                  )}
                </g>
              );
            })}
            {/* X axis labels */}
            {[0, 30, 60, 90].map(d => (
              <text key={d} x={(d / 90) * svgW} y={svgH + 12} textAnchor="middle" className="text-[9px] fill-muted-foreground">
                Dia {d}
              </text>
            ))}
          </svg>
        </div>

        {/* Plan tabs */}
        <Tabs value={activePlan} onValueChange={setActivePlan}>
          <div className="flex items-center justify-between">
            <TabsList>
              {Object.entries(plans).map(([key, plan]) => (
                <TabsTrigger key={key} value={key}>{plan.label}</TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{completedCount}/{totalCount}</span>
              <Progress value={progress} className="w-24 h-2" />
              <Badge className="bg-accent/20 text-accent border-accent/30">{currentPlan.revenueEstimate}</Badge>
            </div>
          </div>

          {Object.entries(plans).map(([key, plan]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <div className="space-y-2">
                {plan.milestones.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      m.done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border hover:border-primary/30'
                    }`}
                    onClick={() => toggleMilestone(m.id)}
                  >
                    {m.done ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${m.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {m.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Dia {m.day}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      <Target className="w-3 h-3 mr-1" />{m.kpi}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MonetizationPlanner;
