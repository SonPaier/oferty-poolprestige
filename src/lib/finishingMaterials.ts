/**
 * Hardcoded finishing materials definitions and calculation logic
 */

export type FoilSubtype = 'jednokolorowa' | 'nadruk' | 'strukturalna';

export interface PoolAreas {
  totalArea: number;      // Total surface area (bottom + walls + stairs + wading pool)
  perimeter: number;      // Total perimeter
  bottomArea: number;
  wallArea: number;
  stairsArea?: number;
  wadingPoolArea?: number;
}

export interface MaterialDefinition {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  calculate: (areas: PoolAreas) => number;
  pricePerUnit: number;
}

export interface CalculatedMaterial {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  suggestedQty: number;
  manualQty: number | null;
  pricePerUnit: number;
  total: number;
}

// Default prices per m² for each foil subtype (net PLN)
export const DEFAULT_SUBTYPE_PRICES: Record<FoilSubtype, number> = {
  jednokolorowa: 107,
  nadruk: 145,
  strukturalna: 210,
};

// Variant labels for display
export const VARIANT_LABELS: Record<FoilSubtype, string> = {
  jednokolorowa: 'STANDARD',
  nadruk: 'STANDARD PLUS',
  strukturalna: 'PREMIUM',
};

// Subtype display names
export const SUBTYPE_NAMES: Record<FoilSubtype, string> = {
  jednokolorowa: 'Jednokolorowa',
  nadruk: 'Z nadrukiem',
  strukturalna: 'Strukturalna',
};

// Map foil subtype to foil_category in database
export const SUBTYPE_TO_FOIL_CATEGORY: Record<FoilSubtype, string> = {
  jednokolorowa: 'jednokolorowa',
  nadruk: 'nadruk',
  strukturalna: 'strukturalna',
};

// Material definitions (hardcoded)
export const FINISHING_MATERIALS: MaterialDefinition[] = [
  {
    id: 'podklad-zwykly',
    name: 'Podkład pod folię',
    symbol: 'POD-001',
    unit: 'm²',
    calculate: (areas) => Math.ceil(areas.totalArea * 1.1), // +10% reserve
    pricePerUnit: 12.50,
  },
  {
    id: 'katownik-pvc',
    name: 'Kątownik PVC',
    symbol: 'KAT-001',
    unit: 'mb',
    calculate: (areas) => Math.ceil(areas.perimeter),
    pricePerUnit: 8.00,
  },
  {
    id: 'klej-kontaktowy',
    name: 'Klej kontaktowy',
    symbol: 'KLE-001',
    unit: 'kg',
    calculate: (areas) => Math.ceil(areas.totalArea / 20), // 1kg per 20m²
    pricePerUnit: 45.00,
  },
  {
    id: 'nity-montazowe',
    name: 'Nity montażowe',
    symbol: 'NIT-001',
    unit: 'szt',
    calculate: (areas) => Math.ceil(areas.perimeter * 4), // 4 rivets per meter
    pricePerUnit: 0.50,
  },
  {
    id: 'silikon-podwodny',
    name: 'Silikon podwodny',
    symbol: 'SIL-001',
    unit: 'szt',
    calculate: (areas) => Math.ceil(areas.perimeter / 8), // 1 tube per 8m
    pricePerUnit: 35.00,
  },
  {
    id: 'tasma-uszczelniajaca',
    name: 'Taśma uszczelniająca',
    symbol: 'TAS-001',
    unit: 'mb',
    calculate: (areas) => Math.ceil(areas.perimeter * 1.05), // +5% reserve
    pricePerUnit: 4.50,
  },
];

/**
 * Calculate materials quantities based on pool areas
 */
export function calculateMaterials(areas: PoolAreas): CalculatedMaterial[] {
  return FINISHING_MATERIALS.map((material) => {
    const suggestedQty = material.calculate(areas);
    return {
      id: material.id,
      name: material.name,
      symbol: material.symbol,
      unit: material.unit,
      suggestedQty,
      manualQty: null,
      pricePerUnit: material.pricePerUnit,
      total: suggestedQty * material.pricePerUnit,
    };
  });
}

/**
 * Calculate pool areas from dimensions
 */
export function calculatePoolAreas(dimensions: {
  length: number;
  width: number;
  depth: number;
  depthDeep?: number;
  hasSlope?: boolean;
  stairs?: { enabled: boolean; width?: number; stepCount?: number; stepDepth?: number };
  wadingPool?: { enabled: boolean; width?: number; length?: number; depth?: number };
}): PoolAreas {
  const { length, width, depth, depthDeep, hasSlope, stairs, wadingPool } = dimensions;
  
  // Bottom area
  const bottomArea = length * width;
  
  // Wall area (perimeter × average depth)
  const avgDepth = hasSlope && depthDeep ? (depth + depthDeep) / 2 : depth;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * avgDepth;
  
  // Stairs area (simplified)
  let stairsArea = 0;
  if (stairs?.enabled) {
    const stairsWidth = stairs.width || 1.5;
    const stepCount = stairs.stepCount || 4;
    const stepDepth = stairs.stepDepth || 0.30;
    // Approximate: treads + risers
    stairsArea = stairsWidth * stepCount * stepDepth * 2;
  }
  
  // Wading pool area
  let wadingPoolArea = 0;
  if (wadingPool?.enabled) {
    const wpWidth = wadingPool.width || 2;
    const wpLength = wadingPool.length || 1.5;
    const wpDepth = wadingPool.depth || 0.4;
    // Floor + walls
    wadingPoolArea = wpWidth * wpLength + 2 * (wpWidth + wpLength) * wpDepth;
  }
  
  return {
    totalArea: bottomArea + wallArea + stairsArea + wadingPoolArea,
    perimeter,
    bottomArea,
    wallArea,
    stairsArea,
    wadingPoolArea,
  };
}

/**
 * Get total materials cost
 */
export function calculateMaterialsTotal(materials: CalculatedMaterial[]): number {
  return materials.reduce((sum, m) => {
    const qty = m.manualQty ?? m.suggestedQty;
    return sum + qty * m.pricePerUnit;
  }, 0);
}

/**
 * Get foil line item for offer
 */
export function getFoilLineItem(
  subtype: FoilSubtype,
  totalArea: number,
  pricePerM2: number,
  selectedProductName?: string | null
): { name: string; quantity: number; unit: string; pricePerUnit: number; total: number } {
  const name = selectedProductName 
    ? `Folia ${selectedProductName}`
    : `Folia ${SUBTYPE_NAMES[subtype].toLowerCase()} - kolor do sprecyzowania`;
  
  return {
    name,
    quantity: Math.ceil(totalArea * 100) / 100, // Round to 2 decimals
    unit: 'm²',
    pricePerUnit: pricePerM2,
    total: Math.ceil(totalArea * pricePerM2 * 100) / 100,
  };
}
