import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X, Loader2, Mic, Palette, Calendar as CalIcon, User, Zap } from 'lucide-react';

type Props = {
  channel: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
};

const VOICE_STYLES = [
  { v: 'neutral', l: 'Neutro' },
  { v: 'energetic', l: 'Energético' },
  { v: 'calm', l: 'Calmo' },
  { v: 'professional', l: 'Profissional' },
  { v: 'friendly', l: 'Amigável' },
];

const LANGUAGES = [
  { v: 'pt-BR', l: '🇧🇷 Português (BR)' },
  { v: 'en-US', l: '🇺🇸 English (US)' },
  { v: 'es-ES', l: '🇪🇸 Español (ES)' },
];

const DAYS = [
  { v: 'mon', l: 'Seg' }, { v: 'tue', l: 'Ter' }, { v: 'wed', l: 'Qua' },
  { v: 'thu', l: 'Qui' }, { v: 'fri', l: 'Sex' }, { v: 'sat', l: 'Sab' }, { v: 'sun', l: 'Dom' },
];

export const ChannelDNAModal = ({ channel, open, onOpenChange, onSaved }: Props) => {
  const [saving, setSaving] = useState(false);
  const [refInput, setRefInput] = useState('');

  // form state
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (channel) {
      setForm({
        character_name: channel.character_name || '',
        character_bio: channel.character_bio || '',
        language: channel.language || 'pt-BR',
        niche: channel.niche || '',
        tts_voice_id: channel.tts_voice_id || '',
        tts_voice_style: channel.tts_voice_style || 'neutral',
        visual_style_prompt: channel.visual_style_prompt || '',
        reference_channels: Array.isArray(channel.reference_channels) ? channel.reference_channels : [],
        autopilot_enabled: !!channel.autopilot_enabled,
        weekly_video_target: channel.weekly_video_target || 1,
        min_interval_hours: channel.min_interval_hours || 48,
        posting_hour: channel.posting_hour ?? 18,
        posting_days: Array.isArray(channel.posting_days) ? channel.posting_days : ['mon', 'wed', 'fri'],
      });
    }
  }, [channel]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const addRef = () => {
    const v = refInput.trim();
    if (!v) return;
    if (form.reference_channels.length >= 5) { toast.error('Máximo 5 canais'); return; }
    if (form.reference_channels.includes(v)) { toast.error('Já adicionado'); return; }
    set('reference_channels', [...form.reference_channels, v]);
    setRefInput('');
  };

  const removeRef = (v: string) => {
    set('reference_channels', form.reference_channels.filter((x: string) => x !== v));
  };

  const toggleDay = (d: string) => {
    const list = form.posting_days.includes(d)
      ? form.posting_days.filter((x: string) => x !== d)
      : [...form.posting_days, d];
    set('posting_days', list);
  };

  const handleSave = async () => {
    if (!channel?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_channels' as any)
      .update(form as any)
      .eq('id', channel.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('🧬 DNA do canal salvo');
      onOpenChange(false);
      onSaved?.();
    }
  };

  if (!channel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            🧬 DNA do Canal — <span className="text-primary">{channel.channel_name}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="identity" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="identity" className="gap-1"><User className="w-3.5 h-3.5" />Identidade</TabsTrigger>
            <TabsTrigger value="voice" className="gap-1"><Mic className="w-3.5 h-3.5" />Voz</TabsTrigger>
            <TabsTrigger value="visual" className="gap-1"><Palette className="w-3.5 h-3.5" />Visual</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1"><CalIcon className="w-3.5 h-3.5" />Agenda</TabsTrigger>
          </TabsList>

          {/* IDENTITY */}
          <TabsContent value="identity" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Nome do personagem / narrador</Label>
              <Input value={form.character_name} onChange={e => set('character_name', e.target.value)} placeholder="Ex: Carlos, o Mestre das Finanças" />
            </div>
            <div className="space-y-1.5">
              <Label>Biografia / personalidade</Label>
              <Textarea rows={3} value={form.character_bio} onChange={e => set('character_bio', e.target.value)} placeholder="Ex: Especialista em finanças, tom didático, usa analogias do dia a dia." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={form.language} onValueChange={v => set('language', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nicho</Label>
                <Input value={form.niche} onChange={e => set('niche', e.target.value)} placeholder="Ex: finanças, mistério..." />
              </div>
            </div>
          </TabsContent>

          {/* VOICE */}
          <TabsContent value="voice" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>ID da voz TTS</Label>
              <Input value={form.tts_voice_id} onChange={e => set('tts_voice_id', e.target.value)} placeholder="Ex: pt-BR-Wavenet-B (Google TTS)" />
              <p className="text-[10px] text-muted-foreground">Use vozes do Google TTS. Deixe vazio para usar a voz padrão do sistema.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Estilo de entrega</Label>
              <Select value={form.tts_voice_style} onValueChange={v => set('tts_voice_style', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICE_STYLES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* VISUAL */}
          <TabsContent value="visual" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label>Prompt de estilo visual</Label>
              <Textarea
                rows={5}
                value={form.visual_style_prompt}
                onChange={e => set('visual_style_prompt', e.target.value)}
                placeholder="Cinematic, high contrast, warm tones, soft natural lighting, shallow depth of field..."
              />
              <p className="text-[10px] text-muted-foreground">Esse prompt é injetado em todas as gerações de cena.</p>
            </div>
            <div className="space-y-2">
              <Label>Canais de referência (até 5)</Label>
              <div className="flex gap-2">
                <Input
                  value={refInput}
                  onChange={e => setRefInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRef())}
                  placeholder="UC... (channel ID do YouTube)"
                />
                <Button type="button" variant="outline" size="sm" onClick={addRef} disabled={form.reference_channels?.length >= 5}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.reference_channels?.map((c: string) => (
                  <Badge key={c} variant="secondary" className="gap-1 font-mono text-[10px]">
                    {c}
                    <button onClick={() => removeRef(c)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {(!form.reference_channels || form.reference_channels.length === 0) && (
                  <span className="text-[10px] text-muted-foreground">Nenhum canal de referência</span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* SCHEDULE */}
          <TabsContent value="schedule" className="space-y-5 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-secondary/30">
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${form.autopilot_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-semibold">AutoPilot</p>
                  <p className="text-[10px] text-muted-foreground">Quando ativo, o sistema agenda e produz vídeos sozinho</p>
                </div>
              </div>
              <Switch checked={form.autopilot_enabled} onCheckedChange={v => set('autopilot_enabled', v)} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Vídeos por semana</Label>
                <Select value={String(form.weekly_video_target)} onValueChange={v => set('weekly_video_target', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Intervalo mínimo</Label>
                <Select value={String(form.min_interval_hours)} onValueChange={v => set('min_interval_hours', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24h</SelectItem>
                    <SelectItem value="48">48h</SelectItem>
                    <SelectItem value="72">72h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hora de postagem</Label>
                <Select value={String(form.posting_hour)} onValueChange={v => set('posting_hour', Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias de postagem</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => {
                  const active = form.posting_days?.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleDay(d.v)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary'
                      }`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-hero border-0">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Salvar DNA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
