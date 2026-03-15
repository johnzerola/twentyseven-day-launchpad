import { useState, useEffect } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Loader2, TrendingUp, Sparkles, ArrowRight, ArrowLeft, Zap, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

const NICHE_OPTIONS: { key: string; label: string; emoji: string; subNiches: string[] }[] = [
  { key: 'finanças', label: 'Finanças', emoji: '💰', subNiches: ['investimentos', 'renda passiva', 'criptomoedas', 'economia doméstica', 'day trade', 'finanças pessoais'] },
  { key: 'terror', label: 'Terror/Horror', emoji: '👻', subNiches: ['creepypastas', 'lendas urbanas', 'paranormal', 'horror psicológico', 'casas mal-assombradas', 'serial killers'] },
  { key: 'tecnologia', label: 'Tecnologia', emoji: '🤖', subNiches: ['inteligência artificial', 'gadgets', 'programação', 'cibersegurança', 'futuro da tecnologia', 'apps e ferramentas'] },
  { key: 'ciência', label: 'Ciência', emoji: '🔬', subNiches: ['espaço e astronomia', 'física quântica', 'biologia', 'neurociência', 'experimentos', 'teorias científicas'] },
  { key: 'gaming', label: 'Gaming', emoji: '🎮', subNiches: ['lore de jogos', 'easter eggs', 'speedrun', 'jogos indie', 'história dos games', 'teorias de jogos'] },
  { key: 'história', label: 'História', emoji: '📜', subNiches: ['história de Deus/religião', 'Egito antigo', 'milionários e impérios', 'guerras mundiais', 'civilizações perdidas', 'história do Brasil', 'Grécia antiga', 'Roma antiga', 'idade média'] },
  { key: 'saúde', label: 'Saúde/Fitness', emoji: '💪', subNiches: ['nutrição', 'treinos', 'saúde mental', 'longevidade', 'hábitos saudáveis', 'biohacking'] },
  { key: 'true_crime', label: 'True Crime', emoji: '🔍', subNiches: ['casos não resolvidos', 'serial killers', 'golpes famosos', 'fugitivos', 'investigações', 'desaparecimentos'] },
  { key: 'mitologia', label: 'Mitologia', emoji: '⚡', subNiches: ['mitologia grega', 'mitologia nórdica', 'mitologia egípcia', 'mitologia japonesa', 'mitologia celta', 'mitologia hindu'] },
  { key: 'curiosidades', label: 'Curiosidades', emoji: '🧠', subNiches: ['fatos bizarros', 'recordes mundiais', 'lugares proibidos', 'coisas que não sabia', 'comparações impossíveis'] },
  { key: 'relacionamentos', label: 'Relacionamentos', emoji: '❤️', subNiches: ['histórias emocionantes', 'psicologia dos relacionamentos', 'traições', 'amor proibido', 'superação'] },
  { key: 'empreendedorismo', label: 'Empreendedorismo', emoji: '🚀', subNiches: ['negócios online', 'dropshipping', 'marketing digital', 'startups', 'histórias de sucesso'] },
];

const STYLE_OPTIONS = [
  { value: 'documentário', label: '📹 Documentário' },
  { value: 'storytelling', label: '📖 Storytelling' },
  { value: 'listicle', label: '📋 Listicle' },
  { value: 'narração', label: '🎙️ Narração' },
  { value: 'dopaminérgico', label: '🧠 Dopaminérgico' },
  { value: 'educativo', label: '📚 Educativo' },
  { value: 'cinematográfico', label: '🎬 Cinematográfico' },
  { value: 'tutorial', label: '🛠️ Tutorial' },
];

const DURATION_OPTIONS = [
  { value: 'short', label: '⚡ Shorts (15-60s)', desc: 'Formato vertical, alta retenção' },
  { value: 'long', label: '🎬 Longform (5-60min)', desc: 'Formato completo, monetização' },
];

