import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Rocket, ArrowRight, RefreshCw, Zap, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface NextAction {
  action: string;
  format: string;
  title_suggestion: string;
  thumb_direction: string;
  hook_strategy: string;
  why: string;
  risk: string;
  expected_views: string;
  monetization_impact: string;
  urgency: string;
  confidence: number;
  sources: string[];
}

export function NextBestActionWidget() {
  const [action, setAction] = useState<NextAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('next-best-action', {
        body: {},
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setAction(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar recomendação');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAction();
  }, []);

  const urgencyLabel: Record<string, { text: string; color: string }> = {
    now: { text: '⚡ AGORA', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    today: { text: '📅 HOJE', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    this_week: { text: '📆 ESTA SEMANA', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    when_ready: { text: '⏳ Quando pronto', color: 'bg-muted text-muted-foreground border-border' },
  };

  const riskIcon: Record<string, JSX.Element> = {
    low: <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">Risco baixo</Badge>,
    medium: <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">Risco médio</Badge>,
    high: <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Risco alto</Badge>,
  };

  if (loading) {
    return (
      <Card className="p-4 space-y-3 bg-card/80 backdrop-blur border-primary/20">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary animate-pulse" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-card/80 backdrop-blur border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchAction}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    );
  }

  if (!action) return null;

  const urgency = urgencyLabel[action.urgency] || urgencyLabel.when_ready;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4 space-y-3 bg-gradient-to-br from-primary/5 to-card border-primary/20 relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground text-sm">Sua Próxima Melhor Jogada</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${urgency.color}`}>{urgency.text}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchAction}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="relative space-y-2">
          <p className="text-sm font-medium text-foreground leading-snug">{action.action}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{action.why}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <span className="text-muted-foreground">📝 Título sugerido</span>
            <p className="font-medium text-foreground">{action.title_suggestion}</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">🎨 Thumbnail</span>
            <p className="font-medium text-foreground">{action.thumb_direction}</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">🎣 Hook</span>
            <p className="font-medium text-foreground">{action.hook_strategy}</p>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">📊 Views esperadas</span>
            <p className="font-medium text-foreground">{action.expected_views}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            {riskIcon[action.risk] || riskIcon.medium}
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              {action.format === 'short' ? 'Short' : 'Longform'}
            </Badge>
            <span className="text-xs text-muted-foreground">Confiança: {action.confidence}%</span>
          </div>
          <Button size="sm" className="gap-1" onClick={() => {
            sessionStorage.setItem('nba_topic', action.title_suggestion);
            sessionStorage.setItem('nba_hook', action.hook_strategy);
            navigate('/scripts');
            toast.success('Tema carregado! Comece a produzir.');
          }}>
            <Zap className="w-3.5 h-3.5" /> Produzir
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {action.monetization_impact && (
          <div className="text-xs text-primary/80 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {action.monetization_impact}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
