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

const Branding = () => {
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [identities, setIdentities] = useState<BrandIdentity[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [thumbnailStyle, setThumbnailStyle] = useState('');
  const [contentPillars, setContentPillars] = useState<string[]>([]);
  const [subNiches, setSubNiches] = useState<any[]>([]);
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
        palette: palettes[i] || [
          { hex: '#0f172a', usage: 'Fundo' },
          { hex: '#1e293b', usage: 'Card' },
          { hex: '#7c3aed', usage: 'Accent' },
          { hex: '#f97316', usage: 'CTA' },
          { hex: '#f8fafc', usage: 'Texto' },
        ],
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
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

        {!showResults && (
          <div className="glass rounded-xl p-16 text-center text-muted-foreground">
            <Palette className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Digite seu nicho para gerar 3 identidades visuais completas</p>
            <p className="text-sm mt-1">Nomes, paletas, prompts para Midjourney, thumbnails, pilares e keywords SEO</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Branding;
