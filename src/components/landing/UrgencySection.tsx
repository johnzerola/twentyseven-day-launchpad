import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function getNextMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export const UrgencySection = () => {
  const navigate = useNavigate();
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = getNextMonday();
    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      const s = Math.floor(diff / 1000);
      setTime({
        d: Math.floor(s / 86400),
        h: Math.floor((s % 86400) / 3600),
        m: Math.floor((s % 3600) / 60),
        s: s % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const blocks = [
    { value: time.d, label: 'DIAS' },
    { value: time.h, label: 'HORAS' },
    { value: time.m, label: 'MIN' },
    { value: time.s, label: 'SEG' },
  ];

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative max-w-3xl mx-auto px-4 text-center"
      >
        <div className="text-4xl mb-4">⏰</div>
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-3">
          Próxima turma começa em:
        </h2>

        <div className="flex justify-center gap-3 md:gap-4 my-8">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center gap-2 md:gap-3">
              <div className="bg-[#1A1A1A] rounded-xl px-4 py-3 md:px-6 md:py-4 min-w-[60px] md:min-w-[80px]">
                <div className="font-display font-extrabold text-3xl md:text-5xl text-[#F5C518] tabular-nums">
                  {String(b.value).padStart(2, '0')}
                </div>
                <div className="text-[10px] md:text-xs text-[#A3A3A3] mt-1 tracking-wider">{b.label}</div>
              </div>
              {i < 3 && <span className="text-red-500 font-bold text-2xl md:text-3xl">:</span>}
            </div>
          ))}
        </div>

        <p className="text-[#A3A3A3] text-sm mb-8">
          🔴 Apenas <strong className="text-white">47 vagas</strong> disponíveis nesta turma — renovamos toda segunda-feira
        </p>

        <button
          onClick={() => navigate('/login')}
          className="btn-youtube shimmer px-10 py-4 text-lg font-display font-bold"
        >
          Garantir minha vaga agora →
        </button>
      </motion.div>
    </section>
  );
};
