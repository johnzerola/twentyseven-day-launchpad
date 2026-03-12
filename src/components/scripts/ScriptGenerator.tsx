import { useState, useCallback } from 'react';
import { FileText, Sparkles, Copy, Check, Save, Edit3, Eye, ClipboardPaste, Loader2, Zap, Film, Brain, Wand2, Shield, CheckCircle2, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
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
  setActiveStep: (v: 'script' | 'style' | 'characters' | 'prompts') => void;
  getViralContext: () => string;
  getOrCreateProject: () => Promise<string>;
  intelligenceBriefing: any;
  setIntelligenceBriefing: (v: any) => void;
  setSceneBlueprintJson: (v: any[]) => void;
  onScriptGenerated?: () => void;
}

const SPEECH_RATES: Record<string, number> = {
  'português': 150, 'inglês': 160, 'espanhol': 155,
  'polonês': 145, 'alemão': 140, 'turco': 150, 'japonês': 130,
  'francês': 155, 'italiano': 155, 'tcheco': 145, 'holandês': 150,
  'coreano': 135, 'hindi': 145, 'árabe': 140, 'indonésio': 150,
  'tailandês': 140, 'vietnamita': 145, 'romeno': 150, 'húngaro': 145,
  'sueco': 150, 'norueguês': 150, 'dinamarquês': 150, 'finlandês': 140,
};

// Wizard steps
type WizardStep = 0 | 1 | 2 | 3;

const WIZARD_STEPS = [
  { label: 'Configuração', icon: FileText, desc: 'Defina tópico, estilo e idioma' },
  { label: 'Rascunho IA', icon: Zap, desc: 'Gemini gera o rascunho — revise e edite' },
  { label: 'Refinamento Claude', icon: Brain, desc: 'Claude refina — revise e edite' },
  { label: 'Roteiro Final', icon: CheckCircle2, desc: 'Score final + roteiro pronto' },
];

