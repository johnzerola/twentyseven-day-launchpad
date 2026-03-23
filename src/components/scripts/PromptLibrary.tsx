import { useState, useEffect } from 'react';
import { BookOpen, Search, Copy, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PromptItem {
  id: string;
  prompt_text: string;
  style: string | null;
  tags: string[] | null;
  scene_type: string | null;
  word_count: number | null;
  quality_score: number | null;
  video_style: string | null;
  created_at: string;
}

export const PromptLibrary = () => {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('prompt_library')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setPrompts((data as PromptItem[]) || []);
    setLoading(false);
  };

  const deletePrompt = async (id: string) => {
    await supabase.from('prompt_library').delete().eq('id', id);
    setPrompts(prev => prev.filter(p => p.id !== id));
    toast.success('Prompt removido');
  };

  const filtered = prompts.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.prompt_text.toLowerCase().includes(s) ||
      p.style?.toLowerCase().includes(s) ||
      p.video_style?.toLowerCase().includes(s) ||
      (p.tags || []).some(t => t.toLowerCase().includes(s));
  });

  return (
    <div className="border border-border/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Biblioteca de Prompts</span>
          <Badge className="bg-primary/20 text-primary text-[10px]">{prompts.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={loadPrompts}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '↻'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por estilo, tag ou conteúdo..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      <ScrollArea className="max-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {prompts.length === 0 ? 'Nenhum prompt salvo ainda. Gere cenas e use "Salvar na Biblioteca".' : 'Nenhum resultado encontrado.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className="border border-border/30 rounded-lg p-3 hover:border-primary/20 transition-colors bg-card/50">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.video_style && <Badge variant="outline" className="text-[9px]">{p.video_style}</Badge>}
                    {p.scene_type && <Badge className="bg-accent/10 text-accent text-[9px]">{p.scene_type}</Badge>}
                    {p.word_count && <Badge variant="outline" className="text-[9px]">{p.word_count}w</Badge>}
                    {p.quality_score != null && (
                      <Badge className={`text-[9px] ${p.quality_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' : p.quality_score >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-destructive/20 text-destructive'}`}>
                        {p.quality_score}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(p.prompt_text); toast.success('Copiado!'); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => deletePrompt(p.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-foreground leading-relaxed line-clamp-3">{p.prompt_text}</p>
                {(p.tags || []).length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(p.tags || []).map((t, i) => (
                      <span key={i} className="text-[8px] bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
