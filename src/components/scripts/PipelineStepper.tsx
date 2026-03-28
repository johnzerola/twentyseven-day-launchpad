import { memo } from 'react';
import { Check, FileText, Film, Users, Image, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type PipelineStep = 'script' | 'style' | 'characters' | 'prompts' | 'titles';

const STEPS: { key: PipelineStep; label: string; shortLabel: string; icon: any; desc: string }[] = [
  { key: 'script', label: 'Roteiro', shortLabel: '1', icon: FileText, desc: 'Gere o roteiro com IA' },
  { key: 'style', label: 'Estilo Visual', shortLabel: '2', icon: Film, desc: 'Escolha a identidade visual' },
  { key: 'characters', label: 'Personagens', shortLabel: '3', icon: Users, desc: 'Defina personagens visuais' },
  { key: 'prompts', label: 'Cenas', shortLabel: '4', icon: Image, desc: 'Prompts visuais sincronizados' },
  { key: 'titles', label: 'Títulos & SEO', shortLabel: '5', icon: Sparkles, desc: 'Otimização para YouTube' },
];

interface PipelineStepperProps {
  activeStep: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  hasScript: boolean;
  completedSteps: Record<PipelineStep, boolean>;
}

const PipelineStepper = memo(({ activeStep, onStepClick, hasScript, completedSteps }: PipelineStepperProps) => {
  const activeIndex = STEPS.findIndex(s => s.key === activeStep);
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = (completedCount / STEPS.length) * 100;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1">
      {/* Desktop stepper */}
      <div className="hidden md:flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = activeStep === step.key;
          const isDone = completedSteps[step.key];
          const isClickable = hasScript || step.key === 'script';
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <button
                onClick={() => isClickable && onStepClick(step.key)}
                disabled={!isClickable}
                className={cn(
                  'relative flex items-center gap-2.5 px-4 py-3 rounded-xl text-left transition-all w-full group',
                  isActive && 'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
                  !isActive && isDone && 'bg-primary/10 text-primary hover:bg-primary/15',
                  !isActive && !isDone && isClickable && 'hover:bg-muted/50 text-muted-foreground',
                  !isClickable && 'opacity-40 cursor-not-allowed',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                  isActive && 'bg-primary-foreground/20',
                  !isActive && isDone && 'bg-primary/20',
                  !isActive && !isDone && 'bg-muted',
                )}>
                  {isDone && !isActive ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    'text-xs font-semibold truncate',
                    isActive && 'text-primary-foreground',
                  )}>{step.label}</p>
                  <p className={cn(
                    'text-[10px] truncate',
                    isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}>{step.desc}</p>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeStep"
                    className="absolute inset-0 rounded-xl bg-primary -z-10"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className={cn(
                  'w-4 h-4 shrink-0 mx-0.5',
                  i < activeIndex ? 'text-primary' : 'text-muted-foreground/30',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile stepper */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STEPS.map((step) => {
          const isActive = activeStep === step.key;
          const isDone = completedSteps[step.key];
          const isClickable = hasScript || step.key === 'script';
          const Icon = step.icon;

          return (
            <button
              key={step.key}
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all',
                isActive && 'bg-primary text-primary-foreground shadow-md',
                !isActive && isDone && 'bg-primary/10 text-primary',
                !isActive && !isDone && isClickable && 'text-muted-foreground hover:bg-muted/50',
                !isClickable && 'opacity-40 cursor-not-allowed',
              )}
            >
              {isDone && !isActive ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              {step.label}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      {hasScript && (
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
            {completedCount}/{STEPS.length} passos
          </span>
        </div>
      )}
    </div>
  );
});

PipelineStepper.displayName = 'PipelineStepper';
export { PipelineStepper, STEPS };
export type { PipelineStepperProps };
