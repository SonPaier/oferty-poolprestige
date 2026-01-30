import { FinishingModuleWizard } from '@/components/finishing/FinishingModuleWizard';

interface CoveringStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * CoveringStep - Wrapper for the new 7-step Finishing Module Wizard
 * Provides backward compatibility with the existing step navigation system
 */
export function CoveringStep({ onNext, onBack }: CoveringStepProps) {
  return <FinishingModuleWizard onNext={onNext} onBack={onBack} />;
}
