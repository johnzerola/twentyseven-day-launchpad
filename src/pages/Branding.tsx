import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Palette, Sparkles, Tag, Image as ImageIcon, Copy, Check, Layers, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface BrandIdentity {
  name: string;
  tagline: string;
  reason: string;
  logoPrompt: string;
  bannerPrompt: string;
  palette: { hex: string; usage: string }[];
}

// MOCK — pre-loaded identity results for "Finanças Pessoais" niche
const MOCK_IDENTITIES: BrandIdentity[] = [
  {
    name: 'FinanceiraMente',
    tagline: 'Liberdade financeira começa na mente.',
    reason: 'Combina "financeira" com "mente", transmitindo inteligência e mentalidade de riqueza.',
    logoPrompt: 'Minimalist brain icon merged with a rising bar chart, gradient from deep navy #0f172a to electric purple #7c3aed, clean vector style, dark background --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "FinanceiraMente" finance channel, cinematic dark background with glowing purple and gold accents, abstract wealth symbols, 2560x1440 --ar 16:9 --v 6',
    palette: [
      { hex: '#0f172a', usage: 'Fundo' },
      { hex: '#1e293b', usage: 'Card' },
      { hex: '#7c3aed', usage: 'Accent' },
      { hex: '#f59e0b', usage: 'CTA' },
      { hex: '#f8fafc', usage: 'Texto' },
    ],
  },
  {
    name: 'CashFlow Dark',
    tagline: 'Seu dinheiro trabalhando enquanto você dorme.',
    reason: 'Direto e poderoso. "Dark" indica canal faceless premium.',
    logoPrompt: 'Neon green dollar sign morphing into flowing water streams, black background, cyberpunk aesthetic, sharp edges --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "CashFlow Dark", matrix-style falling money symbols, green neon glow on black, futuristic and premium, 2560x1440 --ar 16:9 --v 6',
    palette: [
      { hex: '#0a0a0a', usage: 'Fundo' },
      { hex: '#171717', usage: 'Card' },
      { hex: '#22c55e', usage: 'Accent' },
      { hex: '#ef4444', usage: 'CTA' },
      { hex: '#e5e5e5', usage: 'Texto' },
    ],
  },
  {
    name: 'Renda Automática',
    tagline: 'Automatize seus ganhos. Libere seu tempo.',
    reason: 'SEO forte — "renda" é keyword top. "Automática" conecta com passive income.',
    logoPrompt: 'Gear/cog icon with a money plant growing through center, warm orange and deep blue tones, modern flat design, clean background --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "Renda Automática", robotic arm arranging money stacks, warm cinematic lighting, orange and blue color scheme, premium feel, 2560x1440 --ar 16:9 --v 6',
    palette: [
      { hex: '#1a1a2e', usage: 'Fundo' },
      { hex: '#16213e', usage: 'Card' },
      { hex: '#e94560', usage: 'Accent' },
      { hex: '#f97316', usage: 'CTA' },
      { hex: '#ffffff', usage: 'Texto' },
    ],
  },
];

const MOCK_KEYWORDS = [
  'renda passiva 2026', 'como ganhar dinheiro online', 'investimentos para iniciantes',
  'finanças pessoais', 'independência financeira', 'dinheiro trabalhando pra você',
  'tesouro direto', 'renda extra', 'como investir pouco', 'canal dark youtube',
  'youtube sem aparecer', 'monetização youtube', 'RPM alto', 'nicho lucrativo',
  'passive income', 'cash flow', 'financial freedom',
];

const MOCK_THUMBNAIL_STYLE = `**Estilo recomendado para thumbnails de Finanças:**
• Rosto expressivo (choque/surpresa) OU imagens de dinheiro/gráficos em ascensão
• Texto bold com no máximo 4-5 palavras
• Cores contrastantes: amarelo/laranja sobre fundo escuro
• Números grandes destacados (ex: "R$50.000", "5 fontes")
• Evitar excesso de elementos — foco em 1 ponto visual`;

const MOCK_PILLARS = [
  'Investimentos para Iniciantes — CDB, Tesouro, FIIs explicados de forma simples',
  'Renda Passiva — Estratégias reais para gerar dinheiro no piloto automático',
  'Mentalidade de Riqueza — Hábitos e mindset dos milionários',
  'YouTube Dark — Como criar canais faceless lucrativos do zero',
];

const MOCK_SUBNICHES = [
  { name: 'Dividendos Mensais', potential: 'Alto', competition: 'Média' },
  { name: 'Criptomoedas para Iniciantes', potential: 'Muito Alto', competition: 'Alta' },
  { name: 'Frugalismo', potential: 'Médio', competition: 'Baixa' },
];

