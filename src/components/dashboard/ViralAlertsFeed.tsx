import { useState, useEffect } from 'react';
import { Bell, ExternalLink, Loader2, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ViralAlert {
  id: string;
  video_id: string;
  video_title: string | null;
  channel_name: string | null;
  pre_viral_score: number | null;
  sent_at: string | null;
  metadata: any;
}

export const ViralAlertsFeed = () => {
  const [alerts, setAlerts] = useState<ViralAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('viral_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(10);

      setAlerts((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-500" />
        <h4 className="font-semibold text-sm text-foreground">Alertas Pré-Virais</h4>
        <Badge className="bg-orange-500/20 text-orange-500 text-[9px]">{alerts.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {alerts.slice(0, 5).map(a => (
          <a
            key={a.id}
            href={`https://youtube.com/watch?v=${a.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 transition-colors group"
          >
            <Flame className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{a.video_title || a.video_id}</p>
              <p className="text-[10px] text-muted-foreground">{a.channel_name} • Score: {Math.round(a.pre_viral_score || 0)}</p>
            </div>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
};
