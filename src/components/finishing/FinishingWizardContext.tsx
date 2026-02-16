import React, { createContext, useContext, useReducer, ReactNode, useMemo, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { 
  FoilSubtype, 
  UnderlayType,
  DEFAULT_SUBTYPE_PRICES, 
  CalculatedMaterial, 
  calculateMaterials, 
  calculatePoolAreas,
  getFoilLineItems,
  FoilLineItem,
  PoolAreas,
  MaterialContext,
} from '@/lib/finishingMaterials';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { autoOptimizeMixConfig, calculateFoilAreaForPricing, calculateButtJointMeters } from '@/lib/foil/mixPlanner';
import { ExtraLineItem } from '@/components/groundworks/ExtraLineItems';

// Types
export type FinishingType = 'foil' | 'ceramic' | null;

export interface FinishingWizardState {
  finishingType: FinishingType;
  selectedSubtype: FoilSubtype | null;
  subtypePrices: Record<FoilSubtype, number>;
  selectedProductId: string | null;
  selectedProductName: string | null;
  filters: {
    manufacturer: string | null;
    shade: string | null;
    searchQuery: string;
  };
  poolAreas: PoolAreas;
  manualFoilQty: number | null;
  materials: CalculatedMaterial[];
  underlayType: UnderlayType;
  extraItems: ExtraLineItem[];
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
  | { type: 'SET_POOL_AREAS'; payload: PoolAreas }
  | { type: 'SET_MANUAL_FOIL_QTY'; payload: number | null }
  | { type: 'SET_MATERIALS'; payload: CalculatedMaterial[] }
  | { type: 'UPDATE_MATERIAL'; payload: { id: string; manualQty: number | null } }
  | { type: 'UPDATE_MATERIAL_PRICE'; payload: { id: string; price: number } }
  | { type: 'SET_SHOW_COLOR_GALLERY'; payload: boolean }
  | { type: 'SET_SHOW_PRODUCT_TABLE'; payload: boolean }
  | { type: 'SET_REQUIRES_RECALCULATION'; payload: boolean }
  | { type: 'RECALCULATE_MATERIALS' }
  | { type: 'SET_UNDERLAY_TYPE'; payload: UnderlayType }
  | { type: 'ADD_EXTRA_ITEM'; payload: ExtraLineItem }
  | { type: 'REMOVE_EXTRA_ITEM'; payload: string }
  | { type: 'RESET' };

const defaultPoolAreas: PoolAreas = {
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
  poolLength: 0,
  poolWidth: 0,
  poolDepth: 0,
  stairsStepPerimeter: 0,
  wadingPoolPerimeter: 0,
  hasWadingWall: false,
  isGutterPool: false,
};

const initialState: FinishingWizardState = {
  finishingType: null,
  selectedSubtype: null,
  subtypePrices: { ...DEFAULT_SUBTYPE_PRICES },
  selectedProductId: null,
  selectedProductName: null,
  filters: { manufacturer: null, shade: null, searchQuery: '' },
  poolAreas: defaultPoolAreas,
  manualFoilQty: null,
  materials: [],
  underlayType: 'zwykly',
  extraItems: [],
  showColorGallery: false,
  showProductTable: false,
  requiresRecalculation: false,
};

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
        subtypePrices: { ...state.subtypePrices, [action.payload.subtype]: action.payload.price },
      };
    case 'SET_SELECTED_PRODUCT':
      return {
        ...state,
        selectedProductId: action.payload.id,
        selectedProductName: action.payload.name,
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_POOL_AREAS':
      return { ...state, poolAreas: action.payload, requiresRecalculation: false };
    case 'SET_MANUAL_FOIL_QTY':
      return { ...state, manualFoilQty: action.payload };
    case 'SET_MATERIALS':
      return { ...state, materials: action.payload };
    case 'UPDATE_MATERIAL':
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.payload.id ? { ...m, manualQty: action.payload.manualQty } : m
        ),
      };
    case 'UPDATE_MATERIAL_PRICE':
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.payload.id
            ? { ...m, pricePerUnit: action.payload.price, total: (m.manualQty ?? m.suggestedQty) * action.payload.price }
            : m
        ),
      };
    case 'SET_SHOW_COLOR_GALLERY':
      return { ...state, showColorGallery: action.payload };
    case 'SET_SHOW_PRODUCT_TABLE':
      return { ...state, showProductTable: action.payload };
    case 'SET_REQUIRES_RECALCULATION':
      return { ...state, requiresRecalculation: action.payload };
    case 'RECALCULATE_MATERIALS': {
      const ctx: MaterialContext = {
        selectedSubtype: state.selectedSubtype,
        underlayType: state.underlayType,
        materialQtys: {},
      };
      return {
        ...state,
        materials: calculateMaterials(state.poolAreas, ctx),
        manualFoilQty: null,
        requiresRecalculation: false,
      };
    }
    case 'SET_UNDERLAY_TYPE':
      return { ...state, underlayType: action.payload };
    case 'ADD_EXTRA_ITEM':
      return { ...state, extraItems: [...state.extraItems, action.payload] };
    case 'REMOVE_EXTRA_ITEM':
      return { ...state, extraItems: state.extraItems.filter((i) => i.id !== action.payload) };
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
  foilLineItem: FoilLineItem | null;
  structuralFoilLineItem: FoilLineItem | null;
  totalNet: number;
  canProceed: boolean;
}

