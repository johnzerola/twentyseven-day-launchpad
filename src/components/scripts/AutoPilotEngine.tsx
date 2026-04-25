import { useState, useCallback, useRef, useEffect } from 'react';
import { Rocket, Check, Loader2, AlertCircle, X, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { safeConcatAudioBlobs, measureAudioDuration, getMinDurationSeconds } from '@/lib/audio-concat';
import type { PipelineStep } from './PipelineStepper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

type ChannelOption = {
  id: string;
  channel_name: string | null;
  thumbnail: string | null;
};

function tomorrow6pmLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AutoPilotStep {
  key: string;
  label: string;
  emoji: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  error?: string;
  detail?: string;
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
  { key: 'refine', label: 'Refinamento IA', emoji: '✨', status: 'pending' },
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

  if (contentType.includes('application/json')) {
    const data = await res.json();
    const script = data?.script || data?.fullScript || '';
    if (script) onChunk(script);
    return script;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';
  let sseError: { error: string; message: string; code?: number } | null = null;

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
        
        // ★ Detect structured error events from backend
        if (parsed.error && typeof parsed.error === 'string') {
          sseError = { error: parsed.error, message: parsed.message || parsed.error, code: parsed.code };
          continue;
        }
        
        const content = parsed.choices?.[0]?.delta?.content
          || parsed.choices?.[0]?.text
          || parsed.text
          || '';
        if (content) {
          accumulated += content;
          onChunk(content);
        }
        if (parsed.script || parsed.fullScript) {
          const full = parsed.script || parsed.fullScript;
          accumulated = full;
          onChunk(full);
        }
      } catch { /* partial JSON, ignore */ }
    }
  }

  // ★ If backend sent a structured error, throw with specific message
  if (sseError) {
    const errorMessages: Record<string, string> = {
      'RATE_LIMITED': '⏳ Rate limit atingido. Aguarde alguns segundos e tente novamente.',
      'INSUFFICIENT_CREDITS': '💳 Créditos de IA esgotados. Recarregue seu saldo em "Top up" para continuar gerando.',
      'EMPTY_PROVIDER_STREAM': '🔌 O provedor de IA não retornou conteúdo. Tente novamente.',
    };
    throw new Error(errorMessages[sseError.error] || sseError.message || `Erro do provedor: ${sseError.error}`);
  }

  // ★ If stream completed but no content accumulated, it's an empty response
  if (!accumulated || accumulated.trim().length < 50) {
    throw new Error('🔌 O provedor de IA não retornou conteúdo. Tente novamente em alguns segundos.');
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
    .replace(/\[EMOÇÃO:[^\]]*\]/gi, '')
    .replace(/\[EDITOR:[^\]]*\]/gi, '')
    .replace(/\[SFX:[^\]]*\]/gi, '')
    .replace(/\[ÁUDIO:[^\]]*\]/gi, '')
    .replace(/\[VISUAL:[^\]]*\]/gi, '')
    .replace(/\[CENA:[^\]]*\]/gi, '')
    .replace(/\[CÂMERA:[^\]]*\]/gi, '')
    .replace(/\[TRILHA:[^\]]*\]/gi, '')
    .replace(/\[CORTAR MÚSICA[^\]]*\]/gi, '')
    .replace(/\[BPM[^\]]*\]/gi, '')
    .replace(/\[J-CUT[^\]]*\]/gi, '')
    .replace(/\[VFX[^\]]*\]/gi, '')
    .replace(/\[B-ROLL[^\]]*\]/gi, '')
    .replace(/\[.*?\]/g, '')
    .replace(/---+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split text at sentence boundaries into chunks ≤ maxLen */
function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Generate TTS for a single text chunk, returns a Blob */
async function generateTTSChunk(
  text: string,
  language: string,
  voiceStyle: string,
  signal?: AbortSignal,
): Promise<Blob | null> {
  // ★ Use user session token for TTS (not anon key)
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ANON_KEY;

  const response = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text, language, voiceStyle,
      speakingRate: 1.0, returnBinary: true,
    }),
    signal,
  });
  if (!response.ok) throw new Error(`TTS ${response.status}`);
  const ct = response.headers.get('content-type') || '';
  if (ct.startsWith('audio/')) {
    return response.blob();
  }
  const data = await response.json();
  if (data.audioBase64) {
    const r = await fetch(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
    return r.blob();
  }
  if (data.use_browser_synthesis) {
    return null; // Signal browser fallback
  }
  throw new Error('Unexpected TTS response');
}

