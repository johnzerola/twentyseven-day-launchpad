import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Palette, Sparkles, Tag, Type, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

// Mock identities for demo
const MOCK_IDENTITIES = [
  {
    name: 'DarkFinance',
    tagline: 'O lado sombrio do dinheiro',
    palette: [
      { hex: '#1a1a2e', usage: 'Fundo' },
      { hex: '#16213e', usage: 'Card' },
      { hex: '#0f3460', usage: 'Accent' },
      { hex: '#e94560', usage: 'CTA' },
      { hex: '#ffffff', usage: 'Texto' },
    ],
    logoPrompt: 'A sleek, minimalist logo for "DarkFinance" YouTube channel. Dark blue gradient background, golden coin icon with a skull shadow, modern sans-serif font, cinematic feel. --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "DarkFinance" channel. Dark moody aesthetic with city skyline silhouette, floating stock charts, neon blue accents, premium feel. 2560x1440 --ar 16:9 --v 6',
  },
  {
    name: 'MoneyWhisper',
    tagline: 'Segredos que os ricos não contam',
    palette: [
      { hex: '#0d1117', usage: 'Fundo' },
      { hex: '#161b22', usage: 'Card' },
      { hex: '#f0b429', usage: 'Ouro' },
      { hex: '#7c3aed', usage: 'Accent' },
      { hex: '#e5e7eb', usage: 'Texto' },
    ],
    logoPrompt: 'Minimalist logo for "MoneyWhisper" YouTube channel. Black background, golden whisper/wind icon carrying dollar signs, luxury serif font, mysterious atmosphere. --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "MoneyWhisper". Black and gold theme, vault door slightly open with golden light, floating currency symbols, premium typography. 2560x1440 --ar 16:9 --v 6',
  },
  {
    name: 'CashCode',
    tagline: 'Decodificando a riqueza',
    palette: [
      { hex: '#0a0a0a', usage: 'Fundo' },
      { hex: '#1a1a1a', usage: 'Card' },
      { hex: '#00ff88', usage: 'Matrix' },
      { hex: '#00d4ff', usage: 'Accent' },
      { hex: '#f8f8f8', usage: 'Texto' },
    ],
    logoPrompt: 'Futuristic logo for "CashCode" YouTube channel. Matrix-style green code rain forming a dollar sign, dark background, tech monospace font, hacker aesthetic. --ar 1:1 --v 6',
    bannerPrompt: 'YouTube banner for "CashCode". Dark tech aesthetic with binary code, green neon accents, holographic graphs, cyberpunk financial theme. 2560x1440 --ar 16:9 --v 6',
  },
];

const MOCK_KEYWORDS = [
  'como ganhar dinheiro online', 'investimentos 2026', 'renda passiva youtube',
  'finanças pessoais', 'educação financeira', 'monetizar canal',
  'youtube automation', 'faceless channel', 'passive income',
  'side hustle', 'financial freedom', 'stock market tips',
  'crypto 2026', 'dropshipping', 'affiliate marketing',
];

const Branding = () => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [identities, setIdentities] = useState(MOCK_IDENTITIES);
  const [keywords, setKeywords] = useState(MOCK_KEYWORDS);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-branding', {
        body: { niche, style: 'Moderno', language: 'Português' },
      });
      if (data?.channelNames) {
        // Use real data if available
        setIdentities(data.channelNames.slice(0, 3).map((cn: any, i: number) => ({
          ...MOCK_IDENTITIES[i],
          name: cn.name,
          tagline: cn.tagline,
        })));
      }
      setShowResults(true);
    } catch {
      // Fallback to mock
      setShowResults(true);
      toast.info('Exibindo dados de demonstração');
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">HacksLab — Identidade & Emulação</h1>
            <p className="text-sm text-muted-foreground">Gere identidade visual, nomes e prompts prontos para Midjourney/Canva</p>
          </div>
        </div>

        {/* Single-step form */}
        <div className="glass rounded-xl p-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-2 block">Qual é o nicho do seu canal?</label>
            <Input placeholder="Ex: finanças pessoais, horror stories, true crime, gaming..." value={niche}
              onChange={e => setNiche(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
              className="bg-secondary/50 h-12 text-base" />
          </div>
          <Button onClick={generate} disabled={loading} className="gradient-hero border-0 gap-2 h-12 px-8">
            <Sparkles className="w-4 h-4" /> {loading ? 'Gerando...' : 'Gerar Identidade'}
          </Button>
        </div>

        {showResults && (
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
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{identity.logoPrompt}</p>
                  </div>

                  {/* Banner Prompt */}
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Prompt do Banner</p>
                      <button onClick={() => copyPrompt(identity.bannerPrompt, `banner-${i}`)}>
                        {copiedPrompt === `banner-${i}` ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">{identity.bannerPrompt}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* SEO Keywords */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
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

        {!showResults && (
          <div className="glass rounded-xl p-16 text-center text-muted-foreground">
            <Palette className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Digite seu nicho para gerar 3 identidades visuais completas</p>
            <p className="text-sm mt-1">Nomes, paletas, prompts para Midjourney e keywords SEO</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Branding;
