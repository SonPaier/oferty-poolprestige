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
  { id: 7, label: 'Automatyka', shortLabel: 'Automatyka' },
  { id: 8, label: 'Atrakcje', shortLabel: 'Atrakcje' },
  { id: 9, label: 'Roboty ziemne', shortLabel: 'Wykop' },
  { id: 10, label: 'Prace budowlane', shortLabel: 'Budowa' },
  { id: 11, label: 'Dodatki', shortLabel: 'Dodatki' },
  { id: 12, label: 'Podsumowanie', shortLabel: 'Oferta' },
];

interface StepNavigationProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps?: number[];
}

export function StepNavigation({ currentStep, onStepClick, completedSteps = [] }: StepNavigationProps) {
  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-center justify-between overflow-x-auto pb-2 gap-1">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = completedSteps.includes(step.id) || step.id < currentStep;
          const isClickable = true; // Allow navigation to any step
          
          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-all duration-300 group",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-xs lg:text-sm font-semibold transition-all duration-300",
                    isActive && "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(190_80%_50%/0.4)]",
                    isCompleted && !isActive && "bg-success text-success-foreground",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] lg:text-xs font-medium transition-colors whitespace-nowrap",
                    isActive && "text-primary",
                    isCompleted && !isActive && "text-success",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <span className="hidden xl:inline">{step.label}</span>
                  <span className="xl:hidden">{step.shortLabel}</span>
                </span>
              </button>
              
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-4 lg:w-8 xl:w-12 h-0.5 mx-1 transition-colors",
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
