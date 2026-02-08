import { OfferItem, CustomerData, PoolDimensions, PoolType, PoolCalculations } from './configurator';

export type OfferStatus = 'queue' | 'draft' | 'sent';

// ============= Insulation Types =============

// Floor insulation types
export type FloorInsulationType = 'none' | 'xps-5cm' | 'xps-10cm';

// Wall insulation types  
export type WallInsulationType = 'none' | 'xps-5cm-wall' | 'xps-10cm-wall' | 'pur-5cm';

// Insulation labels for UI
export const floorInsulationLabels: Record<FloorInsulationType, string> = {
  'none': 'Brak',
  'xps-5cm': 'XPS fundamentowy 5cm',
  'xps-10cm': 'XPS fundamentowy 10cm',
};

export const wallInsulationLabels: Record<WallInsulationType, string> = {
  'none': 'Brak',
  'xps-5cm-wall': 'XPS 5cm',
  'xps-10cm-wall': 'XPS 10cm',
  'pur-5cm': 'Piana PUR 5cm',
};

// Insulation thickness in meters
export const floorInsulationThickness: Record<FloorInsulationType, number> = {
  'none': 0,
  'xps-5cm': 0.05,
  'xps-10cm': 0.10,
};

export const wallInsulationThickness: Record<WallInsulationType, number> = {
  'none': 0,
  'xps-5cm-wall': 0.05,
  'xps-10cm-wall': 0.10,
  'pur-5cm': 0.05,
};

export interface SavedOffer {
  id: string;
  shareUid?: string;
  offerNumber: string;
  createdAt: string;
  updatedAt: string;
  customerData: CustomerData;
  poolType: PoolType;
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  sections: Record<string, { items: OfferItem[] }>;
  excavation: ExcavationData;
  totalNet: number;
  totalGross: number;
  status: OfferStatus;
}

export interface ExcavationData {
  excavationVolume: number;
  excavationPricePerM3: number;
  excavationTotal: number;
  removalFixedPrice: number;
}

export interface ExcavationSettings {
  marginWidth: number; // meters to add on each side
  marginDepth: number; // meters to add to depth
  pricePerM3: number; // PLN per m³
  removalFixedPrice: number; // PLN fixed price for removal
  podsypkaRate: number; // PLN per m³ for sand bedding
  drainageRate: number; // PLN per mb for perimeter drainage
  backfillRate: number; // PLN per m³ for backfill (zakopanie)
}

export const defaultExcavationSettings: ExcavationSettings = {
  marginWidth: 1,
  marginDepth: 1,
  pricePerM3: 20,
  removalFixedPrice: 40, // domyślna stawka za m³ (nie ryczałt)
  podsypkaRate: 150,
  drainageRate: 220,
  backfillRate: 20, // domyślnie taka sama jak wykop
};

export function calculateExcavation(
  dimensions: PoolDimensions,
  settings: ExcavationSettings
): ExcavationData {
  const { length, width, depth } = dimensions;
  
  // Excavation dimensions: pool + margins
  const excLength = length + (settings.marginWidth * 2);
  const excWidth = width + (settings.marginWidth * 2);
  const excDepth = depth + settings.marginDepth;
  
  const excavationVolume = excLength * excWidth * excDepth;
  const excavationTotal = excavationVolume * settings.pricePerM3;
  
  return {
    excavationVolume,
    excavationPricePerM3: settings.pricePerM3,
    excavationTotal,
    removalFixedPrice: settings.removalFixedPrice,
  };
}

export function generateOfferNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PP/${year}/${month}${day}/${random}`;
}

// Local storage helpers for offers
const OFFERS_STORAGE_KEY = 'pool_prestige_offers';

export function saveOffer(offer: SavedOffer): void {
  const offers = getOffers();
  const existingIndex = offers.findIndex(o => o.id === offer.id);
  
  if (existingIndex >= 0) {
    offers[existingIndex] = { ...offer, updatedAt: new Date().toISOString() };
  } else {
    offers.unshift(offer);
  }
  
  localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(offers));
}

export function getOffers(): SavedOffer[] {
  try {
    const data = localStorage.getItem(OFFERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getOfferById(id: string): SavedOffer | undefined {
  return getOffers().find(o => o.id === id);
}

export function deleteOffer(id: string): void {
  const offers = getOffers().filter(o => o.id !== id);
  localStorage.setItem(OFFERS_STORAGE_KEY, JSON.stringify(offers));
}

export function searchOffers(query: string): SavedOffer[] {
  const offers = getOffers();
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) return offers;
  
  return offers.filter(offer => {
    const { customerData, offerNumber, createdAt } = offer;
    
    return (
      offerNumber.toLowerCase().includes(lowerQuery) ||
      customerData.contactPerson.toLowerCase().includes(lowerQuery) ||
      customerData.companyName?.toLowerCase().includes(lowerQuery) ||
      customerData.email?.toLowerCase().includes(lowerQuery) ||
      customerData.phone?.includes(lowerQuery) ||
      createdAt.includes(lowerQuery)
    );
  });
}
