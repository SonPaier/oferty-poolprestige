import { useState } from 'react';
import { ConfiguratorProvider, useConfigurator } from '@/context/ConfiguratorContext';
import { Header } from '@/components/Header';
import { StepNavigation } from '@/components/StepNavigation';
import { CustomerStep } from '@/components/steps/CustomerStep';
import { DimensionsStep } from '@/components/steps/DimensionsStep';
import { FoilStep } from '@/components/steps/FoilStep';
import { EquipmentStep } from '@/components/steps/EquipmentStep';
import { FiltrationStep } from '@/components/steps/FiltrationStep';
import { LightingStep } from '@/components/steps/LightingStep';
import { AutomationStep } from '@/components/steps/AutomationStep';
import { SummaryStep } from '@/components/steps/SummaryStep';
import { Toaster } from 'sonner';

function ConfiguratorContent() {
  const { state, dispatch } = useConfigurator();
  const { step } = state;

  const goToStep = (newStep: number) => {
    dispatch({ type: 'SET_STEP', payload: newStep });
  };

  const nextStep = () => goToStep(step + 1);
  const prevStep = () => goToStep(step - 1);
  const resetConfigurator = () => dispatch({ type: 'RESET' });

  const renderStep = () => {
    switch (step) {
      case 1:
        return <CustomerStep onNext={nextStep} />;
      case 2:
        return <DimensionsStep onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <FoilStep onNext={nextStep} onBack={prevStep} />;
      case 4:
        return <EquipmentStep onNext={nextStep} onBack={prevStep} />;
      case 5:
        return <FiltrationStep onNext={nextStep} onBack={prevStep} />;
      case 6:
        return <LightingStep onNext={nextStep} onBack={prevStep} />;
      case 7:
        return <AutomationStep onNext={nextStep} onBack={prevStep} />;
      case 8:
        return <SummaryStep onBack={prevStep} onReset={resetConfigurator} />;
      default:
        return <CustomerStep onNext={nextStep} />;
    }
  };

  return (
    <div className="min-h-screen">
      <Header onNewOffer={resetConfigurator} />
      
      <main className="container mx-auto px-4 py-6">
        <StepNavigation 
          currentStep={step} 
          onStepClick={goToStep}
        />
        
        {renderStep()}
      </main>
    </div>
  );
}

const Index = () => {
  return (
    <ConfiguratorProvider>
      <ConfiguratorContent />
      <Toaster position="top-right" richColors />
    </ConfiguratorProvider>
  );
};

export default Index;
