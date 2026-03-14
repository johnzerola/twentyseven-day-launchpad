import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Sparkles, Copy, Loader2, TrendingUp, FlaskConical, FileText, Heart, Globe, Youtube } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { YouTubeExportPanel } from '@/components/YouTubeExportPanel';

// Debounce guard for generation buttons
const useClickGuard = (cooldownMs = 3000) => {
  const lastRef = useRef(0);
  return () => {
    const now = Date.now();
    if (now - lastRef.current < cooldownMs) return false;
    lastRef.current = now;
    return true;
  };
};

interface TitleSuggestion {
  title: string;
  style: string;
  estimatedCTR: number;
  hook_used?: string;
  psychological_trigger?: string;
  liked?: boolean;
}

interface ABResult {
  winner: string;
  titleA: { ctr: number; emotionalTriggers: string[]; seoScore: number; lengthScore: number };
  titleB: { ctr: number; emotionalTriggers: string[]; seoScore: number; lengthScore: number };
  analysis: string;
}

interface SEODescription {
  description: string;
  hashtags: string[];
  keywords: string[];
}

const LANGUAGES = [
  { value: '', label: 'Auto-detectar' },
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pl', label: '🇵🇱 Polski' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'ar', label: '🇸🇦 العربية' },
];

// Dynamic color generation for styles
const getStyleColor = (style: string): string => {
  const hash = style.split('').reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colors = [
    'bg-primary/20 text-primary',
    'bg-destructive/20 text-destructive',
    'bg-yellow-500/20 text-yellow-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-violet-500/20 text-violet-400',
    'bg-orange-500/20 text-orange-400',
    'bg-rose-500/20 text-rose-400',
    'bg-teal-500/20 text-teal-400',
  ];
  return colors[Math.abs(hash) % colors.length];
};

type ActiveTab = 'generate' | 'ab-test' | 'seo-desc';

