import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useBlocker } from 'react-router-dom';
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
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { Toaster, toast } from 'sonner';
import { getOfferByIdFromDb } from '@/lib/offerDb';

const DRAFT_STORAGE_KEY = 'pool_prestige_draft';

interface DraftData {
  draftId: string;
  savedAt: string;
  state: any;
}

function saveDraft(state: any): string {
  const existingDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
  let draftId = crypto.randomUUID();
  
  if (existingDraft) {
    try {
      const parsed = JSON.parse(existingDraft);
      if (parsed.draftId) {
        draftId = parsed.draftId;
      }
    } catch {}
  }
  
  const draft: DraftData = {
    draftId,
    savedAt: new Date().toISOString(),
    state,
  };
  
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  return draftId;
}

function loadDraft(): DraftData | null {
  try {
    const data = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {}
  return null;
}

function clearDraft(): void {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

function ConfiguratorContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch } = useConfigurator();
  const { companySettings, excavationSettings, setCompanySettings, setExcavationSettings, isLoading } = useSettings();
  const { step } = state;
  
  const [showSettings, setShowSettings] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track changes
  const markAsChanged = useCallback(() => {
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }
    // Auto-save draft
    saveDraft(state);
  }, [hasUnsavedChanges, state]);

  // Save draft whenever state changes
  useEffect(() => {
    if (step > 1 || state.customerData.contactPerson) {
      markAsChanged();
    }
  }, [state, markAsChanged, step]);

  // Navigation blocker
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      return hasUnsavedChanges && 
             currentLocation.pathname !== nextLocation.pathname &&
             !isSaving;
    }
  );

  // Handle blocker state
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setPendingNavigation(blocker.location.pathname);
      setShowUnsavedDialog(true);
    }
  }, [blocker.state]);

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
        setSearchParams({});
        setHasUnsavedChanges(false); // Just loaded, no changes yet
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
    setHasUnsavedChanges(false);
    clearDraft();
  };

  const handleNewOffer = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation('/nowa-oferta');
      setShowUnsavedDialog(true);
    } else {
      resetConfigurator();
    }
  };

  const handleDiscard = () => {
    setHasUnsavedChanges(false);
    clearDraft();
    setShowUnsavedDialog(false);
    
    if (blocker.state === 'blocked') {
      blocker.proceed();
    } else if (pendingNavigation) {
      if (pendingNavigation === '/nowa-oferta') {
        resetConfigurator();
      } else {
        navigate(pendingNavigation);
      }
    }
    setPendingNavigation(null);
  };

  const handleContinueEditing = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleSaveAndLeave = () => {
    setIsSaving(true);
    // Go to summary step to save
    goToStep(10);
    setShowUnsavedDialog(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
    setPendingNavigation(null);
    setIsSaving(false);
    toast.info('Przejdź do kroku "Podsumowanie" aby zapisać ofertę');
  };

  const onOfferSaved = () => {
    setHasUnsavedChanges(false);
    clearDraft();
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
        return (
          <SummaryStep 
            onBack={prevStep} 
            onReset={resetConfigurator} 
            excavationSettings={excavationSettings} 
            companySettings={companySettings}
            onOfferSaved={onOfferSaved}
          />
        );
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
        onNewOffer={handleNewOffer}
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

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onDiscard={handleDiscard}
        onSave={handleSaveAndLeave}
        onContinue={handleContinueEditing}
      />
    </div>
  );
}

const NewOffer = () => {
  return (
    <ConfiguratorProvider>
      <ConfiguratorContent />
      <Toaster position="top-right" richColors />
    </ConfiguratorProvider>
  );
};

export default NewOffer;
