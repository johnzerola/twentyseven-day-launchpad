import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { FileText, Sparkles, Copy, Check, Save, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

const Scripts = () => {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('15');
  const [style, setStyle] = useState('narração');
  const [niche, setNiche] = useState('');
  const [language, setLanguage] = useState('português');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedScripts, setSavedScripts] = useState<any[]>([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('saved_scripts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20) as any;
    setSavedScripts(data || []);
  };

  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setScript('');

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ topic, duration: parseInt(duration), style, niche, language }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar roteiro');
      }

      // Stream the response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullScript = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullScript += content;
              setScript(fullScript);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar roteiro');
    } finally {
      setLoading(false);
    }
  };

  const saveScript = async () => {
    if (!script) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Faça login para salvar'); return; }
    await supabase.from('saved_scripts').insert({
      user_id: user.id,
      topic,
      duration: parseInt(duration),
      style,
      script_content: script,
    } as any);
    toast.success('Roteiro salvo!');
    loadHistory();
  };

  const deleteScript = async (id: string) => {
    await supabase.from('saved_scripts').delete().eq('id', id);
    toast.success('Roteiro removido');
    loadHistory();
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Roteiro copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
  const estimatedMinutes = Math.round(wordCount / 140);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">{t('dash.scripts')}</h1>
              <p className="text-sm text-muted-foreground">Roteiros de alta retenção com IA</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="gap-2">
            <History className="w-4 h-4" /> Histórico ({savedScripts.length})
          </Button>
        </div>

        {/* History panel */}
        {showHistory && savedScripts.length > 0 && (
          <div className="glass rounded-xl p-5 space-y-2 max-h-60 overflow-y-auto">
            {savedScripts.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                <button
                  onClick={() => { setScript(s.script_content); setTopic(s.topic); setShowHistory(false); }}
                  className="text-sm text-left flex-1 truncate hover:text-primary transition-colors"
                >
                  {s.topic} ({s.duration}min)
                </button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteScript(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Configurações</h3>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tópico do vídeo *</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Como ganhar dinheiro online" className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Duração (minutos)</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                <option value="5">5 min (~700 palavras)</option>
                <option value="10">10 min (~1.400 palavras)</option>
                <option value="15">15 min (~2.100 palavras)</option>
                <option value="20">20 min (~2.800 palavras)</option>
                <option value="30">30 min (~4.200 palavras)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Estilo</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                <option value="narração">Narração</option>
                <option value="educativo">Educativo</option>
                <option value="storytelling">Storytelling</option>
                <option value="tutorial">Tutorial</option>
                <option value="documentário">Documentário</option>
                <option value="listicle">Listicle (Top 10, etc)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nicho (opcional)</label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: finanças, tecnologia" className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Idioma do roteiro</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm">
                <option value="português">Português</option>
                <option value="inglês">English</option>
                <option value="polonês">Polski</option>
                <option value="alemão">Deutsch</option>
                <option value="espanhol">Español</option>
              </select>
            </div>
            <Button onClick={generateScript} disabled={loading || !topic.trim()} className="w-full gradient-hero border-0 gap-2">
              <Sparkles className="w-4 h-4" />
              {loading ? 'Gerando roteiro...' : 'Gerar Roteiro com IA'}
            </Button>
          </div>

          <div className="lg:col-span-2 glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Roteiro</h3>
                {script && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {wordCount} palavras • {charCount.toLocaleString()} caracteres • ~{estimatedMinutes} min de narração
                  </p>
                )}
              </div>
              {script && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={saveScript} className="gap-1">
                    <Save className="w-3 h-3" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              )}
            </div>
            {script ? (
              <div className="prose prose-sm prose-invert max-w-none text-foreground overflow-y-auto max-h-[600px] pr-2">
                <ReactMarkdown>{script}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Configure e gere seu primeiro roteiro com IA</p>
                <p className="text-xs mt-2">Roteiros completos com hook, microhooks, CTA, títulos e thumbnails</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
