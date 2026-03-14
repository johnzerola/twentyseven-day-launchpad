import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuthHeaders } from '@/lib/auth-fetch';
import { FileText, Sparkles, Copy, Check, Save, Edit3, Eye, ClipboardPaste, Loader2, Zap, Film, Brain, Wand2, Shield, CheckCircle2, ArrowRight, ArrowLeft, RotateCcw, AlertTriangle, RefreshCw, Smartphone, Monitor, Lightbulb, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { VIDEO_TYPES, VIDEO_TYPE_DEFAULTS, type VideoType } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════ NICHE PRESETS ═══════
const NICHE_PRESETS: Record<string, { label: string; emoji: string; styles: string[]; topics: string[]; defaultDuration: number; tips: string }> = {
  finanças: { label: 'Finanças', emoji: '💰', styles: ['dopaminérgico', 'educativo', 'listicle'], topics: ['Como investir R$100 por mês e ficar rico', '5 erros que te mantêm pobre', 'A verdade sobre renda passiva em 2026'], defaultDuration: 15, tips: 'Use números específicos, mostre resultados reais, evite promessas vazias.' },
  terror: { label: 'Terror/Horror', emoji: '👻', styles: ['narração', 'storytelling', 'reddit'], topics: ['A floresta que ninguém ousa entrar', 'O que encontraram debaixo daquela casa', 'Relatos reais que a ciência não explica'], defaultDuration: 20, tips: 'Construa tensão gradual, use silêncios narrativos, detalhes sensoriais.' },
  tecnologia: { label: 'Tecnologia', emoji: '🤖', styles: ['educativo', 'dopaminérgico', 'documentário'], topics: ['IA vai substituir seu trabalho em 2026?', 'O chip que mudou TUDO', '5 tecnologias que vão explodir este ano'], defaultDuration: 12, tips: 'Analogias simples para conceitos complexos, demonstrações visuais.' },
  ciência: { label: 'Ciência', emoji: '🔬', styles: ['documentário', 'cinematográfico', 'teorias'], topics: ['O que acontece se você cair num buraco negro', 'A partícula que não deveria existir', 'Por que o tempo não é real'], defaultDuration: 15, tips: 'Comece com dado chocante, use escalas comparativas, mistério + revelação.' },
  gaming: { label: 'Gaming', emoji: '🎮', styles: ['dopaminérgico', 'mrbeast', 'listicle'], topics: ['O jogo mais difícil já criado', '24h jogando o pior jogo da história', 'Easter eggs que 99% não conhecem'], defaultDuration: 15, tips: 'Energia alta, cortes rápidos, desafios impossíveis, reações genuínas.' },
  história: { label: 'História', emoji: '📜', styles: ['documentário', 'cinematográfico', 'storytelling'], topics: ['O império que o mundo esqueceu', 'A batalha mais insana da história', 'O segredo que mudou uma civilização'], defaultDuration: 20, tips: 'Narrativa como filme, personagens com motivação, conexão passado-presente.' },
  saúde: { label: 'Saúde/Fitness', emoji: '💪', styles: ['educativo', 'tutorial', 'dopaminérgico'], topics: ['O exercício que muda seu corpo em 30 dias', 'Alimentos que estão te matando lentamente', '5 hábitos de quem vive 100 anos'], defaultDuration: 12, tips: 'Resultados visuais, antes/depois, desmistifique mitos populares.' },
  true_crime: { label: 'True Crime', emoji: '🔍', styles: ['narração', 'conspiração', 'documentário'], topics: ['O caso que a polícia nunca resolveu', 'O serial killer que ninguém suspeitava', 'A evidência que mudou tudo'], defaultDuration: 25, tips: 'Timeline cronológica, revelações progressivas, múltiplas perspectivas.' },
  mitologia: { label: 'Mitologia', emoji: '⚡', styles: ['mitologia', 'cinematográfico', 'storytelling'], topics: ['O deus que desafiou o próprio destino', 'A criatura mais temida da mitologia nórdica', 'A guerra dos deuses que destruiu o mundo'], defaultDuration: 20, tips: 'Tom épico, descreva cenários grandiosos, conecte mito com lição moderna.' },
  curiosidades: { label: 'Curiosidades', emoji: '🧠', styles: ['dopaminérgico', 'listicle', 'educativo'], topics: ['15 fatos que vão explodir sua mente', 'Coisas proibidas ao redor do mundo', 'O que acontece se você NÃO dormir por 7 dias'], defaultDuration: 15, tips: 'Escalada de impacto, cada fato mais surpreendente que o anterior.' },
  relacionamentos: { label: 'Relacionamentos', emoji: '❤️', styles: ['storytelling', 'reddit', 'educativo'], topics: ['Sinais que ele/ela não te ama de verdade', 'A psicologia por trás da atração', 'O que ninguém te conta sobre morar junto'], defaultDuration: 12, tips: 'Histórias reais, vulnerabilidade, psicologia aplicada.' },
  empreendedorismo: { label: 'Empreendedorismo', emoji: '🚀', styles: ['dopaminérgico', 'educativo', 'mrbeast'], topics: ['De R$0 a R$100k em 12 meses', 'O negócio que ninguém está fazendo', '3 ideias de negócio para 2026'], defaultDuration: 15, tips: 'Case studies reais, números específicos, passo-a-passo acionável.' },
};

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
  { value: 'reddit', label: '🗣️ Reddit Stories', desc: 'Narração 1ª pessoa, tom confessional, animação 2D' },
  { value: 'conspiração', label: '🔍 Conspiração/Mistério', desc: 'Investigação profunda, evidências progressivas' },
  { value: 'mitologia', label: '⚡ Mitologia Épica', desc: 'Mitos gregos, nórdicos, egípcios — tom grandioso' },
  { value: 'teorias', label: '🌊 Teorias & Mistérios', desc: 'Pirâmides, oceano, civilizações perdidas' },
];

