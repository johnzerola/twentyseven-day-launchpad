import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Kanban, GripVertical, Plus, Calendar, Clock, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface KanbanCard {
  id: string;
  title: string;
  priority: 'alta' | 'média' | 'baixa';
  dueDate: string;
  tags: string[];
}

interface Column {
  id: string;
  title: string;
  emoji: string;
  cards: KanbanCard[];
}

const INITIAL_COLUMNS: Column[] = [
  {
    id: 'ideas', title: 'Ideias', emoji: '💡',
    cards: [
      { id: 'c1', title: '10 formas de ganhar dinheiro dormindo', priority: 'alta', dueDate: '15 Mar', tags: ['finanças'] },
      { id: 'c2', title: 'A história mais bizarra da deep web', priority: 'média', dueDate: '18 Mar', tags: ['horror'] },
    ],
  },
  {
    id: 'scripting', title: 'Escrevendo Roteiro', emoji: '✍️',
    cards: [
      { id: 'c3', title: 'Como o algoritmo do YouTube funciona em 2026', priority: 'alta', dueDate: '12 Mar', tags: ['tech', 'tutorial'] },
      { id: 'c4', title: 'O caso que ninguém resolveu', priority: 'média', dueDate: '14 Mar', tags: ['true crime'] },
    ],
  },
  {
    id: 'media', title: 'Gerando Mídia', emoji: '🎬',
    cards: [
      { id: 'c5', title: 'Setup gamer por R$2.000', priority: 'baixa', dueDate: '10 Mar', tags: ['gaming'] },
    ],
  },
  {
    id: 'editing', title: 'Editando', emoji: '✂️',
    cards: [
      { id: 'c6', title: 'Os 5 hábitos dos milionários', priority: 'alta', dueDate: '09 Mar', tags: ['finanças'] },
      { id: 'c7', title: 'Minecraft mas tudo é invertido', priority: 'baixa', dueDate: '11 Mar', tags: ['gaming'] },
    ],
  },
  {
    id: 'scheduled', title: 'Agendado no YouTube', emoji: '📅',
    cards: [
      { id: 'c8', title: 'A verdade sobre dropshipping', priority: 'média', dueDate: '08 Mar', tags: ['negócios'] },
    ],
  },
];

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-destructive/20 text-destructive border-destructive/30',
  média: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  baixa: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const Planner = () => {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; fromColumn: string } | null>(null);

  const handleDragStart = (cardId: string, fromColumn: string) => {
    setDraggedCard({ cardId, fromColumn });
  };

  const handleDrop = (toColumn: string) => {
    if (!draggedCard || draggedCard.fromColumn === toColumn) {
      setDraggedCard(null);
      return;
    }
    setColumns(prev => {
      const newCols = prev.map(col => ({ ...col, cards: [...col.cards] }));
      const fromCol = newCols.find(c => c.id === draggedCard.fromColumn);
      const toCol = newCols.find(c => c.id === toColumn);
      if (!fromCol || !toCol) return prev;
      const cardIdx = fromCol.cards.findIndex(c => c.id === draggedCard.cardId);
      if (cardIdx === -1) return prev;
      const [card] = fromCol.cards.splice(cardIdx, 1);
      toCol.cards.push(card);
      return newCols;
    });
    setDraggedCard(null);
    toast.success('Card movido!');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Kanban className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Dotti Planner</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus projetos de vídeo estilo Kanban</p>
            </div>
          </div>
          <Button className="gradient-hero border-0 gap-2" onClick={() => toast.info('Adicionar card (em breve)')}>
            <Plus className="w-4 h-4" /> Novo Projeto
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {columns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-64"
              onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(column.id)}>
              <div className="glass rounded-xl p-3 min-h-[400px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span>{column.emoji}</span> {column.title}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">{column.cards.length}</Badge>
                </div>
                <div className="space-y-2">
                  {column.cards.map((card) => (
                    <motion.div key={card.id} layout draggable
                      onDragStart={() => handleDragStart(card.id, column.id)}
                      className="bg-secondary/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-secondary/80 transition-all border border-transparent hover:border-primary/20 group">
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3 h-3 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{card.title}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[card.priority]}`}>
                              {card.priority}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" /> {card.dueDate}
                            </span>
                          </div>
                          <div className="flex gap-1 mt-2">
                            {card.tags.map(tag => (
                              <span key={tag} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
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
