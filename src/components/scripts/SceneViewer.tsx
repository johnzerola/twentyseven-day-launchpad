import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import type { SyncedScene, SceneCharacter } from './types';

interface SceneViewerProps {
  scenes: SyncedScene[];
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function getCharacterName(c: string | SceneCharacter): string {
  return typeof c === 'string' ? c : c.name;
}

function getCharacterDetail(c: string | SceneCharacter): SceneCharacter | null {
  return typeof c === 'object' ? c : null;
}

export const SceneViewer = ({ scenes }: SceneViewerProps) => {
  if (scenes.length === 0) return null;

  return (
    <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
      {scenes.map((scene, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
          className="border border-border rounded-lg p-4 hover:border-primary/20 transition-all bg-card/50">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className="text-[9px] bg-primary/15 text-primary border-primary/20 font-bold">
                Cena {scene.sceneIndex}
              </Badge>
              <Badge variant="outline" className="text-[9px] font-mono">
                {formatTime(scene.startTime)} → {formatTime(scene.endTime)}
              </Badge>
              {scene.sceneDurationSeconds && (
                <Badge variant="outline" className="text-[9px]">⏱ {scene.sceneDurationSeconds}s</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9px]">📷 {scene.cameraAngle}</Badge>
              {scene.lensSpec && <Badge variant="outline" className="text-[9px]">🔭 {scene.lensSpec}</Badge>}
              <Badge variant="outline" className="text-[9px]">🎭 {scene.mood}</Badge>
            </div>
          </div>

          {/* Narrative */}
          {scene.narrativeSummary && (
            <p className="text-[10px] text-accent font-medium italic mb-1.5">🎯 {scene.narrativeSummary}</p>
          )}
          {scene.narrativeText && (
            <p className="text-[10px] text-muted-foreground mb-2 border-l-2 border-primary/30 pl-2 italic">"{scene.narrativeText}"</p>
          )}

          {/* Visual Prompt - Main content */}
          <div className="bg-muted/30 rounded-lg p-3 mb-2">
            <p className="text-[10px] font-semibold text-primary mb-1">🎬 Visual Prompt:</p>
            <p className="text-xs text-foreground leading-relaxed">{scene.visualPrompt}</p>
          </div>

          {/* Technical Details Row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {scene.lightingSetup && (
              <Badge variant="secondary" className="text-[9px]">💡 {scene.lightingSetup}</Badge>
            )}
            {scene.colorGrading && (
              <Badge variant="secondary" className="text-[9px]">🎨 {scene.colorGrading}</Badge>
            )}
            {scene.emotionalBeat && (
              <Badge variant="secondary" className="text-[9px]">❤️ {scene.emotionalBeat}</Badge>
            )}
            {scene.dopamineTrigger && (
              <Badge className="text-[9px] bg-accent/10 text-accent border-accent/20">⚡ {scene.dopamineTrigger}</Badge>
            )}
            {scene.cameraMove && (
              <Badge variant="secondary" className="text-[9px]">🎥 {scene.cameraMove}</Badge>
            )}
          </div>

          {/* Characters with full details */}
          {scene.charactersInScene && scene.charactersInScene.length > 0 && (
            <div className="border border-border/50 rounded-lg p-2.5 space-y-2">
              <p className="text-[10px] font-semibold text-foreground">👥 Personagens na Cena:</p>
              {scene.charactersInScene.map((c, ci) => {
                const detail = getCharacterDetail(c);
                if (detail) {
                  return (
                    <div key={ci} className="bg-muted/20 rounded-md p-2 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary">👤 {detail.name}</span>
                        {detail.expression && (
                          <Badge variant="outline" className="text-[8px]">😶 {detail.expression}</Badge>
                        )}
                      </div>
                      {detail.visualDescription && (
                        <p className="text-[9px] text-muted-foreground leading-relaxed">
                          🎨 <span className="text-foreground/80">{detail.visualDescription}</span>
                        </p>
                      )}
                      {detail.action && (
                        <p className="text-[9px] text-muted-foreground">
                          🎬 <span className="text-foreground/80">{detail.action}</span>
                        </p>
                      )}
                    </div>
                  );
                }
                return <Badge key={ci} variant="secondary" className="text-[9px]">👤 {getCharacterName(c)}</Badge>;
              })}
            </div>
          )}

          {/* Environment */}
          {scene.environmentDetails && (
            <p className="text-[9px] text-muted-foreground mt-2">🏔️ {scene.environmentDetails}</p>
          )}

          {/* Transition */}
          {scene.transitionNote && (
            <p className="text-[9px] text-muted-foreground mt-1 italic">↗ {scene.transitionNote}</p>
          )}

          {/* Negative prompt */}
          {scene.negativePrompt && (
            <p className="text-[8px] text-destructive/50 mt-1">🚫 {scene.negativePrompt}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
};
