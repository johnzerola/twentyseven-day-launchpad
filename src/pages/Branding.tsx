import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Palette, Sparkles, Tag, Image as ImageIcon, Copy, Check, Layers, Target, Zap, DollarSign, Crosshair, Crown, Lightbulb, Rocket, Video, FileText, Calendar, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface BrandIdentity {
  name: string;
  tagline: string;
  reason: string;
  logoPrompt: string;
  bannerPrompt: string;
  thumbnailPrompt: string;
  palette: { hex: string; usage: string }[];
}

interface KeywordData {
  keyword: string;
  volume: string;
  difficulty: string;
  cpc: string;
}

interface WeekContent {
  week: number;
  videos: string[];
}

interface CompetitorData {
  name: string;
  subs: string;
  rpm: string;
  strengths: string[];
  weaknesses: string[];
}

interface MonetizationPhase {
  label: string;
  description: string;
  estimatedRevenue: string;
}

interface PillarData {
  name: string;
  percentage: number;
  icon: string;
  description: string;
}

// Fallback mock data
const FALLBACK_IDENTITIES: BrandIdentity[] = [
  {
    name: 'FinanceiraMente', tagline: 'Liberdade financeira começa na mente.',
    reason: 'Combina "financeira" com "mente", transmitindo inteligência e mentalidade de riqueza.',
    logoPrompt: 'Minimalist brain icon merged with a rising bar chart, gradient from deep navy #0f172a to electric purple #7c3aed --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "FinanceiraMente" finance channel, cinematic dark background with glowing purple and gold accents --ar 16:9 --v 6',
    thumbnailPrompt: 'Shocked face looking at phone screen showing $50,000, dark moody background, bold yellow text --ar 16:9 --v 6',
    palette: [{ hex: '#0f172a', usage: 'Fundo' }, { hex: '#1e293b', usage: 'Card' }, { hex: '#7c3aed', usage: 'Accent' }, { hex: '#f59e0b', usage: 'CTA' }, { hex: '#f8fafc', usage: 'Texto' }],
  },
  {
    name: 'CashFlow Dark', tagline: 'Seu dinheiro trabalhando enquanto você dorme.',
    reason: 'Direto e poderoso. "Dark" indica canal faceless premium.',
    logoPrompt: 'Neon green dollar sign morphing into flowing water streams, black background, cyberpunk aesthetic --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "CashFlow Dark", matrix-style falling money symbols, green neon glow on black --ar 16:9 --v 6',
    thumbnailPrompt: 'Split screen: left side showing empty wallet, right side showing stacked cash, dramatic green neon border --ar 16:9 --v 6',
    palette: [{ hex: '#0a0a0a', usage: 'Fundo' }, { hex: '#171717', usage: 'Card' }, { hex: '#22c55e', usage: 'Accent' }, { hex: '#ef4444', usage: 'CTA' }, { hex: '#e5e5e5', usage: 'Texto' }],
  },
  {
    name: 'Renda Automática', tagline: 'Automatize seus ganhos. Libere seu tempo.',
    reason: 'SEO forte — "renda" é keyword top no Brasil.',
    logoPrompt: 'Gear/cog icon with a money plant growing through center, warm orange and deep blue tones --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "Renda Automática", robotic arm arranging money stacks, warm cinematic lighting --ar 16:9 --v 6',
    thumbnailPrompt: 'Robot arm counting cash bills, futuristic office background, orange glow, bold text --ar 16:9 --v 6',
    palette: [{ hex: '#1a1a2e', usage: 'Fundo' }, { hex: '#16213e', usage: 'Card' }, { hex: '#e94560', usage: 'Accent' }, { hex: '#f97316', usage: 'CTA' }, { hex: '#ffffff', usage: 'Texto' }],
  },
];

const FALLBACK_KEYWORDS: KeywordData[] = [
  { keyword: 'renda passiva 2026', volume: '110K/mês', difficulty: 'Média', cpc: '$2.40' },
  { keyword: 'como ganhar dinheiro online', volume: '320K/mês', difficulty: 'Alta', cpc: '$3.10' },
  { keyword: 'investimentos para iniciantes', volume: '90K/mês', difficulty: 'Média', cpc: '$2.80' },
];

