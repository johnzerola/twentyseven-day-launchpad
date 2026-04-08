import { useState, useCallback, useRef } from 'react';
import { Rocket, Check, Loader2, AlertCircle, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import type { PipelineStep } from './PipelineStepper';

interface AutoPilotStep {
  key: string;
  label: string;
  emoji: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  error?: string;
}

interface AutoPilotEngineProps {
  topic: string;
  niche: string;
  duration: string;
  style: string;
  language: string;
  videoType: 'long' | 'short';
  videoStyle: string;
  onScriptGenerated: (script: string) => void;
  onAudioGenerated: (blob: Blob, url: string) => void;
  onScenesGenerated: (scenes: any[]) => void;
  onTitlesGenerated: () => void;
  onStepChange: (step: PipelineStep) => void;
  disabled?: boolean;
}

const INITIAL_STEPS: AutoPilotStep[] = [
  { key: 'script', label: 'Roteiro Dopaminérgico', emoji: '📝', status: 'pending' },
  { key: 'voice', label: 'Narração Emocional', emoji: '🎙️', status: 'pending' },
  { key: 'scenes', label: 'Cenas Visuais', emoji: '🎬', status: 'pending' },
  { key: 'titles', label: 'Títulos & SEO', emoji: '🏷️', status: 'pending' },
  { key: 'thumbnail', label: 'Thumbnail', emoji: '🖼️', status: 'pending' },
  { key: 'affiliate', label: 'Links de Afiliado', emoji: '💰', status: 'pending' },
];

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`;

export const AutoPilotEngine = ({
  topic, niche, duration, style, language, videoType, videoStyle,
  onScriptGenerated, onAudioGenerated, onScenesGenerated, onTitlesGenerated, onStepChange,
  disabled,
}: AutoPilotEngineProps) => {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AutoPilotStep[]>(INITIAL_STEPS);
  const [showPanel, setShowPanel] = useState(false);
  const abortRef = useRef(false);

  const updateStep = (key: string, update: Partial<AutoPilotStep>) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, ...update } : s));
  };

  const getCleanNarration = (script: string): string => {
    let clean = script;
    const markers = ['## Títulos', '## TÍTULOS', '## Tags', '## SEO', '## Thumbnail', '---EXTRAS---', 'SCENE_BLUEPRINT'];
    for (const m of markers) { const idx = clean.indexOf(m); if (idx > 0) clean = clean.slice(0, idx); }
    return clean
      .replace(/^#+\s.*$/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[.*?\]/g, '')
      .replace(/---+/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const runPipeline = useCallback(async () => {
    if (!topic.trim() || !niche.trim()) {
      toast.error('Preencha o tópico e nicho antes de usar o Piloto Automático');
      return;
    }

    setRunning(true);
    setShowPanel(true);
    abortRef.current = false;
    setSteps(INITIAL_STEPS);

    let generatedScript = '';

    // Step 1: Generate Script
    updateStep('script', { status: 'running' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: { topic, duration, style, niche, language, videoType, emotionalIntensity: 'maxima' },
      });
      if (error) throw error;
      generatedScript = data?.script || data?.fullScript || '';
      if (!generatedScript) throw new Error('No script returned');
      onScriptGenerated(generatedScript);
      updateStep('script', { status: 'done' });
      onStepChange('script');
    } catch (err: any) {
      updateStep('script', { status: 'error', error: err.message });
      toast.error('Erro no roteiro — continue manualmente');
      setRunning(false);
      return; // Script is required for everything else
    }

    if (abortRef.current) { setRunning(false); return; }

    // Step 2: Generate Voice
    updateStep('voice', { status: 'running' });
    try {
      const cleanText = getCleanNarration(generatedScript);
      if (cleanText.length < 50) throw new Error('Script too short for TTS');
      
      // Split into chunks for long scripts
      const MAX_CHUNK = 2000;
      const chunks: string[] = [];
      if (cleanText.length <= MAX_CHUNK) {
        chunks.push(cleanText);
      } else {
        const sentences = cleanText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleanText];
        let current = '';
        for (const s of sentences) {
          if (current.length + s.length > MAX_CHUNK && current.length > 0) { chunks.push(current.trim()); current = ''; }
          current += s;
        }
        if (current.trim()) chunks.push(current.trim());
      }

      const blobs: Blob[] = [];
      for (const chunk of chunks) {
        if (abortRef.current) break;
        const response = await fetch(TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: chunk, language, voiceStyle: 'dopaminergico',
            speakingRate: 1.0, returnBinary: true,
          }),
        });
        if (!response.ok) throw new Error(`TTS ${response.status}`);
        const ct = response.headers.get('content-type') || '';
        if (ct.startsWith('audio/')) {
          blobs.push(await response.blob());
        } else {
          const data = await response.json();
          if (data.audioBase64) {
            const r = await fetch(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
            blobs.push(await r.blob());
          }
        }
      }

      if (blobs.length > 0) {
        const finalBlob = new Blob(blobs, { type: blobs[0].type || 'audio/mpeg' });
        const url = URL.createObjectURL(finalBlob);
        onAudioGenerated(finalBlob, url);
        updateStep('voice', { status: 'done' });
        onStepChange('voice');
      } else {
        throw new Error('No audio generated');
      }
    } catch (err: any) {
      updateStep('voice', { status: 'error', error: err.message });
    }

    if (abortRef.current) { setRunning(false); return; }

    // Step 3: Generate Scenes
    updateStep('scenes', { status: 'running' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-synced-prompts', {
        body: {
          script: generatedScript,
          videoStyle,
          characters: [],
          language,
          niche,
        },
      });
      if (error) throw error;
      const scenes = data?.scenes || data?.syncedScenes || [];
      if (scenes.length > 0) {
        onScenesGenerated(scenes);
        updateStep('scenes', { status: 'done' });
        onStepChange('prompts');
      } else {
        updateStep('scenes', { status: 'skipped', error: 'Nenhuma cena gerada' });
      }
    } catch (err: any) {
      updateStep('scenes', { status: 'error', error: err.message });
    }

    if (abortRef.current) { setRunning(false); return; }

    // Step 4: Generate Titles
    updateStep('titles', { status: 'running' });
    try {
      const { error } = await supabase.functions.invoke('generate-titles', {
        body: { topic, niche, language, script: generatedScript.slice(0, 3000) },
      });
      if (error) throw error;
      onTitlesGenerated();
      updateStep('titles', { status: 'done' });
    } catch (err: any) {
      updateStep('titles', { status: 'error', error: err.message });
    }

    // Step 5: Thumbnail
    updateStep('thumbnail', { status: 'running' });
    try {
      const { error } = await supabase.functions.invoke('generate-thumbnail-prompt', {
        body: { title: topic, niche, script: generatedScript.slice(0, 2000) },
      });
      if (error) throw error;
      updateStep('thumbnail', { status: 'done' });
    } catch (err: any) {
      updateStep('thumbnail', { status: 'error', error: err.message });
    }

    // Step 6: Affiliate (always done — it's hardcoded data)
    updateStep('affiliate', { status: 'done' });

    onStepChange('titles');
    setRunning(false);
    
    const doneCount = steps.filter(s => s.status === 'done').length;
    toast.success(`🚀 Piloto Automático concluído! ${doneCount + 1}/6 etapas completas.`);
  }, [topic, niche, duration, style, language, videoType, videoStyle, onScriptGenerated, onAudioGenerated, onScenesGenerated, onTitlesGenerated, onStepChange]);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const progressPercent = running ? (steps.filter(s => s.status === 'done' || s.status === 'error' || s.status === 'skipped').length / steps.length) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Trigger Button */}
      <Button
        onClick={runPipeline}
        disabled={disabled || running || !topic.trim() || !niche.trim()}
        size="lg"
        className="gap-2 bg-gradient-to-r from-primary to-chart-4 hover:from-primary/90 hover:to-chart-4/90 text-primary-foreground shadow-lg shadow-primary/20 w-full sm:w-auto"
      >
        {running ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Piloto Automático Rodando...
          </>
        ) : (
          <>
            <Rocket className="w-4 h-4" />
            🚀 Gerar Tudo Automaticamente
          </>
        )}
      </Button>

      {/* Progress Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">Piloto Automático</h3>
                  {completedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {completedCount}/{steps.length} concluídos
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {errorCount} erro(s)
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {running && (
                    <Button variant="ghost" size="sm" onClick={() => { abortRef.current = true; }} className="text-xs text-destructive h-7">
                      <X className="w-3 h-3 mr-1" /> Cancelar
                    </Button>
                  )}
                  {!running && (
                    <Button variant="ghost" size="sm" onClick={() => setShowPanel(false)} className="text-xs h-7">
                      Fechar
                    </Button>
                  )}
                </div>
              </div>

              {running && <Progress value={progressPercent} className="h-2" />}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {steps.map((step) => (
                  <div
                    key={step.key}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                      step.status === 'running' ? 'border-primary bg-primary/5 shadow-sm' :
                      step.status === 'done' ? 'border-chart-2 bg-chart-2/5' :
                      step.status === 'error' ? 'border-destructive bg-destructive/5' :
                      step.status === 'skipped' ? 'border-muted bg-muted/20' :
                      'border-border'
                    }`}
                  >
                    <div className="text-xl">
                      {step.status === 'running' ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> :
                       step.status === 'done' ? <Check className="w-5 h-5 text-chart-2" /> :
                       step.status === 'error' ? <AlertCircle className="w-5 h-5 text-destructive" /> :
                       <span>{step.emoji}</span>}
                    </div>
                    <span className="text-[10px] font-medium text-center leading-tight">{step.label}</span>
                    {step.status === 'error' && step.error && (
                      <span className="text-[9px] text-destructive text-center line-clamp-2">{step.error}</span>
                    )}
                  </div>
                ))}
              </div>

              {!running && completedCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  ✅ Pipeline completo! Navegue pelas abas para revisar cada etapa.
                  {errorCount > 0 && ` ${errorCount} etapa(s) falharam — complete manualmente.`}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
