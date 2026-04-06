import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/i18n/LanguageContext';

export const LandingNav = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass-premium border-b border-border/20' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center glow-primary">
              <Rocket className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display">Monetiza27</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Novo: IA Veo3
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group">
              {t('nav.features')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group">
              {t('nav.pricing')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group">
              {t('nav.faq')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </a>
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="ghost" size="sm">{t('nav.login')}</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="gradient-hero border-0 glow-primary shimmer font-semibold rounded-lg">
                {t('nav.signup')} →
              </Button>
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass-premium border-t border-border/30 p-4 space-y-3">
          <a href="#features" className="block text-sm text-muted-foreground">{t('nav.features')}</a>
          <a href="#pricing" className="block text-sm text-muted-foreground">{t('nav.pricing')}</a>
          <a href="#faq" className="block text-sm text-muted-foreground">{t('nav.faq')}</a>
          <LanguageSwitcher />
          <Link to="/login" className="block">
            <Button className="w-full gradient-hero border-0 shimmer">{t('nav.signup')}</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};
