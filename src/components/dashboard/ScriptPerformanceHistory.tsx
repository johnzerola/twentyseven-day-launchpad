import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Trophy, TrendingUp, Loader2, Star, BarChart3, Eye, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { formatNumber } from '@/lib/formatters';

interface ScriptWithPerformance {
  id: string;
  topic: string;
  style: string | null;
  created_at: string;
  video_type: string;
  duration: number | null;
  score?: number;
  // Linked performance data
  perf?: {
    views_current: number;
    performance_grade: string;
    likes: number;
    comments: number;
  } | null;
}

export const ScriptPerformanceHistory = () => {
  const [scripts, setScripts] = useState<ScriptWithPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState<string | null>(null);
  const [roiStats, setRoiStats] = useState({ totalScripts: 0, trackedVideos: 0, totalViews: 0, avgGrade: '—' });

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const [scriptsRes, perfRes] = await Promise.all([
        supabase.from('saved_scripts')
          .select('id, topic, style, created_at, video_type, duration, script_content')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('video_performance')
          .select('id, title, views_current, performance_grade, likes, comments')
          .eq('user_id', session.user.id),
      ]);

      const perfData = perfRes.data || [];

      if (scriptsRes.data) {
        const scored = scriptsRes.data.map((s: any) => {
          const content = s.script_content || '';
          let score = 50;
          if (content.length > 3000) score += 10;
          if (content.length > 5000) score += 5;
          if (content.includes('##') || content.includes('**')) score += 5;
          if (content.match(/\[[\d:]+\]/)) score += 5;
          if (content.toLowerCase().includes('hook') || content.toLowerCase().includes('gancho')) score += 5;
          if (content.toLowerCase().includes('cta') || content.toLowerCase().includes('inscreva')) score += 5;
          const emotionalWords = ['incrível', 'chocante', 'segredo', 'nunca', 'sempre', 'amazing', 'secret', 'shocking'];
          const emotionalCount = emotionalWords.filter(w => content.toLowerCase().includes(w)).length;
          score += Math.min(emotionalCount * 3, 15);

          // Try to find matching video performance by topic similarity
          const topicLower = (s.topic || '').toLowerCase();
          const matchedPerf = perfData.find((p: any) =>
            (p.title || '').toLowerCase().includes(topicLower.slice(0, 20)) ||
            topicLower.includes((p.title || '').toLowerCase().slice(0, 20))
          );

          return {
            ...s,
            score: Math.min(score, 100),
            script_content: undefined,
            perf: matchedPerf ? {
              views_current: matchedPerf.views_current,
              performance_grade: matchedPerf.performance_grade,
              likes: matchedPerf.likes,
              comments: matchedPerf.comments,
            } : null,
          };
        });

        setScripts(scored.sort((a: ScriptWithPerformance, b: ScriptWithPerformance) => (b.score || 0) - (a.score || 0)));

        // ROI stats
        const totalViews = perfData.reduce((sum: number, p: any) => sum + (p.views_current || 0), 0);
        const grades = perfData.filter((p: any) => p.performance_grade && p.performance_grade !== 'pending');
        const gradeMap: Record<string, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 };
        const avgGradeNum = grades.length > 0
          ? grades.reduce((s: number, p: any) => s + (gradeMap[p.performance_grade] || 0), 0) / grades.length
          : 0;
        const gradeLabels = ['F', 'F', 'D', 'C', 'B', 'A', 'S'];
        setRoiStats({
          totalScripts: scriptsRes.data.length,
          trackedVideos: perfData.length,
          totalViews,
          avgGrade: avgGradeNum > 0 ? gradeLabels[Math.round(avgGradeNum)] || '—' : '—',
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const scoreScript = async (scriptId: string) => {
    setScoring(scriptId);
    try {
      const { data, error } = await supabase.functions.invoke('score-script', {
        body: { scriptId },
      });
      if (error) throw error;
      if (data?.score) {
        setScripts(prev => prev.map(s =>
          s.id === scriptId ? { ...s, score: data.score.total || data.score } : s
        ));
        toast.success(`Score atualizado: ${data.score.total || data.score}/100`);
      }
    } catch {
      toast.error('Erro ao pontuar roteiro');
    } finally {
      setScoring(null);
    }
  };

  if (loading) return (
    <div className="glass rounded-xl p-5 space-y-3">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );

  if (scripts.length === 0) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-chart-2';
    if (score >= 60) return 'text-chart-3';
    return 'text-muted-foreground';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-chart-2/20';
    if (score >= 60) return 'bg-chart-3/20';
    return 'bg-muted/30';
  };

  const GRADE_COLORS: Record<string, string> = {
    S: 'bg-yellow-500/20 text-yellow-300',
    A: 'bg-green-500/20 text-green-300',
    B: 'bg-blue-500/20 text-blue-300',
    C: 'bg-orange-500/20 text-orange-300',
    D: 'bg-red-500/20 text-red-300',
    F: 'bg-red-800/20 text-red-400',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-chart-3" /> ROI — Roteiros vs Performance Real
        </h3>
        <Link to="/scripts" className="text-xs text-primary hover:underline">Ver todos →</Link>
      </div>

      {/* ROI Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{roiStats.totalScripts}</p>
          <p className="text-[9px] text-muted-foreground">Roteiros</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{roiStats.trackedVideos}</p>
          <p className="text-[9px] text-muted-foreground">Rastreados</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{formatNumber(roiStats.totalViews)}</p>
          <p className="text-[9px] text-muted-foreground">Views Reais</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{roiStats.avgGrade}</p>
          <p className="text-[9px] text-muted-foreground">Grade Média</p>
        </div>
      </div>

      {roiStats.trackedVideos === 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 text-xs text-muted-foreground">
          <p>💡 <strong className="text-foreground">Feche o loop:</strong> Adicione vídeos publicados no "Performance Loop" abaixo para ver o ROI real dos seus roteiros.</p>
        </div>
      )}

      <div className="space-y-2">
        {scripts.slice(0, 8).map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3 group">
            <span className="text-sm font-bold text-muted-foreground w-5">#{i + 1}</span>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${getScoreBg(s.score || 0)} ${getScoreColor(s.score || 0)}`}>
              {s.score || '—'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.topic}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.style && <Badge variant="secondary" className="text-[9px]">{s.style}</Badge>}
                <Badge variant="outline" className="text-[9px]">{s.video_type === 'short' ? '📱 Short' : '📺 Long'}</Badge>
                <span className="text-[9px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                {/* Real performance data */}
                {s.perf && (
                  <>
                    <span className="text-[9px] flex items-center gap-0.5 text-chart-2">
                      <Eye className="w-2.5 h-2.5" /> {formatNumber(s.perf.views_current)}
                    </span>
                    <Badge className={`text-[8px] border-0 ${GRADE_COLORS[s.perf.performance_grade] || 'bg-muted text-muted-foreground'}`}>
                      {s.perf.performance_grade}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] gap-1"
              onClick={() => scoreScript(s.id)} disabled={scoring === s.id}>
              {scoring === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
              Pontuar
            </Button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
