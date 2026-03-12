import { useState } from 'react';
import { FileText, Sparkles, Copy, Check, Save, Edit3, Eye, ClipboardPaste, Loader2, Zap, Film, Brain, Wand2, Shield, CheckCircle2 } from 'lucide-react';
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

type PipelinePhase = 'idle' | 'intelligence' | 'draft' | 'refine' | 'factcheck' | 'done';

const PHASE_INFO: Record<PipelinePhase, { label: string; icon: any; percent: number }> = {
  idle: { label: '', icon: null, percent: 0 },
  intelligence: { label: '🔍 Fase 0: Analisando inteligência...', icon: Brain, percent: 10 },
  draft: { label: '✍️ Fase 1: GPT-5 Hook + Gemini Flash gerando rascunho...', icon: Zap, percent: 35 },
  refine: { label: '🎯 Fase 2: Gemini Pro refinando qualidade...', icon: Wand2, percent: 70 },
  factcheck: { label: '🛡️ Fase 3: Verificação de fatos...', icon: Shield, percent: 90 },
  done: { label: '✅ Pipeline completo!', icon: CheckCircle2, percent: 100 },
};

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
  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [skipRefine, setSkipRefine] = useState(false);

  const wpm = SPEECH_RATES[language] || 150;
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
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

  // Stream SSE from edge function, calling onDelta for each token
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

  const generateScript = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setLoading(true);
    setScript('');
    setActiveStep('script');
    setScorecard(null);
    setSceneBlueprintJson([]);
    setPhase('intelligence');

    try {
      // ═══════ PHASE 0: Intelligence ═══════
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

      // ═══════ PHASE 1: Draft (GPT-5 Hook + Gemini Flash streaming) ═══════
      setPhase('draft');
      const viralContext = getViralContext();
      
      const draftText = await streamFromFunction('generate-script', {
        topic, duration: parseInt(duration), style, niche, language,
        viralContext, intelligenceBriefing: briefing,
      }, (fullText) => {
        setScript(cleanBlueprintFromScript(cleanScoresFromScript(fullText)));
      });

      toast.success('✍️ Rascunho completo!');

      // Extract blueprint from draft
      const draftBlueprint = parseSceneBlueprint(draftText);
      const cleanDraft = cleanBlueprintFromScript(cleanScoresFromScript(draftText));
      setScript(cleanDraft);

      // ═══════ PHASE 2: Refine (Gemini Pro streaming) ═══════
      if (!skipRefine) {
        setPhase('refine');
        try {
          const refinedText = await streamFromFunction('refine-script', {
            draft_script: cleanDraft,
            niche, language, duration: parseInt(duration), style,
            target_words: targetWords,
          }, (fullText) => {
            setScript(cleanBlueprintFromScript(cleanScoresFromScript(fullText)));
          });

          parseScorecard(refinedText);
          const refinedBlueprint = parseSceneBlueprint(refinedText);
          const blueprint = refinedBlueprint.length > 0 ? refinedBlueprint : draftBlueprint;
          if (blueprint.length > 0) {
            setSceneBlueprintJson(blueprint);
            toast.success(`🎬 Blueprint: ${blueprint.length} blocos narrativos`);
          }
          setScript(cleanBlueprintFromScript(cleanScoresFromScript(refinedText)));
          toast.success('🎯 Roteiro refinado pelo Gemini Pro!');
        } catch (refineErr) {
          console.warn('Refine failed, using draft:', refineErr);
          toast.info('Refinamento indisponível, usando rascunho de alta qualidade');
          if (draftBlueprint.length > 0) {
            setSceneBlueprintJson(draftBlueprint);
          }
        }
      } else {
        // Skip refine, use draft
        if (draftBlueprint.length > 0) {
          setSceneBlueprintJson(draftBlueprint);
        }
      }

      // ═══════ PHASE 3: Fact-check (fire and forget) ═══════
      setPhase('factcheck');
      try {
        const { data: fcData } = await supabase.functions.invoke('score-script', {
          body: { script: script.slice(0, 10000), niche, language },
        });
        if (fcData?.scores) {
          setScorecard(fcData.scores);
        }
      } catch { /* non-critical */ }

      // ═══════ SAVE ═══════
      setPhase('done');
      try {
        const pid = await getOrCreateProject();
        await supabase.from('video_projects').update({
          intelligence_json: briefing || {},
          scene_blueprint_json: parseSceneBlueprint(script),
        } as any).eq('id', pid);
      } catch { /* non-critical */ }

      supabase.functions.invoke('learn-from-user', {
        body: { type: 'script_generated', data: { topic, niche, style, duration } },
      }).catch(() => {});

      onScriptGenerated?.();
      toast.success('✅ Pipeline Ensemble AI completo!');

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setGenerating(false);
      setTimeout(() => setPhase('idle'), 3000);
    }
  };

  const saveScript = async () => {
    if (!script) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login'); return; }
    await supabase.from('saved_scripts').insert({ user_id: user.id, topic, duration: parseInt(duration), style, script_content: script } as any);
    toast.success('Roteiro salvo!');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const phaseInfo = PHASE_INFO[phase];

  return (
    <>
      {/* Config Panel */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-sm">Configurações</h3>
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

        {/* Skip Refine Toggle */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="skipRefine" checked={skipRefine} onChange={e => setSkipRefine(e.target.checked)} className="rounded" />
          <label htmlFor="skipRefine" className="text-xs text-muted-foreground">⚡ Modo rápido (pular refinamento Gemini Pro)</label>
        </div>

        <Button onClick={generateScript} disabled={loading || generating || !topic.trim()} className="w-full gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Pipeline Ensemble AI...</> :
           <><Sparkles className="w-4 h-4" /> 🧠 Analisar & Gerar Roteiro</>}
        </Button>
      </div>

      {/* Pipeline Progress */}
      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              {phaseInfo.icon && <phaseInfo.icon className={`w-5 h-5 ${phase === 'done' ? 'text-emerald-400' : 'text-primary animate-pulse'}`} />}
              <span className="text-sm font-medium">{phaseInfo.label}</span>
            </div>
            <Progress value={phaseInfo.percent} className="h-2" />
            <div className="flex justify-between mt-1.5">
              {(['intelligence', 'draft', 'refine', 'factcheck', 'done'] as PipelinePhase[]).map((p) => {
                const isActive = p === phase;
                const isDone = PHASE_INFO[p].percent < PHASE_INFO[phase].percent;
                return (
                  <div key={p} className={`text-[9px] font-medium ${isActive ? 'text-primary' : isDone ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                    {isDone ? '✓' : isActive ? '●' : '○'} {p === 'intelligence' ? 'Intel' : p === 'draft' ? 'Draft' : p === 'refine' ? 'Refine' : p === 'factcheck' ? 'Check' : 'Done'}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Script Output */}
      {(script || loading) && (
        <motion.div key="script-output" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm">Roteiro</h3>
              {script && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {wordCount.toLocaleString()} palavras • {charCount.toLocaleString()} chars • ⏱ {estimatedMinutesDisplay} min
                    {scorecard && <span className="ml-2 text-primary font-medium">• Ensemble AI ✓</span>}
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

          {loading && !script && (
            <div className="text-center py-12">
              <Zap className="w-10 h-10 mx-auto mb-3 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Ensemble AI: Analisando → Gerando → Refinando...</p>
            </div>
          )}

          {script || editMode ? (
            editMode ? (
              <textarea value={script} onChange={e => setScript(e.target.value)}
                placeholder="Cole seu roteiro aqui ou edite o roteiro gerado..."
                className="w-full min-h-[500px] max-h-[500px] bg-muted/20 border border-border rounded-lg p-4 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono leading-relaxed overflow-y-auto" />
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[500px] pr-2">
                <ReactMarkdown>{script}</ReactMarkdown>
              </div>
            )
          ) : null}
        </motion.div>
      )}
    </>
  );
};
