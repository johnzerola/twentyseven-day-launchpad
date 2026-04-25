import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Plus, X, Zap, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

type Slot = any;
type Channel = any;

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  publishing: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelled: 'bg-zinc-700/40 text-zinc-500 border-zinc-700/40 line-through',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

function tomorrow6pmLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeNextSlot(ch: Channel): Date | null {
  if (!ch.autopilot_enabled) return null;
  const last = ch.last_posted_at ? new Date(ch.last_posted_at) : new Date();
  const interval = (ch.min_interval_hours ?? 48) * 3600 * 1000;
  const next = new Date(last.getTime() + interval);
  if (typeof ch.posting_hour === 'number') next.setHours(ch.posting_hour, 0, 0, 0);
  // bump to a posting day if defined
  const days: string[] = Array.isArray(ch.posting_days) ? ch.posting_days : [];
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (days.length) {
    let guard = 0;
    while (!days.includes(map[next.getDay()]) && guard++ < 14) {
      next.setDate(next.getDate() + 1);
    }
  }
  return next;
}

const Scheduler = () => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ channel_id: '', scheduled_at: tomorrow6pmLocal(), topic: '' });
  const [userId, setUserId] = useState<string>('');

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const [s, c] = await Promise.all([
      supabase.from('channel_schedule' as any).select('*').eq('user_id', user.id).order('scheduled_at', { ascending: true }),
      supabase.from('user_channels' as any).select('*').eq('user_id', user.id),
    ]);
    setSlots((s.data || []) as Slot[]);
    setChannels((c.data || []) as Channel[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const grouped = useMemo(() => {
    const m: Record<string, Slot[]> = {};
    slots.forEach(s => {
      const key = s.channel_id || 'sem-canal';
      (m[key] ||= []).push(s);
    });
    return m;
  }, [slots]);

  const autopilotChannels = useMemo(() => channels.filter(c => c.autopilot_enabled), [channels]);

  const handleCancel = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from('channel_schedule' as any).update({ status: 'cancelled' } as any).eq('id', id);
    setBusy(null);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Slot cancelado'); fetchData(); }
  };

  const handleManualCreate = async () => {
    if (!manualForm.channel_id || !manualForm.scheduled_at) { toast.error('Preencha canal e data'); return; }
    const { error } = await supabase.from('channel_schedule' as any).insert({
      user_id: userId,
      channel_id: manualForm.channel_id,
      scheduled_at: new Date(manualForm.scheduled_at).toISOString(),
      topic: manualForm.topic || null,
      status: 'scheduled',
    } as any);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('📅 Slot agendado');
    setManualOpen(false);
    setManualForm({ channel_id: '', scheduled_at: tomorrow6pmLocal(), topic: '' });
    fetchData();
  };

  const channelName = (id: string) => channels.find(c => c.id === id)?.channel_name || 'Canal';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display">Agendamento</h1>
            <p className="text-sm text-muted-foreground">Fila de publicações por canal</p>
          </div>
          <Button onClick={() => setManualOpen(true)} className="gradient-hero border-0 gap-2">
            <Plus className="w-4 h-4" /> Agendar manualmente
          </Button>
        </div>

        {/* Auto slots */}
        {autopilotChannels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Próximos slots automáticos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {autopilotChannels.map(c => {
                const next = computeNextSlot(c);
                return (
                  <div key={c.id} className="border border-border/40 rounded-lg p-3 bg-secondary/20">
                    <div className="flex items-center gap-2 mb-1">
                      {c.thumbnail && <img src={c.thumbnail} className="w-6 h-6 rounded-full" alt="" />}
                      <p className="text-sm font-medium truncate flex-1">{c.channel_name}</p>
                      <Badge className="bg-primary/20 text-primary text-[9px]">AUTO</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Próxima publicação:</p>
                    <p className="text-sm font-mono mt-1">
                      {next ? next.toLocaleString() : '—'}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Intervalo: {c.min_interval_hours || 48}h · {String(c.posting_hour ?? 18).padStart(2, '0')}h
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Scheduled queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Fila ({slots.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-1" />Carregando…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum slot agendado.</p>
            ) : (
              <div className="space-y-5">
                {Object.entries(grouped).map(([cid, items]) => (
                  <div key={cid}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{channelName(cid)}</p>
                    <div className="space-y-2">
                      {items.map(s => {
                        const StatusIcon = s.status === 'published' ? CheckCircle2 : s.status === 'failed' ? AlertTriangle : Clock;
                        return (
                          <div key={s.id} className="flex items-center gap-3 border border-border/40 rounded-lg p-3">
                            <StatusIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.title || s.topic || '(sem título)'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '—'}
                              </p>
                            </div>
                            <Badge className={`${STATUS_STYLES[s.status] || ''} border text-[10px]`}>
                              {STATUS_LABEL[s.status] || s.status}
                            </Badge>
                            {s.status === 'scheduled' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" disabled={busy === s.id} onClick={() => handleCancel(s.id)}>
                                {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                Cancelar
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual schedule dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar manualmente</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={manualForm.channel_id} onValueChange={v => setManualForm(f => ({ ...f, channel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={manualForm.scheduled_at} onChange={e => setManualForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tópico (opcional)</Label>
              <Input value={manualForm.topic} onChange={e => setManualForm(f => ({ ...f, topic: e.target.value }))} placeholder="Ex: Como economizar em 2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualCreate} className="gradient-hero border-0">Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Scheduler;
