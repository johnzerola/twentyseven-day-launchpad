import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import type { SyncedScene } from './types';

interface SceneViewerProps {
  scenes: SyncedScene[];
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const SceneViewer = ({ scenes }: SceneViewerProps) => {
  if (scenes.length === 0) return null;

  return (
    <div className="space-y-2 max-h-[800px] overflow-y-auto pr-1">
      {scenes.map((scene, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
          className="border border-border rounded-lg p-3 hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-mono">
                {formatTime(scene.startTime)} - {formatTime(scene.endTime)}
              </Badge>
              <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Cena {scene.sceneIndex + 1}</Badge>
              {scene.sceneDurationSeconds && (
                <Badge variant="outline" className="text-[9px]">⏱ {scene.sceneDurationSeconds}s</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px]">📷 {scene.cameraAngle}</Badge>
              <Badge variant="outline" className="text-[9px]">🎭 {scene.mood}</Badge>
            </div>
          </div>
          {scene.narrativeSummary && <p className="text-[10px] text-accent italic mb-1.5">🎯 {scene.narrativeSummary}</p>}
          {scene.narrativeText && <p className="text-[10px] text-muted-foreground mb-1.5 border-l-2 border-primary/30 pl-2">"{scene.narrativeText}"</p>}
          <p className="text-xs text-foreground leading-relaxed">{scene.visualPrompt}</p>
          {scene.charactersInScene && scene.charactersInScene.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {scene.charactersInScene.map((c, ci) => (
                <Badge key={ci} variant="secondary" className="text-[9px]">👤 {c}</Badge>
              ))}
            </div>
          )}
          {scene.transitionNote && <p className="text-[10px] text-muted-foreground mt-1 italic">↗ {scene.transitionNote}</p>}
        </motion.div>
      ))}
    </div>
  );
};
