import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChatbotWidget, PAGE_TOOLTIPS } from '@/components/dashboard/ChatbotWidget';
import { Zap, LayoutDashboard, Youtube, Search, FileText, Menu, Compass, Sparkles, Flame, Layers, HelpCircle, Lock, CreditCard, X, Rocket, Shield, TrendingUp, Database, Crosshair } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';
import { LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubscription } from '@/hooks/use-subscription';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// v2.4: Simplified menu - merged redundant pages
const navItems = [
  { key: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'Tracker 30 Dias', icon: Rocket, path: '/tracker' },
  { key: 'Roteiros', icon: FileText, path: '/scripts' },
  { key: 'Títulos Virais', icon: Sparkles, path: '/titles' },
  { key: 'DubSpy', icon: Search, path: '/search' },
  { key: 'Meus Canais', icon: Youtube, path: '/channels' },
  { key: 'Viral Database', icon: Flame, path: '/viral-db' },
  { key: 'Niche Explorer', icon: Compass, path: '/niches' },
  { key: 'Shorts Trends', icon: TrendingUp, path: '/shorts-trends' },
  { key: 'Growth Tools', icon: Shield, path: '/growth-tools' },
  { key: 'Power Tools', icon: Crosshair, path: '/power-tools' },
  { key: 'Multichannel', icon: Layers, path: '/multichannel' },
  { key: 'Knowledge Admin', icon: Database, path: '/knowledge' },
];

const TIER_COLORS: Record<string, string> = {
  starter: 'bg-muted text-muted-foreground',
  pro: 'bg-primary/20 text-primary',
  full: 'bg-accent/20 text-accent',
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { subscription, hasAccess, getRequiredTier, tierLabel } = useSubscription();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado!');
    navigate('/login');
  };

  const creditsPercent = subscription.credits_monthly_limit > 0
    ? (subscription.credits_remaining / subscription.credits_monthly_limit) * 100
    : 0;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold font-['Space_Grotesk'] text-sidebar-foreground">{APP_NAME}</span>
        <Badge className={`ml-auto text-[10px] px-1.5 py-0 ${TIER_COLORS[subscription.tier]}`}>
          {tierLabel(subscription.tier)}
        </Badge>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ key, icon: Icon, path }) => {
          const active = location.pathname === path;
          const tooltip = PAGE_TOOLTIPS[path];
          const locked = !hasAccess(path);
          const requiredTier = getRequiredTier(path);

          return (
            <div key={path} className="flex items-center group">
              {locked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed relative select-none">
                      <Icon className="w-4 h-4" />
                      <span className="line-through decoration-muted-foreground/30">{key}</span>
                      <Lock className="w-3 h-3 ml-auto text-muted-foreground/40" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px] text-xs">
                    <p className="font-semibold text-primary">🔒 Plano {tierLabel(requiredTier)} necessário</p>
                    <p className="text-muted-foreground mt-0.5">Faça upgrade para desbloquear.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link to={path} onClick={() => setSidebarOpen(false)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-sidebar-accent text-sidebar-primary font-medium shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}>
                  <Icon className={`w-4 h-4 ${active ? 'text-sidebar-primary' : ''}`} />
                  {key}
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary ml-auto" />}
                </Link>
              )}
              {tooltip && !locked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px] text-xs">
                    <p className="font-semibold mb-0.5">{tooltip.title}</p>
                    <p className="text-muted-foreground">{tooltip.desc}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
      </nav>

      {/* Credits meter */}
      <div className="px-4 py-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Créditos</span>
          <span className="font-mono">{subscription.credits_remaining}/{subscription.credits_monthly_limit}</span>
        </div>
        <Progress value={creditsPercent} className="h-1.5" />
        {creditsPercent < 20 && (
          <p className="text-[10px] text-destructive mt-1">⚠️ Créditos quase esgotados</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1.5 shrink-0">
        <LanguageSwitcher />
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 bg-sidebar-background border-r border-sidebar-border fixed inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 h-full bg-sidebar-background border-r border-sidebar-border shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border flex items-center px-4 lg:hidden sticky top-0 bg-background/80 backdrop-blur-md z-20 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-semibold font-['Space_Grotesk']">{APP_NAME}</span>
          <Badge className={`ml-auto text-[9px] px-1.5 py-0 ${TIER_COLORS[subscription.tier]}`}>
            {tierLabel(subscription.tier)}
          </Badge>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <ChatbotWidget />
    </div>
  );
};
