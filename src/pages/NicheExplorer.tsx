import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Compass, Search, Star, TrendingUp, Eye, Users, DollarSign, Zap, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const COUNTRIES = [
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 EUA' },
  { value: 'PL', label: '🇵🇱 Polônia' },
  { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'FR', label: '🇫🇷 França' },
  { value: 'JP', label: '🇯🇵 Japão' },
  { value: 'IN', label: '🇮🇳 Índia' },
];

const POPULAR_NICHES = [
  'finanças pessoais', 'gaming', 'tech reviews', 'cozinha', 'histórias horror',
  'motivação', 'fitness', 'crypto', 'viagens', 'educação', 'comédia', 'beleza',
  'true crime', 'curiosidades', 'DIY', 'música', 'saúde mental', 'business',
];

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const NicheExplorer = () => {
  const [niche, setNiche] = useState('');
  const [country, setCountry] = useState('BR');
  const [language, setLanguage] = useState('pt');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const explore = async (nicheOverride?: string) => {
    const searchNiche = nicheOverride || niche;
    if (!searchNiche.trim()) return;
    setNiche(searchNiche);
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('niche-explorer', {
        body: { niche: searchNiche, country, language },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erro na exploração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Niche Explorer</h1>
            <p className="text-sm text-muted-foreground">Descubra nichos lucrativos com viral score, RPM e canais faceless</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Ex: finanças pessoais, horror stories, tech reviews..." value={niche}
              onChange={(e) => setNiche(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && explore()}
              className="pl-10 bg-secondary/50" />
          </div>
          <select value={country} onChange={e => setCountry(e.target.value)}
            className="h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm min-w-[140px]">
            {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Button onClick={() => explore()} disabled={loading} className="gradient-hero border-0 gap-2">
            <Compass className="w-4 h-4" /> {loading ? 'Explorando...' : 'Explorar'}
          </Button>
        </div>

        {/* Quick niches */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_NICHES.map(n => (
            <button key={n} onClick={() => explore(n)}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-colors border border-border">
              {n}
            </button>
          ))}
        </div>

        {/* Results */}
        {data && (
          <div className="space-y-6">
            {/* RPM info */}
            <div className="glass rounded-xl p-5 grid sm:grid-cols-3 gap-4">
              <div className="text-center">
                <DollarSign className="w-6 h-6 mx-auto mb-1 text-accent" />
                <p className="text-2xl font-bold text-accent">${data.estimatedRpm}</p>
                <p className="text-xs text-muted-foreground">RPM Estimado</p>
              </div>
              <div className="text-center">
                <Users className="w-6 h-6 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{data.channels?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Canais Encontrados</p>
              </div>
              <div className="text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                <p className="text-2xl font-bold">{data.trending?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Vídeos Trending</p>
              </div>
            </div>

            {/* Channels with viral score */}
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk'] mb-3">📊 Canais por Viral Score</h2>
              <div className="space-y-3">
                {data.channels?.map((ch: any, i: number) => (
                  <div key={ch.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    {ch.thumbnail && <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={`https://youtube.com/channel/${ch.id}`} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-primary transition-colors truncate">{ch.name}</a>
                        {ch.faceless && (
                          <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">FACELESS</span>
                        )}
                        {ch.isMonetized && (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">💰 MONETIZADO</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatNumber(ch.subscribers)} subs</span>
                        <span>{formatNumber(ch.totalViews)} views</span>
                        <span>{ch.videoCount} vídeos</span>
                        {ch.outlierCount > 0 && <span className="text-accent">⭐ {ch.outlierCount} outliers</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-accent" />
                        <span className="text-lg font-bold" style={{
                          color: ch.viralScore >= 70 ? 'hsl(var(--accent))' : ch.viralScore >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                        }}>{ch.viralScore}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Viral Score</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-accent">${ch.estimatedRpm}/RPM</p>
                      <p className="text-xs text-muted-foreground">~${formatNumber(ch.estimatedMonthlyRevenue)}/mês</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending Videos */}
            {data.trending?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold font-['Space_Grotesk'] mb-3">🔥 Top Trending</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.trending.slice(0, 9).map((v: any) => (
                    <a key={v.id} href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                      className="glass rounded-lg overflow-hidden hover:border-primary/30 transition-all">
                      <div className="relative">
                        <img src={v.thumbnail} alt={v.title} className="w-full aspect-video object-cover" />
                        {v.isOutlier && (
                          <span className="absolute top-1 left-1 bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> OUTLIER
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-medium line-clamp-2">{v.title}</h4>
                        <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span>{formatNumber(v.views)} views</span>
                          <span>{v.vph} v/h</span>
                          <span>{v.engagementRate}% eng.</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!data && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Compass className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Escolha um nicho para explorar canais, viral scores e RPM estimado</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NicheExplorer;
