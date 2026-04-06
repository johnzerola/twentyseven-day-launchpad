import { useState } from 'react';
import { Image, Copy, Loader2, Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ThumbnailVariant {
  style: string;
  midjourney_prompt: string;
  dalle_prompt: string;
  composition: string;
  color_palette: string[];
  emotion_target: string;
  expected_ctr_boost?: number;
  estimated_ctr_boost_ai?: number;
  ctr_boost_source?: string;
  face_required?: boolean;
}

interface Props {
  videoTitle: string;
  niche: string;
  scriptSummary?: string;
}

export const ThumbnailGenerator = ({ videoTitle, niche, scriptSummary }: Props) => {
  const [variants, setVariants] = useState<ThumbnailVariant[]>([]);
  const [loading, setLoading] = useState(false);

  const generateThumbnails = async () => {
    if (!videoTitle.trim()) {
      toast.error('Título necessário para gerar thumbnails');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-thumbnail-prompt', {
        body: {
          video_title: videoTitle,
          niche: niche || 'general',
          count: 3,
          script_context: scriptSummary || undefined,
        },
      });
      if (error) throw error;
      setVariants(data?.variants || []);
      if (!data?.variants?.length) toast.error('Nenhum variante gerada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar thumbnails');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Image className="w-4 h-4 text-accent" /> Gerador de Thumbnail
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            3 variantes com prompts Midjourney + DALL-E otimizados para CTR
          </p>
        </div>
        <Button size="sm" onClick={generateThumbnails} disabled={loading || !videoTitle.trim()} className="gap-1 text-xs h-7">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Gerar Thumbnails
        </Button>
      </div>

      <AnimatePresence>
        {variants.map((v, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="text-[9px]">Variante {i + 1}</Badge>
                <Badge variant="outline" className="text-[9px]">{v.style}</Badge>
                <Badge variant="outline" className="text-[9px]">🎭 {v.emotion_target}</Badge>
              </div>
              {(v.estimated_ctr_boost_ai ?? v.expected_ctr_boost) != null && (
                <div className="flex items-center gap-1">
                  <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30 text-[9px]">
                    +{v.estimated_ctr_boost_ai ?? v.expected_ctr_boost}% CTR
                  </Badge>
                  <Badge variant="outline" className="text-[8px] text-muted-foreground border-muted-foreground/30">
                    Estimativa IA
                  </Badge>
                </div>
              )}
            </div>

            {/* Composition */}
            <p className="text-xs text-muted-foreground">{v.composition}</p>

            {/* Color palette */}
            <div className="flex items-center gap-2">
              <Palette className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Paleta:</span>
              {(v.color_palette || []).map((c, ci) => (
                <div key={ci} className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: c }} />
                  <span className="text-[9px] text-muted-foreground">{c}</span>
                </div>
              ))}
            </div>

            {/* Prompts */}
            <div className="space-y-2">
              <div className="bg-secondary/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">Midjourney</span>
                  <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] gap-0.5"
                    onClick={() => copyPrompt(v.midjourney_prompt, 'Prompt Midjourney')}>
                    <Copy className="w-2.5 h-2.5" /> Copiar
                  </Button>
                </div>
                <p className="text-[10px] text-foreground/80 leading-relaxed">{v.midjourney_prompt}</p>
              </div>
              <div className="bg-secondary/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">DALL-E 3</span>
                  <Button size="sm" variant="ghost" className="h-5 px-2 text-[9px] gap-0.5"
                    onClick={() => copyPrompt(v.dalle_prompt, 'Prompt DALL-E')}>
                    <Copy className="w-2.5 h-2.5" /> Copiar
                  </Button>
                </div>
                <p className="text-[10px] text-foreground/80 leading-relaxed">{v.dalle_prompt}</p>
              </div>
            </div>

            {/* Tips */}
            {v.face_required && (
              <p className="text-[9px] text-accent">
                💡 Use emoção {v.emotion_target} porque vídeos de {niche || 'este nicho'} com expressão facial têm mais CTR
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