export const ScriptGenerator = ({
  topic, setTopic, duration, setDuration, style, setStyle,
  niche, setNiche, language, setLanguage, script, setScript,
  loading, setLoading, scorecard, setScorecard, setActiveStep,
  getViralContext, getOrCreateProject, intelligenceBriefing,
  setIntelligenceBriefing, setSceneBlueprintJson, onScriptGenerated,
}: ScriptGeneratorProps) => {
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [draftScript, setDraftScript] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');

  const wpm = SPEECH_RATES[language] || 150;
  const currentScript = wizardStep === 1 ? draftScript : script;
  const wordCount = currentScript.split(/\s+/).filter(Boolean).length;
  const charCount = currentScript.length;
  const estimatedMinutes = wordCount > 0 ? (wordCount / wpm) : 0;
  const estimatedMinutesDisplay = `${Math.floor(estimatedMinutes)}:${String(Math.round((estimatedMinutes % 1) * 60)).padStart(2, '0')}`;
  const targetWords = parseInt(duration) * wpm;
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

  const cleanAll = (text: string) => cleanBlueprintFromScript(cleanScoresFromScript(text));

  // Stream SSE from edge function
  const streamFromFunction = async (fnName: string, body: any, onDelta: (text: string) => void): Promise<string> => {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
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

  // ═══════ STEP 1: Generate Draft ═══════
  const runStep1_Draft = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setLoading(true);
    setDraftScript('');
    setScript('');
    setScorecard(null);
    setSceneBlueprintJson([]);
    setWizardStep(1);
    setEditMode(false);

    try {
      // Phase 0: Intelligence
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

      // Phase 1: Draft streaming
      setPhaseLabel('✍️ Gemini está gerando seu rascunho...');
      const viralContext = getViralContext();
      
      const rawDraft = await streamFromFunction('generate-script', {
        topic, duration: parseInt(duration), style, niche, language,
        viralContext, intelligenceBriefing: briefing,
      }, (fullText) => {
        setDraftScript(cleanAll(fullText));
      });

      // Extract blueprint
      const blueprint = parseSceneBlueprint(rawDraft);
      if (blueprint.length > 0) setSceneBlueprintJson(blueprint);
      setDraftScript(cleanAll(rawDraft));
      setPhaseLabel('');
      toast.success('✍️ Rascunho pronto! Revise, edite e clique em "Próxima Etapa".');

    } catch (err: any) {
      toast.error(err.message);
      setWizardStep(0);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // ═══════ STEP 2: Refine with Claude ═══════
  const runStep2_Refine = async () => {
    if (generating) return;
    setGenerating(true);
    setLoading(true);
    setScript('');
    setWizardStep(2);
    setEditMode(false);
    setPhaseLabel('🧠 Claude está refinando seu roteiro...');

    try {
      const refinedRaw = await streamFromFunction('refine-script', {
        draft_script: draftScript,
        niche, language, duration: parseInt(duration), style,
        target_words: targetWords,
      }, (fullText) => {
        setScript(cleanAll(fullText));
      });

      parseScorecard(refinedRaw);
      const refinedBlueprint = parseSceneBlueprint(refinedRaw);
      if (refinedBlueprint.length > 0) setSceneBlueprintJson(refinedBlueprint);
      setScript(cleanAll(refinedRaw));
      setPhaseLabel('');
      toast.success('🧠 Claude refinou! Revise, edite e clique em "Finalizar".');

    } catch (err: any) {
      toast.error(`Refinamento falhou: ${err.message}. Usando rascunho.`);
      setScript(draftScript);
      setPhaseLabel('');
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  // ═══════ STEP 3: Final Score + Save ═══════
  const runStep3_Finalize = async () => {
    setGenerating(true);
    setLoading(true);
    setWizardStep(3);
    setPhaseLabel('🛡️ Verificação final de qualidade...');

    try {
      // Score
      try {
        const { data: fcData } = await supabase.functions.invoke('score-script', {
          body: { script: script.slice(0, 10000), niche, language },
        });
        if (fcData?.scores) setScorecard(fcData.scores);
      } catch { /* non-critical */ }

      // Save to project
      try {
        const pid = await getOrCreateProject();
        await supabase.from('video_projects').update({
          intelligence_json: intelligenceBriefing || {},
          scene_blueprint_json: parseSceneBlueprint(script),
        } as any).eq('id', pid);
      } catch { /* non-critical */ }

      supabase.functions.invoke('learn-from-user', {
        body: { type: 'script_generated', data: { topic, niche, style, duration } },
      }).catch(() => {});

      onScriptGenerated?.();
      setPhaseLabel('');
      toast.success('✅ Roteiro finalizado e salvo!');

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const saveScript = async () => {
    const textToSave = wizardStep === 1 ? draftScript : script;
    if (!textToSave) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login'); return; }
    await supabase.from('saved_scripts').insert({ user_id: user.id, topic, duration: parseInt(duration), style, script_content: textToSave } as any);
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
    setPhaseLabel('');
    setEditMode(false);
  };

  const activeText = wizardStep === 1 ? draftScript : script;
  const setActiveText = wizardStep === 1 ? setDraftScript : setScript;

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
      </div>

      {/* ═══════ STEP 0: Config ═══════ */}
      <AnimatePresence mode="wait">
        {wizardStep === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">1. Configurações do Roteiro</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tópico *</label>
              <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Como ganhar dinheiro online em 2026" className="bg-muted/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Duração (minutos)</label>
              <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm">
                {[5, 10, 15, 20, 30, 40, 60].map(d => (
                  <option key={d} value={String(d)}>{d} min (~{d * wpm} palavras)</option>
                ))}
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

            <Button onClick={runStep1_Draft} disabled={loading || generating || !topic.trim()} className="w-full gap-2">
              <Sparkles className="w-4 h-4" /> Gerar Rascunho com IA
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Button>

            {/* Paste own script shortcut */}
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

            {/* Navigation */}
            {draftScript && !generating && (
              <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={() => setWizardStep(0)} className="gap-1 text-xs">
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setScript(draftScript); setWizardStep(3); runStep3_Finalize(); }} className="gap-1 text-xs">
                    ⚡ Pular refinamento
                  </Button>
                  <Button size="sm" onClick={runStep2_Refine} disabled={generating} className="gap-2 text-xs">
                    <Brain className="w-4 h-4" /> Refinar com Claude
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════ STEP 2: Claude Refine Review ═══════ */}
        {wizardStep === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  3. Refinado pelo Claude
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
                    <p className={`text-lg font-bold ${score >= 9 ? 'text-emerald-400' : score >= 7 ? 'text-yellow-400' : 'text-destructive'}`}>{score}</p>
                  </div>
                ))}
              </div>
            )}

            {generating && !script && (
              <div className="text-center py-12">
                <Brain className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-pulse" />
                <p className="text-sm text-muted-foreground">Claude está refinando o roteiro...</p>
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
                <Button size="sm" onClick={runStep3_Finalize} disabled={generating} className="gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Finalizar Roteiro
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════ STEP 3: Final ═══════ */}
        {wizardStep === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  4. Roteiro Final
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {wordCount.toLocaleString()} palavras • ⏱ {estimatedMinutesDisplay} min
                  {scorecard && <span className="ml-2 text-emerald-400 font-medium">• Verificado ✓</span>}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditMode(!editMode)} className="gap-1 h-7 text-xs">
                  {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  {editMode ? 'Ler' : 'Editar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1 h-7 text-xs">
                  <Save className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1 h-7 text-xs">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

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
                    <p className={`text-lg font-bold ${score >= 9 ? 'text-emerald-400' : score >= 7 ? 'text-yellow-400' : 'text-destructive'}`}>{score}</p>
                  </div>
                ))}
              </div>
            )}

            {generating && (
              <div className="text-center py-6">
                <Shield className="w-8 h-8 mx-auto mb-2 text-primary animate-pulse" />
                <p className="text-sm text-muted-foreground">Verificação final...</p>
              </div>
            )}

            {script && (
              editMode ? (
                <textarea value={script} onChange={e => setScript(e.target.value)}
                  className="w-full min-h-[400px] max-h-[500px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto" />
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[500px] pr-2">
                  <ReactMarkdown>{script}</ReactMarkdown>
                </div>
              )
            )}

            {!generating && script && (
              <div className="flex justify-between mt-4 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={resetWizard} className="gap-1 text-xs">
                  <RotateCcw className="w-3 h-3" /> Novo roteiro
                </Button>
                <Button size="sm" variant="default" onClick={() => setActiveStep('style')} className="gap-2 text-xs">
                  Próxima Etapa: Estilo Visual <Film className="w-4 h-4" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