interface ScriptGeneratorProps {
  topic: string;
  setTopic: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  niche: string;
  setNiche: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  script: string;
  setScript: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  scorecard: { hook: number; retention: number; emotion: number; flow: number; payoff: number } | null;
  setScorecard: (v: any) => void;
  setActiveStep: (v: 'script' | 'style' | 'characters' | 'prompts' | 'titles') => void;
  getViralContext: () => string;
  getOrCreateProject: () => Promise<string>;
  intelligenceBriefing: any;
  setIntelligenceBriefing: (v: any) => void;
  setSceneBlueprintJson: (v: any[]) => void;
  onScriptGenerated?: () => void;
  videoType: VideoType;
  setVideoType: (v: VideoType) => void;
  selectedChannelId: string | null;
  setSelectedChannelId: (v: string | null) => void;
  userChannels: any[];
}

const SPEECH_RATES: Record<string, number> = {
  'português': 150, 'inglês': 160, 'espanhol': 155,
  'polonês': 145, 'alemão': 140, 'turco': 150, 'japonês': 130,
  'francês': 155, 'italiano': 155, 'tcheco': 145, 'holandês': 150,
  'coreano': 135, 'hindi': 145, 'árabe': 140, 'indonésio': 150,
  'tailandês': 140, 'vietnamita': 145, 'romeno': 150, 'húngaro': 145,
  'sueco': 150, 'norueguês': 150, 'dinamarquês': 150, 'finlandês': 140,
};

type WizardStep = 0 | 1 | 2 | 3;

const WIZARD_STEPS = [
  { label: 'Configuração', icon: FileText, desc: 'Defina tópico, estilo e idioma' },
  { label: 'Rascunho IA', icon: Zap, desc: 'Gemini gera o rascunho — revise e edite' },
  { label: 'Refinamento IA', icon: Brain, desc: 'Gemini Pro melhora pontos fracos' },
  { label: 'Avaliação Dual', icon: Shield, desc: 'GPT + Gemini avaliam (mín. 14/20)' },
];

interface DualScore {
  approved: boolean;
  combinedScore: number;
  gpt_score: number;
  gemini_score: number;
  gpt_details: any;
  gemini_details: any;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
}

