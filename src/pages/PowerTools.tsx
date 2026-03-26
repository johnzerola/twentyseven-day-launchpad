import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Copy, Crosshair, Radar, BarChart3, FlaskConical, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ToolResult {
  loading: boolean;
  data: any;
  error: string | null;
}

const PowerTools = () => {
  const [activeTab, setActiveTab] = useState('competitors');
  const [results, setResults] = useState<Record<string, ToolResult>>({});

  // Form states
  const [competitorChannel, setCompetitorChannel] = useState('');
  const [reverseUrl, setReverseUrl] = useState('');
  const [emulateChannel, setEmulateChannel] = useState('');
  const [emulateTopic, setEmulateTopic] = useState('');
  const [predictScript, setPredictScript] = useState('');
  const [preViralNiche, setPreViralNiche] = useState('');
  const [backtestNiche, setBacktestNiche] = useState('');

  const invoke = async (key: string, fnName: string, body: any) => {
    setResults(r => ({ ...r, [key]: { loading: true, data: null, error: null } }));
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      setResults(r => ({ ...r, [key]: { loading: false, data, error: null } }));
      toast.success('Análise concluída!');
    } catch (e: any) {
      setResults(r => ({ ...r, [key]: { loading: false, data: null, error: e.message } }));
      toast.error(e.message || 'Erro na análise');
    }
  };

  const r = (key: string) => results[key] || { loading: false, data: null, error: null };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Power Tools</h1>
          <p className="text-sm text-muted-foreground">
            Ferramentas avançadas de inteligência competitiva e análise preditiva
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-secondary border border-border w-full md:w-auto flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="competitors" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Search className="w-3.5 h-3.5" /> Competidores
            </TabsTrigger>
            <TabsTrigger value="reverse" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Crosshair className="w-3.5 h-3.5" /> Engenharia Reversa
            </TabsTrigger>
            <TabsTrigger value="emulate" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Copy className="w-3.5 h-3.5" /> Emular Canal
            </TabsTrigger>
            <TabsTrigger value="predict" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Eye className="w-3.5 h-3.5" /> Prever Retenção
            </TabsTrigger>
            <TabsTrigger value="previral" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Radar className="w-3.5 h-3.5" /> Pré-Viral
            </TabsTrigger>
            <TabsTrigger value="backtest" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <FlaskConical className="w-3.5 h-3.5" /> Backtest
            </TabsTrigger>
          </TabsList>

          {/* FIND COMPETITORS */}
          <TabsContent value="competitors" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Encontrar Competidores</h2>
                <p className="text-sm text-muted-foreground">Descubra canais que competem no mesmo nicho e formato</p>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Nome ou ID do canal de referência" value={competitorChannel}
                  onChange={e => setCompetitorChannel(e.target.value)} className="flex-1" />
                <Button onClick={() => invoke('competitors', 'find-competitors', { channelId: competitorChannel })}
                  disabled={!competitorChannel || r('competitors').loading}>
                  {r('competitors').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Buscar</span>
                </Button>
              </div>
              <ResultDisplay result={r('competitors')} />
            </Card>
          </TabsContent>

          {/* REVERSE ENGINEER */}
          <TabsContent value="reverse" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Engenharia Reversa de Vídeo</h2>
                <p className="text-sm text-muted-foreground">Desconstrua qualquer vídeo viral: hooks, estrutura, pacing, psicologia</p>
              </div>
              <div className="flex gap-3">
                <Input placeholder="URL ou ID do vídeo do YouTube" value={reverseUrl}
                  onChange={e => setReverseUrl(e.target.value)} className="flex-1" />
                <Button onClick={() => invoke('reverse', 'reverse-engineer-video', { videoUrl: reverseUrl })}
                  disabled={!reverseUrl || r('reverse').loading}>
                  {r('reverse').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  <span className="ml-2">Analisar</span>
                </Button>
              </div>
              <ResultDisplay result={r('reverse')} />
            </Card>
          </TabsContent>

          {/* EMULATE CHANNEL */}
          <TabsContent value="emulate" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Emular Estilo de Canal</h2>
                <p className="text-sm text-muted-foreground">Gere conteúdo no estilo de um canal de referência — tom, ritmo, visual</p>
              </div>
              <div className="space-y-3">
                <Input placeholder="Nome ou ID do canal para emular" value={emulateChannel}
                  onChange={e => setEmulateChannel(e.target.value)} />
                <Input placeholder="Tópico do seu vídeo" value={emulateTopic}
                  onChange={e => setEmulateTopic(e.target.value)} />
                <Button onClick={() => invoke('emulate', 'emulate-channel', { channelId: emulateChannel, topic: emulateTopic })}
                  disabled={!emulateChannel || !emulateTopic || r('emulate').loading} className="w-full">
                  {r('emulate').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-2">Gerar no Estilo</span>
                </Button>
              </div>
              <ResultDisplay result={r('emulate')} />
            </Card>
          </TabsContent>

          {/* PREDICT RETENTION */}
          <TabsContent value="predict" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Prever Retenção</h2>
                <p className="text-sm text-muted-foreground">Cole seu roteiro e veja a retenção estimada antes de publicar</p>
              </div>
              <Textarea placeholder="Cole o roteiro completo aqui..." value={predictScript}
                onChange={e => setPredictScript(e.target.value)} rows={6} />
              <Button onClick={() => invoke('predict', 'predict-retention', { script: predictScript })}
                disabled={predictScript.length < 50 || r('predict').loading} className="w-full">
                {r('predict').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                <span className="ml-2">Prever Retenção</span>
              </Button>
              <ResultDisplay result={r('predict')} />
            </Card>
          </TabsContent>

          {/* PRE-VIRAL DETECTION */}
          <TabsContent value="previral" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Detecção Pré-Viral</h2>
                <p className="text-sm text-muted-foreground">Encontre vídeos em ascensão antes de explodirem — vantagem de 24-48h</p>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Nicho (ex: horror, finanças, curiosidades)" value={preViralNiche}
                  onChange={e => setPreViralNiche(e.target.value)} className="flex-1" />
                <Button onClick={() => invoke('previral', 'pre-viral-detection', { niche: preViralNiche })}
                  disabled={r('previral').loading}>
                  {r('previral').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                  <span className="ml-2">Detectar</span>
                </Button>
              </div>
              <ResultDisplay result={r('previral')} />
            </Card>
          </TabsContent>

          {/* BACKTEST SCORES */}
          <TabsContent value="backtest" className="mt-6">
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Backtest de Scores</h2>
                <p className="text-sm text-muted-foreground">Compare previsões da IA vs resultados reais — calibre a precisão do sistema</p>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Nicho para backtest (opcional)" value={backtestNiche}
                  onChange={e => setBacktestNiche(e.target.value)} className="flex-1" />
                <Button onClick={() => invoke('backtest', 'backtest-scores', { niche: backtestNiche || undefined })}
                  disabled={r('backtest').loading}>
                  {r('backtest').loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  <span className="ml-2">Executar Backtest</span>
                </Button>
              </div>
              <ResultDisplay result={r('backtest')} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

function ResultDisplay({ result }: { result: ToolResult }) {
  if (result.error) {
    return <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{result.error}</div>;
  }
  if (!result.data) return null;

  return (
    <div className="space-y-3">
      <Badge variant="secondary" className="text-xs">Resultado</Badge>
      <div className="p-4 rounded-lg bg-secondary/50 border border-border overflow-auto max-h-[500px]">
        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default PowerTools;
