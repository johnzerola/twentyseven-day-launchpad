import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

function getNextMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function useCountdown() {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const target = getNextMonday();
    const tick = () => setDiff(Math.max(0, target.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

export const UrgencySection = () => {
  const { locale } = useLanguage();
  const pt = locale === 'pt-BR';
  const { d, h, m, s } = useCountdown();

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="glass-premium rounded-xl w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-2xl sm:text-3xl font-bold font-display text-foreground">
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, hsl(0 60% 15% / 0.15), hsl(35 80% 20% / 0.1))' }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
            {pt ? 'Vagas limitadas para o próximo ciclo de 27 dias' : 'Limited spots for the next 27-day cycle'}
          </h2>
          <p className="text-muted-foreground mb-8">
            {pt ? 'Abrimos novas turmas toda segunda-feira. A próxima abre em:' : 'New cohorts open every Monday. Next one opens in:'}
          </p>

          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8">
            <TimeBlock value={d} label={pt ? 'dias' : 'days'} />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={h} label={pt ? 'horas' : 'hours'} />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={m} label="min" />
            <span className="text-2xl font-bold text-muted-foreground mt-[-20px]">:</span>
            <TimeBlock value={s} label="seg" />
          </div>

          <p className="text-sm text-destructive font-semibold mb-8 flex items-center justify-center gap-2">
            <span className="live-dot !bg-destructive" />
            {pt ? 'Apenas 47 vagas restantes nesta turma' : 'Only 47 spots remaining in this cohort'}
          </p>

          <Link to="/login">
            <Button size="lg" className="gradient-hero border-0 glow-primary shimmer text-lg px-10 py-7 font-semibold rounded-lg">
              {pt ? 'Garantir minha vaga agora' : 'Secure my spot now'} →
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
