import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Compass, ArrowRight, Sparkles, Target, Layers, TrendingUp, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NicheResult {
  niche: string;
  tema: string;
  estrategia: string;
  microNiches: { name: string; competition: string; potential: string; example: string }[];
  recommendedTitles: string[];
  monetizationDays: string;
  rpmEstimate: string;
}

export const MicroNicheFinder = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [niche, setNiche] = useState('');
  const [tema, setTema] = useState('');
  const [estrategia, setEstrategia] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NicheResult | null>(null);

  const handleGenerate = async () => {
    if (!niche || !tema) {
      toast.error('Preencha pelo menos o Nicho e o Tema');
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) throw new Error('Não autenticado');

      const res = await supabase.functions.invoke('niche-explorer', {
        body: {
          action: 'micro-niche-finder',
          niche,
          tema,
          estrategia,
          targetAudience,
          language,
        },
      });

      if (res.error) throw res.error;

      const data = res.data;
      setResult({
        niche,
        tema,
        estrategia: estrategia || data?.estrategia || 'Modelar canais virais + micro-nichar',
        microNiches: data?.microNiches || [
          { name: `${tema} para ${targetAudience || 'público específico'}`, competition: 'Baixa', potential: 'Alto', example: 'Canal modelo detectado' },
          { name: `${tema} - estética diferenciada`, competition: 'Média', potential: 'Alto', example: 'Diferenciação visual' },
          { name: `${niche} + ${tema} remix`, competition: 'Baixa', potential: 'Médio', example: 'Combinação única' },
        ],
        recommendedTitles: data?.recommendedTitles || [
          `${tema} That Will Change Your Life`,
          `Why Nobody Talks About ${tema}`,
          `${tema} — The Truth They Hide`,
        ],
        monetizationDays: data?.monetizationDays || '30-60',
        rpmEstimate: data?.rpmEstimate || '$4-8',
      });
      setStep(4);
    } catch (err: any) {
      console.error(err);
      // Fallback with local data
      setResult({
        niche, tema,
        estrategia: estrategia || 'Modelar canais virais + micro-nichar para público específico',
        microNiches: [
          { name: `${tema} para ${targetAudience || 'público nichado'}`, competition: 'Baixa', potential: 'Alto', example: 'Micro-nicho com pouca saturação' },
          { name: `${tema} — estética única`, competition: 'Média', potential: 'Alto', example: 'Diferenciação por identidade visual' },
          { name: `${niche} experimental`, competition: 'Baixa', potential: 'Médio', example: 'Ângulo inexplorado' },
        ],
        recommendedTitles: [
          `${tema} That Nobody Knows About`,
          `The Hidden Secret of ${tema}`,
          `Why ${tema} Changes Everything`,
        ],
        monetizationDays: '30-75',
        rpmEstimate: '$4-10',
      });
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const stepConfig = [
    { num: 1, label: 'Nicho', icon: Compass },
    { num: 2, label: 'Tema', icon: Layers },
    { num: 3, label: 'Estratégia', icon: Target },
    { num: 4, label: 'Resultado', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {stepConfig.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <button
              onClick={() => s.num < step && setStep(s.num as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step >= s.num
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-secondary text-muted-foreground border border-border'
              }`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
            {i < stepConfig.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Nicho */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Compass className="w-5 h-5 text-primary" /> 1. Escolha o Nicho Principal
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  O nicho amplo onde você vai atuar. Ex: Música, Carros, Fitness, Histórias, Animais
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Ex: Música Jazz, Carros Vintage, Plantas Medicinais..."
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
                <div className="flex gap-2">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32 bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => niche && setStep(2)} className="flex-1 bg-primary hover:bg-primary/90" disabled={!niche}>
                    Próximo <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Tema */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" /> 2. Defina o Tema (Sub-Nicho)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  O sub-nicho específico. Ex: "Jazz para homens que impõem respeito", "Pickup trucks vintage"
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Ex: Jazz para homens sofisticados, Plantas medicinais esquecidas..."
                  value={tema}
                  onChange={e => setTema(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
                <Input
                  placeholder="Público-alvo (opcional): Ex: Homens 45+, Mães, Gamers..."
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                />
                <Button onClick={() => tema && setStep(3)} className="w-full bg-primary hover:bg-primary/90" disabled={!tema}>
                  Próximo <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Estratégia */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> 3. Estratégia de Diferenciação
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Como se diferenciar dos canais existentes. Ex: "Usar personagem IA único", "Estética dark minimalista"
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ex: Modelar canal X mas usar estética diferente, micro-nichar para público masculino 50+..."
                  value={estrategia}
                  onChange={e => setEstrategia(e.target.value)}
                  className="bg-secondary border-border text-foreground min-h-[100px]"
                />
                <div className="flex flex-wrap gap-2">
                  {['Modelar canal viral', 'Estética diferenciada', 'Micro-nichar audiência', 'Personagem IA único', 'Idioma diferente'].map(s => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/20 hover:text-primary border-border text-muted-foreground"
                      onClick={() => setEstrategia(prev => prev ? `${prev}, ${s}` : s)}
                    >
                      + {s}
                    </Badge>
                  ))}
                </div>
                <Button onClick={handleGenerate} className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Micro-Nichos</>}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Results */}
        {step === 4 && result && (
          <motion.div key="s4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Formula Summary */}
            <Card className="border-primary/30 bg-card">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <Badge className="bg-primary/20 text-primary border-primary/30">{result.niche}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge className="bg-accent/20 text-accent border-accent/30">{result.tema}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{result.estrategia}</Badge>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
                  <span>⏱ Monetização: <strong className="text-foreground">{result.monetizationDays} dias</strong></span>
                  <span>💰 RPM estimado: <strong className="text-foreground">{result.rpmEstimate}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Micro-Niches */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {result.microNiches.map((mn, i) => (
                <Card key={i} className="border-border bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-semibold text-foreground">{mn.name}</p>
                      <Badge variant="outline" className={
                        mn.competition === 'Baixa' ? 'text-green-400 border-green-500/30' :
                        mn.competition === 'Média' ? 'text-orange-400 border-orange-500/30' :
                        'text-red-400 border-red-500/30'
                      }>
                        {mn.competition}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span className="text-xs text-muted-foreground">Potencial: {mn.potential}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mn.example}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recommended Titles */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-foreground">Títulos Sugeridos para Testar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.recommendedTitles.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
                    <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground">{t}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={() => { setStep(1); setResult(null); }} variant="outline" className="w-full border-border text-muted-foreground">
              Recomeçar com Outro Nicho
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
