import { useState } from 'react';
import { Sparkles, Copy, Loader2, TrendingUp, FlaskConical, FileText, Heart, Globe, Search, Zap, Brain, BarChart3, Target, Tag, ShieldCheck, ArrowUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface TitleSuggestion {
  title: string;
  style: string;
  estimatedCTR: number;
  hook_used?: string;
  psychological_trigger?: string;
  differentiation?: string;
  liked?: boolean;
}

interface ABResult {
  winner: string;
  titleA: { ctr: number; emotionalTriggers: string[]; seoScore: number; lengthScore: number; curiosityGapScore?: number };
  titleB: { ctr: number; emotionalTriggers: string[]; seoScore: number; lengthScore: number; curiosityGapScore?: number };
  analysis: string;
  improvement_suggestion?: string;
}

interface SEODescription {
  description: string;
  hashtags: string[];
  keywords: string[];
  seo_score?: number;
  keyword_density_note?: string;
}

interface SEOFactor {
  score: number;
  weight: number;
  label: string;
  tip: string;
  category: string;
}

interface SEOAnalysisResult {
  seo_score: number;
  grade: string;
  scores: Record<string, SEOFactor>;
  category_scores: Record<string, number>;
  issues: string[];
  ai_suggestions?: {
    alternative_titles?: { title: string; estimated_ctr: number; why_better: string }[];
    suggested_tags?: string[];
    description_template?: string;
    hook_suggestion?: string;
    seo_keywords?: string[];
    quick_wins?: string[];
  };
  metadata: Record<string, any>;
}

const getStyleColor = (style: string): string => {
  const hash = style.split('').reduce((acc, c) => c.charCodeAt(0) + ((acc << 5) - acc), 0);
  const colors = [
    'bg-primary/20 text-primary', 'bg-destructive/20 text-destructive',
    'bg-yellow-500/20 text-yellow-400', 'bg-emerald-500/20 text-emerald-400',
    'bg-pink-500/20 text-pink-400', 'bg-cyan-500/20 text-cyan-400',
    'bg-violet-500/20 text-violet-400', 'bg-orange-500/20 text-orange-400',
    'bg-rose-500/20 text-rose-400', 'bg-teal-500/20 text-teal-400',
  ];
  return colors[Math.abs(hash) % colors.length];
};

const getGradeColor = (grade: string) => {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (grade === 'B+' || grade === 'B') return 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30';
  if (grade === 'C') return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
  return 'text-destructive bg-destructive/15 border-destructive/30';
};

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-yellow-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-destructive';
};

const getProgressColor = (score: number) => {
  if (score >= 8) return '[&>div]:bg-emerald-500';
  if (score >= 6) return '[&>div]:bg-yellow-500';
  if (score >= 4) return '[&>div]:bg-orange-500';
  return '[&>div]:bg-destructive';
};

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'title': return Target;
    case 'description': return FileText;
    case 'tags': return Tag;
    case 'market': return TrendingUp;
    default: return BarChart3;
  }
};

const getCategoryLabel = (cat: string) => {
  switch (cat) {
    case 'title': return 'Título';
    case 'description': return 'Descrição';
    case 'tags': return 'Tags';
    case 'market': return 'Mercado';
    default: return cat;
  }
};

interface TitleSEOStepProps {
  topic: string;
  niche: string;
  language: string;
  script: string;
  videoStyle: string;
  syncedScenes: any[];
}

