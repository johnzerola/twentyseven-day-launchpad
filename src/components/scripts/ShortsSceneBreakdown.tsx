import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Smartphone, Camera, Palette, Zap, Edit3, Check, X, Play, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SyncedScene } from './types';

interface ShortsSceneBreakdownProps {
  script: string;
  durationSeconds: number;
  videoStyle: string;
  characters: any[];
  customStyleNotes?: string;
  onScenesGenerated?: (scenes: SyncedScene[]) => void;
}

const MOOD_COLORS: Record<string, string> = {
  'hook': 'bg-destructive/20 text-destructive border-destructive/30',
  'curiosity': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  'reveal': 'bg-primary/20 text-primary border-primary/30',
  'twist': 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  'loop': 'bg-accent/20 text-accent-foreground border-accent/30',
  'tense': 'bg-destructive/20 text-destructive border-destructive/30',
  'exciting': 'bg-chart-4/20 text-chart-4 border-chart-4/30',
  'mysterious': 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  'funny': 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  'shocking': 'bg-destructive/20 text-destructive border-destructive/30',
  'calm': 'bg-muted text-muted-foreground border-border',
};

export const ShortsSceneBreakdown = ({
  script, durationSeconds, videoStyle, characters, customStyleNotes, onScenesGenerated
}: ShortsSceneBreakdownProps) => {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const generateScenes = async () => {
    if (!script.trim()) { toast.error('Gere o roteiro primeiro'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scenes-short', {
        body: { script, durationSeconds, videoStyle, characters, customStyleNotes },
      });
      if (error) throw error;
      if (data?.scenes) {
        setScenes(data.scenes);
        toast.success(`📱 ${data.scenes.length} cenas verticais geradas!`);

        // Convert to SyncedScene format for parent
        if (onScenesGenerated) {
          const synced: SyncedScene[] = data.scenes.map((s: any, i: number) => ({
            sceneIndex: i,
            startTime: s.startTime || i * (durationSeconds / data.scenes.length),
            endTime: s.endTime || (i + 1) * (durationSeconds / data.scenes.length),
            sceneDurationSeconds: s.sceneDurationSeconds || durationSeconds / data.scenes.length,
            visualPrompt: s.visualPrompt || '',
            cameraAngle: s.cameraAngle || 'medium',
            mood: s.mood || 'neutral',
            narrativeText: s.narrativeText || '',
            emotionalBeat: s.emotionalBeat || '',
            transitionNote: s.transitionNote || '',
            negativePrompt: s.negativePrompt || '',
          }));
          onScenesGenerated(synced);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar cenas');
    } finally { setLoading(false); }
  };

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditDraft(scenes[i].visualPrompt);
  };
  const saveEdit = () => {
    if (editingIndex !== null) {
      const updated = [...scenes];
      updated[editingIndex] = { ...updated[editingIndex], visualPrompt: editDraft };
      setScenes(updated);
    }
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Cenas do Short (9:16)</h3>
          {scenes.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {scenes.length} cenas • {durationSeconds}s
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={generateScenes} disabled={loading || !script.trim()} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {scenes.length > 0 ? 'Regenerar' : 'Gerar Cenas'}
        </Button>
      </div>

      {scenes.length === 0 && !loading && (
        <div className="bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center">
          <Smartphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Clique em "Gerar Cenas" para criar blocos visuais de 8s verticais</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cada cena inclui: prompt visual, câmera, iluminação, VFX e som</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-primary animate-pulse p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando cenas verticais 9:16...
        </div>
      )}

      {/* Timeline visual */}
      {scenes.length > 0 && (
        <>
          {/* Mini timeline bar */}
          <div className="flex gap-0.5 rounded-lg overflow-hidden h-2">
            {scenes.map((s, i) => {
              const width = ((s.sceneDurationSeconds || 8) / durationSeconds) * 100;
              const beat = s.emotionalBeat || s.mood || 'neutral';
              const colorClass = MOOD_COLORS[beat] || 'bg-muted';
              return (
                <div
                  key={i}
                  className={`h-full ${colorClass.split(' ')[0]} transition-all cursor-pointer hover:opacity-80`}
                  style={{ width: `${width}%` }}
                  title={`Cena ${i + 1}: ${beat} (${s.sceneDurationSeconds || 8}s)`}
                />
              );
            })}
          </div>

          {/* Scene cards */}
          <div className="space-y-2">
            {scenes.map((scene, i) => {
              const beat = scene.emotionalBeat || scene.mood || 'neutral';
              const moodClass = MOOD_COLORS[beat] || 'bg-muted/30 text-muted-foreground border-border';
              const isEditing = editingIndex === i;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`border rounded-xl p-3 space-y-2 ${moodClass}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {scene.startTime || 0}s → {scene.endTime || 0}s
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {beat.toUpperCase()}
                      </Badge>
                      {i === 0 && <Badge className="text-[10px] bg-destructive/80">HOOK</Badge>}
                      {i === scenes.length - 1 && <Badge className="text-[10px] bg-primary/80">LOOP</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{scene.sceneDurationSeconds || 8}s</span>
                      {isEditing ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingIndex(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(i)}>
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Narrative text */}
                  {scene.narrativeText && (
                    <p className="text-xs italic text-muted-foreground leading-relaxed">
                      "{scene.narrativeText}"
                    </p>
                  )}

                  {/* Visual prompt */}
                  {isEditing ? (
                    <Textarea
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      className="text-xs min-h-[60px] bg-background/50"
                    />
                  ) : (
                    <p className="text-xs leading-relaxed">{scene.visualPrompt}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-1.5">
                    {scene.cameraAngle && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-background/30 rounded px-1.5 py-0.5">
                        <Camera className="w-2.5 h-2.5" /> {scene.cameraAngle}
                      </span>
                    )}
                    {scene.transitionNote && scene.transitionNote !== 'none' && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-background/30 rounded px-1.5 py-0.5">
                        <Zap className="w-2.5 h-2.5" /> {scene.transitionNote}
                      </span>
                    )}
                    {scene.mood && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-background/30 rounded px-1.5 py-0.5">
                        <Palette className="w-2.5 h-2.5" /> {scene.mood}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
