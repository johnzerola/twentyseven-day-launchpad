import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Trophy, TrendingUp, Loader2, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface ScriptWithScore {
  id: string;
  topic: string;
  style: string | null;
  created_at: string;
  video_type: string;
  duration: number | null;
  score?: number; // computed
}

export const ScriptPerformanceHistory = () => {
  const [scripts, setScripts] = useState<ScriptWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase.from('saved_scripts')
        .select('id, topic, style, created_at, video_type, duration, script_content')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        // Score scripts locally based on content quality signals
        const scored = data.map((s: any) => {
          const content = s.script_content || '';
          let score = 50;
          // Length bonus
          if (content.length > 3000) score += 10;
          if (content.length > 5000) score += 5;
          // Structure signals
          if (content.includes('##') || content.includes('**')) score += 5;
          if (content.match(/\[[\d:]+\]/)) score += 5; // timestamps
          if (content.toLowerCase().includes('hook') || content.toLowerCase().includes('gancho')) score += 5;
          if (content.toLowerCase().includes('cta') || content.toLowerCase().includes('inscreva')) score += 5;
          // Emotional triggers
          const emotionalWords = ['incrível', 'chocante', 'segredo', 'nunca', 'sempre', 'amazing', 'secret', 'shocking'];
          const emotionalCount = emotionalWords.filter(w => content.toLowerCase().includes(w)).length;
          score += Math.min(emotionalCount * 3, 15);
          return { ...s, score: Math.min(score, 100), script_content: undefined };
        });
        setScripts(scored.sort((a: ScriptWithScore, b: ScriptWithScore) => (b.score || 0) - (a.score || 0)));
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-chart-3" /> Top Roteiros — Performance
        </h3>
        <Link to="/scripts" className="text-xs text-primary hover:underline">Ver todos →</Link>
      </div>

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
