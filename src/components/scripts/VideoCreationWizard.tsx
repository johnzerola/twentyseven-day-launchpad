import { useState, useCallback, useEffect } from 'react';
import { Rocket, Mic, Palette, Sparkles, Loader2, Brain, Film, Check, ChevronRight, Globe, Clock, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  { value: 'geopolítica', label: 'Geopolítica', emoji: '🌍' },
];

const VOICE_STYLES = [
  { value: 'dopaminergico', label: 'Dopaminérgico', emoji: '⚡', desc: 'Energia magnética, whisper→shout' },
  { value: 'misterioso', label: 'Misterioso', emoji: '🌑', desc: 'Sussurros + silêncios tensos' },
  { value: 'energetico', label: 'Energético', emoji: '🔥', desc: 'Explosivo, ritmo contagiante' },
  { value: 'calmo', label: 'Calmo', emoji: '🧘', desc: 'Autoridade BBC/Netflix' },
  { value: 'narrativo', label: 'Narrativo', emoji: '📖', desc: 'Storytelling envolvente' },
  { value: 'suspense', label: 'Suspense', emoji: '😰', desc: 'Tensão crescente, pausas' },
];

const SCRIPT_STYLES = [
  { value: 'dopaminérgico', label: 'Dopaminérgico', emoji: '🧠', desc: 'Open loops, curiosity gaps' },
  { value: 'cinematográfico', label: 'Cinematográfico', emoji: '🎬', desc: 'Tensão narrativa estilo filme' },
  { value: 'storytelling', label: 'Storytelling', emoji: '📖', desc: 'Personagens e plot twists' },
  { value: 'documentário', label: 'Documentário', emoji: '📹', desc: 'Investigação profunda' },
  { value: 'webdocumentário', label: 'Webdoc', emoji: '🌍', desc: 'JJ, LEMMiNO, Discovery' },
  { value: 'mrbeast', label: 'MrBeast Style', emoji: '🔥', desc: 'Alta energia, desafios' },
  { value: 'narração', label: 'Narração', emoji: '🎙️', desc: 'Tom autoritário e misterioso' },
];

const VISUAL_STYLES = [
  { value: 'cinematográfico', label: 'Cinematic Dark', emoji: '🎬', desc: 'Netflix' },
  { value: 'realista', label: 'Hyper Real 8K', emoji: '📷', desc: 'Fotorrealismo' },
  { value: 'anime', label: 'Anime Epic', emoji: '⛩️', desc: 'Anime dinâmico' },
  { value: '2d', label: 'Kurzgesagt', emoji: '🎨', desc: 'Motion graphics' },
  { value: '3d', label: 'Pixar World', emoji: '🧊', desc: '3D estilizado' },
  { value: 'dark', label: 'Cyberpunk Neon', emoji: '🌑', desc: 'Neon futurista' },
  { value: 'comic', label: 'Comic Book', emoji: '💥', desc: 'Marvel/DC' },
  { value: 'documentary_bbc', label: 'BBC Documentary', emoji: '📹', desc: 'NatGeo' },
  { value: 'animal_chase', label: 'Animal Chase', emoji: '🐾', desc: '120fps' },
];

const DURATIONS = [
  { value: '8', label: '8 min' },
  { value: '15', label: '15 min' },
  { value: '25', label: '25 min' },
  { value: '40', label: '40 min' },
  { value: '60', label: '60 min' },
];

const LANGUAGES = [
  { value: 'português', label: '🇧🇷 PT' },
  { value: 'inglês', label: '🇺🇸 EN' },
  { value: 'espanhol', label: '🇪🇸 ES' },
];

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

interface VideoCreationWizardProps {
  onLaunch: (config: WizardConfig) => void;
  disabled?: boolean;
}

