import { useState, useEffect } from 'react';
import { Check, Lock, DollarSign, Handshake, Youtube, Crown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type LevelStatus = 'locked' | 'in_progress' | 'unlocked';

interface Level {
  id: number;
  name: string;
  subtitle: string;
  icon: any;
  requirement: string;
  revenue: string;
  status: LevelStatus;
}

export function MonetizationTrack() {
  const [levels, setLevels] = useState<Level[]>([
    { id: 1, name: 'Primeira Receita', subtitle: 'Dias 1-14', icon: DollarSign, requirement: 'Link de afiliado ativo', revenue: 'R$10-200', status: 'locked' },
    { id: 2, name: 'Micro Sponsorship', subtitle: 'Dias 14-21', icon: Handshake, requirement: 'Media Kit + primeiro contato', revenue: 'R$50-300', status: 'locked' },
    { id: 3, name: 'YPP Early Tier', subtitle: 'Dias 20-30', icon: Youtube, requirement: '500 subs + 3K horas', revenue: 'Super Thanks + Shopping', status: 'locked' },
    { id: 4, name: 'YPP Full', subtitle: 'Dia 30+', icon: Crown, requirement: '1K subs + 4K horas', revenue: 'AdSense completo', status: 'locked' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkProgress();
  }, []);

  const checkProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [channelRes, scriptsRes, planRes] = await Promise.all([
        supabase.from('user_channels').select('subscribers, views').eq('user_id', user.id).order('linked_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('saved_scripts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('monetization_30day_plans' as any).select('started_at, plan_json, status').eq('user_id', user.id).eq('status', 'active').limit(1),
      ]);

      const subs = (channelRes.data as any)?.subscribers || 0;
      const hasScripts = (scriptsRes.count || 0) > 0;
      const plan = (planRes.data as any)?.[0];
      const daysSincePlan = plan ? Math.ceil((Date.now() - new Date(plan.started_at).getTime()) / 86400000) : 0;

      setLevels(prev => prev.map(level => {
        let status: LevelStatus = 'locked';
        switch (level.id) {
          case 1:
            status = hasScripts && daysSincePlan >= 1 ? (daysSincePlan >= 3 ? 'unlocked' : 'in_progress') : (hasScripts ? 'in_progress' : 'locked');
            break;
          case 2:
            status = daysSincePlan >= 21 ? 'unlocked' : daysSincePlan >= 14 ? 'in_progress' : 'locked';
            break;
          case 3:
            status = subs >= 500 ? 'unlocked' : subs >= 200 ? 'in_progress' : 'locked';
            break;
          case 4:
            status = subs >= 1000 ? 'unlocked' : subs >= 500 ? 'in_progress' : 'locked';
            break;
        }
        return { ...level, status };
      }));
    } catch (e) {
      console.error('MonetizationTrack error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const unlockedCount = levels.filter(l => l.status === 'unlocked').length;
  const progressPercent = (unlockedCount / levels.length) * 100;

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-chart-2" /> Trilha de Monetização
          </h3>
          <p className="text-[10px] text-muted-foreground">4 níveis — comece a ganhar desde o dia 1</p>
        </div>
        <Badge className="text-[9px] bg-chart-2/20 text-chart-2 border-chart-2/30">
          {unlockedCount}/{levels.length} desbloqueados
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-chart-2 to-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      {/* Levels */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {levels.map((level, i) => {
          const Icon = level.icon;
          const isUnlocked = level.status === 'unlocked';
          const isInProgress = level.status === 'in_progress';

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                'relative rounded-xl p-3 border text-center transition-all',
                isUnlocked && 'border-chart-2/40 bg-chart-2/5',
                isInProgress && 'border-accent/40 bg-accent/5',
                !isUnlocked && !isInProgress && 'border-border bg-muted/30 opacity-60',
              )}
            >
              {isInProgress && (
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent animate-pulse" />
              )}

              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2',
                isUnlocked && 'bg-chart-2/20',
                isInProgress && 'bg-accent/20',
                !isUnlocked && !isInProgress && 'bg-muted',
              )}>
                {isUnlocked ? <Check className="w-5 h-5 text-chart-2" /> :
                  isInProgress ? <Icon className="w-5 h-5 text-accent" /> :
                    <Lock className="w-4 h-4 text-muted-foreground" />}
              </div>

              <p className="text-xs font-bold truncate">{level.name}</p>
              <p className="text-[9px] text-muted-foreground">{level.subtitle}</p>
              <Badge variant="outline" className="text-[8px] mt-1.5 truncate max-w-full">{level.revenue}</Badge>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
