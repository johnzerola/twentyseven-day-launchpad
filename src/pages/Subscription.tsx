import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useSubscription, PLAN_LIMITS, type SubscriptionTier } from '@/hooks/use-subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Crown, Shield, Sparkles, Zap, ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const TIER_CONFIG: Record<SubscriptionTier, { icon: React.ReactNode; color: string; gradient: string }> = {
  starter: { icon: <Zap className="w-5 h-5" />, color: 'text-muted-foreground', gradient: 'from-muted to-muted/50' },
  pro: { icon: <Sparkles className="w-5 h-5" />, color: 'text-primary', gradient: 'from-primary/20 to-primary/5' },
  studio: { icon: <Crown className="w-5 h-5" />, color: 'text-accent', gradient: 'from-accent/20 to-accent/5' },
};

const FEATURES_BY_TIER: Record<SubscriptionTier, string[]> = {
  starter: ['1 canal', '30 vídeos/mês', '100 créditos', 'Viral Database', 'TubeBot (20 msgs/dia)'],
  pro: ['2 canais', '60 vídeos/mês', '300 créditos', 'DubSpy', 'Growth Tools', 'Veo3 Prompts', 'TubeBot ilimitado'],
  studio: ['5 canais', '90 vídeos/mês', '500 créditos', 'Deep Research', 'Multilingual', 'Suporte prioritário', 'Tudo do Pro'],
};

export default function Subscription() {
  const { subscription, stripeSubscription, loading, isActive, tierLabel, openPortal } = useSubscription();
  const navigate = useNavigate();

  const handleManageSubscription = async () => {
    try {
      await openPortal();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir portal');
    }
  };

  const active = isActive();
  const tier = subscription.tier;
  const config = TIER_CONFIG[tier];
  const limits = PLAN_LIMITS[tier];
  const creditsPercent = subscription.credits_monthly_limit > 0
    ? (subscription.credits_remaining / subscription.credits_monthly_limit) * 100
    : 0;

  const canceledButActive = stripeSubscription?.status === 'canceled' && stripeSubscription?.current_period_end
    && new Date(stripeSubscription.current_period_end) > new Date();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Minha Assinatura</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie seu plano, créditos e método de pagamento</p>
          </div>
        </div>

        {/* Current Plan Card */}
        <Card className={`bg-gradient-to-br ${config.gradient} border-border/50`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-background/80 ${config.color}`}>{config.icon}</div>
              <div>
                <CardTitle className="text-lg">{tierLabel(tier)}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {active ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" /> Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                      Inativo
                    </Badge>
                  )}
                  {canceledButActive && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Cancela em {new Date(stripeSubscription!.current_period_end!).toLocaleDateString('pt-BR')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {stripeSubscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription} className="gap-2">
                <CreditCard className="w-4 h-4" />
                Gerenciar Assinatura
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {stripeSubscription?.current_period_end && active && (
              <p className="text-xs text-muted-foreground mb-4">
                Próxima renovação: {new Date(stripeSubscription.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Créditos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Restantes</span>
              <span className="font-mono font-bold">{subscription.credits_remaining} / {subscription.credits_monthly_limit}</span>
            </div>
            <Progress value={creditsPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Os créditos renovam automaticamente a cada ciclo de cobrança.
            </p>
          </CardContent>
        </Card>

        {/* Plan Features */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Recursos do seu plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES_BY_TIER[tier].map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stripeSubscription?.stripe_customer_id ? (
            <Card className="cursor-pointer hover:bg-muted/50 transition" onClick={handleManageSubscription}>
              <CardContent className="flex items-center gap-3 py-4">
                <CreditCard className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Atualizar Pagamento</p>
                  <p className="text-xs text-muted-foreground">Altere cartão ou método de pagamento</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tier !== 'studio' && (
            <Card className="cursor-pointer hover:bg-muted/50 transition" onClick={() => navigate('/pricing')}>
              <CardContent className="flex items-center gap-3 py-4">
                <Crown className="w-5 h-5 text-accent" />
                <div>
                  <p className="font-medium text-sm">Fazer Upgrade</p>
                  <p className="text-xs text-muted-foreground">
                    Desbloqueie mais recursos com {tier === 'starter' ? 'Creator Pro' : 'Studio'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
