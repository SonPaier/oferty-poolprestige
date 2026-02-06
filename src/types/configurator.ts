import { Product } from '@/data/products';

export type PoolType = 'prywatny' | 'polprywatny' | 'hotelowy';
export type PoolLocation = 'wewnetrzny' | 'zewnetrzny';
export type PoolShape = 'prostokatny' | 'owalny' | 'nieregularny';
export type PoolOverflowType = 'skimmerowy' | 'rynnowy';
export type PoolLiningType = 'foliowany' | 'ceramiczny';

// Stairs rotation angles (8 directions for 45° increments)
export type StairsAngle = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

// NEW: Unified stair shape types
export type StairsShapeType = 'rectangular' | 'diagonal-45';

export interface CustomPoolVertex {
  x: number;
  y: number;
}

// Point interface for stair vertices
export interface Point {
  x: number;
  y: number;
}

export type StairsPosition = 'inside' | 'outside';
export type PoolCorner = 'back-left' | 'back-right' | 'front-left' | 'front-right';
export type WallDirection = 'along-length' | 'along-width'; // wzdłuż długości (X) lub szerokości (Y)
export type PoolWall = 'back' | 'front' | 'left' | 'right'; // od której ściany
export type StairsPlacement = 'wall' | 'corner' | 'diagonal'; // od ściany, z narożnika lub pod kątem 45°

export interface StairsConfig {
  enabled: boolean;
  position: StairsPosition; // wewnątrz/zewnątrz basenu
  
  // NEW: Unified shape-based configuration
  shapeType?: StairsShapeType; // typ kształtu schodów
  cornerIndex?: number; // indeks narożnika (0=A, 1=B, 2=C...)
  vertices?: Point[]; // wygenerowane wierzchołki kształtu
  
  // LEGACY: Old placement system (for backward compatibility)
  placement: StairsPlacement; // od ściany, z narożnika lub pod kątem 45°
  wall: PoolWall; // od której ściany (gdy placement === 'wall')
  corner: PoolCorner; // który narożnik (gdy placement === 'corner' lub 'diagonal')
  cornerLabel?: string; // etykieta narożnika (A, B, C, D...)
  direction: WallDirection; // wzdłuż której ściany (dla placement === 'corner')
  
  // Common parameters
  width: number | 'full'; // szerokość schodków lub 'full' = pełna szerokość boku
  stepHeight: number; // wysokość stopnia (domyślnie 0.29m)
  stepCount: number; // wyliczane z głębokości / stepHeight
  stepDepth: number; // głębokość stopnia (domyślnie 0.29m)
  angle?: number; // kąt kierunku schodów (0, 45, 90, 135, 180, 225, 270, 315) - dla custom drawer
  // Future: corner rounding
  cornerRadius?: number; // promień zaokrąglenia narożników (m)
  
  // Scalene triangle parameters (expanding trapezoid steps)
  minStepDepth?: number; // Minimalna głębokość stopnia przy wierzchołku (domyślnie 0.20m)
  maxStepDepth?: number; // Maksymalna głębokość stopnia przy podstawie (domyślnie 0.30m)
  autoDirection?: boolean; // Czy automatycznie wykrywać kierunek z geometrii trójkąta
}

export interface WadingPoolConfig {
  enabled: boolean;
  corner: PoolCorner; // który narożnik (legacy)
  cornerIndex?: number; // indeks narożnika (0=A, 1=B, 2=C...) - nowy sposób
  cornerLabel?: string; // etykieta narożnika (A, B, C, D...)
  direction: WallDirection; // wzdłuż której ściany
  width: number; // szerokość brodzika (wzdłuż ściany) - wymiar zewnętrzny razem ze ścianą
  length: number; // długość brodzika (w głąb basenu) - wymiar zewnętrzny razem ze ścianą
  depth: number; // głębokość brodzika (zazwyczaj 0.3-0.6m)
  position: StairsPosition; // wewnątrz/zewnątrz basenu
  hasDividingWall: boolean; // czy jest murek oddzielający brodzik od basenu
  dividingWallOffset?: number; // odległość góry murka od ściany basenu w cm (domyślnie 0 = równo ze ścianą)
}

