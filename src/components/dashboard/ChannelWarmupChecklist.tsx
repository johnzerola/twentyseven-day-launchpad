import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Flame, Shield, Clock, AlertTriangle, CheckCircle2, Eye, MessageSquare, ThumbsUp, UserPlus, Wifi, Monitor, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  day: number;
  critical: boolean;
}

const WARMUP_CHECKLIST: ChecklistItem[] = [
  // Day 0 - Setup
  { id: 'old-gmail', label: 'Usar conta ANTIGA (não criar nova)', description: 'Contas novas caem no "Zero View Jail". Use conta pessoal/infância com histórico de navegação. Conta aged = YouTube já confia.', icon: Shield, day: 0, critical: true },
  { id: 'proxy-setup', label: 'Configurar proxy/IP dedicado', description: 'Use proxy do país-alvo. Cada canal = IP diferente. Nunca acesse múltiplos canais no mesmo IP.', icon: Wifi, day: 0, critical: false },
  { id: 'channel-config', label: 'Configurar canal (foto, banner, about)', description: 'Canal sem foto de perfil = red flag. Preencha TUDO antes de postar. Nome memorável + identidade visual única (Pink Glasses Effect).', icon: Monitor, day: 0, critical: true },
  { id: 'tag-trinity', label: 'Configurar Tag Trinity (3 tipos)', description: '(1) Channel Tags em Settings > Channel > Keywords (máx 10); (2) Video Tags no upload; (3) Hashtags na descrição (máx 5, sem espaços). Ajuda YouTube classificar seu canal.', icon: Shield, day: 0, critical: true },
  { id: 'no-social-links', label: 'NÃO colocar links sociais na descrição', description: 'YouTube penaliza quem manda viewers para fora. Descrição = APENAS sobre o conteúdo do vídeo. Links sociais só após 10K+ subs.', icon: AlertTriangle, day: 0, critical: true },
  { id: 'separate-channels', label: 'Shorts e Long-Form em canais SEPARADOS', description: 'Misturar confunde o algoritmo sobre qual tipo de viewer buscar. Mantenha canais especializados para maximizar ads revenue.', icon: Monitor, day: 0, critical: true },
  // Day 1-2
  { id: 'research-account', label: 'Criar conta de PESQUISA separada', description: 'Conta que SÓ assiste conteúdo do seu nicho. Nunca posta/comenta. Após dias, o feed vira um curador de ideias virais comprovadas.', icon: Eye, day: 1, critical: true },
  { id: 'watch-30min-d1', label: 'Assistir 30min de vídeos do nicho', description: 'Na sua conta principal. O algoritmo precisa entender seus interesses antes de confiar no seu canal.', icon: Eye, day: 1, critical: true },
  { id: 'subscribe-2-3', label: 'Se inscrever em 2-3 canais do nicho', description: 'NÃO se inscreva em dezenas. 2-3 canais relevantes, como um usuário normal faria.', icon: UserPlus, day: 1, critical: true },
  { id: 'comment-1-2', label: 'Comentar em 1-2 vídeos (natural)', description: 'Comentários genéricos como "Great video!" são ruins. Escreva algo específico sobre o conteúdo.', icon: MessageSquare, day: 1, critical: false },
  // Day 3-4
  { id: 'watch-30min-d3', label: 'Mais 30min de vídeos variados', description: 'Misture: alguns do nicho, alguns aleatórios. Simule uso normal do YouTube.', icon: Eye, day: 3, critical: true },
  { id: 'like-2-3', label: 'Curtir 2-3 vídeos (não todos)', description: 'Curtir TODOS os vídeos = comportamento de bot. Seja seletivo.', icon: ThumbsUp, day: 3, critical: false },
  { id: 'comment-natural', label: 'Mais 1-2 comentários naturais', description: 'Varie o estilo e tamanho dos comentários. Nunca spame.', icon: MessageSquare, day: 3, critical: false },
  // Day 5-6
  { id: 'watch-mobile', label: 'Acessar YouTube pelo celular', description: 'YouTube rastreia dispositivos. Acesse pelo app mobile também para parecer usuário real.', icon: Smartphone, day: 5, critical: false },
  { id: 'watch-30min-d5', label: 'Mais sessão de 30min assistindo', description: 'Continue o padrão. Não force — use como usaria normalmente.', icon: Eye, day: 5, critical: true },
  { id: 'old-channel-prep', label: 'Preparar cross-promo no canal antigo', description: 'Se tem canal antigo: prepare um Community Post com screenshot QUADRADO do thumbnail + link do novo vídeo. Isso jumpstarta o algoritmo com viewers puros.', icon: Flame, day: 5, critical: false },
  // Day 7 - Launch
  { id: 'test-post-1', label: 'Postar 2 vídeos SIMULTANEAMENTE', description: 'No lançamento, poste 2 vídeos de uma vez. YouTube envia viewer do vídeo 1 para o vídeo 2 → classifica como fã → pushes para audiência similar. SÓ faça isso no lançamento!', icon: Flame, day: 7, critical: true },
  { id: 'test-post-2', label: 'Publicar Community Post no canal antigo', description: 'Poste thumbnail quadrado com link no canal antigo. Isso direciona viewers PUROS do nicho certo para o novo canal. É o segredo para jumpstart em <10 dias.', icon: Flame, day: 7, critical: true },
  { id: 'video-flow-check', label: 'Verificar "Flow" entre vídeos', description: 'Seus 2 vídeos se conectam? Viewer do vídeo 1 naturalmente quer assistir o 2? Se não, refaça. Pense como episódios de Netflix, não uploads aleatórios.', icon: Eye, day: 7, critical: true },
  { id: 'no-schedule-bulk', label: 'NÃO agendar vários vídeos', description: 'Máximo 2 vídeos agendados. Agendar 9-10+ = YouTube marca como bot. Deixe vídeos "respirarem" entre uploads (2-4/dia máx com espaçamento).', icon: AlertTriangle, day: 7, critical: true },
];

