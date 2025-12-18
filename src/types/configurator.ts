import { Product } from '@/data/products';

export type PoolType = 'prywatny' | 'polprywatny' | 'hotelowy';
export type PoolShape = 'prostokatny' | 'owalny' | 'litera-l' | 'prostokatny-schodki-zewnetrzne' | 'prostokatny-schodki-narozne';
export type PoolOverflowType = 'skimmerowy' | 'rynnowy';

// Nominal load values for DIN filtration formula
export const nominalLoadByType: Record<PoolType, number> = {
  prywatny: 1,
  polprywatny: 0.8,
  hotelowy: 0.5,
};

export interface PoolDimensions {
  shape: PoolShape;
  length: number;
  width: number;
  depth: number; // Single depth (głębokość niecki)
  isIrregular: boolean;
  overflowType: PoolOverflowType;
  attractions: number; // Number of attractions (for public pools)
  // Additional dimensions for L-shape
  lLength2?: number; // Second arm length
  lWidth2?: number;  // Second arm width
}

export interface PoolCalculations {
  volume: number;
  surfaceArea: number;
  perimeterLength: number;
  wallArea: number;
  bottomArea: number;
  requiredFlow: number; // m3/h - wydajność filtracji wg DIN
  waterDepth: number; // głębokość wody (depth - 10cm for skimmer, = depth for gutter)
}

export interface FoilCalculation {
  totalArea: number;
  rolls165: number;
  rolls205: number;
  wastePercentage: number;
  irregularSurcharge: number;
}

export interface FilterCalculation {
  requiredFlow: number;
  filterMediaKg: number;
  suggestedFilter?: Product;
}

export interface CustomerData {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  nip?: string;
  sourceEmail?: string; // Original email content used for this offer
}

export interface OfferItem {
  id: string;
  product: Product;
  quantity: number;
  customPrice?: number;
  isManual?: boolean;
  notes?: string;
}

export interface ConfiguratorSection {
  id: string;
  name: string;
  items: OfferItem[];
  suggestedProduct?: Product;
  alternatives?: Product[];
}

export interface ConfiguratorState {
  step: number;
  poolType: PoolType;
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  foilCalculation: FoilCalculation | null;
  customerData: CustomerData;
  sections: {
    wykonczenie: ConfiguratorSection;
    uzbrojenie: ConfiguratorSection;
    filtracja: ConfiguratorSection;
    oswietlenie: ConfiguratorSection;
    automatyka: ConfiguratorSection;
    atrakcje: ConfiguratorSection;
    dodatki: ConfiguratorSection;
  };
  foilType: 'tradycyjna' | 'strukturalna';
}

export interface CompanySettings {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  nip: string;
  phone: string;
  email: string;
  website: string;
  irregularSurchargePercent: number;
  emailTemplate: EmailTemplateSettings;
  volumeCoefficientPercent: number; // 3% per m³ scaling for "INNE" section
  notesTemplate: string;
  paymentTermsTemplate: string;
}

export interface EmailTemplateSettings {
  greeting: string;
  body: string;
  signature: string;
  ccEmail: string;
}

export const defaultEmailTemplate: EmailTemplateSettings = {
  greeting: 'Dzień dobry,',
  body: 'W odpowiedzi na Pana zapytanie ofertowe, przesyłamy ofertę na basen. Oferta w załączniku.',
  signature: 'pozdrawiam,\nJakub Rohde, Pool Prestige',
  ccEmail: 'biuro@poolprestige.pl',
};

export const defaultCompanySettings: CompanySettings = {
  name: 'Pool Prestige',
  address: 'ul. Basenowa 15',
  city: 'Warszawa',
  postalCode: '00-001',
  nip: '1234567890',
  phone: '+48 123 456 789',
  email: 'kontakt@poolprestige.pl',
  website: 'www.poolprestige.pl',
  irregularSurchargePercent: 20,
  emailTemplate: defaultEmailTemplate,
  volumeCoefficientPercent: 3,
  notesTemplate: 'Oferta ważna 30 dni od daty wystawienia.',
  paymentTermsTemplate: 'Zaliczka 30% przy zamówieniu, pozostałe 70% przed montażem.',
};

export const poolTypeLabels: Record<PoolType, string> = {
  prywatny: 'Prywatny',
  polprywatny: 'Półprywatny',
  hotelowy: 'Hotelowy / Publiczny',
};

export const poolShapeLabels: Record<PoolShape, string> = {
  prostokatny: 'Prostokątny',
  owalny: 'Owalny',
  'litera-l': 'Litera L',
  'prostokatny-schodki-zewnetrzne': 'Prostokątny ze schodkami zewn.',
  'prostokatny-schodki-narozne': 'Prostokątny ze schodkami narożnymi',
};

// Overflow type labels
export const overflowTypeLabels: Record<PoolOverflowType, string> = {
  skimmerowy: 'Skimmerowy',
  rynnowy: 'Rynnowy (przelewowy)',
};
