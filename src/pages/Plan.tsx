import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Calendar, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';

const mockPlan = Array.from({ length: 27 }, (_, i) => ({
  day: i + 1,
  title: [
    'Configurar canal', 'Pesquisar concorrentes', 'Definir palavras-chave', 'Criar primeiro roteiro',
    'Produzir primeiro vídeo', 'Criar thumbnail + publicar', 'Analisar métricas', 'Publicar 2 vídeos',
    'Continuar publicação', 'Criar Shorts', 'Publicar + Shorts', 'Mais conteúdo', 'Analisar outliers',
    'Review semanal', 'Vídeo alta retenção #1', 'Vídeo alta retenção #2', 'Vídeo alta retenção #3',
    'Colaboração/trending', 'Otimizar SEO #1', 'Otimizar SEO #2', 'Review semanal', 'Vídeo otimizado #1',
    'Vídeo otimizado #2', 'Vídeo otimizado #3', 'Aplicar monetização', 'Links de afiliados', 'Review final'
  ][i],
  completed: false,
}));

const Plan = () => {
  const [tasks, setTasks] = useState(mockPlan);
  const completed = tasks.filter((t) => t.completed).length;
  const progress = (completed / 27) * 100;

  const toggle = (day: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.day === day ? { ...t, completed: !t.completed } : t))
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center glow-primary">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">Plano 27 Dias</h1>
            <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">{completed}/27 tarefas completas</span>
            <span className="text-sm text-primary font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {!tasks.some(t => t.title) ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">Você ainda não criou seu plano.</p>
            <Link to="/onboarding">
              <button className="gradient-hero text-primary-foreground px-6 py-3 rounded-xl font-medium gap-2 inline-flex items-center">
                Criar Meu Plano <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {[1, 2, 3, 4].map((week) => (
              <div key={week} className="glass rounded-xl p-5">
                <h3 className="font-semibold font-['Space_Grotesk'] mb-3">Semana {week}</h3>
                <div className="space-y-2">
                  {tasks
                    .filter((t) => t.day > (week - 1) * 7 && t.day <= Math.min(week * 7, 27))
                    .map((task) => (
                      <button
                        key={task.day}
                        onClick={() => toggle(task.day)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-all ${
                          task.completed ? 'bg-primary/10' : 'bg-secondary/30 hover:bg-secondary/50'
                        }`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground mr-2">Dia {task.day}</span>
                        <span className={task.completed ? 'line-through text-muted-foreground' : ''}>
                          {task.title}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Plan;
