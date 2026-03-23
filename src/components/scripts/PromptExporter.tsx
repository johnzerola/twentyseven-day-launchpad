import { useState } from 'react';
import { Copy, Download, BookmarkPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  const [saving, setSaving] = useState(false);

  if (scenes.length === 0) return null;

  const saveToLibrary = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Faça login para salvar'); return; }

      const rows = scenes.map(scene => {
        const words = scene.visualPrompt.split(/\s+/).length;
        // Quality score: word count (150-250 ideal), has camera move, has mood
        let quality = 0;
        if (words >= 120 && words <= 280) quality += 40;
        else if (words >= 80) quality += 20;
        if (scene.cameraAngle || scene.cameraMove) quality += 20;
        if (scene.mood) quality += 15;
        if (scene.lightingSetup) quality += 15;
        if (scene.negativePrompt) quality += 10;
        quality = Math.min(100, quality);

        return {
          user_id: user.id,
          prompt_text: scene.visualPrompt,
          style: scene.mood || null,
          tags: [videoStyle, topic.slice(0, 50)].filter(Boolean),
          scene_type: scene.charactersInScene?.length ? 'character' : 'environment',
          word_count: words,
          quality_score: quality,
          video_style: videoStyle,
        };
      });

      const { error } = await supabase.from('prompt_library').insert(rows as any);
      if (error) throw error;
      toast.success(`📚 ${rows.length} prompts salvos na biblioteca!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

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

      <div className="grid grid-cols-3 gap-2">
        <Button className="gap-2 h-10 text-xs gradient-hero border-0" onClick={exportToAutoflow}>
          <Copy className="w-3.5 h-3.5" /> AutoFlow
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={exportDarkPlannerFormat}>
          <Download className="w-3.5 h-3.5" /> DarkPlanner
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-accent/30 text-accent hover:bg-accent/10" onClick={saveToLibrary} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
          Biblioteca
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        AutoFlow: [V1-S#] image ||| video • DarkPlanner: personagens + prompts separados • Biblioteca: salva para reutilizar
      </p>
    </div>
  );
};
