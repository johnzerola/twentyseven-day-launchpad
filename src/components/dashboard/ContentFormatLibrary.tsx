import { useState, useEffect } from 'react';
import { Film, Loader2, ArrowRight, Star, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ContentModel {
  id: string;
  model_name: string;
  model_type: string;
  description: string;
  video_type: string;
  hook_pattern: string;
  pacing_guide: string;
  retention_profile: Record<string, number>;
  best_for_niches: string[];
  effectiveness_score: number;
  source: string;
}

const MODEL_ICONS: Record<string, string> = {
  reddit: '🗣️',
  split_screen: '📱',
  gameplay: '🎮',
  facts: '⚡',
  ugc_hook: '📸',
  fake_text: '💬',
  storytelling: '📖',
  curiosity: '🧠',
  mystery: '🔍',
  documentary: '📹',
  challenge: '🔥',
  tutorial: '🛠️',
};

export const ContentFormatLibrary = () => {
  const [models, setModels] = useState<ContentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('content_models').select('*').order('effectiveness_score', { ascending: false });
      setModels((data as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const types = ['all', ...new Set(models.map(m => m.video_type))];
  const filtered = selectedType === 'all' ? models : models.filter(m => m.video_type === selectedType);

  const useTemplate = (model: ContentModel) => {
    const style = model.model_type === 'reddit' ? 'reddit' : 
                  model.model_type === 'facts' ? 'listicle' :
                  model.model_type === 'gameplay' ? 'dopaminérgico' :
                  model.model_type === 'documentary' ? 'documentário' : 'dopaminérgico';
    navigate(`/scripts?style=${style}&type=${model.video_type}`);
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">📋 Biblioteca de Formatos</h3>
          <p className="text-xs text-muted-foreground">Templates de conteúdo testados com dados de retenção reais</p>
        </div>
        <Badge className="bg-primary/20 text-primary">{models.length} modelos</Badge>
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5">
        {types.map(t => (
          <Button key={t} size="sm" variant={selectedType === t ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setSelectedType(t)}>
            {t === 'all' ? 'Todos' : t === 'short' ? '⚡ Shorts' : '🎬 Longform'}
          </Button>
        ))}
      </div>

      {/* Models grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(model => (
          <div key={model.id} className="border border-border/50 rounded-xl p-4 bg-card hover:border-primary/30 transition-colors space-y-2.5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{MODEL_ICONS[model.model_type] || '📄'}</span>
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{model.model_name}</h4>
                  <Badge variant="outline" className="text-[9px] mt-0.5">{model.video_type === 'short' ? 'Short' : 'Longform'}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < Math.round(model.effectiveness_score / 2) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
                ))}
              </div>
            </div>

            {/* Description */}
            <p className="text-[11px] text-muted-foreground leading-relaxed">{model.description}</p>

            {/* Hook */}
            <div className="bg-primary/5 rounded-lg p-2">
              <p className="text-[9px] text-muted-foreground font-medium mb-0.5">🎣 Hook Pattern:</p>
              <p className="text-[10px] text-foreground italic">"{model.hook_pattern}"</p>
            </div>

            {/* Pacing */}
            <p className="text-[10px] text-muted-foreground">⏱️ Pacing: {model.pacing_guide}</p>

            {/* Niches */}
            {model.best_for_niches?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(model.best_for_niches as string[]).slice(0, 4).map((n, i) => (
                  <Badge key={i} className="bg-accent/10 text-accent text-[8px]">{n}</Badge>
                ))}
              </div>
            )}

            {/* Use button */}
            <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 mt-1" onClick={() => useTemplate(model)}>
              <ArrowRight className="w-3 h-3" /> Usar Template
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