const Branding = () => {
  const [niche, setNiche] = useState('Finanças Pessoais');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [identities, setIdentities] = useState<BrandIdentity[]>(MOCK_IDENTITIES);
  const [keywords, setKeywords] = useState<string[]>(MOCK_KEYWORDS);
  const [thumbnailStyle, setThumbnailStyle] = useState(MOCK_THUMBNAIL_STYLE);
  const [contentPillars, setContentPillars] = useState<string[]>(MOCK_PILLARS);
  const [subNiches, setSubNiches] = useState<any[]>(MOCK_SUBNICHES);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-branding', {
        body: { niche, style: 'Moderno/Cinematográfico', language: 'Português' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const names = data.channelNames || [];
      const palettes = data.colorPalettes || [];

      setIdentities(names.slice(0, 3).map((cn: any, i: number) => ({
        name: cn.name,
        tagline: cn.tagline,
        reason: cn.reason || '',
        logoPrompt: cn.logoPrompt || `Logo for "${cn.name}" YouTube channel in ${niche} niche. --ar 1:1 --v 6`,
        bannerPrompt: cn.bannerPrompt || `YouTube banner for "${cn.name}". 2560x1440 --ar 16:9 --v 6`,
        palette: palettes[i] || MOCK_IDENTITIES[0].palette,
      })));
      setKeywords(data.seoTags || []);
      setThumbnailStyle(data.thumbnailStyle || '');
      setContentPillars(data.contentPillars || []);
      setSubNiches(data.subNiches || []);
      setShowResults(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar branding');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(id);
    toast.success('Prompt copiado!');
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center glow-primary">
            <Palette className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">HacksLab — Identidade & Emulação</h1>
            <p className="text-sm text-muted-foreground">Gere identidade visual, nomes e prompts prontos para Midjourney/Canva</p>
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-xl p-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-2 block">Qual é o nicho do seu canal?</label>
            <Input placeholder="Ex: finanças pessoais, horror stories, true crime, gaming..." value={niche}
              onChange={e => setNiche(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
              className="bg-secondary/50 h-12 text-base" />
          </div>
          <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-8">
            <Sparkles className="w-4 h-4" /> {loading ? 'Gerando com IA...' : 'Gerar Identidade'}
          </Button>
        </div>

        {showResults && identities.length > 0 && (
          <>
            {/* 3 Identity Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {identities.map((identity, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }} className="glass rounded-xl p-5 space-y-4 hover:border-primary/30 transition-all">
                  <div className="text-center">
                    <Badge variant="secondary" className="mb-2">Opção {i + 1}</Badge>
                    <h3 className="text-xl font-bold font-['Space_Grotesk']">{identity.name}</h3>
                    <p className="text-sm text-muted-foreground italic">"{identity.tagline}"</p>
                    {identity.reason && <p className="text-[10px] text-muted-foreground mt-1">{identity.reason}</p>}
                  </div>

                  {/* Color Palette */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Paleta de Cores</p>
                    <div className="flex gap-2 justify-center">
                      {identity.palette.map((c, j) => (
                        <div key={j} className="text-center">
                          <div className="w-10 h-10 rounded-lg border border-border cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.hex }} onClick={() => { navigator.clipboard.writeText(c.hex); toast.success(`${c.hex} copiado`); }} />
                          <p className="text-[9px] text-muted-foreground mt-1">{c.usage}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Logo Prompt */}
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Prompt do Logo</p>
                      <button onClick={() => copyPrompt(identity.logoPrompt, `logo-${i}`)}>
                        {copiedPrompt === `logo-${i}` ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-4">{identity.logoPrompt}</p>
                  </div>

                  {/* Banner Prompt */}
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Prompt do Banner</p>
                      <button onClick={() => copyPrompt(identity.bannerPrompt, `banner-${i}`)}>
                        {copiedPrompt === `banner-${i}` ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-4">{identity.bannerPrompt}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Thumbnail Style Guide */}
            {thumbnailStyle && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="glass rounded-xl p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <ImageIcon className="w-4 h-4 text-primary" /> Guia de Thumbnail
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{thumbnailStyle}</p>
              </motion.div>
            )}

            {/* Content Pillars */}
            {contentPillars.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="glass rounded-xl p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-primary" /> Pilares de Conteúdo
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {contentPillars.map((pillar, i) => (
                    <div key={i} className="bg-secondary/30 rounded-lg p-3 text-sm flex items-start gap-2">
                      <span className="text-primary font-bold">{i + 1}.</span>
                      <span>{pillar}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Sub-niches */}
            {subNiches.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="glass rounded-xl p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-accent" /> Sub-nichos Recomendados
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {subNiches.map((sn, i) => (
                    <div key={i} className="bg-secondary/30 rounded-lg p-3">
                      <p className="font-medium text-sm">{sn.name}</p>
                      <p className="text-[10px] text-emerald-400 mt-1">Potencial: {sn.potential}</p>
                      <p className="text-[10px] text-muted-foreground">Competição: {sn.competition}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SEO Keywords */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="glass rounded-xl p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-primary" /> Keywords SEO de Alta Conversão
              </h3>
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw, i) => (
                  <button key={i} onClick={() => { navigator.clipboard.writeText(kw); toast.success('Keyword copiada!'); }}
                    className="bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-full border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer">
                    {kw}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Branding;
