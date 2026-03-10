import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Sparkles, Copy, Loader2, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface TitleSuggestion {
  title: string;
  style: string;
  estimatedCTR: number;
}

const STYLE_COLORS: Record<string, string> = {
  curiosidade: 'bg-primary/20 text-primary',
  urgência: 'bg-destructive/20 text-destructive',
  números: 'bg-accent/20 text-accent',
  contraintuitivo: 'bg-yellow-500/20 text-yellow-400',
  storytelling: 'bg-emerald-500/20 text-emerald-400',
  polêmica: 'bg-pink-500/20 text-pink-400',
};

const Titles = () => {
  const [niche, setNiche] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [titles, setTitles] = useState<TitleSuggestion[]>([]);

  const generateTitles = async () => {
    if (!niche.trim() && !topic.trim()) return toast.error('Preencha nicho ou tema');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { niche, topic },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setTitles(data?.titles || []);
      if (!data?.titles?.length) toast.info('Nenhum título gerado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar títulos');
    } finally {
      setLoading(false);
    }
  };

  const copyTitle = (title: string) => {
    navigator.clipboard.writeText(title);
    toast.success('Título copiado!');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Gerador de Títulos Virais</h1>
            <p className="text-sm text-muted-foreground">Títulos otimizados para CTR usando metodologia viral</p>
          </div>
        </div>

        <div className="glass rounded-xl p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nicho</label>
              <Input placeholder="Ex: finanças, gaming, horror..." value={niche}
                onChange={e => setNiche(e.target.value)} className="bg-secondary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tema específico (opcional)</label>
              <Input placeholder="Ex: como ganhar dinheiro dormindo" value={topic}
                onChange={e => setTopic(e.target.value)} className="bg-secondary/50"
                onKeyDown={e => e.key === 'Enter' && generateTitles()} />
            </div>
          </div>
          <Button onClick={generateTitles} disabled={loading} className="gradient-hero border-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Gerando 20 títulos...' : 'Gerar Títulos Virais'}
          </Button>
        </div>

        {titles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> {titles.length} Títulos Gerados
              </h2>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(titles.map(t => t.title).join('\n'));
                toast.success('Todos copiados!');
              }}>
                <Copy className="w-3 h-3 mr-1" /> Copiar Todos
              </Button>
            </div>
            <div className="grid gap-2">
              {titles.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-lg p-4 flex items-center gap-3 group hover:border-primary/30 transition-all">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[10px] ${STYLE_COLORS[t.style] || 'bg-secondary text-secondary-foreground'}`}>
                        {t.style}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">CTR estimado: {t.estimatedCTR}%</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyTitle(t.title)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Copy className="w-3 h-3" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {titles.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Digite um nicho e/ou tema para gerar 20 títulos virais</p>
            <p className="text-xs mt-1">Estilos: curiosidade, urgência, números, contraintuitivo, storytelling</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Titles;
