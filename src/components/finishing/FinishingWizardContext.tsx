import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { Tables } from '@/integrations/supabase/types';

// Types for the finishing wizard
export type FinishingType = 'foil' | 'ceramic' | null;
export type SelectionLevel = 'subtype' | 'series' | 'product';
export type VariantLevel = 'economy' | 'standard' | 'premium';

export interface ProductFilters {
  subtype: string | null;
  colors: string[];
  searchQuery: string;
}

export interface SelectedSeries {
  manufacturer: string;
  series: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  suggestedQty: number;
  manualQty: number | null;
  pricePerUnit: number;
  productId?: string;
  isManual?: boolean;
  category?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  category: string;
  isOptional: boolean;
  isEnabled: boolean;
}

export interface VariantData {
  productId: string | null;
  productName: string;
  productPrice: number;
  materials: MaterialItem[];
  services: ServiceItem[];
  totalMaterialsNet: number;
  totalServicesNet: number;
  totalNet: number;
  totalGross: number;
}

export interface FoilOptimizationResultState {
  rollWidth: 1.65 | 2.05;
  totalAreaM2: number;
  wastePercentage: number;
  score: number;
  cuttingPlan: any;
  wastePieces: any[];
  isRecommended: boolean;
}

export interface FinishingWizardState {
  currentStep: number;
  finishingType: FinishingType;
  filters: ProductFilters;
  selectionLevel: SelectionLevel;
  selectedSubtype: string | null;
  selectedSeries: SelectedSeries | null;
  selectedProductId: string | null;
  
  // Foil optimization
  optimizationResults: FoilOptimizationResultState[];
  selectedRollWidth: 1.65 | 2.05;
  isOptimizing: boolean;
  
  // Materials and services
  materials: MaterialItem[];
  services: ServiceItem[];
  
  // Variants
  variants: {
    economy: VariantData | null;
    standard: VariantData | null;
    premium: VariantData | null;
  };
  defaultVariant: VariantLevel;
  
  // Meta
  isDraft: boolean;
  requiresRecalculation: boolean;
  isLoading: boolean;
}

// Action types
type FinishingWizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_FINISHING_TYPE'; payload: FinishingType }
  | { type: 'SET_FILTERS'; payload: Partial<ProductFilters> }
  | { type: 'SET_SELECTION_LEVEL'; payload: SelectionLevel }
  | { type: 'SET_SELECTED_SUBTYPE'; payload: string | null }
  | { type: 'SET_SELECTED_SERIES'; payload: SelectedSeries | null }
  | { type: 'SET_SELECTED_PRODUCT'; payload: string | null }
  | { type: 'SET_OPTIMIZATION_RESULTS'; payload: FoilOptimizationResultState[] }
  | { type: 'SET_SELECTED_ROLL_WIDTH'; payload: 1.65 | 2.05 }
  | { type: 'SET_IS_OPTIMIZING'; payload: boolean }
  | { type: 'SET_MATERIALS'; payload: MaterialItem[] }
  | { type: 'UPDATE_MATERIAL'; payload: { id: string; updates: Partial<MaterialItem> } }
  | { type: 'ADD_MATERIAL'; payload: MaterialItem }
  | { type: 'REMOVE_MATERIAL'; payload: string }
  | { type: 'SET_SERVICES'; payload: ServiceItem[] }
  | { type: 'UPDATE_SERVICE'; payload: { id: string; updates: Partial<ServiceItem> } }
  | { type: 'SET_VARIANTS'; payload: { economy: VariantData | null; standard: VariantData | null; premium: VariantData | null } }
  | { type: 'SET_DEFAULT_VARIANT'; payload: VariantLevel }
  | { type: 'SET_IS_DRAFT'; payload: boolean }
  | { type: 'SET_REQUIRES_RECALCULATION'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'RESET' };

// Initial state
const initialState: FinishingWizardState = {
  currentStep: 1,
  finishingType: null,
  filters: {
    subtype: null,
    colors: [],
    searchQuery: '',
  },
  selectionLevel: 'product',
  selectedSubtype: null,
  selectedSeries: null,
  selectedProductId: null,
  optimizationResults: [],
  selectedRollWidth: 1.65,
  isOptimizing: false,
  materials: [],
  services: [],
  variants: {
    economy: null,
    standard: null,
    premium: null,
  },
  defaultVariant: 'standard',
  isDraft: true,
  requiresRecalculation: false,
  isLoading: false,
};

