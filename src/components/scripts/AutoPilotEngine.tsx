import { useState, useCallback, useRef, useEffect } from 'react';
import { Rocket, Check, Loader2, AlertCircle, X, Brain } from 'lucide-react';
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
  voiceStyle?: string;
  onScriptGenerated: (script: string) => void;
  onAudioGenerated: (blob: Blob, url: string) => void;
  onScenesGenerated: (scenes: any[]) => void;
  onTitlesGenerated: () => void;
  onStepChange: (step: PipelineStep) => void;
  onTopicChange?: (topic: string) => void;
  onNicheChange?: (niche: string) => void;
  onDurationChange?: (duration: string) => void;
  onReady?: (launch: () => void) => void;
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TTS_URL = `${SUPABASE_URL}/functions/v1/google-tts`;

// ── SSE Script Generator (supports long-form multi-act) ──
async function generateScriptSSE(
  body: Record<string, any>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${SUPABASE_URL}/functions/v1/generate-script`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ANON_KEY;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`generate-script ${res.status}: ${errText.slice(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') || '';

  // If JSON response (short scripts), handle directly
  if (contentType.includes('application/json')) {
    const data = await res.json();
    const script = data?.script || data?.fullScript || '';
    if (script) onChunk(script);
    return script;
  }

  // SSE streaming for long scripts
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx: number;
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') break;
      try {
        const parsed = JSON.parse(payload);
        const content = parsed.choices?.[0]?.delta?.content
          || parsed.choices?.[0]?.text
          || parsed.text
          || '';
        if (content) {
          accumulated += content;
          onChunk(content);
        }
        // Handle full script in SSE JSON
        if (parsed.script || parsed.fullScript) {
          const full = parsed.script || parsed.fullScript;
          accumulated = full;
          onChunk(full);
        }
      } catch { /* partial JSON, ignore */ }
    }
  }

  return accumulated;
}

