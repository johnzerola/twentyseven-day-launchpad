import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useLanguage } from '@/i18n/LanguageContext';
import { FileText, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const Scripts = () => {
  const { t } = useLanguage();
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('10');
  const [style, setStyle] = useState('narração');
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    // Placeholder - will connect to Lovable AI
    setTimeout(() => {
      setScript(`# ${topic}

## 🎣 Hook (0:00 - 0:30)
"Você sabia que ${topic.toLowerCase()} pode mudar completamente sua vida? Nos próximos ${duration} minutos, vou te mostrar exatamente como..."

## 📖 Desenvolvimento (0:30 - ${parseInt(duration) - 2}:00)

### Parte 1: O Problema
Muitas pessoas não sabem que ${topic.toLowerCase()} é essencial. Vamos explorar por quê...

[Continue expandindo o conteúdo aqui com dados, exemplos e histórias]

### Parte 2: A Solução
Agora que você entende o problema, veja como resolver...

[Detalhe as soluções com passos práticos]

### Parte 3: Resultado
Quem aplicou isso obteve resultados incríveis...

[Mostre provas sociais e casos de sucesso]

## 🎯 CTA (${parseInt(duration) - 2}:00 - ${duration}:00)
"Se esse vídeo te ajudou, deixa o like e se inscreve no canal. Comenta aqui embaixo qual parte foi mais útil pra você!"

---

**📌 Sugestões de Título (CTR 30%+):**
1. "${topic} — O Que NINGUÉM Te Conta"
2. "Como ${topic} Mudou Minha Vida em 7 Dias"
3. "${topic}: O Guia DEFINITIVO (${new Date().getFullYear()})"

**🖼️ Ideias de Thumbnail:**
- Rosto surpreso + texto bold "${topic}"
- Antes/depois com seta
- Números grandes + emojis
`);
      setLoading(false);
    }, 2000);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Roteiro copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">{t('dash.scripts')}</h1>
            <p className="text-sm text-muted-foreground">Gere roteiros otimizados para retenção</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <h3 className="font-semibold">Configurações</h3>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tópico do vídeo</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Como ganhar dinheiro online" className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Duração (minutos)</label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Estilo</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm"
              >
                <option value="narração">Narração</option>
                <option value="educativo">Educativo</option>
                <option value="storytelling">Storytelling</option>
                <option value="tutorial">Tutorial</option>
              </select>
            </div>
            <Button onClick={generateScript} disabled={loading || !topic.trim()} className="w-full gradient-hero border-0 gap-2">
              <Sparkles className="w-4 h-4" />
              {loading ? 'Gerando...' : 'Gerar Roteiro'}
            </Button>
          </div>

          <div className="lg:col-span-2 glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Roteiro</h3>
              {script && (
                <Button size="sm" variant="ghost" onClick={copyScript} className="gap-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              )}
            </div>
            {script ? (
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
                {script}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Configure e gere seu primeiro roteiro</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
