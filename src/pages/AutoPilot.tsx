import { useEffect, useMemo, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Zap, AlertTriangle, CheckCircle2, FileEdit, RotateCw, Rocket, Youtube, Loader2, XCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnalyticsCollectorCard } from '@/components/autopilot/AnalyticsCollectorCard';

type VideoProject = {
  id: string;
  topic?: string | null;
  title?: string | null;
  status: string;
  audio_url: string | null;
  scheduled_at: string | null;
  error_message: string | null;
  youtube_video_id: string | null;
  channel_id_ref?: string | null;
  channel_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
  next_retry_at?: string | null;
  last_error_at?: string | null;
};

const ACTIVE_STATUSES = ['processing', 'waiting_videos', 'assembling', 'uploading', 'ready_for_production'];
const ERROR_STATUSES = ['error', 'failed', 'failed_permanent'];
const PUBLISHED_STATUSES = ['published', 'completed'];

const STATUS_PROGRESS: Record<string, number> = {
  ready_for_production: 10,
  processing: 30,
  waiting_videos: 50,
  assembling: 75,
  uploading: 92,
};

const STATUS_LABEL: Record<string, string> = {
  ready_for_production: 'Aguardando',
  processing: 'Processando',
  waiting_videos: 'Aguardando vídeos',
  assembling: 'Montando',
  uploading: 'Enviando ao YouTube',
};