export const ChannelWarmupChecklist = () => {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [currentDay, setCurrentDay] = useState(0);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('warmup-checklist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompleted(new Set(parsed.completed || []));
        setCurrentDay(parsed.currentDay || 0);
      } catch {}
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('warmup-checklist', JSON.stringify({
      completed: Array.from(completed),
      currentDay,
    }));
  }, [completed, currentDay]);

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = WARMUP_CHECKLIST.length;
  const completedCount = completed.size;
  const progress = (completedCount / totalItems) * 100;

  const days = [0, 1, 3, 5, 7];
  const dayLabels: Record<number, string> = { 0: 'Setup Inicial', 1: 'Dia 1-2', 3: 'Dia 3-4', 5: 'Dia 5-6', 7: 'Dia 7 — Teste' };

  const isChannelReady = completed.has('test-post-1') && completed.has('test-post-2');

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Channel Warmup Protocol</h3>
            </div>
            <Badge className={isChannelReady ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-secondary text-muted-foreground border-border'}>
              {isChannelReady ? '🔥 Canal Aquecido' : `${completedCount}/${totalItems} tarefas`}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Siga este protocolo de 7 dias para evitar shadowban. Canais com Gmail novo + sem warmup têm 90% de chance de ser suprimidos pelo YouTube.
          </p>
        </CardContent>
      </Card>

      {/* Shadowban Warning */}
      {!completed.has('old-gmail') && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">⚠️ Alerta de Shadowban</p>
              <p className="text-xs text-muted-foreground mt-1">
                Se você criar um Gmail novo + canal novo e postar direto, seus vídeos vão pegar 0-1 views. O YouTube mostra 11 impressões, quase todas de busca — zero browse/homepage. Isso é shadowban.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Days */}
      {days.map(day => {
        const items = WARMUP_CHECKLIST.filter(i => i.day === day);
        const dayCompleted = items.every(i => completed.has(i.id));

        return (
          <motion.div key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: day * 0.05 }}>
            <Card className={`border-border bg-card ${dayCompleted ? 'border-green-500/20' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  {dayLabels[day]}
                  {dayCompleted && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      completed.has(item.id)
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-secondary/30 border-border hover:border-primary/30'
                    }`}
                    onClick={() => toggle(item.id)}
                  >
                    <Checkbox
                      checked={completed.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className={`text-sm font-medium ${completed.has(item.id) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                          {item.label}
                        </span>
                        {item.critical && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 px-1 py-0">
                            CRÍTICO
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Reset */}
      <Button
        variant="outline"
        className="w-full border-border text-muted-foreground"
        onClick={() => { setCompleted(new Set()); setCurrentDay(0); }}
      >
        Resetar Checklist (novo canal)
      </Button>
    </div>
  );
};