/** Generate scenes using the chunked async pipeline */
async function generateScenesChunked(
  script: string,
  videoStyle: string,
  language: string,
  niche: string,
  audioDurationSeconds: number,
  signal?: AbortSignal,
): Promise<any[]> {
  const { data: startData, error: startError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
    body: {
      action: 'start',
      script,
      videoStyle,
      language,
      niche,
      audioDurationSeconds,
    },
  });

  if (startError) throw startError;
  if (startData?.error) throw new Error(startData.error);
  if (!startData?.job_id) throw new Error('Failed to start scene generation');

  const { job_id, totalChunks } = startData;
  const allScenes: any[] = [];

  for (let ci = 0; ci < totalChunks; ci++) {
    if (signal?.aborted) break;
    const { data: chunkData, error: chunkError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
      body: { action: 'generate_chunk', job_id, chunk_index: ci },
    });

    if (chunkError) { console.error(`Chunk ${ci} error:`, chunkError); continue; }
    if (chunkData?.error) { console.error(`Chunk ${ci}:`, chunkData.error); continue; }
    if (chunkData?.scenes) allScenes.push(...chunkData.scenes);

    toast.loading(`Gerando cenas... ${ci + 1}/${totalChunks}`, { id: 'autopilot-scenes' });
  }

  toast.dismiss('autopilot-scenes');

  if (allScenes.length === 0) throw new Error('No scenes generated');

  // Finalize
  const { data: finalData, error: finalError } = await supabase.functions.invoke('transcribe-and-generate-scenes', {
    body: { action: 'finalize', job_id, all_scenes: allScenes },
  });

  if (finalError) throw finalError;
  if (finalData?.error) throw new Error(finalData.error);

  return (Array.isArray(finalData?.scenes) ? finalData.scenes : [])
    .filter((scene: any) => scene && typeof scene.visualPrompt === 'string' && scene.visualPrompt.trim().length > 0)
    .map((scene: any, index: number) => ({
      ...scene,
      sceneIndex: typeof scene.sceneIndex === 'number' ? scene.sceneIndex : index + 1,
      startTime: Number(scene.startTime) || 0,
      endTime: Number(scene.endTime) || (Number(scene.startTime) || 0) + 6,
    }));
}