// Reducer
function finishingWizardReducer(
  state: FinishingWizardState,
  action: FinishingWizardAction
): FinishingWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    
    case 'SET_FINISHING_TYPE':
      // Reset selections when type changes
      return {
        ...state,
        finishingType: action.payload,
        selectedSubtype: null,
        selectedSeries: null,
        selectedProductId: null,
        optimizationResults: [],
        materials: [],
        services: [],
        variants: { economy: null, standard: null, premium: null },
        requiresRecalculation: true,
      };
    
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };
    
    case 'SET_SELECTION_LEVEL':
      return {
        ...state,
        selectionLevel: action.payload,
        // Reset specific selection when level changes
        selectedProductId: action.payload === 'product' ? state.selectedProductId : null,
        selectedSeries: action.payload === 'series' ? state.selectedSeries : null,
        selectedSubtype: action.payload === 'subtype' ? state.selectedSubtype : null,
      };
    
    case 'SET_SELECTED_SUBTYPE':
      return { ...state, selectedSubtype: action.payload, requiresRecalculation: true };
    
    case 'SET_SELECTED_SERIES':
      return { ...state, selectedSeries: action.payload, requiresRecalculation: true };
    
    case 'SET_SELECTED_PRODUCT':
      return { ...state, selectedProductId: action.payload, requiresRecalculation: true };
    
    case 'SET_OPTIMIZATION_RESULTS':
      return { ...state, optimizationResults: action.payload };
    
    case 'SET_SELECTED_ROLL_WIDTH':
      return { ...state, selectedRollWidth: action.payload };
    
    case 'SET_IS_OPTIMIZING':
      return { ...state, isOptimizing: action.payload };
    
    case 'SET_MATERIALS':
      return { ...state, materials: action.payload };
    
    case 'UPDATE_MATERIAL':
      return {
        ...state,
        materials: state.materials.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m
        ),
      };
    
    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, action.payload] };
    
    case 'REMOVE_MATERIAL':
      return {
        ...state,
        materials: state.materials.filter(m => m.id !== action.payload),
      };
    
    case 'SET_SERVICES':
      return { ...state, services: action.payload };
    
    case 'UPDATE_SERVICE':
      return {
        ...state,
        services: state.services.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
    
    case 'SET_VARIANTS':
      return { ...state, variants: action.payload };
    
    case 'SET_DEFAULT_VARIANT':
      return { ...state, defaultVariant: action.payload };
    
    case 'SET_IS_DRAFT':
      return { ...state, isDraft: action.payload };
    
    case 'SET_REQUIRES_RECALCULATION':
      return { ...state, requiresRecalculation: action.payload };
    
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
}

// Context
interface FinishingWizardContextType {
  state: FinishingWizardState;
  dispatch: React.Dispatch<FinishingWizardAction>;
  // Helper functions
  canProceedToStep: (step: number) => boolean;
  getStepLabel: (step: number) => string;
  totalSteps: number;
}

const FinishingWizardContext = createContext<FinishingWizardContextType | undefined>(undefined);

// Provider
interface FinishingWizardProviderProps {
  children: ReactNode;
  initialFinishingType?: FinishingType;
}

export function FinishingWizardProvider({ 
  children, 
  initialFinishingType 
}: FinishingWizardProviderProps) {
  const [state, dispatch] = useReducer(finishingWizardReducer, {
    ...initialState,
    finishingType: initialFinishingType ?? null,
  });
  
  // Step labels for navigation
  const stepLabels: Record<number, string> = {
    1: 'Typ wykończenia',
    2: 'Filtrowanie',
    3: 'Wybór produktu',
    4: 'Optymalizacja',
    5: 'Materiały',
    6: 'Warianty',
    7: 'Podsumowanie',
  };
  
  const totalSteps = state.finishingType === 'foil' ? 7 : 6; // Skip optimization for ceramic
  
  // Check if user can proceed to a specific step
  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return state.finishingType !== null;
      case 3:
        return state.finishingType !== null;
      case 4:
        // For foil: need product/series/subtype selected
        // For ceramic: skip this step
        if (state.finishingType === 'ceramic') return true;
        return (
          state.selectedProductId !== null ||
          state.selectedSeries !== null ||
          state.selectedSubtype !== null
        );
      case 5:
        if (state.finishingType === 'ceramic') {
          return (
            state.selectedProductId !== null ||
            state.selectedSeries !== null ||
            state.selectedSubtype !== null
          );
        }
        return state.optimizationResults.length > 0;
      case 6:
        return state.materials.length > 0;
      case 7:
        return (
          state.variants.economy !== null ||
          state.variants.standard !== null ||
          state.variants.premium !== null
        );
      default:
        return false;
    }
  };
  
  const getStepLabel = (step: number): string => {
    return stepLabels[step] || `Krok ${step}`;
  };
  
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    canProceedToStep,
    getStepLabel,
    totalSteps,
  }), [state, totalSteps]);
  
  return (
    <FinishingWizardContext.Provider value={contextValue}>
      {children}
    </FinishingWizardContext.Provider>
  );
}

// Hook
export function useFinishingWizard() {
  const context = useContext(FinishingWizardContext);
  if (context === undefined) {
    throw new Error('useFinishingWizard must be used within a FinishingWizardProvider');
  }
  return context;
}
