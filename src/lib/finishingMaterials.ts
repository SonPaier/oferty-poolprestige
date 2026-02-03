/**
 * Hardcoded finishing materials definitions and calculation logic
 */

export type FoilSubtype = 'jednokolorowa' | 'nadruk' | 'strukturalna';

export interface PoolAreas {
  totalArea: number;      // Total surface area (net bottom + walls + stairs + wading pool)
  perimeter: number;      // Total perimeter
  bottomArea: number;     // Main pool bottom (GROSS, before subtracting stairs/wading)
  netBottomArea: number;  // Main pool bottom (NET, after subtracting stairs/wading projections)
  wallArea: number;
  stairsArea?: number;
  stairsProjection?: number;  // Floor area occupied by stairs (to subtract from bottom)
  wadingPoolArea?: number;
  wadingPoolProjection?: number;  // Floor area occupied by wading pool (to subtract from bottom)
  buttJointMeters?: number;  // Butt joint weld length for structural foil (mb)
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
    id: 'folia-podkladowa',
    name: 'Folia podkładowa (zgrzew doczołowy)',
    symbol: 'FOL-POD-001',
    unit: 'mb',
    calculate: (areas) => areas.buttJointMeters ? Math.ceil(areas.buttJointMeters) : 0,
    pricePerUnit: 18.00, // per running meter
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
 * Filters out materials with 0 quantity (e.g., folia podkładowa when not using structural foil)
 */
export function calculateMaterials(areas: PoolAreas): CalculatedMaterial[] {
  return FINISHING_MATERIALS
    .map((material) => {
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
    })
    .filter((material) => material.suggestedQty > 0); // Filter out materials with 0 quantity
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
  stairs?: { enabled: boolean; width?: number | 'full'; stepCount?: number; stepDepth?: number; stepHeight?: number; direction?: string };
  wadingPool?: { enabled: boolean; width?: number; length?: number; depth?: number; hasDividingWall?: boolean; dividingWallOffset?: number };
}): PoolAreas {
  const { length, width, depth, depthDeep, hasSlope, stairs, wadingPool } = dimensions;
  
  // GROSS bottom area (before subtractions)
  const bottomArea = length * width;
  
  // Wall area (perimeter × average depth)
  const avgDepth = hasSlope && depthDeep ? (depth + depthDeep) / 2 : depth;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * avgDepth;
  
  // === STAIRS ===
  // stairsProjection = floor footprint (width × stepDepth × stepCount) - to subtract from main bottom
  // stairsArea = actual foil needed (ONLY treads/footprint - risers are NOT covered with anti-slip foil)
  let stairsArea = 0;
  let stairsProjection = 0;
  if (stairs?.enabled) {
    const stairsWidth = typeof stairs.width === 'number' 
      ? stairs.width 
      : (stairs.width === 'full' ? (stairs.direction === 'along-length' ? length : width) : 1.5);
    const stepCount = stairs.stepCount || 4;
    const stepDepth = stairs.stepDepth || 0.30;
    
    // Projection = floor area occupied by stairs block (same as foil footprint)
    stairsProjection = stairsWidth * stepDepth * stepCount;
    
    // Foil area = ONLY treads (horizontal footprint) - NO risers
    // This is net surface area, actual material needed is calculated in mixPlanner
    stairsArea = stairsProjection; // Same as footprint
  }
  
  // === WADING POOL ===
  // wadingPoolProjection = floor footprint (width × length) - to subtract from main bottom
  // wadingPoolArea = actual foil needed (bottom + 3 walls + dividing wall if present)
  let wadingPoolArea = 0;
  let wadingPoolProjection = 0;
  if (wadingPool?.enabled) {
    const wpWidth = wadingPool.width || 2;
    const wpLength = wadingPool.length || 1.5;
    const wpDepth = wadingPool.depth || 0.4;
    
    // Projection = floor area occupied by wading pool
    wadingPoolProjection = wpWidth * wpLength;
    
    // Foil area components:
    // - Bottom (wpWidth × wpLength)
    // - 3 external walls (2 side + 1 back)
    const bottomWP = wpWidth * wpLength;
    const sideWalls = 2 * wpLength * wpDepth;
    const backWall = wpWidth * wpDepth;
    
    // Dividing wall (if enabled)
    let dividingWallArea = 0;
    if (wadingPool.hasDividingWall) {
      const wallOffsetM = (wadingPool.dividingWallOffset || 0) / 100;
      const poolSideHeight = depth - wpDepth;
      const paddlingSideHeight = wallOffsetM;
      const wallThickness = 0.15; // 15cm
      
      dividingWallArea = wpWidth * poolSideHeight + wpWidth * paddlingSideHeight + wpWidth * wallThickness;
    }
    
    wadingPoolArea = bottomWP + sideWalls + backWall + dividingWallArea;
  }
  
  // NET bottom area = gross bottom - stairs projection - wading pool projection
  const netBottomArea = bottomArea - stairsProjection - wadingPoolProjection;
  
  // TOTAL area = net bottom + walls + stairs foil + wading pool foil
  const totalArea = netBottomArea + wallArea + stairsArea + wadingPoolArea;
  
  return {
    totalArea,
    perimeter,
    bottomArea,      // Gross
    netBottomArea,   // After subtracting projections
    wallArea,
    stairsArea,
    stairsProjection,
    wadingPoolArea,
    wadingPoolProjection,
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
 * Foil line item structure
 */
export interface FoilLineItem {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
}

/**
 * Get foil line item for offer (single item)
 */
export function getFoilLineItem(
  subtype: FoilSubtype,
  totalArea: number,
  pricePerM2: number,
  selectedProductName?: string | null
): FoilLineItem {
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

/**
 * Get separate foil line items (main + structural)
 */
export function getFoilLineItems(
  subtype: FoilSubtype,
  mainArea: number,
  structuralArea: number,
  mainPricePerM2: number,
  selectedProductName?: string | null
): { main: FoilLineItem; structural: FoilLineItem | null } {
  const mainName = selectedProductName 
    ? `Folia ${selectedProductName}`
    : `Folia ${SUBTYPE_NAMES[subtype].toLowerCase()} - kolor do sprecyzowania`;
  
  const main: FoilLineItem = {
    name: mainName,
    quantity: Math.ceil(mainArea * 100) / 100,
    unit: 'm²',
    pricePerUnit: mainPricePerM2,
    total: Math.ceil(mainArea * mainPricePerM2 * 100) / 100,
  };

  // Structural foil only if area > 0 and main foil is not already structural
  let structural: FoilLineItem | null = null;
  if (structuralArea > 0 && subtype !== 'strukturalna') {
    const structuralPrice = DEFAULT_SUBTYPE_PRICES['strukturalna']; // 210 zł/m²
    structural = {
      name: 'Folia strukturalna (schody + brodzik)',
      quantity: Math.ceil(structuralArea * 100) / 100,
      unit: 'm²',
      pricePerUnit: structuralPrice,
      total: Math.ceil(structuralArea * structuralPrice * 100) / 100,
    };
  }

  return { main, structural };
}
