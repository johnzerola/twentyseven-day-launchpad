import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  BarChart2, ExternalLink, Sparkles, Eye, MousePointer, Clock, Trophy, Loader2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatNumber } from '@/lib/formatters';

type Perf = any;

const PERIODS: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };

function scoreColor(score: number) {
  if (score >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (score >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

const Performance = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [perf, setPerf] = useState<Perf[]>([]);
  const [intel, setIntel] = useState<any[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('30d');
  const [loading, setLoading] = useState(true);
  const [insightOpen, setInsightOpen] = useState<Perf | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [c, p, i] = await Promise.all([
        supabase.from('user_channels' as any).select('id,channel_name,thumbnail').eq('user_id', user.id),
        supabase.from('video_performance' as any).select('*').eq('user_id', user.id).order('published_at', { ascending: false }).limit(500),
        supabase.from('channel_intelligence_per_user' as any).select('*').eq('user_id', user.id),
      ]);
      setChannels((c.data || []) as any[]);
      setPerf((p.data || []) as Perf[]);
      setIntel((i.data || []) as any[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const days = PERIODS[periodFilter];
    const cutoff = days ? Date.now() - days * 86400000 : 0;
    return perf.filter((v: any) => {
      if (channelFilter !== 'all' && v.channel_id !== channelFilter) return false;
      if (cutoff && v.published_at && new Date(v.published_at).getTime() < cutoff) return false;
      return true;
    });
  }, [perf, channelFilter, periodFilter]);

  const stats = useMemo(() => {
    const totalViews = filtered.reduce((s, v) => s + (v.views_current || v.views || 0), 0);
    const ctrs = filtered.map(v => Number(v.ctr_percent ?? v.ctr ?? 0)).filter(Boolean);
    const avgCtr = ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : 0;
    const durations = filtered.map(v => v.avg_view_duration_seconds || v.avg_view_duration_s || 0).filter(Boolean);
    const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const best = filtered.slice().sort((a, b) => (b.views_current || b.views || 0) - (a.views_current || a.views || 0))[0];
    return { totalViews, avgCtr, avgDur, best };
  }, [filtered]);

  // Build chart data — group by date, then by channel name
  const chartData = useMemo(() => {
    const byDate: Record<string, any> = {};
    const channelMap = Object.fromEntries(channels.map(c => [c.id, c.channel_name]));
    filtered.forEach((v: any) => {
      if (!v.published_at) return;
      const d = new Date(v.published_at).toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { date: d };
      const cn = channelMap[v.channel_id] || 'Outro';
      byDate[d][cn] = (byDate[d][cn] || 0) + (v.views_current || v.views || 0);
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filtered, channels]);

  const channelNames = useMemo(() => {
    const set = new Set<string>();
    chartData.forEach((d: any) => Object.keys(d).forEach(k => k !== 'date' && set.add(k)));
    return Array.from(set);
  }, [chartData]);

  const intelFiltered = useMemo(() => {
    return channelFilter === 'all' ? intel : intel.filter(i => i.channel_id === channelFilter);
  }, [intel, channelFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Performance</h1>
            <p className="text-sm text-muted-foreground">Métricas e inteligência consolidada dos seus canais</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Canal:</span>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Período:</span>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todo período</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Eye className="w-4 h-4 text-primary" />} label="Total Views" value={formatNumber(stats.totalViews)} />
          <StatCard icon={<MousePointer className="w-4 h-4 text-amber-400" />} label="CTR Médio" value={`${stats.avgCtr.toFixed(1)}%`} />
          <StatCard icon={<Clock className="w-4 h-4 text-emerald-400" />} label="Tempo Médio" value={`${Math.floor(stats.avgDur / 60)}:${String(Math.round(stats.avgDur % 60)).padStart(2, '0')}`} />
          <StatCard icon={<Trophy className="w-4 h-4 text-yellow-400" />} label="Melhor vídeo" value={stats.best ? formatNumber(stats.best.views_current || stats.best.views || 0) : '—'} sub={stats.best?.title?.slice(0, 30)} />
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Views ao longo do tempo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {channelNames.map((cn, idx) => (
                    <Line key={cn} type="monotone" dataKey={cn} stroke={['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Videos table */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Vídeos ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum vídeo no período. Aguarde a sincronização semanal ou publique um novo vídeo.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-secondary/30 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Vídeo</th>
                    <th className="text-left p-3">Canal</th>
                    <th className="text-right p-3">Views</th>
                    <th className="text-right p-3">Likes</th>
                    <th className="text-right p-3">CTR</th>
                    <th className="text-center p-3">Score</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v: any) => {
                    const channel = channels.find(c => c.id === v.channel_id);
                    const score = Math.round(v.performance_score || v.predicted_viral_score || 0);
                    return (
                      <tr key={v.id} className="border-t border-border/50 hover:bg-secondary/20">
                        <td className="p-3 max-w-xs">
                          <p className="font-medium truncate">{v.title || '—'}</p>
                        </td>
                        <td className="p-3 text-muted-foreground">{channel?.channel_name || '—'}</td>
                        <td className="p-3 text-right font-mono">{formatNumber(v.views_current || v.views || 0)}</td>
                        <td className="p-3 text-right font-mono">{formatNumber(v.likes || 0)}</td>
                        <td className="p-3 text-right font-mono">{Number(v.ctr_percent ?? v.ctr ?? 0).toFixed(1)}%</td>
                        <td className="p-3 text-center">
                          <Badge className={`${scoreColor(score)} border text-[10px]`}>{score}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{v.published_at ? new Date(v.published_at).toLocaleDateString() : '—'}</td>
                        <td className="p-3 text-right space-x-1">
                          {v.youtube_video_id && (
                            <a href={`https://youtube.com/watch?v=${v.youtube_video_id}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2"><ExternalLink className="w-3 h-3" /></Button>
                            </a>
                          )}
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setInsightOpen(v)}>
                            <Sparkles className="w-3 h-3 mr-1" /> Insights
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* What's working */}
        {intelFiltered.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> O que está funcionando</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {intelFiltered.map((it: any) => {
                const channel = channels.find(c => c.id === it.channel_id);
                return (
                  <div key={it.id} className="border border-border/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{channel?.channel_name || 'Canal'}</p>
                      <span className="text-[10px] text-muted-foreground">
                        Atualizado {it.last_analyzed_at ? new Date(it.last_analyzed_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">🔥 Top tópicos</p>
                        <div className="flex flex-wrap gap-1">
                          {(it.top_performing_topics || []).slice(0, 5).map((t: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                          {!it.top_performing_topics?.length && <span className="text-muted-foreground/60">—</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">📅 Melhores dias</p>
                        <div className="flex flex-wrap gap-1">
                          {(it.best_posting_days || []).map((d: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{d}</Badge>
                          ))}
                          {!it.best_posting_days?.length && <span className="text-muted-foreground/60">—</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">⏰ Melhores horários</p>
                        <div className="flex flex-wrap gap-1">
                          {(it.best_posting_hours || []).map((h: number, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{String(h).padStart(2, '0')}h</Badge>
                          ))}
                          {!it.best_posting_hours?.length && <span className="text-muted-foreground/60">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Insights side panel */}
      <Sheet open={!!insightOpen} onOpenChange={(v) => !v && setInsightOpen(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">Insights do vídeo</SheetTitle>
          </SheetHeader>
          {insightOpen && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium">{insightOpen.title}</p>
              {insightOpen.learning_notes ? (
                <p className="text-xs text-muted-foreground whitespace-pre-line bg-secondary/30 rounded-lg p-3 leading-relaxed">
                  {insightOpen.learning_notes}
                </p>
              ) : insightOpen.lessons_learned?.length ? (
                <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                  {insightOpen.lessons_learned.map((l: string, i: number) => <li key={i}>{l}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aguardando sincronização semanal…</p>
              )}
              {insightOpen.ai_feedback && (
                <pre className="text-[10px] text-muted-foreground bg-secondary/30 rounded p-2 overflow-x-auto">
                  {JSON.stringify(insightOpen.ai_feedback, null, 2)}
                </pre>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

const StatCard = ({ icon, label, value, sub }: any) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className="text-xl font-bold font-display truncate">{value}</div>
      {sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

export default Performance;
