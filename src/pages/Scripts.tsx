import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { FileText, Sparkles, Copy, Check, Save, History, Trash2, Zap, Flame, ChevronDown, ChevronUp, Target, BookOpen, Film, Users, Upload, Clock, Image, Loader2, Play, Wand2, Edit3, Eye, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { VIRAL_HOOKS, VIRAL_CTAS, STORY_STRUCTURES } from '@/lib/viralDatabase';
import { motion, AnimatePresence } from 'framer-motion';

const STYLES = [
  { value: 'dopaminérgico', label: '🧠 Dopaminérgico', desc: 'Open loops, pattern interrupts, curiosity gaps' },
  { value: 'cinematográfico', label: '🎬 Cinematográfico', desc: 'Estilo filme premiado, tensão narrativa' },
  { value: 'mrbeast', label: '🔥 MrBeast Style', desc: 'Alta energia, desafios, impossível não assistir' },
  { value: 'storytelling', label: '📖 Storytelling', desc: 'Narrativa envolvente com personagens e plot twists' },
  { value: 'narração', label: '🎙️ Narração', desc: 'Voz profunda, tom autoritário e misterioso' },
  { value: 'educativo', label: '📚 Educativo', desc: 'Destruir mitos com fatos e analogias' },
  { value: 'tutorial', label: '🛠️ Tutorial', desc: 'Passo a passo com resultado visível' },
  { value: 'documentário', label: '📹 Documentário', desc: 'Profundidade, dados e investigação' },
  { value: 'listicle', label: '📋 Listicle', desc: 'Top N com escalada de impacto' },
];

const VIDEO_STYLES = [
  { value: 'cinematográfico', label: '🎬 Cinematográfico', desc: 'Ultra-realista, estilo filme, iluminação dramática' },
  { value: '2d', label: '🎨 2D Animação', desc: 'Motion graphics, Kurzgesagt style, flat design' },
  { value: '3d', label: '🧊 3D Render', desc: 'Estilo Pixar/Disney, personagens estilizados' },
  { value: 'anime', label: '⛩️ Anime', desc: 'Estilo anime japonês, expressivo e dinâmico' },
  { value: 'wojak', label: '😐 Wojak/Meme', desc: 'Desenho simples, expressões emocionais, cultura internet' },
  { value: 'stickmen', label: '🧍 Stickmen', desc: 'Figuras palito, minimalista, humor pela simplicidade' },
  { value: 'realista', label: '📷 Fotorrealista', desc: 'Parece foto real, 8K, iluminação natural' },
  { value: 'dark', label: '🌑 Dark/Cyberpunk', desc: 'Sombras profundas, neon, atmosférico' },
  { value: 'whiteboard', label: '📝 Whiteboard', desc: 'Quadro branco, desenhos à mão, educativo' },
  { value: 'comic', label: '💥 HQ/Comic', desc: 'Estilo quadrinhos, bold outlines, ação' },
];

interface CharacterAppearance {
  skin_color: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  height: string;
}

interface CharacterFacialFeatures {
  eyebrows: string;
  nose: string;
  mouth: string;
  ears: string;
  face_shape: string;
}

interface CharacterClothing {
  shirt: string;
  pants: string;
  shoes: string;
  accessories: string;
}

interface Character {
  name: string;
  gender: string;
  age: number;
  role: string;
  appearance: CharacterAppearance;
  facial_features: CharacterFacialFeatures;
  clothing: CharacterClothing;
  personality: string[];
  imageUrl?: string;
  generatingImage?: boolean;
}

interface SyncedScene {
  sceneIndex: number;
  sceneDurationSeconds?: number;
  startTime: number;
  endTime: number;
  visualPrompt: string;
  cameraAngle: string;
  mood: string;
  narrativeText?: string;
  narrativeSummary?: string;
  emotionalBeat?: string;
  lensSpec?: string;
  lightingSetup?: string;
  audioDirection?: string;
  negativePrompt?: string;
  charactersInScene?: string[];
  transitionNote?: string;
}

interface TranscriptionBlock {
  text: string;
  startTime: number;
  endTime: number;
}

const Scripts = () => {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('15');
  const [style, setStyle] = useState('dopaminérgico');
  const [niche, setNiche] = useState('');
  const [language, setLanguage] = useState('português');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [scorecard, setScorecard] = useState<{hook:number,retention:number,emotion:number,flow:number,payoff:number} | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedScripts, setSavedScripts] = useState<any[]>([]);

  // Viral Database
  const [showViralPanel, setShowViralPanel] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);

  // Post-script pipeline
  const [activeStep, setActiveStep] = useState<'script' | 'style' | 'characters' | 'prompts'>('script');
  const [videoStyle, setVideoStyle] = useState('cinematográfico');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [newCharAppearance, setNewCharAppearance] = useState('');
  const [newCharClothing, setNewCharClothing] = useState('');

  // Audio & Synced Prompts
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [sceneDuration, setSceneDuration] = useState(8);
  const [syncedScenes, setSyncedScenes] = useState<SyncedScene[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [detectingCharacters, setDetectingCharacters] = useState(false);
  const [transcription, setTranscription] = useState<{ fullText: string; blocks: TranscriptionBlock[]; audioDuration: number } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('saved_scripts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20) as any;
    setSavedScripts(data || []);
  };

  const getViralContext = () => {
    const parts: string[] = [];
    if (selectedHook) {
      const hook = VIRAL_HOOKS.find(h => h.id === selectedHook);
      if (hook) parts.push(`HOOK OBRIGATÓRIO: ${hook.text}`);
    }
    if (selectedCTA) {
      const cta = VIRAL_CTAS.find(c => c.id === selectedCTA);
      if (cta) parts.push(`CTA OBRIGATÓRIO (${cta.placement}): ${cta.text}`);
    }
    if (selectedStructure) {
      const structure = STORY_STRUCTURES.find(s => s.id === selectedStructure);
      if (structure) {
        const phases = structure.phases.map(p => `${p.name} (${p.duration}): ${p.tip}`).join('\n');
        parts.push(`ESTRUTURA: \"${structure.name}\":\n${phases}`);
      }
    }
    return parts.join('\n\n');
  };

  const parseScorecard = (text: string) => {
    const match = text.match(/---SCORES---\s*hook:(\d+)\s*retention:(\d+)\s*emotion:(\d+)\s*flow:(\d+)\s*payoff:(\d+)\s*---END_SCORES---/);
    if (match) {
      setScorecard({ hook: parseInt(match[1]), retention: parseInt(match[2]), emotion: parseInt(match[3]), flow: parseInt(match[4]), payoff: parseInt(match[5]) });
    }
  };

  const cleanScoresFromScript = (text: string): string => {
    return text.replace(/---SCORES---.*?---END_SCORES---\s*/s, '').trim();
  };

  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setScript('');
    setActiveStep('script');
    setSyncedScenes([]);
    setScorecard(null);
    setEditMode(false);

    try {
      const viralContext = getViralContext();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic, duration: parseInt(duration), style, niche, language, viralContext }),
      });

      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      if (resp.status === 429) throw new Error('Rate limit. Aguarde e tente novamente.');
      if (!resp.ok || !resp.body) throw new Error('Erro ao gerar roteiro');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullScript = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { fullScript += c; setScript(cleanScoresFromScript(fullScript)); }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
      parseScorecard(fullScript);
      setScript(cleanScoresFromScript(fullScript));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveScript = async () => {
    if (!script) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login'); return; }
    await supabase.from('saved_scripts').insert({ user_id: user.id, topic, duration: parseInt(duration), style, script_content: script } as any);
    toast.success('Roteiro salvo!');
    loadHistory();
  };

  const deleteScript = async (id: string) => {
    await supabase.from('saved_scripts').delete().eq('id', id);
    toast.success('Removido');
    loadHistory();
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Audio handling
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    const audio = new Audio(URL.createObjectURL(file));
    audio.addEventListener('loadedmetadata', () => {
      setAudioDuration(Math.ceil(audio.duration));
    });
  };

  // Add character manually
  const addCharacter = () => {
    if (!newCharName.trim()) return;
    setCharacters(prev => [...prev, {
      name: newCharName.trim(),
      gender: 'male',
      age: 30,
      role: newCharDesc.trim() || 'Personagem',
      appearance: {
        skin_color: 'light tan', hair_color: 'dark brown', hair_style: 'short',
        eye_color: 'brown', body_type: 'average', height: '1.75m',
      },
      facial_features: {
        eyebrows: 'medium arched', nose: 'straight medium', mouth: 'medium lips',
        ears: 'normal size', face_shape: 'oval',
      },
      clothing: {
        shirt: newCharClothing.trim() || 'casual t-shirt',
        pants: 'dark jeans', shoes: 'sneakers', accessories: 'none',
      },
      personality: ['determined', 'curious'],
    }]);
    setNewCharName('');
    setNewCharDesc('');
    setNewCharAppearance('');
    setNewCharClothing('');
  };

  const removeCharacter = (idx: number) => {
    setCharacters(prev => prev.filter((_, i) => i !== idx));
  };

  // Build image prompt from structured character
  const buildCharImagePrompt = (char: Character): string => {
    const a = char.appearance;
    const f = char.facial_features;
    const cl = char.clothing;
    return `Character reference sheet. ${char.gender}, ${char.age} years old. ${a.skin_color} skin, ${a.hair_color} ${a.hair_style} hair, ${a.eye_color} eyes. ${a.body_type} build, ${a.height}. Face: ${f.face_shape} face, ${f.eyebrows} eyebrows, ${f.nose} nose, ${f.mouth}, ${f.ears} ears. Wearing ${cl.shirt}, ${cl.pants}, ${cl.shoes}${cl.accessories !== 'none' ? `, ${cl.accessories}` : ''}. ${char.role}. Full body portrait, clean background, ${VIDEO_STYLES.find(v => v.value === videoStyle)?.desc || 'cinematic style'}. Highly detailed, consistent character design.`;
  };

  // Generate character reference image
  const generateCharacterImage = async (idx: number) => {
    const char = characters[idx];
    if (!char) return;
    setCharacters(prev => prev.map((c, i) => i === idx ? { ...c, generatingImage: true } : c));
    try {
      const prompt = buildCharImagePrompt(char);
      const { data, error } = await supabase.functions.invoke('generate-segment-image', {
        body: { visualPrompt: prompt, textContent: '', segmentIndex: idx },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.imageUrl) {
        setCharacters(prev => prev.map((c, i) => i === idx ? { ...c, imageUrl: data.imageUrl, generatingImage: false } : c));
        toast.success(`Imagem de ${char.name} gerada!`);
      }
    } catch (err: any) {
      toast.error(`Erro ao gerar imagem: ${err.message}`);
      setCharacters(prev => prev.map((c, i) => i === idx ? { ...c, generatingImage: false } : c));
    }
  };

  const generateAllCharacterImages = async () => {
    for (let i = 0; i < characters.length; i++) {
      if (!characters[i].imageUrl) {
        await generateCharacterImage(i);
      }
    }
  };

  // Auto-detect characters from script and generate images
  const autoDetectCharacters = async () => {
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }
    setDetectingCharacters(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-characters', {
        body: { script: cleanScript, language },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const extracted: Character[] = (data.characters || []).map((c: any) => ({
        name: c.name,
        gender: c.gender || 'male',
        age: c.age || 30,
        role: c.role || c.description || 'Personagem',
        appearance: c.appearance || { skin_color: 'light', hair_color: 'dark', hair_style: 'short', eye_color: 'brown', body_type: 'average', height: '1.75m' },
        facial_features: c.facial_features || { eyebrows: 'medium', nose: 'straight', mouth: 'medium', ears: 'normal', face_shape: 'oval' },
        clothing: c.clothing || { shirt: 'casual shirt', pants: 'jeans', shoes: 'sneakers', accessories: 'none' },
        personality: c.personality || ['determined'],
      }));
      if (extracted.length === 0) { toast.info('Nenhum personagem detectado no roteiro.'); return; }
      setCharacters(extracted);
      toast.success(`${extracted.length} personagens detectados! Gerando imagens...`);
      
      // Auto-generate images for all detected characters
      for (let i = 0; i < extracted.length; i++) {
        const char = extracted[i];
        setCharacters(prev => prev.map((c, idx) => idx === i ? { ...c, generatingImage: true } : c));
        try {
          const prompt = buildCharImagePrompt(char);
          const { data: imgData, error: imgErr } = await supabase.functions.invoke('generate-segment-image', {
            body: { visualPrompt: prompt, textContent: '', segmentIndex: i },
          });
          if (!imgErr && imgData?.imageUrl) {
            setCharacters(prev => prev.map((c, idx) => idx === i ? { ...c, imageUrl: imgData.imageUrl, generatingImage: false } : c));
          } else {
            setCharacters(prev => prev.map((c, idx) => idx === i ? { ...c, generatingImage: false } : c));
          }
        } catch {
          setCharacters(prev => prev.map((c, idx) => idx === i ? { ...c, generatingImage: false } : c));
        }
      }
      toast.success('Todos os personagens com imagens geradas!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao detectar personagens');
    } finally {
      setDetectingCharacters(false);
    }
  };

  const getCleanNarration = (): string => {
    // Remove everything after common end markers
    let clean = script;
    const endMarkers = ['## Títulos', '## TÍTULOS', '## Sugestões de Título', '**Títulos**', '**TÍTULOS**', '## Tags', '## SEO', '## Thumbnail', '## THUMBNAIL'];
    for (const marker of endMarkers) {
      const idx = clean.indexOf(marker);
      if (idx > 0) clean = clean.slice(0, idx);
    }
    // Remove markdown formatting
    clean = clean.replace(/^#+\s.*/gm, '');
    clean = clean.replace(/\*\*.*?\*\*/g, '');
    clean = clean.replace(/\[[\d:]+\]/g, '');
    clean = clean.replace(/[*_#>`~]/g, '');
    clean = clean.replace(/\n{3,}/g, '\n\n');
    return clean.trim();
  };

  // Generate synced prompts (text-based fallback)
  const generateSyncedPrompts = async () => {
    const cleanScript = getCleanNarration();
    if (!cleanScript) { toast.error('Gere um roteiro primeiro'); return; }

    setGeneratingPrompts(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-synced-prompts', {
        body: {
          script: cleanScript,
          videoStyle,
          characters: characters.length > 0 ? characters : undefined,
          audioDurationSeconds: audioDuration || undefined,
          sceneDurationSeconds: sceneDuration,
          language,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSyncedScenes(data.scenes || []);
      toast.success(`${data.scenes?.length || 0} cenas sincronizadas geradas!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar prompts');
    } finally {
      setGeneratingPrompts(false);
    }
  };

  // Audio Intelligence: Transcribe + Analyze + Generate Contextual Scenes
  const generateFromAudio = async () => {
    if (!audioFile) { toast.error('Faça upload do áudio narrado primeiro'); return; }
    const cleanScript = getCleanNarration();

    setTranscribing(true);
    setGeneratingPrompts(true);
    setTranscription(null);
    setSyncedScenes([]);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('script', cleanScript || '');
      formData.append('videoStyle', videoStyle);
      formData.append('characters', JSON.stringify(characters));
      formData.append('sceneDuration', String(sceneDuration));
      formData.append('language', language);

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audio-to-scenes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (resp.status === 429) throw new Error('Rate limit. Tente novamente em alguns segundos.');
      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro: ${resp.status}`);
      }

      const data = await resp.json();

      if (data.transcription) {
        setTranscription(data.transcription);
        setAudioDuration(data.transcription.audioDuration || 0);
        setTranscribing(false);
        setShowTranscription(true);
      }

      setSyncedScenes(data.scenes || []);
      toast.success(`🎬 ${data.scenes?.length || 0} cenas contextuais geradas a partir do áudio!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar áudio');
    } finally {
      setTranscribing(false);
      setGeneratingPrompts(false);
    }
  };

  // Duration estimation - more accurate using speech rate per language
  const speechRates: Record<string, number> = {
    'português': 150,
    'inglês': 160,
    'espanhol': 155,
    'polonês': 145,
    'alemão': 140,
    'turco': 150,
    'japonês': 130,
  };
  const wpm = speechRates[language] || 150;
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
  const estimatedMinutes = wordCount > 0 ? (wordCount / wpm) : 0;
  const estimatedMinutesDisplay = `${Math.floor(estimatedMinutes)}:${String(Math.round((estimatedMinutes % 1) * 60)).padStart(2, '0')}`;
  const targetWords = parseInt(duration) * wpm;
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  const activeHook = VIRAL_HOOKS.find(h => h.id === selectedHook);
  const activeCTA = VIRAL_CTAS.find(c => c.id === selectedCTA);
  const activeStructure = STORY_STRUCTURES.find(s => s.id === selectedStructure);
  const viralCount = [selectedHook, selectedCTA, selectedStructure].filter(Boolean).length;

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const pipelineSteps = [
    { key: 'script', label: '1. Roteiro', icon: FileText, done: !!script },
    { key: 'style', label: '2. Estilo Visual', icon: Film, done: !!videoStyle && activeStep !== 'script' },
    { key: 'characters', label: '3. Personagens', icon: Users, done: characters.length > 0 || activeStep === 'prompts' },
    { key: 'prompts', label: '4. Prompts Visuais', icon: Image, done: syncedScenes.length > 0 },
  ] as const;

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
              <p className="text-sm text-muted-foreground">Roteiro → Estilo → Personagens → Prompts Sincronizados</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)} size="sm" className="gap-2">
            <History className="w-4 h-4" /> ({savedScripts.length})
          </Button>
        </div>

        {/* History */}
        {showHistory && savedScripts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5 max-h-48 overflow-y-auto">
            {savedScripts.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5">
                <button onClick={() => { setScript(s.script_content); setTopic(s.topic); setShowHistory(false); setActiveStep('style'); }}
                  className="text-sm text-left flex-1 truncate hover:text-primary transition-colors">
                  {s.topic} ({s.duration}min)
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteScript(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Progress */}
        {script && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-2">
            {pipelineSteps.map((step, i) => (
              <button key={step.key} onClick={() => setActiveStep(step.key as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeStep === step.key
                    ? 'bg-primary text-primary-foreground'
                    : step.done ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/30'
                }`}>
                <step.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{step.label}</span>
                {step.done && activeStep !== step.key && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Config */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm">Configurações</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tópico *</label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Como ganhar dinheiro online em 2026" className="bg-muted/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duração (minutos)</label>
                <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                  <option value="5">5 min (~{5 * wpm} palavras)</option>
                  <option value="10">10 min (~{10 * wpm} palavras)</option>
                  <option value="15">15 min (~{15 * wpm} palavras)</option>
                  <option value="20">20 min (~{20 * wpm} palavras)</option>
                  <option value="30">30 min (~{30 * wpm} palavras)</option>
                  <option value="40">40 min (~{40 * wpm} palavras)</option>
                  <option value="60">60 min (~{60 * wpm} palavras)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estilo do roteiro</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={`text-left p-2 rounded-lg border transition-all text-xs ${
                        style === s.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                      }`}>
                      <span className="font-medium">{s.label}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nicho</label>
                  <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="finanças" className="bg-muted/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Idioma</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                    <option value="português">Português</option>
                    <option value="inglês">English</option>
                    <option value="espanhol">Español</option>
                    <option value="alemão">Deutsch</option>
                    <option value="polonês">Polski</option>
                    <option value="turco">Türkçe</option>
                    <option value="japonês">日本語</option>
                  </select>
                </div>
              </div>
              <Button onClick={generateScript} disabled={loading || !topic.trim()} className="w-full gap-2">
                <Sparkles className="w-4 h-4" />
                {loading ? 'Gerando...' : 'Gerar Roteiro'}
              </Button>
            </div>

            {/* Viral Database Panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setShowViralPanel(!showViralPanel)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-semibold text-xs">Viral Database</span>
                  {viralCount > 0 && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">{viralCount}</Badge>}
                </div>
                {showViralPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showViralPanel && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-2">
                  {/* Hooks */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium flex items-center gap-1"><Zap className="w-3 h-3 text-primary" /> Hook (5s)</label>
                      {selectedHook && <button onClick={() => setSelectedHook(null)} className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>}
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {VIRAL_HOOKS.slice(0, 8).map(h => (
                        <button key={h.id} onClick={() => setSelectedHook(selectedHook === h.id ? null : h.id)}
                          className={`w-full text-left p-1.5 rounded text-[10px] border transition-all ${
                            selectedHook === h.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-1">{h.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* CTAs */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium flex items-center gap-1"><Target className="w-3 h-3 text-primary" /> CTA</label>
                      {selectedCTA && <button onClick={() => setSelectedCTA(null)} className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>}
                    </div>
                    <div className="space-y-1 max-h-[100px] overflow-y-auto">
                      {VIRAL_CTAS.slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => setSelectedCTA(selectedCTA === c.id ? null : c.id)}
                          className={`w-full text-left p-1.5 rounded text-[10px] border transition-all ${
                            selectedCTA === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-1">{c.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Structures */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary" /> Estrutura</label>
                      {selectedStructure && <button onClick={() => setSelectedStructure(null)} className="text-[9px] text-muted-foreground hover:text-destructive">✕</button>}
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {STORY_STRUCTURES.map(s => (
                        <button key={s.id} onClick={() => setSelectedStructure(selectedStructure === s.id ? null : s.id)}
                          className={`w-full text-left p-1.5 rounded text-[10px] border transition-all ${
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
            {/* Script Output */}
            <AnimatePresence mode="wait">
              {(activeStep === 'script' || !script) && (
                <motion.div key="script" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">Roteiro</h3>
                      {script && (
                        <div className="mt-1.5 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {wordCount.toLocaleString()} palavras • {charCount.toLocaleString()} chars • ⏱ {estimatedMinutesDisplay} min
                            {scorecard && <span className="ml-2 text-primary font-medium">• Dual-AI ✓</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            <Progress value={progressPercent} className="h-1.5 flex-1" />
                            <span className={`text-[10px] font-medium ${progressPercent >= 100 ? 'text-emerald-400' : progressPercent >= 70 ? 'text-yellow-400' : 'text-destructive'}`}>
                              {progressPercent}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {script && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setEditMode(!editMode)} className="gap-1 h-7 text-xs">
                          {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                          {editMode ? 'Ler' : 'Editar'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1 h-7 text-xs">
                          <Save className="w-3 h-3" /> Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1 h-7 text-xs">
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="default" onClick={() => setActiveStep('style')} className="gap-1 h-7 text-xs">
                          Próximo <Film className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {!script && !loading && (
                      <Button size="sm" variant="outline" onClick={() => { setEditMode(true); setScript(''); }} className="gap-1 h-7 text-xs">
                        <ClipboardPaste className="w-3 h-3" /> Colar meu roteiro
                      </Button>
                    )}
                  </div>

                  {/* Scorecard */}
                  {scorecard && (
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {[
                        { label: '🎯 Hook', score: scorecard.hook },
                        { label: '📊 Retenção', score: scorecard.retention },
                        { label: '💥 Emoção', score: scorecard.emotion },
                        { label: '🌊 Fluidez', score: scorecard.flow },
                        { label: '🏆 Payoff', score: scorecard.payoff },
                      ].map(({ label, score }) => (
                        <div key={label} className="text-center p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-[9px] text-muted-foreground">{label}</p>
                          <p className={`text-lg font-bold ${score >= 9 ? 'text-emerald-400' : score >= 7 ? 'text-yellow-400' : 'text-destructive'}`}>
                            {score}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {loading && !script && (
                    <div className="text-center py-12">
                      <Zap className="w-10 h-10 mx-auto mb-3 text-primary animate-pulse" />
                      <p className="text-sm text-muted-foreground">Dual-AI: GPT-5 criando → Gemini Pro revisando...</p>
                    </div>
                  )}
                  {script || editMode ? (
                    editMode ? (
                      <textarea
                        value={script}
                        onChange={e => setScript(e.target.value)}
                        placeholder="Cole seu roteiro aqui ou edite o roteiro gerado..."
                        className="w-full min-h-[500px] max-h-[500px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto"
                      />
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[500px] pr-2">
                        <ReactMarkdown>{script}</ReactMarkdown>
                      </div>
                    )
                  ) : !loading && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Configure e gere seu roteiro viral</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Video Style */}
              {activeStep === 'style' && script && (
                <motion.div key="style" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Film className="w-4 h-4 text-accent" /> Estilo Visual do Vídeo</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Escolha como as imagens/cenas serão geradas</p>
                    </div>
                    <Button size="sm" onClick={() => setActiveStep('characters')} className="gap-1 h-7 text-xs">
                      Próximo <Users className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {VIDEO_STYLES.map(vs => (
                      <button key={vs.value} onClick={() => setVideoStyle(vs.value)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          videoStyle === vs.value
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                            : 'border-border hover:border-primary/30'
                        }`}>
                        <span className="text-lg block mb-1">{vs.label.split(' ')[0]}</span>
                        <p className="text-[10px] font-medium text-foreground">{vs.label.split(' ').slice(1).join(' ')}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{vs.desc}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Characters */}
              {activeStep === 'characters' && script && (
                <motion.div key="chars" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Personagens</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Defina personagens para consistência visual entre cenas</p>
                    </div>
                    <Button size="sm" onClick={() => setActiveStep('prompts')} className="gap-1 h-7 text-xs">
                      Próximo <Image className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Auto-detect button */}
                  <Button onClick={autoDetectCharacters} disabled={detectingCharacters} className="w-full gap-2 mb-4" variant="default">
                    {detectingCharacters ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {detectingCharacters ? 'Detectando personagens e gerando imagens...' : '🪄 Detectar Personagens do Roteiro + Gerar Imagens'}
                  </Button>

                  {/* Existing characters */}
                  {characters.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {characters.map((c, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                          <div className="shrink-0">
                            {c.generatingImage ? (
                              <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                              </div>
                            ) : c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-16 h-16 rounded-lg object-cover border border-border" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{c.name} <span className="text-[10px] text-muted-foreground ml-1">({c.gender}, {c.age} anos)</span></p>
                            <p className="text-[10px] text-muted-foreground">{c.role}</p>
                            <p className="text-[10px] text-muted-foreground">👤 {c.appearance.skin_color} skin, {c.appearance.hair_color} {c.appearance.hair_style} hair, {c.appearance.eye_color} eyes</p>
                            <p className="text-[10px] text-muted-foreground">👕 {c.clothing.shirt}, {c.clothing.pants}, {c.clothing.shoes}</p>
                            <p className="text-[10px] text-muted-foreground">🧠 {c.personality.join(', ')}</p>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 mt-1 px-2"
                              disabled={c.generatingImage}
                              onClick={() => generateCharacterImage(i)}>
                              {c.generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                              {c.imageUrl ? 'Regerar imagem' : 'Gerar imagem'}
                            </Button>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeCharacter(i)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <Button onClick={generateAllCharacterImages} variant="outline" size="sm" className="w-full gap-2 text-xs"
                        disabled={characters.some(c => c.generatingImage)}>
                        <Image className="w-3 h-3" /> Gerar imagens de todos os personagens
                      </Button>
                    </div>
                  )}

                  {/* Add character form */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Nome *</label>
                      <Input value={newCharName} onChange={e => setNewCharName(e.target.value)} placeholder="Ex: Narrador" className="bg-muted/30 h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Papel</label>
                      <Input value={newCharDesc} onChange={e => setNewCharDesc(e.target.value)} placeholder="Protagonista" className="bg-muted/30 h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Aparência</label>
                      <Input value={newCharAppearance} onChange={e => setNewCharAppearance(e.target.value)} placeholder="Homem 30 anos, cabelo curto" className="bg-muted/30 h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Roupa</label>
                      <Input value={newCharClothing} onChange={e => setNewCharClothing(e.target.value)} placeholder="Terno azul escuro" className="bg-muted/30 h-8 text-xs" />
                    </div>
                  </div>
                  <Button onClick={addCharacter} disabled={!newCharName.trim()} size="sm" variant="outline" className="mt-2 gap-1 text-xs">
                    <Users className="w-3 h-3" /> Adicionar Manualmente
                  </Button>
                </motion.div>
              )}

              {/* Step 4: Synced Prompts */}
              {activeStep === 'prompts' && script && (
                <motion.div key="prompts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Image className="w-4 h-4 text-accent" /> Prompts Visuais Sincronizados</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Upload do áudio narrado + IA gera prompts sincronizados com o tempo</p>
                    </div>
                  </div>

                  {/* Audio Upload + Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">🎙️ Áudio Narrado (opcional — melhora a sincronização)</label>
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-border hover:border-primary/40 cursor-pointer transition-all bg-muted/20">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {audioFile ? `${audioFile.name} (${formatTime(audioDuration)})` : 'Selecionar áudio .mp3/.wav'}
                          </span>
                          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                        </label>
                        {audioFile && (
                          <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={() => { setAudioFile(null); setAudioDuration(0); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {audioDuration > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <Clock className="w-3 h-3 text-accent" />
                          <span className="text-[10px] text-accent font-medium">Duração do áudio: {formatTime(audioDuration)} → {Math.ceil(audioDuration / sceneDuration)} cenas</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">⏱️ Duração por cena</label>
                      <select value={sceneDuration} onChange={e => setSceneDuration(parseInt(e.target.value))} className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                        <option value={5}>5 segundos</option>
                        <option value={6}>6 segundos</option>
                        <option value={8}>8 segundos (padrão)</option>
                        <option value={10}>10 segundos</option>
                        <option value={12}>12 segundos</option>
                        <option value={15}>15 segundos</option>
                        <option value={20}>20 segundos</option>
                        <option value={30}>30 segundos</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary before generation */}
                  <div className="bg-muted/30 rounded-lg p-3 mb-4 space-y-1">
                    <p className="text-xs font-medium text-foreground">📋 Resumo da Geração:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                      <span>🎬 Estilo: <strong className="text-foreground">{VIDEO_STYLES.find(v => v.value === videoStyle)?.label}</strong></span>
                      <span>👥 Personagens: <strong className="text-foreground">{characters.length || 'Nenhum'}</strong></span>
                      <span>⏱️ Cenas: <strong className="text-foreground">~{audioDuration > 0 ? Math.ceil(audioDuration / sceneDuration) : '?'}</strong></span>
                      <span>🎵 Áudio: <strong className="text-foreground">{audioDuration > 0 ? formatTime(audioDuration) : 'Do texto'}</strong></span>
                    </div>
                  </div>

                  <Button onClick={generateSyncedPrompts} disabled={generatingPrompts} className="w-full gap-2 mb-4">
                    {generatingPrompts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingPrompts ? 'Gerando prompts sincronizados...' : 'Gerar Prompts Sincronizados'}
                  </Button>

                  {/* Generated Scenes */}
                  {syncedScenes.length > 0 && (
                    <div className="space-y-3">
                      {/* AutoFlow Export Label */}
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-foreground">🚀 Exportar para AutoFlow</p>
                        <p className="text-[10px] text-muted-foreground">Cada modo gera o formato exato que o AutoFlow espera. Cole na Prompt List e clique Add to Queue.</p>
                        
                        <div className="grid grid-cols-2 gap-2">
                          {/* Text-to-Video: one prompt per line */}
                          <Button variant="default" className="gap-2 text-xs" onClick={() => {
                            // AutoFlow Text-to-Video: one prompt per line with [V1-S#] tags
                            const lines = syncedScenes.map((scene) => 
                              `[V1-S${scene.sceneIndex + 1}] ${scene.visualPrompt}`
                            ).join('\n');
                            navigator.clipboard.writeText(lines);
                            toast.success(`${syncedScenes.length} prompts copiados para Text-to-Video!`);
                          }}>
                            <Copy className="w-4 h-4" /> 🎬 Text-to-Video ({syncedScenes.length})
                          </Button>

                          {/* Image → Video pipeline: [V#-S#] image prompt ||| [V#-S#] video prompt */}
                          <Button variant="default" className="gap-2 text-xs" onClick={() => {
                            const lines = syncedScenes.map((scene) => {
                              const tag = `[V1-S${scene.sceneIndex + 1}]`;
                              const imagePrompt = scene.visualPrompt;
                              const videoPrompt = `${scene.cameraAngle} shot, ${scene.mood} mood, cinematic motion, ${scene.visualPrompt.slice(0, 120)}`;
                              return `${tag} ${imagePrompt} ||| ${tag} ${videoPrompt}`;
                            }).join('\n');
                            navigator.clipboard.writeText(lines);
                            toast.success(`${syncedScenes.length} prompts Image→Video copiados!`);
                          }}>
                            <Copy className="w-4 h-4" /> 🖼️→🎬 Image→Video ({syncedScenes.length})
                          </Button>

                          {/* Create Image only */}
                          <Button variant="outline" className="gap-2 text-xs" onClick={() => {
                            const lines = syncedScenes.map((scene) => 
                              `[V1-S${scene.sceneIndex + 1}] ${scene.visualPrompt}`
                            ).join('\n');
                            navigator.clipboard.writeText(lines);
                            toast.success(`${syncedScenes.length} prompts de imagem copiados!`);
                          }}>
                            <Copy className="w-4 h-4" /> 🖼️ Create Image ({syncedScenes.length})
                          </Button>

                          {/* Ingredients mode - refs + prompts */}
                          <Button variant="outline" className="gap-2 text-xs" onClick={() => {
                            const lines = syncedScenes.map((scene) => 
                              `[V1-S${scene.sceneIndex + 1}] ${scene.visualPrompt}`
                            ).join('\n');
                            navigator.clipboard.writeText(lines);
                            toast.success(`${syncedScenes.length} prompts para Ingredients copiados!`);
                          }}>
                            <Copy className="w-4 h-4" /> 🧩 Ingredients ({syncedScenes.length})
                          </Button>
                        </div>
                      </div>

                      {/* Other exports */}
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" className="gap-2 text-xs" onClick={() => {
                          const fullJson = {
                            project: {
                              topic, duration: parseInt(duration), language, style, videoStyle,
                              totalScenes: syncedScenes.length,
                              estimatedDuration: audioDuration > 0 ? audioDuration : syncedScenes.length * sceneDuration,
                              sceneDuration, wordCount, generatedAt: new Date().toISOString(),
                            },
                            script: { fullText: getCleanNarration(), wordCount, estimatedMinutes: estimatedMinutesDisplay },
                            characters: characters.map(c => ({
                              name: c.name, gender: c.gender, age: c.age, role: c.role,
                              appearance: c.appearance, facial_features: c.facial_features,
                              clothing: c.clothing, personality: c.personality,
                              referenceImageUrl: c.imageUrl || null,
                            })),
                            scenes: syncedScenes.map(scene => ({
                              sceneIndex: scene.sceneIndex + 1, startTime: scene.startTime, endTime: scene.endTime,
                              duration: scene.endTime - scene.startTime,
                              timestamp: `${formatTime(scene.startTime)} - ${formatTime(scene.endTime)}`,
                              visualPrompt: scene.visualPrompt, cameraAngle: scene.cameraAngle,
                              mood: scene.mood, charactersInScene: scene.charactersInScene || [],
                              transitionNote: scene.transitionNote || null,
                            })),
                          };
                          navigator.clipboard.writeText(JSON.stringify(fullJson, null, 2));
                          toast.success(`JSON completo copiado!`);
                        }}>
                          <Copy className="w-4 h-4" /> JSON Completo
                        </Button>

                        <Button variant="outline" className="gap-2 text-xs" onClick={() => {
                          const allPrompts = syncedScenes.map((scene) => 
                            `Cena ${scene.sceneIndex + 1} [${formatTime(scene.startTime)} - ${formatTime(scene.endTime)}] (${scene.cameraAngle} | ${scene.mood}):\n${scene.visualPrompt}${scene.charactersInScene?.length ? `\nPersonagens: ${scene.charactersInScene.join(', ')}` : ''}`
                          ).join('\n\n---\n\n');
                          navigator.clipboard.writeText(allPrompts);
                          toast.success('Prompts detalhados copiados!');
                        }}>
                          <Copy className="w-4 h-4" /> Detalhado
                        </Button>

                        <Button variant="outline" className="gap-2 text-xs" onClick={() => {
                          const charsJson = characters.map(c => ({
                            name: c.name, gender: c.gender, age: c.age, role: c.role,
                            appearance: c.appearance, facial_features: c.facial_features,
                            clothing: c.clothing, personality: c.personality,
                          }));
                          navigator.clipboard.writeText(JSON.stringify(charsJson, null, 2));
                          toast.success(`JSON de ${characters.length} personagens copiado!`);
                        }}>
                          <Copy className="w-4 h-4" /> Personagens JSON
                        </Button>
                      </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {syncedScenes.map((scene, i) => (
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
                          <p className="text-xs text-foreground leading-relaxed">{scene.visualPrompt}</p>
                          {scene.charactersInScene && scene.charactersInScene.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {scene.charactersInScene.map((c, ci) => (
                                <Badge key={ci} variant="secondary" className="text-[9px]">👤 {c}</Badge>
                              ))}
                            </div>
                          )}
                          {scene.transitionNote && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">↗ {scene.transitionNote}</p>
                          )}
                          <div className="mt-2">
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1"
                              onClick={() => { navigator.clipboard.writeText(scene.visualPrompt); toast.success('Prompt copiado!'); }}>
                              <Copy className="w-3 h-3" /> Copiar prompt
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
