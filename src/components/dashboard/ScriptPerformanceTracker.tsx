import { useState, useEffect } from 'react';
import { Link2, ExternalLink, BarChart3, TrendingUp, CheckCircle2, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';

interface PerformanceLink {
  id: string;
  script_id: string | null;
  youtube_video_id: string;
  video_title: string | null;
  views_48h: number | null;
  views_7d: number | null;
  views_30d: number | null;
  avg_retention_pct: number | null;
  ctr_pct: number | null;
  likes: number | null;
  comments: number | null;
  performance_grade: string | null;
  beat_channel_average: boolean | null;
  learnings_extracted: boolean | null;
  created_at: string;
}

interface Props {
  scriptId?: string;
  scriptTopic?: string;
}

export const ScriptPerformanceTracker = ({ scriptId, scriptTopic }: Props) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [linking, setLinking] = useState(false);
  const [links, setLinks] = useState<PerformanceLink[]>([]);
  const [channelAvgRetention, setChannelAvgRetention] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLinks(); }, []);

  const loadLinks = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const query = supabase.from('script_performance_link')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (scriptId) query.eq('script_id', scriptId);

    const { data } = await query;
    setLinks((data as PerformanceLink[]) || []);

    // Calculate channel average retention
    const allRetentions = ((data as PerformanceLink[]) || [])
      .filter(l => l.avg_retention_pct != null)
      .map(l => l.avg_retention_pct!);
    if (allRetentions.length > 0) {
      setChannelAvgRetention(allRetentions.reduce((a, b) => a + b, 0) / allRetentions.length);
    }

    setLoading(false);
  };

  const handleLink = async () => {
    if (!youtubeUrl.trim()) return;
    setLinking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Login necessário');

      const { data, error } = await supabase.functions.invoke('link-script-to-video', {
        body: { script_id: scriptId || null, youtube_url: youtubeUrl },
      });

      if (error) throw error;
      toast.success('✅ Vídeo vinculado! Métricas serão sincronizadas em breve.');
      setYoutubeUrl('');
      loadLinks();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao vincular');
    } finally {
      setLinking(false);
    }
  };

  const gradeColor = (grade: string | null) => {
    if (!grade) return 'text-muted-foreground';
    if (grade === 'S' || grade === 'A') return 'text-chart-2';
    if (grade === 'B') return 'text-chart-3';
    if (grade === 'C') return 'text-muted-foreground';
    return 'text-destructive';
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Link input */}
      <div className="bg-secondary/20 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">
            {scriptTopic ? `Publicou "${scriptTopic}"?` : 'Publicou este roteiro?'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Cole o link do YouTube para rastrear performance real e o sistema aprender com seus resultados.
        </p>
        <div className="flex gap-2">
          <Input
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="text-xs h-8 flex-1"
          />
          <Button size="sm" onClick={handleLink} disabled={linking || !youtubeUrl.trim()} className="h-8 gap-1 text-xs">
            {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
            Vincular
          </Button>
        </div>
      </div>

      {/* Linked videos */}
      <AnimatePresence>
        {links.map((link, i) => (
          <motion.div key={link.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <a href={`https://youtube.com/watch?v=${link.youtube_video_id}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline truncate flex items-center gap-1">
                  {link.video_title || link.youtube_video_id}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {link.performance_grade && (
                  <span>
                    <Badge className={`text-xs font-black ${gradeColor(link.performance_grade)}`}>
                      {link.performance_grade}
                    </Badge>
                  </span>
                )}
                {link.learnings_extracted && (
                  <span>
                    <Badge variant="outline" className="text-[9px] text-chart-2 border-chart-2/30 gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Aprendizado extraído
                    </Badge>
                  </span>
                )}
              </div>
            </div>

            {/* Metrics grid */}
            {(link.views_48h != null || link.views_7d != null) ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {link.views_48h != null && (
                  <div className="bg-secondary/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold">{formatNumber(link.views_48h)}</p>
                    <p className="text-[9px] text-muted-foreground">Views 48h</p>
                  </div>
                )}
                {link.views_7d != null && (
                  <div className="bg-secondary/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold">{formatNumber(link.views_7d)}</p>
                    <p className="text-[9px] text-muted-foreground">Views 7d</p>
                  </div>
                )}
                {link.avg_retention_pct != null && (
                  <div className="bg-secondary/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold">{link.avg_retention_pct.toFixed(1)}%</p>
                    <p className="text-[9px] text-muted-foreground">Retenção</p>
                  </div>
                )}
                {link.ctr_pct != null && (
                  <div className="bg-secondary/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold">{link.ctr_pct.toFixed(1)}%</p>
                    <p className="text-[9px] text-muted-foreground">CTR</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-secondary/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">⏳ Aguardando métricas (sync automático a cada 24h)</p>
              </div>
            )}

            {/* Comparison with channel average */}
            {link.avg_retention_pct != null && channelAvgRetention != null && (
              <div className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg ${
                link.avg_retention_pct > channelAvgRetention ? 'bg-chart-2/10 text-chart-2' : 'bg-destructive/10 text-destructive'
              }`}>
                {link.avg_retention_pct > channelAvgRetention ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                Este roteiro teve {link.avg_retention_pct.toFixed(0)}% de retenção vs média do canal {channelAvgRetention.toFixed(0)}%
                {link.avg_retention_pct > channelAvgRetention 
                  ? ` (+${(link.avg_retention_pct - channelAvgRetention).toFixed(0)}% acima 🎉)`
                  : ` (${(link.avg_retention_pct - channelAvgRetention).toFixed(0)}% abaixo)`
                }
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
