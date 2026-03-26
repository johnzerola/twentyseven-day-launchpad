import { useState, useEffect } from 'react';
import { Rocket, TrendingUp, Zap, Trophy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';

export const YPPProximityAlert = () => {
  const [channelData, setChannelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_channels')
        .select('*')
        .eq('user_id', session.user.id)
        .order('linked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setChannelData(data);
      setLoading(false);
    })();
  }, []);

  if (loading || !channelData) return null;

  const subs = channelData.subscribers || 0;
  const subsTarget = 1000;
  const subsRemaining = Math.max(0, subsTarget - subs);
  const subsPct = Math.min(100, (subs / subsTarget) * 100);
  
  // Estimate watch hours from views (rough: 1 view ≈ 0.08 watch hours for longform)
  const estWatchHours = Math.round((channelData.views || 0) * 0.08);
  const watchTarget = 4000;
  const watchRemaining = Math.max(0, watchTarget - estWatchHours);
  const watchPct = Math.min(100, (estWatchHours / watchTarget) * 100);

  const canApply = subsRemaining === 0 && watchRemaining === 0;
  const subsClose = subsRemaining > 0 && subsRemaining <= 200;
  const watchClose = watchRemaining > 0 && watchRemaining <= 200;
  const turboMode = (subsClose || watchClose) && !canApply;

  if (subsPct < 10 && watchPct < 10) return null; // Too early to show

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border ${
        canApply ? 'bg-chart-2/10 border-chart-2/30' 
        : turboMode ? 'bg-chart-3/10 border-chart-3/30' 
        : 'bg-primary/5 border-primary/10'
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {canApply ? <Trophy className="w-5 h-5 text-chart-2" /> : turboMode ? <Zap className="w-5 h-5 text-chart-3" /> : <Rocket className="w-5 h-5 text-primary" />}
          <span className="text-sm font-bold">
            {canApply ? '🎉 Pronto para o YPP!' : turboMode ? '⚡ Modo Turbo Ativado!' : '🚀 Progresso YPP'}
          </span>
        </div>
        {turboMode && (
          <Badge className="bg-chart-3/20 text-chart-3 border-chart-3/30 text-[9px]">
            {subsRemaining > 0 ? `${subsRemaining} subs restantes` : `${watchRemaining}h restantes`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Inscritos</span>
            <span className="text-[10px] font-bold">{formatNumber(subs)} / {formatNumber(subsTarget)}</span>
          </div>
          <Progress value={subsPct} className="h-1.5" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Watch Time (est.)</span>
            <span className="text-[10px] font-bold">{formatNumber(estWatchHours)}h / {formatNumber(watchTarget)}h</span>
          </div>
          <Progress value={watchPct} className="h-1.5" />
        </div>
      </div>

      {canApply && (
        <a href="https://studio.youtube.com/channel/UC/monetization" target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="w-full gap-2 text-xs bg-chart-2 hover:bg-chart-2/90">
            <Trophy className="w-3 h-3" /> Candidatar ao YPP <ExternalLink className="w-3 h-3" />
          </Button>
        </a>
      )}

      {turboMode && (
        <p className="text-[10px] text-chart-3 mt-1">
          {subsClose ? '📢 Foco em Shorts virais + CTA de inscrição em cada vídeo.' : '🎬 Priorize vídeos longos de 10-15min para maximizar watch time.'}
        </p>
      )}
    </motion.div>
  );
};
