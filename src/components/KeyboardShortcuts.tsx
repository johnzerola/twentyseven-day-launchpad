import { useEffect, useState, useCallback, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['g', 'd'], label: 'Dashboard', path: '/dashboard' },
  { keys: ['g', 's'], label: 'Roteiros', path: '/scripts' },
  { keys: ['g', 't'], label: 'Títulos Virais', path: '/titles' },
  { keys: ['g', 'w'], label: 'Workflow', path: '/workflow' },
  { keys: ['g', 'n'], label: 'Niche Explorer', path: '/niches' },
  { keys: ['g', 'c'], label: 'Meus Canais', path: '/channels' },
  { keys: ['g', 'b'], label: 'Growth Center', path: '/branding' },
  { keys: ['g', 'v'], label: 'Viral Database', path: '/viral-db' },
  { keys: ['g', 'e'], label: 'DubSpy', path: '/search' },
  { keys: ['?'], label: 'Abrir atalhos', path: null },
];

export const KeyboardShortcuts = forwardRef<HTMLDivElement>((_props, _ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?') {
      e.preventDefault();
      setOpen(o => !o);
      return;
    }

    if (e.key === 'Escape') {
      setOpen(false);
      setGPressed(false);
      return;
    }

    if (e.key === 'g' && !gPressed) {
      setGPressed(true);
      setTimeout(() => setGPressed(false), 1500);
      return;
    }

    if (gPressed) {
      const shortcut = SHORTCUTS.find(s => s.keys.length === 2 && s.keys[1] === e.key);
      if (shortcut?.path && shortcut.path !== location.pathname) {
        e.preventDefault();
        navigate(shortcut.path);
      }
      setGPressed(false);
    }
  }, [gPressed, navigate, location.pathname]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {gPressed && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl px-4 py-2 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Badge className="bg-primary/20 text-primary text-xs">g</Badge>
          <span className="text-xs text-muted-foreground">+ tecla para navegar...</span>
          <div className="flex gap-1 ml-2">
            {SHORTCUTS.filter(s => s.keys.length === 2).slice(0, 5).map(s => (
              <Badge key={s.keys[1]} variant="outline" className="text-[9px]">{s.keys[1]} = {s.label}</Badge>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Keyboard className="w-4 h-4 text-primary" /> Atalhos de Teclado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {SHORTCUTS.map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <span className="text-sm">{s.label}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <span key={i}>
                      <Badge variant="outline" className="text-[10px] font-mono px-2">{k}</Badge>
                      {i < s.keys.length - 1 && <span className="text-[10px] text-muted-foreground mx-0.5">then</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Pressione <Badge variant="outline" className="text-[9px]">g</Badge> seguido da letra para navegar.
            Não funciona dentro de campos de texto.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};
