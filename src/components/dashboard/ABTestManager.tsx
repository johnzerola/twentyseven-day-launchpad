import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FlaskConical, Plus, Trophy, BarChart3, Loader2, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

export function ABTestManager() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [testType, setTestType] = useState('title');
  const [metricTarget, setMetricTarget] = useState('ctr');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    const { data } = await supabase
      .from('ab_tests')
      .select('*')
      .order('started_at', { ascending: false });
    setTests((data as ABTest[]) || []);
    setLoading(false);
  };

  const createTest = async () => {
    if (!variantA.trim() || !variantB.trim()) {
      toast.error('Preencha ambas as variantes');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('ab_tests').insert({
        test_type: testType,
        metric_target: metricTarget,
        variant_a: { text: variantA, metrics: {} },
        variant_b: { text: variantB, metrics: {} },
        started_at: new Date().toISOString(),
        result: { status: 'running', winner: null },
      });
      if (error) throw error;
      toast.success('Teste A/B criado!');
      setShowForm(false);
      setVariantA('');
      setVariantB('');
      loadTests();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const endTest = async (test: ABTest, winner: 'a' | 'b') => {
    await supabase.from('ab_tests').update({
      ended_at: new Date().toISOString(),
      result: { ...test.result, status: 'completed', winner },
    }).eq('id', test.id);
    toast.success(`Variante ${winner.toUpperCase()} declarada vencedora!`);
    loadTests();
  };

  const deleteTest = async (id: string) => {
    await supabase.from('ab_tests').delete().eq('id', id);
    toast.success('Teste removido');
    loadTests();
  };

  const isRunning = (test: ABTest) => !test.ended_at;
  const getWinner = (test: ABTest) => (test.result as any)?.winner;

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
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Variante B</label>
              <Textarea value={variantB} onChange={e => setVariantB(e.target.value)} placeholder="Ex: 'O Segredo de $1M que a Indústria Esconde'" rows={2} className="text-xs" />
            </div>
            <Button onClick={createTest} disabled={creating} size="sm" className="w-full">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
              Criar Teste A/B
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
            <p className="text-xs text-muted-foreground">Nenhum teste A/B criado. Crie um para comparar títulos, hooks ou thumbnails.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map(test => (
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
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => deleteTest(test.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-2 rounded border text-xs ${getWinner(test) === 'a' ? 'border-green-500/50 bg-green-500/10' : 'border-border/40'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">A</span>
                      {getWinner(test) === 'a' && <Trophy className="h-3 w-3 text-yellow-400" />}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{(test.variant_a as any)?.text || '—'}</p>
                  </div>
                  <div className={`p-2 rounded border text-xs ${getWinner(test) === 'b' ? 'border-green-500/50 bg-green-500/10' : 'border-border/40'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">B</span>
                      {getWinner(test) === 'b' && <Trophy className="h-3 w-3 text-yellow-400" />}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{(test.variant_b as any)?.text || '—'}</p>
                  </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
