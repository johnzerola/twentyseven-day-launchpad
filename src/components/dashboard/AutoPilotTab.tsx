import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Zap, Loader2, Settings, Plus, X, Calendar, Mic, User, Palette, Clock, Save, Trash2, Play, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Channel {
  id: string;
  channel_name: string;
  thumbnail: string | null;
  niche: string | null;
  autopilot_enabled: boolean;
  next_slot_at: string | null;
  last_posted_at: string | null;
  total_videos_posted: number | null;
  character_name: string | null;
  character_bio: string | null;
  tts_voice_id: string | null;
  visual_style_prompt: string | null;
  posting_hour: number | null;
  min_interval_hours: number | null;
  weekly_video_target: number | null;
  avoided_topics: string[] | null;
}

interface ScheduleItem {
  id: string;
  channel_id: string;
  scheduled_at: string;
  topic: string | null;
  title: string | null;
  status: string;
  channel_name?: string;
  thumbnail?: string | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const AutoPilotTab = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [perfByChannel, setPerfByChannel] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string>('');
  const [draftMap, setDraftMap] = useState<Record<string, Partial<Channel>>>({});
  const [savingId, setSavingId] = useState<string>('');
  const [newAvoid, setNewAvoid] = useState<Record<string, string>>({});
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ channel_id: '', topic: '', scheduled_at: '' });

  const reload = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [chRes, schRes, perfRes] = await Promise.all([
      supabase.from('user_channels').select('*').eq('user_id', user.id).order('linked_at', { ascending: false }),
      supabase.from('channel_schedule').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: true }).limit(100),
      supabase.from('video_performance').select('channel_id, views').eq('user_id', user.id),
    ]);

    const chs = (chRes.data || []) as Channel[];
    setChannels(chs);

    const chMap = Object.fromEntries(chs.map(c => [c.id, c]));
    const schWithMeta = (schRes.data || []).map((s: any) => ({
      ...s,
      channel_name: chMap[s.channel_id]?.channel_name,
      thumbnail: chMap[s.channel_id]?.thumbnail,
    }));
    setSchedule(schWithMeta);

    // Avg views per channel
    const grouped: Record<string, number[]> = {};
    (perfRes.data || []).forEach((r: any) => {
      if (!r.channel_id) return;
      grouped[r.channel_id] = grouped[r.channel_id] || [];
      grouped[r.channel_id].push(r.views || 0);
    });
    const avgs: Record<string, number> = {};
    Object.entries(grouped).forEach(([k, arr]) => {
      avgs[k] = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });
    setPerfByChannel(avgs);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const toggleAutoPilot = async (ch: Channel, value: boolean) => {
    const { error } = await supabase
      .from('user_channels')
      .update({ autopilot_enabled: value } as any)
      .eq('id', ch.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, autopilot_enabled: value } : c));
    toast.success(`AutoPilot ${value ? 'ativado' : 'desativado'} para ${ch.channel_name}`);
  };

  const runScheduler = async () => {
    setRunning(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRunning(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke('autopilot-scheduler', {
        body: { userId: user.id },
      });
      if (error) throw error;
      const total = (data as any)?.reportPerChannel?.reduce((s: number, r: any) => s + (r.created || 0), 0) ?? 0;
      toast.success(`${total} vídeo(s) agendado(s) automaticamente`);
      await reload();
    } catch (e: any) {
      toast.error('Falha ao rodar scheduler: ' + (e?.message || 'erro'));
    } finally {
      setRunning(false);
    }
  };

  const openConfig = (ch: Channel) => {
    if (expandedId === ch.id) { setExpandedId(''); return; }
    setExpandedId(ch.id);
    setDraftMap(prev => ({ ...prev, [ch.id]: { ...ch } }));
  };

  const updateDraft = (id: string, patch: Partial<Channel>) => {
    setDraftMap(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveDNA = async (id: string) => {
    const draft = draftMap[id];
    if (!draft) return;
    setSavingId(id);
    const payload: any = {
      character_name: draft.character_name || null,
      character_bio: draft.character_bio || null,
      tts_voice_id: draft.tts_voice_id || null,
      visual_style_prompt: draft.visual_style_prompt || null,
      weekly_video_target: draft.weekly_video_target || 3,
      min_interval_hours: draft.min_interval_hours || 48,
      posting_hour: draft.posting_hour ?? 18,
      avoided_topics: draft.avoided_topics || [],
    };
    const { error } = await supabase.from('user_channels').update(payload).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); }
    else {
      toast.success('DNA salvo!');
      setChannels(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    }
    setSavingId('');
  };

  const addAvoidTopic = (id: string) => {
    const v = (newAvoid[id] || '').trim();
    if (!v) return;
    const current = draftMap[id]?.avoided_topics || [];
    updateDraft(id, { avoided_topics: [...current, v] });
    setNewAvoid(prev => ({ ...prev, [id]: '' }));
  };

  const removeAvoidTopic = (id: string, idx: number) => {
    const current = [...(draftMap[id]?.avoided_topics || [])];
    current.splice(idx, 1);
    updateDraft(id, { avoided_topics: current });
  };

  const cancelSlot = async (slotId: string) => {
    const { error } = await supabase
      .from('channel_schedule')
      .update({ status: 'cancelled' } as any)
      .eq('id', slotId);
    if (error) { toast.error(error.message); return; }
    toast.success('Slot cancelado');
    setSchedule(prev => prev.map(s => s.id === slotId ? { ...s, status: 'cancelled' } : s));
  };

  const submitManual = async () => {
    if (!manualForm.channel_id || !manualForm.topic || !manualForm.scheduled_at) {
      toast.error('Preencha todos os campos');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('channel_schedule').insert({
      user_id: user.id,
      channel_id: manualForm.channel_id,
      scheduled_at: new Date(manualForm.scheduled_at).toISOString(),
      topic: manualForm.topic,
      title: manualForm.topic,
      status: 'scheduled',
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Slot agendado');
    setShowManual(false);
    setManualForm({ channel_id: '', topic: '', scheduled_at: '' });
    await reload();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <Card><CardContent className="p-10 text-center text-muted-foreground">
        Conecte um canal antes de configurar o AutoPilot.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> AutoPilot — Automação por canal
          </h3>
          <p className="text-xs text-muted-foreground">
            Configure o DNA, ative o piloto e deixe o sistema agendar e produzir
          </p>
        </div>
        <Button onClick={runScheduler} disabled={running} className="gradient-hero text-primary-foreground">
          {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          🤖 Rodar Scheduler Agora
        </Button>
      </div>

      {/* Channel cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {channels.map(ch => {
          const expanded = expandedId === ch.id;
          const draft = draftMap[ch.id] || ch;
          return (
            <div key={ch.id} className={`rounded-xl border transition ${ch.autopilot_enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/40 bg-card'}`}>
              {/* Card */}
              <div className="p-4 flex items-start gap-3">
                {ch.thumbnail ? (
                  <img src={ch.thumbnail} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs">{ch.channel_name?.charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">{ch.channel_name}</h4>
                    {ch.niche && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{ch.niche}</Badge>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={!!ch.autopilot_enabled}
                        onCheckedChange={(v) => toggleAutoPilot(ch, v)}
                      />
                      <span className={`text-xs font-medium ${ch.autopilot_enabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        AutoPilot {ch.autopilot_enabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                  {ch.autopilot_enabled && (
                    <p className="text-[11px] text-emerald-400 mb-1">
                      📅 Próximo: {ch.next_slot_at ? format(new Date(ch.next_slot_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : 'Calculando...'}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {ch.total_videos_posted || 0} vídeos postados · média {(perfByChannel[ch.id] || 0).toLocaleString()} views
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => openConfig(ch)} className="shrink-0">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              {/* DNA inline panel */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-border/40"
                  >
                    <div className="p-4 space-y-4 bg-background/40">
                      {/* Persona */}
                      <Section icon={<User className="w-3.5 h-3.5" />} label="Personagem">
                        <div className="space-y-2">
                          <Input
                            placeholder="Nome do personagem (ex: Carlos Cripto)"
                            value={draft.character_name || ''}
                            onChange={e => updateDraft(ch.id, { character_name: e.target.value })}
                            className="h-8 text-xs"
                          />
                          <Textarea
                            placeholder="Bio/Tom (ex: Especialista em finanças, fala direto, sem enrolação)"
                            value={draft.character_bio || ''}
                            onChange={e => updateDraft(ch.id, { character_bio: e.target.value })}
                            rows={2}
                            className="text-xs resize-none"
                          />
                        </div>
                      </Section>

                      {/* Voice */}
                      <Section icon={<Mic className="w-3.5 h-3.5" />} label="Voz">
                        <Input
                          placeholder="ElevenLabs Voice ID (ex: 21m00Tcm4TlvDq8ikWAM)"
                          value={draft.tts_voice_id || ''}
                          onChange={e => updateDraft(ch.id, { tts_voice_id: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </Section>

                      {/* Visual */}
                      <Section icon={<Palette className="w-3.5 h-3.5" />} label="Estilo Visual">
                        <Textarea
                          placeholder="Estilo dos prompts Veo3 (ex: Cinematic, close-up, warm tones)"
                          value={draft.visual_style_prompt || ''}
                          onChange={e => updateDraft(ch.id, { visual_style_prompt: e.target.value })}
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </Section>

                      {/* Schedule */}
                      <Section icon={<Calendar className="w-3.5 h-3.5" />} label="Agenda">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Meta semanal</Label>
                            <Select
                              value={String(draft.weekly_video_target || 3)}
                              onValueChange={v => updateDraft(ch.id, { weekly_video_target: Number(v) })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{[1, 2, 3, 4, 5, 6, 7].map(n => <SelectItem key={n} value={String(n)}>{n} vídeos</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Intervalo</Label>
                            <Select
                              value={String(draft.min_interval_hours || 48)}
                              onValueChange={v => updateDraft(ch.id, { min_interval_hours: Number(v) })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{[24, 48, 72, 96, 168].map(n => <SelectItem key={n} value={String(n)}>{n}h</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Horário</Label>
                            <Select
                              value={String(draft.posting_hour ?? 18)}
                              onValueChange={v => updateDraft(ch.id, { posting_hour: Number(v) })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{HOURS.map(h => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}h</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Section>

                      {/* Avoided topics */}
                      <Section icon={<X className="w-3.5 h-3.5" />} label="Tópicos a evitar">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {(draft.avoided_topics || []).map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] gap-1 border-red-500/30 text-red-400">
                                {t}
                                <button onClick={() => removeAvoidTopic(ch.id, i)} className="hover:text-red-300">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))}
                            {(!draft.avoided_topics || draft.avoided_topics.length === 0) && (
                              <span className="text-[10px] text-muted-foreground italic">Nenhum tópico bloqueado</span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder="Adicionar tópico..."
                              value={newAvoid[ch.id] || ''}
                              onChange={e => setNewAvoid(prev => ({ ...prev, [ch.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAvoidTopic(ch.id))}
                              className="h-7 text-xs"
                            />
                            <Button size="sm" variant="secondary" onClick={() => addAvoidTopic(ch.id)} className="h-7 text-xs">
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </Section>

                      <Button
                        onClick={() => saveDNA(ch.id)}
                        disabled={savingId === ch.id}
                        size="sm"
                        className="w-full"
                      >
                        {savingId === ch.id ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
                        Salvar DNA
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Schedule queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold font-display flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Fila de Postagem
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowManual(s => !s)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Agendar manualmente
          </Button>
        </div>

        <AnimatePresence>
          {showManual && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card>
                <CardContent className="p-4 grid md:grid-cols-4 gap-2">
                  <Select value={manualForm.channel_id} onValueChange={v => setManualForm(f => ({ ...f, channel_id: v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Canal" /></SelectTrigger>
                    <SelectContent>{channels.map(c => <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    placeholder="Tópico"
                    value={manualForm.topic}
                    onChange={e => setManualForm(f => ({ ...f, topic: e.target.value }))}
                    className="h-9 text-xs"
                  />
                  <Input
                    type="datetime-local"
                    value={manualForm.scheduled_at}
                    onChange={e => setManualForm(f => ({ ...f, scheduled_at: e.target.value }))}
                    className="h-9 text-xs"
                  />
                  <Button size="sm" onClick={submitManual}>Agendar</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {schedule.filter(s => s.status !== 'cancelled').length === 0 ? (
          <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">
            Sem postagens agendadas. Ative o AutoPilot ou agende manualmente.
          </CardContent></Card>
        ) : (
          <div className="space-y-1.5">
            {schedule.filter(s => s.status !== 'cancelled').slice(0, 30).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-card/50 hover:bg-card transition">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-xs font-medium truncate w-32">{item.channel_name}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">{item.topic || item.title || '— tópico pendente —'}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {format(new Date(item.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancelSlot(item.id)} className="h-7 w-7 p-0 shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
      {icon}{label}
    </div>
    {children}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    scheduled: 'bg-muted/40 text-muted-foreground border-border/40',
    publishing: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    scheduled: 'Agendado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Falhou',
  };
  return <Badge variant="outline" className={`text-[10px] shrink-0 ${map[status] || map.scheduled}`}>{labels[status] || status}</Badge>;
};
