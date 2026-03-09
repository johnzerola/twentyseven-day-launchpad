import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Compass, Search, Star, TrendingUp, Eye, Users, DollarSign, Zap, Filter, BarChart3, Target, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COUNTRIES = [
  { value: 'BR', label: '🇧🇷 Brasil' }, { value: 'US', label: '🇺🇸 EUA' },
  { value: 'PL', label: '🇵🇱 Polônia' }, { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'GB', label: '🇬🇧 Reino Unido' }, { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'ES', label: '🇪🇸 Espanha' }, { value: 'FR', label: '🇫🇷 França' },
  { value: 'JP', label: '🇯🇵 Japão' }, { value: 'IN', label: '🇮🇳 Índia' },
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterFaceless, setFilterFaceless] = useState(false);
  const [minRpm, setMinRpm] = useState('');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');

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

  // Compute derived metrics
  const channels = data?.channels || [];
  const filteredChannels = channels.filter((ch: any) => {
    if (filterFaceless && !ch.faceless) return false;
    if (minSubs && ch.subscribers < parseInt(minSubs)) return false;
    if (maxSubs && ch.subscribers > parseInt(maxSubs)) return false;
    return true;
  });

  const facelessCount = channels.filter((ch: any) => ch.faceless).length;
  const facelessPercent = channels.length > 0 ? Math.round((facelessCount / channels.length) * 100) : 0;
  const avgViralScore = channels.length > 0 ? Math.round(channels.reduce((s: number, c: any) => s + (c.viralScore || 0), 0) / channels.length) : 0;
  const totalOutliers = channels.reduce((s: number, c: any) => s + (c.outlierCount || 0), 0);

  // Saturation heuristic
  const saturation = channels.length >= 8 ? 'Alta' : channels.length >= 4 ? 'Média' : 'Baixa';
  const saturationColor = saturation === 'Alta' ? 'text-destructive' : saturation === 'Média' ? 'text-yellow-400' : 'text-emerald-400';
  const difficulty = avgViralScore >= 50 ? 'Fácil' : avgViralScore >= 30 ? 'Médio' : 'Difícil';
  const difficultyColor = difficulty === 'Fácil' ? 'text-emerald-400' : difficulty === 'Médio' ? 'text-yellow-400' : 'text-destructive';

  // Revenue projection chart data
  const revenueChart = [1000, 5000, 10000, 50000, 100000].map(views => ({
    views: formatNumber(views),
    receita: Math.round(views * (data?.estimatedRpm || 1.5) / 1000),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Niche Explorer</h1>
            <p className="text-sm text-muted-foreground">Descubra nichos lucrativos com saturação, RPM e canais faceless</p>
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
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="w-4 h-4" />
          </Button>
          <Button onClick={() => explore()} disabled={loading} className="gradient-hero border-0 gap-2">
            <Compass className="w-4 h-4" /> {loading ? 'Explorando...' : 'Explorar'}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="glass rounded-xl p-4 flex gap-4 flex-wrap items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filterFaceless} onChange={e => setFilterFaceless(e.target.checked)} className="rounded" />
              Apenas Faceless
            </label>
            <Input placeholder="Min subs" value={minSubs} onChange={e => setMinSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
            <Input placeholder="Max subs" value={maxSubs} onChange={e => setMaxSubs(e.target.value)} className="h-9 w-28 bg-secondary/50 text-sm" type="number" />
          </div>
        )}

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
            {/* Top Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="glass rounded-xl p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-xl font-bold text-accent">${data.estimatedRpm}</p>
                <p className="text-[10px] text-muted-foreground">RPM Estimado</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{channels.length}</p>
                <p className="text-[10px] text-muted-foreground">Canais</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Target className="w-5 h-5 mx-auto mb-1" />
                <p className={`text-xl font-bold ${saturationColor}`}>{saturation}</p>
                <p className="text-[10px] text-muted-foreground">Saturação</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                <p className={`text-xl font-bold ${difficultyColor}`}>{difficulty}</p>
                <p className="text-[10px] text-muted-foreground">Dificuldade</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Layers className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                <p className="text-xl font-bold text-emerald-400">{facelessPercent}%</p>
                <p className="text-[10px] text-muted-foreground">Faceless</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Star className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                <p className="text-xl font-bold text-yellow-400">{totalOutliers}</p>
                <p className="text-[10px] text-muted-foreground">Outliers</p>
              </div>
            </div>

            {/* Revenue Projection Chart */}
            <div className="glass rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" /> Projeção de Receita (RPM ${data.estimatedRpm})
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="views" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`$${value}`, 'Receita']} />
                    <Bar dataKey="receita" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Receita estimada por mês baseada em views diárias × RPM do nicho</p>
            </div>

            {/* Channels */}
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk'] mb-3">📊 Canais por Viral Score ({filteredChannels.length})</h2>
              <div className="space-y-3">
                {filteredChannels.map((ch: any, i: number) => (
                  <motion.div key={ch.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    {ch.thumbnail && <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={`https://youtube.com/channel/${ch.id}`} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-sm hover:text-primary transition-colors truncate">{ch.name}</a>
                        {ch.faceless && (
                          <Badge className="bg-primary/20 text-primary text-[10px]">FACELESS</Badge>
                        )}
                        {ch.isMonetized && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">💰 MONETIZADO</Badge>
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
                  </motion.div>
                ))}
                {filteredChannels.length === 0 && channels.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum canal com os filtros atuais</p>
                )}
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
                          <Badge className="absolute top-1 left-1 bg-accent text-accent-foreground text-[10px] gap-1">
                            <Star className="w-3 h-3" /> OUTLIER
                          </Badge>
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
            <p>Escolha um nicho para explorar saturação, RPM, canais faceless e projeção de receita</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NicheExplorer;
