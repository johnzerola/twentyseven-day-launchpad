import { useState } from 'react';
import { Sparkles, Copy, Loader2, TrendingUp, FlaskConical, FileText, Heart, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

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

interface TitleSEOStepProps {
  topic: string;
  niche: string;
  language: string;
  script: string;
  videoStyle: string;
  syncedScenes: any[];
}

export const TitleSEOStep = ({ topic, niche, language, script, videoStyle, syncedScenes }: TitleSEOStepProps) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'ab-test' | 'seo-desc'>('generate');
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);

  // A/B
  const [titleA, setTitleA] = useState('');
  const [titleB, setTitleB] = useState('');
  const [abLoading, setAbLoading] = useState(false);
  const [abResult, setAbResult] = useState<ABResult | null>(null);

  // SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoResult, setSeoResult] = useState<SEODescription | null>(null);

  // Build script context summary for the AI
  const buildScriptContext = () => {
    const parts: string[] = [];
    if (script) {
      // Extract first 500 chars as summary + key themes
      parts.push(`ROTEIRO COMPLETO (resumo): ${script.slice(0, 800)}`);
    }
    if (videoStyle) parts.push(`ESTILO VISUAL: ${videoStyle}`);
    if (syncedScenes?.length) {
      const sceneTexts = syncedScenes.slice(0, 5).map((s: any) => s.tts_text || s.text_content || '').filter(Boolean);
      if (sceneTexts.length) parts.push(`CENAS DO VÍDEO (narração):\n${sceneTexts.join('\n')}`);
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
    try {
      const scriptContext = buildScriptContext();
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { niche, topic, language, type: 'generate', scriptContext },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const generated = (data?.titles || []).map((t: any) => ({ ...t, liked: false }));
      setTitles(generated);
      if (generated.length) {
        toast.success(`${generated.length} títulos gerados com contexto do roteiro!`);
        // Auto-save
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
          <p className="text-[10px] font-medium text-emerald-400 mb-1">🧠 A IA tem contexto completo do seu vídeo:</p>
          <div className="flex flex-wrap gap-2">
            {contextInfo.map((info, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{info}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'generate' as const, label: 'Gerar Títulos', icon: Sparkles },
          { id: 'ab-test' as const, label: 'A/B Test', icon: FlaskConical },
          { id: 'seo-desc' as const, label: 'SEO & Descrição', icon: FileText },
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
            {loading ? 'Gerando títulos com contexto do roteiro...' : 'Gerar 20 Títulos Virais (CTR 15-30%)'}
          </Button>

          {titles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> {titles.length} Títulos — CTR Médio: {avgCTR}%
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
                          CTR: {t.estimatedCTR}%
                        </span>
                        {t.psychological_trigger && (
                          <Badge variant="secondary" className="text-[8px]">🧠 {t.psychological_trigger}</Badge>
                        )}
                      </div>
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
            {abLoading ? 'Analisando...' : 'Comparar'}
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
            </motion.div>
          )}
        </div>
      )}

      {/* SEO Tab */}
      {activeTab === 'seo-desc' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Título do vídeo (ou selecione dos gerados)</label>
            <Input placeholder="Título para gerar SEO..." value={seoTitle} onChange={e => setSeoTitle(e.target.value)} className="bg-secondary/50 text-xs" />
          </div>
          <Button onClick={generateSEODesc} disabled={seoLoading} size="sm" className="gradient-hero border-0 gap-2">
            {seoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {seoLoading ? 'Gerando...' : 'Gerar Descrição SEO (com contexto do roteiro)'}
          </Button>
          {seoResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="relative">
                <Textarea value={seoResult.description} readOnly rows={10} className="bg-secondary/50 text-[11px] font-mono" />
                <Button variant="outline" size="sm" className="absolute top-2 right-2 h-6 text-[9px]"
                  onClick={() => copyText(seoResult.description)}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] font-medium text-muted-foreground mb-1">Keywords</p>
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
    </div>
  );
};
