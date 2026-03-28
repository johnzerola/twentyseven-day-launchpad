import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { PipelineStep } from './PipelineStepper';

const STEP_ORDER: PipelineStep[] = ['script', 'style', 'characters', 'prompts', 'titles'];

const STEP_LABELS: Record<PipelineStep, string> = {
  script: 'Roteiro',
  style: 'Estilo Visual',
  characters: 'Personagens',
  prompts: 'Cenas',
  titles: 'Títulos & SEO',
};

interface StepNavButtonsProps {
  currentStep: PipelineStep;
  onNavigate: (step: PipelineStep) => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}

const StepNavButtons = memo(({ currentStep, onNavigate, nextDisabled, nextLabel }: StepNavButtonsProps) => {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const prevStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : null;
  const nextStep = currentIndex < STEP_ORDER.length - 1 ? STEP_ORDER[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
      {prevStep ? (
        <Button variant="outline" size="sm" onClick={() => onNavigate(prevStep)} className="gap-2 h-9">
          <ArrowLeft className="w-4 h-4" />
          {STEP_LABELS[prevStep]}
        </Button>
      ) : <div />}
      {nextStep ? (
        <Button size="sm" onClick={() => onNavigate(nextStep)} disabled={nextDisabled} className="gap-2 h-9">
          {nextLabel || STEP_LABELS[nextStep]}
          <ArrowRight className="w-4 h-4" />
        </Button>
      ) : (
        <div className="text-xs text-muted-foreground font-medium">✅ Pipeline completo!</div>
      )}
    </div>
  );
});

StepNavButtons.displayName = 'StepNavButtons';
export { StepNavButtons };