export const defaultStairsConfig: StairsConfig = {
  enabled: false,
  position: 'inside',
  shapeType: 'rectangular',
  cornerIndex: 0, // A
  placement: 'wall',
  wall: 'back',
  corner: 'back-left',
  direction: 'along-width',
  width: 1.5,
  stepHeight: 0.20, // 20cm max height per step
  stepCount: 4,
  stepDepth: 0.30, // 30cm depth per step
  // Scalene triangle defaults
  minStepDepth: 0.20, // 20cm at narrow end
  maxStepDepth: 0.30, // 30cm at wide end
  autoDirection: true, // Auto-detect direction for scalene triangles
};

export const defaultWadingPoolConfig: WadingPoolConfig = {
  enabled: false,
  corner: 'back-left',
  cornerIndex: 0, // A
  cornerLabel: 'A',
  direction: 'along-width',
  width: 2,
  length: 1.5,
  depth: 0.4,
  position: 'inside',
  hasDividingWall: true, // domyślnie murek jest włączony
  dividingWallOffset: 0, // 0cm = równo ze ścianą basenu
};

export const stairsPositionLabels: Record<StairsPosition, string> = {
  inside: 'Wewnątrz basenu',
  outside: 'Na zewnątrz basenu',
};

export const stairsPlacementLabels: Record<StairsPlacement, string> = {
  wall: 'Od ściany',
  corner: 'Z narożnika',
  diagonal: 'Narożnik 45°',
};

// NEW: Shape type labels
export const stairsShapeTypeLabels: Record<StairsShapeType, string> = {
  'rectangular': 'Prostokątne',
  'diagonal-45': 'Trójkąt 45°',
};

export const poolWallLabels: Record<PoolWall, string> = {
  back: 'Tylna ściana',
  front: 'Przednia ściana',
  left: 'Lewa ściana',
  right: 'Prawa ściana',
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
  location: PoolLocation; // wewnętrzny/zewnętrzny
  liningType: PoolLiningType; // ceramiczny or foliowany
  length: number;
  width: number;
  depth: number;
  depthDeep?: number;
  hasSlope: boolean;
  isIrregular: boolean;
  overflowType: PoolOverflowType;
  attractions: number;
  // Custom shape vertices
  customVertices?: CustomPoolVertex[];
  customArea?: number;
  customPerimeter?: number;
  // Custom stairs - array to support multiple stairs
  customStairsVertices?: CustomPoolVertex[][];
  customStairsRotations?: number[];
  // Legacy single stair support (deprecated)
  customStairsVerticesSingle?: CustomPoolVertex[];
  customStairsRotation?: number;
  // Custom wading pools - array to support multiple wading pools
  customWadingPoolVertices?: CustomPoolVertex[][];
  // Legacy single wading pool support (deprecated)
  customWadingPoolVerticesSingle?: CustomPoolVertex[];
  // Stairs configuration (only for custom shapes now)
  stairs: StairsConfig;
  // Wading pool configuration (only for custom shapes now)
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
  // Stair and wading pool areas
  stairsArea: number; // Powierzchnia rzutu schodów (m²)
  wadingPoolArea: number; // Powierzchnia brodzika (m²)
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

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
  role?: string; // np. "Właściciel", "Kierownik budowy"
}

export interface InvestmentAddress {
  enabled: boolean;
  address: string;
  city: string;
  postalCode: string;
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
  sourceEmail?: string;
  attachments?: AttachmentInfo[];
  // New fields
  additionalContacts?: ContactPerson[];
  investmentAddress?: InvestmentAddress;
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
  scope?: 'our' | 'investor'; // For sections that can be delegated
  excavation?: any; // For roboty_ziemne
  notes?: string; // For additional notes
  estimatedCost?: number; // For prace_budowlane
  extraItems?: any[]; // For additional custom line items
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
    roboty_ziemne: ConfiguratorSection;
    prace_budowlane: ConfiguratorSection;
  };
  foilType: 'tradycyjna' | 'strukturalna';
}

export interface ContactPersonSettings {
  name: string;
  role: string;
  phone: string;
  email: string;
  photo?: string; // URL to photo in storage
}

