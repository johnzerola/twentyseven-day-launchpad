import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarDays, CheckCircle2, Circle, Search, Zap, TrendingUp, Upload, BarChart3, Sparkles, Target, Eye, MessageSquare, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface PlaybookDay {
  day: number;
  phase: string;
  phaseColor: string;
  focus: string;
  actions: string[];
  guidelines: string;
  icon: React.ReactNode;
}

const PLAYBOOK_DAYS: PlaybookDay[] = [
  // Phase 1: Foundation & Data (Days 0-3)
  { day: 0, phase: 'Fundação', phaseColor: 'bg-blue-500/20 text-blue-400', focus: 'Setup do Canal', actions: ['Configurar canal YouTube (nome, banner, foto)', 'Definir nicho principal e sub-nichos', 'Criar branding via IA (Logo/Banner)'], guidelines: 'Thumbnails: 1 sujeito, emoção clara, cores contrastantes (Laranja/Azul). Sem poluição visual.', icon: <Sparkles className="w-4 h-4" /> },
  { day: 1, phase: 'Fundação', phaseColor: 'bg-blue-500/20 text-blue-400', focus: 'Pesquisa de Outliers', actions: ['Rodar Outlier Finder para seu nicho', 'Identificar 10 vídeos virais de canais < 50k subs', 'Anotar padrões: títulos, thumbs, duração'], guidelines: 'Foque em canais com multiplier > 5x. Esses são os modelos a seguir.', icon: <Search className="w-4 h-4" /> },
  { day: 2, phase: 'Fundação', phaseColor: 'bg-blue-500/20 text-blue-400', focus: 'Validação de Tópicos', actions: ['Escolher 3 tópicos validados dos outliers', 'Verificar volume de busca (Google Trends)', 'Criar títulos com Curiosity Gap'], guidelines: 'Títulos: "A verdade oculta sobre..." > "A história de..."', icon: <Target className="w-4 h-4" /> },
  { day: 3, phase: 'Fundação', phaseColor: 'bg-blue-500/20 text-blue-400', focus: 'Setup Técnico', actions: ['Configurar pipeline de produção', 'Testar geração de roteiro + áudio', 'Preparar templates de thumbnail'], guidelines: 'Automatize tudo que puder. Cada minuto economizado = mais conteúdo.', icon: <Zap className="w-4 h-4" /> },
  
  // Phase 2: Batch Creation (Days 4-7)
  { day: 4, phase: 'Produção em Lote', phaseColor: 'bg-purple-500/20 text-purple-400', focus: 'Roteiro #1 (Long-form)', actions: ['Gerar roteiro 10-15 min com template escolhido', 'Revisar hook (5s), cliffhangers, pattern interrupts', 'Extrair 2 ganchos para Shorts'], guidelines: 'Hook: apresente o fim trágico ou feito impossível nos primeiros 5 segundos.', icon: <Sparkles className="w-4 h-4" /> },
  { day: 5, phase: 'Produção em Lote', phaseColor: 'bg-purple-500/20 text-purple-400', focus: 'Roteiros #2 e #3', actions: ['Gerar 2 roteiros longos adicionais', 'Criar 4 Shorts extraídos dos ganchos', 'Gerar todos os áudios (TTS)'], guidelines: 'Shorts são BRIDGES: sempre linkam para o vídeo longo completo.', icon: <Sparkles className="w-4 h-4" /> },
  { day: 6, phase: 'Produção em Lote', phaseColor: 'bg-purple-500/20 text-purple-400', focus: 'Visual & Edição', actions: ['Gerar prompts visuais para cada cena', 'Criar thumbnails A/B para cada vídeo', 'Preparar sound design e música'], guidelines: 'Ken Burns em imagens estáticas + sound design pesado = retenção alta com custo zero.', icon: <Eye className="w-4 h-4" /> },
  { day: 7, phase: 'Produção em Lote', phaseColor: 'bg-purple-500/20 text-purple-400', focus: 'Finalização do Lote 1', actions: ['Revisar todos os vídeos finalizados', 'Preparar descrições SEO otimizadas', 'Agendar publicações'], guidelines: 'SEO: palavras-chave long-tail nos primeiros 40 caracteres do título e descrição.', icon: <CheckCircle2 className="w-4 h-4" /> },
  
  // Phase 3: Launch (Days 8-14)
  { day: 8, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: '🚀 Vídeo #1 Live!', actions: ['Publicar Vídeo 1', 'Publicar 1 Short linkando para Vídeo 1', 'Responder TODOS os comentários na 1ª hora'], guidelines: 'Bridge Strategy: cada Short deve ter CTA "Vídeo completo no canal".', icon: <Upload className="w-4 h-4" /> },
  { day: 9, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: 'Shorts Diários', actions: ['Publicar Short #2', 'Cross-post no TikTok e Instagram Reels', 'Monitorar métricas do Vídeo 1'], guidelines: 'Poste Shorts em horários diferentes para descobrir o melhor.', icon: <TrendingUp className="w-4 h-4" /> },
  { day: 10, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: 'Engajamento', actions: ['Publicar Short #3', 'Criar post na Comunidade (enquete)', 'Analisar retenção do Vídeo 1'], guidelines: 'Se retenção cai antes de 30s, o hook precisa ser refeito.', icon: <MessageSquare className="w-4 h-4" /> },
  { day: 11, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: 'Otimização', actions: ['Publicar Short #4', 'Ajustar thumb se CTR < 4%', 'Preparar Vídeo 2 para publicação'], guidelines: 'CTR mínimo: 4%. Se não atingir, troque a thumbnail IMEDIATAMENTE.', icon: <RefreshCw className="w-4 h-4" /> },
  { day: 12, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: '🚀 Vídeo #2 Live!', actions: ['Publicar Vídeo 2', 'Publicar Short linkando para Vídeo 2', 'Fixar comentário com link para Vídeo 1'], guidelines: 'Fixar comentário com link = criar sessão de visualização entre vídeos.', icon: <Upload className="w-4 h-4" /> },
  { day: 13, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: 'Cross-Platform', actions: ['Publicar Short #5 e #6', 'Cross-post compilação no TikTok', 'Responder comentários e criar comunidade'], guidelines: 'Telas finais devem apontar para o vídeo mais forte (maior AVD).', icon: <TrendingUp className="w-4 h-4" /> },
  { day: 14, phase: 'Lançamento', phaseColor: 'bg-green-500/20 text-green-400', focus: 'Revisão Semanal', actions: ['Analisar métricas da Semana 2', 'Identificar vídeo vencedor (maior AVD)', 'Preparar estratégia da Semana 3'], guidelines: 'O vídeo com maior AVD define o formato dos próximos. Dobre nele.', icon: <BarChart3 className="w-4 h-4" /> },
  
  // Phase 4: Distribution (Days 15-21)
  { day: 15, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: 'Produção Lote 2', actions: ['Gerar 2 roteiros baseados no vídeo vencedor', 'Mesmo formato/estilo que funcionou', 'Criar Shorts direcionados'], guidelines: 'Modelar o sucesso: use o mesmo template, estrutura e tom do vídeo vencedor.', icon: <Sparkles className="w-4 h-4" /> },
  { day: 16, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: '🚀 Vídeo #3 Live!', actions: ['Publicar Vídeo 3', 'Shorts diários continuam', 'CTA aos 60-70%: pergunta específica'], guidelines: 'CTA: "Qual dessas 3 táticas você achou pior? Comente." - gera engajamento.', icon: <Upload className="w-4 h-4" /> },
  { day: 17, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: 'Comunidade', actions: ['Post comunidade: enquete sobre próximo tema', 'Responder todos os comentários', 'Identificar "superfãs" e interagir'], guidelines: 'Posts na comunidade = sinal de engajamento para o algoritmo.', icon: <MessageSquare className="w-4 h-4" /> },
  { day: 18, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: 'Otimização SEO', actions: ['Revisar títulos e descrições de todos os vídeos', 'Atualizar tags com termos trending', 'Criar playlists temáticas'], guidelines: 'Playlists temáticas aumentam session time e sinalizam consistência.', icon: <Search className="w-4 h-4" /> },
  { day: 19, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: 'Shorts Bridge Intensivo', actions: ['Publicar 3 Shorts no mesmo dia', 'Cada Short é um teaser de vídeo diferente', 'Testar formato vertical vs horizontal'], guidelines: 'Shorts com ganchos dos vídeos longos = funil de audiência natural.', icon: <TrendingUp className="w-4 h-4" /> },
  { day: 20, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: '🚀 Vídeo #4 Live!', actions: ['Publicar Vídeo 4', 'Fixar comentário com link para playlist', 'Analisar padrão de crescimento'], guidelines: 'Se o canal cresceu > 100 subs em 12 dias, você encontrou o formato.', icon: <Upload className="w-4 h-4" /> },
  { day: 21, phase: 'Distribuição', phaseColor: 'bg-orange-500/20 text-orange-400', focus: 'Revisão Semanal 3', actions: ['Análise completa: CTR, AVD, impressões', 'Comparar performance entre vídeos', 'Definir "formato matador" do canal'], guidelines: 'Padrão: os melhores vídeos definem o futuro. Mate os formatos fracos.', icon: <BarChart3 className="w-4 h-4" /> },
  
  // Phase 5: A/B & Scale (Days 22-27)
  { day: 22, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: 'A/B Testing Thumbs', actions: ['Criar 3 variações de thumb para cada vídeo', 'Trocar thumbs de vídeos com CTR < 4%', 'Documentar resultados'], guidelines: 'Thumb ideal: 1 rosto/sujeito + emoção extrema + texto mínimo (3 palavras max).', icon: <Eye className="w-4 h-4" /> },
  { day: 23, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: 'Análise de Retenção', actions: ['Revisar gráficos de retenção de todos os vídeos', 'Identificar pontos de queda', 'Criar banco de "hooks que funcionam"'], guidelines: 'Retenção > 50% nos primeiros 30s = vídeo saudável. Abaixo = refazer hook.', icon: <BarChart3 className="w-4 h-4" /> },
  { day: 24, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: 'Produção Lote 3', actions: ['Gerar 3 roteiros novos (formato vencedor)', 'Escalar para 4 vídeos/semana se possível', 'Criar backlog de 10 tópicos validados'], guidelines: 'Consistência > qualidade perfeita. 3 vídeos bons > 1 vídeo perfeito.', icon: <Sparkles className="w-4 h-4" /> },
  { day: 25, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: 'Monetização Prep', actions: ['Verificar requisitos de monetização (1k subs, 4k horas)', 'Preparar conteúdo de afiliados/patrocínios', 'Criar media kit básico'], guidelines: 'Não espere o YPP. Comece com afiliados e links na descrição desde o dia 1.', icon: <Target className="w-4 h-4" /> },
  { day: 26, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: 'Automação Total', actions: ['Automatizar pipeline: roteiro → áudio → visual', 'Criar SOPs para cada etapa', 'Configurar batch scheduling semanal'], guidelines: 'Objetivo: 1 vídeo completo em < 2 horas de trabalho humano.', icon: <Zap className="w-4 h-4" /> },
  { day: 27, phase: 'Escala', phaseColor: 'bg-red-500/20 text-red-400', focus: '🏆 Review Final & Escala', actions: ['Análise completa dos 27 dias', 'Documentar o que funcionou vs falhou', 'Criar plano de escala: 2º canal ou dobrar frequência'], guidelines: 'Se atingiu > 500 subs: escale o formato. Se não: pivote o nicho mantendo o que aprendeu.', icon: <TrendingUp className="w-4 h-4" /> },
];

