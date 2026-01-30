import { FinishingModuleWizard } from '@/components/finishing/FinishingModuleWizard';

interface CoveringStepProps {
  onNext: () => void;
  onBack: () => void;
}

// Re-export the new wizard as CoveringStep for backward compatibility
export function CoveringStep({ onNext, onBack }: CoveringStepProps) {
  return <FinishingModuleWizard onNext={onNext} onBack={onBack} />;
}