const FinishingWizardContext = createContext<FinishingWizardContextType | undefined>(undefined);

interface FinishingWizardProviderProps {
  children: ReactNode;
  initialFinishingType?: FinishingType;
}

export function FinishingWizardProvider({
  children,
  initialFinishingType,
}: FinishingWizardProviderProps) {
  const { state: configuratorState } = useConfigurator();
  const { companySettings } = useSettings();
  const savedRates = companySettings.finishingMaterialRates;
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
      overflowType: dimensions.overflowType,
      stairs: dimensions.stairs ? {
        enabled: dimensions.stairs.enabled,
        width: stairsWidth,
        stepCount: dimensions.stairs.stepCount,
        stepDepth: dimensions.stairs.stepDepth,
        direction: dimensions.stairs.direction,
      } : undefined,
      wadingPool: dimensions.wadingPool,
    });

    // Calculate butt joint meters for structural foil
    const autoConfig = autoOptimizeMixConfig(dimensions, state.selectedSubtype);
    const buttJointMeters = calculateButtJointMeters(autoConfig, dimensions, state.selectedSubtype);

    const fullAreas: PoolAreas = { ...areas, buttJointMeters };

    dispatch({ type: 'SET_POOL_AREAS', payload: fullAreas });

    // Calculate materials with context
    const ctx: MaterialContext = {
      selectedSubtype: state.selectedSubtype,
      underlayType: state.underlayType,
      materialQtys: {},
    };
    const mats = calculateMaterials(fullAreas, ctx);
    const matsWithSavedRates = savedRates 
      ? mats.map(m => savedRates[m.id] !== undefined 
          ? { ...m, pricePerUnit: savedRates[m.id], total: m.suggestedQty * savedRates[m.id] }
          : m
        )
      : mats;
    dispatch({ type: 'SET_MATERIALS', payload: matsWithSavedRates });
  }, [
    configuratorState.dimensions.length,
    configuratorState.dimensions.width,
    configuratorState.dimensions.depth,
    configuratorState.dimensions.depthDeep,
    configuratorState.dimensions.hasSlope,
    configuratorState.dimensions.overflowType,
    configuratorState.dimensions.stairs?.enabled,
    configuratorState.dimensions.stairs?.stepCount,
    configuratorState.dimensions.stairs?.stepDepth,
    configuratorState.dimensions.stairs?.width,
    configuratorState.dimensions.stairs?.direction,
    configuratorState.dimensions.wadingPool?.enabled,
    configuratorState.dimensions.wadingPool?.width,
    configuratorState.dimensions.wadingPool?.length,
    configuratorState.dimensions.wadingPool?.hasDividingWall,
    state.selectedSubtype,
    state.underlayType,
    savedRates,
  ]);

  // Computed: foil line items
  const { foilLineItem, structuralFoilLineItem } = useMemo(() => {
    if (!state.selectedSubtype) return { foilLineItem: null, structuralFoilLineItem: null };

    const autoConfig = autoOptimizeMixConfig(configuratorState.dimensions, state.selectedSubtype);
    const pricingResult = calculateFoilAreaForPricing(
      autoConfig, configuratorState.dimensions, state.selectedSubtype, 'minWaste'
    );

    const mainArea = state.manualFoilQty ?? pricingResult.mainFoilArea;
    const structuralArea = pricingResult.structuralFoilArea;

    const items = getFoilLineItems(
      state.selectedSubtype, mainArea, structuralArea,
      state.subtypePrices[state.selectedSubtype], state.selectedProductName
    );

    return { foilLineItem: items.main, structuralFoilLineItem: items.structural };
  }, [
    state.selectedSubtype, state.manualFoilQty, state.subtypePrices,
    state.selectedProductName,
    configuratorState.dimensions.length, configuratorState.dimensions.width,
    configuratorState.dimensions.depth, configuratorState.dimensions.depthDeep,
    configuratorState.dimensions.hasSlope, configuratorState.dimensions.stairs,
    configuratorState.dimensions.wadingPool,
  ]);

  // Computed: total net price (including extra items)
  const totalNet = useMemo(() => {
    const foilTotal = (foilLineItem?.total ?? 0) + (structuralFoilLineItem?.total ?? 0);
    const materialsTotal = state.materials.reduce((sum, m) => {
      const qty = m.manualQty ?? m.suggestedQty;
      return sum + qty * m.pricePerUnit;
    }, 0);
    const extraTotal = state.extraItems.reduce((sum, i) => sum + i.netValue, 0);
    return foilTotal + materialsTotal + extraTotal;
  }, [foilLineItem, structuralFoilLineItem, state.materials, state.extraItems]);

  const canProceed = useMemo(() => {
    return state.finishingType !== null && state.selectedSubtype !== null;
  }, [state.finishingType, state.selectedSubtype]);

  const contextValue = useMemo(
    () => ({ state, dispatch, foilLineItem, structuralFoilLineItem, totalNet, canProceed }),
    [state, foilLineItem, structuralFoilLineItem, totalNet, canProceed]
  );

  return (
    <FinishingWizardContext.Provider value={contextValue}>
      {children}
    </FinishingWizardContext.Provider>
  );
}

export function useFinishingWizard() {
  const context = useContext(FinishingWizardContext);
  if (context === undefined) {
    throw new Error('useFinishingWizard must be used within a FinishingWizardProvider');
  }
  return context;
}

export type { CalculatedMaterial, FoilSubtype } from '@/lib/finishingMaterials';
