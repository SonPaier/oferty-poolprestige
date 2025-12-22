import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfiguratorProvider, useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
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
import { Toaster, toast } from 'sonner';
import { getOfferByIdFromDb } from '@/lib/offerDb';

function ConfiguratorContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, dispatch } = useConfigurator();
  const { companySettings, excavationSettings, setCompanySettings, setExcavationSettings, isLoading } = useSettings();
  const { step } = state;
  
  const [showSettings, setShowSettings] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);

  // Load offer for editing if edit param is present
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && !state.editMode.isEditing) {
      loadOfferForEdit(editId);
    }
  }, [searchParams]);

  const loadOfferForEdit = async (offerId: string) => {
    setLoadingOffer(true);
    try {
      const offer = await getOfferByIdFromDb(offerId);
      if (offer) {
        dispatch({ type: 'LOAD_OFFER', payload: { offer } });
        toast.success(`Załadowano ofertę ${offer.offerNumber} do edycji`);
        // Clear the URL param but keep us on the page
        setSearchParams({});
      } else {
        toast.error('Nie znaleziono oferty');
        setSearchParams({});
      }
    } catch (error) {
      console.error('Error loading offer:', error);
      toast.error('Błąd ładowania oferty');
      setSearchParams({});
    } finally {
      setLoadingOffer(false);
    }
  };

  const handleSaveCompanySettings = async (settings: typeof companySettings) => {
    await setCompanySettings(settings);
  };

  const handleSaveExcavationSettings = async (settings: typeof excavationSettings) => {
    await setExcavationSettings(settings);
  };

  const goToStep = (newStep: number) => {
    dispatch({ type: 'SET_STEP', payload: newStep });
  };

  const nextStep = () => goToStep(step + 1);
  const prevStep = () => goToStep(step - 1);
  const resetConfigurator = () => {
    dispatch({ type: 'RESET' });
    setSearchParams({});
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
        return <SummaryStep onBack={prevStep} onReset={resetConfigurator} excavationSettings={excavationSettings} companySettings={companySettings} />;
      default:
        return <CustomerStep onNext={nextStep} />;
    }
  };

  if (isLoading || loadingOffer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">
          {loadingOffer ? 'Ładowanie oferty...' : 'Ładowanie ustawień...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header 
        onNewOffer={resetConfigurator}
        onSettingsClick={() => setShowSettings(true)}
        editMode={state.editMode}
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
        onSaveCompanySettings={handleSaveCompanySettings}
        excavationSettings={excavationSettings}
        onSaveExcavationSettings={handleSaveExcavationSettings}
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
