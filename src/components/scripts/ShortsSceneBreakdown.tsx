import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Smartphone, Camera, Palette, Zap, Edit3, Check, X, RotateCcw, Sparkles, Loader2, RefreshCw, Shield, Brain, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SyncedScene } from './types';

interface ShortsSceneBreakdownProps {
  script: string;
  durationSeconds: number;
  videoStyle: string;
  characters: any[];
  customStyleNotes?: string;
  enableASMR?: boolean;
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

const BEAT_EMOJI: Record<string, string> = {
  'hook': '🎣',
  'curiosity': '🧠',
  'reveal': '💡',
  'twist': '🔄',
  'loop': '♾️',
  'tense': '😰',
  'exciting': '⚡',
  'mysterious': '🔮',
  'funny': '😂',
  'shocking': '😱',
  'calm': '😌',
};

export const ShortsSceneBreakdown = ({
  script, durationSeconds, videoStyle, characters, customStyleNotes, enableASMR, onScenesGenerated
}: ShortsSceneBreakdownProps) => {
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [previewScene, setPreviewScene] = useState<number | null>(null);
  const [scorecard, setScorecard] = useState<{ hook: number; retention: number; loop: number; pacing: number; total: number } | null>(null);
  const [scoring, setScoring] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);

  const generateScenes = async () => {
    if (!script.trim()) { toast.error('Gere o roteiro primeiro'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scenes-short', {
        body: { script, durationSeconds, videoStyle, characters, customStyleNotes, enableASMR: enableASMR || false },
      });
      if (error) throw error;
      if (data?.scenes) {
        setScenes(data.scenes);
        toast.success(`📱 ${data.scenes.length} cenas verticais geradas!`);

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

  // ═══ Score Short Script ═══
  const scoreShort = async () => {
    if (!script.trim()) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('score-script', {
        body: { script, videoType: 'short', duration: durationSeconds },
      });
      if (error) throw error;
      const scores = data?.scorecard || data;
      setScorecard({
        hook: scores.hook || scores.hook_strength || 7,
        retention: scores.retention || scores.retention_prediction || 7,
        loop: scores.loop_potential || scores.payoff || 7,
        pacing: scores.flow || scores.pacing || 7,
        total: scores.total || Math.round(((scores.hook || 7) + (scores.retention || 7) + (scores.payoff || 7) + (scores.flow || 7)) / 4),
      });
      toast.success('Short scored!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao pontuar');
    } finally { setScoring(false); }
  };

  // ═══ TTS Preview for Short ═══
  const generateTTS = async () => {
    if (!script.trim()) return;
    setTtsLoading(true);
    try {
      const cleanScript = script.replace(/^#+\s.*/gm, '').replace(/\*\*.*?\*\*/g, '').replace(/[*_#>`~]/g, '').trim();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: cleanScript.slice(0, 1000), voiceId: 'onwK4e9ZLuTAKqWW03F9' }),
      });
      if (!resp.ok) throw new Error('TTS failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setTtsAudioUrl(url);
      toast.success('Narração gerada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro TTS');
    } finally { setTtsLoading(false); }
  };

  const lastSceneIndex = scenes.length - 1;
  const loopScene = scenes.length > 0 ? scenes[lastSceneIndex] : null;
  const hookScene = scenes.length > 0 ? scenes[0] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Cenas do Short (9:16)</h3>
          {scenes.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {scenes.length} cenas • {durationSeconds}s
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={generateScenes} disabled={loading || !script.trim()} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {scenes.length > 0 ? 'Regenerar' : 'Gerar Cenas'}
          </Button>
          <Button size="sm" variant="outline" onClick={scoreShort} disabled={scoring || !script.trim()} className="gap-1">
            {scoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
            <span className="hidden sm:inline">Score</span>
          </Button>
          <Button size="sm" variant="outline" onClick={generateTTS} disabled={ttsLoading || !script.trim()} className="gap-1">
            {ttsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
            <span className="hidden sm:inline">TTS</span>
          </Button>
        </div>
      </div>

      {/* Scorecard */}
      {scorecard && (
        <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-primary" /> Score do Short
            </span>
            <Badge className={`text-xs ${scorecard.total >= 8 ? 'bg-chart-2/20 text-chart-2' : scorecard.total >= 6 ? 'bg-chart-4/20 text-chart-4' : 'bg-destructive/20 text-destructive'}`}>
              {scorecard.total}/10
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '🎣 Hook (0-2s)', value: scorecard.hook },
              { label: '📈 Retenção', value: scorecard.retention },
              { label: '♾️ Loop', value: scorecard.loop },
              { label: '⚡ Pacing', value: scorecard.pacing },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] font-bold">{item.value}/10</span>
                </div>
                <Progress value={item.value * 10} className="h-1" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TTS Audio Player */}
      {ttsAudioUrl && (
        <div className="bg-muted/30 border border-border rounded-xl p-3">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Preview de Narração
          </p>
          <audio controls src={ttsAudioUrl} className="w-full h-8" />
        </div>
      )}

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

      {/* Content area with preview + scene list */}
      {scenes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* ═══ 9:16 Vertical Preview ═══ */}
          <div className="md:col-span-1 flex flex-col items-center gap-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preview 9:16</p>
            <div
              className="relative rounded-2xl border-2 border-border bg-card overflow-hidden shadow-xl"
              style={{ width: 180, height: 320 }}
            >
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-background rounded-b-xl z-10" />

              {/* Scene content */}
              {(() => {
                const idx = previewScene ?? 0;
                const scene = scenes[idx];
                if (!scene) return null;
                const beat = scene.emotionalBeat || scene.mood || 'neutral';
                const moodClass = MOOD_COLORS[beat] || 'bg-muted/30';

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`absolute inset-0 flex flex-col justify-between p-3 pt-6 ${moodClass.split(' ')[0]}`}
                  >
                    {/* Top badges */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[8px] font-mono bg-background/60 backdrop-blur-sm">
                        {scene.startTime || 0}s–{scene.endTime || 0}s
                      </Badge>
                      <Badge className="text-[8px] bg-background/60 backdrop-blur-sm text-foreground">
                        {BEAT_EMOJI[beat] || '🎬'} {beat}
                      </Badge>
                    </div>

                    {/* Visual description */}
                    <div className="flex-1 flex items-center justify-center px-1">
                      <p className="text-[9px] text-center leading-relaxed text-foreground/90 line-clamp-6">
                        {scene.visualPrompt}
                      </p>
                    </div>

                    {/* Camera + narrative */}
                    <div className="space-y-1">
                      {scene.narrativeText && (
                        <p className="text-[8px] italic text-muted-foreground text-center line-clamp-2 bg-background/40 rounded px-1 py-0.5">
                          "{scene.narrativeText}"
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-1">
                        <Camera className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground">{scene.cameraAngle}</span>
                      </div>
                    </div>

                    {/* Loop indicator on last scene */}
                    {idx === lastSceneIndex && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-accent/90 text-accent-foreground px-2 py-0.5 rounded-full"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span className="text-[7px] font-bold">LOOP → Cena 1</span>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })()}
            </div>

            {/* Scene selector dots */}
            <div className="flex items-center gap-1 flex-wrap justify-center max-w-[200px]">
              {scenes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewScene(i)}
                  className={`w-5 h-5 rounded-full text-[8px] font-bold transition-all ${
                    (previewScene ?? 0) === i
                      ? 'bg-primary text-primary-foreground scale-110'
                      : i === 0
                        ? 'bg-destructive/30 text-destructive hover:bg-destructive/50'
                        : i === lastSceneIndex
                          ? 'bg-accent/30 text-accent-foreground hover:bg-accent/50'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Loop Point Indicator */}
            {loopScene && hookScene && (
              <div className="w-full max-w-[200px] rounded-xl border border-accent/30 bg-accent/5 p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-accent" />
                  <span className="text-[10px] font-semibold text-accent-foreground">Loop Point</span>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  A última cena deve conectar visualmente ao gancho inicial para rewatch automático.
                </p>
                <div className="flex items-center gap-1 text-[8px]">
                  <Badge variant="outline" className="text-[7px]">🎣 Hook</Badge>
                  <span className="text-muted-foreground">↔</span>
                  <Badge variant="outline" className="text-[7px]">♾️ Loop</Badge>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Scene Cards + Timeline ═══ */}
          <div className="md:col-span-2 space-y-3">
            {/* Mini timeline bar */}
            <div className="flex gap-0.5 rounded-lg overflow-hidden h-3">
              {scenes.map((s, i) => {
                const width = ((s.sceneDurationSeconds || 8) / durationSeconds) * 100;
                const beat = s.emotionalBeat || s.mood || 'neutral';
                const colorClass = MOOD_COLORS[beat] || 'bg-muted';
                const isLoop = i === lastSceneIndex;
                const isHook = i === 0;
                return (
                  <button
                    key={i}
                    onClick={() => setPreviewScene(i)}
                    className={`h-full relative transition-all hover:opacity-80 ${colorClass.split(' ')[0]} ${
                      (previewScene ?? 0) === i ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                    }`}
                    style={{ width: `${width}%` }}
                    title={`Cena ${i + 1}: ${beat} (${s.sceneDurationSeconds || 8}s)${isLoop ? ' ♾️ LOOP' : ''}${isHook ? ' 🎣 HOOK' : ''}`}
                  >
                    {isHook && <span className="absolute inset-0 flex items-center justify-center text-[7px]">🎣</span>}
                    {isLoop && <span className="absolute inset-0 flex items-center justify-center text-[7px]">♾️</span>}
                  </button>
                );
              })}
            </div>

            {/* Scene cards */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {scenes.map((scene, i) => {
                const beat = scene.emotionalBeat || scene.mood || 'neutral';
                const moodClass = MOOD_COLORS[beat] || 'bg-muted/30 text-muted-foreground border-border';
                const isEditing = editingIndex === i;
                const isLoop = i === lastSceneIndex;
                const isHook = i === 0;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`border rounded-xl p-3 space-y-2 cursor-pointer transition-all ${moodClass} ${
                      (previewScene ?? 0) === i ? 'ring-2 ring-primary/50' : ''
                    }`}
                    onClick={() => setPreviewScene(i)}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {scene.startTime || 0}s → {scene.endTime || 0}s
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {BEAT_EMOJI[beat] || '🎬'} {beat.toUpperCase()}
                        </Badge>
                        {isHook && <Badge className="text-[10px] bg-destructive/80">🎣 HOOK</Badge>}
                        {isLoop && (
                          <Badge className="text-[10px] bg-accent/80 text-accent-foreground gap-1">
                            <RotateCcw className="w-2.5 h-2.5" /> LOOP
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{scene.sceneDurationSeconds || 8}s</span>
                        {isEditing ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }}>
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEdit(i); }}>
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
                        onClick={e => e.stopPropagation()}
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

                    {/* Loop arrow connector */}
                    {isLoop && (
                      <div className="flex items-center gap-2 pt-1 border-t border-dashed border-accent/30 mt-1">
                        <RotateCcw className="w-3 h-3 text-accent" />
                        <span className="text-[10px] text-accent-foreground/80">
                          Esta cena conecta ao gancho inicial → rewatch automático
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
