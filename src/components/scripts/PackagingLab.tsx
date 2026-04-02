import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Package, Eye, Target, Sparkles, AlertTriangle, Loader2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PackagingResult {
  composite_score: number;
  title_thumb_synergy: number;
  promise_delivery: number;
  curiosity_gap: number;
  niche_fit: number;
  scroll_stop_power: number;
  ctr_estimate: string;
  traffic_fit: string;
  weaknesses: string[];
  improvements: string[];
  verdict: string;
}

interface Props {
  title?: string;
  thumbnailPrompt?: string;
  hookText?: string;
  niche?: string;
  videoType?: string;
  language?: string;
}

export function PackagingLab({ title: initialTitle, thumbnailPrompt: initialThumb, hookText: initialHook, niche: initialNiche, videoType, language }: Props) {
  const [title, setTitle] = useState(initialTitle || '');
  const [thumbPrompt, setThumbPrompt] = useState(initialThumb || '');
  const [hook, setHook] = useState(initialHook || '');
  const [niche, setNiche] = useState(initialNiche || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PackagingResult | null>(null);

  const analyze = async () => {
    if (!title.trim() && !hook.trim()) {
      toast.error('Preencha pelo menos o título ou o hook.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('packaging-score', {
        body: { title, thumbnailPrompt: thumbPrompt, hookText: hook, niche, videoType, language },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Packaging Score: ${data.composite_score}/100 ${data.verdict}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao analisar packaging');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBarColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="p-4 space-y-4 bg-card/80 backdrop-blur border-border/50">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">Packaging Lab</h3>
        <Badge variant="outline" className="text-xs">Título + Thumb + Hook</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Título</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="O título do vídeo..." className="text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Nicho</label>
          <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="true_crime, dark, horror..." className="text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Conceito da Thumbnail</label>
        <Input value={thumbPrompt} onChange={e => setThumbPrompt(e.target.value)} placeholder="Descreva o visual da thumbnail..." className="text-sm" />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Hook (primeiros 30 segundos)</label>
        <Textarea value={hook} onChange={e => setHook(e.target.value)} placeholder="Cole os primeiros 30 segundos do roteiro..." className="text-sm min-h-[80px]" />
      </div>

      <Button onClick={analyze} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
        {loading ? 'Analisando packaging...' : 'Analisar Packaging'}
      </Button>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2 border-t border-border/50">
            {/* Composite Score */}
            <div className="text-center py-3">
              <div className={`text-4xl font-black ${getScoreColor(result.composite_score)}`}>
                {result.composite_score}
              </div>
              <div className="text-xs text-muted-foreground">Packaging Score</div>
              <Badge className="mt-1">{result.verdict}</Badge>
            </div>

            {/* Dimension Bars */}
            <div className="space-y-2">
              {[
                { label: 'Título ↔ Thumb', score: result.title_thumb_synergy, icon: <Sparkles className="w-3 h-3" /> },
                { label: 'Promessa ↔ Entrega', score: result.promise_delivery, icon: <Target className="w-3 h-3" /> },
                { label: 'Curiosity Gap', score: result.curiosity_gap, icon: <Eye className="w-3 h-3" /> },
                { label: 'Niche Fit', score: result.niche_fit, icon: <TrendingUp className="w-3 h-3" /> },
                { label: 'Scroll Stop', score: result.scroll_stop_power, icon: <AlertTriangle className="w-3 h-3" /> },
              ].map(dim => (
                <div key={dim.label} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">{dim.icon} {dim.label}</span>
                    <span className={`font-bold ${getScoreColor(dim.score)}`}>{dim.score}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getBarColor(dim.score)}`} style={{ width: `${dim.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">CTR est: {result.ctr_estimate}</Badge>
              <Badge variant="outline" className="text-xs">Tráfego: {result.traffic_fit}</Badge>
            </div>

            {/* Thumbnail Preview Simulation */}
            {title && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-medium">📱 Simulação no feed (tamanho real)</div>
                <div className="bg-muted/30 rounded-lg p-2 flex gap-2 items-start max-w-[320px]">
                  <div className="w-[168px] h-[94px] bg-muted rounded flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground border border-border/30">
                    {thumbPrompt ? '🖼️' : 'Sem thumb'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{title}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Seu Canal</div>
                    <div className="text-[10px] text-muted-foreground">1.2K views • 2h ago</div>
                  </div>
                </div>
              </div>
            )}

            {/* Weaknesses & Improvements */}
            {result.weaknesses?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-400">⚠️ Pontos fracos</div>
                {result.weaknesses.map((w, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-3">• {w}</div>
                ))}
              </div>
            )}
            {result.improvements?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-400">💡 Melhorias</div>
                {result.improvements.map((imp, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-3">• {imp}</div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
