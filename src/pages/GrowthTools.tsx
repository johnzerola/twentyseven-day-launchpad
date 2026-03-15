import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TrustScoreCalculator } from '@/components/dashboard/TrustScoreCalculator';
import { MicroNicheFinder } from '@/components/dashboard/MicroNicheFinder';
import { ChannelWarmupChecklist } from '@/components/dashboard/ChannelWarmupChecklist';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Compass, Flame } from 'lucide-react';

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

        <Tabs defaultValue="trust-score" className="w-full">
          <TabsList className="bg-secondary border border-border w-full md:w-auto">
            <TabsTrigger value="trust-score" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Shield className="w-3.5 h-3.5" /> Trust Score
            </TabsTrigger>
            <TabsTrigger value="micro-niche" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Compass className="w-3.5 h-3.5" /> Micro-Niche
            </TabsTrigger>
            <TabsTrigger value="warmup" className="flex items-center gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Flame className="w-3.5 h-3.5" /> Channel Warmup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trust-score" className="mt-6">
            <TrustScoreCalculator />
          </TabsContent>

          <TabsContent value="micro-niche" className="mt-6">
            <MicroNicheFinder />
          </TabsContent>

          <TabsContent value="warmup" className="mt-6">
            <ChannelWarmupChecklist />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GrowthTools;
