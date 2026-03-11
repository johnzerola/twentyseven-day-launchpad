import { FileText, Film, CheckCircle2, TrendingUp } from 'lucide-react';

interface StatsProps {
  total: number;
  thisWeek: number;
  withScript: number;
  withScenes: number;
  published: number;
}

export const WorkspaceStats = ({ total, thisWeek, withScript, withScenes, published }: StatsProps) => {
  const stats = [
    { label: 'Total', value: total, icon: TrendingUp, color: 'text-foreground' },
    { label: 'Esta Semana', value: thisWeek, icon: TrendingUp, color: 'text-primary' },
    { label: 'Com Roteiro', value: withScript, icon: FileText, color: 'text-primary' },
    { label: 'Com Cenas', value: withScenes, icon: Film, color: 'text-accent' },
    { label: 'Publicados', value: published, icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
          <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
          <p className={`text-xl font-bold font-['Space_Grotesk'] ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
};