const SHORTS_DURATION_OPTIONS = [
  { value: 'micro', label: '⚡ Micro (15-25s)', desc: 'Completion rate máximo. Viraliza rápido.', example: 'Fatos, comparações, trends' },
  { value: 'flash', label: '🔥 Flash (25-40s)', desc: 'Sweet spot do algoritmo. Fato + twist.', example: 'Revelações, listicles, hacks' },
  { value: 'story', label: '📖 Story (45-60s)', desc: 'Narrativas emocionais. Alto engajamento.', example: 'Milionários, crime, mitologia' },
];

interface ViralThemeWizardProps {
  onSelectTheme: (theme: any) => void;
  userChannels: any[];
}

export const ViralThemeWizard = ({ onSelectTheme, userChannels }: ViralThemeWizardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0); // 0=niche, 1=subNiche, 2=channel, 3=topic+style+duration, 4=results
  
  // Wizard state
  const [selectedNiche, setSelectedNiche] = useState('');
  const [selectedSubNiche, setSelectedSubNiche] = useState('');
  const [customSubNiche, setCustomSubNiche] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<'short' | 'long'>('long');
  const [shortsDurationCat, setShortsDurationCat] = useState<'micro' | 'flash' | 'story'>('flash');
  
  // Results
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelKnowledge, setChannelKnowledge] = useState<string>('');

  // Load channel knowledge when channel selected
  useEffect(() => {
    if (!selectedChannelId) { setChannelKnowledge(''); return; }
    const load = async () => {
      const [dottiRes, channelRes] = await Promise.all([
        supabase.from('dotti_suggestions').select('title, content, topic, niche').eq('channel_id', selectedChannelId).order('created_at', { ascending: false }).limit(10),
        supabase.from('user_channels').select('analysis_json, niche, channel_name').eq('id', selectedChannelId).maybeSingle(),
      ]);
      const parts: string[] = [];
      if (channelRes.data?.analysis_json) {
        const a = channelRes.data.analysis_json as any;
        if (a.niche_detected) parts.push(`Nicho detectado: ${a.niche_detected}`);
        if (a.content_strategy) parts.push(`Estratégia: ${a.content_strategy}`);
        if (a.strengths?.length) parts.push(`Pontos fortes: ${a.strengths.slice(0, 3).join(', ')}`);
        if (a.viral_potential_topics?.length) parts.push(`Tópicos virais: ${a.viral_potential_topics.slice(0, 5).join(', ')}`);
      }
      if (dottiRes.data?.length) {
        parts.push('Insights salvos do Dotti:');
        dottiRes.data.forEach((d: any) => parts.push(`- ${d.title || d.topic}: ${d.content?.slice(0, 150)}`));
      }
      setChannelKnowledge(parts.join('\n'));
    };
    load();
  }, [selectedChannelId]);

  const nicheData = NICHE_OPTIONS.find(n => n.key === selectedNiche);
  const effectiveSubNiche = customSubNiche || selectedSubNiche;

  const generateThemes = async () => {
    setLoading(true);
    setThemes([]);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-themes', {
        body: {
          niche: selectedNiche,
          subNiche: effectiveSubNiche,
          style: selectedStyle || undefined,
          language: 'português',
          count: 10,
          topic: topicInput || undefined,
          narrativeStyle: selectedStyle || undefined,
          channelKnowledge: channelKnowledge || undefined,
          videoFormat: selectedDuration,
          shortsDuration: selectedDuration === 'short' ? shortsDurationCat : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setThemes(data?.themes || []);
      toast.success(`${data?.themes?.length || 0} temas virais gerados!`);
      setStep(4);
    } catch (err: any) {
      if (err?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else if (err?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else toast.error(err.message || 'Erro ao gerar temas');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep(0);
    setSelectedNiche('');
    setSelectedSubNiche('');
    setCustomSubNiche('');
    setSelectedChannelId(null);
    setTopicInput('');
    setSelectedStyle('');
    setSelectedDuration('long');
    setShortsDurationCat('flash');
    setThemes([]);
  };

  const selectedChannel = userChannels.find((c: any) => c.id === selectedChannelId);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span className="font-semibold text-xs">🔥 Gerador de Temas Virais</span>
          {themes.length > 0 && <Badge variant="secondary" className="text-[10px]">{themes.length} temas</Badge>}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
          {/* Progress */}
          <div className="flex items-center gap-1">
            {['Nicho', 'Sub-nicho', 'Canal', 'Detalhes', 'Temas'].map((label, i) => (
              <div key={i} className={`flex-1 text-center text-[9px] py-1 rounded ${
                step === i ? 'bg-primary text-primary-foreground font-bold' :
                step > i ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground'
              }`}>{label}</div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 0: Choose Niche */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                <p className="text-xs font-medium">1️⃣ Escolha o nicho principal</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {NICHE_OPTIONS.map(n => (
                    <button key={n.key} onClick={() => { setSelectedNiche(n.key); setStep(1); }}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all text-[10px] ${
                        selectedNiche === n.key ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                      }`}>
                      <span className="text-base">{n.emoji}</span>
                      <span className="font-medium truncate w-full text-center">{n.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 1: Sub-niche */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">2️⃣ Escolha o sub-nicho <span className="text-muted-foreground">(opcional)</span></p>
                  <button onClick={() => setStep(0)} className="text-[10px] text-muted-foreground hover:text-primary">← voltar</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {nicheData?.subNiches.map(sn => (
                    <button key={sn} onClick={() => { setSelectedSubNiche(sn); setCustomSubNiche(''); }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                        selectedSubNiche === sn ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border/50 hover:border-primary/30'
                      }`}>{sn}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={customSubNiche} onChange={e => { setCustomSubNiche(e.target.value); setSelectedSubNiche(''); }}
                    placeholder="Ou digite um sub-nicho personalizado..." className="bg-muted/30 text-xs h-8 flex-1" />
                </div>
                <Button size="sm" className="w-full gap-1 text-xs" onClick={() => setStep(2)}>
                  {effectiveSubNiche ? `Continuar com "${effectiveSubNiche}"` : 'Pular — qualquer sub-nicho'}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </motion.div>
            )}

            {/* STEP 2: Channel */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">3️⃣ Selecione o canal <span className="text-muted-foreground">(opcional)</span></p>
                  <button onClick={() => setStep(1)} className="text-[10px] text-muted-foreground hover:text-primary">← voltar</button>
                </div>
                {userChannels.length > 0 ? (
                  <div className="space-y-1.5">
                    {userChannels.map((ch: any) => (
                      <button key={ch.id} onClick={() => setSelectedChannelId(selectedChannelId === ch.id ? null : ch.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border text-xs transition-all ${
                          selectedChannelId === ch.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-primary/30'
                        }`}>
                        {ch.thumbnail && <img src={ch.thumbnail} className="w-7 h-7 rounded-full object-cover" alt="" />}
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-medium truncate">{ch.channel_name}</p>
                          <p className="text-[10px] text-muted-foreground">{ch.niche || 'Sem nicho'}</p>
                        </div>
                        {selectedChannelId === ch.id && <Badge className="text-[9px] bg-primary/20 text-primary">✓ Selecionado</Badge>}
                      </button>
                    ))}
                    {selectedChannelId && channelKnowledge && (
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-2 text-[10px] text-muted-foreground">
                        <p className="font-medium text-accent text-[10px] mb-0.5">📚 Conhecimento do canal carregado</p>
                        <p className="line-clamp-2">{channelKnowledge.slice(0, 150)}...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-3">Nenhum canal vinculado. Vincule em "Canais" para personalizar.</p>
                )}
                <Button size="sm" className="w-full gap-1 text-xs" onClick={() => setStep(3)}>
                  {selectedChannelId ? `Continuar com "${selectedChannel?.channel_name}"` : 'Pular — sem canal'}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </motion.div>
            )}

            {/* STEP 3: Topic + Style + Duration */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">4️⃣ Detalhes finais</p>
                  <button onClick={() => setStep(2)} className="text-[10px] text-muted-foreground hover:text-primary">← voltar</button>
                </div>

                {/* Summary so far */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[9px]">{nicheData?.emoji} {nicheData?.label}</Badge>
                  {effectiveSubNiche && <Badge variant="secondary" className="text-[9px]">{effectiveSubNiche}</Badge>}
                  {selectedChannel && <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">{selectedChannel.channel_name}</Badge>}
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tópico específico (opcional)</label>
                  <Input value={topicInput} onChange={e => setTopicInput(e.target.value)}
                    placeholder="Ex: histórias de milionários que perderam tudo" className="bg-muted/30 text-xs h-8" />
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Estilo preferido</label>
                  <div className="flex flex-wrap gap-1">
                    {STYLE_OPTIONS.map(s => (
                      <button key={s.value} onClick={() => setSelectedStyle(selectedStyle === s.value ? '' : s.value)}
                        className={`px-2 py-1 rounded-md border text-[10px] transition-all ${
                          selectedStyle === s.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                        }`}>{s.label}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Formato</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DURATION_OPTIONS.map(d => (
                      <button key={d.value} onClick={() => setSelectedDuration(d.value as 'short' | 'long')}
                        className={`p-2 rounded-lg border text-[10px] text-left transition-all ${
                          selectedDuration === d.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                        }`}>
                        <span className="font-medium">{d.label}</span>
                        <p className="text-[9px] text-muted-foreground">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shorts Duration Sub-Selection */}
                {selectedDuration === 'short' && (
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">⚡ Tipo de Short</label>
                    <div className="space-y-1">
                      {SHORTS_DURATION_OPTIONS.map(sd => (
                        <button key={sd.value} onClick={() => setShortsDurationCat(sd.value as any)}
                          className={`w-full p-2 rounded-lg border text-[10px] text-left transition-all ${
                            shortsDurationCat === sd.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:border-primary/30'
                          }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{sd.label}</span>
                            <span className="text-[9px] text-muted-foreground">{sd.desc}</span>
                          </div>
                          <p className="text-[9px] text-muted-foreground/70 mt-0.5">Ex: {sd.example}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={generateThemes} disabled={loading} className="w-full gap-2 text-xs">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {loading ? 'Gerando temas virais...' : '🔥 Gerar Temas Virais com IA'}
                </Button>
              </motion.div>
            )}

            {/* STEP 4: Results */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">🔥 {themes.length} Temas Virais</p>
                  <div className="flex gap-1.5">
                    <button onClick={() => setStep(3)} className="text-[10px] text-muted-foreground hover:text-primary">← ajustar</button>
                    <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-primary">↻ novo</button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-1">
                  <Badge variant="outline" className="text-[9px]">{nicheData?.emoji} {nicheData?.label}</Badge>
                  {effectiveSubNiche && <Badge variant="secondary" className="text-[9px]">{effectiveSubNiche}</Badge>}
                  {selectedStyle && <Badge variant="outline" className="text-[9px]">{selectedStyle}</Badge>}
                  <Badge variant="secondary" className="text-[9px]">{selectedDuration === 'short' ? '⚡ Shorts' : '🎬 Long'}</Badge>
                </div>

                <Button onClick={generateThemes} disabled={loading} variant="outline" size="sm" className="w-full gap-1 text-[10px]">
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                  Gerar novos temas
                </Button>

                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {themes.map((theme: any, i: number) => (
                    <button key={i} onClick={() => onSelectTheme({ ...theme, videoFormat: selectedDuration })}
                      className="w-full text-left p-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-xs flex-1">{theme.title}</span>
                        <span className={`text-[10px] font-bold shrink-0 ${theme.viral_score >= 8 ? 'text-chart-2' : theme.viral_score >= 6 ? 'text-chart-3' : 'text-muted-foreground'}`}>
                          🔥 {theme.viral_score}/10
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{theme.description}</p>
                      {theme.hook && <p className="text-[10px] text-accent mt-0.5 italic line-clamp-1">🎣 {theme.hook}</p>}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{theme.style}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{theme.estimated_duration}</Badge>
                        {theme.why_viral && <span className="text-[9px] text-muted-foreground">💡 {theme.why_viral.slice(0, 60)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