export const VideoCreationWizard = ({ onLaunch, disabled }: VideoCreationWizardProps) => {
  const [open, setOpen] = useState(true);
  const [loadingAutoTopic, setLoadingAutoTopic] = useState(false);

  // Config
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

  // Auto-map niche to visual style
  useEffect(() => {
    if (niche === 'animal_survival') setVisualStyle('animal_chase');
    if (niche === 'terror' || niche === 'true_crime') setVisualStyle('dark');
  }, [niche]);

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
  };

  const isReady = topic.trim().length > 0;

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
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-chart-4/10 border-b border-border">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-sm">Configurar Novo Vídeo</h2>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-sm px-2">✕</button>
      </div>

      <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">

        {/* ─── 1. TEMA ─── */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> 1. Tema do Vídeo
          </h3>

          {/* Niche chips */}
          <div className="flex flex-wrap gap-1.5">
            {NICHES.map(n => (
              <button
                key={n.value}
                onClick={() => setNiche(n.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  niche === n.value
                    ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {n.emoji} {n.label}
              </button>
            ))}
          </div>

          {/* Topic input */}
          <div className="flex gap-2">
            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ex: O golpe financeiro que ninguém percebeu..."
              className="flex-1"
            />
            <Button
              variant="outline" size="icon"
              onClick={autoTopic}
              disabled={loadingAutoTopic}
              title="IA sugere tema trending"
            >
              {loadingAutoTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            </Button>
          </div>

          {/* Duration + Language row */}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex gap-1">
                {DURATIONS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      duration === d.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    language === l.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 2. ESTILO DO ROTEIRO ─── */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" /> 2. Estilo do Roteiro
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {SCRIPT_STYLES.map(s => (
              <button
                key={s.value}
                onClick={() => setScriptStyle(s.value)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  scriptStyle === s.value
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="text-base">{s.emoji}</div>
                <div className="text-[9px] font-semibold mt-0.5 leading-tight">{s.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ─── 3. VOZ ─── */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-primary" /> 3. Estilo de Voz
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {VOICE_STYLES.map(v => (
              <button
                key={v.value}
                onClick={() => setVoiceStyle(v.value)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  voiceStyle === v.value
                    ? 'border-chart-2 bg-chart-2/10 shadow-sm'
                    : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="text-base">{v.emoji}</div>
                <div className="text-[9px] font-semibold mt-0.5 leading-tight">{v.label}</div>
              </button>
            ))}
          </div>

          {/* Character */}
          {globalChars.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <button
                onClick={() => setCharacter('')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  !character ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                Sem avatar
              </button>
              {globalChars.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCharacter(c.name)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                    character === c.name ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {c.photo_url && <img src={c.photo_url} alt="" className="w-4 h-4 rounded-full" />}
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─── 4. VISUAL ─── */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-primary" /> 4. Estilo Visual
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {VISUAL_STYLES.map(v => (
              <button
                key={v.value}
                onClick={() => setVisualStyle(v.value)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  visualStyle === v.value
                    ? 'border-chart-4 bg-chart-4/10 shadow-sm'
                    : 'border-border bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="text-base">{v.emoji}</div>
                <div className="text-[9px] font-semibold mt-0.5 leading-tight">{v.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ─── SUMMARY + LAUNCH ─── */}
        <section className="space-y-3 pt-2 border-t border-border/50">
          {/* Mini summary */}
          <div className="flex flex-wrap gap-1.5">
            {topic.trim() && <Badge variant="secondary" className="text-[10px]">📝 {topic.slice(0, 40)}{topic.length > 40 ? '…' : ''}</Badge>}
            <Badge variant="secondary" className="text-[10px]">{NICHES.find(n => n.value === niche)?.emoji} {NICHES.find(n => n.value === niche)?.label}</Badge>
            <Badge variant="secondary" className="text-[10px]">⏱️ {duration}min</Badge>
            <Badge variant="secondary" className="text-[10px]">{VOICE_STYLES.find(v => v.value === voiceStyle)?.emoji} {VOICE_STYLES.find(v => v.value === voiceStyle)?.label}</Badge>
            <Badge variant="secondary" className="text-[10px]">{VISUAL_STYLES.find(v => v.value === visualStyle)?.emoji} {VISUAL_STYLES.find(v => v.value === visualStyle)?.label}</Badge>
          </div>

          <Button
            onClick={handleLaunch}
            disabled={disabled || !isReady}
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-primary to-chart-4 hover:from-primary/90 hover:to-chart-4/90 text-primary-foreground shadow-lg text-sm"
          >
            <Rocket className="w-5 h-5" />
            🚀 Gerar Vídeo Completo Automaticamente
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Roteiro → Narração → Cenas Visuais → Títulos → Thumbnail — tudo automático
          </p>
        </section>
      </div>
    </motion.div>
  );
};