const FALLBACK_CALENDAR: WeekContent[] = [
  { week: 1, videos: ['5 fontes de renda passiva em 2026', 'Como eu ganhei R$10.000 sem aparecer', 'O nicho SECRETO que paga $15 RPM'] },
  { week: 2, videos: ['Tesouro Direto: Guia Completo', 'Por que 90% dos canais MORREM', 'Montei um negócio com R$100'] },
  { week: 3, videos: ['O erro que te mantém POBRE', 'React vs Resultado: O que funciona', 'Automatizei minha renda (como)'] },
  { week: 4, videos: ['Resultados: 30 dias de canal dark', 'As 3 métricas que importam', 'Meu blueprint de R$50K/mês'] },
];

const FALLBACK_COMPETITORS: CompetitorData[] = [
  { name: 'Primo Rico', subs: '7.2M', rpm: '$12', weaknesses: ['Conteúdo muito longo', 'Pouca frequência'], strengths: ['Brand forte', 'SEO excelente'] },
  { name: 'Me Poupe!', subs: '7.5M', rpm: '$10', weaknesses: ['Saturação de formato', 'Audiência dispersa'], strengths: ['Persona carismática', 'Diversificação'] },
  { name: 'O Primo Pobre', subs: '1.8M', rpm: '$14', weaknesses: ['Nicho restrito', 'Crescimento lento'], strengths: ['Engajamento alto', 'Comunidade fiel'] },
];

const FALLBACK_MONETIZATION: Record<string, MonetizationPhase> = {
  phase1: { label: 'Semana 1-2: Infoproduto', description: 'Criar template/guia de baixo custo ($7-$27) e promover via link na descrição.', estimatedRevenue: '$200-$1000/mês' },
  phase2: { label: 'Semana 3-4: Afiliados', description: 'Cadastrar em programas de afiliados do nicho (Hotmart, Amazon Associates).', estimatedRevenue: '$500-$2000/mês' },
  phase3: { label: 'Mês 2-3: AdSense', description: 'Atingir 1.000 inscritos + 4.000h de watch time para aprovação.', estimatedRevenue: '$1000-$5000/mês' },
  phase4: { label: 'Mês 4+: Escala', description: 'Múltiplos canais no mesmo nicho gerando receita passiva.', estimatedRevenue: '$5000-$20000/mês' },
};

const FALLBACK_PILLARS: PillarData[] = [
  { name: 'Investimentos para Iniciantes', percentage: 30, icon: '📊', description: 'CDB, Tesouro, FIIs explicados de forma simples.' },
  { name: 'Renda Passiva', percentage: 30, icon: '💰', description: 'Estratégias reais para gerar dinheiro no piloto automático.' },
  { name: 'Mentalidade de Riqueza', percentage: 20, icon: '🧠', description: 'Hábitos e mindset dos milionários.' },
  { name: 'YouTube Dark', percentage: 20, icon: '🎬', description: 'Como criar canais faceless lucrativos do zero.' },
];

