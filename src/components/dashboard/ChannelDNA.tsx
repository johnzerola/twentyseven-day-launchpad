import { useState, useEffect } from 'react';
import { Dna, Sparkles, TrendingUp, Clock, Target, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface ChannelMemory {
  preferred_duration_minutes: number | null;
  preferred_style: string | null;
  preferred_hook_type: string | null;
  preferred_narration_style: string | null;
  avg_retention_pct: number | null;
  best_performing_style: string | null;
  best_performing_niche: string | null;
  best_performing_duration_minutes: number | null;
  total_scripts_generated: number;
  total_scripts_published: number;
  total_views_accumulated: number;
  ai_identified_patterns: any[];
  last_topics_used: string[];
}

export const ChannelDNA = () => {
  const [memory, setMemory] = useState<ChannelMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_content_memory')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (data) setMemory(data as unknown as ChannelMemory);
      setLoading(false);
    })();
  }, []);

  const handleExtractLearnings = async () => {
    setExtracting(true);
    try {
      const { error } = await supabase.functions.invoke('extract-user-learnings', {});
      if (error) throw error;
      toast.success('Aprendizados extraídos! Recarregando...');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Erro ao extrair aprendizados');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateOptimized = () => {
    const params = new URLSearchParams();
    if (memory?.best_performing_niche) params.set('niche', memory.best_performing_niche);
    if (memory?.best_performing_duration_minutes) params.set('duration', String(memory.best_performing_duration_minutes));
    navigate(`/scripts?${params.toString()}`);
  };

  if (loading) return null;

  // No data yet — show CTA to link videos
  if (!memory || memory.total_scripts_generated === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-5 border border-primary/10">
        <div className="flex items-center gap-2 mb-3">
          <Dna className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">🧬 DNA do Canal</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Vincule vídeos publicados aos seus roteiros para o sistema aprender o que funciona no seu canal.
        </p>
        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/scripts')}>
          <Sparkles className="w-3 h-3" /> Gerar Roteiro
        </Button>
      </motion.div>
    );
  }

  const patterns = Array.isArray(memory.ai_identified_patterns) ? memory.ai_identified_patterns : [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl overflow-hidden border border-primary/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold">🧬 DNA DO SEU CANAL</h3>
          </div>
          <Badge variant="outline" className="text-[9px]">
            Baseado em {memory.total_scripts_published || memory.total_scripts_generated} vídeos
          </Badge>
        </div>
      </div>

      {/* DNA Grid */}
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Duração ideal</span>
            </div>
            <p className="text-sm font-bold">
              {memory.best_performing_duration_minutes || memory.preferred_duration_minutes || '—'} min
            </p>
          </div>
          <div className="bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Melhor estilo</span>
            </div>
            <p className="text-sm font-bold truncate">
              {memory.best_performing_style || memory.preferred_style || '—'}
            </p>
          </div>
          <div className="bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Hook que funciona</span>
            </div>
            <p className="text-sm font-bold truncate">
              {memory.preferred_hook_type || '—'}
            </p>
          </div>
          <div className="bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Retenção média</span>
            </div>
            <p className="text-sm font-bold">
              {memory.avg_retention_pct != null ? `${memory.avg_retention_pct.toFixed(0)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Nicho */}
        {memory.best_performing_niche && (
          <div className="bg-chart-2/10 border border-chart-2/20 rounded-lg p-3">
            <p className="text-[10px] text-chart-2 font-medium">Nicho que converte</p>
            <p className="text-sm font-bold capitalize">{memory.best_performing_niche}</p>
          </div>
        )}

        {/* AI Patterns */}
        {patterns.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium">Padrões identificados pela IA:</p>
            {patterns.slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="text-[10px] bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5">
                💡 {typeof p === 'string' ? p : p.pattern || JSON.stringify(p)}
              </div>
            ))}
          </div>
        )}

        {/* AI Recommendation */}
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <p className="text-[10px] text-accent font-semibold mb-1">💡 Próximo roteiro deveria ser:</p>
          <p className="text-xs text-foreground/80">
            "{memory.best_performing_style || 'Narrativo'}, {memory.best_performing_duration_minutes || 15}min, 
            hook de {memory.preferred_hook_type || 'curiosidade'}, 
            tema {memory.best_performing_niche || 'principal'}"
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleGenerateOptimized} className="flex-1 gap-1 text-xs h-8">
            <Sparkles className="w-3 h-3" /> Gerar Roteiro Otimizado
          </Button>
          <Button size="sm" variant="outline" onClick={handleExtractLearnings} disabled={extracting} className="gap-1 text-xs h-8">
            {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
            Atualizar DNA
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
