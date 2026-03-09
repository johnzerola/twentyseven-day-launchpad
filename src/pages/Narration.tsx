import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Mic, Play, Download, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const voices = [
  { id: 'roger', name: 'Roger', lang: 'EN' },
  { id: 'sarah', name: 'Sarah', lang: 'EN' },
  { id: 'daniel', name: 'Daniel', lang: 'PT' },
  { id: 'alice', name: 'Alice', lang: 'DE' },
  { id: 'liam', name: 'Liam', lang: 'PL' },
];

const Narration = () => {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('roger');
  const [loading, setLoading] = useState(false);

  const generateNarration = async () => {
    if (!text.trim()) return;
    setLoading(true);
    // Will connect to ElevenLabs via edge function
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Narração IA</h1>
            <p className="text-sm text-muted-foreground">Gere narração com vozes neurais</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-xl p-6 space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole seu texto ou roteiro aqui..."
              className="bg-secondary/50 min-h-[300px]"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{text.length} caracteres</p>
              <Button onClick={generateNarration} disabled={loading || !text.trim()} className="gradient-hero border-0 gap-2">
                <Volume2 className="w-4 h-4" />
                {loading ? 'Gerando...' : 'Gerar Narração'}
              </Button>
            </div>
          </div>

          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Voz</h3>
            <div className="space-y-2">
              {voices.map((v) => (
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
                  <div className="text-left">
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.lang}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Conecte ElevenLabs para ativar vozes neurais em múltiplos idiomas.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Narration;
