import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
  shortLabel: string;
}

const steps: Step[] = [
  { id: 1, label: 'Dane klienta', shortLabel: 'Klient' },
  { id: 2, label: 'Wymiary basenu', shortLabel: 'Wymiary' },
  { id: 3, label: 'Wykończenie', shortLabel: 'Folia' },
  { id: 4, label: 'Uzbrojenie', shortLabel: 'Niecki' },
  { id: 5, label: 'Filtracja', shortLabel: 'Filtr' },
  { id: 6, label: 'Oświetlenie', shortLabel: 'Światło' },
  { id: 7, label: 'Automatyka', shortLabel: 'Auto' },
  { id: 8, label: 'Podsumowanie', shortLabel: 'Oferta' },
];

interface StepNavigationProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps?: number[];
}

export function StepNavigation({ currentStep, onStepClick, completedSteps = [] }: StepNavigationProps) {
  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id) || step.id < currentStep;
          const isClickable = step.id <= currentStep || completedSteps.includes(step.id - 1);
          
          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all duration-300 group",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}
              >
                <div
                  className={cn(
                    "step-indicator",
                    isActive && "active",
                    isCompleted && !isActive && "completed",
                    !isActive && !isCompleted && "inactive"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors whitespace-nowrap",
                    isActive && "text-primary",
                    isCompleted && !isActive && "text-success",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <span className="hidden lg:inline">{step.label}</span>
                  <span className="lg:hidden">{step.shortLabel}</span>
                </span>
              </button>
              
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 lg:w-16 h-0.5 mx-2 transition-colors",
                    step.id < currentStep ? "bg-success" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
