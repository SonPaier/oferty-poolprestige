import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { 
  ConfiguratorState, 
  PoolType, 
  PoolDimensions, 
  CustomerData,
  ConfiguratorSection,
  OfferItem,
  defaultCompanySettings,
  CompanySettings
} from '@/types/configurator';
import { Product } from '@/data/products';

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
  | { type: 'RESET' };

const initialDimensions: PoolDimensions = {
  shape: 'prostokatny',
  length: 8,
  width: 4,
  depth: 1.5,
  isIrregular: false,
  overflowType: 'skimmerowy',
  attractions: 0,
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

const initialState: ConfiguratorState = {
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
};

function configuratorReducer(state: ConfiguratorState, action: ConfiguratorAction): ConfiguratorState {
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
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
}

interface ConfiguratorContextType {
  state: ConfiguratorState;
  dispatch: React.Dispatch<ConfiguratorAction>;
  companySettings: CompanySettings;
  setCompanySettings: (settings: CompanySettings) => void;
}

const ConfiguratorContext = createContext<ConfiguratorContextType | undefined>(undefined);

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(configuratorReducer, initialState);
  const [companySettings, setCompanySettings] = React.useState<CompanySettings>(defaultCompanySettings);

  return (
    <ConfiguratorContext.Provider value={{ state, dispatch, companySettings, setCompanySettings }}>
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
