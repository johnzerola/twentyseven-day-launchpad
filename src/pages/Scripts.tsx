import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { FileText, History, Trash2, Flame, ChevronDown, ChevronUp, Target, BookOpen, Film, Users, Image, Check, Zap, Loader2, LayoutTemplate, Lightbulb, TrendingUp, ArrowRight, Sparkles, GitCompareArrows, Plus, Save, Palette, Upload, X } from 'lucide-react';
import { VIDEO_TYPES, VIDEO_TYPE_DEFAULTS, type VideoType } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { usePagination, PAGE_SIZE } from '@/hooks/use-pagination';
import { PaginationControls } from '@/components/PaginationControls';
import { VIRAL_HOOKS, VIRAL_CTAS, STORY_STRUCTURES } from '@/lib/viralDatabase';

// Refactored components
import { ScriptGenerator } from '@/components/scripts/ScriptGenerator';
import { CharacterManager } from '@/components/scripts/CharacterManager';
import { AudioProcessor } from '@/components/scripts/AudioProcessor';
import { TimelineSyncLab } from '@/components/scripts/TimelineSyncLab';
import { SceneViewer } from '@/components/scripts/SceneViewer';
import { PromptExporter } from '@/components/scripts/PromptExporter';
import { TitleSEOStep } from '@/components/scripts/TitleSEOStep';
import { PackagingLab } from '@/components/scripts/PackagingLab';
import { ShortsSceneBreakdown } from '@/components/scripts/ShortsSceneBreakdown';
import type { Character, SyncedScene, VideoStyleOption } from '@/components/scripts/types';
import { VoiceGeneratorStep } from '@/components/scripts/VoiceGeneratorStep';
import { ScriptComparator } from '@/components/scripts/ScriptComparator';
import { ViralThemeWizard } from '@/components/scripts/ViralThemeWizard';
import { ThumbnailGenerator } from '@/components/scripts/ThumbnailGenerator';
import { RetentionCurveAnalyzer } from '@/components/scripts/RetentionCurveAnalyzer';
import { ScriptPerformanceTracker } from '@/components/dashboard/ScriptPerformanceTracker';
import { PipelineStepper, type PipelineStep } from '@/components/scripts/PipelineStepper';
import { StepNavButtons } from '@/components/scripts/StepNavButtons';

const VIDEO_STYLES: VideoStyleOption[] = [
  { value: 'cinematográfico', label: '🎬 Cinematic Dark', desc: 'Iluminação dramática, sombras profundas, estilo Netflix Original' },
  { value: '2d', label: '🎨 Kurzgesagt Style', desc: 'Motion graphics 2D clean, cores vibrantes, flat design educativo' },
  { value: '3d', label: '🧊 Pixar World', desc: 'Render 3D estilizado, personagens cartoon, ambientes imersivos' },
  { value: 'anime', label: '⛩️ Anime Epic', desc: 'Anime japonês expressivo, cenas de ação dinâmicas, olhos grandes' },
  { value: 'wojak', label: '😐 Wojak/Meme Art', desc: 'Desenho meme, expressões emocionais exageradas, viral TikTok' },
  { value: 'stickmen', label: '🧍 Stickman Comedy', desc: 'Figuras palito animadas, humor pela simplicidade' },
  { value: 'realista', label: '📷 Hyper Real 8K', desc: 'Fotorrealismo extremo, iluminação natural cinematográfica' },
  { value: 'dark', label: '🌑 Cyberpunk Neon', desc: 'Neon azul/roxo, cidade futurista, atmosfera blade runner' },
  { value: 'whiteboard', label: '📝 Whiteboard Pro', desc: 'Quadro branco animado, estilo TED-Ed, educativo premium' },
  { value: 'comic', label: '💥 Comic Book', desc: 'Estilo Marvel/DC, painéis dinâmicos, onomatopeias' },
  { value: 'lego', label: '🧱 Lego World', desc: 'Tudo em LEGO, cenários blocados, estilo stop-motion' },
  { value: 'minecraft', label: '⛏️ Minecraft Style', desc: 'Mundo pixelado, blocos, estilo gameplay Minecraft' },
  { value: 'disney_toon', label: '✨ Disney Toon', desc: 'Animação clássica Disney, personagens carismáticos' },
  { value: 'documentary_bbc', label: '📹 Documentary BBC', desc: 'Cinematografia BBC/NatGeo, narração autoritária, natureza épica' },
  { value: 'gtav', label: '🏎️ GTA V Style', desc: 'Estética Grand Theft Auto, saturação alta, ação urbana' },
  { value: 'expressionism', label: '🎭 Expressionism', desc: 'Arte expressionista, cores ousadas, distorções dramáticas' },
  { value: 'animal_chase', label: '🐾 Animal Chase/Survival', desc: 'Hiper-realista National Geographic + Hollywood, 120fps slow-motion, close nos olhos dos animais' },
];

