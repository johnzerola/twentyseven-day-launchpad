import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Film, Edit3, Check, X, Clock, Camera, Palette, ChevronLeft, ChevronRight, Grid3X3, List, Maximize2 } from 'lucide-react';
import type { SyncedScene } from './types';

interface TimelineSyncLabProps {
  scenes: SyncedScene[];
  onUpdateScene?: (index: number, updates: Partial<SyncedScene>) => void;
}

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const MOOD_COLORS: Record<string, string> = {
  'tensão': 'border-destructive/50',
  'mistério': 'border-chart-3/50',
  'revelação': 'border-primary/50',
  'épico': 'border-chart-4/50',
  'calmo': 'border-chart-2/50',
  'urgência': 'border-destructive/60',
};

export const TimelineSyncLab = ({ scenes, onUpdateScene }: TimelineSyncLabProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<SyncedScene>>({});
  const [selectedScene, setSelectedScene] = useState<number | null>(null);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft({
      visualPrompt: scenes[index].visualPrompt,
      cameraAngle: scenes[index].cameraAngle,
      mood: scenes[index].mood,
      lightingSetup: scenes[index].lightingSetup || '',
      negativePrompt: scenes[index].negativePrompt || '',
    });
  };

  const saveEdit = () => {
    if (editingIndex !== null && onUpdateScene) {
      onUpdateScene(editingIndex, editDraft);
    }
    setEditingIndex(null);
    setEditDraft({});
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft({});
  };

  const totalDuration = scenes.length > 0 ? scenes[scenes.length - 1].endTime : 0;

  if (scenes.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Sync Lab</span>
          <Badge variant="outline" className="text-[10px]">{scenes.length} cenas</Badge>
          <Badge variant="outline" className="text-[10px]">⏱ {formatTime(totalDuration)}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2"
            onClick={() => setViewMode('grid')}>
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button variant={viewMode === 'timeline' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2"
            onClick={() => setViewMode('timeline')}>
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline ruler */}
      <div className="relative h-8 bg-muted/30 rounded-lg border border-border overflow-hidden">
        {scenes.map((scene, i) => {
          const left = totalDuration > 0 ? (scene.startTime / totalDuration) * 100 : 0;
          const width = totalDuration > 0 ? ((scene.endTime - scene.startTime) / totalDuration) * 100 : 0;
          const moodColor = Object.entries(MOOD_COLORS).find(([k]) => scene.mood?.toLowerCase().includes(k))?.[1] || 'border-primary/30';
          return (
            <button key={i}
              onClick={() => setSelectedScene(selectedScene === i ? null : i)}
              className={`absolute top-0.5 bottom-0.5 rounded transition-all text-[8px] font-mono flex items-center justify-center border-2
                ${selectedScene === i ? 'bg-primary/30 border-primary z-10 ring-1 ring-primary/50' : `bg-muted/60 ${moodColor} hover:bg-muted`}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}>
              {width > 4 && <span className="truncate px-0.5">S{i + 1}</span>}
            </button>
          );
        })}
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto pr-1">
          {scenes.map((scene, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`border rounded-lg overflow-hidden transition-all cursor-pointer group
                ${selectedScene === i ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/30'}`}
              onClick={() => setSelectedScene(selectedScene === i ? null : i)}>
              
              {/* 16:9 thumbnail area */}
              <div className="aspect-video bg-muted/20 relative flex items-center justify-center">
                <div className="text-center px-2">
                  <Film className="w-6 h-6 mx-auto text-muted-foreground/30 mb-1" />
                  <p className="text-[8px] text-muted-foreground/50 line-clamp-2">{scene.visualPrompt.slice(0, 60)}...</p>
                </div>
                {/* Duration badge overlay */}
                <Badge className="absolute top-1.5 left-1.5 text-[8px] bg-background/80 text-foreground border-border">
                  {scene.sceneDurationSeconds || Math.round(scene.endTime - scene.startTime)}s
                </Badge>
                <Badge className="absolute top-1.5 right-1.5 text-[8px] bg-primary/20 text-primary border-primary/20">
                  S{i + 1}
                </Badge>
                {/* Edit button overlay */}
                {onUpdateScene && (
                  <Button variant="ghost" size="sm"
                    className="absolute bottom-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 bg-background/60"
                    onClick={(e) => { e.stopPropagation(); startEdit(i); }}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Scene info */}
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[8px]">📷 {scene.cameraAngle}</Badge>
                  <Badge variant="outline" className="text-[8px]">🎭 {scene.mood}</Badge>
                </div>
                {scene.narrativeText && (
                  <p className="text-[9px] text-muted-foreground line-clamp-2 italic">"{scene.narrativeText}"</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Timeline list view */}
      {viewMode === 'timeline' && (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {scenes.map((scene, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`flex gap-3 border rounded-lg p-2.5 transition-all cursor-pointer
                ${selectedScene === i ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'}`}
              onClick={() => setSelectedScene(selectedScene === i ? null : i)}>
              
              {/* Mini 16:9 thumbnail */}
              <div className="w-28 aspect-video bg-muted/20 rounded flex-shrink-0 flex items-center justify-center relative">
                <Film className="w-4 h-4 text-muted-foreground/30" />
                <Badge className="absolute bottom-0.5 right-0.5 text-[7px] bg-background/80">
                  {scene.sceneDurationSeconds || Math.round(scene.endTime - scene.startTime)}s
                </Badge>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className="text-[9px] bg-primary/10 text-primary">Cena {i + 1}</Badge>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {formatTime(scene.startTime)} → {formatTime(scene.endTime)}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">📷 {scene.cameraAngle}</Badge>
                  <Badge variant="outline" className="text-[9px]">🎭 {scene.mood}</Badge>
                </div>
                <p className="text-[10px] text-foreground line-clamp-2">{scene.visualPrompt}</p>
                {scene.narrativeText && (
                  <p className="text-[9px] text-muted-foreground mt-0.5 italic line-clamp-1">"{scene.narrativeText}"</p>
                )}
              </div>

              {/* Edit */}
              {onUpdateScene && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0 self-center"
                  onClick={(e) => { e.stopPropagation(); startEdit(i); }}>
                  <Edit3 className="w-3 h-3" />
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail panel for selected scene */}
      {selectedScene !== null && scenes[selectedScene] && editingIndex !== selectedScene && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <Maximize2 className="w-4 h-4 text-primary" />
              Cena {selectedScene + 1} — Detalhe
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2" disabled={selectedScene === 0}
                onClick={() => setSelectedScene(selectedScene - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2" disabled={selectedScene === scenes.length - 1}
                onClick={() => setSelectedScene(selectedScene + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo</span>
              <p className="font-mono">{formatTime(scenes[selectedScene].startTime)} → {formatTime(scenes[selectedScene].endTime)} ({scenes[selectedScene].sceneDurationSeconds || Math.round(scenes[selectedScene].endTime - scenes[selectedScene].startTime)}s)</p>
            </div>
            <div>
              <span className="text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" /> Câmera</span>
              <p>{scenes[selectedScene].cameraAngle}</p>
            </div>
            <div>
              <span className="text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Mood</span>
              <p>{scenes[selectedScene].mood}</p>
            </div>
            {scenes[selectedScene].lensSpec && (
              <div>
                <span className="text-muted-foreground">🔍 Lente</span>
                <p>{scenes[selectedScene].lensSpec}</p>
              </div>
            )}
          </div>
          {scenes[selectedScene].narrativeSummary && (
            <div>
              <span className="text-[10px] text-muted-foreground">🎯 Resumo narrativo</span>
              <p className="text-xs italic text-accent">{scenes[selectedScene].narrativeSummary}</p>
            </div>
          )}
          <div>
            <span className="text-[10px] text-muted-foreground">📝 Prompt Visual (Veo 3)</span>
            <p className="text-xs bg-background rounded p-2 border border-border mt-1 leading-relaxed">{scenes[selectedScene].visualPrompt}</p>
          </div>
          {scenes[selectedScene].lightingSetup && (
            <div>
              <span className="text-[10px] text-muted-foreground">💡 Iluminação</span>
              <p className="text-xs">{scenes[selectedScene].lightingSetup}</p>
            </div>
          )}
          {scenes[selectedScene].colorGrading && (
            <div>
              <span className="text-[10px] text-muted-foreground">🎨 Color Grading</span>
              <p className="text-xs">{scenes[selectedScene].colorGrading}</p>
            </div>
          )}
          {scenes[selectedScene].negativePrompt && (
            <div>
              <span className="text-[10px] text-muted-foreground">🚫 Negative Prompt</span>
              <p className="text-xs text-destructive/70">{scenes[selectedScene].negativePrompt}</p>
            </div>
          )}
          {scenes[selectedScene].environmentDetails && (
            <div>
              <span className="text-[10px] text-muted-foreground">🏔️ Ambiente</span>
              <p className="text-xs">{scenes[selectedScene].environmentDetails}</p>
            </div>
          )}
          {scenes[selectedScene].charactersInScene && scenes[selectedScene].charactersInScene!.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground font-semibold">👥 Personagens na Cena</span>
              {scenes[selectedScene].charactersInScene!.map((c, ci) => {
                const detail = typeof c === 'object' ? c : null;
                if (detail) {
                  return (
                    <div key={ci} className="bg-muted/20 rounded-md p-2 space-y-0.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">👤 {detail.name}</span>
                        {detail.expression && <Badge variant="outline" className="text-[8px]">😶 {detail.expression}</Badge>}
                      </div>
                      {detail.visualDescription && <p className="text-[9px] text-muted-foreground">🎨 {detail.visualDescription}</p>}
                      {detail.action && <p className="text-[9px] text-muted-foreground">🎬 {detail.action}</p>}
                    </div>
                  );
                }
                return <Badge key={ci} variant="secondary" className="text-[9px]">👤 {String(c)}</Badge>;
              })}
            </div>
          )}
          {onUpdateScene && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEdit(selectedScene)}>
              <Edit3 className="w-3 h-3 mr-1" /> Editar Prompt
            </Button>
          )}
        </motion.div>
      )}

      {/* Edit modal inline */}
      {editingIndex !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="border-2 border-primary rounded-lg p-4 bg-background space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">✏️ Editando Cena {editingIndex + 1}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7" onClick={cancelEdit}><X className="w-3.5 h-3.5" /></Button>
              <Button size="sm" className="h-7" onClick={saveEdit}><Check className="w-3.5 h-3.5 mr-1" /> Salvar</Button>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Prompt Visual</label>
            <Textarea value={editDraft.visualPrompt || ''} rows={4}
              onChange={(e) => setEditDraft(d => ({ ...d, visualPrompt: e.target.value }))}
              className="text-xs mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground">Câmera</label>
              <Input value={editDraft.cameraAngle || ''} className="text-xs h-8 mt-1"
                onChange={(e) => setEditDraft(d => ({ ...d, cameraAngle: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Mood</label>
              <Input value={editDraft.mood || ''} className="text-xs h-8 mt-1"
                onChange={(e) => setEditDraft(d => ({ ...d, mood: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground">Iluminação</label>
              <Input value={editDraft.lightingSetup || ''} className="text-xs h-8 mt-1"
                onChange={(e) => setEditDraft(d => ({ ...d, lightingSetup: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Negative Prompt</label>
              <Input value={editDraft.negativePrompt || ''} className="text-xs h-8 mt-1"
                onChange={(e) => setEditDraft(d => ({ ...d, negativePrompt: e.target.value }))} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
