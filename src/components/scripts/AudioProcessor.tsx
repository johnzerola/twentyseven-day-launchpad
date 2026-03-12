import { useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { SyncedScene, Character, VideoStyleOption } from './types';

interface AudioProcessorProps {
  script: string;
  videoStyle: string;
  videoStyles: VideoStyleOption[];
  characters: Character[];
  language: string;
  niche: string;
  sceneBlueprintJson: any[];
  syncedScenes: SyncedScene[];
  setSyncedScenes: (scenes: SyncedScene[]) => void;
  getCleanNarration: () => string;
}

export const AudioProcessor = ({
  script, videoStyle, videoStyles, characters, language, niche,
  sceneBlueprintJson, syncedScenes, setSyncedScenes, getCleanNarration,
}: AudioProcessorProps) => {
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [sceneDuration] = useState(8);

  const generateSyncedPrompts = async () => {
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }
    setGeneratingPrompts(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-synced-prompts', {
        body: {
          script: cleanScript, videoStyle,
          characters: characters.length > 0 ? characters : undefined,
          sceneDurationSeconds: sceneDuration, language, niche,
          sceneBlueprintFromScript: sceneBlueprintJson.length > 0 ? sceneBlueprintJson : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSyncedScenes(data.scenes || []);
      toast.success(`${data.scenes?.length || 0} cenas sincronizadas!`);
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar prompts'); }
    finally { setGeneratingPrompts(false); }
  };

  return (
    <div className="border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Gerar Cenas Visuais do Roteiro</span>
        <Badge className="bg-primary/20 text-primary text-[10px]">IA</Badge>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        A IA analisa seu roteiro e gera prompts visuais cinematográficos para cada cena.
      </p>

      <div className="bg-muted/30 rounded-lg p-2 text-[10px] text-muted-foreground mb-3">
        🎬 Estilo: <strong className="text-foreground">{videoStyles.find(v => v.value === videoStyle)?.label}</strong>
        {characters.length > 0 && <> • 👥 {characters.length} personagens</>}
        <span className="ml-2">• ⏱ ~{sceneDuration}s por cena</span>
      </div>

      <Button onClick={generateSyncedPrompts} disabled={generatingPrompts}
        className="w-full gap-2 h-11 text-sm gradient-hero border-0">
        {generatingPrompts
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando cenas...</>
          : <><Sparkles className="w-4 h-4" /> 🧠 Gerar Cenas Inteligentes do Roteiro</>}
      </Button>
    </div>
  );
};
