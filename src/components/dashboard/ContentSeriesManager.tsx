import { useState, useEffect } from 'react';
import { Plus, Loader2, Play, Pause, Trash2, Repeat, Film, Zap, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const VISUAL_STYLES = [
  { value: 'cinematográfico', label: '🎬 Cinematic Dark' },
  { value: '2d', label: '🎨 Kurzgesagt Style' },
  { value: 'anime', label: '⛩️ Anime Epic' },
  { value: 'dark', label: '🌑 Cyberpunk Neon' },
  { value: 'comic', label: '💥 Comic Book' },
  { value: 'lego', label: '🧱 Lego World' },
  { value: 'disney_toon', label: '✨ Disney Toon' },
  { value: 'documentary_bbc', label: '📹 Documentary BBC' },
];

const CONTENT_STYLES = [
  { value: 'dopaminérgico', label: '🧠 Dopaminérgico' },
  { value: 'storytelling', label: '📖 Storytelling' },
  { value: 'listicle', label: '📋 Listicle' },
  { value: 'reddit', label: '🗣️ Reddit Stories' },
  { value: 'documentário', label: '📹 Documentário' },
  { value: 'narração', label: '🎙️ Narração' },
];

const FREQ_OPTIONS = [
  { value: 'daily', label: '📅 Diário', desc: '7 vídeos/semana' },
  { value: '3x_week', label: '📆 3x/semana', desc: '3 vídeos/semana' },
  { value: 'weekly', label: '🗓️ Semanal', desc: '1 vídeo/semana' },
];

interface ContentSeries {
  id: string;
  series_name: string;
  niche: string;
  sub_niche: string | null;
  video_format: string;
  visual_style: string;
  content_style: string;
  frequency: string;
  total_generated: number;
  total_published: number;
  status: string;
  channel_id: string | null;
  custom_prompt: string | null;
  created_at: string;
}

export const ContentSeriesManager = () => {
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const navigate = useNavigate();

  // Form state
  const [form, setForm] = useState({
    series_name: '',
    niche: '',
    sub_niche: '',
    video_format: 'short',
    visual_style: 'cinematográfico',
    content_style: 'dopaminérgico',
    frequency: 'daily',
    channel_id: '',
    custom_prompt: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const [seriesRes, channelsRes] = await Promise.all([
      supabase.from('content_series').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('user_channels').select('id, channel_name, niche').eq('user_id', session.user.id),
    ]);

    setSeries((seriesRes.data as any[]) || []);
    setChannels(channelsRes.data || []);
    setLoading(false);
  };

  const createSeries = async () => {
    if (!form.series_name || !form.niche) {
      toast.error('Nome da série e nicho são obrigatórios');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('content_series').insert({
      user_id: session.user.id,
      series_name: form.series_name,
      niche: form.niche,
      sub_niche: form.sub_niche || null,
      video_format: form.video_format,
      visual_style: form.visual_style,
      content_style: form.content_style,
      frequency: form.frequency,
      channel_id: form.channel_id || null,
      custom_prompt: form.custom_prompt || null,
    } as any);

    if (error) {
      toast.error('Erro ao criar série');
      return;
    }

    toast.success('🎬 Série criada! Agora você pode gerar vídeos automaticamente.');
    setCreating(false);
    setForm({ series_name: '', niche: '', sub_niche: '', video_format: 'short', visual_style: 'cinematográfico', content_style: 'dopaminérgico', frequency: 'daily', channel_id: '', custom_prompt: '' });
    loadData();
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === 'active' ? 'paused' : 'active';
    await supabase.from('content_series').update({ status: newStatus } as any).eq('id', id);
    toast.success(newStatus === 'active' ? '▶️ Série ativada' : '⏸️ Série pausada');
    loadData();
  };

  const deleteSeries = async (id: string) => {
    await supabase.from('content_series').delete().eq('id', id);
    toast.success('Série removida');
    loadData();
  };

  const generateFromSeries = (s: ContentSeries) => {
    navigate(`/scripts?niche=${s.niche}&style=${s.content_style}&type=${s.video_format === 'short' ? 'short' : 'long'}`);
  };

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">🔄 Séries de Conteúdo</h3>
          <p className="text-xs text-muted-foreground">Crie séries recorrentes — mesmo nicho, mesmo estilo, IA gera vídeo novo</p>
        </div>
        <Button size="sm" onClick={() => setCreating(!creating)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Nova Série
        </Button>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
          <h4 className="font-semibold text-sm text-foreground">Criar Nova Série</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Nome da série (ex: Fatos Insanos)" value={form.series_name} onChange={e => setForm(f => ({ ...f, series_name: e.target.value }))} className="text-sm" />
            <Input placeholder="Nicho (ex: curiosidades)" value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} className="text-sm" />
          </div>

          <Input placeholder="Sub-nicho (opcional)" value={form.sub_niche} onChange={e => setForm(f => ({ ...f, sub_niche: e.target.value }))} className="text-sm" />

          {/* Channel */}
          {channels.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Canal</label>
              <div className="flex flex-wrap gap-1.5">
                {channels.map(ch => (
                  <Button key={ch.id} size="sm" variant={form.channel_id === ch.id ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setForm(f => ({ ...f, channel_id: ch.id, niche: ch.niche || f.niche }))}>
                    {ch.channel_name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Format */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Formato</label>
            <div className="flex gap-2">
              {[{ v: 'short', l: '⚡ Shorts' }, { v: 'long', l: '🎬 Longform' }, { v: 'both', l: '🔥 Ambos' }].map(o => (
                <Button key={o.v} size="sm" variant={form.video_format === o.v ? 'default' : 'outline'} className="text-xs" onClick={() => setForm(f => ({ ...f, video_format: o.v }))}>{o.l}</Button>
              ))}
            </div>
          </div>

          {/* Visual + Content Style */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estilo Visual</label>
              <div className="flex flex-wrap gap-1">
                {VISUAL_STYLES.map(s => (
                  <Button key={s.value} size="sm" variant={form.visual_style === s.value ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setForm(f => ({ ...f, visual_style: s.value }))}>{s.label}</Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Estilo de Conteúdo</label>
              <div className="flex flex-wrap gap-1">
                {CONTENT_STYLES.map(s => (
                  <Button key={s.value} size="sm" variant={form.content_style === s.value ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setForm(f => ({ ...f, content_style: s.value }))}>{s.label}</Button>
                ))}
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Frequência</label>
            <div className="flex gap-2">
              {FREQ_OPTIONS.map(f => (
                <Button key={f.value} size="sm" variant={form.frequency === f.value ? 'default' : 'outline'} className="text-xs flex-1" onClick={() => setForm(fm => ({ ...fm, frequency: f.value }))}>
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <Input placeholder="Prompt customizado (opcional): ex: sempre inclua plot twists, use tom sarcástico..." value={form.custom_prompt} onChange={e => setForm(f => ({ ...f, custom_prompt: e.target.value }))} className="text-sm" />

          <div className="flex gap-2">
            <Button onClick={createSeries} className="flex-1 gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Criar Série
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Series List */}
      {series.length === 0 && !creating ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-xl">
          <Repeat className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma série criada ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Crie uma série para gerar conteúdo recorrente automaticamente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {series.map(s => (
            <div key={s.id} className={`border rounded-xl p-4 space-y-2 transition-colors ${s.status === 'active' ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-card'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{s.series_name}</h4>
                  <p className="text-[10px] text-muted-foreground">{s.niche}{s.sub_niche ? ` → ${s.sub_niche}` : ''}</p>
                </div>
                <Badge className={s.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}>
                  {s.status === 'active' ? '▶️ Ativa' : '⏸️ Pausada'}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[9px]">{s.video_format === 'short' ? '⚡ Shorts' : s.video_format === 'long' ? '🎬 Long' : '🔥 Ambos'}</Badge>
                <Badge variant="outline" className="text-[9px]">{VISUAL_STYLES.find(v => v.value === s.visual_style)?.label || s.visual_style}</Badge>
                <Badge variant="outline" className="text-[9px]">{CONTENT_STYLES.find(c => c.value === s.content_style)?.label || s.content_style}</Badge>
                <Badge variant="outline" className="text-[9px]">{FREQ_OPTIONS.find(f => f.value === s.frequency)?.label || s.frequency}</Badge>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>📹 {s.total_generated} gerados</span>
                <span>📤 {s.total_published} publicados</span>
              </div>

              <div className="flex gap-1.5 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1 gap-1" onClick={() => generateFromSeries(s)}>
                  <ArrowRight className="w-3 h-3" /> Produzir
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => toggleStatus(s.id, s.status)}>
                  {s.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteSeries(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
