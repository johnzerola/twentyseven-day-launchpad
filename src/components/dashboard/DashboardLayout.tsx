import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChatbotWidget, PAGE_TOOLTIPS } from '@/components/dashboard/ChatbotWidget';
import { Zap, LayoutDashboard, Youtube, Search, FileText, Menu, Compass, Palette, Sparkles, Flame, GitBranch, Layers, HelpCircle } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/constants';
import { LogOut } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { key: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'DubSpy', icon: Search, path: '/search' },
  { key: 'Growth Center', icon: Palette, path: '/branding' },
  { key: 'Niche Explorer', icon: Compass, path: '/niches' },
  { key: 'Roteiros', icon: FileText, path: '/scripts' },
  { key: 'Títulos Virais', icon: Sparkles, path: '/titles' },
  { key: 'Viral Database', icon: Flame, path: '/viral-db' },
  { key: 'Workflow', icon: GitBranch, path: '/workflow' },
  { key: 'Multichannel', icon: Layers, path: '/multichannel' },
  { key: 'Meus Canais', icon: Youtube, path: '/channels' },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado!');
    navigate('/login');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold font-['Space_Grotesk'] text-sidebar-foreground">{APP_NAME}</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ key, icon: Icon, path }) => {
          const active = location.pathname === path;
          const tooltip = PAGE_TOOLTIPS[path];
          return (
            <div key={path} className="flex items-center group">
              <Link to={path} onClick={() => setSidebarOpen(false)}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active ? 'bg-sidebar-accent text-sidebar-primary font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}>
                <Icon className="w-4 h-4" />
                {key}
              </Link>
              {tooltip && (
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

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <LanguageSwitcher />
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-all">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:block w-64 bg-sidebar-background border-r border-sidebar-border fixed inset-y-0">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-sidebar-background border-r border-sidebar-border">
            <Sidebar />
          </aside>
        </div>
      )}
      <div className="flex-1 lg:ml-64">
        <header className="h-14 border-b border-border flex items-center px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-semibold font-['Space_Grotesk']">{APP_NAME}</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
      <ChatbotWidget />
    </div>
  );
};
