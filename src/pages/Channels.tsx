import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Youtube, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Channels = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <Youtube className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Meus Canais</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus canais do YouTube</p>
            </div>
          </div>
          <Link to="/onboarding">
            <Button className="gradient-hero border-0 gap-2">
              <Plus className="w-4 h-4" /> Adicionar Canal
            </Button>
          </Link>
        </div>

        <div className="glass rounded-2xl p-12 text-center">
          <Youtube className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-semibold mb-2">Nenhum canal adicionado</h3>
          <p className="text-muted-foreground mb-6">Adicione seu primeiro canal para começar a análise.</p>
          <Link to="/onboarding">
            <Button className="gradient-hero border-0">Adicionar Meu Canal</Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Channels;
