import { useConfigurator } from '@/context/ConfiguratorContext';
import { FinishingWizardProvider, useFinishingWizard, FinishingType } from './FinishingWizardContext';
import { FinishingWizardNavigation } from './FinishingWizardNavigation';
import { Step1TypeSelection } from './steps/Step1TypeSelection';
import { Step2ProductFiltering } from './steps/Step2ProductFiltering';
import { Step3SelectionLevel } from './steps/Step3SelectionLevel';
import { Step4FoilOptimization } from './steps/Step4FoilOptimization';
import { Step5InstallationMaterials } from './steps/Step5InstallationMaterials';
import { Step6VariantGeneration } from './steps/Step6VariantGeneration';
import { Step7ReviewSave } from './steps/Step7ReviewSave';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FinishingModuleWizardProps {
  onNext: () => void;
  onBack: () => void;
}

function WizardContent({ onNext, onBack }: FinishingModuleWizardProps) {
  const { state, dispatch, canProceedToStep, totalSteps } = useFinishingWizard();
  const { currentStep, finishingType, isLoading } = state;
  
  // Map step number to actual step for ceramic (which skips optimization)
  const getActualStep = (step: number): number => {
    if (finishingType === 'ceramic' && step >= 4) {
      return step + 1; // Skip step 4 (optimization)
    }
    return step;
  };
  
  const renderCurrentStep = () => {
    const actualStep = getActualStep(currentStep);
    
    switch (actualStep) {
      case 1:
        return <Step1TypeSelection />;
      case 2:
        return <Step2ProductFiltering />;
      case 3:
        return <Step3SelectionLevel />;
      case 4:
        return <Step4FoilOptimization />;
      case 5:
        return <Step5InstallationMaterials />;
      case 6:
        return <Step6VariantGeneration />;
      case 7:
        return <Step7ReviewSave onComplete={onNext} />;
      default:
        return <Step1TypeSelection />;
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      dispatch({ type: 'SET_STEP', payload: currentStep - 1 });
    } else {
      onBack();
    }
  };
  
  const handleNext = () => {
    if (currentStep < totalSteps) {
      dispatch({ type: 'SET_STEP', payload: currentStep + 1 });
    }
  };
  
  const canGoNext = canProceedToStep(currentStep + 1) && currentStep < totalSteps;
  const isLastStep = currentStep === totalSteps;
  
  return (
    <div className="space-y-4">
      <FinishingWizardNavigation />
      
      <div className="min-h-[400px]">
        {renderCurrentStep()}
      </div>
      
      {/* Navigation footer */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {currentStep === 1 ? 'Poprzedni moduł' : 'Wstecz'}
            </Button>
            
            {!isLastStep && (
              <Button
                onClick={handleNext}
                disabled={!canGoNext || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Przetwarzanie...
                  </>
                ) : (
                  <>
                    Dalej
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function FinishingModuleWizard({ onNext, onBack }: FinishingModuleWizardProps) {
  const { state } = useConfigurator();
  
  // Determine initial finishing type from pool configuration
  const initialType: FinishingType = 
    state.dimensions.liningType === 'ceramiczny' ? 'ceramic' : 'foil';
  
  return (
    <FinishingWizardProvider initialFinishingType={initialType}>
      <WizardContent onNext={onNext} onBack={onBack} />
    </FinishingWizardProvider>
  );
}
