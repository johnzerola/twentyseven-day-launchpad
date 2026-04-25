import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Loader2, RefreshCw, TrendingUp, Sparkles, Calendar, Clock, Eye, BarChart3, Lightbulb, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Channel {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  niche: string | null;
}

interface Intelligence {
  id: string;
  channel_id: string;
  top_performing_topics: string[] | null;
  top_performing_hooks: string[] | null;
  best_posting_days: number[] | null;
  best_posting_hours: number[] | null;
  low_performing_topics: string[] | null;
  avg_views_all_time: number | null;
  avg_ctr_all_time: number | null;
  best_video_id: string | null;
  best_video_views: number | null;
  ai_suggestions: any;
  last_analyzed_at: string | null;
}

const MyChannelIntelligence = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [intel, setIntel] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  useEffect(() => {
    if (selectedId) loadIntelligence(selectedId);
  }, [selectedId]);

  const loadChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('user_channels')
      .select('id, channel_name, thumbnail, niche')
      .eq('user_id', user.id)
      .order('linked_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar canais'); return; }
    setChannels(data || []);
    if (data && data.length > 0) setSelectedId(data[0].id);
  };

  const loadIntelligence = async (channelId: string) => {
    setLoading(true);
    setIntel(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('channel_intelligence_per_user')
      .select('*')
      .eq('user_id', user.id)
      .eq('channel_id', channelId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      toast.error('Erro ao carregar inteligência');
    }
    setIntel(data as any);
    setLoading(false);
  };

  const reanalyze = async () => {
    if (!selectedId) return;
    setReanalyzing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReanalyzing(false); return; }
    try {
      const { error } = await supabase.functions.invoke('sync-channel-performance', {
        body: { userId: user.id, channelId: selectedId, force: true }
      });
      if (error) throw error;
      toast.success('Análise atualizada com sucesso!');
      await loadIntelligence(selectedId);
    } catch (e: any) {
      toast.error('Falha ao reanalisar: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setReanalyzing(false);
    }
  };

  const selectedChannel = channels.find(c => c.id === selectedId);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Inteligência do Canal</h1>
              <p className="text-sm text-muted-foreground">Top tópicos, hooks e melhores horários por canal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Selecione um canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={reanalyze} disabled={!selectedId || reanalyzing} variant="default">
              {reanalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Reanalisar
            </Button>
          </div>
        </div>

        {channels.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Nenhum canal vinculado. Vá em <span className="text-primary font-medium">Meus Canais</span> para conectar um.
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && selectedId && !intel && (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />
              <div>
                <p className="font-medium">Sem dados de inteligência ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em <strong>Reanalisar</strong> para gerar a primeira análise deste canal.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && intel && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<Eye className="w-4 h-4" />} label="Views médias" value={formatNumber(intel.avg_views_all_time || 0)} />
              <StatCard icon={<BarChart3 className="w-4 h-4" />} label="CTR médio" value={`${(intel.avg_ctr_all_time || 0).toFixed(2)}%`} />
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Melhor vídeo" value={formatNumber(intel.best_video_views || 0)} />
              <StatCard icon={<Clock className="w-4 h-4" />} label="Última análise" value={intel.last_analyzed_at ? format(new Date(intel.last_analyzed_at), 'dd/MM HH:mm') : '—'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Topics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Top tópicos que performam
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intel.top_performing_topics?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {intel.top_performing_topics.map((t, i) => (
                        <Badge key={i} className="bg-primary/15 text-primary hover:bg-primary/20 border-0 text-xs px-2.5 py-1">
                          #{i + 1} {t}
                        </Badge>
                      ))}
                    </div>
                  ) : <EmptyHint text="Sem tópicos analisados ainda" />}
                </CardContent>
              </Card>

              {/* Top Hooks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" /> Hooks vencedores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intel.top_performing_hooks?.length ? (
                    <ul className="space-y-2">
                      {intel.top_performing_hooks.slice(0, 6).map((h, i) => (
                        <li key={i} className="text-sm border-l-2 border-amber-400/40 pl-3 py-1 text-foreground/90">
                          "{h}"
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyHint text="Sem hooks analisados ainda" />}
                </CardContent>
              </Card>

              {/* Best Days */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" /> Melhores dias
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between gap-1">
                    {DAY_NAMES.map((d, i) => {
                      const active = intel.best_posting_days?.includes(i);
                      return (
                        <div key={i} className={`flex-1 rounded-lg py-3 text-center text-xs font-medium transition ${active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-muted/30 text-muted-foreground'}`}>
                          {d}
                        </div>
                      );
                    })}
                  </div>
                  {!intel.best_posting_days?.length && <EmptyHint text="Sem dados de dias ainda" />}
                </CardContent>
              </Card>

              {/* Best Hours */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" /> Melhores horários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {intel.best_posting_hours?.length ? (
                    <div className="grid grid-cols-6 gap-1.5">
                      {Array.from({ length: 24 }).map((_, h) => {
                        const active = intel.best_posting_hours?.includes(h);
                        return (
                          <div key={h} className={`rounded py-2 text-center text-[11px] font-mono ${active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-muted/20 text-muted-foreground/60'}`}>
                            {String(h).padStart(2, '0')}h
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyHint text="Sem dados de horário ainda" />}
                </CardContent>
              </Card>
            </div>

            {/* Low performing */}
            {intel.low_performing_topics?.length ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" /> Evite esses tópicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {intel.low_performing_topics.map((t, i) => (
                      <Badge key={i} variant="outline" className="border-red-500/30 text-red-400/90 text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* AI Suggestions */}
            {intel.ai_suggestions && Object.keys(intel.ai_suggestions).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" /> Sugestões da IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/20 p-3 rounded">
                    {JSON.stringify(intel.ai_suggestions, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon} {label}
      </div>
      <div className="text-xl font-bold font-display">{value}</div>
    </CardContent>
  </Card>
);

const EmptyHint = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground italic py-2">{text}</p>
);

export default MyChannelIntelligence;
