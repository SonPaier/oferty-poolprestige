import { useState, useEffect } from 'react';
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
import { ExcavationStep } from '@/components/steps/ExcavationStep';
import { AdditionsStep } from '@/components/steps/AdditionsStep';
import { SummaryStep } from '@/components/steps/SummaryStep';
import { SettingsDialog } from '@/components/SettingsDialog';
import { OfferHistoryDialog } from '@/components/OfferHistoryDialog';
import { ExcavationSettings, defaultExcavationSettings, SavedOffer } from '@/types/offers';
import { Toaster, toast } from 'sonner';

function ConfiguratorContent() {
  const { state, dispatch, companySettings, setCompanySettings } = useConfigurator();
  const { step } = state;
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [excavationSettings, setExcavationSettings] = useState<ExcavationSettings>(() => {
    try {
      const saved = localStorage.getItem('pool_prestige_excavation_settings');
      return saved ? JSON.parse(saved) : defaultExcavationSettings;
    } catch {
      return defaultExcavationSettings;
    }
  });

  const saveExcavationSettings = (settings: ExcavationSettings) => {
    setExcavationSettings(settings);
    localStorage.setItem('pool_prestige_excavation_settings', JSON.stringify(settings));
  };

  const goToStep = (newStep: number) => {
    dispatch({ type: 'SET_STEP', payload: newStep });
  };

  const nextStep = () => goToStep(step + 1);
  const prevStep = () => goToStep(step - 1);
  const resetConfigurator = () => dispatch({ type: 'RESET' });

  const handleViewOffer = (offer: SavedOffer) => {
    // Load offer into state
    dispatch({ type: 'SET_CUSTOMER_DATA', payload: offer.customerData });
    dispatch({ type: 'SET_POOL_TYPE', payload: offer.poolType });
    dispatch({ type: 'SET_DIMENSIONS', payload: offer.dimensions });
    dispatch({ type: 'SET_CALCULATIONS', payload: offer.calculations });
    
    Object.entries(offer.sections).forEach(([key, section]) => {
      dispatch({
        type: 'SET_SECTION',
        payload: {
          section: key as any,
          data: { id: key, name: key, items: section.items },
        },
      });
    });
    
    dispatch({ type: 'SET_STEP', payload: 10 });
    setShowHistory(false);
    toast.success('Oferta załadowana', { description: offer.offerNumber });
  };

  const handleCopyOffer = (offer: SavedOffer) => {
    // Load offer but start fresh
    dispatch({ type: 'SET_CUSTOMER_DATA', payload: { ...offer.customerData, contactPerson: '', phone: '', email: '' } });
    dispatch({ type: 'SET_POOL_TYPE', payload: offer.poolType });
    dispatch({ type: 'SET_DIMENSIONS', payload: offer.dimensions });
    
    Object.entries(offer.sections).forEach(([key, section]) => {
      dispatch({
        type: 'SET_SECTION',
        payload: {
          section: key as any,
          data: { id: key, name: key, items: section.items },
        },
      });
    });
    
    dispatch({ type: 'SET_STEP', payload: 1 });
    setShowHistory(false);
    toast.success('Oferta skopiowana', { description: 'Uzupełnij dane nowego klienta' });
  };

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
        return <ExcavationStep onNext={nextStep} onBack={prevStep} excavationSettings={excavationSettings} />;
      case 9:
        return <AdditionsStep onNext={nextStep} onBack={prevStep} />;
      case 10:
        return <SummaryStep onBack={prevStep} onReset={resetConfigurator} excavationSettings={excavationSettings} />;
      default:
        return <CustomerStep onNext={nextStep} />;
    }
  };

  return (
    <div className="min-h-screen">
      <Header 
        onNewOffer={resetConfigurator}
        onSettingsClick={() => setShowSettings(true)}
        onHistoryClick={() => setShowHistory(true)}
      />
      
      <main className="container mx-auto px-4 py-6">
        <StepNavigation 
          currentStep={step} 
          onStepClick={goToStep}
        />
        
        {renderStep()}
      </main>

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        companySettings={companySettings}
        onSaveCompanySettings={setCompanySettings}
        excavationSettings={excavationSettings}
        onSaveExcavationSettings={saveExcavationSettings}
      />

      <OfferHistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onViewOffer={handleViewOffer}
        onCopyOffer={handleCopyOffer}
      />
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
