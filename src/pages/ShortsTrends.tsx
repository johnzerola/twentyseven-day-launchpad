import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Flame, Zap, Search, Loader2, ExternalLink, Eye, ThumbsUp,
  MessageCircle, Clock, Target, Lightbulb, AlertTriangle, Sparkles, ArrowRight,
  Globe, ChevronDown, ChevronUp, Rocket, BarChart3, BookOpen
} from 'lucide-react';

const NICHE_PRESETS = [
  { value: 'finanças', label: '💰 Finanças', emoji: '💰' },
  { value: 'horror', label: '👻 Horror', emoji: '👻' },
  { value: 'animal survival', label: '🐾 Animal Survival', emoji: '🐾' },
  { value: 'curiosidades', label: '🧠 Curiosidades', emoji: '🧠' },
  { value: 'história', label: '📜 História', emoji: '📜' },
  { value: 'crime', label: '🔪 True Crime', emoji: '🔪' },
  { value: 'tecnologia', label: '💻 Tech', emoji: '💻' },
  { value: 'gaming', label: '🎮 Gaming', emoji: '🎮' },
  { value: 'motivacional', label: '🔥 Motivacional', emoji: '🔥' },
  { value: 'conspiração', label: '👁️ Conspiração', emoji: '👁️' },
];

const COUNTRY_OPTIONS = [
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 EUA' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'MX', label: '🇲🇽 México' },
];

