import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const YouTubeIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.7} viewBox="0 0 28 20" fill="none">
    <rect width="28" height="20" rx="6" fill="#FF0000" />
    <path d="M11 6L19 10L11 14V6Z" fill="white" />
  </svg>
);

export const LandingNav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Como Funciona', href: '#features' },
    { label: 'Resultados', href: '#testimonials' },
    { label: 'Planos', href: '#pricing' },
  ];

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-dark border-b border-white/5' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <YouTubeIcon size={28} />
            <span className="font-display font-bold text-white text-lg tracking-tight">Monetiza27</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-red-500/30 bg-red-500/10 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              AO VIVO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-[#A3A3A3] text-sm hover:text-white transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden md:inline-block btn-youtube shimmer px-5 py-2.5 text-sm"
            >
              Começar Grátis
            </button>
            <button className="md:hidden text-white" onClick={() => setMenuOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
          >
            <button className="absolute top-5 right-5 text-white" onClick={() => setMenuOpen(false)}>
              <X size={28} />
            </button>
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-white text-2xl font-display font-bold">
                {l.label}
              </a>
            ))}
            <button onClick={() => { setMenuOpen(false); navigate('/login'); }} className="btn-youtube shimmer px-8 py-3 text-lg mt-4">
              Começar Grátis
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
