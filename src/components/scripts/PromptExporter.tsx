import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { SyncedScene, Character } from './types';

interface PromptExporterProps {
  scenes: SyncedScene[];
  characters: Character[];
  topic: string;
  videoStyle: string;
  language: string;
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const PromptExporter = ({ scenes, characters, topic, videoStyle, language }: PromptExporterProps) => {
  if (scenes.length === 0) return null;

  const exportToAutoflow = () => {
    const autoflowLines = scenes.map((scene) => {
      const tag = `[V1-S${scene.sceneIndex + 1}]`;
      const imagePrompt = scene.visualPrompt;
      const camera = scene.cameraAngle || 'cinematic';
      const lens = scene.lensSpec || '';
      const lighting = scene.lightingSetup || '';
      const moodStr = scene.mood || 'dramatic';
      const videoParts = [camera];
      if (lens) videoParts.push(lens);
      if (lighting) videoParts.push(`${lighting} lighting`);
      videoParts.push(`${moodStr} mood`);
      if (scene.transitionNote) videoParts.push(scene.transitionNote);
      const videoPrompt = videoParts.join(', ');
      return `${tag} ${imagePrompt} ||| ${tag} ${videoPrompt}`;
    }).join('\n');

    navigator.clipboard.writeText(autoflowLines);
    toast.success(`📋 ${scenes.length} cenas copiadas! Cole na Prompt List do AutoFlow.`);
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">🚀 Exportar para AutoFlow</span>
        <Badge className="bg-primary/20 text-primary text-[10px]">{scenes.length} cenas</Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">Copia prompts sincronizados no formato AutoFlow. Cole na Prompt List e clique Add to Queue.</p>
      <Button className="w-full gap-2 h-11 text-sm gradient-hero border-0" onClick={exportToAutoflow}>
        <Copy className="w-4 h-4" /> 📋 Copiar Cenas ({scenes.length})
      </Button>
      <p className="text-[9px] text-muted-foreground text-center">Formato: [V1-S#] image prompt ||| [V1-S#] video prompt</p>
    </div>
  );
};
