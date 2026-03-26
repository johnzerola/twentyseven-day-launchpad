import { useState } from 'react';
import { Copy, Download, BookmarkPlus, Loader2, Layers } from 'lucide-react';
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

// Extract visual DNA from scenes for storyboard coherence
function extractVisualDNA(scenes: SyncedScene[]): {
  dominantLighting: string;
  dominantMood: string;
  dominantLens: string;
  dominantColorGrading: string;
  dominantCamera: string;
} {
  const counts = (arr: (string | undefined)[]) => {
    const map: Record<string, number> = {};
    arr.filter(Boolean).forEach(v => { map[v!] = (map[v!] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };

  return {
    dominantLighting: counts(scenes.map(s => s.lightingSetup)),
    dominantMood: counts(scenes.map(s => s.mood)),
    dominantLens: counts(scenes.map(s => s.lensSpec)),
    dominantColorGrading: counts(scenes.map(s => s.colorGrading)),
    dominantCamera: counts(scenes.map(s => s.cameraAngle)),
  };
}

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

  // NEW: Storyboard Coherence Mode — propagates visual DNA across all scenes
  const exportStoryboardCoherent = () => {
    const dna = extractVisualDNA(scenes);
    
    const coherenceHeader = `═══ VISUAL COHERENCE DIRECTIVE ═══
GLOBAL STYLE (apply to ALL scenes for visual consistency):
• Lighting: ${dna.dominantLighting || 'dramatic chiaroscuro'}
• Color Grading: ${dna.dominantColorGrading || 'desaturated with selective warm tones'}
• Default Lens: ${dna.dominantLens || '35mm f/2.8'}
• Default Camera: ${dna.dominantCamera || 'eye-level medium shot'}
• Mood Baseline: ${dna.dominantMood || 'tense atmospheric'}
• Aspect Ratio: 16:9 cinematic
• ANTI-TEXT: No watermarks, no logos, no on-screen text, no subtitles
• CONSISTENCY RULE: Every scene must feel like the SAME cinematographer shot it. Deviations from the global style must be INTENTIONAL and MOTIVATED by narrative (e.g., flashback = cooler tones, climax = tighter lens).
${'═'.repeat(40)}`;

    const charSheets = characters.length > 0
      ? `\n═══ CHARACTER IDENTITY SHEETS ═══\n\n${characters.map(c => {
          const a: Record<string, string> = (c.appearance || {}) as any;
          const f: Record<string, string> = (c.facial_features || {}) as any;
          const cl: Record<string, string> = (c.clothing || {}) as any;
          return `[${c.name}]: ${c.gender} approximately ${c.age} years old, ${a.body_type || 'average'} build. Skin: ${a.skin_color || 'medium'} tone with natural pores. Hair: ${a.hair_color || 'dark'} ${a.hair_style || 'short'}. Eyes: ${a.eye_color || 'brown'} with ${f.eyebrows || 'natural'} eyebrows. Face: ${f.face_shape || 'oval'}, ${f.nose || 'straight'} nose. Clothing: ${cl.shirt || 'casual top'}, ${cl.pants || 'jeans'}, ${cl.shoes || 'sneakers'}${cl.accessories && cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}. Always framed waist up.`;
        }).join('\n\n')}\n\n${'═'.repeat(40)}\n\n`
      : '\n';

    const coherentPrompts = scenes.map((scene, idx) => {
      const lighting = scene.lightingSetup || dna.dominantLighting || 'dramatic chiaroscuro';
      const colorGrading = scene.colorGrading || dna.dominantColorGrading || 'desaturated warm';
      const lens = scene.lensSpec || dna.dominantLens || '35mm f/2.8';
      const camera = scene.cameraAngle || dna.dominantCamera || 'medium shot';
      
      // Check if scene deviates from global DNA
      const deviations: string[] = [];
      if (scene.lightingSetup && scene.lightingSetup !== dna.dominantLighting) deviations.push(`lighting shift: ${scene.lightingSetup}`);
      if (scene.colorGrading && scene.colorGrading !== dna.dominantColorGrading) deviations.push(`color shift: ${scene.colorGrading}`);
      
      const deviationNote = deviations.length > 0 
        ? `\n[INTENTIONAL DEVIATION: ${deviations.join(', ')} — narrative-motivated]` 
        : '';

      return `[SCENE ${idx + 1}/${scenes.length}] [${lens}, ${camera}, ${lighting}, ${colorGrading}]${deviationNote}\n${scene.visualPrompt}`;
    }).join('\n\n');

    const fullText = coherenceHeader + charSheets + coherentPrompts;
    navigator.clipboard.writeText(fullText);
    toast.success(`🎬 Storyboard Coerente: ${scenes.length} cenas com DNA visual unificado!`);
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
          <Copy className="w-3.5 h-3.5" /> AutoFlow
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={exportDarkPlannerFormat}>
          <Download className="w-3.5 h-3.5" /> DarkPlanner
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={exportStoryboardCoherent}>
          <Layers className="w-3.5 h-3.5" /> Storyboard Coerente
        </Button>
        <Button variant="outline" className="gap-2 h-10 text-xs border-accent/30 text-accent hover:bg-accent/10" onClick={saveToLibrary} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
          Biblioteca
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        AutoFlow: [V1-S#] image ||| video • DarkPlanner: personagens + prompts • Storyboard: DNA visual unificado • Biblioteca: salvar
      </p>
    </div>
  );
};
