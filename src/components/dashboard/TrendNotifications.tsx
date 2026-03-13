import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Flame, X, ExternalLink, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface TrendAlert {
  id: string;
  type: 'niche_trending' | 'competitor_spike' | 'new_opportunity';
  title: string;
  description: string;
  niche?: string;
  score?: number;
  actionPath?: string;
  actionLabel?: string;
}

export const TrendNotifications = () => {
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      // Get user's niches from onboarding and analyses
      const [planRes, nichesRes, emergingRes] = await Promise.all([
        supabase.from('onboarding_plans').select('niche').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('saved_niche_analyses').select('niche, score').eq('user_id', uid).order('created_at', { ascending: false }).limit(3),
        supabase.from('emerging_channels').select('channel_title, niche, viral_score').order('detected_at', { ascending: false }).limit(5),
      ]);

      const userNiches = new Set<string>();
      if (planRes.data?.niche) userNiches.add(planRes.data.niche.toLowerCase());
      (nichesRes.data || []).forEach(n => userNiches.add(n.niche.toLowerCase()));

      const newAlerts: TrendAlert[] = [];

      // Check emerging channels in user's niches
      (emergingRes.data || []).forEach(ch => {
        if (ch.niche && userNiches.has(ch.niche.toLowerCase()) && (ch.viral_score || 0) >= 7) {
          newAlerts.push({
            id: `emerging-${ch.channel_title}`,
            type: 'niche_trending',
            title: `🔥 "${ch.channel_title}" está viralizando`,
            description: `Canal do nicho ${ch.niche} com score viral ${ch.viral_score}/10. Pode ser uma oportunidade para criar conteúdo similar.`,
            niche: ch.niche || undefined,
            score: ch.viral_score || undefined,
            actionPath: '/search',
            actionLabel: 'Espionar Canal',
          });
        }
      });

      // High-score niches the user analyzed
      (nichesRes.data || []).forEach(n => {
        if ((n.score || 0) >= 80) {
          newAlerts.push({
            id: `niche-hot-${n.niche}`,
            type: 'new_opportunity',
            title: `💎 "${n.niche}" score ${n.score}/100`,
            description: `Este nicho tem alto potencial de monetização. Considere criar seu próximo roteiro aqui.`,
            niche: n.niche,
            score: n.score || undefined,
            actionPath: `/scripts?niche=${encodeURIComponent(n.niche)}`,
            actionLabel: 'Criar Roteiro',
          });
        }
      });

      // Load dismissed from localStorage
      try {
        const stored = localStorage.getItem('dismissed_trends');
        if (stored) setDismissed(new Set(JSON.parse(stored)));
      } catch {}

      setAlerts(newAlerts);
      setLoading(false);
    };
    load();
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem('dismissed_trends', JSON.stringify([...next]));
  };

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (loading || visible.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <h3 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
        <Bell className="w-3 h-3" /> Alertas de Tendência
      </h3>
      <AnimatePresence>
        {visible.slice(0, 3).map(alert => (
          <motion.div key={alert.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-4 border border-accent/20 flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              alert.type === 'niche_trending' ? 'bg-destructive/20' : 'bg-accent/20'
            }`}>
              {alert.type === 'niche_trending' ? <Flame className="w-4 h-4 text-destructive" /> : <TrendingUp className="w-4 h-4 text-accent" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{alert.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{alert.description}</p>
              {alert.actionPath && (
                <Link to={alert.actionPath}>
                  <Button size="sm" variant="outline" className="mt-2 text-xs gap-1 h-7">
                    <ExternalLink className="w-3 h-3" /> {alert.actionLabel}
                  </Button>
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(alert.id)} className="text-muted-foreground hover:text-foreground p-0.5 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
