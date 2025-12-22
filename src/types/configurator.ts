import { Product } from '@/data/products';

export type PoolType = 'prywatny' | 'polprywatny' | 'hotelowy';
export type PoolShape = 'prostokatny' | 'owalny' | 'litera-l' | 'prostokatny-schodki-zewnetrzne' | 'prostokatny-schodki-narozne' | 'wlasny';
export type PoolOverflowType = 'skimmerowy' | 'rynnowy';

export interface CustomPoolVertex {
  x: number;
  y: number;
}

export type StairsPosition = 'inside' | 'outside';
export type PoolCorner = 'back-left' | 'back-right' | 'front-left' | 'front-right';
export type WallDirection = 'along-length' | 'along-width'; // wzdłuż długości (X) lub szerokości (Y)

export interface StairsConfig {
  enabled: boolean;
  position: StairsPosition; // wewnątrz/zewnątrz basenu
  corner: PoolCorner; // który narożnik
  direction: WallDirection; // wzdłuż której ściany
  width: number | 'full'; // szerokość schodków lub 'full' = pełna szerokość boku
  stepHeight: number; // wysokość stopnia (domyślnie 0.29m)
  stepCount: number; // wyliczane z głębokości / stepHeight
  stepDepth: number; // głębokość stopnia (domyślnie 0.29m)
}

export interface WadingPoolConfig {
  enabled: boolean;
  corner: PoolCorner; // który narożnik
  direction: WallDirection; // wzdłuż której ściany
  width: number; // szerokość brodzika (wzdłuż ściany)
  length: number; // długość brodzika (w głąb basenu)
  depth: number; // głębokość brodzika (zazwyczaj 0.3-0.6m)
  position: StairsPosition; // wewnątrz/zewnątrz basenu
}

export const defaultStairsConfig: StairsConfig = {
  enabled: false,
  position: 'inside',
  corner: 'back-left',
  direction: 'along-width',
  width: 1.5,
  stepHeight: 0.29,
  stepCount: 4,
  stepDepth: 0.29,
};

export const defaultWadingPoolConfig: WadingPoolConfig = {
  enabled: false,
  corner: 'back-left',
  direction: 'along-width',
  width: 2,
  length: 1.5,
  depth: 0.4,
  position: 'inside',
};

export const stairsPositionLabels: Record<StairsPosition, string> = {
  inside: 'Wewnątrz basenu',
  outside: 'Na zewnątrz basenu',
};

export const poolCornerLabels: Record<PoolCorner, string> = {
  'back-left': 'Tylny lewy',
  'back-right': 'Tylny prawy',
  'front-left': 'Przedni lewy',
  'front-right': 'Przedni prawy',
};

export const wallDirectionLabels: Record<WallDirection, string> = {
  'along-length': 'Wzdłuż długości',
  'along-width': 'Wzdłuż szerokości',
};

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
  depth: number; // Głębokość płytka (min)
  depthDeep?: number; // Głębokość głęboka (max) - jeśli jest spadek
  hasSlope: boolean; // Czy basen ma spadek dna
  isIrregular: boolean;
  overflowType: PoolOverflowType;
  attractions: number; // Number of attractions (for public pools)
  // Additional dimensions for L-shape
  lLength2?: number; // Second arm length
  lWidth2?: number;  // Second arm width
  // Custom shape vertices
  customVertices?: CustomPoolVertex[];
  customArea?: number; // Pre-calculated area for custom shape
  customPerimeter?: number; // Pre-calculated perimeter for custom shape
  // Custom stairs vertices (for custom pool shape)
  customStairsVertices?: CustomPoolVertex[];
  // Custom wading pool vertices (for custom pool shape)
  customWadingPoolVertices?: CustomPoolVertex[];
  // Stairs configuration
  stairs: StairsConfig;
  // Wading pool configuration
  wadingPool: WadingPoolConfig;
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

export interface AttachmentInfo {
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
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
  attachments?: AttachmentInfo[]; // Uploaded attachments
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
  dueDays: number; // Termin odpowiedzi na ofertę (dni)
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
  dueDays: 3,
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
  wlasny: 'Własny kształt',
};

// Overflow type labels
export const overflowTypeLabels: Record<PoolOverflowType, string> = {
  skimmerowy: 'Skimmerowy',
  rynnowy: 'Rynnowy (przelewowy)',
};