/** Generate scenes using direct single-request (only for short content ≤ 5min) */
async function generateScenesDirect(
  script: string,
  videoStyle: string,
  language: string,
  niche: string,
  audioDurationSeconds: number,
  signal?: AbortSignal,
): Promise<any[]> {
  // ★ Use user session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ANON_KEY;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-synced-prompts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ script, videoStyle, characters: [], language, niche, audioDurationSeconds }),
    signal,
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Scenes ${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.scenes || data?.syncedScenes || [];
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
  const runPipelineRef = useRef<(() => Promise<void>) | null>(null);

  // ── Launch modal: choose channel + scheduled date ──
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [scheduledLocal, setScheduledLocal] = useState<string>(tomorrow6pmLocal());
  const [confirmingLaunch, setConfirmingLaunch] = useState(false);
  const [launchPhase, setLaunchPhase] = useState<'idle' | 'pipeline' | 'saving' | 'done'>('idle');

  const openLaunchModal = useCallback(async () => {
    setShowLaunchModal(true);
    setLoadingChannels(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Faça login primeiro');
        setShowLaunchModal(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_channels')
        .select('id, channel_name, thumbnail')
        .eq('user_id', user.id)
        .order('linked_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as ChannelOption[];
      setChannels(list);
      if (list.length === 1) setSelectedChannelId(list[0].id);
      setScheduledLocal(tomorrow6pmLocal());
    } catch (err: any) {
      toast.error('Erro ao carregar canais: ' + err.message);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const handleConfirmLaunch = useCallback(async () => {
    if (!selectedChannelId) {
      toast.error('Selecione um canal');
      return;
    }
    if (!scheduledLocal) {
      toast.error('Defina a data de publicação');
      return;
    }
    const scheduledAt = new Date(scheduledLocal).toISOString();
    setConfirmingLaunch(true);
    setLaunchPhase('pipeline');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Login required');

      // Run the original pipeline (modal stays open showing progress)
      const launch = runPipelineRef.current;
      if (launch) await launch();

      setLaunchPhase('saving');

      // After pipeline completes, find the most recent project for this user
      const { data: project, error: projErr } = await supabase
        .from('video_projects')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (projErr) throw projErr;
      if (!project?.id) {
        toast.error('Não foi possível localizar o projeto recém-criado');
        return;
      }
      const projectId = project.id;

      // Atomic slot reservation — backend rejects if another project of the
      // same channel already occupies this slot (±30 min window).
      const { data: claimRes, error: claimErr } = await supabase.rpc(
        'claim_publish_slot' as any,
        {
          _user_id: user.id,
          _project_id: projectId,
          _channel_id: selectedChannelId,
          _scheduled_at: scheduledAt,
          _topic: topic || null,
          _slot_window_minutes: 30,
        } as any,
      );

      if (claimErr) throw claimErr;
      const claim = claimRes as any;
      if (!claim?.ok) {
        const reason = claim?.reason as string | undefined;
        const conflictAt = claim?.conflicting_scheduled_at
          ? new Date(claim.conflicting_scheduled_at).toLocaleString()
          : null;
        const conflictTitle = claim?.conflicting_title as string | undefined;

        let msg = 'Não foi possível reservar este slot.';
        if (reason === 'slot_conflict_project' || reason === 'slot_conflict_schedule') {
          msg =
            `⛔ Este canal já tem outro vídeo ${reason === 'slot_conflict_schedule' ? 'agendado' : 'em produção'}` +
            (conflictAt ? ` em ${conflictAt}` : '') +
            (conflictTitle ? ` ("${conflictTitle}")` : '') +
            `. Escolha outro horário (mín. ${claim?.window_minutes || 30} min de distância).`;
        } else if (reason === 'project_not_found') {
          msg = 'Projeto não encontrado.';
        } else if (reason === 'channel_not_found') {
          msg = 'Canal não encontrado.';
        } else if (reason === 'project_not_owned_by_user' || reason === 'channel_not_owned_by_user') {
          msg = 'Você não tem permissão sobre este projeto/canal.';
        } else if (reason) {
          msg = `Não foi possível reservar este slot (${reason}).`;
        }

        toast.error(msg, { duration: 8000 });
        setLaunchPhase('idle');
        // Reopen the form so the user can pick a different time
        setShowLaunchModal(true);
        return;
      }

      setLaunchPhase('done');
      toast.success('✅ Vídeo enviado para produção! O AutoPilot vai montar e postar automaticamente.');
      // Auto-close modal shortly after success
      setTimeout(() => {
        setShowLaunchModal(false);
        setLaunchPhase('idle');
      }, 1500);
    } catch (err: any) {
      console.error('Launch confirm failed:', err);
      toast.error('Falha ao enviar para produção: ' + (err.message || 'erro desconhecido'));
      setLaunchPhase('idle');
    } finally {
      setConfirmingLaunch(false);
    }
  }, [selectedChannelId, scheduledLocal, topic]);

  const updateStep = (key: string, update: Partial<AutoPilotStep>) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, ...update } : s));
  };

  // ── Auto-select trending topic ──
  const autoSelectTopic = useCallback(async (): Promise<{ topic: string; niche: string } | null> => {
    setLoadingAutoTopic(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Faça login primeiro'); return null; }

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

      const { data: emerging } = await supabase
        .from('emerging_videos')
        .select('title, niche, views, velocity_score')
        .order('velocity_score', { ascending: false })
        .limit(10);

      if (emerging?.length) {
        const nicheMatch = emerging.find(v => v.niche?.toLowerCase().includes(userNiche.toLowerCase()));
        const pick = nicheMatch || emerging[0];
        return { topic: `[TENDÊNCIA] ${pick.title} (${(pick.views || 0).toLocaleString()} views)`, niche: userNiche };
      }

      const { data: themes } = await supabase.functions.invoke('suggest-themes', {
        body: { niche: userNiche, language, count: 3 },
      });
      if (themes?.themes?.length) {
        return { topic: themes.themes[0].topic || themes.themes[0].title, niche: userNiche };
      }

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
    const requestedMinutes = parseInt(duration, 10) || 8;
    const minDurationSec = getMinDurationSeconds(duration);

    // ═══ STEP 1: Generate Script ═══
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
      
      const wordCount = getCleanNarration(generatedScript).split(/\s+/).length;
      const minWords = Math.floor(requestedMinutes * 150 * 0.85);
      
      onScriptGenerated(generatedScript);
      updateStep('script', { 
        status: 'done', 
        detail: `${wordCount} palavras (~${Math.round(wordCount / 150)}min)` 
      });
      onStepChange('script');
      
      console.log(`Script: ${wordCount} words, target: ${minWords} min words for ${requestedMinutes}min`);
    } catch (err: any) {
      if (err.name === 'AbortError') { setRunning(false); return; }
      updateStep('script', { status: 'error', error: err.message });
      toast.error('Erro no roteiro — continue manualmente');
      setRunning(false);
      return;
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // ═══ STEP 1.5: Refine Script (Claude) ═══
    updateStep('refine', { status: 'running', detail: 'Refinando hook + emoção...' });
    try {
      const { data: { session: refineSession } } = await supabase.auth.getSession();
      const refineToken = refineSession?.access_token || ANON_KEY;
      const refineUrl = `${SUPABASE_URL}/functions/v1/refine-script`;
      
      const refineRes = await fetch(refineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refineToken}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          draft_script: generatedScript,
          niche: useNiche,
          language,
          duration,
          style,
          target_words: generatedScript.split(/\s+/).length,
        }),
        signal: controller.signal,
      });

      if (refineRes.ok && refineRes.body) {
        const reader = refineRes.body.getReader();
        const decoder = new TextDecoder();
        let refined = '';
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nlIdx: number;
          while ((nlIdx = buf.indexOf('\n')) !== -1) {
            let line = buf.slice(0, nlIdx);
            buf = buf.slice(nlIdx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) refined += content;
            } catch { /* partial */ }
          }
        }

        if (refined && refined.length > generatedScript.length * 0.5) {
          generatedScript = refined;
          onScriptGenerated(generatedScript);
          const refinedWords = refined.split(/\s+/).length;
          updateStep('refine', { status: 'done', detail: `${refinedWords} palavras (Claude)` });
        } else {
          updateStep('refine', { status: 'done', detail: 'Mantido original' });
        }
      } else {
        console.warn('Refine-script returned non-OK, keeping original');
        updateStep('refine', { status: 'done', detail: 'Mantido original' });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') { setRunning(false); return; }
      console.warn('Refinement failed, keeping original:', err.message);
      updateStep('refine', { status: 'done', detail: 'Mantido original' });
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // ═══ STEP 2: Generate Voice (TTS) with duration validation ═══
    let audioDurationSeconds = 0;
    let finalAudioBlob: Blob | null = null;
    let browserFallbackUsed = false;

    updateStep('voice', { status: 'running' });
    try {
      let cleanText = getCleanNarration(generatedScript);
      if (cleanText.length < 50) throw new Error('Script too short for TTS');

      const voiceStyleToUse = voiceStyleProp || 'dopaminergico';
      
      // Generate TTS for the full script
      const generateFullAudio = async (text: string): Promise<{ blob: Blob | null; browserFallback: boolean }> => {
        const chunks = splitTextIntoChunks(text, 2000);
        const blobs: Blob[] = [];
        let fallback = false;

        for (let i = 0; i < chunks.length; i++) {
          if (controller.signal.aborted) break;
          
          toast.loading(`Gerando áudio... ${i + 1}/${chunks.length}`, { id: 'autopilot-tts' });
          
          const blob = await generateTTSChunk(chunks[i], language, voiceStyleToUse, controller.signal);
          if (blob === null) {
            // Browser fallback signal
            fallback = true;
            break;
          }
          blobs.push(blob);
        }
        
        toast.dismiss('autopilot-tts');

        if (blobs.length === 0) return { blob: null, browserFallback: fallback };

        // ★ Use safe concatenation (handles WAV headers properly)
        const concatenated = await safeConcatAudioBlobs(blobs);
        return { blob: concatenated, browserFallback: false };
      };

      const result = await generateFullAudio(cleanText);
      
      if (result.browserFallback) {
        browserFallbackUsed = true;
        const wordCount = cleanText.split(/\s+/).length;
        audioDurationSeconds = Math.round((wordCount / 150) * 60);
        console.warn('TTS: browser synthesis fallback, estimated duration:', audioDurationSeconds, 's');
        
        // ★ For longform (≥8min), browser fallback is NOT acceptable — mark as degraded
        if (requestedMinutes >= 8) {
          updateStep('voice', { 
            status: 'error', 
            error: `⚠️ TTS indisponível — áudio real necessário para ${requestedMinutes}min. Gere o áudio manualmente na aba "Voz".`
          });
          toast.error('TTS não disponível para longform. Use a geração manual de voz.');
        } else {
          updateStep('voice', { status: 'done', detail: `~${Math.round(audioDurationSeconds / 60)}min (estimado, navegador)` });
          onStepChange('voice');
        }
      } else if (result.blob) {
        finalAudioBlob = result.blob;
        
        // ★ Measure REAL audio duration
        const wordCount = cleanText.split(/\s+/).length;
        audioDurationSeconds = await measureAudioDuration(finalAudioBlob, wordCount);
        
        console.log(`Audio duration: ${audioDurationSeconds}s (target: ${requestedMinutes * 60}s, min: ${minDurationSec}s)`);
        
        // ★ Duration validation loop — if audio is too short, generate continuation
        let retryCount = 0;
        const MAX_RETRIES = 3;
        
        while (audioDurationSeconds < minDurationSec && retryCount < MAX_RETRIES && !controller.signal.aborted) {
          retryCount++;
          const missingSeconds = (requestedMinutes * 60) - audioDurationSeconds;
          const missingMinutes = Math.ceil(missingSeconds / 60);
          const missingWords = Math.ceil((missingSeconds / 60) * 150);
          
          console.log(`Audio too short by ${missingSeconds}s. Generating continuation #${retryCount} (~${missingWords} words)...`);
          updateStep('voice', { 
            status: 'running', 
            detail: `Áudio curto (${Math.round(audioDurationSeconds / 60)}min). Gerando continuação #${retryCount}...` 
          });
          
          // Generate continuation script
          let continuationScript = '';
          try {
            continuationScript = await generateScriptSSE(
              {
                topic: useTopic, 
                duration: String(missingMinutes),
                style, niche: useNiche, language,
                videoType, emotionalIntensity: 'maxima',
                voiceStyle: voiceStyleToUse,
                continuationOf: generatedScript.slice(-2000), // Last 2000 chars as context
                isContinuation: true,
              },
              () => {},
              controller.signal,
            );
          } catch (e: any) {
            console.error('Continuation script failed:', e);
            break;
          }
          
          if (!continuationScript || continuationScript.length < 50) break;
          
          // Append continuation to main script
          generatedScript += '\n\n' + continuationScript;
          onScriptGenerated(generatedScript);
          
          // Generate TTS for continuation only
          const contClean = getCleanNarration(continuationScript);
          const contResult = await generateFullAudio(contClean);
          
          if (!contResult.blob) break;
          
          // Concatenate new audio with existing
          finalAudioBlob = await safeConcatAudioBlobs([finalAudioBlob!, contResult.blob]);
          audioDurationSeconds = await measureAudioDuration(finalAudioBlob, 
            getCleanNarration(generatedScript).split(/\s+/).length);
          
          console.log(`After continuation #${retryCount}: ${audioDurationSeconds}s`);
        }
        
        // Deliver final audio
        const url = URL.createObjectURL(finalAudioBlob);
        onAudioGenerated(finalAudioBlob, url);
        
        const finalMinutes = (audioDurationSeconds / 60).toFixed(1);
        updateStep('voice', { 
          status: 'done', 
          detail: `${finalMinutes}min real` 
        });
        onStepChange('voice');
      } else {
        throw new Error('No audio generated');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') { setRunning(false); return; }
      if (audioDurationSeconds === 0) {
        const wordCount = generatedScript.split(/\s+/).length;
        audioDurationSeconds = Math.round((wordCount / 150) * 60);
      }
      updateStep('voice', { status: 'error', error: err.message });
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // ═══ STEP 3: Generate Scenes (chunked pipeline for longform) ═══
    updateStep('scenes', { status: 'running' });
    try {
      const isLongform = requestedMinutes >= 8 || audioDurationSeconds >= 300;
      let scenes: any[];
      
      if (isLongform) {
        // ★ Use chunked async pipeline for long-form (robust, no timeout)
        console.log(`Using chunked scene pipeline for ${audioDurationSeconds}s audio`);
        scenes = await generateScenesChunked(
          generatedScript, videoStyle, language, useNiche, 
          audioDurationSeconds, controller.signal,
        );
      } else {
        // Direct single-request for short content
        scenes = await generateScenesDirect(
          generatedScript, videoStyle, language, useNiche,
          audioDurationSeconds, controller.signal,
        );
      }
      
      if (scenes.length > 0) {
        onScenesGenerated(scenes);
        const expectedScenes = Math.ceil(audioDurationSeconds / 8);
        const coverage = Math.round((scenes.length / expectedScenes) * 100);
        updateStep('scenes', { 
          status: 'done', 
          detail: `${scenes.length} cenas (${coverage}% cobertura)` 
        });
        onStepChange('prompts');
      } else {
        updateStep('scenes', { status: 'skipped', error: 'Nenhuma cena gerada' });
      }
    } catch (err: any) {
      updateStep('scenes', { status: 'error', error: err.message });
    }

    if (controller.signal.aborted) { setRunning(false); return; }

    // ═══ STEP 4: Titles & SEO ═══
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

    // ═══ STEP 5: Thumbnail ═══
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

    // ═══ STEP 6: Affiliate ═══
    updateStep('affiliate', { status: 'done' });

    onStepChange('titles');
    setRunning(false);

    setSteps(prev => {
      const doneCount = prev.filter(s => s.status === 'done').length;
      toast.success(`🚀 Piloto Automático concluído! ${doneCount}/6 etapas completas.`);
      return prev;
    });
  }, [topic, niche, duration, style, language, videoType, videoStyle, voiceStyleProp, onScriptGenerated, onAudioGenerated, onScenesGenerated, onTitlesGenerated, onStepChange, onTopicChange, onNicheChange]);

  // ★ Register launch function AND auto-fire on first mount (wizard just configured)
  const hasAutoLaunched = useRef(false);
  useEffect(() => {
    runPipelineRef.current = () => runPipeline();
    const launchFn = () => runPipeline();
    onReady?.(launchFn);
    // Auto-launch on first mount (wizard was just configured)
    if (!hasAutoLaunched.current && topic.trim() && niche.trim()) {
      hasAutoLaunched.current = true;
      // Small delay to ensure state is settled
      const timer = setTimeout(() => launchFn(), 100);
      return () => clearTimeout(timer);
    }
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
          onClick={() => openLaunchModal()}
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
                    {step.detail && step.status === 'done' && (
                      <span className="text-[9px] text-chart-2 text-center">{step.detail}</span>
                    )}
                    {step.status === 'running' && step.detail && (
                      <span className="text-[9px] text-primary text-center line-clamp-2">{step.detail}</span>
                    )}
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

      {/* Launch modal — choose channel + scheduled date */}
      <Dialog open={showLaunchModal} onOpenChange={(o) => { if (!confirmingLaunch && launchPhase === 'idle') setShowLaunchModal(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-primary" /> Enviar para o AutoPilot
            </DialogTitle>
            <DialogDescription>
              Escolha o canal de destino e quando o vídeo deve ser publicado.
            </DialogDescription>
          </DialogHeader>

          {launchPhase !== 'idle' ? (
            <div className="space-y-3 py-2">
              {/* Pipeline live progress */}
              <div className="space-y-2">
                {steps.map((s) => {
                  const phaseLabel =
                    s.key === 'script' ? 'Gerando roteiro' :
                    s.key === 'refine' ? 'Refinando narrativa' :
                    s.key === 'voice' ? 'Gerando narração' :
                    s.key === 'scenes' ? 'Montando cenas visuais' :
                    s.key === 'titles' ? 'Otimizando títulos & SEO' :
                    s.key === 'thumbnail' ? 'Criando thumbnail' :
                    s.key === 'affiliate' ? 'Anexando links' :
                    s.label;
                  return (
                    <div
                      key={s.key}
                      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border transition-colors ${
                        s.status === 'running' ? 'border-primary bg-primary/5 text-foreground' :
                        s.status === 'done' ? 'border-chart-2/40 bg-chart-2/5 text-muted-foreground' :
                        s.status === 'error' ? 'border-destructive/40 bg-destructive/5 text-destructive' :
                        s.status === 'skipped' ? 'border-muted bg-muted/20 text-muted-foreground' :
                        'border-border text-muted-foreground/70'
                      }`}
                    >
                      <span className="w-4 flex justify-center">
                        {s.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> :
                         s.status === 'done' ? <Check className="w-3.5 h-3.5 text-chart-2" /> :
                         s.status === 'error' ? <AlertCircle className="w-3.5 h-3.5 text-destructive" /> :
                         <span className="text-[11px]">{s.emoji}</span>}
                      </span>
                      <span className="flex-1 truncate">
                        {phaseLabel}
                        {s.status === 'running' && '…'}
                      </span>
                      {s.detail && s.status !== 'pending' && (
                        <span className="text-[10px] opacity-70 truncate max-w-[40%]">{s.detail}</span>
                      )}
                    </div>
                  );
                })}

                {/* Saving phase */}
                <div
                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border transition-colors ${
                    launchPhase === 'saving' ? 'border-primary bg-primary/5 text-foreground' :
                    launchPhase === 'done' ? 'border-chart-2/40 bg-chart-2/5 text-muted-foreground' :
                    'border-border text-muted-foreground/70'
                  }`}
                >
                  <span className="w-4 flex justify-center">
                    {launchPhase === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> :
                     launchPhase === 'done' ? <Check className="w-3.5 h-3.5 text-chart-2" /> :
                     <span className="text-[11px]">📤</span>}
                  </span>
                  <span className="flex-1 truncate">
                    Enviando para o AutoPilot{launchPhase === 'saving' ? '…' : ''}
                  </span>
                </div>
              </div>

              {launchPhase === 'done' && (
                <p className="text-xs text-chart-2 text-center">
                  ✅ Tudo pronto! Fechando…
                </p>
              )}
            </div>
          ) : loadingChannels ? (
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando canais...
            </div>
          ) : channels.length === 0 ? (
            <div className="py-4 text-sm">
              <p className="text-muted-foreground mb-3">
                Você ainda não tem canais cadastrados.
              </p>
              <Link to="/channels" className="text-primary underline text-sm">
                Adicione um canal em /channels primeiro.
              </Link>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="channel-select">Canal</Label>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger id="channel-select">
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          {c.thumbnail ? (
                            <img
                              src={c.thumbnail}
                              alt={c.channel_name || 'canal'}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted" />
                          )}
                          <span className="truncate">{c.channel_name || 'Canal sem nome'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-input">Publicar em:</Label>
                <Input
                  id="schedule-input"
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {launchPhase === 'idle' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setShowLaunchModal(false)}
                  disabled={confirmingLaunch}
                >
                  Cancelar
                </Button>
                {channels.length > 0 && (
                  <Button
                    onClick={handleConfirmLaunch}
                    disabled={confirmingLaunch || !selectedChannelId || !scheduledLocal}
                    className="gap-2"
                  >
                    🚀 Enviar para Produção
                  </Button>
                )}
              </>
            )}
            {(launchPhase === 'pipeline' || launchPhase === 'saving') && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground w-full justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {launchPhase === 'pipeline' ? 'Gerando seu vídeo…' : 'Finalizando agendamento…'}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
