import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useBlocker } from 'react-router-dom';
import { ConfiguratorProvider, useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Header } from '@/components/Header';
import { StepNavigation } from '@/components/StepNavigation';
import { BottomNavigationBar } from '@/components/BottomNavigationBar';
import { CustomerStep } from '@/components/steps/CustomerStep';
import { DimensionsStep } from '@/components/steps/DimensionsStep';
import { CoveringStep } from '@/components/steps/CoveringStep';
import { EquipmentStep } from '@/components/steps/EquipmentStep';
import { FiltrationStep } from '@/components/steps/FiltrationStep';
import { LightingStep } from '@/components/steps/LightingStep';
import { AutomationStep } from '@/components/steps/AutomationStep';
import { AttractionsStep } from '@/components/steps/AttractionsStep';
import { GroundworksStep } from '@/components/steps/GroundworksStep';
import { AdditionsStep } from '@/components/steps/AdditionsStep';
import { SummaryStep } from '@/components/steps/SummaryStep';
import { SettingsDialog } from '@/components/SettingsDialog';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { useOfferSave } from '@/hooks/useOfferSave';
import { toast } from 'sonner';
import { getOfferByIdFromDb } from '@/lib/offerDb';

const DRAFT_STORAGE_KEY = 'pool_prestige_draft';
const TOTAL_STEPS = 11;

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
  const { saveCurrentOffer, isSaving } = useOfferSave();
  const { step } = state;
  
  const [showSettings, setShowSettings] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Track initial state for comparison
  const [initialStateSnapshot, setInitialStateSnapshot] = useState<string | null>(null);

  // Create snapshot of relevant state for comparison
  const createStateSnapshot = useCallback((s: typeof state) => {
    return JSON.stringify({
      customerData: s.customerData,
      dimensions: s.dimensions,
      sections: s.sections,
      poolType: s.poolType,
      foilType: s.foilType,
    });
  }, []);

  // Set initial snapshot when offer is loaded or component mounts
  useEffect(() => {
    if (state.editMode.isEditing && !initialStateSnapshot) {
      setInitialStateSnapshot(createStateSnapshot(state));
    }
  }, [state.editMode.isEditing, initialStateSnapshot, createStateSnapshot, state]);

  // Check if there are actual changes
  useEffect(() => {
    if (!initialStateSnapshot && !state.editMode.isEditing) {
      // For new offers, check if anything meaningful was entered
      const hasContent = Boolean(state.customerData.contactPerson) || 
                         Object.values(state.sections).some(s => s.items.length > 0);
      if (hasContent !== hasUnsavedChanges) {
        setHasUnsavedChanges(hasContent);
      }
      if (hasContent) {
        saveDraft(state);
      }
    } else if (initialStateSnapshot) {
      // For editing, compare with initial snapshot
      const currentSnapshot = createStateSnapshot(state);
      const changed = currentSnapshot !== initialStateSnapshot;
      if (changed !== hasUnsavedChanges) {
        setHasUnsavedChanges(changed);
      }
      if (changed) {
        saveDraft(state);
      }
    }
  }, [state, initialStateSnapshot, createStateSnapshot, hasUnsavedChanges]);

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
        setHasUnsavedChanges(false);
        // Set initial snapshot after loading
        setInitialStateSnapshot(createStateSnapshot({
          ...state,
          customerData: offer.customerData,
          dimensions: offer.dimensions,
          sections: offer.sections as typeof state.sections,
          poolType: offer.poolType,
          foilType: (offer as any).foilType || state.foilType,
        }));
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

  const handleSaveFromDialog = async () => {
    const result = await saveCurrentOffer('draft');
    if (result.success) {
      setHasUnsavedChanges(false);
      clearDraft();
      setShowUnsavedDialog(false);
      
      if (blocker.state === 'blocked') {
        blocker.proceed();
      } else if (pendingNavigation && pendingNavigation !== '/nowa-oferta') {
        navigate(pendingNavigation);
      }
    }
    setPendingNavigation(null);
  };

  const handleQuickSave = async () => {
    const result = await saveCurrentOffer('draft');
    if (result.success) {
      setHasUnsavedChanges(false);
      clearDraft();
      
      // If this was a new offer, switch to edit mode so subsequent saves update the same offer
      if (!state.editMode.isEditing && result.offerId) {
        dispatch({
          type: 'SET_EDIT_MODE',
          payload: {
            isEditing: true,
            offerId: result.offerId,
            offerNumber: result.offerNumber || null,
            shareUid: result.shareUid || null,
          }
        });
      }
    }
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
        return <GroundworksStep onNext={nextStep} onBack={prevStep} excavationSettings={excavationSettings} />;
      case 4:
        return <CoveringStep onNext={nextStep} onBack={prevStep} />;
      case 5:
        return <EquipmentStep onNext={nextStep} onBack={prevStep} />;
      case 6:
        return <FiltrationStep onNext={nextStep} onBack={prevStep} />;
      case 7:
        return <LightingStep onNext={nextStep} onBack={prevStep} />;
      case 8:
        return <AutomationStep onNext={nextStep} onBack={prevStep} />;
      case 9:
        return <AttractionsStep onNext={nextStep} onBack={prevStep} />;
      case 10:
        return <AdditionsStep onNext={nextStep} onBack={prevStep} />;
      case 11:
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
    <div className="min-h-screen pb-20">
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

      {/* Fixed bottom navigation bar */}
      <BottomNavigationBar
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        onNext={nextStep}
        onBack={prevStep}
        onSave={handleQuickSave}
        isSaving={isSaving}
        hasChanges={hasUnsavedChanges}
        isEditMode={state.editMode.isEditing}
        sourceEmail={state.customerData.sourceEmail}
      />

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
        onSave={handleSaveFromDialog}
        onContinue={handleContinueEditing}
      />
    </div>
  );
}

const NewOffer = () => {
  return (
    <ConfiguratorProvider>
      <ConfiguratorContent />
    </ConfiguratorProvider>
  );
};

export default NewOffer;