// Construction material default rates
export interface ConstructionMaterialRates {
  podsypka: number;        // zł/m³
  betonB15: number;        // zł/m³
  betonB25: number;        // zł/m³
  bloczek: number;         // zł/szt.
  zbrojenie12mm: number;   // zł/kg
  zbrojenie6mm: number;    // zł/kg
  strzemiona: number;      // zł/szt.
  styrodur5cm: number;     // zł/m² (XPS 5cm)
  styrodur10cm: number;    // zł/m² (XPS 10cm)
  zbrojenieKompozytowe: number; // zł/mb
  pompogruszka: number;    // zł/szt.
  hydropian10cm: number;   // zł/m² (wall insulation)
  purFoam5cm: number;      // zł/m² (PUR foam wall insulation)
  // Labor rates
  laborPoolRate: number;   // zł/m² (prace budowlane – basen)
  laborStairsRate: number; // zł/m² (prace budowlane – schody)
  laborWadingRate: number; // zł/m² (prace budowlane – brodzik)
}

export const defaultConstructionMaterialRates: ConstructionMaterialRates = {
  podsypka: 150,
  betonB15: 350,
  betonB25: 450,
  bloczek: 6.80,
  zbrojenie12mm: 7.00,
  zbrojenie6mm: 6.00,
  strzemiona: 2.10,
  styrodur5cm: 20,
  styrodur10cm: 40,
  zbrojenieKompozytowe: 3.00,
  pompogruszka: 350,
  hydropian10cm: 45,
  purFoam5cm: 60,
  laborPoolRate: 700,
  laborStairsRate: 1000,
  laborWadingRate: 1000,
};

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
  // New fields for public offer view
  companyDescription?: string;
  contactPerson?: ContactPersonSettings;
  // Construction material rates
  constructionMaterialRates?: ConstructionMaterialRates;
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
  constructionMaterialRates: defaultConstructionMaterialRates,
};

export const poolTypeLabels: Record<PoolType, string> = {
  prywatny: 'Prywatny',
  polprywatny: 'Półprywatny',
  hotelowy: 'Hotelowy / Publiczny',
};

export const poolShapeLabels: Record<PoolShape, string> = {
  prostokatny: 'Prostokątny',
  owalny: 'Owalny / Okrągły',
  nieregularny: 'Nieregularny',
};

// Helper to get corner label (A, B, C, D...)
export function getCornerLabel(index: number): string {
  return String.fromCharCode(65 + index); // A=65, B=66, etc.
}

// Helper to get wall label from corner labels (e.g., "A-B")
export function getWallLabel(cornerIndex: number, totalCorners: number): string {
  const startLabel = getCornerLabel(cornerIndex);
  const endLabel = getCornerLabel((cornerIndex + 1) % totalCorners);
  return `${startLabel}-${endLabel}`;
}

// Helper to map legacy placement to new shapeType
export function mapPlacementToShapeType(placement: StairsPlacement): StairsShapeType {
  switch (placement) {
    case 'diagonal':
      return 'diagonal-45';
    case 'wall':
    case 'corner':
    default:
      return 'rectangular';
  }
}

// Helper to map PoolCorner to cornerIndex for rectangular pools
export function mapCornerToIndex(corner: PoolCorner): number {
  switch (corner) {
    case 'back-left': return 0; // A
    case 'back-right': return 1; // B
    case 'front-right': return 2; // C
    case 'front-left': return 3; // D
    default: return 0;
  }
}

// Helper to map cornerIndex back to PoolCorner for rectangular pools
export function mapIndexToCorner(index: number): PoolCorner {
  switch (index % 4) {
    case 0: return 'back-left';
    case 1: return 'back-right';
    case 2: return 'front-right';
    case 3: return 'front-left';
    default: return 'back-left';
  }
}

// Stairs angle labels (8 directions)
export const stairsAngleLabels: Record<number, string> = {
  0: 'Wejście z góry ↓',
  45: 'Wejście z góry-prawej ↙',
  90: 'Wejście z prawej ←',
  135: 'Wejście z dołu-prawej ↖',
  180: 'Wejście z dołu ↑',
  225: 'Wejście z dołu-lewej ↗',
  270: 'Wejście z lewej →',
  315: 'Wejście z góry-lewej ↘',
};

export const liningTypeLabels: Record<PoolLiningType, string> = {
  foliowany: 'Wyłożony folią',
  ceramiczny: 'Ceramiczny',
};

// Overflow type labels
export const overflowTypeLabels: Record<PoolOverflowType, string> = {
  skimmerowy: 'Skimmerowy',
  rynnowy: 'Rynnowy (przelewowy)',
};

// Pool location labels
export const poolLocationLabels: Record<PoolLocation, string> = {
  wewnetrzny: 'Wewnętrzny',
  zewnetrzny: 'Zewnętrzny',
};
