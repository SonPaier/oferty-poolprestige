import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { 
  ConfiguratorState, 
  PoolType, 
  PoolDimensions, 
  CustomerData,
  ConfiguratorSection,
  OfferItem
} from '@/types/configurator';
import { Product } from '@/data/products';
import { SavedOffer } from '@/types/offers';

export interface EditModeInfo {
  isEditing: boolean;
  offerId: string | null;
  offerNumber: string | null;
  shareUid: string | null;
}

type ConfiguratorAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_POOL_TYPE'; payload: PoolType }
  | { type: 'SET_DIMENSIONS'; payload: PoolDimensions }
  | { type: 'SET_CUSTOMER_DATA'; payload: CustomerData }
  | { type: 'SET_FOIL_TYPE'; payload: 'tradycyjna' | 'strukturalna' }
  | { type: 'ADD_ITEM'; payload: { section: keyof ConfiguratorState['sections']; item: OfferItem } }
  | { type: 'REMOVE_ITEM'; payload: { section: keyof ConfiguratorState['sections']; itemId: string } }
  | { type: 'UPDATE_ITEM_QUANTITY'; payload: { section: keyof ConfiguratorState['sections']; itemId: string; quantity: number } }
  | { type: 'SET_CALCULATIONS'; payload: ConfiguratorState['calculations'] }
  | { type: 'SET_FOIL_CALCULATION'; payload: ConfiguratorState['foilCalculation'] }
  | { type: 'SET_SECTION'; payload: { section: keyof ConfiguratorState['sections']; data: ConfiguratorSection } }
  | { type: 'LOAD_OFFER'; payload: { offer: SavedOffer & { shareUid: string } } }
  | { type: 'SET_EDIT_MODE'; payload: EditModeInfo }
  | { type: 'CLEAR_EDIT_MODE' }
  | { type: 'RESET' };

const initialDimensions: PoolDimensions = {
  shape: 'prostokatny',
  length: 8,
  width: 4,
  depth: 1.5,
  depthDeep: undefined,
  hasSlope: false,
  isIrregular: false,
  overflowType: 'skimmerowy',
  attractions: 0,
  stairs: {
    enabled: false,
    position: 'inside',
    corner: 'back-left',
    direction: 'along-width',
    width: 1.5,
    stepHeight: 0.29,
    stepCount: 5,
    stepDepth: 0.29,
  },
  wadingPool: {
    enabled: false,
    corner: 'back-left',
    direction: 'along-width',
    width: 2,
    length: 1.5,
    depth: 0.4,
    position: 'inside',
  },
};

const initialCustomerData: CustomerData = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  nip: '',
  sourceEmail: '',
};

const createEmptySection = (id: string, name: string): ConfiguratorSection => ({
  id,
  name,
  items: [],
});

const initialEditMode: EditModeInfo = {
  isEditing: false,
  offerId: null,
  offerNumber: null,
  shareUid: null,
};

interface ExtendedConfiguratorState extends ConfiguratorState {
  editMode: EditModeInfo;
}

const initialState: ExtendedConfiguratorState = {
  step: 1,
  poolType: 'prywatny',
  dimensions: initialDimensions,
  calculations: null,
  foilCalculation: null,
  customerData: initialCustomerData,
  foilType: 'tradycyjna',
  sections: {
    wykonczenie: createEmptySection('wykonczenie', 'Wykończenie basenu'),
    uzbrojenie: createEmptySection('uzbrojenie', 'Uzbrojenie niecki'),
    filtracja: createEmptySection('filtracja', 'Filtracja'),
    oswietlenie: createEmptySection('oswietlenie', 'Oświetlenie'),
    automatyka: createEmptySection('automatyka', 'Automatyka'),
    atrakcje: createEmptySection('atrakcje', 'Atrakcje'),
    dodatki: createEmptySection('dodatki', 'Dodatki'),
  },
  editMode: initialEditMode,
};

function configuratorReducer(state: ExtendedConfiguratorState, action: ConfiguratorAction): ExtendedConfiguratorState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    
    case 'SET_POOL_TYPE':
      return { ...state, poolType: action.payload };
    
    case 'SET_DIMENSIONS':
      return { ...state, dimensions: action.payload };
    
    case 'SET_CUSTOMER_DATA':
      return { ...state, customerData: action.payload };
    
    case 'SET_FOIL_TYPE':
      return { ...state, foilType: action.payload };
    
    case 'SET_CALCULATIONS':
      return { ...state, calculations: action.payload };
    
    case 'SET_FOIL_CALCULATION':
      return { ...state, foilCalculation: action.payload };
    
    case 'ADD_ITEM':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.payload.section]: {
            ...state.sections[action.payload.section],
            items: [...state.sections[action.payload.section].items, action.payload.item],
          },
        },
      };
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.payload.section]: {
            ...state.sections[action.payload.section],
            items: state.sections[action.payload.section].items.filter(
              item => item.id !== action.payload.itemId
            ),
          },
        },
      };
    
    case 'UPDATE_ITEM_QUANTITY':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.payload.section]: {
            ...state.sections[action.payload.section],
            items: state.sections[action.payload.section].items.map(item =>
              item.id === action.payload.itemId
                ? { ...item, quantity: action.payload.quantity }
                : item
            ),
          },
        },
      };
    
    case 'SET_SECTION':
      return {
        ...state,
        sections: {
          ...state.sections,
          [action.payload.section]: action.payload.data,
        },
      };
    
    case 'LOAD_OFFER': {
      const { offer } = action.payload;
      // Filter out 'inne' and 'opcje' sections as they are computed
      const filteredSections: Record<string, ConfiguratorSection> = {};
      const validSectionKeys = ['wykonczenie', 'uzbrojenie', 'filtracja', 'oswietlenie', 'automatyka', 'atrakcje', 'dodatki'];
      
      for (const key of validSectionKeys) {
        if (offer.sections[key]) {
          filteredSections[key] = {
            id: key,
            name: initialState.sections[key as keyof typeof initialState.sections]?.name || key,
            items: offer.sections[key].items || [],
          };
        } else {
          filteredSections[key] = createEmptySection(key, initialState.sections[key as keyof typeof initialState.sections]?.name || key);
        }
      }
      
      return {
        ...state,
        step: 1,
        poolType: offer.poolType,
        dimensions: offer.dimensions,
        calculations: offer.calculations,
        customerData: offer.customerData,
        sections: filteredSections as ExtendedConfiguratorState['sections'],
        editMode: {
          isEditing: true,
          offerId: offer.id,
          offerNumber: offer.offerNumber,
          shareUid: offer.shareUid,
        },
      };
    }
    
    case 'SET_EDIT_MODE':
      return {
        ...state,
        editMode: action.payload,
      };
    
    case 'CLEAR_EDIT_MODE':
      return {
        ...state,
        editMode: initialEditMode,
      };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
}

interface ConfiguratorContextType {
  state: ExtendedConfiguratorState;
  dispatch: React.Dispatch<ConfiguratorAction>;
}

const ConfiguratorContext = createContext<ConfiguratorContextType | undefined>(undefined);

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(configuratorReducer, initialState);

  return (
    <ConfiguratorContext.Provider value={{ state, dispatch }}>
      {children}
    </ConfiguratorContext.Provider>
  );
}

export function useConfigurator() {
  const context = useContext(ConfiguratorContext);
  if (context === undefined) {
    throw new Error('useConfigurator must be used within a ConfiguratorProvider');
  }
  return context;
}