// ── Clean narration text for TTS ──
function getCleanNarration(script: string): string {
  let clean = script;
  const markers = ['## Títulos', '## TÍTULOS', '## Tags', '## SEO', '## Thumbnail', '---EXTRAS---', 'SCENE_BLUEPRINT'];
  for (const m of markers) {
    const idx = clean.indexOf(m);
    if (idx > 0) clean = clean.slice(0, idx);
  }
  return clean
    .replace(/^#+\s.*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[.*?\]/g, '')
    .replace(/---+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const AutoPilotEngine = ({
  topic, niche, duration, style, language, videoType, videoStyle, voiceStyle: voiceStyleProp,
  onScriptGenerated, onAudioGenerated, onScenesGenerated, onTitlesGenerated, onStepChange,
  onTopicChange, onNicheChange, onDurationChange, onReady,
  disabled,
}: AutoPilotEngineProps) => {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AutoPilotStep[]>(INITIAL_STEPS);
  const [showPanel, setShowPanel] = useState(false);
  const [loadingAutoTopic, setLoadingAutoTopic] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runPipelineRef = useRef<(() => void) | null>(null);

  const updateStep = (key: string, update: Partial<AutoPilotStep>) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, ...update } : s));
  };

  // ── Auto-select trending topic based on user's niche ──
  const autoSelectTopic = useCallback(async (): Promise<{ topic: string; niche: string } | null> => {
    setLoadingAutoTopic(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Faça login primeiro'); return null; }

      // 1. Get user's niche from onboarding or channels
      let userNiche = niche;
      if (!userNiche) {
        const { data: profile } = await supabase
          .from('onboarding_plans')
          .select('niche')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        userNiche = profile?.niche || 'curiosidades';
      }

      // 2. Try emerging_videos for trending topics
      const { data: emerging } = await supabase
        .from('emerging_videos')
        .select('title, niche, views, velocity_score')
        .order('velocity_score', { ascending: false })
        .limit(10);

      if (emerging?.length) {
        // Pick niche-relevant or top trending
        const nicheMatch = emerging.find(v => v.niche?.toLowerCase().includes(userNiche.toLowerCase()));
        const pick = nicheMatch || emerging[0];
        const autoTopic = `[TENDÊNCIA] ${pick.title} (${(pick.views || 0).toLocaleString()} views, velocidade: ${pick.velocity_score})`;
        return { topic: autoTopic, niche: userNiche };
      }

      // 3. Fallback: call suggest-themes
      const { data: themes } = await supabase.functions.invoke('suggest-themes', {
        body: { niche: userNiche, language, count: 3 },
      });
      if (themes?.themes?.length) {
        const best = themes.themes[0];
        return { topic: best.topic || best.title, niche: userNiche };
      }

      // 4. Last resort
      return { topic: `Top tendências ${userNiche} 2026`, niche: userNiche };
    } catch (err: any) {
      console.error('Auto-topic failed:', err);
      toast.error('Erro ao buscar tema automaticamente');
      return null;
    } finally {
      setLoadingAutoTopic(false);
    }
  }, [niche, language]);

  // ── Run the full pipeline ──
  const runPipeline = useCallback(async (autoTopic?: { topic: string; niche: string }) => {
    const useTopic = autoTopic?.topic || topic;
    const useNiche = autoTopic?.niche || niche;

    if (!useTopic.trim() || !useNiche.trim()) {
      toast.error('Preencha o tópico e nicho antes de usar o Piloto Automático');
      return;
    }

    // If auto-topic, update parent state
    if (autoTopic) {
      onTopicChange?.(autoTopic.topic);
      onNicheChange?.(autoTopic.niche);
    }

    setRunning(true);
    setShowPanel(true);
    const controller = new AbortController();
    abortRef.current = controller;
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'pending' as const })));

    let generatedScript = '';

    // Step 1: Generate Script (SSE streaming for long-form)
    updateStep('script', { status: 'running' });
    try {
      generatedScript = await generateScriptSSE(
        {
          topic: useTopic, duration, style, niche: useNiche, language,
          videoType, emotionalIntensity: 'maxima',
          voiceStyle: voiceStyleProp || 'dopaminergico',
        },
        () => {},
        controller.signal,
      );
      if (!generatedScript || generatedScript.length < 100) throw new Error('Script too short');
      onScriptGenerated(generatedScript);
      updateStep('script', { status: 'done' });
      onStepChange('script');
    } catch (err: any) {
      if (err.name === 'AbortError') { setRunning(false); return; }
      updateStep('script', { status: 'error', error: err.message });
      toast.error('Erro no roteiro — continue manualmente');
      setRunning(false);
      return;
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // Step 2: Generate Voice (TTS with fallback)
    let audioDurationSeconds = 0;
    updateStep('voice', { status: 'running' });
    try {
      const cleanText = getCleanNarration(generatedScript);
      if (cleanText.length < 50) throw new Error('Script too short for TTS');

      const MAX_CHUNK = 2000;
      const chunks: string[] = [];
      if (cleanText.length <= MAX_CHUNK) {
        chunks.push(cleanText);
      } else {
        const sentences = cleanText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleanText];
        let current = '';
        for (const s of sentences) {
          if (current.length + s.length > MAX_CHUNK && current.length > 0) {
            chunks.push(current.trim());
            current = '';
          }
          current += s;
        }
        if (current.trim()) chunks.push(current.trim());
      }

      const blobs: Blob[] = [];
      let browserFallbackUsed = false;
      // audioDurationSeconds declared above try block
      for (const chunk of chunks) {
        if (controller.signal.aborted) break;
        const response = await fetch(TTS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            text: chunk, language, voiceStyle: voiceStyleProp || 'dopaminergico',
            speakingRate: 1.0, returnBinary: true,
          }),
          signal: controller.signal,
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
          } else if (data.use_browser_synthesis) {
            // Browser fallback — estimate duration from word count (150 WPM)
            const wordCount = cleanText.split(/\s+/).length;
            audioDurationSeconds = Math.round((wordCount / 150) * 60);
            console.warn('TTS: browser synthesis fallback, estimated duration:', audioDurationSeconds, 's');
            browserFallbackUsed = true;
            updateStep('voice', { status: 'done', error: 'Usando síntese do navegador (engines cloud indisponíveis)' });
            onStepChange('voice');
            break;
          }
        }
      }

      if (blobs.length > 0) {
        const finalBlob = new Blob(blobs, { type: blobs[0].type || 'audio/mpeg' });
        const url = URL.createObjectURL(finalBlob);
        onAudioGenerated(finalBlob, url);
        // Calculate real audio duration
        try {
          const audioCtx = new AudioContext();
          const arrayBuf = await finalBlob.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuf);
          audioDurationSeconds = Math.round(decoded.duration);
          audioCtx.close();
        } catch {
          // Fallback: estimate from word count
          const wordCount = cleanText.split(/\s+/).length;
          audioDurationSeconds = Math.round((wordCount / 150) * 60);
        }
        console.log('Audio duration:', audioDurationSeconds, 's');
        updateStep('voice', { status: 'done' });
        onStepChange('voice');
      } else if (!browserFallbackUsed) {
        throw new Error('No audio generated');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') { setRunning(false); return; }
      // Estimate duration from script word count as fallback
      if (audioDurationSeconds === 0) {
        const wordCount = generatedScript.split(/\s+/).length;
        audioDurationSeconds = Math.round((wordCount / 150) * 60);
      }
      updateStep('voice', { status: 'error', error: err.message });
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // Step 3: Generate Scenes
    updateStep('scenes', { status: 'running' });
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const scenesResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-synced-prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ script: generatedScript, videoStyle, characters: [], language, niche: useNiche, audioDurationSeconds: audioDurationSeconds || undefined }),
        signal: controller.signal,
      });
      if (!scenesResp.ok) {
        const errBody = await scenesResp.text().catch(() => '');
        throw new Error(`Scenes ${scenesResp.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await scenesResp.json();
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

    if (controller.signal.aborted) { setRunning(false); return; }

    // Step 4: Titles & SEO
    updateStep('titles', { status: 'running' });
    try {
      const { error } = await supabase.functions.invoke('generate-titles', {
        body: { topic: useTopic, niche: useNiche, language, script: generatedScript.slice(0, 3000) },
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
        body: { video_title: useTopic, niche: useNiche, script_context: generatedScript.slice(0, 2000) },
      });
      if (error) throw error;
      updateStep('thumbnail', { status: 'done' });
    } catch (err: any) {
      updateStep('thumbnail', { status: 'error', error: err.message });
    }

    // Step 6: Affiliate
    updateStep('affiliate', { status: 'done' });

    onStepChange('titles');
    setRunning(false);

    // Count completed
    setSteps(prev => {
      const doneCount = prev.filter(s => s.status === 'done').length;
      toast.success(`🚀 Piloto Automático concluído! ${doneCount}/6 etapas completas.`);
      return prev;
    });
  }, [topic, niche, duration, style, language, videoType, videoStyle, voiceStyleProp, onScriptGenerated, onAudioGenerated, onScenesGenerated, onTitlesGenerated, onStepChange, onTopicChange, onNicheChange]);

  // Expose runPipeline to parent via onReady callback
  useEffect(() => {
    runPipelineRef.current = () => runPipeline();
    onReady?.(() => runPipeline());
  }, [runPipeline, onReady]);

  const handleAutoGenerate = useCallback(async () => {
    const result = await autoSelectTopic();
    if (result) {
      await runPipeline(result);
    }
  }, [autoSelectTopic, runPipeline]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const progressPercent = running
    ? (steps.filter(s => s.status === 'done' || s.status === 'error' || s.status === 'skipped').length / steps.length) * 100
    : 0;

  return (
    <div className="space-y-3">
      {/* Buttons Row */}
      <div className="flex flex-wrap gap-2">
        <Button
          id="autopilot-launch-btn"
          onClick={() => runPipeline()}
          disabled={disabled || running || !topic.trim() || !niche.trim()}
          size="lg"
          className="gap-2 bg-gradient-to-r from-primary to-chart-4 hover:from-primary/90 hover:to-chart-4/90 text-primary-foreground shadow-lg shadow-primary/20"
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

        <Button
          onClick={handleAutoGenerate}
          disabled={disabled || running || loadingAutoTopic}
          size="lg"
          variant="outline"
          className="gap-2 border-chart-2/30 hover:bg-chart-2/10"
        >
          {loadingAutoTopic ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando tema...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 text-chart-2" />
              🧠 Gerar Próximo Vídeo
            </>
          )}
        </Button>
      </div>

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
                    <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs text-destructive h-7">
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
