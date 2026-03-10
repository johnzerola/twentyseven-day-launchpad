import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { FileText, Sparkles, Copy, Check, Save, History, Trash2, Zap, Flame, ChevronDown, ChevronUp, Target, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { VIRAL_HOOKS, VIRAL_CTAS, STORY_STRUCTURES } from '@/lib/viralDatabase';

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

const Scripts = () => {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('15');
  const [style, setStyle] = useState('dopaminérgico');
  const [niche, setNiche] = useState('');
  const [language, setLanguage] = useState('português');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedScripts, setSavedScripts] = useState<any[]>([]);

  // Viral Database selections
  const [showViralPanel, setShowViralPanel] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);

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
      if (hook) parts.push(`HOOK OBRIGATÓRIO (use como base/inspiração para os primeiros 5 segundos): ${hook.text}`);
    }
    if (selectedCTA) {
      const cta = VIRAL_CTAS.find(c => c.id === selectedCTA);
      if (cta) parts.push(`CTA OBRIGATÓRIO (insira no ${cta.placement} do roteiro, adaptado ao tema): ${cta.text}`);
    }
    if (selectedStructure) {
      const structure = STORY_STRUCTURES.find(s => s.id === selectedStructure);
      if (structure) {
        const phases = structure.phases.map(p => `${p.name} (${p.duration}): ${p.tip}`).join('\n');
        parts.push(`ESTRUTURA NARRATIVA OBRIGATÓRIA — Siga esta estrutura "${structure.name}":\n${phases}`);
      }
    }
    return parts.join('\n\n');
  };

  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setScript('');

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

      if (resp.status === 402) {
        throw new Error('⚠️ Créditos de IA insuficientes. Adicione créditos em Settings → Workspace → Usage.');
      }
      if (resp.status === 429) {
        throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
      }
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar roteiro');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullScript = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar roteiro');
    } finally {
      setLoading(false);
    }
  };

  const saveScript = async () => {
    if (!script) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login para salvar'); return; }
    await supabase.from('saved_scripts').insert({
      user_id: user.id, topic, duration: parseInt(duration), style, script_content: script,
    } as any);
    toast.success('Roteiro salvo!');
    loadHistory();
  };

  const deleteScript = async (id: string) => {
    await supabase.from('saved_scripts').delete().eq('id', id);
    toast.success('Roteiro removido');
    loadHistory();
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Roteiro copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
  const estimatedMinutes = Math.round(wordCount / 140);
  const targetWords = parseInt(duration) * 140;
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  const activeHook = VIRAL_HOOKS.find(h => h.id === selectedHook);
  const activeCTA = VIRAL_CTAS.find(c => c.id === selectedCTA);
  const activeStructure = STORY_STRUCTURES.find(s => s.id === selectedStructure);
  const viralCount = [selectedHook, selectedCTA, selectedStructure].filter(Boolean).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">{t('dash.scripts')}</h1>
              <p className="text-sm text-muted-foreground">Roteiros dopaminérgicos de alta retenção com IA</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-2">
            <History className="w-4 h-4" /> Histórico ({savedScripts.length})
          </Button>
        </div>

        {showHistory && savedScripts.length > 0 && (
          <div className="glass rounded-xl p-5 space-y-2 max-h-60 overflow-y-auto">
            {savedScripts.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                <button onClick={() => { setScript(s.script_content); setTopic(s.topic); setShowHistory(false); }}
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

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="glass rounded-xl p-6 space-y-4">
              <h3 className="font-semibold">Configurações</h3>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Tópico do vídeo *</label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Como ganhar dinheiro online em 2026" className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Duração (minutos)</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                  <option value="5">5 min (~700 palavras)</option>
                  <option value="10">10 min (~1.400 palavras)</option>
                  <option value="15">15 min (~2.100 palavras)</option>
                  <option value="20">20 min (~2.800 palavras)</option>
                  <option value="30">30 min (~4.200 palavras)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Estilo do roteiro</label>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={`text-left p-2.5 rounded-lg border transition-all text-sm ${
                        style === s.value 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border/50 bg-secondary/30 hover:border-primary/30'
                      }`}>
                      <span className="font-medium">{s.label}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nicho (opcional)</label>
                <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: finanças, tecnologia" className="bg-secondary/50" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Idioma</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                  <option value="português">Português</option>
                  <option value="inglês">English</option>
                  <option value="polonês">Polski</option>
                  <option value="alemão">Deutsch</option>
                  <option value="espanhol">Español</option>
                </select>
              </div>
              <Button onClick={generateScript} disabled={loading || !topic.trim()} className="w-full gradient-hero border-0 gap-2">
                <Sparkles className="w-4 h-4" />
                {loading ? 'Gerando roteiro com IA...' : 'Gerar Roteiro Dopaminérgico'}
              </Button>
            </div>

            {/* Viral Database Panel */}
            <div className="glass rounded-xl overflow-hidden">
              <button onClick={() => setShowViralPanel(!showViralPanel)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-semibold text-sm">Viral Database</span>
                  {viralCount > 0 && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                      {viralCount} selecionado{viralCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                {showViralPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showViralPanel && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
                  {/* Hook Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-primary" /> Hook (primeiros 5s)
                      </label>
                      {selectedHook && (
                        <button onClick={() => setSelectedHook(null)} className="text-[10px] text-muted-foreground hover:text-destructive">Limpar</button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {VIRAL_HOOKS.slice(0, 8).map(hook => (
                        <button key={hook.id} onClick={() => setSelectedHook(selectedHook === hook.id ? null : hook.id)}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-all border ${
                            selectedHook === hook.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/30 bg-secondary/20 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-2">{hook.text}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{hook.style}</Badge>
                            <span className="text-[9px] text-emerald-400">{hook.estimatedRetention}% ret.</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CTA Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <Target className="w-3 h-3 text-primary" /> Call-to-Action
                      </label>
                      {selectedCTA && (
                        <button onClick={() => setSelectedCTA(null)} className="text-[10px] text-muted-foreground hover:text-destructive">Limpar</button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {VIRAL_CTAS.slice(0, 6).map(cta => (
                        <button key={cta.id} onClick={() => setSelectedCTA(selectedCTA === cta.id ? null : cta.id)}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-all border ${
                            selectedCTA === cta.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/30 bg-secondary/20 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="line-clamp-2">{cta.text}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{cta.type}</Badge>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{cta.placement}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Structure Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-primary" /> Estrutura Narrativa
                      </label>
                      {selectedStructure && (
                        <button onClick={() => setSelectedStructure(null)} className="text-[10px] text-muted-foreground hover:text-destructive">Limpar</button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {STORY_STRUCTURES.map(s => (
                        <button key={s.id} onClick={() => setSelectedStructure(selectedStructure === s.id ? null : s.id)}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-all border ${
                            selectedStructure === s.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border/30 bg-secondary/20 hover:border-primary/30 text-muted-foreground'
                          }`}>
                          <span className="font-medium">{s.name}</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {s.bestFor.slice(0, 3).map(b => <Badge key={b} variant="outline" className="text-[8px] px-1 py-0">{b}</Badge>)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active selections summary */}
                  {viralCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 space-y-1">
                      <p className="text-[10px] font-medium text-orange-400">Elementos virais ativos:</p>
                      {activeHook && <p className="text-[10px] text-muted-foreground">⚡ Hook: {activeHook.text.slice(0, 50)}...</p>}
                      {activeCTA && <p className="text-[10px] text-muted-foreground">🎯 CTA ({activeCTA.placement}): {activeCTA.text.slice(0, 50)}...</p>}
                      {activeStructure && <p className="text-[10px] text-muted-foreground">📖 Estrutura: {activeStructure.name}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Roteiro</h3>
                {script && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-muted-foreground">
                      {wordCount.toLocaleString()} palavras • {charCount.toLocaleString()} chars • ~{estimatedMinutes} min
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress value={progressPercent} className="h-2 flex-1" />
                      <span className={`text-xs font-medium ${progressPercent >= 100 ? 'text-emerald-400' : progressPercent >= 70 ? 'text-yellow-400' : 'text-destructive'}`}>
                        {progressPercent}%
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Meta: {targetWords.toLocaleString()} palavras para {duration} min • {progressPercent >= 100 ? '✅ Meta atingida' : `Faltam ${(targetWords - wordCount).toLocaleString()} palavras`}
                    </p>
                  </div>
                )}
              </div>
              {script && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1">
                    <Save className="w-3 h-3" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              )}
            </div>
            {loading && !script && (
              <div className="text-center py-16">
                <Zap className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                <p className="text-muted-foreground">Gerando roteiro com Gemini 2.5 Pro...</p>
                <p className="text-xs text-muted-foreground mt-1">Estilo: {STYLES.find(s => s.value === style)?.label}</p>
                {viralCount > 0 && (
                  <p className="text-xs text-orange-400 mt-2">🔥 {viralCount} elemento{viralCount > 1 ? 's' : ''} viral injetado{viralCount > 1 ? 's' : ''}</p>
                )}
              </div>
            )}
            {script ? (
              <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[600px] pr-2">
                <ReactMarkdown>{script}</ReactMarkdown>
              </div>
            ) : !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Selecione um estilo e gere roteiros de alta retenção</p>
                <p className="text-xs mt-2">Open loops • Pattern interrupts • Curiosity gaps • Hooks magnéticos</p>
                <p className="text-xs mt-3 text-orange-400/70">💡 Dica: Expanda o painel "Viral Database" para injetar hooks, CTAs e estruturas no roteiro</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
