import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, Mic, FileText, Loader2, Save, CheckCircle2, Volume2, User, Palette, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Channel {
  id: string;
  channel_name: string;
  niche: string | null;
  language: string | null;
  character_name: string | null;
  character_bio: string | null;
  tts_voice_id: string | null;
  tts_voice_style: string | null;
  visual_style_prompt: string | null;
}

const DURATIONS = [
  { value: 60, label: '1 min (Short)' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
];

const ChannelStudio = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(300);
  const [script, setScript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_channels')
        .select('id, channel_name, niche, language, character_name, character_bio, tts_voice_id, tts_voice_style, visual_style_prompt')
        .eq('user_id', user.id)
        .order('linked_at', { ascending: false });
      setChannels((data || []) as any);
      if (data?.length) setSelectedId(data[0].id);
    })();
  }, []);

  const channel = channels.find(c => c.id === selectedId);

  const generateScript = async () => {
    if (!channel) { toast.error('Selecione um canal'); return; }
    if (!topic.trim()) { toast.error('Digite o tópico do vídeo'); return; }
    setLoadingScript(true);
    setScript('');
    try {
      const personaInstruction = channel.character_name || channel.character_bio
        ? `\n\nPERSONA OBRIGATÓRIA:\n- Nome do narrador: ${channel.character_name || 'Narrador'}\n- Bio/estilo: ${channel.character_bio || 'tom natural'}\n- O roteiro deve soar como esse personagem falando, mantendo voz consistente.`
        : '';

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          topic,
          niche: channel.niche || undefined,
          duration_seconds: duration,
          language: channel.language || 'pt-BR',
          channel_id: channel.id,
          character_name: channel.character_name,
          character_bio: channel.character_bio,
          custom_instructions: personaInstruction,
        },
      });
      if (error) throw error;
      const text = (data as any)?.script || (data as any)?.content || '';
      if (!text) throw new Error('Nenhum roteiro retornado');
      setScript(text);
      toast.success('Roteiro gerado seguindo a persona do canal');
    } catch (e: any) {
      toast.error('Erro ao gerar roteiro: ' + (e?.message || 'erro'));
    } finally {
      setLoadingScript(false);
    }
  };

  const generateAudio = async () => {
    if (!channel) { toast.error('Selecione um canal'); return; }
    if (!script.trim()) { toast.error('Gere ou cole um roteiro primeiro'); return; }
    if (!channel.tts_voice_id) {
      toast.error('Configure o TTS Voice ID em DNA do canal');
      return;
    }
    setLoadingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: script.slice(0, 4500), // safety cap
          voiceId: channel.tts_voice_id,
          voiceStyle: channel.tts_voice_style || 'neutral',
        },
      });
      if (error) throw error;
      const url = (data as any)?.audio_url || (data as any)?.url;
      const base64 = (data as any)?.audioContent || (data as any)?.audio;
      const finalUrl = url || (base64 ? `data:audio/mpeg;base64,${base64}` : '');
      if (!finalUrl) throw new Error('Resposta TTS sem áudio');
      setAudioUrl(finalUrl);
      toast.success('Narração gerada com voz do canal');
    } catch (e: any) {
      toast.error('Erro ao gerar narração: ' + (e?.message || 'erro'));
    } finally {
      setLoadingAudio(false);
    }
  };

  const saveProject = async () => {
    if (!channel || !script) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Login required');

      const payload: any = {
        user_id: user.id,
        title: topic || `${channel.channel_name} — vídeo`,
        script,
        niche: channel.niche,
        duration_seconds: duration,
        channel_id_ref: channel.id,
        audio_url: audioUrl || null,
        intelligence_json: {
          character_name: channel.character_name,
          character_bio: channel.character_bio,
          tts_voice_id: channel.tts_voice_id,
          tts_voice_style: channel.tts_voice_style,
          visual_style_prompt: channel.visual_style_prompt,
        },
        status: audioUrl ? 'ready_for_production' : 'draft',
      };

      if (projectId) {
        const { error } = await supabase.from('video_projects').update(payload).eq('id', projectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('video_projects')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setProjectId(data.id);
      }
      toast.success('Projeto salvo no canal!');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e?.message || 'erro'));
    } finally {
      setSaving(false);
    }
  };

  const sendToAutoPilot = async () => {
    await saveProject();
    setTimeout(() => navigate('/autopilot'), 600);
  };

  const dnaComplete = !!channel?.character_name && !!channel?.tts_voice_id;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Channel Studio</h1>
            <p className="text-sm text-muted-foreground">
              Gere roteiro + narração já no DNA do seu canal
            </p>
          </div>
        </div>

        {channels.length === 0 && (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            Você não tem canais conectados ainda. Vá em <strong>Meus Canais</strong>.
          </CardContent></Card>
        )}

        {/* Step 1: Channel & inputs */}
        {channels.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
                Canal e tópico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setScript(''); setAudioUrl(''); setProjectId(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channels.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.channel_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duração</Label>
                  <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Tópico do vídeo</Label>
                <Input
                  placeholder="Ex.: 5 hábitos que separam ricos de pobres"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                />
              </div>

              {/* DNA preview */}
              {channel && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DNA do canal aplicado</p>
                    {!dnaComplete && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Configure persona+voz
                      </Badge>
                    )}
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 text-xs">
                    <DNAItem icon={<User className="w-3 h-3" />} label="Persona" value={channel.character_name || '—'} />
                    <DNAItem icon={<Volume2 className="w-3 h-3" />} label="Voz" value={`${channel.tts_voice_id ? channel.tts_voice_id.slice(0, 12) + '…' : '—'} • ${channel.tts_voice_style || 'neutral'}`} />
                    <DNAItem icon={<Palette className="w-3 h-3" />} label="Visual" value={channel.visual_style_prompt ? channel.visual_style_prompt.slice(0, 40) + '…' : '—'} />
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Script */}
        {channels.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
                Roteiro
                {script && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </CardTitle>
              <Button onClick={generateScript} disabled={loadingScript || !topic} size="sm">
                {loadingScript ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Gerar roteiro com IA
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="O roteiro gerado aparecerá aqui — você pode editar antes de gerar a narração."
                rows={14}
                className="font-mono text-xs leading-relaxed"
              />
              {script && <p className="text-[11px] text-muted-foreground mt-2">{script.length} caracteres • ~{Math.ceil(script.split(/\s+/).length / 150)} min de leitura</p>}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Audio */}
        {channels.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">3</span>
                Narração
                {audioUrl && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </CardTitle>
              <Button onClick={generateAudio} disabled={loadingAudio || !script || !channel?.tts_voice_id} size="sm" variant="secondary">
                {loadingAudio ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mic className="w-4 h-4 mr-2" />}
                Gerar narração
              </Button>
            </CardHeader>
            <CardContent>
              {audioUrl ? (
                <audio controls src={audioUrl} className="w-full" />
              ) : (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  {channel?.tts_voice_id ? 'Clique em Gerar narração para criar o áudio com a voz do canal.' : 'Configure o TTS Voice ID na aba DNA do canal antes de gerar áudio.'}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Save */}
        {channels.length > 0 && script && (
          <div className="flex items-center justify-end gap-3 sticky bottom-4">
            <Button onClick={saveProject} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar no canal
            </Button>
            <Button onClick={sendToAutoPilot} disabled={saving || !audioUrl} className="gradient-hero text-primary-foreground">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar e mandar p/ AutoPilot
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const DNAItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <div className="text-primary mt-0.5">{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="text-xs text-foreground/90 truncate">{value}</p>
    </div>
  </div>
);

export default ChannelStudio;
