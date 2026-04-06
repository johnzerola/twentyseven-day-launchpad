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
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 68 48" fill="none">
                  <path d="M66.52 7.74C65.77 4.81 63.48 2.52 60.55 1.77C55.22 0.27 34 0.27 34 0.27S12.78 0.27 7.45 1.77C4.52 2.52 2.23 4.81 1.48 7.74C0 13.09 0 24.13 0 24.13S0 35.17 1.48 40.52C2.23 43.45 4.52 45.74 7.45 46.49C12.78 47.99 34 47.99 34 47.99S55.22 47.99 60.55 46.49C63.48 45.74 65.77 43.45 66.52 40.52C68 35.17 68 24.13 68 24.13S68 13.09 66.52 7.74Z" fill="white" fillOpacity="0.9"/>
                  <path d="M27.16 34.33L44.84 24.13L27.16 13.93V34.33Z" fill="hsl(0, 72%, 51%)"/>
                </svg>
              </div>
              <span className="text-lg font-bold font-display">Monetiza27</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              {pt ? 'A plataforma que leva criadores do zero ao YPP.' : 'The platform that takes creators from zero to YPP.'}
            </p>

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

        {/* SEO-rich text block */}
        <div className="border-t border-border/30 pt-8 mb-8">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl mx-auto text-center">
            {pt
              ? 'O Monetiza27 é a plataforma brasileira de inteligência artificial para YouTube especializada em monetização rápida de canais. Nossa IA analisa nichos, gera roteiros virais para YouTube, produz narração automática em português e cria um plano personalizado de 27 dias para você atingir os requisitos do YouTube Partner Program (YPP): 1.000 inscritos e 4.000 horas assistidas. Funciona para canais novos, canais sem aparecer (faceless) e criadores de qualquer nicho. Mais de 3.200 criadores já monetizaram seus canais usando o Monetiza27.'
              : 'Monetiza27 is the Brazilian AI platform for YouTube specialized in fast channel monetization. Our AI analyzes niches, generates viral YouTube scripts, produces automatic narration in Portuguese, and creates a personalized 27-day plan to help you reach YouTube Partner Program (YPP) requirements: 1,000 subscribers and 4,000 watch hours. Works for new channels, faceless channels, and creators of any niche. Over 3,200 creators have already monetized using Monetiza27.'}
          </p>
        </div>

        <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          © 2026 Monetiza27. {pt ? 'Todos os direitos reservados.' : 'All rights reserved.'}
        </div>
      </div>
    </footer>
  );
};
