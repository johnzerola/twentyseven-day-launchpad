import { useState } from 'react';
import { FileText, Sparkles, Copy, Check, Save, Edit3, Eye, ClipboardPaste, Loader2, Zap, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

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

export const ScriptGenerator = ({
  topic, setTopic, duration, setDuration, style, setStyle,
  niche, setNiche, language, setLanguage, script, setScript,
  loading, setLoading, scorecard, setScorecard, setActiveStep,
  getViralContext, getOrCreateProject, intelligenceBriefing,
  setIntelligenceBriefing, setSceneBlueprintJson, onScriptGenerated,
}: ScriptGeneratorProps) => {
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzingTopic, setAnalyzingTopic] = useState(false);
  const [generating, setGenerating] = useState(false);

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

  const generateScript = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setLoading(true);
    setScript('');
    setActiveStep('script');
    setScorecard(null);
    setSceneBlueprintJson([]);

    try {
      // Phase 0: Intelligence
      setAnalyzingTopic(true);
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
      setAnalyzingTopic(false);

      // Phase 1+2: Script Generation
      const viralContext = getViralContext();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic, duration: parseInt(duration), style, niche, language, viralContext, intelligenceBriefing: briefing }),
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
            if (c) { fullScript += c; setScript(cleanBlueprintFromScript(cleanScoresFromScript(fullScript))); }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
      parseScorecard(fullScript);
      const blueprint = parseSceneBlueprint(fullScript);
      if (blueprint.length > 0) {
        setSceneBlueprintJson(blueprint);
        toast.success(`🎬 Blueprint: ${blueprint.length} blocos narrativos mapeados`);
      }
      setScript(cleanBlueprintFromScript(cleanScoresFromScript(fullScript)));

      try {
        const pid = await getOrCreateProject();
        await supabase.from('video_projects').update({ intelligence_json: briefing || {}, scene_blueprint_json: blueprint } as any).eq('id', pid);
      } catch { /* non-critical */ }
      // Auto-learn from script generation (fire-and-forget)
      supabase.functions.invoke('learn-from-user', {
        body: { type: 'script_generated', data: { topic, niche, style, duration } },
      }).catch(() => {});
      onScriptGenerated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setGenerating(false);
      setAnalyzingTopic(false);
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
        <Button onClick={generateScript} disabled={loading || generating || !topic.trim()} className="w-full gap-2">
          {analyzingTopic ? <><Loader2 className="w-4 h-4 animate-spin" /> Analisando inteligência...</> :
           loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando roteiro...</> :
           <><Sparkles className="w-4 h-4" /> 🧠 Analisar & Gerar Roteiro</>}
        </Button>
      </div>

      {/* Script Output (used in right panel) */}
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
              <p className="text-sm text-muted-foreground">Dual-AI: GPT-5 criando → Gemini Pro revisando...</p>
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
          ) : !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Configure e gere seu roteiro viral</p>
            </div>
          )}
        </motion.div>
      )}
    </>
  );
};