const Playbook = () => {
  const navigate = useNavigate();
  const [completedDays, setCompletedDays] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('playbook_progress').select('*').eq('user_id', user.id) as any;
      if (data) {
        const completed: Record<number, boolean> = {};
        const notesMap: Record<number, string> = {};
        for (const row of data) {
          completed[row.day_number] = row.completed;
          if (row.notes) notesMap[row.day_number] = row.notes;
        }
        setCompletedDays(completed);
        setNotes(notesMap);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const toggleDay = async (day: number) => {
    const newVal = !completedDays[day];
    setCompletedDays(prev => ({ ...prev, [day]: newVal }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase.from('playbook_progress') as any).upsert({
        user_id: user.id,
        day_number: day,
        completed: newVal,
        completed_at: newVal ? new Date().toISOString() : null,
        notes: notes[day] || null,
      }, { onConflict: 'user_id,day_number' });
    } catch (e) { console.error(e); }
  };

  const saveNote = async (day: number, note: string) => {
    setNotes(prev => ({ ...prev, [day]: note }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase.from('playbook_progress') as any).upsert({
        user_id: user.id,
        day_number: day,
        completed: completedDays[day] || false,
        notes: note || null,
      }, { onConflict: 'user_id,day_number' });
    } catch (e) { console.error(e); }
  };

  const totalCompleted = Object.values(completedDays).filter(Boolean).length;
  const progress = (totalCompleted / 28) * 100;

  const phases = [
    { name: 'Fundação', days: '0-3', color: 'text-blue-400' },
    { name: 'Produção', days: '4-7', color: 'text-purple-400' },
    { name: 'Lançamento', days: '8-14', color: 'text-green-400' },
    { name: 'Distribuição', days: '15-21', color: 'text-orange-400' },
    { name: 'Escala', days: '22-27', color: 'text-red-400' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center glow-primary">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Playbook 27 Dias</h1>
              <p className="text-sm text-muted-foreground">Monetização Acelerada — HVM Strategy</p>
            </div>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-1">
            {totalCompleted}/28 dias
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Progresso Geral</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between mt-4 gap-2">
            {phases.map(p => (
              <div key={p.name} className="text-center">
                <p className={`text-xs font-semibold ${p.color}`}>{p.name}</p>
                <p className="text-[10px] text-muted-foreground">Dias {p.days}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Day Cards */}
        <div className="space-y-3">
          {PLAYBOOK_DAYS.map((day) => {
            const isCompleted = completedDays[day.day];
            const isExpanded = expandedDay === day.day;

            return (
              <motion.div
                key={day.day}
                layout
                className={`glass rounded-xl border transition-all ${isCompleted ? 'border-primary/30 bg-primary/5' : 'border-border/30'}`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDay(day.day); }}
                    className="flex-shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </button>
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    {day.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">Dia {day.day}</span>
                      <Badge className={`text-[10px] ${day.phaseColor} border-0`}>{day.phase}</Badge>
                    </div>
                    <p className={`text-sm ${isCompleted ? 'text-muted-foreground line-through' : ''}`}>{day.focus}</p>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 ml-14">
                        {/* Actions */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">AÇÕES:</p>
                          <ul className="space-y-1.5">
                            {day.actions.map((action, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary/60 flex-shrink-0" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Guidelines */}
                        <div className="bg-secondary/50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">💡 GUIDELINE:</p>
                          <p className="text-sm text-foreground/80">{day.guidelines}</p>
                        </div>

                        {/* Notes */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">📝 Suas Notas:</p>
                          <Textarea
                            value={notes[day.day] || ''}
                            onChange={(e) => setNotes(prev => ({ ...prev, [day.day]: e.target.value }))}
                            onBlur={() => saveNote(day.day, notes[day.day] || '')}
                            placeholder="Anote seus aprendizados, métricas ou ideias..."
                            className="bg-secondary/30 text-sm min-h-[60px]"
                          />
                        </div>

                        {/* Quick Actions */}
                        {day.day === 1 && (
                          <Button onClick={() => navigate('/viral-db')} variant="outline" size="sm" className="gap-2">
                            <Search className="w-3 h-3" /> Abrir Outlier Finder
                          </Button>
                        )}
                        {[4, 5, 15, 24].includes(day.day) && (
                          <Button onClick={() => navigate('/scripts')} variant="outline" size="sm" className="gap-2">
                            <Sparkles className="w-3 h-3" /> Gerar Roteiro
                          </Button>
                        )}
                        {day.day === 0 && (
                          <Button onClick={() => navigate('/branding')} variant="outline" size="sm" className="gap-2">
                            <Sparkles className="w-3 h-3" /> Criar Branding
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Playbook;
