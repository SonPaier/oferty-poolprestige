import React, { createContext, useContext, useReducer, ReactNode, useMemo, useEffect } from 'react';
import { 
  FoilSubtype, 
  DEFAULT_SUBTYPE_PRICES, 
  CalculatedMaterial, 
  calculateMaterials, 
  calculatePoolAreas,
  getFoilLineItems,
  FoilLineItem,
  PoolAreas,
} from '@/lib/finishingMaterials';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { autoOptimizeMixConfig, calculateFoilAreaForPricing, calculateButtJointMeters } from '@/lib/foil/mixPlanner';

// Types
export type FinishingType = 'foil' | 'ceramic' | null;

export interface FinishingWizardState {
  // Main selection
  finishingType: FinishingType;
  
  // Foil subtype (3 price variants)
  selectedSubtype: FoilSubtype | null;
  subtypePrices: Record<FoilSubtype, number>;
  
  // Specific product (optional)
  selectedProductId: string | null;
  selectedProductName: string | null;
  
  // Table filters
  filters: {
    manufacturer: string | null;
    shade: string | null;
    searchQuery: string;
  };
  
  // Foil quantity
  poolAreas: {
    totalArea: number;
    perimeter: number;
    bottomArea: number;
    netBottomArea: number;
    wallArea: number;
    stairsArea: number;
    stairsProjection: number;
    wadingPoolArea: number;
    wadingPoolProjection: number;
    buttJointMeters: number; // Butt joint weld length for structural foil
  };
  manualFoilQty: number | null;
  
  // Materials (hardcoded, with manual overrides)
  materials: CalculatedMaterial[];
  
  // UI state
  showColorGallery: boolean;
  showProductTable: boolean;
  requiresRecalculation: boolean;
}

// Actions
type FinishingWizardAction =
  | { type: 'SET_FINISHING_TYPE'; payload: FinishingType }
  | { type: 'SET_SELECTED_SUBTYPE'; payload: FoilSubtype | null }
  | { type: 'SET_SUBTYPE_PRICE'; payload: { subtype: FoilSubtype; price: number } }
  | { type: 'SET_SELECTED_PRODUCT'; payload: { id: string | null; name: string | null } }
  | { type: 'SET_FILTERS'; payload: Partial<FinishingWizardState['filters']> }
  | { type: 'SET_POOL_AREAS'; payload: FinishingWizardState['poolAreas'] }
  | { type: 'SET_MANUAL_FOIL_QTY'; payload: number | null }
  | { type: 'SET_MATERIALS'; payload: CalculatedMaterial[] }
  | { type: 'UPDATE_MATERIAL'; payload: { id: string; manualQty: number | null } }
  | { type: 'SET_SHOW_COLOR_GALLERY'; payload: boolean }
  | { type: 'SET_SHOW_PRODUCT_TABLE'; payload: boolean }
  | { type: 'SET_REQUIRES_RECALCULATION'; payload: boolean }
  | { type: 'RECALCULATE_MATERIALS' }
  | { type: 'RESET' };

// Initial state
const initialState: FinishingWizardState = {
  finishingType: null,
  selectedSubtype: null,
  subtypePrices: { ...DEFAULT_SUBTYPE_PRICES },
  selectedProductId: null,
  selectedProductName: null,
  filters: {
    manufacturer: null,
    shade: null,
    searchQuery: '',
  },
  poolAreas: {
    totalArea: 0,
    perimeter: 0,
    bottomArea: 0,
    netBottomArea: 0,
    wallArea: 0,
    stairsArea: 0,
    stairsProjection: 0,
    wadingPoolArea: 0,
    wadingPoolProjection: 0,
    buttJointMeters: 0,
  },
  manualFoilQty: null,
  materials: [],
  showColorGallery: false,
  showProductTable: false,
  requiresRecalculation: false,
};

// Reducer
function finishingWizardReducer(
  state: FinishingWizardState,
  action: FinishingWizardAction
): FinishingWizardState {
  switch (action.type) {
    case 'SET_FINISHING_TYPE':
      return {
        ...state,
        finishingType: action.payload,
        selectedSubtype: null,
        selectedProductId: null,
        selectedProductName: null,
        showProductTable: false,
      };

    case 'SET_SELECTED_SUBTYPE':
      return {
        ...state,
        selectedSubtype: action.payload,
        selectedProductId: null,
        selectedProductName: null,
        showProductTable: action.payload !== null,
      };

    case 'SET_SUBTYPE_PRICE':
      return {
        ...state,
        subtypePrices: {
          ...state.subtypePrices,
          [action.payload.subtype]: action.payload.price,
        },
      };

    case 'SET_SELECTED_PRODUCT':
      return {
        ...state,
        selectedProductId: action.payload.id,
        selectedProductName: action.payload.name,
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };

    case 'SET_POOL_AREAS':
      return {
        ...state,
        poolAreas: action.payload,
        requiresRecalculation: false,
      };

    case 'SET_MANUAL_FOIL_QTY':
      return {
        ...state,
        manualFoilQty: action.payload,
      };

    case 'SET_MATERIALS':
      return {
        ...state,
        materials: action.payload,
      };

    case 'UPDATE_MATERIAL':
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.payload.id
            ? { ...m, manualQty: action.payload.manualQty }
            : m
        ),
      };

    case 'SET_SHOW_COLOR_GALLERY':
      return {
        ...state,
        showColorGallery: action.payload,
      };

    case 'SET_SHOW_PRODUCT_TABLE':
      return {
        ...state,
        showProductTable: action.payload,
      };

    case 'SET_REQUIRES_RECALCULATION':
      return {
        ...state,
        requiresRecalculation: action.payload,
      };

    case 'RECALCULATE_MATERIALS':
      return {
        ...state,
        materials: calculateMaterials(state.poolAreas),
        manualFoilQty: null,
        requiresRecalculation: false,
      };

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
  // Computed values
  foilLineItem: FoilLineItem | null;
  structuralFoilLineItem: FoilLineItem | null;
  totalNet: number;
  canProceed: boolean;
}

