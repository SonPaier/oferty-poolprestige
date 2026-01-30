import { useFinishingWizard } from './FinishingWizardContext';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FinishingWizardNavigation() {
  const { state, dispatch, canProceedToStep, getStepLabel, totalSteps } = useFinishingWizard();
  const { currentStep, finishingType } = state;
  
  // Generate steps based on finishing type
  const steps = Array.from({ length: totalSteps }, (_, i) => {
    const stepNumber = i + 1;
    // Adjust step number for ceramic (skip optimization step 4)
    let displayStep = stepNumber;
    if (finishingType === 'ceramic' && stepNumber >= 4) {
      displayStep = stepNumber + 1; // Shift labels for ceramic
    }
    
    return {
      number: stepNumber,
      label: getStepLabel(finishingType === 'ceramic' && stepNumber >= 4 ? stepNumber + 1 : stepNumber),
      isCompleted: currentStep > stepNumber,
      isCurrent: currentStep === stepNumber,
      canNavigate: canProceedToStep(stepNumber) && stepNumber <= currentStep,
    };
  });
  
  const handleStepClick = (stepNumber: number) => {
    if (stepNumber <= currentStep) {
      dispatch({ type: 'SET_STEP', payload: stepNumber });
    }
  };
  
  return (
    <nav className="mb-6" aria-label="Kroki formularza">
      {/* Desktop navigation */}
      <ol className="hidden md:flex items-center justify-between gap-2">
        {steps.map((step, index) => (
          <li key={step.number} className="flex items-center flex-1">
            <button
              onClick={() => handleStepClick(step.number)}
              disabled={!step.canNavigate}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full",
                step.isCurrent && "bg-primary/10 border border-primary",
                step.isCompleted && "cursor-pointer hover:bg-muted/50",
                !step.canNavigate && !step.isCurrent && "opacity-50 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  step.isCurrent && "bg-primary text-primary-foreground",
                  step.isCompleted && "bg-primary/20 text-primary",
                  !step.isCurrent && !step.isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {step.isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  step.isCurrent && "text-primary",
                  step.isCompleted && "text-foreground",
                  !step.isCurrent && !step.isCompleted && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 shrink-0" />
            )}
          </li>
        ))}
      </ol>
      
      {/* Mobile navigation - simplified */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Krok {currentStep} z {totalSteps}
          </span>
          <span className="text-sm font-medium text-primary">
            {getStepLabel(currentStep)}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
