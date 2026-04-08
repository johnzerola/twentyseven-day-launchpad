import { useState, useCallback, useEffect } from 'react';
import { Rocket, Mic, Users, Palette, Sparkles, ChevronRight, Loader2, Brain, Film, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Config Options ───

const NICHES = [
  { value: 'finanças', label: 'Finanças', emoji: '💰' },
  { value: 'terror', label: 'Terror/Horror', emoji: '👻' },
  { value: 'tecnologia', label: 'Tecnologia', emoji: '🤖' },
  { value: 'ciência', label: 'Ciência', emoji: '🔬' },
  { value: 'história', label: 'História', emoji: '📜' },
  { value: 'true_crime', label: 'True Crime', emoji: '🔍' },
  { value: 'saúde', label: 'Saúde/Fitness', emoji: '💪' },
  { value: 'curiosidades', label: 'Curiosidades', emoji: '🧠' },
  { value: 'mitologia', label: 'Mitologia', emoji: '⚡' },
  { value: 'empreendedorismo', label: 'Empreendedorismo', emoji: '🚀' },
  { value: 'relacionamentos', label: 'Relacionamentos', emoji: '❤️' },
  { value: 'animal_survival', label: 'Animal Survival', emoji: '🐾' },
  { value: 'gaming', label: 'Gaming', emoji: '🎮' },
];

const VOICE_STYLES = [
  { value: 'dopaminergico', label: 'Dopaminérgico', emoji: '⚡', desc: 'Energia magnética, whisper→shout', color: 'border-primary bg-primary/10 text-primary' },
  { value: 'misterioso', label: 'Misterioso', emoji: '🌑', desc: 'Sussurros + silêncios tensos', color: 'border-chart-4 bg-chart-4/10 text-chart-4' },
  { value: 'energetico', label: 'Energético', emoji: '🔥', desc: 'Explosivo, ritmo contagiante', color: 'border-destructive bg-destructive/10 text-destructive' },
  { value: 'calmo', label: 'Calmo', emoji: '🧘', desc: 'Autoridade BBC/Netflix', color: 'border-chart-2 bg-chart-2/10 text-chart-2' },
];

const SCRIPT_STYLES = [
  { value: 'dopaminérgico', label: '🧠 Dopaminérgico', desc: 'Open loops, curiosity gaps' },
  { value: 'cinematográfico', label: '🎬 Cinematográfico', desc: 'Tensão narrativa estilo filme' },
  { value: 'storytelling', label: '📖 Storytelling', desc: 'Personagens e plot twists' },
  { value: 'documentário', label: '📹 Documentário', desc: 'Investigação profunda' },
  { value: 'mrbeast', label: '🔥 MrBeast Style', desc: 'Alta energia, desafios' },
  { value: 'narração', label: '🎙️ Narração', desc: 'Tom autoritário e misterioso' },
];

const VISUAL_STYLES = [
  { value: 'cinematográfico', label: '🎬 Cinematic Dark', desc: 'Estilo Netflix' },
  { value: 'realista', label: '📷 Hyper Real 8K', desc: 'Fotorrealismo extremo' },
  { value: 'anime', label: '⛩️ Anime Epic', desc: 'Anime dinâmico' },
  { value: '2d', label: '🎨 Kurzgesagt', desc: 'Motion graphics 2D' },
  { value: '3d', label: '🧊 Pixar World', desc: 'Render 3D estilizado' },
  { value: 'dark', label: '🌑 Cyberpunk Neon', desc: 'Neon futurista' },
  { value: 'comic', label: '💥 Comic Book', desc: 'Estilo Marvel/DC' },
  { value: 'documentary_bbc', label: '📹 BBC Documentary', desc: 'NatGeo cinematográfico' },
  { value: 'animal_chase', label: '🐾 Animal Chase', desc: 'Hiper-realista 120fps' },
];

const DURATIONS = [
  { value: '8', label: '8 min', desc: 'Curto' },
  { value: '15', label: '15 min', desc: 'Padrão' },
  { value: '25', label: '25 min', desc: 'Médio' },
  { value: '40', label: '40 min', desc: 'Longo' },
  { value: '60', label: '60 min', desc: 'Super-Vídeo' },
];

const LANGUAGES = [
  { value: 'português', label: '🇧🇷 Português' },
  { value: 'inglês', label: '🇺🇸 English' },
  { value: 'espanhol', label: '🇪🇸 Español' },
];

type WizardStep = 'topic' | 'voice' | 'visual' | 'confirm';

interface VideoCreationWizardProps {
  onLaunch: (config: WizardConfig) => void;
  disabled?: boolean;
}

export interface WizardConfig {
  topic: string;
  niche: string;
  duration: string;
  scriptStyle: string;
  voiceStyle: string;
  visualStyle: string;
  language: string;
  character: string;
}

interface GlobalChar {
  id: string;
  name: string;
  photo_url: string | null;
  visual_description: string | null;
  role: string | null;
}

export const VideoCreationWizard = ({ onLaunch, disabled }: VideoCreationWizardProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('topic');
  const [loadingAutoTopic, setLoadingAutoTopic] = useState(false);

  // Config state
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('curiosidades');
  const [duration, setDuration] = useState('15');
  const [scriptStyle, setScriptStyle] = useState('dopaminérgico');
  const [voiceStyle, setVoiceStyle] = useState('dopaminergico');
  const [visualStyle, setVisualStyle] = useState('cinematográfico');
  const [language, setLanguage] = useState('português');
  const [character, setCharacter] = useState('');
  const [globalChars, setGlobalChars] = useState<GlobalChar[]>([]);

  useEffect(() => {
    if (open) loadCharacters();
  }, [open]);

  const loadCharacters = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('global_characters')
      .select('id, name, photo_url, visual_description, role')
      .eq('user_id', session.user.id)
      .order('usage_count', { ascending: false })
      .limit(10);
    if (data) setGlobalChars(data);
  };

  const autoTopic = useCallback(async () => {
    setLoadingAutoTopic(true);
    try {
      const { data: emerging } = await supabase
        .from('emerging_videos')
        .select('title, niche, views, velocity_score')
        .order('velocity_score', { ascending: false })
        .limit(5);
      if (emerging?.length) {
        const nicheMatch = emerging.find(v => v.niche?.toLowerCase().includes(niche.toLowerCase()));
        const pick = nicheMatch || emerging[0];
        setTopic(pick.title || '');
        toast.success('🧠 Tema trending selecionado!');
      } else {
        const { data: themes } = await supabase.functions.invoke('suggest-themes', {
          body: { niche, language, count: 1 },
        });
        if (themes?.themes?.[0]) {
          setTopic(themes.themes[0].topic || themes.themes[0].title);
          toast.success('🧠 Tema sugerido pela IA!');
        }
      }
    } catch {
      toast.error('Erro ao buscar tema');
    } finally {
      setLoadingAutoTopic(false);
    }
  }, [niche, language]);

  const handleLaunch = () => {
    if (!topic.trim()) { toast.error('Defina um tópico'); return; }
    onLaunch({ topic, niche, duration, scriptStyle, voiceStyle, visualStyle, language, character });
    setOpen(false);
    setStep('topic');
  };

  const STEPS: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
    { key: 'topic', label: 'Tópico', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'voice', label: 'Voz', icon: <Mic className="w-4 h-4" /> },
    { key: 'visual', label: 'Visual', icon: <Palette className="w-4 h-4" /> },
    { key: 'confirm', label: 'Lançar', icon: <Rocket className="w-4 h-4" /> },
  ];

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const canNext = step === 'topic' ? topic.trim().length > 0 : true;

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        size="lg"
        className="gap-2 bg-gradient-to-r from-primary to-chart-4 hover:from-primary/90 hover:to-chart-4/90 text-primary-foreground shadow-lg shadow-primary/20 w-full sm:w-auto"
      >
        <Film className="w-5 h-5" />
        🎬 Criar Próximo Vídeo
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-xl"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-1 p-3 bg-muted/30 border-b border-border">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              step === s.key
                ? 'bg-primary text-primary-foreground shadow'
                : i < stepIdx
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {i < stepIdx ? <Check className="w-3 h-3" /> : s.icon}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xs px-2">✕</button>
      </div>

      <div className="p-4 space-y-4">
        <AnimatePresence mode="wait">
          {/* ─── STEP 1: Topic & Niche ─── */}
          {step === 'topic' && (
            <motion.div key="topic" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Sobre o que é o vídeo?
              </h3>

              {/* Niche chips */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Nicho</label>
                <div className="flex flex-wrap gap-1.5">
                  {NICHES.map(n => (
                    <button
                      key={n.value}
                      onClick={() => setNiche(n.value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        niche === n.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {n.emoji} {n.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic input + auto */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Tópico do vídeo</label>
                <div className="flex gap-2">
                  <Input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Ex: O golpe financeiro que ninguém percebeu..."
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoTopic}
                    disabled={loadingAutoTopic}
                    className="gap-1 shrink-0"
                  >
                    {loadingAutoTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    IA
                  </Button>
                </div>
              </div>

              {/* Script style + Duration + Language */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Estilo do roteiro</label>
                  <select
                    value={scriptStyle}
                    onChange={e => setScriptStyle(e.target.value)}
                    className="w-full rounded-lg bg-muted border border-border px-2 py-1.5 text-xs"
                  >
                    {SCRIPT_STYLES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duração</label>
                  <select
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="w-full rounded-lg bg-muted border border-border px-2 py-1.5 text-xs"
                  >
                    {DURATIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label} — {d.desc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Idioma</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full rounded-lg bg-muted border border-border px-2 py-1.5 text-xs"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: Voice Style ─── */}
          {step === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" /> Escolha o estilo de voz
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_STYLES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVoiceStyle(v.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      voiceStyle === v.value
                        ? v.color + ' shadow-sm'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-lg mb-1">{v.emoji}</div>
                    <div className="text-xs font-semibold">{v.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>

              {/* Character selection */}
              {globalChars.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                    <Users className="w-3 h-3" /> Personagem / Avatar (opcional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setCharacter('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        !character ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Nenhum
                    </button>
                    {globalChars.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setCharacter(c.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          character === c.name
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {c.photo_url && (
                          <img src={c.photo_url} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                        )}
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── STEP 3: Visual Style ─── */}
          {step === 'visual' && (
            <motion.div key="visual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" /> Estilo visual das cenas
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {VISUAL_STYLES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVisualStyle(v.value)}
                    className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                      visualStyle === v.value
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-base">{v.label.split(' ')[0]}</div>
                    <div className="text-[10px] font-medium mt-0.5">{v.label.split(' ').slice(1).join(' ')}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{v.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── STEP 4: Confirm & Launch ─── */}
          {step === 'confirm' && (
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" /> Confirme e lance o vídeo
              </h3>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tópico</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{topic}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nicho</span>
                  <span className="font-medium">{NICHES.find(n => n.value === niche)?.emoji} {NICHES.find(n => n.value === niche)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Roteiro</span>
                  <span className="font-medium">{SCRIPT_STYLES.find(s => s.value === scriptStyle)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voz</span>
                  <span className="font-medium">{VOICE_STYLES.find(v => v.value === voiceStyle)?.emoji} {VOICE_STYLES.find(v => v.value === voiceStyle)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Visual</span>
                  <span className="font-medium">{VISUAL_STYLES.find(v => v.value === visualStyle)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duração</span>
                  <span className="font-medium">{duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Idioma</span>
                  <span className="font-medium">{LANGUAGES.find(l => l.value === language)?.label}</span>
                </div>
                {character && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Personagem</span>
                    <span className="font-medium">🧑 {character}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleLaunch}
                disabled={disabled}
                size="lg"
                className="w-full gap-2 bg-gradient-to-r from-primary to-chart-4 hover:from-primary/90 hover:to-chart-4/90 text-primary-foreground shadow-lg"
              >
                <Rocket className="w-5 h-5" />
                🚀 Gerar Vídeo Completo Automaticamente
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                O sistema vai gerar: roteiro → narração → cenas visuais → títulos → thumbnail
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between pt-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const prev = STEPS[stepIdx - 1];
              if (prev) setStep(prev.key);
            }}
            disabled={stepIdx === 0}
            className="text-xs"
          >
            ← Voltar
          </Button>
          {step !== 'confirm' && (
            <Button
              size="sm"
              onClick={() => {
                const next = STEPS[stepIdx + 1];
                if (next) setStep(next.key);
              }}
              disabled={!canNext}
              className="text-xs gap-1"
            >
              Próximo <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