const ShortsTrends = () => {
  const navigate = useNavigate();
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [language, setLanguage] = useState('pt');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showPerplexity, setShowPerplexity] = useState(false);

  const scan = async () => {
    if (!niche.trim()) { toast.error('Escolha ou digite um nicho'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shorts-trend-detector', {
        body: { niche, country, language, limit: 12 },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`🔥 ${data.metadata?.shorts_found || 0} Shorts analisados, ${data.metadata?.trending_count || 0} em alta!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar tendências');
    } finally { setLoading(false); }
  };

  const goToScript = (topic: string) => {
    navigate(`/scripts?type=short&topic=${encodeURIComponent(topic)}&niche=${encodeURIComponent(niche)}`);
  };

  const velocityColor = (vph: number) => {
    if (vph > 2000) return 'text-destructive';
    if (vph > 500) return 'text-chart-4';
    if (vph > 100) return 'text-chart-2';
    return 'text-muted-foreground';
  };

  const velocityBadge = (s: any) => {
    if (s.isExplosive) return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[9px]">🚀 EXPLOSIVO</Badge>;
    if (s.isTrending) return <Badge className="bg-chart-4/20 text-chart-4 border-chart-4/30 text-[9px]">🔥 TRENDING</Badge>;
    return <Badge variant="secondary" className="text-[9px]">📊 Normal</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-chart-4 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Detector de Tendências Shorts</h1>
            <p className="text-sm text-muted-foreground">Descubra o que está explodindo AGORA no YouTube Shorts</p>
          </div>
        </div>

        {/* Search Controls */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {NICHE_PRESETS.map(p => (
              <button key={p.value} onClick={() => setNiche(p.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  niche === p.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input placeholder="Ou digite seu nicho..." value={niche} onChange={e => setNiche(e.target.value)}
              className="flex-1" onKeyDown={e => e.key === 'Enter' && scan()} />
            <select value={country} onChange={e => setCountry(e.target.value)}
              className="bg-muted border border-border rounded-lg px-3 text-sm">
              {COUNTRY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button onClick={scan} disabled={loading} className="gap-2 min-w-[140px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Escaneando...' : 'Detectar Tendências'}
            </Button>
          </div>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Shorts Encontrados', value: result.metadata?.shorts_found || 0, icon: Eye, color: 'text-primary' },
                { label: 'Em Alta (>500 v/h)', value: result.metadata?.trending_count || 0, icon: Flame, color: 'text-chart-4' },
                { label: 'Explosivos (>2K v/h)', value: result.metadata?.explosive_count || 0, icon: Rocket, color: 'text-destructive' },
                { label: 'Fontes', value: `YT${result.metadata?.perplexity_used ? ' + Perplexity' : ''}`, icon: Globe, color: 'text-chart-2' },
              ].map((s, i) => (
                <Card key={i} className="p-3 flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div>
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* AI Analysis */}
            {result.analysis && Object.keys(result.analysis).length > 0 && (
              <Card className="overflow-hidden">
                <button onClick={() => setShowAnalysis(!showAnalysis)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Análise de Tendências por IA</span>
                    {result.analysis.niche_health && (
                      <Badge className={`text-[10px] ${
                        result.analysis.niche_health.score >= 7 ? 'bg-chart-2/20 text-chart-2' :
                        result.analysis.niche_health.score >= 5 ? 'bg-chart-4/20 text-chart-4' : 'bg-destructive/20 text-destructive'
                      }`}>
                        Saúde: {result.analysis.niche_health.score}/10 • {result.analysis.niche_health.trend}
                      </Badge>
                    )}
                  </div>
                  {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {showAnalysis && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                        {/* Trend Summary */}
                        {result.analysis.trend_summary && (
                          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{result.analysis.trend_summary}</p>
                        )}

                        {/* Trending Topics */}
                        {result.analysis.trending_topics?.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5 text-chart-4" /> Tópicos em Alta
                            </h3>
                            <div className="grid gap-2">
                              {result.analysis.trending_topics.map((t: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 bg-muted/20 rounded-lg p-3 group hover:bg-muted/40 transition-colors">
                                  <Badge className={`text-[9px] shrink-0 ${
                                    t.velocity === 'explosive' ? 'bg-destructive/20 text-destructive' :
                                    t.velocity === 'rising' ? 'bg-chart-4/20 text-chart-4' : 'bg-muted'
                                  }`}>
                                    {t.velocity === 'explosive' ? '🚀' : t.velocity === 'rising' ? '📈' : '📊'} {t.velocity}
                                  </Badge>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{t.topic}</p>
                                    <p className="text-[10px] text-muted-foreground">{t.why_trending}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[9px]">Score: {t.opportunity_score}/10</Badge>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                                      onClick={() => goToScript(t.topic)}>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommended Topics */}
                        {result.analysis.recommended_topics?.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5 text-chart-2" /> Oportunidades Recomendadas
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {result.analysis.recommended_topics.map((t: any, i: number) => (
                                <Card key={i} className="p-3 hover:border-primary/30 transition-colors cursor-pointer group"
                                  onClick={() => goToScript(t.topic)}>
                                  <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1 min-w-0">
                                      <p className="text-sm font-medium">{t.topic}</p>
                                      <p className="text-[10px] text-muted-foreground">{t.angle}</p>
                                      <div className="flex gap-1">
                                        <Badge variant="outline" className="text-[8px]">{t.estimated_views}</Badge>
                                        <Badge className={`text-[8px] ${
                                          t.urgency === 'now' ? 'bg-destructive/20 text-destructive' :
                                          t.urgency === 'this_week' ? 'bg-chart-4/20 text-chart-4' : 'bg-muted'
                                        }`}>
                                          {t.urgency === 'now' ? '⚡ AGORA' : t.urgency === 'this_week' ? '📅 Esta semana' : '📆 Este mês'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <Sparkles className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Winning Hooks */}
                        {result.analysis.winning_hooks?.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-primary" /> Hooks que estão funcionando
                            </h3>
                            {result.analysis.winning_hooks.map((h: any, i: number) => (
                              <div key={i} className="bg-muted/20 rounded-lg p-2.5 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium">🎣 {h.hook_pattern}</p>
                                  <Badge variant="outline" className="text-[8px]">{h.effectiveness}/10</Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Ex: "{h.example}"</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Content Gaps */}
                        {result.analysis.content_gaps?.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-chart-4" /> Gaps de Conteúdo
                            </h3>
                            {result.analysis.content_gaps.map((g: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 bg-chart-4/5 rounded-lg p-2.5">
                                <Badge className={`text-[8px] shrink-0 ${
                                  g.difficulty === 'easy' ? 'bg-chart-2/20 text-chart-2' :
                                  g.difficulty === 'medium' ? 'bg-chart-4/20 text-chart-4' : 'bg-destructive/20 text-destructive'
                                }`}>{g.difficulty}</Badge>
                                <div className="flex-1">
                                  <p className="text-xs font-medium">{g.gap}</p>
                                  <p className="text-[10px] text-muted-foreground">{g.opportunity}</p>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]"
                                  onClick={() => goToScript(g.gap)}>
                                  Criar <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}

            {/* Perplexity Insights */}
            {result.perplexityInsights && (
              <Card className="overflow-hidden">
                <button onClick={() => setShowPerplexity(!showPerplexity)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-chart-3" />
                    <span className="font-semibold text-sm">Pesquisa Web em Tempo Real</span>
                    <Badge variant="secondary" className="text-[10px]">Perplexity</Badge>
                  </div>
                  {showPerplexity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPerplexity && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                      <p className="whitespace-pre-wrap">{result.perplexityInsights.content}</p>
                    </div>
                    {result.perplexityInsights.citations?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.perplexityInsights.citations.map((c: string, i: number) => (
                          <a key={i} href={c} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-primary hover:underline truncate max-w-[200px]">
                            [{i + 1}] {c}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Shorts Grid */}
            {result.shorts?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-chart-4" /> Shorts em Tempo Real ({result.shorts.length})
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.shorts.map((s: any, i: number) => (
                    <Card key={s.videoId} className="overflow-hidden group hover:border-primary/30 transition-colors">
                      <div className="relative">
                        {s.thumbnail && (
                          <img src={s.thumbnail} alt={s.title} className="w-full h-32 object-cover" loading="lazy" />
                        )}
                        <div className="absolute top-2 left-2">{velocityBadge(s)}</div>
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-background/80 backdrop-blur-sm text-foreground text-[9px]">{s.duration}s</Badge>
                        </div>
                        <div className="absolute bottom-2 right-2">
                          <a href={`https://youtube.com/shorts/${s.videoId}`} target="_blank" rel="noopener noreferrer"
                            className="bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">{s.channelTitle}</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center bg-muted/30 rounded p-1">
                            <Eye className="w-3 h-3 mx-auto text-muted-foreground" />
                            <p className="text-[10px] font-mono font-bold">{s.views >= 1000000 ? `${(s.views / 1000000).toFixed(1)}M` : s.views >= 1000 ? `${(s.views / 1000).toFixed(0)}K` : s.views}</p>
                          </div>
                          <div className="text-center bg-muted/30 rounded p-1">
                            <Clock className="w-3 h-3 mx-auto text-muted-foreground" />
                            <p className={`text-[10px] font-mono font-bold ${velocityColor(s.viewsPerHour)}`}>{s.viewsPerHour}/h</p>
                          </div>
                          <div className="text-center bg-muted/30 rounded p-1">
                            <ThumbsUp className="w-3 h-3 mx-auto text-muted-foreground" />
                            <p className="text-[10px] font-mono font-bold">{s.engagementRate}%</p>
                          </div>
                        </div>
                        {s.viewToSubRatio > 0 && (
                          <div className="flex items-center justify-between text-[9px]">
                            <span className="text-muted-foreground">Subs: {(s.channelSubs || 0).toLocaleString()}</span>
                            <Badge variant="outline" className={`text-[8px] ${s.viewToSubRatio > 3 ? 'border-destructive/30 text-destructive' : ''}`}>
                              {s.viewToSubRatio}x ratio
                            </Badge>
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="w-full h-7 text-[10px] gap-1"
                          onClick={() => goToScript(s.title)}>
                          <Sparkles className="w-3 h-3" /> Criar Short Similar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <Card className="p-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Descubra o que está viralizando</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Escolha um nicho e escaneie as tendências em tempo real. O sistema usa YouTube API + IA + Perplexity para identificar temas explodindo AGORA.
            </p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ShortsTrends;
