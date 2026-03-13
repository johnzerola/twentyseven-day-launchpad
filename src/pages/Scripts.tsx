import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { FileText, History, Trash2, Flame, ChevronDown, ChevronUp, Target, BookOpen, Film, Users, Image, Check, Zap, Loader2, LayoutTemplate, Lightbulb, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { VIDEO_TYPES, VIDEO_TYPE_DEFAULTS, type VideoType } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { PromptExporter } from '@/components/scripts/PromptExporter';
import { TitleSEOStep } from '@/components/scripts/TitleSEOStep';
import { ShortsSceneBreakdown } from '@/components/scripts/ShortsSceneBreakdown';
import type { Character, SyncedScene, VideoStyleOption } from '@/components/scripts/types';

const VIDEO_STYLES: VideoStyleOption[] = [
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
  const [activeStep, setActiveStep] = useState<'script' | 'style' | 'characters' | 'prompts' | 'titles'>('script');
  const [videoStyle, setVideoStyle] = useState('cinematográfico');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [syncedScenes, setSyncedScenes] = useState<SyncedScene[]>([]);
  const [sceneBlueprintJson, setSceneBlueprintJson] = useState<any[]>([]);
  const [customStyleNotes, setCustomStyleNotes] = useState('');

  // Intelligence
  const [intelligenceBriefing, setIntelligenceBriefing] = useState<any>(null);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [retentionPrediction, setRetentionPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Templates & Themes
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showThemeSuggestions, setShowThemeSuggestions] = useState(false);
  const [themeSuggestions, setThemeSuggestions] = useState<any[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadHistory(); }, [scriptsPag.page]);

  useEffect(() => {
    loadTemplates();
    const outlierTopic = sessionStorage.getItem('outlier_topic');
    if (outlierTopic) { setTopic(outlierTopic); sessionStorage.removeItem('outlier_topic'); toast.success('Referência do Outlier Finder carregada!'); }
    loadLastProjectCharacters();
  }, []);

  // Debounced theme suggestions
  useEffect(() => {
    if (topic.trim().length < 5 || !niche.trim()) return;
    const timer = setTimeout(() => {
      if (!loadingThemes && themeSuggestions.length === 0) {
        generateThemeSuggestions();
        setShowThemeSuggestions(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [topic, niche]);

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

  const generateThemeSuggestions = async () => {
    setLoadingThemes(true);
    setThemeSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-themes', {
        body: { niche: niche || 'faceless dark', style, language, count: 10, topic, narrativeStyle: style },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setThemeSuggestions(data?.themes || []);
      toast.success(`${data?.themes?.length || 0} temas gerados!`);
    } catch (err: any) {
      if (err?.message?.includes('402')) toast.error('Créditos insuficientes.');
      else if (err?.message?.includes('429')) toast.error('Rate limit. Tente novamente.');
      else toast.error(err.message || 'Erro ao gerar temas');
    } finally { setLoadingThemes(false); }
  };

  const useTheme = (theme: any) => {
    setTopic(theme.title);
    if (theme.estimated_duration) { const dur = parseInt(theme.estimated_duration); if (dur) setDuration(String(dur)); }
    const styleMap: Record<string, string> = {
      'documentário': 'documentário', 'listicle': 'listicle', 'tutorial': 'tutorial',
      'true crime': 'narração', 'motivacional': 'storytelling', 'storytelling': 'storytelling',
      'educativo': 'educativo', 'horror': 'narração', 'shorts': 'dopaminérgico',
    };
    if (theme.style && styleMap[theme.style]) setStyle(styleMap[theme.style]);
    toast.success('Tema aplicado!');
    setShowThemeSuggestions(false);
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

  const pipelineSteps = [
    { key: 'script', label: '1. Roteiro', icon: FileText, done: !!script },
    { key: 'style', label: '2. Estilo Visual', icon: Film, done: !!videoStyle && activeStep !== 'script' },
    { key: 'characters', label: '3. Personagens', icon: Users, done: characters.length > 0 || activeStep === 'prompts' || activeStep === 'titles' },
    { key: 'prompts', label: '4. Cenas', icon: Image, done: syncedScenes.length > 0 },
    { key: 'titles', label: '5. Títulos & SEO', icon: Sparkles, done: false },
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
            <History className="w-4 h-4" /> ({scriptsPag.totalCount})
          </Button>
        </div>

        {/* History */}
        {showHistory && scriptsPag.items.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5">
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {scriptsPag.items.map((s: any) => (
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
            <PaginationControls page={scriptsPag.page} totalCount={scriptsPag.totalCount} pageSize={PAGE_SIZE}
              hasMore={scriptsPag.hasMore} hasPrev={scriptsPag.hasPrev} onNext={scriptsPag.nextPage} onPrev={scriptsPag.prevPage} />
          </div>
        )}

        {/* Pipeline Progress */}
        {script && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-2">
            {pipelineSteps.map((step) => (
              <button key={step.key} onClick={() => setActiveStep(step.key as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeStep === step.key ? 'bg-primary text-primary-foreground'
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
            />

            {/* Intelligence Briefing Panel */}
            {intelligenceBriefing && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setShowIntelligence(!showIntelligence)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-xs">📊 Análise de Inteligência</span>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                      {intelligenceBriefing.metadata?.channelsAnalyzed || 0} canais + {intelligenceBriefing.metadata?.youtubeVideosFound || 0} vídeos
                    </Badge>
                  </div>
                  {showIntelligence ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {showIntelligence && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-2 max-h-[400px] overflow-y-auto">
                        {intelligenceBriefing.briefing?.competitive_analysis && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Análise Competitiva</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(intelligenceBriefing.briefing.competitive_analysis.what_works || []).slice(0, 3).map((w: string, i: number) => (
                                <div key={i} className="bg-primary/5 rounded px-2 py-1 text-[10px]">✅ {w}</div>
                              ))}
                              {(intelligenceBriefing.briefing.competitive_analysis.what_to_avoid || []).slice(0, 2).map((w: string, i: number) => (
                                <div key={i} className="bg-destructive/5 rounded px-2 py-1 text-[10px]">❌ {w}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {intelligenceBriefing.briefing?.recommended_hooks?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Hooks Recomendados</p>
                            {intelligenceBriefing.briefing.recommended_hooks.slice(0, 3).map((h: any, i: number) => (
                              <div key={i} className="bg-muted/30 rounded-lg p-2 text-[10px]">
                                <p className="font-medium">🎣 "{h.hook_text}"</p>
                                <p className="text-muted-foreground">{h.why_it_works}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {intelligenceBriefing.briefing?.visual_blueprint && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Blueprint Visual</p>
                            <div className="bg-muted/30 rounded-lg p-2 text-[10px] space-y-0.5">
                              <p>🎨 Estilo: {intelligenceBriefing.briefing.visual_blueprint.recommended_style}</p>
                              <p>💡 Iluminação: {intelligenceBriefing.briefing.visual_blueprint.lighting_mood}</p>
                              <p>🎬 Hook Visual: {intelligenceBriefing.briefing.visual_blueprint.hook_visual_suggestion}</p>
                            </div>
                          </div>
                        )}
                        {intelligenceBriefing.metadata?.topChannelNames?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Canais Referência</p>
                            <div className="flex flex-wrap gap-1">
                              {intelligenceBriefing.metadata.topChannelNames.map((name: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[9px]">{name}</Badge>
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
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-xs">Templates de Roteiro</span>
                  <Badge variant="secondary" className="text-[10px]">{templates.length}</Badge>
                </div>
                {showTemplates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showTemplates && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2 max-h-[300px] overflow-y-auto">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : templates.map((tmpl: any) => (
                    <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                      className="w-full text-left p-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs">{tmpl.title}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Suggestions */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setShowThemeSuggestions(!showThemeSuggestions)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="font-semibold text-xs">Temas Virais</span>
                  {themeSuggestions.length > 0 && <Badge variant="secondary" className="text-[10px]">{themeSuggestions.length}</Badge>}
                </div>
                {showThemeSuggestions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showThemeSuggestions && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                  <Button onClick={generateThemeSuggestions} disabled={loadingThemes} size="sm" className="w-full gap-2 text-xs">
                    {loadingThemes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    {loadingThemes ? 'Analisando...' : 'Gerar Temas Virais com IA'}
                  </Button>
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {themeSuggestions.map((theme: any, i: number) => (
                      <button key={i} onClick={() => useTheme(theme)}
                        className="w-full text-left p-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-xs flex-1">{theme.title}</span>
                          <span className={`text-[10px] font-bold ${theme.viral_score >= 8 ? 'text-emerald-400' : theme.viral_score >= 6 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                            🔥 {theme.viral_score}/10
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{theme.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px]">{theme.style}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{theme.estimated_duration}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
            <AnimatePresence mode="wait">
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
                          videoStyle === vs.value ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30'
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
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Image className="w-4 h-4 text-accent" />
                        {videoType === 'short' ? 'Cenas do Short (9:16)' : 'Gerador de Cenas Visuais'}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {videoType === 'short' ? 'Blocos visuais de 8s otimizados para vertical' : 'A IA analisa o roteiro e cria prompts visuais cinematográficos'}
                      </p>
                    </div>
                    {syncedScenes.length > 0 && (
                      <Button size="sm" onClick={() => setActiveStep('titles')} className="gap-1 h-7 text-xs gradient-hero border-0">
                        Próximo: Títulos & SEO <Sparkles className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {videoType === 'short' ? (
                    <ShortsSceneBreakdown
                      script={script}
                      durationSeconds={parseInt(duration)}
                      videoStyle={videoStyle}
                      characters={characters}
                      customStyleNotes={customStyleNotes}
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
                      />
                      {syncedScenes.length > 0 && (
                        <div className="space-y-3">
                          <PromptExporter scenes={syncedScenes} characters={characters} topic={topic} videoStyle={videoStyle} language={language} />
                          <TimelineSyncLab scenes={syncedScenes} onUpdateScene={(index, updates) => {
                            setSyncedScenes(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
                          }} />
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* Step 5: Titles & SEO */}
              {activeStep === 'titles' && script && (
                <motion.div key="titles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-400" /> Títulos Virais & SEO</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Títulos otimizados com base no roteiro, cenas e estilo do vídeo</p>
                    </div>
                  </div>
                  <TitleSEOStep
                    topic={topic} niche={niche} language={language}
                    script={script} videoStyle={videoStyle} syncedScenes={syncedScenes}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Script output is now inside ScriptGenerator but displayed here when active */}
            {(activeStep === 'script' || !script) && !loading && !script && (
              <div className="bg-card border border-border rounded-xl p-5 text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure e gere seu roteiro viral</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