function tomorrow6pmLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  // YYYY-MM-DDTHH:mm format for datetime-local
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const AutoPilot = () => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduledMap, setScheduledMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('video_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Erro ao carregar projetos: ' + error.message);
    } else {
      setProjects((data || []) as VideoProject[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
    const channel = supabase
      .channel('autopilot-video-projects')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'video_projects' }, async (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;
        // Detect transition to "published"
        const becamePublished =
          newRow?.status === 'published' &&
          oldRow?.status !== 'published' &&
          newRow?.youtube_video_id;
        if (becamePublished) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const channelRef = newRow.channel_id_ref || newRow.channel_id;
            if (user) {
              await supabase.from('video_performance' as any).insert({
                user_id: user.id,
                channel_id: channelRef,
                project_id: newRow.id,
                youtube_video_id: newRow.youtube_video_id,
                title: newRow.title || null,
                published_at: new Date().toISOString(),
              } as any);
              if (channelRef) {
                const { data: ch } = await supabase
                  .from('user_channels' as any)
                  .select('total_videos_posted')
                  .eq('id', channelRef)
                  .maybeSingle() as any;
                await supabase.from('user_channels' as any).update({
                  last_posted_at: new Date().toISOString(),
                  total_videos_posted: (ch?.total_videos_posted || 0) + 1,
                } as any).eq('id', channelRef);
                await supabase.from('channel_schedule' as any).update({
                  status: 'published',
                  published_at: new Date().toISOString(),
                  youtube_video_id: newRow.youtube_video_id,
                } as any).eq('project_id', newRow.id);
              }
            }
          } catch (e) {
            console.error('post-publish hook failed', e);
          }
        }
        fetchProjects();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'video_projects' }, () => fetchProjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects]);

  // Auto-refresh every 15s when there are active projects
  const hasActive = useMemo(() => projects.some(p => ACTIVE_STATUSES.includes(p.status)), [projects]);
  useEffect(() => {
    if (!hasActive) return;
    const i = setInterval(fetchProjects, 15000);
    return () => clearInterval(i);
  }, [hasActive, fetchProjects]);

  const stats = useMemo(() => {
    const inProgress = projects.filter(p => ACTIVE_STATUSES.includes(p.status)).length;
    const errors = projects.filter(p => ERROR_STATUSES.includes(p.status) || !!p.error_message).length;
    const published = projects.filter(p => PUBLISHED_STATUSES.includes(p.status) || !!p.youtube_video_id).length;
    const drafts = projects.filter(p => p.status === 'scenes' || p.status === 'draft').length;
    return { inProgress, errors, published, drafts };
  }, [projects]);

  const pipeline = projects.filter(p => ['processing', 'waiting_videos', 'assembling', 'uploading'].includes(p.status));
  const errored = projects.filter(p => ERROR_STATUSES.includes(p.status) || !!p.error_message);
  const ready = projects.filter(p => p.status === 'scenes' && !!p.audio_url);
  const recentPublished = projects.filter(p => !!p.youtube_video_id).slice(0, 8);

  const handleRetry = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke('autopilot-recover', {
      body: { projectId: id, force: true },
    });
    setBusy(null);
    if (error) {
      toast.error('Falha ao retentar: ' + error.message);
      return;
    }
    const r = (data as any)?.report?.[0];
    if (r?.action === 'marked_permanent') {
      toast.warning('Limite de tentativas atingido — projeto marcado como falha permanente');
    } else if (r?.action === 'retried') {
      const when = r.scheduled_at ? new Date(r.scheduled_at).toLocaleString() : '';
      toast.success(`Reagendado para ${when} (tentativa ${r.retry_count})`);
    } else {
      toast.success('Projeto reenviado para produção');
    }
    fetchProjects();
  };

  const handleCancel = async (id: string) => {
    setBusy(id);
    const { error } = await supabase
      .from('video_projects')
      .update({ status: 'failed_permanent' })
      .eq('id', id);
    if (!error) {
      await supabase
        .from('channel_schedule' as any)
        .update({ status: 'cancelled' } as any)
        .eq('project_id', id);
    }
    setBusy(null);
    if (error) toast.error('Falha ao cancelar: ' + error.message);
    else { toast.success('Projeto cancelado'); fetchProjects(); }
  };

  const handleProduce = async (p: VideoProject) => {
    if (!p.audio_url) {
      toast.error('Áudio não está disponível para este projeto');
      return;
    }
    const scheduledLocal = scheduledMap[p.id] || tomorrow6pmLocal();
    const scheduledAt = new Date(scheduledLocal).toISOString();
    setBusy(p.id);
    const { error } = await supabase
      .from('video_projects')
      .update({
        status: 'ready_for_production',
        scheduled_at: scheduledAt,
        error_message: null,
      })
      .eq('id', p.id);
    if (error) { setBusy(null); toast.error('Falha: ' + error.message); return; }

    // Link with channel_schedule + bump next_slot_at on user_channels
    const channelRef = (p as any).channel_id_ref || (p as any).channel_id;
    if (channelRef) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('channel_schedule' as any).insert({
          user_id: user.id,
          channel_id: channelRef,
          project_id: p.id,
          scheduled_at: scheduledAt,
          title: p.title || p.topic || null,
          status: 'scheduled',
        } as any);
        await supabase.from('user_channels' as any).update({ next_slot_at: scheduledAt } as any).eq('id', channelRef);
      }
    }
    setBusy(null);
    toast.success('🚀 Enviado ao AutoPilot');
    fetchProjects();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">AutoPilot</h1>
            <p className="text-sm text-muted-foreground">Acompanhe a produção e publicação automática dos seus vídeos</p>
          </div>
          {hasActive && (
            <Badge className="ml-auto bg-primary/20 text-primary animate-pulse">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pipeline ativo
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Loader2 className="w-4 h-4 text-primary" />} label="Em andamento" value={stats.inProgress} />
          <StatCard icon={<AlertTriangle className="w-4 h-4 text-destructive" />} label="Com erro" value={stats.errors} tone="destructive" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Publicados" value={stats.published} tone="success" />
          <StatCard icon={<FileEdit className="w-4 h-4 text-muted-foreground" />} label="Em rascunho" value={stats.drafts} />
        </div>

        {/* Coletor de métricas (auto a cada 4h) */}
        <AnalyticsCollectorCard />

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className={`w-4 h-4 ${pipeline.length > 0 ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
              Pipeline ativo
              {pipeline.length > 0 && <Badge className="bg-primary/20 text-primary animate-pulse">{pipeline.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : pipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum vídeo em produção no momento.</p>
            ) : (
              <div className="space-y-3">
                {pipeline.map(p => (
                  <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{p.title || p.topic || p.id}</span>
                      <Badge className="bg-primary/20 text-primary animate-pulse text-[10px]">{STATUS_LABEL[p.status] || p.status}</Badge>
                    </div>
                    <Progress value={STATUS_PROGRESS[p.status] || 20} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors */}
        {errored.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> Erros ({errored.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {errored.map(p => {
                const tries = p.retry_count || 0;
                const max = p.max_retries || 3;
                const exhausted = p.status === 'failed_permanent' || tries >= max;
                const nextRetryFuture = p.next_retry_at && new Date(p.next_retry_at).getTime() > Date.now();
                return (
                  <div key={p.id} className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">{p.title || p.topic || p.id}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {tries}/{max} tentativas
                        </Badge>
                        {exhausted && (
                          <Badge variant="destructive" className="text-[10px] shrink-0">Esgotado</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === p.id || exhausted}
                          onClick={() => handleRetry(p.id)}
                          title={exhausted ? 'Limite de tentativas atingido' : ''}
                        >
                          {busy === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />} Retentar
                        </Button>
                        {!exhausted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === p.id}
                            onClick={() => handleCancel(p.id)}
                          >
                            <XCircle className="w-3 h-3" /> Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                    {nextRetryFuture && !exhausted && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Próxima tentativa automática: {new Date(p.next_retry_at!).toLocaleString()}
                      </p>
                    )}
                    {p.error_message && (
                      <p className="text-xs text-destructive/90 font-mono bg-background/50 p-2 rounded break-all">
                        {p.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Ready to send */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="w-4 h-4 text-accent" /> Prontos para enviar ({ready.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ready.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto pronto. Gere áudio em um roteiro com cenas para liberar o envio.
              </p>
            ) : (
              <div className="space-y-3">
                {ready.map(p => (
                  <div key={p.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{p.title || p.topic || p.id}</span>
                      <Badge variant="outline" className="text-[10px]">áudio ✓</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      <Input
                        type="datetime-local"
                        value={scheduledMap[p.id] || tomorrow6pmLocal()}
                        onChange={(e) => setScheduledMap(s => ({ ...s, [p.id]: e.target.value }))}
                        className="text-xs"
                      />
                      <Button size="sm" disabled={busy === p.id || !p.audio_url} onClick={() => handleProduce(p)}>
                        {busy === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                        Produzir Agora
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Published */}
        {recentPublished.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" /> Publicados recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentPublished.map(p => (
                <a
                  key={p.id}
                  href={`https://youtube.com/watch?v=${p.youtube_video_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm truncate">{p.title || p.topic || p.id}</span>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Youtube className="w-3 h-3 text-red-500" /> Abrir
                  </Badge>
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'destructive' | 'success' }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-2xl font-bold font-display ${tone === 'destructive' ? 'text-destructive' : tone === 'success' ? 'text-emerald-500' : ''}`}>
        {value}
      </div>
    </CardContent>
  </Card>
);

export default AutoPilot;