export const TitleSEOStep = ({ topic, niche, language, script, videoStyle, syncedScenes }: TitleSEOStepProps) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'ab-test' | 'seo-desc' | 'seo-audit'>('generate');
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);
  const [competitorAnalysis, setCompetitorAnalysis] = useState('');
  const [researchInfo, setResearchInfo] = useState<{ competitors_analyzed: boolean; brave_trends_used: boolean } | null>(null);

  // A/B
  const [titleA, setTitleA] = useState('');
  const [titleB, setTitleB] = useState('');
  const [abLoading, setAbLoading] = useState(false);
  const [abResult, setAbResult] = useState<ABResult | null>(null);

  // SEO Description
  const [seoTitle, setSeoTitle] = useState('');
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoResult, setSeoResult] = useState<SEODescription | null>(null);

  // SEO Audit
  const [auditTitle, setAuditTitle] = useState('');
  const [auditKeyword, setAuditKeyword] = useState('');
  const [auditDesc, setAuditDesc] = useState('');
  const [auditTags, setAuditTags] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<SEOAnalysisResult | null>(null);
  const [auditExpandedCat, setAuditExpandedCat] = useState<string | null>('title');

  const buildScriptContext = () => {
    const parts: string[] = [];
    if (script) parts.push(`ROTEIRO COMPLETO (resumo): ${script.slice(0, 800)}`);
    if (videoStyle) parts.push(`ESTILO VISUAL: ${videoStyle}`);
    if (syncedScenes?.length) {
      let accTime = 0;
      const timestampedLines: string[] = [];
      syncedScenes.forEach((s: any) => {
        const text = s.tts_text || s.text_content || '';
        if (!text) return;
        const mins = Math.floor(accTime / 60);
        const secs = Math.floor(accTime % 60);
        const ts = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        timestampedLines.push(`[${ts}] ${text}`);
        accTime += (s.duration_sec || 8);
      });
      if (timestampedLines.length) {
        const totalMins = Math.ceil(accTime / 60);
        parts.push(`TRANSCRIÇÃO COM TIMESTAMPS (${timestampedLines.length} cenas, ~${totalMins}min total):\n${timestampedLines.join('\n')}`);
      }
    }
    return parts.join('\n\n');
  };

  const saveLearn = async (title: TitleSuggestion, action: 'chosen' | 'copied') => {
    try {
      await supabase.functions.invoke('generate-titles', {
        body: { type: 'learn', title: title.title, style: title.style, ctr: title.estimatedCTR, niche, action },
      });
    } catch { /* non-blocking */ }
  };

  const generateTitles = async () => {
    setLoading(true);
    setCompetitorAnalysis('');
    setResearchInfo(null);
    try {
      const scriptContext = buildScriptContext();
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { niche, topic, language, type: 'generate', scriptContext },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const generated = (data?.titles || []).map((t: any) => ({ ...t, liked: false }));
      setTitles(generated);
      if (data?.competitor_analysis) setCompetitorAnalysis(data.competitor_analysis);
      if (data?.research) setResearchInfo(data.research);
      if (generated.length) {
        const sources = [];
        if (data?.research?.competitors_analyzed) sources.push('YouTube');
        if (data?.research?.brave_trends_used) sources.push('Brave');
        toast.success(`${generated.length} títulos gerados! Fontes: DB + ${sources.join(' + ') || 'IA'}`);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('saved_titles').insert({
            user_id: user.id, topic, niche, titles_json: generated as any,
          } as any);
        }
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
        body: { type: 'ab-test', titleA, titleB, language, niche },
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
    const title = seoTitle || titles.find(t => t.liked)?.title || titles[0]?.title;
    if (!title) return toast.error('Gere títulos primeiro ou preencha um título');
    setSeoLoading(true);
    setSeoResult(null);
    try {
      const scriptContext = buildScriptContext();
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { type: 'seo-description', title, niche, language, scriptContext },
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

  const runSEOAudit = async () => {
    const titleToAudit = auditTitle || titles.find(t => t.liked)?.title || titles[0]?.title;
    if (!titleToAudit) return toast.error('Preencha um título para analisar');
    setAuditLoading(true);
    setAuditResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('seo-analyzer', {
        body: {
          title: titleToAudit,
          keyword: auditKeyword || topic,
          description: auditDesc,
          tags: auditTags ? auditTags.split(',').map(t => t.trim()).filter(Boolean) : [],
          language,
          niche,
          include_suggestions: true,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAuditResult(data);
      toast.success(`Análise completa: ${data.grade} (${data.seo_score}/10)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro na análise SEO');
    } finally {
      setAuditLoading(false);
    }
  };

  const copyText = (text: string, titleObj?: TitleSuggestion) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
    if (titleObj) saveLearn(titleObj, 'copied');
  };

  const avgCTR = titles.length ? (titles.reduce((a, t) => a + t.estimatedCTR, 0) / titles.length).toFixed(1) : '0';

  const contextInfo = [
    topic && `📝 Tema: ${topic}`,
    niche && `🎯 Nicho: ${niche}`,
    script && `📜 Roteiro: ${script.length} chars`,
    syncedScenes?.length && `🎬 ${syncedScenes.length} cenas`,
    videoStyle && `🎨 Estilo: ${videoStyle}`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Context Banner */}
      {contextInfo.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <p className="text-[10px] font-medium text-emerald-400 mb-1">🧠 A IA tem contexto completo + pesquisa concorrentes em tempo real:</p>
          <div className="flex flex-wrap gap-2">
            {contextInfo.map((info, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{info}</Badge>
            ))}
            <Badge className="bg-primary/20 text-primary text-[10px]">🔍 YouTube API</Badge>
            <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">🌐 Brave Search</Badge>
            <Badge className="bg-violet-500/20 text-violet-400 text-[10px]">🧪 Gemini Pro</Badge>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'generate' as const, label: 'Gerar Títulos', icon: Sparkles },
          { id: 'ab-test' as const, label: 'A/B Test', icon: FlaskConical },
          { id: 'seo-desc' as const, label: 'SEO & Descrição', icon: FileText },
          { id: 'seo-audit' as const, label: '🔬 Análise SEO', icon: ShieldCheck },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all border ${
              activeTab === tab.id
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border/50 bg-secondary/30 hover:border-primary/30 text-muted-foreground'
            }`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <>
          <Button onClick={generateTitles} disabled={loading} className="w-full gradient-hero border-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Pesquisando concorrentes + gerando títulos...' : 'Gerar 20 Títulos (Gemini Pro + YouTube + Brave)'}
          </Button>

          {researchInfo && (
            <div className="flex gap-2 flex-wrap">
              {researchInfo.competitors_analyzed && (
                <Badge className="bg-emerald-500/15 text-emerald-400 text-[9px] gap-1">
                  <Search className="w-3 h-3" /> Concorrentes YouTube analisados
                </Badge>
              )}
              {researchInfo.brave_trends_used && (
                <Badge className="bg-orange-500/15 text-orange-400 text-[9px] gap-1">
                  <Globe className="w-3 h-3" /> Tendências Brave detectadas
                </Badge>
              )}
              <Badge className="bg-violet-500/15 text-violet-400 text-[9px] gap-1">
                <Brain className="w-3 h-3" /> Gemini Pro + 945 títulos DB
              </Badge>
            </div>
          )}

          {competitorAnalysis && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-[10px] font-medium text-amber-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Análise dos Concorrentes
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{competitorAnalysis}</p>
            </motion.div>
          )}

          {titles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> {titles.length} Títulos — CTR Estimado (IA): {avgCTR}%
                </h3>
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => {
                  navigator.clipboard.writeText(titles.map(t => t.title).join('\n'));
                  toast.success('Todos copiados!');
                }}>
                  <Copy className="w-3 h-3 mr-1" /> Todos
                </Button>
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {titles.sort((a, b) => b.estimatedCTR - a.estimatedCTR).map((t, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="bg-muted/30 rounded-lg p-3 flex items-center gap-2 group hover:bg-muted/50 transition-all">
                    <span className="text-sm font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs">{t.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge className={`text-[9px] ${getStyleColor(t.style)}`}>{t.style}</Badge>
                        <span className={`text-[9px] font-bold ${t.estimatedCTR >= 20 ? 'text-emerald-400' : t.estimatedCTR >= 15 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                          CTR est: {t.estimatedCTR}%
                        </span>
                        <span className="text-[8px] text-muted-foreground/50">(est. IA)</span>
                        {t.psychological_trigger && (
                          <Badge variant="secondary" className="text-[8px]">🧠 {t.psychological_trigger}</Badge>
                        )}
                        {t.hook_used && (
                          <Badge variant="secondary" className="text-[8px]">🔥 {t.hook_used}</Badge>
                        )}
                      </div>
                      {t.differentiation && (
                        <p className="text-[8px] text-muted-foreground mt-0.5 italic">💡 {t.differentiation}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="sm" className={`h-7 w-7 ${t.liked ? 'text-rose-400' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={() => toggleLike(i)}>
                        <Heart className={`w-3 h-3 ${t.liked ? 'fill-rose-400' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => { setTitleA(t.title); setActiveTab('ab-test'); }}>
                        <FlaskConical className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => { setSeoTitle(t.title); setActiveTab('seo-desc'); }}>
                        <FileText className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => { setAuditTitle(t.title); setActiveTab('seo-audit'); }}>
                        <ShieldCheck className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => copyText(t.title, t)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* A/B Test Tab */}
      {activeTab === 'ab-test' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Título A</label>
              <Input placeholder="Primeiro título..." value={titleA} onChange={e => setTitleA(e.target.value)} className="bg-secondary/50 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Título B</label>
              <Input placeholder="Segundo título..." value={titleB} onChange={e => setTitleB(e.target.value)} className="bg-secondary/50 text-xs" />
            </div>
          </div>
          <Button onClick={runABTest} disabled={abLoading} size="sm" className="gradient-hero border-0 gap-2">
            {abLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            {abLoading ? 'Analisando com Gemini Pro...' : 'Comparar (Gemini Pro)'}
          </Button>
          {abResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B'] as const).map(side => {
                  const data = side === 'A' ? abResult.titleA : abResult.titleB;
                  const title = side === 'A' ? titleA : titleB;
                  const isWinner = abResult.winner === side;
                  return (
                    <div key={side} className={`bg-muted/30 rounded-lg p-3 ${isWinner ? 'ring-1 ring-emerald-500/30' : ''}`}>
                      {isWinner && <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px] mb-1">🏆 Vencedor</Badge>}
                      <p className="font-medium text-[10px] mb-2">{title}</p>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between"><span className="text-muted-foreground">CTR</span><span className="font-bold text-primary">{data.ctr}%</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">SEO</span><span className="font-bold">{data.seoScore}/10</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Comprimento</span><span className="font-bold">{data.lengthScore}/10</span></div>
                        {data.curiosityGapScore && (
                          <div className="flex justify-between"><span className="text-muted-foreground">Curiosity Gap</span><span className="font-bold">{data.curiosityGapScore}/10</span></div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {data.emotionalTriggers.map((t, i) => (
                            <Badge key={i} variant="secondary" className="text-[8px]">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">{abResult.analysis}</p>
              {abResult.improvement_suggestion && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-2">
                  <p className="text-[9px] font-medium text-primary mb-0.5">💡 Sugestão de melhoria:</p>
                  <p className="text-[10px] text-muted-foreground">{abResult.improvement_suggestion}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* SEO Description Tab */}
      {activeTab === 'seo-desc' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Título do vídeo (ou selecione dos gerados)</label>
            <Input placeholder="Título para gerar SEO..." value={seoTitle} onChange={e => setSeoTitle(e.target.value)} className="bg-secondary/50 text-xs" />
          </div>
          <Button onClick={generateSEODesc} disabled={seoLoading} size="sm" className="gradient-hero border-0 gap-2">
            {seoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {seoLoading ? 'Pesquisando keywords + gerando...' : 'Gerar Descrição SEO (Gemini Pro + Brave)'}
          </Button>
          {seoResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {seoResult.seo_score && (
                <div className="flex items-center gap-2">
                  <Badge className={`${seoResult.seo_score >= 8 ? 'bg-emerald-500/20 text-emerald-400' : seoResult.seo_score >= 6 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-destructive/20 text-destructive'} text-xs`}>
                    SEO Score: {seoResult.seo_score}/10
                  </Badge>
                  {seoResult.keyword_density_note && (
                    <span className="text-[9px] text-muted-foreground">{seoResult.keyword_density_note}</span>
                  )}
                </div>
              )}
              <div className="relative">
                <Textarea value={seoResult.description} readOnly rows={12} className="bg-secondary/50 text-[11px] font-mono" />
                <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-[9px]"
                  onClick={() => copyText(seoResult.description)}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] font-medium text-muted-foreground mb-1">Keywords ({seoResult.keywords.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {seoResult.keywords.map((k, i) => <Badge key={i} variant="secondary" className="text-[8px]">{k}</Badge>)}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] font-medium text-muted-foreground mb-1">Hashtags</p>
                  <div className="flex flex-wrap gap-1">
                    {seoResult.hashtags.map((h, i) => <Badge key={i} className="bg-primary/20 text-primary text-[8px]">{h}</Badge>)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* SEO Audit Tab */}
      {activeTab === 'seo-audit' && (
        <div className="space-y-3">
          <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground mb-2">📊 Análise SEO completa com 18 fatores — estilo VidIQ</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Título *</label>
                <Input placeholder="Título do vídeo..." value={auditTitle} onChange={e => setAuditTitle(e.target.value)} className="bg-secondary/50 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Keyword principal</label>
                <Input placeholder="Ex: como ganhar dinheiro" value={auditKeyword} onChange={e => setAuditKeyword(e.target.value)} className="bg-secondary/50 text-xs" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <Textarea placeholder="Cole a descrição do vídeo..." value={auditDesc} onChange={e => setAuditDesc(e.target.value)} rows={3} className="bg-secondary/50 text-xs" />
            </div>
            <div className="mt-2">
              <label className="text-[10px] text-muted-foreground mb-1 block">Tags (separadas por vírgula)</label>
              <Input placeholder="tag1, tag2, tag3..." value={auditTags} onChange={e => setAuditTags(e.target.value)} className="bg-secondary/50 text-xs" />
            </div>
          </div>

          <Button onClick={runSEOAudit} disabled={auditLoading} className="w-full gradient-hero border-0 gap-2">
            {auditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {auditLoading ? 'Analisando 18 fatores + IA...' : 'Analisar SEO (18 fatores + Sugestões IA)'}
          </Button>

          {auditResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Grade + Score Header */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                <div className={`text-3xl font-black px-4 py-2 rounded-xl border-2 ${getGradeColor(auditResult.grade)}`}>
                  {auditResult.grade}
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold">{auditResult.seo_score}<span className="text-sm text-muted-foreground font-normal">/10</span></p>
                  <p className="text-[10px] text-muted-foreground">Score geral baseado em 18 fatores ponderados</p>
                </div>
              </div>

              {/* Category Scores */}
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(auditResult.category_scores || {}).map(([cat, score]) => {
                  const Icon = getCategoryIcon(cat);
                  return (
                    <button key={cat} onClick={() => setAuditExpandedCat(auditExpandedCat === cat ? null : cat)}
                      className={`p-3 rounded-lg text-center transition-all border ${auditExpandedCat === cat ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/20 hover:border-primary/30'}`}>
                      <Icon className={`w-4 h-4 mx-auto mb-1 ${getScoreColor(score)}`} />
                      <p className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</p>
                      <p className="text-[9px] text-muted-foreground">{getCategoryLabel(cat)}</p>
                    </button>
                  );
                })}
              </div>

              {/* Factor Breakdown */}
              {auditExpandedCat && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border/50">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    {(() => { const Icon = getCategoryIcon(auditExpandedCat); return <Icon className="w-3.5 h-3.5 text-primary" />; })()}
                    {getCategoryLabel(auditExpandedCat)}
                  </p>
                  {Object.entries(auditResult.scores)
                    .filter(([, f]) => f.category === auditExpandedCat)
                    .sort(([, a], [, b]) => a.score - b.score)
                    .map(([key, factor]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-foreground">{factor.label}</span>
                          <span className={`text-[10px] font-bold ${getScoreColor(factor.score)}`}>{factor.score}/10</span>
                        </div>
                        <Progress value={factor.score * 10} className={`h-1.5 ${getProgressColor(factor.score)}`} />
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                          {factor.score >= 8 ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> :
                           factor.score >= 5 ? <ArrowUp className="w-3 h-3 text-yellow-400" /> :
                           <AlertTriangle className="w-3 h-3 text-destructive" />}
                          {factor.tip}
                        </p>
                      </div>
                    ))}
                </motion.div>
              )}

              {/* Quick Wins */}
              {auditResult.ai_suggestions?.quick_wins && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <p className="text-[10px] font-medium text-emerald-400 mb-2">⚡ Quick Wins — Ações Imediatas</p>
                  <div className="space-y-1.5">
                    {auditResult.ai_suggestions.quick_wins.map((win, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                        {win}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Title Alternatives */}
              {auditResult.ai_suggestions?.alternative_titles && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Títulos Otimizados (IA)
                  </p>
                  {auditResult.ai_suggestions.alternative_titles.map((alt, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-2.5 flex items-center gap-2 group hover:bg-muted/50 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[11px]">{alt.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold text-emerald-400">CTR ~{alt.estimated_ctr}%</span>
                          <span className="text-[8px] text-muted-foreground">— {alt.why_better}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => { setAuditTitle(alt.title); }}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => copyText(alt.title)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested Tags & Keywords */}
              <div className="grid grid-cols-2 gap-3">
                {auditResult.ai_suggestions?.suggested_tags && (
                  <div className="bg-muted/20 rounded-lg p-2.5">
                    <p className="text-[9px] font-medium text-muted-foreground mb-1.5">Tags Sugeridas ({auditResult.ai_suggestions.suggested_tags.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {auditResult.ai_suggestions.suggested_tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[8px] cursor-pointer hover:bg-primary/20"
                          onClick={() => copyText(tag)}>{tag}</Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[9px] mt-1.5 w-full"
                      onClick={() => copyText(auditResult.ai_suggestions!.suggested_tags!.join(', '))}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar todas
                    </Button>
                  </div>
                )}
                {auditResult.ai_suggestions?.seo_keywords && (
                  <div className="bg-muted/20 rounded-lg p-2.5">
                    <p className="text-[9px] font-medium text-muted-foreground mb-1.5">Keywords Relacionadas</p>
                    <div className="flex flex-wrap gap-1">
                      {auditResult.ai_suggestions.seo_keywords.map((kw, i) => (
                        <Badge key={i} className="bg-primary/15 text-primary text-[8px]">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description Template */}
              {auditResult.ai_suggestions?.description_template && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">📝 Template de Descrição Otimizada</p>
                  <div className="relative">
                    <Textarea value={auditResult.ai_suggestions.description_template} readOnly rows={8} className="bg-secondary/50 text-[11px] font-mono" />
                    <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-[9px]"
                      onClick={() => copyText(auditResult.ai_suggestions!.description_template!)}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                </div>
              )}

              {/* Hook Suggestion */}
              {auditResult.ai_suggestions?.hook_suggestion && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                  <p className="text-[9px] font-medium text-primary mb-0.5">🎣 Hook Sugerido (primeiros 3s)</p>
                  <p className="text-[11px] text-foreground italic">"{auditResult.ai_suggestions.hook_suggestion}"</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
