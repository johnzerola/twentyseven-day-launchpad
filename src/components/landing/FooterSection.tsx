import { Rocket } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const FooterSection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';
  const [email, setEmail] = useState('');

  return (
    <footer className="border-t border-border/50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-display">Monetiza27</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {pt ? 'A plataforma que leva criadores do zero ao YPP.' : 'The platform that takes creators from zero to YPP.'}
            </p>

            {/* Newsletter */}
            <p className="text-sm font-semibold mb-2">{pt ? 'Receba dicas semanais de crescimento' : 'Get weekly growth tips'}</p>
            <div className="flex gap-2 max-w-sm">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" className="gradient-hero border-0 shimmer">{pt ? 'Assinar' : 'Subscribe'}</Button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
              <span>🇧🇷 {pt ? 'Feito no Brasil' : 'Made in Brazil'}</span>
              <span>🔒 {pt ? 'Dados seguros' : 'Secure data'}</span>
              <span>⚡ Powered by AI</span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">{pt ? 'Produto' : 'Product'}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{pt ? 'Funcionalidades' : 'Features'}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{pt ? 'Planos' : 'Pricing'}</a></li>
              <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3">{pt ? 'Legal' : 'Legal'}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{pt ? 'Privacidade' : 'Privacy'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{pt ? 'Termos' : 'Terms'}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{pt ? 'Contato' : 'Contact'}</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          © 2026 Monetiza27. {pt ? 'Todos os direitos reservados.' : 'All rights reserved.'}
        </div>
      </div>
    </footer>
  );
};