const Titles = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generate');

  // Generate tab
  const [niche, setNiche] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);

  // A/B test tab
  const [titleA, setTitleA] = useState('');
  const [titleB, setTitleB] = useState('');
  const [abLoading, setAbLoading] = useState(false);
  const [abResult, setAbResult] = useState<ABResult | null>(null);

  // SEO description tab
  const [seoTitle, setSeoTitle] = useState('');
  const [seoNiche, setSeoNiche] = useState('');
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoResult, setSeoResult] = useState<SEODescription | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: saved } = await supabase
        .from('saved_titles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (saved) {
        if (saved.titles_json) setTitles((saved.titles_json as any) || []);
        if (saved.topic) setTopic(saved.topic);
        if (saved.niche) setNiche(saved.niche);
        if (saved.ab_test_json) setAbResult(saved.ab_test_json as any);
        if (saved.seo_json) setSeoResult(saved.seo_json as any);
      }
    })();
  }, []);

  const saveTitles = async (titlesData: TitleSuggestion[], topicStr?: string, nicheStr?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('saved_titles').insert({
      user_id: user.id,
      topic: topicStr || topic,
      niche: nicheStr || niche,
      titles_json: titlesData as any,
    } as any);
  };

  // Learning feedback — fires when user likes/copies a title
  const saveLearn = async (title: TitleSuggestion, action: 'chosen' | 'copied') => {
    try {
      await supabase.functions.invoke('generate-titles', {
        body: { type: 'learn', title: title.title, style: title.style, ctr: title.estimatedCTR, niche, action },
      });
    } catch { /* non-blocking */ }
  };

  const canClick = useClickGuard();

  const generateTitles = async () => {
    if (!niche.trim() && !topic.trim()) return toast.error('Preencha nicho ou tema');
    if (!canClick()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { niche, topic, language, type: 'generate' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const generated = (data?.titles || []).map((t: any) => ({ ...t, liked: false }));
      setTitles(generated);
      if (generated.length) {
        await saveTitles(generated, topic, niche);
        toast.success(`${generated.length} títulos gerados!`);
      } else {
        toast.info('Nenhum título gerado');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar títulos');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = (index: number) => {
    setTitles(prev => prev.map((t, i) => {
      if (i === index) {
        const liked = !t.liked;
        if (liked) saveLearn(t, 'chosen');
        return { ...t, liked };
      }
      return t;
    }));
  };

  const runABTest = async () => {
    if (!titleA.trim() || !titleB.trim()) return toast.error('Preencha ambos os títulos');
    setAbLoading(true);
    setAbResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { type: 'ab-test', titleA, titleB, language },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAbResult(data?.result || null);
    } catch (err: any) {
      toast.error(err.message || 'Erro no A/B test');
    } finally {
      setAbLoading(false);
    }
  };

  const generateSEODesc = async () => {
    if (!seoTitle.trim()) return toast.error('Preencha o título do vídeo');
    setSeoLoading(true);
    setSeoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { type: 'seo-description', title: seoTitle, niche: seoNiche, language },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSeoResult(data?.result || null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar descrição');
    } finally {
      setSeoLoading(false);
    }
  };

  const copyTitle = (title: string, titleObj?: TitleSuggestion) => {
    navigator.clipboard.writeText(title);
    toast.success('Copiado!');
    if (titleObj) saveLearn(titleObj, 'copied');
  };

  const TABS = [
    { id: 'generate' as const, label: 'Gerar Títulos', icon: Sparkles },
    { id: 'ab-test' as const, label: 'A/B Tester', icon: FlaskConical },
    { id: 'seo-desc' as const, label: 'Descrição SEO', icon: FileText },
  ];

  const avgCTR = titles.length ? (titles.reduce((a, t) => a + t.estimatedCTR, 0) / titles.length).toFixed(1) : '0';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Títulos Virais & SEO</h1>
            <p className="text-sm text-muted-foreground">Títulos com CTR 15-30%, A/B testing e descrições SEO</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${
                activeTab === tab.id
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border/50 bg-secondary/30 hover:border-primary/30 text-muted-foreground'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <>
            <div className="glass rounded-xl p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nicho</label>
                  <Input placeholder="Ex: finanças, gaming, horror..." value={niche}
                    onChange={e => setNiche(e.target.value)} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tema específico (opcional)</label>
                  <Input placeholder="Ex: como ganhar dinheiro dormindo" value={topic}
                    onChange={e => setTopic(e.target.value)} className="bg-secondary/50"
                    onKeyDown={e => e.key === 'Enter' && generateTitles()} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Idioma / País
                  </label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Auto-detectar" /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => (
                        <SelectItem key={l.value} value={l.value || '_auto'}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateTitles} disabled={loading} className="gradient-hero border-0 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Gerando 20 títulos virais...' : 'Gerar Títulos (CTR 15-30%)'}
              </Button>
            </div>

            {titles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> {titles.length} Títulos — CTR Médio: {avgCTR}%
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(titles.map(t => t.title).join('\n'));
                    toast.success('Todos copiados!');
                  }}>
                    <Copy className="w-3 h-3 mr-1" /> Copiar Todos
                  </Button>
                </div>
                <div className="grid gap-2">
                  {titles.sort((a, b) => b.estimatedCTR - a.estimatedCTR).map((t, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="glass rounded-lg p-4 flex items-center gap-3 group hover:border-primary/30 transition-all">
                      <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`text-[10px] ${getStyleColor(t.style)}`}>
                            {t.style}
                          </Badge>
                          <span className={`text-[10px] font-bold ${t.estimatedCTR >= 20 ? 'text-emerald-400' : t.estimatedCTR >= 15 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                            CTR: {t.estimatedCTR}%
                          </span>
                          {t.psychological_trigger && (
                            <Badge variant="secondary" className="text-[9px]">🧠 {t.psychological_trigger}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleLike(i)}
                          className={`transition-all ${t.liked ? 'text-rose-400' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}>
                          <Heart className={`w-3 h-3 ${t.liked ? 'fill-rose-400' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setTitleA(t.title); setActiveTab('ab-test'); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2" title="Testar A/B">
                          <FlaskConical className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSeoTitle(t.title); setActiveTab('seo-desc'); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2" title="Gerar SEO">
                          <FileText className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyTitle(t.title, t)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {titles.length === 0 && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Digite um nicho e/ou tema para gerar 20 títulos virais</p>
              </div>
            )}
          </>
        )}

        {/* A/B Test Tab */}
        {activeTab === 'ab-test' && (
          <>
            <div className="glass rounded-xl p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Compare dois títulos — a IA analisa CTR, gatilhos emocionais, SEO e comprimento ideal.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Título A</label>
                  <Input placeholder="Primeiro título..." value={titleA} onChange={e => setTitleA(e.target.value)} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Título B</label>
                  <Input placeholder="Segundo título..." value={titleB} onChange={e => setTitleB(e.target.value)} className="bg-secondary/50"
                    onKeyDown={e => e.key === 'Enter' && runABTest()} />
                </div>
              </div>
              <Button onClick={runABTest} disabled={abLoading} className="gradient-hero border-0 gap-2">
                {abLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                {abLoading ? 'Analisando...' : 'Comparar Títulos'}
              </Button>
            </div>

            {abResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {(['A', 'B'] as const).map(side => {
                    const data = side === 'A' ? abResult.titleA : abResult.titleB;
                    const title = side === 'A' ? titleA : titleB;
                    const isWinner = abResult.winner === side;
                    return (
                      <div key={side} className={`glass rounded-xl p-5 ${isWinner ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : ''}`}>
                        {isWinner && <Badge className="bg-emerald-500/20 text-emerald-400 mb-2">🏆 Vencedor</Badge>}
                        <p className="font-medium text-sm mb-3">{title}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">CTR Estimado</span>
                            <span className="font-bold text-primary">{data.ctr}%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">SEO Score</span>
                            <span className="font-bold">{data.seoScore}/10</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Comprimento</span>
                            <span className="font-bold">{data.lengthScore}/10</span>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Gatilhos Emocionais:</p>
                            <div className="flex flex-wrap gap-1">
                              {data.emotionalTriggers.map((t, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">{abResult.analysis}</p>
                </div>
              </motion.div>
            )}

            {!abResult && !abLoading && (
              <div className="text-center py-16 text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Cole dois títulos para descobrir qual performa melhor</p>
              </div>
            )}
          </>
        )}

        {/* SEO Description Tab */}
        {activeTab === 'seo-desc' && (
          <>
            <div className="glass rounded-xl p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Gere uma descrição SEO completa com timestamps, keywords e hashtags otimizadas.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Título do Vídeo</label>
                  <Input placeholder="Ex: 7 Formas de Ganhar Dinheiro em 2026" value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)} className="bg-secondary/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nicho (opcional)</label>
                  <Input placeholder="Ex: finanças pessoais" value={seoNiche}
                    onChange={e => setSeoNiche(e.target.value)} className="bg-secondary/50"
                    onKeyDown={e => e.key === 'Enter' && generateSEODesc()} />
                </div>
              </div>
              <Button onClick={generateSEODesc} disabled={seoLoading} className="gradient-hero border-0 gap-2">
                {seoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {seoLoading ? 'Gerando descrição...' : 'Gerar Descrição SEO'}
              </Button>
            </div>

            {seoResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Descrição Otimizada</h3>
                    <Button variant="outline" size="sm" onClick={() => copyTitle(seoResult.description)}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <Textarea value={seoResult.description} readOnly rows={12}
                    className="bg-secondary/50 text-sm font-mono" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-4">
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Keywords</h4>
                    <div className="flex flex-wrap gap-1">
                      {seoResult.keywords.map((k, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Hashtags</h4>
                    <div className="flex flex-wrap gap-1">
                      {seoResult.hashtags.map((h, i) => (
                        <Badge key={i} className="bg-primary/20 text-primary text-[10px]">{h}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* YouTube Export Panel — shows when we have SEO data */}
            {seoResult && (
              <YouTubeExportPanel
                title={seoTitle}
                description={seoResult.description}
                tags={seoResult.keywords}
                hashtags={seoResult.hashtags}
              />
            )}

            {!seoResult && !seoLoading && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Insira o título do vídeo para gerar descrição SEO completa</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Titles;
