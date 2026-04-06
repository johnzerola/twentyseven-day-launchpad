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
            {/* YouTube-style play button logo */}
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary">
              <svg width="16" height="16" viewBox="0 0 68 48" fill="none">
                <path d="M66.52 7.74C65.77 4.81 63.48 2.52 60.55 1.77C55.22 0.27 34 0.27 34 0.27S12.78 0.27 7.45 1.77C4.52 2.52 2.23 4.81 1.48 7.74C0 13.09 0 24.13 0 24.13S0 35.17 1.48 40.52C2.23 43.45 4.52 45.74 7.45 46.49C12.78 47.99 34 47.99 34 47.99S55.22 47.99 60.55 46.49C63.48 45.74 65.77 43.45 66.52 40.52C68 35.17 68 24.13 68 24.13S68 13.09 66.52 7.74Z" fill="white" fillOpacity="0.9"/>
                <path d="M27.16 34.33L44.84 24.13L27.16 13.93V34.33Z" fill="hsl(0, 72%, 51%)"/>
              </svg>
            </div>
            <span className="text-lg font-bold font-display">Monetiza27</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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
