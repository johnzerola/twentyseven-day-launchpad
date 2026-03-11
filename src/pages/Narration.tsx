import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Mic, Play, Pause, Download, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { VOICES } from '@/lib/constants';

const Narration = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const estimatedCost = Math.ceil(text.length / 1000) * 0.03;

  const generateNarration = async () => {
    if (!text.trim()) return toast.error('Digite o texto para narrar');
    if (text.length > 5000) return toast.error('Máximo 5000 caracteres por vez');
    setLoading(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: { text, voiceId: voice },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.audioBase64) {
        // Upload to storage bucket instead of keeping base64 in memory
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const fileName = `audio/${user.id}/narration-${Date.now()}.mp3`;
          const binaryStr = atob(data.audioBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          
          const { error: uploadError } = await supabase.storage.from('media').upload(fileName, blob, {
            contentType: 'audio/mpeg', upsert: false,
          });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
            setAudioUrl(urlData.publicUrl);
            toast.success('Narração gerada e salva!');
            return;
          }
        }
        // Fallback to base64 if upload fails
        const url = `data:audio/mpeg;base64,${data.audioBase64}`;
        setAudioUrl(url);
        toast.success('Narração gerada com sucesso!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar narração');
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'narracao.mp3';
    a.click();
  };

  const selectedVoice = VOICES.find(v => v.id === voice);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Narração IA</h1>
            <p className="text-sm text-muted-foreground">Gere narração com vozes neurais ElevenLabs</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="glass rounded-xl p-6 space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole seu texto ou roteiro aqui... (máx. 5000 caracteres)"
                className="bg-secondary/50 min-h-[300px]"
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{text.length}/5000 caracteres</span>
                  <span>~${estimatedCost.toFixed(2)} estimado</span>
                </div>
                <Button onClick={generateNarration} disabled={loading || !text.trim()} className="gradient-hero border-0 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  {loading ? 'Gerando...' : 'Gerar Narração'}
                </Button>
              </div>
            </div>

            {/* Audio Player */}
            {audioUrl && (
              <div className="glass rounded-xl p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Áudio Gerado
                </h3>
                <audio ref={audioRef} src={audioUrl}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)} />
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" onClick={togglePlay} className="h-12 w-12 rounded-full">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <div className="flex-1">
                    <div className="flex gap-0.5 items-end h-8">
                      {Array.from({ length: 40 }, (_, i) => (
                        <div key={i} className="flex-1 bg-emerald-400/60 rounded-full transition-all"
                          style={{ height: `${Math.random() * 100}%`, opacity: isPlaying ? 1 : 0.4 }} />
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" onClick={downloadAudio} className="gap-2">
                    <Download className="w-4 h-4" /> MP3
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{selectedVoice?.name} ({selectedVoice?.lang})</Badge>
                  <Badge variant="secondary">{text.length} caracteres</Badge>
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Voz Neural</h3>
            <div className="space-y-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${
                    voice === v.id ? 'bg-primary/20 border border-primary/30' : 'bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs text-primary-foreground font-bold">
                    {v.name[0]}
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.lang} • {v.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Vozes neurais ElevenLabs com multilingual v2.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Narration;
