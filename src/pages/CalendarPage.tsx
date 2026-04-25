import { useEffect, useMemo, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, AlertCircle, Loader2, Youtube, Sparkles, LayoutGrid, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

type Schedule = {
  id: string;
  channel_id: string;
  project_id: string | null;
  youtube_video_id: string | null;
  scheduled_at: string;
  published_at: string | null;
  status: string;
  title: string | null;
  topic: string | null;
  niche: string | null;
};

type Channel = { id: string; channel_name: string; posting_days?: string[]; posting_hour?: number; min_interval_hours?: number; next_slot_at?: string | null; autopilot_enabled?: boolean };

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  publishing: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  draft: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  draft: 'Rascunho',
};

const KANBAN_COLS = ['draft', 'scheduled', 'publishing', 'published'];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

const CalendarPage = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'kanban'>('calendar');
  const [cursor, setCursor] = useState(new Date());
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [creating, setCreating] = useState<string | null>(null); // ISO date for new slot
  const [newSlot, setNewSlot] = useState<{ channel_id: string; title: string; topic: string; time: string }>({ channel_id: '', title: '', topic: '', time: '18:00' });

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: schs }, { data: chs }] = await Promise.all([
      supabase.from('channel_schedule' as any).select('*').eq('user_id', user.id).order('scheduled_at') as any,
      supabase.from('user_channels').select('id, channel_name, posting_days, posting_hour, min_interval_hours, next_slot_at, autopilot_enabled').eq('user_id', user.id) as any,
    ]);
    setSchedules((schs || []) as Schedule[]);
    setChannels((chs || []) as Channel[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('calendar-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_schedule' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() =>
    filterChannel === 'all' ? schedules : schedules.filter(s => s.channel_id === filterChannel),
    [schedules, filterChannel]
  );

  const monthDays = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const days: { date: Date; inMonth: boolean }[] = [];
    // pad with previous month days to start on Sunday
    const padStart = start.getDay();
    for (let i = padStart - 1; i >= 0; i--) {
      const d = new Date(start); d.setDate(d.getDate() - (i + 1));
      days.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= end.getDate(); i++) days.push({ date: new Date(start.getFullYear(), start.getMonth(), i), inMonth: true });
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      days.push({ date: d, inMonth: false });
    }
    return days;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m: Record<string, Schedule[]> = {};
    for (const s of filtered) {
      const k = new Date(s.scheduled_at).toDateString();
      (m[k] = m[k] || []).push(s);
    }
    return m;
  }, [filtered]);

  const openCreate = (date: Date) => {
    const ch = channels[0];
    if (!ch) { toast.error('Adicione um canal primeiro'); return; }
    const hour = ch.posting_hour ?? 18;
    setNewSlot({
      channel_id: ch.id,
      title: '',
      topic: '',
      time: `${String(hour).padStart(2, '0')}:00`,
    });
    setCreating(date.toISOString());
  };

  const submitSlot = async () => {
    if (!creating || !newSlot.channel_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const date = new Date(creating);
    const [h, m] = newSlot.time.split(':').map(Number);
    date.setHours(h, m, 0, 0);
    const { error } = await supabase.from('channel_schedule' as any).insert({
      user_id: user.id,
      channel_id: newSlot.channel_id,
      scheduled_at: date.toISOString(),
      title: newSlot.title || null,
      topic: newSlot.topic || null,
      status: 'scheduled',
    } as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Slot agendado'); setCreating(null); load(); }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('channel_schedule' as any).update({ status } as any).eq('id', id);
    if (error) toast.error(error.message); else load();
  };

  const deleteSlot = async (id: string) => {
    const { error } = await supabase.from('channel_schedule' as any).delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Removido'); load(); }
  };

  const channelsById = useMemo(() => Object.fromEntries(channels.map(c => [c.id, c])), [channels]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-display">Calendário</h1>
            <p className="text-sm text-muted-foreground">Visualize e organize publicações de todos os canais</p>
          </div>

          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('calendar')} className="rounded-none gap-1">
              <CalendarDays className="w-4 h-4" /> Mês
            </Button>
            <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('kanban')} className="rounded-none gap-1">
              <LayoutGrid className="w-4 h-4" /> Kanban
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : view === 'calendar' ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>Hoje</Button>
                  <Button variant="outline" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2 text-xs font-medium text-muted-foreground">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-center">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map(({ date, inMonth }, i) => {
                  const items = byDay[date.toDateString()] || [];
                  const today = date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={i}
                      className={`min-h-[100px] border border-border rounded-md p-1.5 transition-colors hover:bg-secondary/30 ${
                        !inMonth ? 'opacity-40' : ''
                      } ${today ? 'border-primary' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium ${today ? 'text-primary' : ''}`}>{date.getDate()}</span>
                        {inMonth && (
                          <button onClick={() => openCreate(date)} className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map(s => {
                          const cls = STATUS_COLORS[s.status] || STATUS_COLORS.scheduled;
                          return (
                            <div key={s.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${cls} truncate cursor-pointer`} title={s.title || s.topic || ''}>
                              {channelsById[s.channel_id]?.channel_name?.slice(0, 12)} · {s.title?.slice(0, 20) || s.topic?.slice(0, 20) || 'sem título'}
                            </div>
                          );
                        })}
                        {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} mais</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {KANBAN_COLS.map(col => {
              const items = filtered.filter(s => s.status === col);
              return (
                <Card key={col}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{STATUS_LABEL[col]}</span>
                      <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Vazio</p>}
                    {items.map(s => (
                      <div key={s.id} className="border border-border rounded-md p-2 space-y-1.5 bg-card">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-medium truncate flex-1">{s.title || s.topic || '—'}</span>
                          {s.youtube_video_id && (
                            <a href={`https://youtu.be/${s.youtube_video_id}`} target="_blank" rel="noreferrer" className="text-red-500"><Youtube className="w-3 h-3" /></a>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{channelsById[s.channel_id]?.channel_name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(s.scheduled_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div className="flex gap-1">
                          <Select value={s.status} onValueChange={v => updateStatus(s.id, v)}>
                            <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {KANBAN_COLS.map(c => <SelectItem key={c} value={c} className="text-xs">{STATUS_LABEL[c]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteSlot(s.id)}>×</Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {channels.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Próximos slots sugeridos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {channels.filter(c => c.next_slot_at).map(c => (
                <div key={c.id} className="flex items-center justify-between border border-border rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/channels/${c.id}/settings`} className="text-sm font-medium hover:text-primary">{c.channel_name}</Link>
                    {c.autopilot_enabled && <Badge className="bg-primary/20 text-primary text-[10px]">AutoPilot</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(c.next_slot_at!).toLocaleString('pt-BR')}</span>
                </div>
              ))}
              {channels.filter(c => c.next_slot_at).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum slot calculado. Sincronize um canal para gerar sugestões.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo agendamento — {creating && new Date(creating).toLocaleDateString('pt-BR')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Canal</Label>
                <Select value={newSlot.channel_id} onValueChange={v => setNewSlot(s => ({ ...s, channel_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={newSlot.title} onChange={e => setNewSlot(s => ({ ...s, title: e.target.value }))} />
              </div>
              <div>
                <Label>Tópico</Label>
                <Input value={newSlot.topic} onChange={e => setNewSlot(s => ({ ...s, topic: e.target.value }))} />
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={newSlot.time} onChange={e => setNewSlot(s => ({ ...s, time: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreating(null)}>Cancelar</Button>
              <Button onClick={submitSlot} className="gradient-hero border-0">Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CalendarPage;
