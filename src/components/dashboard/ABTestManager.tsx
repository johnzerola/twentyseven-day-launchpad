import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FlaskConical, Plus, Trophy, BarChart3, Loader2, Trash2, TrendingUp, Link2, Brain, Eye, ThumbsUp, MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface ABTest {
  id: string;
  test_type: string;
  metric_target: string;
  variant_a: any;
  variant_b: any;
  result: any;
  started_at: string | null;
  ended_at: string | null;
  project_id: string | null;
}

interface VideoPerf {
  id: string;
  youtube_video_id: string;
  title: string;
  views_current: number;
  likes: number;
  comments: number;
  performance_grade: string;
}

export function ABTestManager() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [scoring, setScoring] = useState<string | null>(null);
  
  // Form state
  const [testType, setTestType] = useState('title');
  const [metricTarget, setMetricTarget] = useState('ctr');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [videoUrlA, setVideoUrlA] = useState('');
  const [videoUrlB, setVideoUrlB] = useState('');

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    const { data } = await supabase
      .from('ab_tests')
      .select('*')
      .order('started_at', { ascending: false });
    setTests((data as ABTest[]) || []);
    setLoading(false);
  };

  const extractVideoId = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const createTest = async () => {
    if (!variantA.trim() || !variantB.trim()) {
      toast.error('Preencha ambas as variantes');
      return;
    }

    setCreating(true);
    try {
      // AI-score both variants
      let aiScores: any = {};
      try {
        const { data: scoreData } = await supabase.functions.invoke('title-score', {
          body: { titles: [variantA, variantB] },
        });
        if (scoreData?.scores) {
          aiScores = { a: scoreData.scores[0], b: scoreData.scores[1] };
        }
      } catch { /* scoring optional */ }

      const { error } = await supabase.from('ab_tests').insert({
        test_type: testType,
        metric_target: metricTarget,
        variant_a: { 
          text: variantA, 
          video_id: extractVideoId(videoUrlA) || null,
          ai_score: aiScores.a || null,
          metrics: {} 
        },
        variant_b: { 
          text: variantB, 
          video_id: extractVideoId(videoUrlB) || null,
          ai_score: aiScores.b || null,
          metrics: {} 
        },
        started_at: new Date().toISOString(),
        result: { status: 'running', winner: null, ai_prediction: aiScores.a?.grade && aiScores.b?.grade 
          ? (aiScores.a.total_score > aiScores.b.total_score ? 'a' : 'b') : null },
      });
      if (error) throw error;
      toast.success('Teste A/B criado com scoring da IA!');
      setShowForm(false);
      setVariantA('');
      setVariantB('');
      setVideoUrlA('');
      setVideoUrlB('');
      loadTests();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const syncMetrics = async (test: ABTest) => {
    setScoring(test.id);
    try {
      const variants = ['a', 'b'] as const;
      const updates: any = { variant_a: { ...test.variant_a }, variant_b: { ...test.variant_b } };

      for (const v of variants) {
        const variant = v === 'a' ? test.variant_a : test.variant_b;
        const vidId = variant?.video_id;
        if (!vidId) continue;

        // Fetch real metrics from video_performance
        const { data: perf } = await supabase
          .from('video_performance')
          .select('views_current, likes, comments, performance_grade, views_day1, views_day7')
          .eq('youtube_video_id', vidId)
          .maybeSingle();

        if (perf) {
          const key = v === 'a' ? 'variant_a' : 'variant_b';
          updates[key].metrics = {
            views: perf.views_current,
            likes: perf.likes,
            comments: perf.comments,
            grade: perf.performance_grade,
            views_d1: perf.views_day1,
            views_d7: perf.views_day7,
            engagement_rate: perf.views_current > 0 ? ((perf.likes + perf.comments) / perf.views_current * 100).toFixed(2) : '0',
            synced_at: new Date().toISOString(),
          };
        }
      }

      // Auto-determine winner if both have metrics
      const mA = updates.variant_a.metrics;
      const mB = updates.variant_b.metrics;
      let autoWinner: string | null = null;
      if (mA?.views && mB?.views) {
        const scoreA = (mA.views || 0) * 0.5 + (parseFloat(mA.engagement_rate) || 0) * 50;
        const scoreB = (mB.views || 0) * 0.5 + (parseFloat(mB.engagement_rate) || 0) * 50;
        if (scoreA > scoreB * 1.1) autoWinner = 'a';
        else if (scoreB > scoreA * 1.1) autoWinner = 'b';
      }

      await supabase.from('ab_tests').update({
        variant_a: updates.variant_a,
        variant_b: updates.variant_b,
        result: { ...test.result, auto_winner: autoWinner },
      }).eq('id', test.id);

      toast.success('Métricas sincronizadas!');
      loadTests();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScoring(null);
    }
  };

  const endTest = async (test: ABTest, winner: 'a' | 'b') => {
    // Feed result into ai_learning
    const winnerVariant = winner === 'a' ? test.variant_a : test.variant_b;
    const loserVariant = winner === 'a' ? test.variant_b : test.variant_a;

    await supabase.from('ab_tests').update({
      ended_at: new Date().toISOString(),
      result: { ...test.result, status: 'completed', winner },
    }).eq('id', test.id);

    // Feed lesson into ai_learning for future improvements
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        await supabase.from('ai_learning' as any).insert({
          topic: `ab_test_${test.test_type}_winner`,
          source: 'ab-test-manager',
          insight: `[A/B ${test.test_type}] Winner: "${winnerVariant?.text}" beat "${loserVariant?.text}" on ${test.metric_target}. Winner metrics: ${JSON.stringify(winnerVariant?.metrics || {})}. AI prediction was: ${test.result?.ai_prediction === winner ? 'CORRECT' : 'WRONG'}.`,
        });
      } catch { /* silent - RLS may block client insert */ }
    }

    toast.success(`Variante ${winner.toUpperCase()} declarada vencedora! Resultado salvo para aprendizado.`);
    loadTests();
  };

  const deleteTest = async (id: string) => {
    await supabase.from('ab_tests').delete().eq('id', id);
    toast.success('Teste removido');
    loadTests();
  };

  const isRunning = (test: ABTest) => !test.ended_at;
  const getWinner = (test: ABTest) => (test.result as any)?.winner;
  const getAIPrediction = (test: ABTest) => (test.result as any)?.ai_prediction;
  const getAutoWinner = (test: ABTest) => (test.result as any)?.auto_winner;

  const formatViews = (n: number) => {
    if (!n) return '—';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Testes A/B
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3 mr-1" /> Novo Teste
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-primary/30 bg-card/80">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">Título</SelectItem>
                    <SelectItem value="hook">Hook</SelectItem>
                    <SelectItem value="thumbnail">Thumbnail</SelectItem>
                    <SelectItem value="description">Descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Métrica</label>
                <Select value={metricTarget} onValueChange={setMetricTarget}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctr">CTR</SelectItem>
                    <SelectItem value="retention">Retenção</SelectItem>
                    <SelectItem value="views">Views 48h</SelectItem>
                    <SelectItem value="engagement">Engajamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variante A</label>
              <Textarea value={variantA} onChange={e => setVariantA(e.target.value)} placeholder="Ex: 'Ele Revelou o Segredo que Ninguém Conta'" rows={2} className="text-xs" />
              <Input value={videoUrlA} onChange={e => setVideoUrlA(e.target.value)} placeholder="URL do vídeo A (opcional — para tracking real)" className="mt-1 h-7 text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variante B</label>
              <Textarea value={variantB} onChange={e => setVariantB(e.target.value)} placeholder="Ex: 'O Segredo de $1M que a Indústria Esconde'" rows={2} className="text-xs" />
              <Input value={videoUrlB} onChange={e => setVideoUrlB(e.target.value)} placeholder="URL do vídeo B (opcional — para tracking real)" className="mt-1 h-7 text-xs" />
            </div>
            <p className="text-[10px] text-muted-foreground">💡 Cole URLs de vídeos publicados para comparar métricas reais (views, engajamento). A IA também pontuará cada variante automaticamente.</p>
            <Button onClick={createTest} disabled={creating} size="sm" className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
              Criar Teste A/B com Scoring IA
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tests List */}
      {loading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Carregando...</div>
      ) : tests.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-8 text-center">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Nenhum teste A/B criado. Compare títulos, hooks ou thumbnails com métricas reais do YouTube.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map(test => {
            const aiPred = getAIPrediction(test);
            const autoWinner = getAutoWinner(test);
            const winner = getWinner(test);

            return (
              <Card key={test.id} className="border-border/40 bg-card/60">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{test.test_type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{test.metric_target}</Badge>
                      {isRunning(test) ? (
                        <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-muted text-muted-foreground">Finalizado</Badge>
                      )}
                      {aiPred && (
                        <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">
                          <Brain className="h-2.5 w-2.5 mr-0.5" />IA: {aiPred.toUpperCase()}
                        </Badge>
                      )}
                      {autoWinner && !winner && (
                        <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />Auto: {autoWinner.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isRunning(test) && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => syncMetrics(test)} disabled={scoring === test.id}>
                          {scoring === test.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
                          Sync
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteTest(test.id)}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {['a', 'b'].map(v => {
                      const variant = v === 'a' ? test.variant_a : test.variant_b;
                      const isWinner = winner === v;
                      const metrics = variant?.metrics || {};
                      const aiScore = variant?.ai_score;

                      return (
                        <div key={v} className={`p-2 rounded border text-xs ${isWinner ? 'border-green-500/50 bg-green-500/10' : 'border-border/40'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground">{v.toUpperCase()}</span>
                            <div className="flex items-center gap-1">
                              {aiScore?.grade && (
                                <Badge variant="outline" className="text-[8px] px-1">{aiScore.grade} ({aiScore.total_score})</Badge>
                              )}
                              {isWinner && <Trophy className="h-3 w-3 text-yellow-400" />}
                            </div>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 mb-1">{variant?.text || '—'}</p>
                          
                          {/* Real metrics from video_performance */}
                          {metrics.views !== undefined && (
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground border-t border-border/20 pt-1">
                              <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{formatViews(metrics.views)}</span>
                              <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" />{formatViews(metrics.likes)}</span>
                              <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{metrics.comments}</span>
                              {metrics.engagement_rate && <span className="text-primary">{metrics.engagement_rate}%</span>}
                              {metrics.grade && <Badge variant="outline" className="text-[8px] px-1">{metrics.grade}</Badge>}
                            </div>
                          )}
                          {variant?.video_id && !metrics.views && (
                            <p className="text-[9px] text-muted-foreground/50 mt-1">🔗 Conectado — clique "Sync" para atualizar</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isRunning(test) && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => endTest(test, 'a')}>
                        <Trophy className="h-3 w-3 mr-1" /> A Venceu
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => endTest(test, 'b')}>
                        <Trophy className="h-3 w-3 mr-1" /> B Venceu
                      </Button>
                    </div>
                  )}

                  {/* Post-test insight */}
                  {winner && aiPred && (
                    <div className="mt-2 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
                      {aiPred === winner 
                        ? '✅ IA acertou a previsão — modelo calibrado'
                        : '⚠️ IA errou a previsão — resultado salvo para recalibração'}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
