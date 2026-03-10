import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Kanban, GripVertical, Plus, Calendar, Trash2, Loader2, Film, FileText, Sparkles, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface KanbanCard {
  id: string;
  title: string;
  priority: 'alta' | 'média' | 'baixa';
  due_date: string | null;
  tags: string[];
  position: number;
}

interface Column {
  id: string;
  title: string;
  emoji: string;
  color: string;
  cards: KanbanCard[];
}

const COLUMNS_META = [
  { id: 'ideas', title: 'Ideias', emoji: '💡', color: 'border-t-yellow-500' },
  { id: 'scripting', title: 'Escrevendo Roteiro', emoji: '✍️', color: 'border-t-violet-500' },
  { id: 'media', title: 'Gerando Mídia', emoji: '🎬', color: 'border-t-blue-500' },
  { id: 'editing', title: 'Editando', emoji: '✂️', color: 'border-t-orange-500' },
  { id: 'scheduled', title: 'Agendado no YouTube', emoji: '📅', color: 'border-t-emerald-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-destructive/20 text-destructive border-destructive/30',
  média: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  baixa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

// MOCK pre-loaded cards to show a realistic Kanban board
const MOCK_CARDS: KanbanCard[] = [
  { id: 'm1', title: '5 Fontes de Renda Passiva para 2026', priority: 'alta', due_date: '2026-03-15', tags: ['finanças', 'viral'], position: 0 },
  { id: 'm2', title: 'Como Fiz R$10k Sem Aparecer', priority: 'alta', due_date: '2026-03-18', tags: ['faceless', 'storytelling'], position: 1 },
  { id: 'm3', title: 'O Segredo dos Canais Dark', priority: 'média', due_date: null, tags: ['tutorial'], position: 2 },
  { id: 'm4', title: 'Tesouro Direto vs CDB — Comparativo', priority: 'média', due_date: '2026-03-20', tags: ['finanças'], position: 0 },
  { id: 'm5', title: 'Roteiro: 7 Erros de Iniciantes', priority: 'alta', due_date: '2026-03-12', tags: ['roteiro'], position: 0 },
  { id: 'm6', title: 'Gerando 50 cenas no Veo3', priority: 'baixa', due_date: null, tags: ['produção'], position: 0 },
  { id: 'm7', title: 'Edição final — vídeo de finanças', priority: 'alta', due_date: '2026-03-11', tags: ['edição'], position: 0 },
  { id: 'm8', title: 'Upload: Renda Passiva ep.1', priority: 'alta', due_date: '2026-03-13', tags: ['upload'], position: 0 },
];

const MOCK_COLUMN_MAP: Record<string, string[]> = {
  ideas: ['m1', 'm2', 'm3'],
  scripting: ['m4', 'm5'],
  media: ['m6'],
  editing: ['m7'],
  scheduled: ['m8'],
};

const Planner = () => {
  const [columns, setColumns] = useState<Column[]>(
    COLUMNS_META.map(c => ({
      ...c,
      cards: (MOCK_COLUMN_MAP[c.id] || []).map(id => MOCK_CARDS.find(card => card.id === id)!).filter(Boolean),
    }))
  );
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; fromColumn: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase.from('planner_cards').select('*')
      .eq('user_id', user.id).order('position');
    if (error || !data?.length) {
      // Keep mock data if no DB cards
      setLoading(false);
      return;
    }

    const cols = COLUMNS_META.map(c => ({
      ...c,
      cards: data
        .filter((card: any) => card.column_id === c.id)
        .map((card: any) => ({
          id: card.id,
          title: card.title,
          priority: card.priority as 'alta' | 'média' | 'baixa',
          due_date: card.due_date,
          tags: Array.isArray(card.tags) ? card.tags as string[] : [],
          position: card.position,
        })),
    }));
    setColumns(cols);
    setDbLoaded(true);
    setLoading(false);
  };

  const addCard = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdding(false); return; }

    const { error } = await supabase.from('planner_cards').insert({
      user_id: user.id,
      column_id: 'ideas',
      title: newTitle.trim(),
      priority: 'média',
      position: columns.find(c => c.id === 'ideas')!.cards.length,
    } as any);

    if (error) { toast.error('Erro ao criar card'); setAdding(false); return; }
    setNewTitle('');
    await loadCards();
    setAdding(false);
    toast.success('Card criado!');
  };

  const deleteCard = async (cardId: string) => {
    if (dbLoaded) {
      await supabase.from('planner_cards').delete().eq('id', cardId);
      await loadCards();
    } else {
      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.filter(c => c.id !== cardId),
      })));
    }
    toast.success('Card removido');
  };

  const handleDrop = async (toColumn: string) => {
    if (!draggedCard || draggedCard.fromColumn === toColumn) {
      setDraggedCard(null);
      return;
    }
    if (dbLoaded) {
      await supabase.from('planner_cards').update({ column_id: toColumn } as any).eq('id', draggedCard.cardId);
      setDraggedCard(null);
      await loadCards();
    } else {
      // Move mock card locally
      let movedCard: KanbanCard | undefined;
      setColumns(prev => {
        const updated = prev.map(col => {
          if (col.id === draggedCard.fromColumn) {
            const card = col.cards.find(c => c.id === draggedCard.cardId);
            if (card) movedCard = card;
            return { ...col, cards: col.cards.filter(c => c.id !== draggedCard.cardId) };
          }
          return col;
        });
        if (movedCard) {
          return updated.map(col =>
            col.id === toColumn ? { ...col, cards: [...col.cards, movedCard!] } : col
          );
        }
        return updated;
      });
      setDraggedCard(null);
    }
    toast.success('Card movido!');
  };

  const totalCards = columns.reduce((acc, c) => acc + c.cards.length, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center glow-primary">
              <Kanban className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Dotti Planner</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus projetos de vídeo • {totalCards} projetos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Título do novo projeto..." value={newTitle}
              onChange={e => setNewTitle(e.target.value)} className="bg-secondary/50 w-64"
              onKeyDown={e => e.key === 'Enter' && addCard()} />
            <Button className="gradient-hero border-0 gap-2" onClick={addCard} disabled={adding}>
              <Plus className="w-4 h-4" /> Novo
            </Button>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {columns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-72"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'rounded-xl'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'rounded-xl'); }}
              onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'rounded-xl'); handleDrop(column.id); }}>
              <div className={`glass rounded-xl p-3 min-h-[500px] border-t-2 ${column.color}`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span>{column.emoji}</span> {column.title}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">{column.cards.length}</Badge>
                </div>
                <div className="space-y-2">
                  {column.cards.map((card) => (
                    <motion.div key={card.id} layout draggable
                      onDragStart={() => setDraggedCard({ cardId: card.id, fromColumn: column.id })}
                      className="bg-secondary/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20 group">
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3 h-3 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{card.title}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[card.priority]}`}>
                              {card.priority}
                            </Badge>
                            {card.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {new Date(card.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-2">
                            {card.tags.map(tag => (
                              <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => deleteCard(card.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {column.cards.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/40">
                      <p className="text-xs">Arraste cards aqui</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Planner;
