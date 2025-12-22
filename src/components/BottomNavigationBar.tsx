import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2, Home } from 'lucide-react';

interface BottomNavigationBarProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
  isEditMode: boolean;
}

export function BottomNavigationBar({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSave,
  isSaving,
  hasChanges,
  isEditMode,
}: BottomNavigationBarProps) {
  const navigate = useNavigate();
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left side - Back button */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={onBack}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Wstecz</span>
              </Button>
            )}
            {isFirstStep && (
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="gap-2 text-muted-foreground"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            )}
          </div>

          {/* Center - Step indicator */}
          <div className="text-sm text-muted-foreground">
            Krok {currentStep} z {totalSteps}
          </div>

          {/* Right side - Save and Next buttons */}
          <div className="flex items-center gap-2">
            {/* Save button - always visible when there are changes */}
            {(hasChanges || isEditMode) && !isLastStep && (
              <Button
                variant="outline"
                onClick={onSave}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Zapisz</span>
              </Button>
            )}

            {/* Next button */}
            {!isLastStep && (
              <Button
                onClick={onNext}
                className="gap-2"
              >
                <span className="hidden sm:inline">Dalej</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