const Branding = () => {
  const [niche, setNiche] = useState('Finanças Pessoais');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('identity');
  const [selectedIdentity, setSelectedIdentity] = useState(0);
  const [aiGenerated, setAiGenerated] = useState(false);

  // Data states - start with fallback
  const [identities, setIdentities] = useState<BrandIdentity[]>(FALLBACK_IDENTITIES);
  const [keywords, setKeywords] = useState<KeywordData[]>(FALLBACK_KEYWORDS);
  const [calendar, setCalendar] = useState<WeekContent[]>(FALLBACK_CALENDAR);
  const [competitors, setCompetitors] = useState<CompetitorData[]>(FALLBACK_COMPETITORS);
  const [monetization, setMonetization] = useState<Record<string, MonetizationPhase>>(FALLBACK_MONETIZATION);
  const [pillars, setPillars] = useState<PillarData[]>(FALLBACK_PILLARS);
  const [opportunityGap, setOpportunityGap] = useState('Nenhum concorrente de peso está produzindo conteúdo faceless de alta produção neste nicho.');

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    setAiGenerated(false);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-branding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ niche, style: 'Moderno/Cinematográfico', language: 'Português' }),
      });
      if (resp.status === 402) {
        throw new Error('⚠️ Créditos de IA insuficientes. Adicione créditos em Settings → Workspace → Usage.');
      }
      if (resp.status === 429) {
        throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
      }
      if (!resp.ok) {
        throw new Error('Erro ao gerar estratégia. Tente novamente.');
      }
      const data = await resp.json();
      if (data?.error) throw new Error(data.error);

      // Parse identities
      const names = data.channelNames || [];
      const palettes = data.colorPalettes || [];
      if (names.length > 0) {
        setIdentities(names.slice(0, 3).map((cn: any, i: number) => ({
          name: cn.name, tagline: cn.tagline, reason: cn.reason || '',
          logoPrompt: cn.logoPrompt || `Logo for "${cn.name}" --ar 1:1 --v 6`,
          bannerPrompt: cn.bannerPrompt || `Banner for "${cn.name}" --ar 16:9 --v 6`,
          thumbnailPrompt: cn.thumbnailPrompt || `Thumbnail for "${cn.name}" --ar 16:9 --v 6`,
          palette: palettes[i] || FALLBACK_IDENTITIES[0].palette,
        })));
      }

      // Parse all strategy sections
      if (data.keywords?.length) setKeywords(data.keywords);
      if (data.contentCalendar?.length) setCalendar(data.contentCalendar);
      if (data.competitorAudit?.length) setCompetitors(data.competitorAudit);
      if (data.monetizationStrategy) setMonetization(data.monetizationStrategy);
      if (data.contentPillars?.length) setPillars(data.contentPillars);
      if (data.opportunityGap) setOpportunityGap(data.opportunityGap);

      setSelectedIdentity(0);
      setShowResults(true);
      setAiGenerated(true);
      toast.success('🚀 Estratégia completa gerada com IA!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar estratégia');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    toast.success('Copiado!');
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyText(text, id)} className="shrink-0">
      {copiedPrompt === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />}
    </button>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Palette className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
              HacksLab <Badge className="bg-accent/20 text-accent text-[10px]">PRO</Badge>
              {aiGenerated && <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">IA ✓</Badge>}
            </h1>
            <p className="text-sm text-muted-foreground">Motor de Inteligência para Branding, Estratégia e Monetização de Canais</p>
          </div>
        </div>

        {/* Search */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-primary" /> Qual nicho você quer dominar?
              </label>
              <Input placeholder="Ex: finanças pessoais, horror stories, true crime, gaming..."
                value={niche} onChange={e => setNiche(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
                className="bg-secondary/50 h-12 text-base" />
            </div>
            <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-8 text-base">
              <Sparkles className="w-5 h-5" /> {loading ? 'Analisando com IA...' : 'Gerar Estratégia Completa'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['Finanças Pessoais', 'True Crime', 'Horror Stories', 'Curiosidades', 'Motivacional', 'Tech Reviews', 'Crypto', 'Histórias Reais'].map(n => (
              <button key={n} onClick={() => setNiche(n)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${niche === n ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 border-border hover:bg-primary/10 hover:text-primary'}`}>
                {n}
              </button>
            ))}
          </div>
          {loading && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Analisando concorrentes, keywords e criando estratégia personalizada para "{niche}"...
            </div>
          )}
        </div>

        {showResults && identities.length > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="identity" className="gap-2 data-[state=active]:bg-primary/20"><Palette className="w-4 h-4" /> Identidade Visual</TabsTrigger>
              <TabsTrigger value="strategy" className="gap-2 data-[state=active]:bg-primary/20"><Rocket className="w-4 h-4" /> Monetização</TabsTrigger>
              <TabsTrigger value="content" className="gap-2 data-[state=active]:bg-primary/20"><Calendar className="w-4 h-4" /> Calendário</TabsTrigger>
              <TabsTrigger value="competitors" className="gap-2 data-[state=active]:bg-primary/20"><Target className="w-4 h-4" /> Auditoria</TabsTrigger>
              <TabsTrigger value="seo" className="gap-2 data-[state=active]:bg-primary/20"><Tag className="w-4 h-4" /> SEO</TabsTrigger>
            </TabsList>

            {/* TAB 1: Identidade Visual */}
            <TabsContent value="identity" className="space-y-4">
              <div className="flex gap-2">
                {identities.map((id, i) => (
                  <button key={i} onClick={() => setSelectedIdentity(i)}
                    className={`flex-1 glass rounded-xl p-4 text-center transition-all ${selectedIdentity === i ? 'border-primary/50 bg-primary/5 shadow-lg shadow-primary/10' : 'hover:border-border'}`}>
                    <Badge variant="secondary" className="mb-1">{i + 1}</Badge>
                    <h3 className="font-bold font-['Space_Grotesk'] text-lg">{id.name}</h3>
                    <p className="text-xs text-muted-foreground italic">"{id.tagline}"</p>
                  </button>
                ))}
              </div>

              <motion.div key={selectedIdentity} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold font-['Space_Grotesk']">{identities[selectedIdentity].name}</h2>
                    <p className="text-muted-foreground italic">"{identities[selectedIdentity].tagline}"</p>
                    <p className="text-xs text-muted-foreground mt-2 max-w-xl">{identities[selectedIdentity].reason}</p>
                  </div>
                  <Crown className="w-8 h-8 text-accent shrink-0" />
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Paleta de Cores</h4>
                  <div className="flex gap-3">
                    {identities[selectedIdentity].palette.map((c, j) => (
                      <div key={j} className="flex-1 group cursor-pointer" onClick={() => copyText(c.hex, `pal-${j}`)}>
                        <div className="h-16 rounded-xl border border-border group-hover:scale-105 transition-transform shadow-lg"
                          style={{ backgroundColor: c.hex }} />
                        <div className="mt-2 text-center">
                          <p className="text-[11px] font-mono text-muted-foreground">{c.hex}</p>
                          <p className="text-[10px] text-muted-foreground">{c.usage}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label: 'Prompt do Logo', icon: ImageIcon, text: identities[selectedIdentity].logoPrompt, id: `logo-${selectedIdentity}` },
                    { label: 'Prompt do Banner', icon: ImageIcon, text: identities[selectedIdentity].bannerPrompt, id: `banner-${selectedIdentity}` },
                    { label: 'Prompt de Thumbnail', icon: Video, text: identities[selectedIdentity].thumbnailPrompt, id: `thumb-${selectedIdentity}` },
                  ].map((prompt) => (
                    <div key={prompt.id} className="bg-secondary/30 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold flex items-center gap-1.5">
                          <prompt.icon className="w-3.5 h-3.5 text-primary" /> {prompt.label}
                        </p>
                        <CopyBtn text={prompt.text} id={prompt.id} />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{prompt.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Content Pillars */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-primary" /> Pilares de Conteúdo — Distribuição Estratégica
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pillars.map((pillar, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                      className="bg-secondary/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{pillar.icon}</span>
                        <Badge variant="outline" className="text-primary">{pillar.percentage}%</Badge>
                      </div>
                      <h4 className="font-semibold text-sm">{pillar.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1">{pillar.description}</p>
                      <Progress value={pillar.percentage} className="h-1.5 mt-3" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Monetização */}
            <TabsContent value="strategy" className="space-y-4">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-2">
                  <DollarSign className="w-6 h-6 text-accent" /> Roadmap de Monetização
                </h3>
                <p className="text-sm text-muted-foreground mb-6">Estratégia de 4 fases para monetizar ANTES do AdSense e escalar depois</p>

                <div className="space-y-4">
                  {Object.entries(monetization).map(([key, phase], i) => (
                    <motion.div key={key} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                      className="flex gap-4 items-start">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          i === 0 ? 'bg-emerald-500/20 text-emerald-400' :
                          i === 1 ? 'bg-blue-500/20 text-blue-400' :
                          i === 2 ? 'bg-purple-500/20 text-purple-400' :
                          'bg-accent/20 text-accent'
                        }`}>{i + 1}</div>
                        {i < 3 && <div className="w-0.5 h-12 bg-border" />}
                      </div>
                      <div className="glass rounded-xl p-4 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-sm">{phase.label}</h4>
                          <Badge className="bg-accent/20 text-accent text-xs">{phase.estimatedRevenue}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{phase.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-6 border-accent/20">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      💡 Estratégia Killer: Infoproduto de Lançamento
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Crie um <strong className="text-foreground">template/guia de $7-$27</strong> no seu nicho e coloque o link na descrição de TODOS os vídeos.
                      Com 10.000 views/mês e 1% de conversão = <strong className="text-accent">$700-$2.700/mês</strong> antes de qualquer aprovação do AdSense.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {[
                        { label: 'Template Notion', price: '$7', conv: '3-5%' },
                        { label: 'E-book/Guia PDF', price: '$17', conv: '1-3%' },
                        { label: 'Mini Curso', price: '$27', conv: '0.5-2%' },
                      ].map((p, i) => (
                        <div key={i} className="bg-secondary/30 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground">{p.label}</p>
                          <p className="text-lg font-bold text-accent">{p.price}</p>
                          <p className="text-[10px] text-muted-foreground">Conv: {p.conv}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: Calendário */}
            <TabsContent value="content" className="space-y-4">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                  <Calendar className="w-6 h-6 text-primary" /> Calendário de Conteúdo — Primeiro Mês
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {calendar.map((week, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="bg-secondary/30 rounded-xl p-4">
                      <Badge variant="outline" className="mb-3">Semana {week.week}</Badge>
                      <div className="space-y-2">
                        {week.videos.map((v, j) => (
                          <div key={j} className="flex items-start gap-2 text-xs">
                            <Video className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3">{week.videos.length} vídeos / ~{week.videos.length * 2}h de conteúdo</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: Auditoria de Concorrentes */}
            <TabsContent value="competitors" className="space-y-4">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                  <Target className="w-6 h-6 text-destructive" /> Auditoria de Concorrentes — {niche}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {aiGenerated ? 'Análise gerada por IA dos principais players do nicho' : 'Análise dos principais players para encontrar gaps de oportunidade'}
                </p>

                <div className="space-y-4">
                  {competitors.map((comp, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                      className="bg-secondary/30 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                            {i + 1}
                          </div>
                          <div>
                            <h4 className="font-bold">{comp.name}</h4>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{comp.subs} subs</span>
                              <span>RPM: {comp.rpm}</span>
                            </div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-emerald-400 font-semibold mb-1">✅ FORÇAS</p>
                          {comp.strengths.map((s, j) => (
                            <p key={j} className="text-xs text-muted-foreground">• {s}</p>
                          ))}
                        </div>
                        <div>
                          <p className="text-[10px] text-destructive font-semibold mb-1">⚠️ FRAQUEZAS (Oportunidade)</p>
                          {comp.weaknesses.map((w, j) => (
                            <p key={j} className="text-xs text-muted-foreground">• {w}</p>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 bg-accent/10 rounded-xl p-4 border border-accent/20">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Gap de Oportunidade Detectado</h4>
                  <p className="text-xs text-muted-foreground mt-1">{opportunityGap}</p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: SEO */}
            <TabsContent value="seo" className="space-y-4">
              <div className="glass rounded-2xl p-6">
                <h3 className="text-xl font-bold font-['Space_Grotesk'] flex items-center gap-2 mb-4">
                  <Tag className="w-6 h-6 text-primary" /> Inteligência SEO — Keywords de Alta Conversão
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs text-muted-foreground font-medium">Keyword</th>
                        <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Volume</th>
                        <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Dificuldade</th>
                        <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">CPC</th>
                        <th className="text-center py-3 px-3 text-xs text-muted-foreground font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((kw, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-3 font-medium">{kw.keyword}</td>
                          <td className="py-3 px-3 text-center text-muted-foreground">{kw.volume}</td>
                          <td className="py-3 px-3 text-center">
                            <Badge className={`text-[10px] ${
                              kw.difficulty === 'Baixa' ? 'bg-emerald-500/20 text-emerald-400' :
                              kw.difficulty === 'Média' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-destructive/20 text-destructive'
                            }`}>{kw.difficulty}</Badge>
                          </td>
                          <td className="py-3 px-3 text-center text-accent font-semibold">{kw.cpc}</td>
                          <td className="py-3 px-3 text-center">
                            <CopyBtn text={kw.keyword} id={`kw-${i}`} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" /> Template de Descrição SEO-Otimizada
                </h4>
                <div className="bg-secondary/30 rounded-xl p-4 relative">
                  <CopyBtn text={`🔥 [TÍTULO CHAMATIVO DO VÍDEO]\n\nNeste vídeo você vai descobrir [PROMESSA PRINCIPAL]. Se você quer [RESULTADO DESEJADO], assista até o final!\n\n📌 LINKS IMPORTANTES:\n🎯 Meu Guia Completo: [LINK DO INFOPRODUTO]\n📚 Recursos Gratuitos: [LINK]\n\n⏱️ TIMESTAMPS:\n00:00 - Introdução\n01:30 - [Tópico 1]\n05:00 - [Tópico 2]\n10:00 - Conclusão\n\n🔔 INSCREVA-SE e ative o sininho!\n\n#${niche.replace(/\s/g, '')} #rendapassiva #youtube2026`} id="desc-template" />
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
{`🔥 [TÍTULO CHAMATIVO DO VÍDEO]

Neste vídeo você vai descobrir [PROMESSA PRINCIPAL]. Se você quer [RESULTADO DESEJADO], assista até o final!

📌 LINKS IMPORTANTES:
🎯 Meu Guia Completo: [LINK DO INFOPRODUTO]
📚 Recursos Gratuitos: [LINK]

⏱️ TIMESTAMPS:
00:00 - Introdução
01:30 - [Tópico 1]
05:00 - [Tópico 2]
10:00 - Conclusão

🔔 INSCREVA-SE e ative o sininho!

#${niche.replace(/\s/g, '')} #rendapassiva #youtube2026`}
                  </pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Branding;