const FinishingWizardContext = createContext<FinishingWizardContextType | undefined>(undefined);

// Provider
interface FinishingWizardProviderProps {
  children: ReactNode;
  initialFinishingType?: FinishingType;
}

export function FinishingWizardProvider({
  children,
  initialFinishingType,
}: FinishingWizardProviderProps) {
  const { state: configuratorState } = useConfigurator();
  const [state, dispatch] = useReducer(finishingWizardReducer, {
    ...initialState,
    finishingType: initialFinishingType ?? null,
  });

  // Calculate pool areas from configurator dimensions
  useEffect(() => {
    const dimensions = configuratorState.dimensions;
    const stairsWidth = dimensions.stairs?.width === 'full' 
      ? dimensions.width 
      : dimensions.stairs?.width;
    const areas = calculatePoolAreas({
      length: dimensions.length,
      width: dimensions.width,
      depth: dimensions.depth,
      depthDeep: dimensions.depthDeep,
      hasSlope: dimensions.hasSlope,
      stairs: dimensions.stairs ? {
        enabled: dimensions.stairs.enabled,
        width: stairsWidth,
        stepCount: dimensions.stairs.stepCount,
        stepDepth: dimensions.stairs.stepDepth,
      } : undefined,
      wadingPool: dimensions.wadingPool,
    });

    // Calculate butt joint meters for structural foil
    const autoConfig = autoOptimizeMixConfig(dimensions, state.selectedSubtype);
    const buttJointMeters = calculateButtJointMeters(autoConfig, dimensions, state.selectedSubtype);

    // Create full areas object with buttJointMeters
    const fullAreas: PoolAreas = {
      ...areas,
      buttJointMeters,
    };

    dispatch({
      type: 'SET_POOL_AREAS',
      payload: {
        totalArea: areas.totalArea,
        perimeter: areas.perimeter,
        bottomArea: areas.bottomArea,
        netBottomArea: areas.netBottomArea,
        wallArea: areas.wallArea,
        stairsArea: areas.stairsArea || 0,
        stairsProjection: areas.stairsProjection || 0,
        wadingPoolArea: areas.wadingPoolArea || 0,
        wadingPoolProjection: areas.wadingPoolProjection || 0,
        buttJointMeters,
      },
    });

    // Calculate materials with butt joint info
    dispatch({
      type: 'SET_MATERIALS',
      payload: calculateMaterials(fullAreas),
    });
  }, [
    configuratorState.dimensions.length,
    configuratorState.dimensions.width,
    configuratorState.dimensions.depth,
    configuratorState.dimensions.depthDeep,
    configuratorState.dimensions.hasSlope,
    configuratorState.dimensions.stairs?.enabled,
    configuratorState.dimensions.wadingPool?.enabled,
    state.selectedSubtype, // Recalculate when subtype changes (affects buttJointMeters)
  ]);

  // Computed: foil line items (main + structural)
  const { foilLineItem, structuralFoilLineItem } = useMemo(() => {
    if (!state.selectedSubtype) return { foilLineItem: null, structuralFoilLineItem: null };

    const autoConfig = autoOptimizeMixConfig(configuratorState.dimensions, state.selectedSubtype);
    const pricingResult = calculateFoilAreaForPricing(
      autoConfig,
      configuratorState.dimensions,
      state.selectedSubtype,
      'minWaste' // default priority
    );

    const mainArea = state.manualFoilQty ?? pricingResult.mainFoilArea;
    const structuralArea = pricingResult.structuralFoilArea;

    const items = getFoilLineItems(
      state.selectedSubtype,
      mainArea,
      structuralArea,
      state.subtypePrices[state.selectedSubtype],
      state.selectedProductName
    );

    return { 
      foilLineItem: items.main, 
      structuralFoilLineItem: items.structural,
    };
  }, [
    state.selectedSubtype,
    state.manualFoilQty,
    state.subtypePrices,
    state.selectedProductName,
    configuratorState.dimensions.length,
    configuratorState.dimensions.width,
    configuratorState.dimensions.depth,
    configuratorState.dimensions.depthDeep,
    configuratorState.dimensions.hasSlope,
    configuratorState.dimensions.stairs,
    configuratorState.dimensions.wadingPool,
  ]);

  // Computed: total net price
  const totalNet = useMemo(() => {
    const foilTotal = (foilLineItem?.total ?? 0) + (structuralFoilLineItem?.total ?? 0);
    const materialsTotal = state.materials.reduce((sum, m) => {
      const qty = m.manualQty ?? m.suggestedQty;
      return sum + qty * m.pricePerUnit;
    }, 0);
    return foilTotal + materialsTotal;
  }, [foilLineItem, structuralFoilLineItem, state.materials]);

  // Can proceed to next step
  const canProceed = useMemo(() => {
    return state.finishingType !== null && state.selectedSubtype !== null;
  }, [state.finishingType, state.selectedSubtype]);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      foilLineItem,
      structuralFoilLineItem,
      totalNet,
      canProceed,
    }),
    [state, foilLineItem, structuralFoilLineItem, totalNet, canProceed]
  );

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

// Re-export types for convenience
export type { CalculatedMaterial, FoilSubtype } from '@/lib/finishingMaterials';
