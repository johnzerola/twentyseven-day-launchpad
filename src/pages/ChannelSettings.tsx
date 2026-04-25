import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Mic, User, Calendar, Sparkles, RefreshCw, Loader2, TrendingUp, Trophy, Clock, Target, AlertTriangle, BookOpen, Lightbulb, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';

const DAYS = [
  { id: 'monday', label: 'Seg' },
  { id: 'tuesday', label: 'Ter' },
  { id: 'wednesday', label: 'Qua' },
  { id: 'thursday', label: 'Qui' },
  { id: 'friday', label: 'Sex' },
  { id: 'saturday', label: 'Sáb' },
  { id: 'sunday', label: 'Dom' },
];

const VOICE_STYLES = ['neutral', 'narrative', 'energetic', 'mysterious', 'documentary', 'dramatic', 'calm'];

type Channel = any;

const ChannelSettings = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [intel, setIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState('character');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: ch } = await supabase.from('user_channels').select('*').eq('id', id).maybeSingle() as any;
    if (!ch) { toast.error('Canal não encontrado'); navigate('/channels'); return; }
    setChannel(ch);
    const { data: i } = await supabase.from('channel_intelligence_per_user' as any).select('*').eq('channel_id', id).maybeSingle() as any;
    setIntel(i);
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<Channel>) => setChannel((c: Channel) => ({ ...c, ...patch }));

  const toggleDay = (d: string) => {
    const cur: string[] = channel.posting_days || [];
    update({ posting_days: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] });
  };

  const save = async () => {
    if (!channel) return;
    setSaving(true);
    const payload = {
      character_name: channel.character_name,
      character_bio: channel.character_bio,
      tts_voice_id: channel.tts_voice_id,
      tts_voice_style: channel.tts_voice_style,
      visual_style_prompt: channel.visual_style_prompt,
      posting_days: channel.posting_days,
      posting_hour: channel.posting_hour,
      min_interval_hours: channel.min_interval_hours,
      weekly_video_target: channel.weekly_video_target,
      reference_channels: channel.reference_channels,
      autopilot_enabled: channel.autopilot_enabled,
      top_topics: channel.top_topics,
      avoided_topics: channel.avoided_topics,
      language: channel.language,
    };
    const { error } = await supabase.from('user_channels').update(payload as any).eq('id', channel.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Configurações salvas');
  };

  const triggerSync = async () => {
    setSyncing(true);
    const { error } = await supabase.functions.invoke('sync-channel-performance', { body: { channelId: id, force: true } });
    setSyncing(false);
    if (error) toast.error('Falha na sincronização: ' + error.message);
    else { toast.success('Sincronizado! Recarregando…'); setTimeout(load, 1000); }
  };

  if (loading || !channel) return (
    <DashboardLayout>
      <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/channels"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-display truncate">{channel.channel_name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatNumber(channel.subscribers || 0)} inscritos · {channel.niche || 'sem nicho'}
            </p>
          </div>
          {channel.autopilot_enabled && (
            <Badge className="bg-primary/20 text-primary"><Zap className="w-3 h-3 mr-1" /> AutoPilot ON</Badge>
          )}
          <Button onClick={save} disabled={saving} className="gradient-hero border-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Salvar
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="character"><User className="w-4 h-4 mr-1" /> Personagem</TabsTrigger>
            <TabsTrigger value="schedule"><Calendar className="w-4 h-4 mr-1" /> Calendário</TabsTrigger>
            <TabsTrigger value="autopilot"><Zap className="w-4 h-4 mr-1" /> AutoPilot</TabsTrigger>
            <TabsTrigger value="intel"><Sparkles className="w-4 h-4 mr-1" /> Inteligência</TabsTrigger>
          </TabsList>

          {/* CHARACTER */}
          <TabsContent value="character" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Personagem & Voz</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do personagem/narrador</Label>
                    <Input value={channel.character_name || ''} onChange={e => update({ character_name: e.target.value })} placeholder="Ex: Mestre Sombra" />
                  </div>
                  <div>
                    <Label>Idioma</Label>
                    <Select value={channel.language || 'pt-BR'} onValueChange={v => update({ language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (BR)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es-ES">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Bio do personagem</Label>
                  <Textarea value={channel.character_bio || ''} onChange={e => update({ character_bio: e.target.value })} rows={3} placeholder="Descrição da persona — usado no roteiro para manter consistência" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>ID da voz TTS</Label>
                    <Input value={channel.tts_voice_id || ''} onChange={e => update({ tts_voice_id: e.target.value })} placeholder="Ex: pt-BR-Neural2-B" />
                  </div>
                  <div>
                    <Label>Estilo da voz</Label>
                    <Select value={channel.tts_voice_style || 'neutral'} onValueChange={v => update({ tts_voice_style: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VOICE_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Estilo visual (prompt para Veo3/imagens)</Label>
                  <Textarea value={channel.visual_style_prompt || ''} onChange={e => update({ visual_style_prompt: e.target.value })} rows={2} placeholder="cinematic, dark moody lighting, 16:9, hyperrealistic..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SCHEDULE */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Janela de publicação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Dias preferidos para postar</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DAYS.map(d => {
                      const on = (channel.posting_days || []).includes(d.id);
                      return (
                        <button
                          key={d.id}
                          onClick={() => toggleDay(d.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-secondary'
                          }`}
                        >{d.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Hora de postagem (UTC)</Label>
                    <Input type="number" min={0} max={23} value={channel.posting_hour ?? 18} onChange={e => update({ posting_hour: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Intervalo mínimo (horas)</Label>
                    <Input type="number" min={1} value={channel.min_interval_hours ?? 48} onChange={e => update({ min_interval_hours: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label>Meta semanal de vídeos</Label>
                    <Input type="number" min={1} max={14} value={channel.weekly_video_target ?? 3} onChange={e => update({ weekly_video_target: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                {channel.next_slot_at && (
                  <div className="text-xs text-muted-foreground border border-border rounded-lg p-3 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Próximo slot sugerido: <strong className="text-foreground">{new Date(channel.next_slot_at).toLocaleString('pt-BR')}</strong>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Tópicos preferidos / evitados</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Tópicos preferidos (separados por vírgula)</Label>
                  <Input value={(channel.top_topics || []).join(', ')} onChange={e => update({ top_topics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <Label>Tópicos a evitar</Label>
                  <Input value={(channel.avoided_topics || []).join(', ')} onChange={e => update({ avoided_topics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
                <div>
                  <Label>Canais de referência (handles ou IDs, separados por vírgula)</Label>
                  <Input value={(channel.reference_channels || []).join(', ')} onChange={e => update({ reference_channels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUTOPILOT */}
          <TabsContent value="autopilot" className="space-y-4 mt-4">
            <Card className={channel.autopilot_enabled ? 'border-primary/40' : ''}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> AutoPilot 100% automático</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Ativar produção automática para este canal</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quando ativado, o sistema agenda automaticamente novos vídeos respeitando os dias e horários configurados.
                      Cada projeto novo deste canal vai direto ao /autopilot sem intervenção.
                    </p>
                  </div>
                  <Switch
                    checked={!!channel.autopilot_enabled}
                    onCheckedChange={(v) => update({ autopilot_enabled: v })}
                  />
                </div>

                <div className="border border-border rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-muted-foreground" /> Última postagem: <strong>{channel.last_posted_at ? new Date(channel.last_posted_at).toLocaleString('pt-BR') : '—'}</strong></div>
                  <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-muted-foreground" /> Próximo slot: <strong>{channel.next_slot_at ? new Date(channel.next_slot_at).toLocaleString('pt-BR') : '—'}</strong></div>
                  <div className="flex items-center gap-2"><TrendingUp className="w-3 h-3 text-muted-foreground" /> Total postado: <strong>{channel.total_videos_posted ?? 0}</strong></div>
                </div>

                <Link to="/autopilot">
                  <Button variant="outline" size="sm" className="w-full gap-2"><Zap className="w-4 h-4" /> Abrir painel AutoPilot</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTELLIGENCE */}
          <TabsContent value="intel" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Inteligência do Canal</CardTitle>
                  <Button size="sm" variant="outline" onClick={triggerSync} disabled={syncing}>
                    {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Re-analisar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!intel ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Sem análise ainda. Clique em "Re-analisar" para sincronizar dados do YouTube.
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-3 gap-3">
                      <MetricCard icon={<TrendingUp className="w-3 h-3" />} label="Média de views" value={formatNumber(intel.avg_views_all_time || 0)} />
                      <MetricCard icon={<Target className="w-3 h-3" />} label="CTR médio" value={`${intel.avg_ctr_all_time || 0}%`} />
                      <MetricCard icon={<Trophy className="w-3 h-3" />} label="Melhor vídeo" value={formatNumber(intel.best_video_views || 0)} />
                    </div>

                    {intel.top_performing_topics?.length > 0 && (
                      <Section icon={<Trophy className="w-4 h-4 text-emerald-500" />} title="Tópicos que mais performam">
                        <div className="flex flex-wrap gap-1.5">
                          {intel.top_performing_topics.map((t: string, i: number) => (
                            <Badge key={i} className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{t}</Badge>
                          ))}
                        </div>
                      </Section>
                    )}

                    {intel.low_performing_topics?.length > 0 && (
                      <Section icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} title="Tópicos a evitar">
                        <div className="flex flex-wrap gap-1.5">
                          {intel.low_performing_topics.map((t: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-amber-400 border-amber-500/30">{t}</Badge>
                          ))}
                        </div>
                      </Section>
                    )}

                    {intel.best_posting_days?.length > 0 && (
                      <Section icon={<Calendar className="w-4 h-4 text-primary" />} title="Melhores dias de postagem">
                        <div className="flex flex-wrap gap-1.5">
                          {intel.best_posting_days.map((d: string, i: number) => (
                            <Badge key={i} className="bg-primary/15 text-primary">{d}</Badge>
                          ))}
                        </div>
                      </Section>
                    )}

                    {intel.best_posting_hours?.length > 0 && (
                      <Section icon={<Clock className="w-4 h-4 text-primary" />} title="Melhores horas de postagem (UTC)">
                        <div className="flex flex-wrap gap-1.5">
                          {intel.best_posting_hours.map((h: number, i: number) => (
                            <Badge key={i} className="bg-primary/15 text-primary">{String(h).padStart(2, '0')}:00</Badge>
                          ))}
                        </div>
                      </Section>
                    )}

                    {intel.ai_suggestions && Array.isArray(intel.ai_suggestions) && intel.ai_suggestions.length > 0 && (
                      <Section icon={<Lightbulb className="w-4 h-4 text-amber-400" />} title="Sugestões da IA">
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {intel.ai_suggestions.map((s: any, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{typeof s === 'string' ? s : JSON.stringify(s)}</span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    {intel.last_analyzed_at && (
                      <p className="text-xs text-muted-foreground text-right">
                        Última análise: {new Date(intel.last_analyzed_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const MetricCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="border border-border rounded-lg p-3">
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">{icon}{label}</div>
    <div className="text-lg font-bold font-display">{value}</div>
  </div>
);

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
    {children}
  </div>
);

export default ChannelSettings;
