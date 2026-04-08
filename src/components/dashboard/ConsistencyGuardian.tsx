import { useState, useEffect } from 'react';
import { AlertTriangle, Flame, Zap, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type AlertLevel = 'OK' | 'CONSISTENCY_BREAK' | 'MOMENTUM_LOST';

interface GuardianData {
  level: AlertLevel;
  daysSinceLastScript: number;
  trendingTopic?: string;
  trendingNiche?: string;
  userNiche?: string;
}

export function ConsistencyGuardian() {
  const [data, setData] = useState<GuardianData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkConsistency();
  }, []);

  const checkConsistency = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user has an active plan
      const { data: plans } = await supabase
        .from('monetization_30day_plans' as any)
        .select('niche, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1);

      const activePlan = (plans as any)?.[0];

      // Get last script date
      const { data: lastScript } = await supabase
        .from('saved_scripts')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastScript) return;

      const daysSince = Math.floor(
        (Date.now() - new Date(lastScript.created_at).getTime()) / 86400000
      );

      if (daysSince <= 2) return; // OK

      // Get trending topic from emerging_videos
      const userNiche = activePlan?.niche || '';
      const { data: trending } = await supabase
        .from('emerging_videos')
        .select('title, niche')
        .order('velocity_score', { ascending: false })
        .limit(5);

      const matchedTrending = (trending || []).find((v: any) =>
        userNiche && v.niche?.toLowerCase().includes(userNiche.toLowerCase())
      ) || (trending || [])[0];

      const level: AlertLevel = daysSince > 5 ? 'MOMENTUM_LOST' : 'CONSISTENCY_BREAK';

      setData({
        level,
        daysSinceLastScript: daysSince,
        trendingTopic: matchedTrending?.title,
        trendingNiche: matchedTrending?.niche || userNiche,
        userNiche,
      });
    } catch (e) {
      console.error('ConsistencyGuardian error:', e);
    }
  };

  if (!data || data.level === 'OK' || dismissed) return null;

  const isCritical = data.level === 'MOMENTUM_LOST';

  const handleGenerate = () => {
    const params = new URLSearchParams();
    if (data.trendingTopic) params.set('topic', data.trendingTopic);
    if (data.userNiche) params.set('niche', data.userNiche);
    navigate(`/scripts?${params.toString()}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative rounded-xl p-4 sm:p-5 ${
          isCritical
            ? 'bg-destructive/10 border-2 border-destructive/40'
            : 'bg-accent/10 border border-accent/30'
        }`}
      >
        <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCritical ? 'bg-destructive/20' : 'bg-accent/20'
          }`}>
            {isCritical ? <AlertTriangle className="w-5 h-5 text-destructive" /> : <Flame className="w-5 h-5 text-accent" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold">
                {isCritical ? '⚠️ Momentum Perdido' : '🔥 Quebrando Consistência'}
              </h3>
              <Badge variant="outline" className={`text-[9px] ${isCritical ? 'border-destructive/30 text-destructive' : 'border-accent/30 text-accent'}`}>
                {data.daysSinceLastScript} dias sem criar
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {isCritical
                ? `${data.daysSinceLastScript} dias sem conteúdo. O algoritmo começa a "esquecer" seu canal depois de 7 dias. Você está a ${7 - data.daysSinceLastScript > 0 ? 7 - data.daysSinceLastScript : 0} dias de perder o momentum que construiu.`
                : `Você não cria desde ${data.daysSinceLastScript} dias atrás. Seu canal estava com momentum.${data.trendingTopic ? ` O vídeo "${data.trendingTopic}" está explodindo no seu nicho agora.` : ''}`
              }
            </p>

            <Button size="sm" onClick={handleGenerate} className="gap-2 text-xs">
              <Zap className="w-3.5 h-3.5" />
              Gerar roteiro em 30 segundos
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