const Scripts = () => {
  const { t } = useLanguage();
  const [videoType, setVideoType] = useState<VideoType>('long');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('15');
  const [style, setStyle] = useState('dopaminérgico');
  const [niche, setNiche] = useState('');
  const [language, setLanguage] = useState('português');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [scorecard, setScorecard] = useState<{ hook: number; retention: number; emotion: number; flow: number; payoff: number } | null>(null);
  const scriptsPag = usePagination<any>();

  // Viral Database
  const [showViralPanel, setShowViralPanel] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);

  // Pipeline
  const [activeStep, setActiveStep] = useState<PipelineStep>('script');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const [videoStyle, setVideoStyle] = useState('cinematográfico');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [syncedScenes, setSyncedScenes] = useState<SyncedScene[]>([]);
  const [sceneBlueprintJson, setSceneBlueprintJson] = useState<any[]>([]);
  const [customStyleNotes, setCustomStyleNotes] = useState('');
  const [enableASMR, setEnableASMR] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [userChannels, setUserChannels] = useState<any[]>([]);
  const [channelStyles, setChannelStyles] = useState<any[]>([]);
  const [showCreateStyle, setShowCreateStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDesc, setNewStyleDesc] = useState('');
  const [newStyleNotes, setNewStyleNotes] = useState('');
  const [referenceImages, setReferenceImages] = useState<{ url: string; file?: File }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [channelVisualProfile, setChannelVisualProfile] = useState<string | null>(null);
  const [analyzingChannelStyle, setAnalyzingChannelStyle] = useState(false);
  // Intelligence
  const [intelligenceBriefing, setIntelligenceBriefing] = useState<any>(null);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [retentionPrediction, setRetentionPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Templates & Themes
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparator, setShowComparator] = useState(false);

  // v2.2: Read URL params from Tracker pipeline
  const [searchParams] = useSearchParams();

  // ─── Auto-Save wizard state to localStorage ───
  const AUTOSAVE_KEY = 'scripts_wizard_autosave';
  
  // Restore on mount (only if no URL params or session data override)
  useEffect(() => {
    const hasUrlParams = searchParams.get('niche') || searchParams.get('topic');
    const hasCloneData = sessionStorage.getItem('clone_full_data') || sessionStorage.getItem('clone_script_outline');
    if (hasUrlParams || hasCloneData) return; // Skip restore if pipeline data exists

    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.topic) setTopic(state.topic);
        if (state.niche) setNiche(state.niche);
        if (state.script) setScript(state.script);
        if (state.videoType) setVideoType(state.videoType);
        if (state.videoStyle) setVideoStyle(state.videoStyle);
        if (state.duration) setDuration(state.duration);
        if (state.language) setLanguage(state.language);
        if (state.activeStep) setActiveStep(state.activeStep);
        if (state.characters?.length) setCharacters(state.characters);
        if (state.syncedScenes?.length) setSyncedScenes(state.syncedScenes);
        if (state.customStyleNotes) setCustomStyleNotes(state.customStyleNotes);
        if (state.enableASMR) setEnableASMR(state.enableASMR);
        if (state.selectedChannelId) setSelectedChannelId(state.selectedChannelId);
        if (state.sceneBlueprintJson?.length) setSceneBlueprintJson(state.sceneBlueprintJson);
      }
    } catch {}
  }, []);

  // Save on change (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const state = {
          topic, niche, script, videoType, videoStyle, duration, language,
          activeStep, characters, syncedScenes, customStyleNotes,
          selectedChannelId, sceneBlueprintJson,
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
      } catch {}
    }, 1000);
    return () => clearTimeout(timeout);
  }, [topic, niche, script, videoType, videoStyle, duration, language, activeStep, characters, syncedScenes, customStyleNotes, selectedChannelId, sceneBlueprintJson]);

  useEffect(() => { loadHistory(); }, [scriptsPag.page]);

  useEffect(() => {
    loadTemplates();
    loadUserChannels();
    
    // Load from Tracker pipeline
    const trackerNiche = searchParams.get('niche');
    const trackerType = searchParams.get('type');
    const trackerTopic = searchParams.get('topic');
    if (trackerNiche) setNiche(trackerNiche);
    if (trackerType === 'short') setVideoType('short');
    if (trackerType === 'long') setVideoType('long');
    if (trackerTopic) { setTopic(trackerTopic); toast.success('Contexto do Tracker carregado!'); }
    
    const outlierTopic = sessionStorage.getItem('outlier_topic');
    if (outlierTopic) { setTopic(outlierTopic); sessionStorage.removeItem('outlier_topic'); toast.success('Referência do Outlier Finder carregada!'); }

    // Load from Dotti or Trend suggestion
    const dottiTopic = sessionStorage.getItem('dotti_script_topic');
    if (dottiTopic) {
      setTopic(dottiTopic);
      sessionStorage.removeItem('dotti_script_topic');
      setActiveStep('script');
      toast.success('💡 Tema do Dotti carregado! Configure e gere o roteiro.');
    }

    // Load from Outlier Replicate (full reverse engineering context)
    const replicateRaw = sessionStorage.getItem('replicate_video');
    if (replicateRaw) {
      try {
        const rep = JSON.parse(replicateRaw);
        sessionStorage.removeItem('replicate_video');
        const topicText = `[REPLICAR] ${rep.videoTitle} (${(rep.views || 0).toLocaleString()} views, ${rep.multiplier}x viral, canal: ${rep.channelName})`;
        setTopic(topicText);
        if (rep.niche) setNiche(rep.niche);
        if (rep.dna) {
          const parts: string[] = [];
          parts.push(`🔄 ENGENHARIA REVERSA: ${rep.videoTitle}`);
          parts.push(`Canal: ${rep.channelName} | Views: ${(rep.views || 0).toLocaleString()} | Gold Score: ${rep.goldScore}`);
          if (rep.dna.hook_type) parts.push(`\n🎣 Hook: ${rep.dna.hook_type}`);
          if (rep.dna.story_structure) parts.push(`📖 Estrutura: ${rep.dna.story_structure}`);
          if (rep.dna.emotion_primary) parts.push(`💭 Emoção: ${rep.dna.emotion_primary}${rep.dna.emotion_secondary ? ` + ${rep.dna.emotion_secondary}` : ''}`);
          if (rep.dna.visual_style) parts.push(`🎨 Visual: ${rep.dna.visual_style}`);
          if (rep.dna.why_viral) parts.push(`\n🔥 Por que viralizou: ${rep.dna.why_viral}`);
          if (rep.dna.replication_template) parts.push(`\n💡 Template de replicação:\n${rep.dna.replication_template}`);
          setScript(parts.join('\n'));
        }
        setActiveStep('script');
        toast.success('🔄 Engenharia reversa carregada! Gere o roteiro baseado no DNA extraído.');
      } catch (e) {
        console.error('Failed to parse replicate data:', e);
      }
    }

    // Load from Video Clone Engine (TubySpy "Modelar Vídeo")
    const cloneRaw = sessionStorage.getItem('clone_full_data');
    if (cloneRaw) {
      try {
        const clone = JSON.parse(cloneRaw);
        sessionStorage.removeItem('clone_full_data');
        
        // Pre-fill topic
        setTopic(clone.videoTitle || 'Vídeo Modelado');
        
        // Pre-fill niche
        if (clone.niche) setNiche(clone.niche);
        
        // Pre-fill visual style
        if (clone.visualStyle) {
          const matchedStyle = VIDEO_STYLES.find(s => 
            s.value === clone.visualStyle.toLowerCase() || 
            s.label.toLowerCase().includes(clone.visualStyle.toLowerCase())
          );
          if (matchedStyle) setVideoStyle(matchedStyle.value);
        }
        
        // Pre-fill duration: USE ORIGINAL VIDEO DURATION (exact clone)
        if (clone.durationMinutes && clone.durationMinutes > 0) {
          setDuration(String(clone.durationMinutes));
        } else if (clone.suggestedDuration) {
          const durationMatch = clone.suggestedDuration.match(/(\d+)/);
          if (durationMatch) setDuration(durationMatch[1]);
        }

        // Build a COMPLETE modeled script from all clone data
        const scriptParts: string[] = [];
        
        // Duration header
        if (clone.durationMinutes) {
          scriptParts.push(`📐 CLONE: ${clone.videoTitle}\n⏱️ Duração Alvo: ${clone.durationMinutes} minutos (~${clone.durationMinutes * 150} palavras)\n🎬 Canal: ${clone.channelTitle} (${clone.views?.toLocaleString()} views)`);
        }
        
        // Hook section
        if (clone.hookScript) {
          scriptParts.push(clone.hookScript);
        } else if (clone.hookText) {
          scriptParts.push(clone.hookText);
        }
        
        // Main script body from outline
        if (clone.scriptOutline) {
          scriptParts.push('\n' + clone.scriptOutline);
        }
        
        // Template structure as context
        if (clone.templateStructure && !clone.scriptOutline?.includes(clone.templateStructure)) {
          scriptParts.push('\n--- ESTRUTURA DO TEMPLATE ---\n' + clone.templateStructure);
        }
        
        // CTA
        if (clone.ctaScript) {
          scriptParts.push('\n--- CTA ---\n' + clone.ctaScript);
        }
        
        // Scene Timeline with visual prompts
        if (clone.sceneTimeline?.length > 0) {
          const sceneNotes = clone.sceneTimeline
            .map((s: any) => `[${s.startTime}-${s.endTime}] Cena ${s.sceneIndex}: ${s.narrationSummary || s.visualDescription}\n  🎨 Visual: ${s.visualPrompt || 'N/A'}\n  🎭 Mood: ${s.mood || ''} | Energia: ${s.energyLevel || ''}`)
            .join('\n\n');
          scriptParts.push(`\n--- TIMELINE DE CENAS (${clone.sceneTimeline.length} cenas, ${clone.durationMinutes}min) ---\n${sceneNotes}`);
        }
        
        // Retention map as scene blueprint
        if (clone.retentionMap?.structure?.length > 0) {
          const retentionNotes = clone.retentionMap.structure
            .map((p: any) => `[${p.timeRange}] ${p.phase}: ${p.technique} (retenção ~${p.retentionEstimate}%)`)
            .join('\n');
          scriptParts.push('\n--- MAPA DE RETENÇÃO ---\n' + retentionNotes);
        }

        // Visual DNA reference
        if (clone.visualDna?.referenceStylePrompt) {
          scriptParts.push(`\n--- REFERÊNCIA VISUAL (MASTER PROMPT) ---\n${clone.visualDna.referenceStylePrompt}`);
        }
        
        const fullScript = scriptParts.join('\n\n');
        if (fullScript.trim()) {
          setScript(fullScript);
        }
        
        // Store clone context for ScriptGenerator to use in refinement
        sessionStorage.setItem('clone_context', JSON.stringify({
          originalTitle: clone.videoTitle,
          channel: clone.channelTitle,
          views: clone.views,
          durationSeconds: clone.durationSeconds,
          durationMinutes: clone.durationMinutes,
          hookType: clone.hookType,
          emotionalTone: clone.emotionalTone,
          format: clone.format,
          psychTriggers: clone.psychTriggers,
          whyItWorks: clone.whyItWorks,
          titleVariations: clone.titleVariations,
          thumbnailRecipe: clone.thumbnailRecipe,
          visualDna: clone.visualDna,
          sceneTimeline: clone.sceneTimeline,
        }));
        
        setActiveStep('script');
        setVideoType('long');
        toast.success('🎬 Roteiro modelado do Video Clone Engine carregado! Revise e refine.');
      } catch (e) {
        console.error('Failed to parse clone data:', e);
      }
    }
    
    // Legacy fallback
    const cloneOutline = sessionStorage.getItem('clone_script_outline');
    if (cloneOutline) {
      setTopic(sessionStorage.getItem('clone_video_title') || 'Vídeo Modelado');
      setScript(cloneOutline);
      const cloneNiche = sessionStorage.getItem('clone_niche');
      if (cloneNiche) setNiche(cloneNiche);
      setActiveStep('script');
      sessionStorage.removeItem('clone_script_outline');
      sessionStorage.removeItem('clone_video_title');
      sessionStorage.removeItem('clone_video_style');
      sessionStorage.removeItem('clone_hook');
      sessionStorage.removeItem('clone_niche');
      toast.success('🎬 Roteiro modelado carregado!');
    }

    loadLastProjectCharacters();
  }, []);

  // Auto-set video style when niche changes
  useEffect(() => {
    if (niche === 'animal_survival') setVideoStyle('animal_chase');
  }, [niche]);

  // Load channel styles when channel changes
  useEffect(() => {
    if (selectedChannelId) {
      loadChannelStyles(selectedChannelId);
      analyzeChannelVisualStyle(selectedChannelId);
    } else {
      setChannelVisualProfile(null);
    }
  }, [selectedChannelId]);

  const loadUserChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('user_channels').select('*').eq('user_id', user.id).order('channel_name');
    setUserChannels(data || []);
  };

  const loadChannelStyles = async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('channel_styles').select('*').eq('user_id', user.id).eq('channel_id', channelId).order('created_at', { ascending: false });
    setChannelStyles((data as any[]) || []);
    // Auto-select default style
    const defaultStyle = (data as any[])?.find((s: any) => s.is_default);
    if (defaultStyle) {
      setVideoStyle(defaultStyle.style_name);
      setCustomStyleNotes(defaultStyle.visual_notes || '');
      toast.success(`Estilo "${defaultStyle.style_name}" do canal aplicado`);
    }
  };

  const analyzeChannelVisualStyle = async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAnalyzingChannelStyle(true);
    try {
      const channel = userChannels.find((c: any) => c.id === channelId);
      const ytChannelId = channel?.youtube_channel_id;

      // Fetch intelligence data, voice profile, and recent scenes in parallel
      const [intelRes, voiceRes, scenesRes] = await Promise.all([
        ytChannelId
          ? supabase.from('channel_intelligence').select('visual_style_notes, style, niche, viral_patterns').eq('youtube_channel_id', ytChannelId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('channel_voice_profiles').select('visual_style, voice_signature, style_markers').eq('user_id', user.id).eq('channel_id', channelId).maybeSingle(),
        supabase.from('video_projects').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const parts: string[] = [];

      // From channel_intelligence
      const intel = intelRes.data as any;
      if (intel?.visual_style_notes) parts.push(`Estilo visual do canal: ${intel.visual_style_notes}`);
      if (intel?.style) parts.push(`Estilo geral: ${intel.style}`);
      if (intel?.viral_patterns?.visual_style) parts.push(`Padrão visual viral: ${intel.viral_patterns.visual_style}`);

      // From voice profile
      const voice = voiceRes.data as any;
      if (voice?.visual_style) parts.push(`Visual aprendido: ${voice.visual_style}`);
      if (voice?.voice_signature?.narrative_preference) parts.push(`Narrativa: ${voice.voice_signature.narrative_preference}`);

      // From channel styles already loaded
      if (channelStyles.length > 0) {
        const styleDescs = channelStyles.map((cs: any) => `${cs.style_name}: ${cs.style_description || cs.visual_notes || ''}`).filter(Boolean);
        if (styleDescs.length) parts.push(`Estilos salvos: ${styleDescs.join('; ')}`);
      }

      // Fetch recent synced scenes for visual pattern detection
      if (scenesRes.data?.length) {
        const projectIds = scenesRes.data.map((p: any) => p.id);
        const { data: recentScenes } = await supabase.from('scenes')
          .select('visual_prompt, camera_angle, mood')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(10);
        if (recentScenes?.length) {
          const visualPatterns = recentScenes.map((s: any) => s.visual_prompt).filter(Boolean).slice(0, 5);
          if (visualPatterns.length) parts.push(`Padrões visuais recentes: ${visualPatterns.join(' | ').slice(0, 500)}`);
          const moods = [...new Set(recentScenes.map((s: any) => s.mood).filter(Boolean))];
          if (moods.length) parts.push(`Moods frequentes: ${moods.join(', ')}`);
        }
      }

      if (parts.length > 0) {
        const profile = parts.join('\n');
        setChannelVisualProfile(profile);
        // Auto-fill custom style notes if empty
        if (!customStyleNotes.trim()) {
          setCustomStyleNotes(profile);
        }
        toast.success(`🎨 Estilo visual do canal "${channel?.channel_name}" detectado`);
      } else {
        setChannelVisualProfile(null);
        // If no data, trigger voice learning
        if (ytChannelId) {
          supabase.functions.invoke('learn-channel-voice', {
            body: { userId: user.id, channelId },
          }).then(({ data }) => {
            if (data?.success && data.voice_profile?.voice_signature) {
              const vs = data.voice_profile.voice_signature;
              const autoNotes = [vs.tone, vs.rhythm, vs.narrative_preference].filter(Boolean).join('. ');
              if (autoNotes) {
                setChannelVisualProfile(autoNotes);
                toast.success('🧠 Perfil de voz do canal aprendido!');
              }
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Channel visual analysis failed:', err);
    } finally {
      setAnalyzingChannelStyle(false);
    }
  };

  const saveChannelStyle = async () => {
    if (!newStyleName.trim() || !selectedChannelId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('channel_styles').insert({
      user_id: user.id,
      channel_id: selectedChannelId,
      style_name: newStyleName,
      style_description: newStyleDesc,
      visual_notes: newStyleNotes,
      is_default: channelStyles.length === 0,
    } as any);
    toast.success(`Estilo "${newStyleName}" salvo!`);
    setNewStyleName(''); setNewStyleDesc(''); setNewStyleNotes('');
    setShowCreateStyle(false);
    loadChannelStyles(selectedChannelId);
  };

  const deleteChannelStyle = async (id: string) => {
    await supabase.from('channel_styles').delete().eq('id', id);
    if (selectedChannelId) loadChannelStyles(selectedChannelId);
    toast.success('Estilo removido');
  };
  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (referenceImages.length + files.length > 5) {
      toast.error('Máximo de 5 imagens de referência');
      return;
    }
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Faça login'); return; }
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} é muito grande (máx 5MB)`); continue; }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/ref-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('media').upload(path, file);
        if (error) { toast.error(`Erro ao subir ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
        setReferenceImages(prev => [...prev, { url: urlData.publicUrl, file }]);
      }
      toast.success(`${files.length} imagem(ns) adicionada(s)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao subir imagens');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };




  const loadLastProjectCharacters = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: project } = await supabase.from('video_projects').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!project) return;
    setProjectId(project.id);
    const { data: chars } = await supabase.from('characters').select('*').eq('project_id', project.id).order('created_at', { ascending: true });
    if (chars?.length) {
      setCharacters(chars.map((c: any) => ({
        name: c.name, gender: (c.visual_attributes as any)?.gender || 'male', age: (c.visual_attributes as any)?.age || 30,
        role: (c.visual_attributes as any)?.role || 'Personagem',
        appearance: (c.visual_attributes as any)?.appearance || { skin_color: 'light', hair_color: 'dark', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
        facial_features: (c.visual_attributes as any)?.facial_features || { eyebrows: 'medium', nose: 'straight', mouth: 'medium', ears: 'normal', face_shape: 'oval' },
        clothing: (c.visual_attributes as any)?.clothing || { shirt: 'casual shirt', pants: 'jeans', shoes: 'sneakers', accessories: 'none' },
        personality: (c.visual_attributes as any)?.personality || ['determined'],
      })));
    }
  };

  const getOrCreateProject = async (): Promise<string> => {
    if (projectId) return projectId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Login required');
    const { data: proj } = await supabase.from('video_projects').insert({
      user_id: user.id, title: topic || 'Script Project', script: script.slice(0, 500), niche: niche || undefined,
      video_type: videoType,
    } as any).select('id').single();
    if (!proj) throw new Error('Failed to create project');
    setProjectId(proj.id);
    return proj.id;
  };

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, count } = await supabase.from('saved_scripts').select('*', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range(scriptsPag.rangeFrom, scriptsPag.rangeTo) as any;
    scriptsPag.setItems(data || []);
    scriptsPag.setTotalCount(count || 0);
  };

  const deleteScript = async (id: string) => {
    await supabase.from('saved_scripts').delete().eq('id', id);
    toast.success('Removido');
    loadHistory();
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    const { data } = await supabase.from('script_knowledge').select('*').eq('category', 'template').order('effectiveness_score', { ascending: false }) as any;
    setTemplates(data || []);
    setLoadingTemplates(false);
  };

  const applyTemplate = (tmpl: any) => {
    const examples = Array.isArray(tmpl.examples) ? tmpl.examples : [];
    const firstExample = examples[0] || '';
    if (firstExample && !topic) setTopic(firstExample);
    const titleLower = tmpl.title.toLowerCase();
    const hvmConfigs: Record<string, { style: string; duration: string; niche: string; videoStyle: string }> = {
      'histórias emocionais': { style: 'storytelling', duration: '12', niche: 'histórias emocionais', videoStyle: 'cinematográfico' },
      'jornada do herói': { style: 'storytelling', duration: '12', niche: 'histórias emocionais', videoStyle: 'cinematográfico' },
      'documentário curto': { style: 'documentário', duration: '15', niche: 'documentário histórico', videoStyle: 'dark' },
      'mistério/histórico': { style: 'cinematográfico', duration: '15', niche: 'mistério histórico', videoStyle: 'dark' },
      'true crime pov': { style: 'narração', duration: '10', niche: 'true crime', videoStyle: 'dark' },
      'primeira pessoa': { style: 'narração', duration: '10', niche: 'true crime', videoStyle: 'dark' },
      'reddit': { style: 'reddit', duration: '10', niche: 'reddit stories', videoStyle: '2d' },
      'conspiração': { style: 'conspiração', duration: '15', niche: 'conspiração', videoStyle: 'dark' },
      'mitologia': { style: 'mitologia', duration: '15', niche: 'mitologia', videoStyle: 'cinematográfico' },
      'teorias': { style: 'teorias', duration: '12', niche: 'teorias e mistérios', videoStyle: 'dark' },
    };
    let applied = false;
    for (const [key, config] of Object.entries(hvmConfigs)) {
      if (titleLower.includes(key)) {
        setStyle(config.style); setDuration(config.duration); setNiche(config.niche); setVideoStyle(config.videoStyle);
        applied = true; break;
      }
    }
    if (!applied) {
      const styleMap: Record<string, string> = {
        'documentário': 'documentário', 'true crime': 'narração', 'finanças': 'educativo',
        'motivacional': 'storytelling', 'listicle': 'listicle', 'tutorial': 'tutorial',
        'horror': 'narração', 'educativo': 'educativo', 'storytelling': 'storytelling',
        'shorts': 'dopaminérgico', 'comparação': 'educativo', 'desafio': 'mrbeast',
      };
      for (const [key, val] of Object.entries(styleMap)) {
        if (titleLower.includes(key)) { setStyle(val); break; }
      }
    }
    toast.success(`Template "${tmpl.title}" aplicado!`);
    setShowTemplates(false);
  };



  const getViralContext = useCallback(() => {
    const parts: string[] = [];
    if (selectedHook) { const hook = VIRAL_HOOKS.find(h => h.id === selectedHook); if (hook) parts.push(`HOOK OBRIGATÓRIO: ${hook.text}`); }
    if (selectedCTA) { const cta = VIRAL_CTAS.find(c => c.id === selectedCTA); if (cta) parts.push(`CTA OBRIGATÓRIO (${cta.placement}): ${cta.text}`); }
    if (selectedStructure) {
      const structure = STORY_STRUCTURES.find(s => s.id === selectedStructure);
      if (structure) {
        const phases = structure.phases.map(p => `${p.name} (${p.duration}): ${p.tip}`).join('\n');
        parts.push(`ESTRUTURA: "${structure.name}":\n${phases}`);
      }
    }
    return parts.join('\n\n');
  }, [selectedHook, selectedCTA, selectedStructure]);

  const getCleanNarration = useCallback((): string => {
    let clean = script;
    const endMarkers = ['## Títulos', '## TÍTULOS', '## Sugestões de Título', '**Títulos**', '**TÍTULOS**', '## Tags', '## SEO', '## Thumbnail', '## THUMBNAIL'];
    for (const marker of endMarkers) { const idx = clean.indexOf(marker); if (idx > 0) clean = clean.slice(0, idx); }
    clean = clean.replace(/^#+\s.*/gm, '').replace(/\*\*.*?\*\*/g, '').replace(/\[[\d:]+\]/g, '').replace(/[*_#>`~]/g, '').replace(/\n{3,}/g, '\n\n');
    return clean.trim();
  }, [script]);

  const viralCount = [selectedHook, selectedCTA, selectedStructure].filter(Boolean).length;

  const completedSteps: Record<PipelineStep, boolean> = {
    script: !!script,
    voice: !!generatedAudioUrl || activeStep === 'style' || activeStep === 'characters' || activeStep === 'prompts' || activeStep === 'titles',
    style: !!videoStyle && (activeStep !== 'script' && activeStep !== 'voice'),
    characters: characters.length > 0 || activeStep === 'prompts' || activeStep === 'titles',
    prompts: syncedScenes.length > 0,
    titles: false,
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">{t('dash.scripts')}</h1>
              <p className="text-sm text-muted-foreground">Pipeline completo: Roteiro → Estilo → Personagens → Cenas → SEO</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowHistory(!showHistory)} size="sm" className="gap-2">
              <History className="w-4 h-4" /> ({scriptsPag.totalCount})
            </Button>
            <Button variant="outline" onClick={() => setShowComparator(!showComparator)} size="sm" className="gap-2">
              <GitCompareArrows className="w-4 h-4" /> Comparar
            </Button>
          </div>
        </div>

        {/* History */}
        {showHistory && scriptsPag.items.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-primary" /> Roteiros Salvos
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {scriptsPag.items.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                  <button onClick={() => { setScript(s.script_content); setTopic(s.topic); setShowHistory(false); setActiveStep('style'); }}
                    className="text-sm text-left flex-1 truncate hover:text-primary transition-colors font-medium">
                    {s.topic} <span className="text-muted-foreground font-normal">({s.duration}min)</span>
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => deleteScript(s.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <PaginationControls page={scriptsPag.page} totalCount={scriptsPag.totalCount} pageSize={PAGE_SIZE}
              hasMore={scriptsPag.hasMore} hasPrev={scriptsPag.hasPrev} onNext={scriptsPag.nextPage} onPrev={scriptsPag.prevPage} />
          </div>
        )}

        {/* Comparator Panel */}
        {showComparator && (
          <div className="bg-card border border-border rounded-xl p-5">
            <ScriptComparator />
          </div>
        )}

        {/* Pipeline Stepper — sticky navigation */}
        <PipelineStepper
          activeStep={activeStep}
          onStepClick={(step) => script ? setActiveStep(step) : null}
          hasScript={!!script}
          completedSteps={completedSteps}
        />

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Config + Panels */}
          <div className="space-y-4">
            <ScriptGenerator
              topic={topic} setTopic={setTopic} duration={duration} setDuration={setDuration}
              style={style} setStyle={setStyle} niche={niche} setNiche={setNiche}
              language={language} setLanguage={setLanguage} script={script} setScript={setScript}
              loading={loading} setLoading={setLoading} scorecard={scorecard} setScorecard={setScorecard}
              setActiveStep={setActiveStep} getViralContext={getViralContext} getOrCreateProject={getOrCreateProject}
              intelligenceBriefing={intelligenceBriefing} setIntelligenceBriefing={setIntelligenceBriefing}
              setSceneBlueprintJson={setSceneBlueprintJson}
              onScriptGenerated={() => { loadHistory(); setSyncedScenes([]); }}
              videoType={videoType} setVideoType={setVideoType}
              selectedChannelId={selectedChannelId} setSelectedChannelId={setSelectedChannelId}
              userChannels={userChannels}
            />

            {/* Intelligence Briefing Panel */}
            {intelligenceBriefing && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setShowIntelligence(!showIntelligence)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">📊 Análise de Inteligência</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                      {intelligenceBriefing.metadata?.channelsAnalyzed || 0} canais
                    </Badge>
                  </div>
                  {showIntelligence ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {showIntelligence && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3 max-h-[400px] overflow-y-auto">
                        {intelligenceBriefing.briefing?.competitive_analysis && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Análise Competitiva</p>
                            <div className="grid grid-cols-2 gap-2">
                              {(intelligenceBriefing.briefing.competitive_analysis.what_works || []).slice(0, 3).map((w: string, i: number) => (
                                <div key={i} className="bg-primary/5 rounded-lg px-3 py-2 text-xs">✅ {w}</div>
                              ))}
                              {(intelligenceBriefing.briefing.competitive_analysis.what_to_avoid || []).slice(0, 2).map((w: string, i: number) => (
                                <div key={i} className="bg-destructive/5 rounded-lg px-3 py-2 text-xs">❌ {w}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {intelligenceBriefing.briefing?.recommended_hooks?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Hooks Recomendados</p>
                            {intelligenceBriefing.briefing.recommended_hooks.slice(0, 3).map((h: any, i: number) => (
                              <div key={i} className="bg-muted/30 rounded-lg p-3 text-xs">
                                <p className="font-medium">🎣 "{h.hook_text}"</p>
                                <p className="text-muted-foreground mt-1">{h.why_it_works}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {intelligenceBriefing.briefing?.visual_blueprint && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Blueprint Visual</p>
                            <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                              <p>🎨 Estilo: {intelligenceBriefing.briefing.visual_blueprint.recommended_style}</p>
                              <p>💡 Iluminação: {intelligenceBriefing.briefing.visual_blueprint.lighting_mood}</p>
                              <p>🎬 Hook Visual: {intelligenceBriefing.briefing.visual_blueprint.hook_visual_suggestion}</p>
                            </div>
                          </div>
                        )}
                        {intelligenceBriefing.metadata?.topChannelNames?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Canais Referência</p>
                            <div className="flex flex-wrap gap-1.5">
                              {intelligenceBriefing.metadata.topChannelNames.map((name: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Templates Panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setShowTemplates(!showTemplates)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Templates de Roteiro</span>
                  <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
                </div>
                {showTemplates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showTemplates && (
                <div className="px-4 pb-4 space-y-2 border-t border-border/30 pt-3 max-h-[300px] overflow-y-auto">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : templates.map((tmpl: any) => (
                    <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                      className="w-full text-left p-3 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{tmpl.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ═══ Retention Curve Analyzer ═══ */}
            <RetentionCurveAnalyzer
              script={script}
              topic={topic}
              niche={niche}
              style={style}
              duration={duration}
              videoType={videoType}
              language={language}
            />

            <ViralThemeWizard
              onSelectTheme={(theme) => {
                setTopic(theme.title);
                if (theme.estimated_duration) {
                  const dur = parseInt(theme.estimated_duration);
                  if (dur) setDuration(String(dur));
                }
                if (theme.videoFormat === 'short') setVideoType('short');
                const styleMap: Record<string, string> = {
                  'documentário': 'documentário', 'listicle': 'listicle', 'tutorial': 'tutorial',
                  'true crime': 'narração', 'motivacional': 'storytelling', 'storytelling': 'storytelling',
                  'educativo': 'educativo', 'horror': 'narração', 'shorts': 'dopaminérgico',
                  'narração': 'narração', 'cinematográfico': 'cinematográfico', 'dopaminérgico': 'dopaminérgico',
                };
                if (theme.style && styleMap[theme.style]) setStyle(styleMap[theme.style]);
                if (theme.niche_tags?.length) setNiche(theme.niche_tags[0]);
                toast.success('Tema aplicado! Configure detalhes e gere o roteiro.');
              }}
              userChannels={userChannels}
            />

            {/* ═══ 1-Click Short Templates ═══ */}
            {videoType === 'short' && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-chart-4" />
                    <span className="font-semibold text-sm">1-Click Short — Templates por Nicho</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { emoji: '🐾', name: 'Animal Survival', topic: 'Animal selvagem fugindo de predador em perseguição intensa', niche: 'animal_survival', style: 'dopaminérgico', vStyle: 'animal_chase', dur: '25' },
                      { emoji: '👻', name: 'Horror/Terror', topic: 'Lugar abandonado com eventos inexplicáveis e final chocante', niche: 'horror', style: 'narração', vStyle: 'dark', dur: '35' },
                      { emoji: '💰', name: 'Finanças', topic: 'Fato financeiro chocante que muda perspectiva sobre dinheiro', niche: 'finanças', style: 'educativo', vStyle: 'cinematográfico', dur: '30' },
                      { emoji: '🧠', name: 'Curiosidades', topic: 'Fato científico surpreendente que ninguém sabe', niche: 'curiosidades', style: 'dopaminérgico', vStyle: '2d', dur: '20' },
                      { emoji: '📜', name: 'História', topic: 'Momento histórico pouco conhecido com consequências enormes', niche: 'história', style: 'storytelling', vStyle: 'cinematográfico', dur: '45' },
                      { emoji: '🔪', name: 'True Crime', topic: 'Caso criminal perturbador com reviravolta inesperada', niche: 'true_crime', style: 'narração', vStyle: 'dark', dur: '40' },
                      { emoji: '👁️', name: 'Conspiração', topic: 'Teoria proibida com evidências reais e perturbadoras', niche: 'conspiração', style: 'conspiração', vStyle: 'dark', dur: '35' },
                      { emoji: '⛩️', name: 'Mitologia', topic: 'Mito épico com batalha, traição e sacrifício devastador', niche: 'mitologia', style: 'mitologia', vStyle: 'anime', dur: '40' },
                    ].map(t => (
                      <button key={t.name} onClick={() => {
                        setTopic(t.topic); setNiche(t.niche); setStyle(t.style);
                        setVideoStyle(t.vStyle); setDuration(t.dur);
                        toast.success(`Template "${t.name}" aplicado! Clique "Gerar Roteiro"`);
                      }}
                        className="flex items-center gap-2.5 p-3 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                        <span className="text-xl">{t.emoji}</span>
                        <div>
                          <p className="text-xs font-medium">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground">{t.dur}s • {t.style}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Viral Database Panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setShowViralPanel(!showViralPanel)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-destructive" />
                  <span className="font-semibold text-sm">Viral Database</span>
                  {viralCount > 0 && <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">{viralCount}</Badge>}
                </div>
                {showViralPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showViralPanel && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /> Hook (5s)</label>
                      {selectedHook && <button onClick={() => setSelectedHook(null)} className="text-xs text-muted-foreground hover:text-destructive">✕ Limpar</button>}
                    </div>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {VIRAL_HOOKS.slice(0, 8).map(h => (
                        <button key={h.id} onClick={() => setSelectedHook(selectedHook === h.id ? null : h.id)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs border transition-all ${
                            selectedHook === h.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-2">{h.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-primary" /> CTA</label>
                      {selectedCTA && <button onClick={() => setSelectedCTA(null)} className="text-xs text-muted-foreground hover:text-destructive">✕ Limpar</button>}
                    </div>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                      {VIRAL_CTAS.slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => setSelectedCTA(selectedCTA === c.id ? null : c.id)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs border transition-all ${
                            selectedCTA === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-2">{c.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-primary" /> Estrutura</label>
                      {selectedStructure && <button onClick={() => setSelectedStructure(null)} className="text-xs text-muted-foreground hover:text-destructive">✕ Limpar</button>}
                    </div>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {STORY_STRUCTURES.map(s => (
                        <button key={s.id} onClick={() => setSelectedStructure(selectedStructure === s.id ? null : s.id)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs border transition-all ${
                            selectedStructure === s.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="font-medium">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Content Area */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {/* Step 2: Voice / Narration */}
              {activeStep === 'voice' && script && (
                <VoiceGeneratorStep
                  script={script}
                  language={language}
                  onAudioGenerated={(blob, url) => {
                    setGeneratedAudioBlob(blob);
                    setGeneratedAudioUrl(url);
                  }}
                  onNavigate={setActiveStep}
                  existingAudioUrl={generatedAudioUrl}
                />
              )}

              {/* Step 3: Video Style */}
              {activeStep === 'style' && script && (
                <motion.div key="style" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2"><Film className="w-5 h-5 text-accent" /> Estilo Visual do Vídeo</h3>
                    <p className="text-sm text-muted-foreground mt-1">Escolha um estilo padrão ou use o estilo personalizado do seu canal</p>
                  </div>

                  {/* Channel Visual Profile Detected */}
                  {analyzingChannelStyle && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <p className="text-xs text-primary">Analisando estilo visual do canal...</p>
                    </div>
                  )}
                  {channelVisualProfile && !analyzingChannelStyle && (
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 space-y-1.5">
                      <p className="text-[10px] font-semibold text-accent uppercase flex items-center gap-1">
                        🎨 Estilo Visual Detectado do Canal
                      </p>
                      <p className="text-[10px] text-muted-foreground whitespace-pre-line leading-relaxed">{channelVisualProfile}</p>
                      <p className="text-[9px] text-muted-foreground/60 italic">Este padrão será usado para manter consistência visual nas cenas geradas</p>
                    </div>
                  )}

                  {/* Channel Custom Styles */}
                  {selectedChannelId && channelStyles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <Palette className="w-3 h-3" /> Estilos do Canal
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {channelStyles.map((cs: any) => (
                          <div key={cs.id} className="relative group">
                            <button onClick={() => { setVideoStyle(cs.style_name); setCustomStyleNotes(cs.visual_notes || ''); }}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                videoStyle === cs.style_name ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-accent/30 hover:border-primary/30 bg-accent/5'
                              }`}>
                              <span className="text-lg block mb-1">🎨</span>
                              <p className="text-[10px] font-medium text-foreground">{cs.style_name}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{cs.style_description || cs.visual_notes || 'Estilo personalizado'}</p>
                              {cs.is_default && <Badge className="mt-1 text-[8px] bg-accent/20 text-accent border-accent/30">Padrão</Badge>}
                            </button>
                            <button onClick={() => deleteChannelStyle(cs.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-all">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create Custom Style */}
                  {selectedChannelId && (
                    <div>
                      {!showCreateStyle ? (
                        <Button variant="outline" size="sm" onClick={() => setShowCreateStyle(true)} className="gap-1.5 text-xs">
                          <Plus className="w-3 h-3" /> Criar Estilo Personalizado
                        </Button>
                      ) : (
                        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                          <p className="text-xs font-semibold">Novo Estilo para o Canal</p>
                          <Input value={newStyleName} onChange={e => setNewStyleName(e.target.value)} placeholder="Ex: Wojak Amarelo, Macacos Dark..." className="bg-background text-xs h-8" />
                          <Input value={newStyleDesc} onChange={e => setNewStyleDesc(e.target.value)} placeholder="Descrição curta do estilo" className="bg-background text-xs h-8" />
                          <textarea value={newStyleNotes} onChange={e => setNewStyleNotes(e.target.value)}
                            placeholder="Notas visuais detalhadas: cores, personagens, fundos, referências..."
                            className="w-full min-h-[60px] bg-background border border-input rounded-md p-2 text-xs resize-none" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveChannelStyle} disabled={!newStyleName.trim()} className="gap-1 text-xs h-7">
                              <Save className="w-3 h-3" /> Salvar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowCreateStyle(false)} className="text-xs h-7">Cancelar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Styles */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Estilos Padrão</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                      {VIDEO_STYLES.map(vs => (
                        <button key={vs.value} onClick={() => { setVideoStyle(vs.value); setCustomStyleNotes(''); }}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            videoStyle === vs.value && !channelStyles.some((cs: any) => cs.style_name === videoStyle) ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30'
                          }`}>
                          <span className="text-lg block mb-1">{vs.label.split(' ')[0]}</span>
                          <p className="text-[10px] font-medium text-foreground">{vs.label.split(' ').slice(1).join(' ')}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{vs.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference Images Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <Image className="w-3 h-3" /> Imagens de Referência Visual (opcional, até 5)
                      </label>
                      {referenceImages.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{referenceImages.length}/5</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Suba screenshots ou frames dos seus vídeos para a IA entender seu estilo visual
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {referenceImages.map((img, i) => (
                        <div key={i} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-border">
                          <img src={img.url} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeReferenceImage(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {referenceImages.length < 5 && (
                        <label className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-muted/20 hover:bg-muted/40">
                          {uploadingImage ? (
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground">Adicionar</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleReferenceImageUpload}
                            className="hidden"
                            disabled={uploadingImage}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* ASMR Toggle */}
                  <div className="flex items-center justify-between bg-muted/20 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🎧</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Camadas de Som ASMR</p>
                        <p className="text-[10px] text-muted-foreground">Ativa direção de áudio detalhada com 3 camadas: primária, ambiental e sutil</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={enableASMR} onChange={e => setEnableASMR(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  {/* Custom Style Notes */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Descrição do estilo visual (opcional)</label>
                    <textarea value={customStyleNotes} onChange={e => setCustomStyleNotes(e.target.value)}
                      placeholder="Descreva seu estilo: Ex: tons escuros, cinematográfico noir, personagens em silhueta, iluminação dramática com sombras..."
                      className="w-full min-h-[60px] bg-muted/20 border border-border rounded-md p-2 text-sm resize-none" />
                  </div>

                  <StepNavButtons currentStep="style" onNavigate={setActiveStep} />
                </motion.div>
              )}

              {/* Step 3: Characters */}
              {activeStep === 'characters' && script && (
                <CharacterManager
                  script={script} characters={characters} setCharacters={setCharacters}
                  videoStyle={videoStyle} videoStyles={VIDEO_STYLES} language={language}
                  getOrCreateProject={getOrCreateProject} getCleanNarration={getCleanNarration}
                  setActiveStep={setActiveStep}
                />
              )}

              {/* Step 4: Audio + Prompts */}
               {activeStep === 'prompts' && script && (
                <motion.div key="prompts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Image className="w-5 h-5 text-accent" />
                      {videoType === 'short' ? 'Cenas do Short (9:16)' : 'Gerador de Cenas Visuais'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {videoType === 'short' ? 'Blocos visuais de 8s otimizados para vertical' : 'A IA analisa o roteiro e cria prompts visuais cinematográficos'}
                    </p>
                  </div>

                  {videoType === 'short' ? (
                    <ShortsSceneBreakdown
                      script={script}
                      durationSeconds={parseInt(duration)}
                      videoStyle={videoStyle}
                      characters={characters}
                      customStyleNotes={customStyleNotes}
                      enableASMR={enableASMR}
                      onScenesGenerated={setSyncedScenes}
                    />
                  ) : (
                    <>
                      <AudioProcessor
                        script={script} videoStyle={videoStyle} videoStyles={VIDEO_STYLES}
                        characters={characters} language={language} niche={niche}
                        sceneBlueprintJson={sceneBlueprintJson}
                        syncedScenes={syncedScenes} setSyncedScenes={setSyncedScenes}
                        getCleanNarration={getCleanNarration}
                        customStyleNotes={customStyleNotes} setCustomStyleNotes={setCustomStyleNotes}
                        enableASMR={enableASMR}
                        referenceImageUrls={referenceImages.map(img => img.url)}
                        onReferenceImagesChange={(urls) => setReferenceImages(urls.map(url => ({ url })))}
                      />
                      {syncedScenes.length > 0 && (
                        <div className="space-y-4">
                          <PromptExporter scenes={syncedScenes} characters={characters} topic={topic} videoStyle={videoStyle} language={language} />
                          <TimelineSyncLab scenes={syncedScenes} onUpdateScene={(index, updates) => {
                            setSyncedScenes(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
                          }} />
                          <div className="border border-border/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Film className="w-4 h-4 text-primary" />
                              <span className="text-sm font-semibold">Todas as Cenas — Detalhes Completos</span>
                              <Badge variant="outline" className="text-[10px]">{syncedScenes.length} cenas</Badge>
                            </div>
                            <SceneViewer scenes={syncedScenes} />
                          </div>
                        </div>
                      )}
                    </>
                   )}
                  <StepNavButtons currentStep="prompts" onNavigate={setActiveStep} />
                </motion.div>
              )}

              {/* Step 5: Titles & SEO */}
              {activeStep === 'titles' && script && (
                <motion.div key="titles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-base flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Títulos Virais & SEO</h3>
                    <p className="text-sm text-muted-foreground mt-1">Títulos otimizados com base no roteiro, cenas e estilo do vídeo</p>
                  </div>
                  <TitleSEOStep
                    topic={topic} niche={niche} language={language}
                    script={script} videoStyle={videoStyle} syncedScenes={syncedScenes}
                  />
                  <StepNavButtons currentStep="titles" onNavigate={setActiveStep} />
                </motion.div>
              )}

              {/* Step 6: Thumbnail Generator */}
              {activeStep === 'titles' && script && (
                <motion.div key="thumbnail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5 mt-4">
                  <ThumbnailGenerator videoTitle={topic} niche={niche} />
                </motion.div>
              )}

              {/* Packaging Lab — score título + thumb + hook como unidade */}
              {activeStep === 'titles' && script && (
                <motion.div key="packaging" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="mt-4">
                  <PackagingLab
                    title={topic}
                    hookText={script.slice(0, 500)}
                    niche={niche}
                    videoType={videoType}
                    language={language}
                  />
                </motion.div>
              )}

              {/* Script Performance Tracker - always visible when script exists */}
              {script && (
                <motion.div key="perf-tracker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <ScriptPerformanceTracker scriptTopic={topic} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Script output is now inside ScriptGenerator but displayed here when active */}
            {(activeStep === 'script' || !script) && !loading && !script && (
              <div className="bg-card border border-border rounded-xl p-5 text-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Comece seu vídeo viral</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Preencha o tópico, nicho e estilo ao lado, depois clique em "Gerar Roteiro" para começar o pipeline de produção.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">1. Roteiro</Badge>
                  <ArrowRight className="w-3 h-3" />
                  <Badge variant="outline" className="text-[10px]">2. Voz</Badge>
                  <ArrowRight className="w-3 h-3" />
                  <Badge variant="outline" className="text-[10px]">3. Estilo</Badge>
                  <ArrowRight className="w-3 h-3" />
                  <Badge variant="outline" className="text-[10px]">4. Personagens</Badge>
                  <ArrowRight className="w-3 h-3" />
                  <Badge variant="outline" className="text-[10px]">5. Cenas</Badge>
                  <ArrowRight className="w-3 h-3" />
                  <Badge variant="outline" className="text-[10px]">6. SEO</Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