export const ScriptGenerator = ({
  topic, setTopic, duration, setDuration, style, setStyle,
  niche, setNiche, language, setLanguage, script, setScript,
  loading, setLoading, scorecard, setScorecard, setActiveStep,
  getViralContext, getOrCreateProject, intelligenceBriefing,
  setIntelligenceBriefing, setSceneBlueprintJson, onScriptGenerated,
  videoType, setVideoType, selectedChannelId, setSelectedChannelId, userChannels,
}: ScriptGeneratorProps) => {
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [draftScript, setDraftScript] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [dualScore, setDualScore] = useState<DualScore | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  const lastClickRef = useRef(0);

  // Debounce guard for generation buttons (3s cooldown)
  const canClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 3000) return false;
    lastClickRef.current = now;
    return true;
  }, []);

  // ═══════ SUGGESTION BANK (from Dotti) ═══════
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const loadSuggestions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setLoadingSuggestions(true);
      let query = supabase
        .from('dotti_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (selectedChannelId) {
        query = query.eq('channel_id', selectedChannelId);
      }
      const { data } = await query;
      setSuggestions((data as any[]) || []);
      setLoadingSuggestions(false);
    };
    loadSuggestions();
  }, [selectedChannelId]);

  const applySuggestion = (s: any) => {
    setTopic(s.title || s.topic || '');
    if (s.niche) setNiche(s.niche);
    if (s.style) setStyle(s.style);
    if (s.language) setLanguage(s.language);
    setShowSuggestions(false);
    toast.success('💡 Sugestão aplicada! Ajuste e gere o roteiro.');
    // Increment used_count
    supabase.from('dotti_suggestions').update({ used_count: (s.used_count || 0) + 1, updated_at: new Date().toISOString() } as any).eq('id', s.id).then();
  };

  const deleteSuggestion = async (id: string) => {
    await supabase.from('dotti_suggestions').delete().eq('id', id);
    setSuggestions(prev => prev.filter(s => s.id !== id));
    toast.success('Sugestão removida');
  };

  const wpm = SPEECH_RATES[language] || 150;
  const currentScript = wizardStep === 1 ? draftScript : script;
  const wordCount = currentScript.split(/\s+/).filter(Boolean).length;
  const charCount = currentScript.length;
  const durationMinutes = videoType === 'short' ? parseInt(duration) / 60 : parseInt(duration);
  const estimatedMinutes = wordCount > 0 ? (wordCount / wpm) : 0;
  const estimatedMinutesDisplay = `${Math.floor(estimatedMinutes)}:${String(Math.round((estimatedMinutes % 1) * 60)).padStart(2, '0')}`;
  const targetWords = Math.round(durationMinutes * wpm);
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  const parseScorecard = (text: string) => {
    const match = text.match(/---SCORES---\s*hook:(\d+)\s*retention:(\d+)\s*emotion:(\d+)\s*flow:(\d+)\s*payoff:(\d+)\s*---END_SCORES---/);
    if (match) {
      setScorecard({ hook: parseInt(match[1]), retention: parseInt(match[2]), emotion: parseInt(match[3]), flow: parseInt(match[4]), payoff: parseInt(match[5]) });
    }
  };

  const cleanScoresFromScript = (text: string): string => text.replace(/---SCORES---.*?---END_SCORES---\s*/s, '').trim();

  const parseSceneBlueprint = (text: string): any[] => {
    const match = text.match(/---SCENE_BLUEPRINT---\s*([\s\S]*?)\s*---END_SCENE_BLUEPRINT---/);
    if (!match) return [];
    try {
      const arrMatch = match[1].trim().match(/\[[\s\S]*\]/);
      if (arrMatch) return JSON.parse(arrMatch[0]);
    } catch { /* ignore */ }
    return [];
  };

  const cleanBlueprintFromScript = (text: string): string => text.replace(/---SCENE_BLUEPRINT---[\s\S]*?---END_SCENE_BLUEPRINT---\s*/g, '').trim();
  const cleanShortMeta = (text: string): string => text.replace(/---SHORT_META---[\s\S]*?---END_SHORT_META---\s*/g, '').trim();
  const cleanAll = (text: string) => cleanShortMeta(cleanBlueprintFromScript(cleanScoresFromScript(text)));

  const streamFromFunction = async (fnName: string, body: any, onDelta: (text: string) => void): Promise<string> => {
    const headers = await getAuthHeaders();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (resp.status === 402) throw new Error('Créditos insuficientes.');
    if (resp.status === 429) throw new Error('Rate limit. Aguarde e tente novamente.');
    if (!resp.ok || !resp.body) throw new Error(`Erro na função ${fnName}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

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
          if (c) { fullText += c; onDelta(fullText); }
        } catch { buffer = line + '\n' + buffer; break; }
      }
    }
    return fullText;
  };

  // ═══════ ORCHESTRATION: Phase tracking ═══════
  const phaseIdRef = useRef('');

  // ═══════ STEP 1: Generate Draft ═══════
  const runStep1_Draft = async (rejectionFeedback?: any) => {
    if (!topic.trim() || generating || !canClick()) return;
    // Generate unique phase ID for this entire run (tracks across all phases)
    phaseIdRef.current = crypto.randomUUID();
    console.log(`[ORCHESTRATOR] New run: ${phaseIdRef.current}`);
    
    setGenerating(true);
    setLoading(true);
    setDraftScript('');
    setScript('');
    setScorecard(null);
    setDualScore(null);
    setSceneBlueprintJson([]);
    setWizardStep(1);
    setEditMode(false);

    try {
      // Shorts use dedicated ShortSpy analysis; Longform uses analyze-topic
      if (videoType === 'short') {
        setPhaseLabel('📱 Analisando Shorts virais do nicho...');
        try {
          const { data, error } = await supabase.functions.invoke('analyze-short-video', {
            body: { topic, niche, language, count: 8 },
          });
          if (!error && data?.analysis) {
            setIntelligenceBriefing({ shortspy: data.analysis, shorts: data.shorts, metadata: data.metadata });
            toast.success(`📱 ${data.metadata?.shorts_found || 0} Shorts virais analisados`);
          }
        } catch (err) { console.warn('ShortSpy failed:', err); }

        setPhaseLabel(retryCount > 0 ? `📱 Gerando Short (tentativa ${retryCount + 1})...` : '📱 Gerando roteiro de Short viral...');
        const viralContext = getViralContext();

        const rawDraft = await streamFromFunction('generate-script-short', {
          topic, durationSeconds: parseInt(duration), style, niche, language, viralContext,
        }, (fullText) => {
          setDraftScript(cleanAll(fullText));
        });

        setDraftScript(cleanAll(rawDraft));
        setPhaseLabel('');

        // Shorts auto-skip refinement → go straight to scoring
        toast.success('📱 Short pronto! Avaliando automaticamente...');
        setScript(cleanAll(rawDraft));
        setGenerating(false);
        setLoading(false);
        await runStep3_DualScoreWithText(cleanAll(rawDraft));
      } else {
        setPhaseLabel('🔍 Analisando inteligência competitiva...');
        let briefing = null;
        try {
          const { data, error } = await supabase.functions.invoke('analyze-topic', {
            body: { topic, niche, style, language },
          });
          if (!error && data?.briefing) {
            briefing = data.briefing;
            setIntelligenceBriefing(data);
            toast.success(`📊 ${data.metadata?.channelsAnalyzed || 0} canais + ${data.metadata?.youtubeVideosFound || 0} vídeos analisados`);
          }
        } catch (err) { console.warn('Intelligence failed:', err); }

        setPhaseLabel(retryCount > 0 ? `✍️ Gemini gerando novo rascunho (tentativa ${retryCount + 1})...` : '✍️ Gemini está gerando seu rascunho...');
        const viralContext = getViralContext();
        
        const rawDraft = await streamFromFunction('generate-script', {
          topic, duration: parseInt(duration),
          style, niche, language,
          viralContext, intelligenceBriefing: briefing,
          videoType,
          phaseId: phaseIdRef.current,
        }, (fullText) => {
          setDraftScript(cleanAll(fullText));
        });

        const blueprint = parseSceneBlueprint(rawDraft);
        if (blueprint.length > 0) setSceneBlueprintJson(blueprint);
        setDraftScript(cleanAll(rawDraft));
        setPhaseLabel('');
        toast.success('✍️ Rascunho pronto! Revise, edite e clique em "Próxima Etapa".');
      }

    } catch (err: any) {
      toast.error(err.message);
      setWizardStep(0);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // ═══════ STEP 2: Refine with Gemini Pro ═══════
  const runStep2_Refine = async (rejectionFeedback?: any) => {
    if (generating || !canClick()) return;
    setGenerating(true);
    setLoading(true);
    setScript('');
    setWizardStep(2);
    setEditMode(false);
    setPhaseLabel('🧠 Gemini Pro está melhorando os pontos fracos...');

    try {
      const refinedRaw = await streamFromFunction('refine-script', {
        draft_script: draftScript,
        niche, language, duration: parseInt(duration), style,
        target_words: targetWords,
        rejection_feedback: rejectionFeedback || null,
        phaseId: phaseIdRef.current,
      }, (fullText) => {
        setScript(cleanAll(fullText));
      });

      parseScorecard(refinedRaw);
      const refinedBlueprint = parseSceneBlueprint(refinedRaw);
      if (refinedBlueprint.length > 0) setSceneBlueprintJson(refinedBlueprint);
      setScript(cleanAll(refinedRaw));
      setPhaseLabel('');
      toast.success('🧠 Gemini Pro melhorou os pontos fracos! Revise e clique em "Avaliar".');

    } catch (err: any) {
      toast.error(`Refinamento falhou: ${err.message}. Usando rascunho.`);
      setScript(draftScript);
      setPhaseLabel('');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // ═══════ Find consensus between GPT & Gemini ═══════
  const findConsensusImprovements = (gptWeaknesses: string[], geminiWeaknesses: string[], gptImprovements: string[], geminiImprovements: string[]): string[] => {
    const all = [...gptWeaknesses, ...gptImprovements, ...geminiWeaknesses, ...geminiImprovements];
    const consensus: string[] = [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Find items that appear in BOTH AI outputs (similar meaning)
    const gptItems = [...gptWeaknesses, ...gptImprovements].map(normalize);
    const geminiItems = [...geminiWeaknesses, ...geminiImprovements].map(normalize);
    
    for (const gItem of gptItems) {
      for (const gemItem of geminiItems) {
        // Check for keyword overlap (at least 2 shared words of 4+ chars)
        const gWords = gItem.split(/\s+/).filter(w => w.length >= 4);
        const gemWords = gemItem.split(/\s+/).filter(w => w.length >= 4);
        const shared = gWords.filter(w => gemWords.some(gw => gw.includes(w) || w.includes(gw)));
        if (shared.length >= 2) {
          // Find the original (non-normalized) version
          const original = all.find(a => normalize(a) === gItem || normalize(a) === gemItem);
          if (original && !consensus.includes(original)) consensus.push(original);
        }
      }
    }
    
    // If no keyword overlap found, merge all unique improvements
    if (consensus.length === 0) {
      return [...new Set([...gptImprovements, ...geminiImprovements])].slice(0, 5);
    }
    return consensus.slice(0, 5);
  };

  // ═══════ Auto-refine with consensus improvements ═══════
  const autoRefineWithConsensus = async (textToRefine: string, improvements: string[]): Promise<string> => {
    setPhaseLabel('🔧 Aplicando melhorias consensuais automaticamente...');
    toast.info('🔧 Ambas IAs concordaram em melhorias — aplicando automaticamente...');
    
    try {
      const refined = await streamFromFunction('refine-script', {
        draft_script: textToRefine,
        niche, language, duration: parseInt(duration), style,
        target_words: targetWords,
        consensus_improvements: improvements,
        phaseId: phaseIdRef.current,
      }, (fullText) => {
        setScript(cleanAll(fullText));
      });
      
      return cleanAll(refined);
    } catch (err: any) {
      console.warn('Auto-refine failed, using original:', err);
      return textToRefine;
    }
  };

  // ═══════ STEP 3: Dual AI Scoring ═══════
  const runStep3_DualScoreWithText = async (scriptText?: string) => {
    const textToScore = scriptText || script;
    setGenerating(true);
    setLoading(true);
    setWizardStep(3);
    if (scriptText) setScript(scriptText);
    setDualScore(null);
    setPhaseLabel('🛡️ GPT e Gemini estão avaliando o roteiro...');

    try {
      const { data, error } = await supabase.functions.invoke('score-script', {
        body: { script: textToScore.slice(0, 12000), niche, style, language, topic, phaseId: phaseIdRef.current },
      });

      if (error) throw new Error(error.message || 'Erro na avaliação');

      const result: DualScore = data;

      if (result.approved) {
        // Check if both AIs agree on improvements even though approved
        const consensusImprovements = findConsensusImprovements(
          result.weaknesses || [], [], result.improvements || [], []
        );

        if (consensusImprovements.length > 0 && result.combinedScore < 18) {
          // Auto-improve before delivering
          setPhaseLabel('🔧 Aplicando melhorias consensuais...');
          const improvedText = await autoRefineWithConsensus(textToScore, consensusImprovements);
          setScript(improvedText);
          
          // Re-score the improved version
          setPhaseLabel('🛡️ Re-avaliando roteiro melhorado...');
          const { data: reScoreData } = await supabase.functions.invoke('score-script', {
            body: { script: improvedText.slice(0, 12000), niche, style, language, topic, phaseId: phaseIdRef.current },
          });
          
          if (reScoreData && reScoreData.approved) {
            setDualScore(reScoreData);
            toast.success(`✅ APROVADO (melhorado)! Score: ${reScoreData.combinedScore}/20 (era ${result.combinedScore}/20)`);
          } else {
            setDualScore(reScoreData || result);
            toast.success(`✅ APROVADO! Score: ${result.combinedScore}/20`);
          }
        } else {
          setDualScore(result);
          toast.success(`✅ APROVADO! Score: ${result.combinedScore}/20 (GPT: ${result.gpt_score} + Gemini: ${result.gemini_score})`);
        }
        
        // Save to project
        try {
          const pid = await getOrCreateProject();
          await supabase.from('video_projects').update({
            intelligence_json: intelligenceBriefing || {},
            scene_blueprint_json: parseSceneBlueprint(script),
          } as any).eq('id', pid);
        } catch { /* non-critical */ }

        supabase.functions.invoke('learn-from-user', {
          body: { type: 'script_approved', data: { topic, niche, style, duration, combined_score: result.combinedScore } },
        }).catch(() => {});

        onScriptGenerated?.();
      } else {
        // REJECTED — find consensus improvements
        const gptW = result.gpt_details?.weaknesses || result.weaknesses?.slice(0, 3) || [];
        const gemW = result.gemini_details?.weaknesses || result.weaknesses?.slice(3) || [];
        const gptI = result.gpt_details?.improvements || result.improvements?.slice(0, 3) || [];
        const gemI = result.gemini_details?.improvements || result.improvements?.slice(3) || [];
        
        const consensusImprovements = findConsensusImprovements(gptW, gemW, gptI, gemI);
        
        if (consensusImprovements.length > 0 && retryCount < MAX_RETRIES) {
          // Auto-refine with consensus and re-evaluate
          toast.info(`🔄 Ambas IAs concordaram em ${consensusImprovements.length} melhorias — aplicando automaticamente...`);
          setRetryCount(prev => prev + 1);
          
          const improvedText = await autoRefineWithConsensus(textToScore, consensusImprovements);
          setScript(improvedText);
          
          // Re-score
          setPhaseLabel('🛡️ Re-avaliando roteiro melhorado...');
          const { data: reScoreData } = await supabase.functions.invoke('score-script', {
            body: { script: improvedText.slice(0, 12000), niche, style, language, topic, phaseId: phaseIdRef.current },
          });
          
          if (reScoreData) {
            setDualScore(reScoreData);
            if (reScoreData.approved) {
              toast.success(`✅ APROVADO após melhoria! Score: ${reScoreData.combinedScore}/20 (era ${result.combinedScore}/20)`);
              
              try {
                const pid = await getOrCreateProject();
                await supabase.from('video_projects').update({
                  intelligence_json: intelligenceBriefing || {},
                } as any).eq('id', pid);
              } catch { /* non-critical */ }
              
              onScriptGenerated?.();
            } else {
              toast.error(`❌ Ainda reprovado: ${reScoreData.combinedScore}/20. Edite manualmente ou refaça.`);
            }
          } else {
            setDualScore(result);
            toast.error(`❌ REPROVADO: ${result.combinedScore}/20 (mínimo 14)`);
          }
        } else {
          setDualScore(result);
          toast.error(`❌ REPROVADO: ${result.combinedScore}/20 (mínimo 14). GPT: ${result.gpt_score} | Gemini: ${result.gemini_score}`);
        }
      }

      setPhaseLabel('');

    } catch (err: any) {
      toast.error(err.message);
      setPhaseLabel('');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // ═══════ AUTO-RETRY: Rejected → Redo from draft ═══════
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRIES) {
      toast.error('Limite de tentativas atingido. Edite manualmente ou mude o tópico.');
      return;
    }

    const feedback = dualScore ? {
      reason: `Score ${dualScore.combinedScore}/20 (abaixo de 14)`,
      weaknesses: dualScore.weaknesses,
      improvements: dualScore.improvements,
      gpt_score: dualScore.gpt_score,
      gemini_score: dualScore.gemini_score,
    } : null;

    setRetryCount(prev => prev + 1);
    setDualScore(null);
    
    // Go back to step 1 and regenerate with feedback
    toast.info(`🔄 Regenerando roteiro (tentativa ${retryCount + 2}/${MAX_RETRIES + 1})...`);
    await runStep1_Draft(feedback);
  };

  const saveScript = async () => {
    const textToSave = wizardStep === 1 ? draftScript : script;
    if (!textToSave) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login'); return; }
    await supabase.from('saved_scripts').insert({ user_id: user.id, topic, duration: parseInt(duration), style, script_content: textToSave, video_type: videoType } as any);
    toast.success('Roteiro salvo!');
  };

  const copyScript = () => {
    const text = wizardStep === 1 ? draftScript : script;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const resetWizard = () => {
    setWizardStep(0);
    setDraftScript('');
    setScript('');
    setScorecard(null);
    setDualScore(null);
    setPhaseLabel('');
    setEditMode(false);
    setRetryCount(0);
  };

  const activeText = wizardStep === 1 ? draftScript : script;

  return (
    <>
      {/* ═══════ WIZARD STEPPER ═══════ */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-1">
          {WIZARD_STEPS.map((step, i) => {
            const isActive = wizardStep === i;
            const isDone = wizardStep > i;
            const StepIcon = step.icon;
            return (
              <div key={i} className="flex-1 flex flex-col items-center text-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  isActive ? 'bg-primary/20 text-primary border border-primary/30 ring-2 ring-primary/20' :
                  'bg-muted/30 text-muted-foreground border border-border/50'
                }`}>
                  {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-primary' : isDone ? 'text-emerald-400' : 'text-muted-foreground/60'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {phaseLabel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            {phaseLabel}
          </motion.div>
        )}
        {retryCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <RefreshCw className="w-3 h-3" />
            Tentativa {retryCount + 1}/{MAX_RETRIES + 1} — IA aprendendo com erros anteriores
          </div>
        )}
      </div>

      {/* ═══════ STEP 0: Config ═══════ */}
      <AnimatePresence mode="wait">
        {wizardStep === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">1. Configurações do Roteiro</h3>

            {/* ═══════ NICHE QUICK-START PRESETS ═══════ */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">⚡ Quick Start — Escolha seu nicho</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {Object.entries(NICHE_PRESETS).map(([key, preset]) => (
                  <button key={key} onClick={() => {
                    setNiche(key);
                    if (!style || !preset.styles.includes(style)) setStyle(preset.styles[0]);
                    if (videoType === 'long') setDuration(String(preset.defaultDuration));
                    toast.success(`${preset.emoji} Nicho "${preset.label}" configurado! Escolha um tópico abaixo.`);
                  }}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all text-[10px] ${
                      niche === key ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                    }`}>
                    <span className="text-base">{preset.emoji}</span>
                    <span className="font-medium truncate w-full text-center">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ═══════ NICHE TOPIC SUGGESTIONS ═══════ */}
            {niche && NICHE_PRESETS[niche] && (
              <div className="border border-accent/20 rounded-lg p-3 bg-accent/5 space-y-2">
                <p className="text-xs font-medium text-accent flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Tópicos sugeridos para {NICHE_PRESETS[niche].label}
                </p>
                <div className="space-y-1">
                  {NICHE_PRESETS[niche].topics.map((t, i) => (
                    <button key={i} onClick={() => { setTopic(t); toast.success('Tópico aplicado!'); }}
                      className="w-full text-left p-1.5 rounded-md hover:bg-secondary/50 transition-colors text-xs text-foreground/80 hover:text-foreground">
                      {NICHE_PRESETS[niche].emoji} {t}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">💡 Dica: {NICHE_PRESETS[niche].tips}</p>
              </div>
            )}

            {/* ═══════ CHANNEL SELECTOR ═══════ */}
            {userChannels.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Canal (opcional)</label>
                <select
                  value={selectedChannelId || ''}
                  onChange={e => {
                    const id = e.target.value || null;
                    setSelectedChannelId(id);
                    if (id) {
                      const ch = userChannels.find((c: any) => c.id === id);
                      if (ch) {
                        if (ch.niche && !niche) setNiche(ch.niche);
                        if (ch.language) setLanguage(ch.language === 'en' ? 'inglês' : ch.language === 'pt' ? 'português' : ch.language === 'es' ? 'espanhol' : ch.language);
                      }
                    }
                  }}
                  className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm"
                >
                  <option value="">Nenhum canal selecionado</option>
                  {userChannels.map((ch: any) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.channel_name} {ch.niche ? `(${ch.niche})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ═══════ SUGGESTION BANK ═══════ */}
            {suggestions.length > 0 && (
              <div className="border border-primary/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-primary/5 hover:bg-primary/10 transition-colors text-xs"
                >
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Lightbulb className="w-3.5 h-3.5" />
                    💡 Banco de Ideias do Dotti ({suggestions.length})
                  </span>
                  {showSuggestions ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {showSuggestions && (
                  <div className="max-h-[200px] overflow-y-auto p-2 space-y-1.5">
                    {suggestions.map(s => (
                      <div key={s.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group">
                        <button onClick={() => applySuggestion(s)} className="flex-1 text-left">
                          <p className="text-xs font-medium text-foreground truncate">{s.title || s.topic || 'Sem título'}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{s.content?.slice(0, 120)}...</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                            {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            {s.used_count > 0 && ` • usado ${s.used_count}x`}
                          </p>
                        </button>
                        <button onClick={() => deleteSuggestion(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Video Type Toggle */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tipo de conteúdo</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_TYPES.map(vt => (
                  <button key={vt.value} onClick={() => {
                    setVideoType(vt.value);
                    const defaults = VIDEO_TYPE_DEFAULTS[vt.value];
                    setDuration(String(defaults.defaultDuration));
                  }}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-xs ${
                      videoType === vt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                    }`}>
                    {vt.value === 'long' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    <div className="text-left">
                      <span className="font-medium">{vt.label}</span>
                      <p className="text-[10px] text-muted-foreground">{vt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tópico *</label>
              <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder={videoType === 'short' ? 'Ex: 3 fatos sobre buracos negros' : 'Ex: Como ganhar dinheiro online em 2026'} className="bg-muted/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{videoType === 'short' ? 'Duração (segundos)' : 'Duração (minutos)'}</label>
              <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                {videoType === 'short' ? (
                  [15, 30, 45, 60].map(d => (
                    <option key={d} value={String(d)}>{d}s (~{Math.round(d * wpm / 60)} palavras)</option>
                  ))
                ) : (
                  [5, 10, 15, 20, 30, 40, 60].map(d => (
                    <option key={d} value={String(d)}>{d} min (~{d * wpm} palavras)</option>
                  ))
                )}
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
                  <option value="português">🇧🇷 Português</option>
                  <option value="inglês">🇺🇸 English</option>
                  <option value="espanhol">🇪🇸 Español</option>
                  <option value="alemão">🇩🇪 Deutsch</option>
                  <option value="polonês">🇵🇱 Polski</option>
                  <option value="turco">🇹🇷 Türkçe</option>
                  <option value="japonês">🇯🇵 日本語</option>
                  <option value="francês">🇫🇷 Français</option>
                  <option value="italiano">🇮🇹 Italiano</option>
                  <option value="tcheco">🇨🇿 Čeština</option>
                  <option value="holandês">🇳🇱 Nederlands</option>
                  <option value="coreano">🇰🇷 한국어</option>
                  <option value="hindi">🇮🇳 हिन्दी</option>
                  <option value="árabe">🇸🇦 العربية</option>
                  <option value="indonésio">🇮🇩 Bahasa</option>
                  <option value="tailandês">🇹🇭 ไทย</option>
                  <option value="vietnamita">🇻🇳 Tiếng Việt</option>
                  <option value="romeno">🇷🇴 Română</option>
                  <option value="húngaro">🇭🇺 Magyar</option>
                  <option value="sueco">🇸🇪 Svenska</option>
                  <option value="norueguês">🇳🇴 Norsk</option>
                  <option value="dinamarquês">🇩🇰 Dansk</option>
                  <option value="finlandês">🇫🇮 Suomi</option>
                </select>
              </div>
            </div>

            <Button onClick={() => runStep1_Draft()} disabled={loading || generating || !topic.trim()} className="w-full gap-2">
              {videoType === 'short' ? <Smartphone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {videoType === 'short' ? 'Gerar Short com IA' : 'Gerar Rascunho com IA'}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              ⏱ Tempo estimado: {videoType === 'short' ? '15-25s' : parseInt(duration) <= 10 ? '30-45s' : parseInt(duration) <= 20 ? '45-90s' : '60-120s'}
              {' • '}Análise competitiva + rascunho + {videoType === 'short' ? 'avaliação automática' : '12 bases de conhecimento'}
            </p>

            <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => {
              setWizardStep(1);
              setDraftScript('');
              setEditMode(true);
            }}>
              <ClipboardPaste className="w-3 h-3" /> Ou cole seu próprio roteiro
            </Button>
          </motion.div>
        )}

        {/* ═══════ STEP 1: Draft Review ═══════ */}
        {wizardStep === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  2. Rascunho Gerado
                </h3>
                {draftScript && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {wordCount.toLocaleString()} palavras • ⏱ {estimatedMinutesDisplay} min
                    <span className={`ml-2 font-medium ${progressPercent >= 100 ? 'text-emerald-400' : progressPercent >= 70 ? 'text-yellow-400' : 'text-destructive'}`}>
                      ({progressPercent}% do alvo)
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditMode(!editMode)} className="gap-1 h-7 text-xs">
                  {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  {editMode ? 'Ler' : 'Editar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1 h-7 text-xs">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1 h-7 text-xs">
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {generating && !draftScript && (
              <div className="text-center py-12">
                <Zap className="w-10 h-10 mx-auto mb-3 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Gemini está gerando o rascunho...</p>
              </div>
            )}

            {(draftScript || editMode) && (
              editMode ? (
                <textarea value={draftScript} onChange={e => setDraftScript(e.target.value)}
                  placeholder="Cole seu roteiro aqui ou edite o rascunho gerado..."
                  className="w-full min-h-[400px] max-h-[500px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto" />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[500px] pr-2">
                  <ReactMarkdown>{draftScript}</ReactMarkdown>
                </div>
              )
            )}

            {draftScript && !generating && (
              <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={() => setWizardStep(0)} className="gap-1 text-xs">
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={async () => { setScript(draftScript); await runStep3_DualScoreWithText(draftScript); }} className="gap-1 text-xs">
                    ⚡ Pular refinamento
                  </Button>
                  {videoType !== 'short' && (
                    <Button size="sm" onClick={() => runStep2_Refine()} disabled={generating} className="gap-2 text-xs">
                      <Brain className="w-4 h-4" /> Refinar com IA
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════ STEP 2: Gemini Pro Refine Review ═══════ */}
        {wizardStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  3. Refinado pela IA
                </h3>
                {script && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {wordCount.toLocaleString()} palavras • ⏱ {estimatedMinutesDisplay} min
                    <span className={`ml-2 font-medium ${progressPercent >= 100 ? 'text-emerald-400' : progressPercent >= 70 ? 'text-yellow-400' : 'text-destructive'}`}>
                      ({progressPercent}% do alvo)
                    </span>
                  </p>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditMode(!editMode)} className="gap-1 h-7 text-xs">
                  {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  {editMode ? 'Ler' : 'Editar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1 h-7 text-xs">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1 h-7 text-xs">
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {generating && !script && (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-pulse" />
                <p className="text-sm text-muted-foreground">Gemini Pro está melhorando os pontos fracos...</p>
              </div>
            )}

            {(script || editMode) && (
              editMode ? (
                <textarea value={script} onChange={e => setScript(e.target.value)}
                  className="w-full min-h-[400px] max-h-[500px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto" />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[500px] pr-2">
                  <ReactMarkdown>{script}</ReactMarkdown>
                </div>
              )
            )}

            {script && !generating && (
              <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={() => setWizardStep(1)} className="gap-1 text-xs">
                  <ArrowLeft className="w-3 h-3" /> Voltar ao rascunho
                </Button>
                <Button size="sm" onClick={() => runStep3_DualScoreWithText()} disabled={generating} className="gap-2 text-xs">
                  <Shield className="w-4 h-4" /> Avaliar (GPT + Gemini)
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════ STEP 3: Dual AI Evaluation ═══════ */}
        {wizardStep === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  4. Avaliação Dual IA
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  GPT + Gemini Pro avaliam independentemente (mínimo 14/20 para aprovar)
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1 h-7 text-xs">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1 h-7 text-xs">
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Dual Score Display */}
            {dualScore && (
              <div className="space-y-3 mb-4">
                {/* Combined Score */}
                <div className={`p-4 rounded-xl border-2 text-center ${
                  dualScore.approved 
                    ? 'border-emerald-500/50 bg-emerald-500/10' 
                    : 'border-destructive/50 bg-destructive/10'
                }`}>
                  <p className="text-xs text-muted-foreground mb-1">Score Combinado</p>
                  <p className={`text-4xl font-black ${dualScore.approved ? 'text-emerald-400' : 'text-destructive'}`}>
                    {dualScore.combinedScore}<span className="text-lg text-muted-foreground">/20</span>
                  </p>
                  <p className={`text-sm font-semibold mt-1 ${dualScore.approved ? 'text-emerald-400' : 'text-destructive'}`}>
                    {dualScore.approved ? '✅ APROVADO' : '❌ REPROVADO (mínimo 14)'}
                  </p>
                </div>

                {/* Individual Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1 font-medium">🤖 GPT-5</p>
                    <p className={`text-2xl font-bold ${dualScore.gpt_score >= 7 ? 'text-emerald-400' : dualScore.gpt_score >= 5 ? 'text-yellow-400' : 'text-destructive'}`}>
                      {dualScore.gpt_score}<span className="text-xs text-muted-foreground">/10</span>
                    </p>
                    {dualScore.gpt_details && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">"{dualScore.gpt_details.verdict}"</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1 font-medium">💎 Gemini Pro</p>
                    <p className={`text-2xl font-bold ${dualScore.gemini_score >= 7 ? 'text-emerald-400' : dualScore.gemini_score >= 5 ? 'text-yellow-400' : 'text-destructive'}`}>
                      {dualScore.gemini_score}<span className="text-xs text-muted-foreground">/10</span>
                    </p>
                    {dualScore.gemini_details && (
                      <p className="text-[10px] text-muted-foreground mt-1 italic">"{dualScore.gemini_details.verdict}"</p>
                    )}
                  </div>
                </div>

                {/* Detail breakdown */}
                {(dualScore.gpt_details || dualScore.gemini_details) && (
                  <div className="grid grid-cols-6 gap-1">
                    {['hook', 'retention', 'emotion', 'flow', 'payoff', 'originality'].map(metric => {
                      const gVal = dualScore.gpt_details?.[metric] || 0;
                      const gemVal = dualScore.gemini_details?.[metric] || 0;
                      const avg = Math.round((gVal + gemVal) / 2);
                      const labels: Record<string, string> = { hook: '🎯 Hook', retention: '📊 Ret.', emotion: '💥 Emo.', flow: '🌊 Flow', payoff: '🏆 Pay.', originality: '✨ Orig.' };
                      return (
                        <div key={metric} className="text-center p-1.5 rounded bg-muted/20">
                          <p className="text-[8px] text-muted-foreground">{labels[metric]}</p>
                          <p className={`text-sm font-bold ${avg >= 7 ? 'text-emerald-400' : avg >= 5 ? 'text-yellow-400' : 'text-destructive'}`}>{avg}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                {dualScore.strengths?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-[10px] font-semibold text-emerald-400 mb-1">✅ Pontos Fortes</p>
                    {dualScore.strengths.map((s, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                )}
                {dualScore.weaknesses?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-[10px] font-semibold text-destructive mb-1">❌ Pontos Fracos</p>
                    {dualScore.weaknesses.map((w, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">• {w}</p>
                    ))}
                  </div>
                )}
                {!dualScore.approved && dualScore.improvements?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[10px] font-semibold text-amber-400 mb-1">🔧 Melhorias Necessárias</p>
                    {dualScore.improvements.map((imp, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">• {imp}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generating && (
              <div className="text-center py-10">
                <Shield className="w-10 h-10 mx-auto mb-3 text-blue-400 animate-pulse" />
                <p className="text-sm text-muted-foreground">GPT e Gemini Pro avaliando em paralelo...</p>
              </div>
            )}

            {/* Script preview */}
            {script && !generating && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">Roteiro</p>
                  <Button size="sm" variant="ghost" onClick={() => setEditMode(!editMode)} className="gap-1 h-6 text-[10px]">
                    {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                    {editMode ? 'Ler' : 'Editar'}
                  </Button>
                </div>
                {editMode ? (
                  <textarea value={script} onChange={e => setScript(e.target.value)}
                    className="w-full min-h-[300px] max-h-[400px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto" />
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[400px] pr-2">
                    <ReactMarkdown>{script}</ReactMarkdown>
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            {!generating && dualScore && (
              <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                {dualScore.approved ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={resetWizard} className="gap-1 text-xs">
                      <RotateCcw className="w-3 h-3" /> Novo roteiro
                    </Button>
                    <Button size="sm" variant="default" onClick={() => setActiveStep('style')} className="gap-2 text-xs">
                      Próxima Etapa: Estilo Visual <Film className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setWizardStep(2)} className="gap-1 text-xs">
                      <ArrowLeft className="w-3 h-3" /> Editar manualmente
                    </Button>
                    <div className="flex gap-2">
                      {retryCount < MAX_RETRIES && (
                        <Button size="sm" variant="default" onClick={handleRetry} className="gap-2 text-xs">
                          <RefreshCw className="w-3 h-3" /> Refazer (IA aprende)
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{retryCount + 1}/{MAX_RETRIES}</Badge>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { toast.info('Aprovando manualmente...'); setDualScore({...dualScore, approved: true}); onScriptGenerated?.(); }} className="gap-1 text-xs">
                        Aprovar mesmo assim
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
