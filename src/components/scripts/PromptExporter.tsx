import { Copy, Download } from 'lucide-react';
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
    }).join('\n\n');

    navigator.clipboard.writeText(autoflowLines);
    toast.success(`📋 ${scenes.length} cenas copiadas! Cole na Prompt List do AutoFlow.`);
  };

  const exportDarkPlannerFormat = () => {
    // DarkPlanner v3: Character sheets + prompts separated, no numbering
    const charSheets = characters.length > 0
      ? `═══ CHARACTER IDENTITY SHEETS ═══\n\n${characters.map(c => {
          const a: Record<string, string> = (c.appearance || {}) as any;
          const f: Record<string, string> = (c.facial_features || {}) as any;
          const cl: Record<string, string> = (c.clothing || {}) as any;
          return `[${c.name}]: ${c.gender} approximately ${c.age} years old, ${a.body_type || 'average'} build. Skin: ${a.skin_color || 'medium'} tone with natural pores. Hair: ${a.hair_color || 'dark'} ${a.hair_style || 'short'}. Eyes: ${a.eye_color || 'brown'} with ${f.eyebrows || 'natural'} eyebrows. Face: ${f.face_shape || 'oval'}, ${f.nose || 'straight'} nose. Clothing: ${cl.shirt || 'casual top'}, ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}. Always framed waist up.`;
        }).join('\n\n')}\n\n${'═'.repeat(40)}\n\n`
      : '';

    const promptsText = scenes.map(scene => scene.visualPrompt).join('\n\n');
    const fullText = charSheets + promptsText;

    navigator.clipboard.writeText(fullText);
    toast.success(`📋 DarkPlanner v3: ${characters.length} personagens + ${scenes.length} prompts copiados!`);
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">🚀 Exportar Prompts</span>
        <Badge className="bg-primary/20 text-primary text-[10px]">{scenes.length} cenas</Badge>
        <Badge className="bg-accent/20 text-accent text-[10px]">DarkPlanner v3</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button className="gap-2 h-10 text-xs gradient-hero border-0" onClick={exportToAutoflow}>
          <Copy className="w-3.5 h-3.5" /> AutoFlow ({scenes.length})
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={exportDarkPlannerFormat}>
          <Download className="w-3.5 h-3.5" /> DarkPlanner v3
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        AutoFlow: [V1-S#] image ||| video • DarkPlanner: personagens + prompts separados
      </p>
    </div>
  );
};
