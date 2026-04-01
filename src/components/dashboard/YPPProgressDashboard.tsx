import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Clock, TrendingUp, RefreshCw, Youtube, Loader2, CheckCircle2, AlertTriangle, Target, Zap } from 'lucide-react';

interface YPPData {
  subscribers: number;
  watchHoursTotal: number;
  shortsViews: number;
  totalViews: number;
  channelName: string;
  channelId: string;
  lastSynced: string | null;
}

export function YPPProgressDashboard() {
  const [data, setData] = useState<YPPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hasOAuth, setHasOAuth] = useState(false);

  const loadProgress = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user has OAuth connected channel
    const { data: channels } = await supabase
      .from('user_channels')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!channels?.length) {
      setLoading(false);
      return;
    }

    // Check for OAuth tokens
    const { data: oauthTokens } = await supabase
      .from('youtube_oauth_tokens' as any)
      .select('channel_id, channel_name')
      .eq('user_id', user.id);

    const userHasOAuth = !!(oauthTokens as any)?.length;
    setHasOAuth(userHasOAuth);

    const mainChannel = channels[0] as any;
    const subs = mainChannel.subscribers || 0;

    // ═══ REAL WATCH HOURS — via YouTube Analytics API (if OAuth connected) ═══
    let realWatchHours: number | null = null;
    let realSubs: number | null = null;

    if (userHasOAuth) {
      try {
        // Fetch last 365 days of real analytics — estimatedMinutesWatched is the TRUE metric
        const { data: analyticsResult, error: analyticsError } = await supabase.functions.invoke('youtube-analytics', {
          body: {
            metrics: 'estimatedMinutesWatched,subscribersGained',
            startDate: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
          },
        });

        if (!analyticsError && analyticsResult?.rows) {
          // Sum all daily estimatedMinutesWatched → convert to hours
          let totalMinutesWatched = 0;
          let totalSubsGained = 0;
          for (const row of analyticsResult.rows) {
            totalMinutesWatched += row[1] || 0; // estimatedMinutesWatched is col 1
            totalSubsGained += row[2] || 0;     // subscribersGained is col 2
          }
          realWatchHours = Math.round(totalMinutesWatched / 60);
          realSubs = subs; // Subs from channel data is already accurate
          console.log(`[YPP] Real watch hours from YouTube Analytics: ${realWatchHours}h (${totalMinutesWatched} mins)`);
        }
      } catch (e) {
        console.warn('[YPP] Failed to fetch real analytics, falling back to estimate:', e);
      }
    }

    // ═══ FALLBACK: estimate from video_performance with ACTUAL duration ═══
    let estimatedWatchHours = 0;
    if (realWatchHours === null) {
      const { data: perfData } = await supabase
        .from('video_performance')
        .select('views_current, avg_retention_percent, duration_seconds')
        .eq('user_id', user.id);

      if (perfData?.length) {
        for (const v of perfData) {
          const retention = (v as any).avg_retention_percent || 50;
          const views = (v as any).views_current || 0;
          const durationSec = (v as any).duration_seconds;
          // Use real duration if available, otherwise estimate based on video type
          const effectiveDuration = durationSec && durationSec > 0 ? durationSec : 30;
          // Real formula: views * duration * retention% → hours
          estimatedWatchHours += (views * effectiveDuration * (retention / 100)) / 3600;
        }
      }
    }

    // Also check milestones for any tracked values
    const { data: milestones } = await supabase
      .from('monetization_milestones' as any)
      .select('milestone_type, current_value, target_value')
      .eq('user_id', user.id);

    const subsMilestone = (milestones as any)?.find((m: any) => m.milestone_type === 'subscribers');
    const watchMilestone = (milestones as any)?.find((m: any) => m.milestone_type === 'watch_hours');

    // Priority: real YouTube data > milestone tracker > estimate
    const finalWatchHours = realWatchHours ?? watchMilestone?.current_value ?? Math.round(estimatedWatchHours);

    setData({
      subscribers: subsMilestone?.current_value || subs,
      watchHoursTotal: finalWatchHours,
      shortsViews: 0,
      totalViews: mainChannel.total_views || 0,
      channelName: mainChannel.channel_name || 'Meu Canal',
      channelId: mainChannel.youtube_channel_id || '',
      lastSynced: mainChannel.updated_at,
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const syncFromYouTube = async () => {
    setSyncing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('youtube-analytics', {
        body: { metrics: 'views,estimatedMinutesWatched,subscribersGained' },
      });
      if (error) throw error;
      toast.success('Dados sincronizados do YouTube!');
      await loadProgress();
    } catch (e: any) {
      toast.error('Conecte seu canal via YouTube OAuth para sincronizar dados reais');
    } finally {
      setSyncing(false);
    }
  };

  const updateMilestoneValue = async (type: string, value: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('monetization_milestones' as any)
      .update({ current_value: value, updated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id)
      .eq('milestone_type', type);
  };

  if (loading) return null;

  const subsProgress = data ? Math.min(100, (data.subscribers / 1000) * 100) : 0;
  const watchProgress = data ? Math.min(100, (data.watchHoursTotal / 4000) * 100) : 0;
  const subsRemaining = data ? Math.max(0, 1000 - data.subscribers) : 1000;
  const watchRemaining = data ? Math.max(0, 4000 - data.watchHoursTotal) : 4000;

  // Estimate days to YPP
  const daysActive = data?.lastSynced 
    ? Math.max(1, Math.ceil((Date.now() - new Date(data.lastSynced).getTime()) / 86400000))
    : 7;
  const subsPerDay = data ? data.subscribers / Math.max(daysActive, 1) : 0;
  const watchPerDay = data ? data.watchHoursTotal / Math.max(daysActive, 1) : 0;
  const daysToSubs = subsPerDay > 0 ? Math.ceil(subsRemaining / subsPerDay) : 999;
  const daysToWatch = watchPerDay > 0 ? Math.ceil(watchRemaining / watchPerDay) : 999;
  const daysToYPP = Math.max(daysToSubs, daysToWatch);

  const isYPPReady = (data?.subscribers || 0) >= 1000 && (data?.watchHoursTotal || 0) >= 4000;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            Progresso rumo ao YPP
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasOAuth && (
              <Button variant="ghost" size="sm" onClick={syncFromYouTube} disabled={syncing}>
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </Button>
            )}
            {isYPPReady && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> YPP Ready!
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscribers Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Inscritos</span>
            </div>
            <span className="text-sm font-bold">
              {data?.subscribers?.toLocaleString() || 0} / 1.000
            </span>
          </div>
          <Progress value={subsProgress} className="h-2.5" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {subsRemaining > 0 ? `Faltam ${subsRemaining} inscritos` : '✅ Meta atingida!'}
            {subsPerDay > 0 && subsRemaining > 0 && ` • ~${Math.round(subsPerDay)} subs/dia`}
          </p>
        </div>

        {/* Watch Hours Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Horas de Exibição</span>
            </div>
            <span className="text-sm font-bold">
              {data?.watchHoursTotal?.toLocaleString() || 0} / 4.000h
            </span>
          </div>
          <Progress value={watchProgress} className="h-2.5" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {watchRemaining > 0 ? `Faltam ${watchRemaining.toLocaleString()}h` : '✅ Meta atingida!'}
            {watchPerDay > 0 && watchRemaining > 0 && ` • ~${Math.round(watchPerDay)}h/dia`}
          </p>
        </div>

        {/* ETA */}
        {!isYPPReady && daysToYPP < 999 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">
                Estimativa: <span className="text-primary">{daysToYPP} dias</span> para o YPP
              </p>
              <p className="text-[10px] text-muted-foreground">
                Baseado no ritmo atual • Continue postando!
              </p>
            </div>
          </div>
        )}

        {/* YPP Sprint Alert */}
        {!isYPPReady && (subsRemaining <= 500 || watchRemaining <= 200) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-destructive animate-pulse" />
              <span className="text-xs font-bold text-destructive">🔥 SPRINT FINAL — YPP ao alcance!</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {subsRemaining <= 500 && subsRemaining > 0 && `Faltam apenas ${subsRemaining} inscritos. `}
              {watchRemaining <= 200 && watchRemaining > 0 && `Faltam ${watchRemaining.toLocaleString()}h de exibição. `}
              O Planner Diário foi ajustado para modo de máxima viralidade — priorize Shorts e temas trending.
            </p>
          </div>
        )}

        {/* No OAuth warning */}
        {!hasOAuth && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Conecte seu canal via YouTube OAuth para métricas reais em tempo real
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
