import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TrustScoreCalculator } from '@/components/dashboard/TrustScoreCalculator';
import { MicroNicheFinder } from '@/components/dashboard/MicroNicheFinder';
import { ChannelWarmupChecklist } from '@/components/dashboard/ChannelWarmupChecklist';
import { ReferenceChannels } from '@/components/dashboard/ReferenceChannels';
import { ContentFormatLibrary } from '@/components/dashboard/ContentFormatLibrary';
import { ContentSeriesManager } from '@/components/dashboard/ContentSeriesManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Compass, Flame, Trophy, Film, Repeat } from 'lucide-react';

const GrowthTools = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Growth Tools</h1>
          <p className="text-sm text-muted-foreground">
            Ferramentas baseadas em estratégias de canais que monetizaram em 15-30 dias
          </p>
        </div>

        <Tabs defaultValue="reference" className="w-full">
          <TabsList className="bg-secondary border border-border w-full md:w-auto flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="reference" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Trophy className="w-3.5 h-3.5" /> Canais Referência
            </TabsTrigger>
            <TabsTrigger value="formats" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Film className="w-3.5 h-3.5" /> Formatos
            </TabsTrigger>
            <TabsTrigger value="series" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Repeat className="w-3.5 h-3.5" /> Séries
            </TabsTrigger>
            <TabsTrigger value="trust-score" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Shield className="w-3.5 h-3.5" /> Trust Score
            </TabsTrigger>
            <TabsTrigger value="micro-niche" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Compass className="w-3.5 h-3.5" /> Micro-Niche
            </TabsTrigger>
            <TabsTrigger value="warmup" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Flame className="w-3.5 h-3.5" /> Warmup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reference" className="mt-6"><ReferenceChannels /></TabsContent>
          <TabsContent value="formats" className="mt-6"><ContentFormatLibrary /></TabsContent>
          <TabsContent value="series" className="mt-6"><ContentSeriesManager /></TabsContent>
          <TabsContent value="trust-score" className="mt-6"><TrustScoreCalculator /></TabsContent>
          <TabsContent value="micro-niche" className="mt-6"><MicroNicheFinder /></TabsContent>
          <TabsContent value="warmup" className="mt-6"><ChannelWarmupChecklist /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GrowthTools;
