import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Palette, Sparkles, Tag, Type, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const STYLES = ['Moderno', 'Minimalista', 'Gaming', 'Educacional', 'Luxuoso', 'Divertido', 'Dark/Misterioso', 'Tech'];
const LANGUAGES_OPT = ['Português', 'English', 'Deutsch', 'Polski', 'Español'];

const Branding = () => {
  const [niche, setNiche] = useState('');
  const [style, setStyle] = useState('Moderno');
  const [language, setLanguage] = useState('Português');
  const [audience, setAudience] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const generate = async () => {
    if (!niche.trim()) return toast.error('Informe o nicho');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-branding', {
        body: { niche, style, language, targetAudience: audience },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult(data);

      // Save to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('generated_branding').insert({
          user_id: user.id,
          niche,
          channel_name_suggestions: data.channelNames || [],
          description: data.descriptions?.[0] || '',
          seo_tags: data.seoTags || [],
          branding_data: data,
        } as any);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar branding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Branding AI</h1>
            <p className="text-sm text-muted-foreground">Gere nome, descrição, tags SEO e identidade visual com IA</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Configurações</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nicho *</label>
              <Input placeholder="Ex: finanças, horror stories..." value={niche} onChange={e => setNiche(e.target.value)} className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estilo</label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${style === s ? 'bg-primary/20 border-primary/30 text-primary' : 'border-border hover:bg-secondary'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Idioma</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                {LANGUAGES_OPT.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Público-alvo</label>
              <Input placeholder="Ex: jovens 18-25, empreendedores..." value={audience} onChange={e => setAudience(e.target.value)} className="bg-secondary/50" />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full gradient-hero border-0 gap-2">
              <Sparkles className="w-4 h-4" /> {loading ? 'Gerando...' : 'Gerar Branding'}
            </Button>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {result ? (
              <>
                {/* Channel Names */}
                <div className="glass rounded-xl p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><Type className="w-4 h-4 text-primary" /> Nomes Sugeridos</h3>
                  <div className="space-y-3">
                    {result.channelNames?.map((cn: any, i: number) => (
                      <div key={i} className="bg-secondary/30 rounded-lg p-3">
                        <p className="font-bold text-lg">{cn.name}</p>
                        <p className="text-sm text-muted-foreground italic">"{cn.tagline}"</p>
                        <p className="text-xs text-muted-foreground mt-1">{cn.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Descriptions */}
                <div className="glass rounded-xl p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Descrições</h3>
                  {result.descriptions?.map((d: string, i: number) => (
                    <div key={i} className="bg-secondary/30 rounded-lg p-3 mb-2">
                      <p className="text-sm">{d}</p>
                    </div>
                  ))}
                </div>

                {/* SEO Tags */}
                <div className="glass rounded-xl p-5">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-primary" /> Tags SEO</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.seoTags?.map((tag: string, i: number) => (
                      <span key={i} className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>

                {/* Color Palette */}
                {result.colorPalette && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><Palette className="w-4 h-4 text-primary" /> Paleta de Cores</h3>
                    <div className="flex gap-3">
                      {result.colorPalette.map((c: any, i: number) => (
                        <div key={i} className="text-center">
                          <div className="w-14 h-14 rounded-lg border border-border" style={{ backgroundColor: c.hex }} />
                          <p className="text-[10px] text-muted-foreground mt-1">{c.usage}</p>
                          <p className="text-[10px] font-mono">{c.hex}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Pillars */}
                {result.contentPillars && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-semibold flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4 text-primary" /> Pilares de Conteúdo</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {result.contentPillars.map((p: string, i: number) => (
                        <div key={i} className="bg-secondary/30 rounded-lg p-3 text-sm">{p}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thumbnail Style */}
                {result.thumbnailStyle && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-semibold mb-2">🖼️ Estilo de Thumbnail</h3>
                    <p className="text-sm text-muted-foreground">{result.thumbnailStyle}</p>
                  </div>
                )}

                {/* Banner Concepts */}
                {result.bannerConcepts && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-semibold mb-2">🎨 Conceitos de Banner</h3>
                    <ul className="space-y-1">
                      {result.bannerConcepts.map((b: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="glass rounded-xl p-16 text-center text-muted-foreground">
                <Palette className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Configure o nicho e estilo para gerar sua identidade visual com IA</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Branding;
