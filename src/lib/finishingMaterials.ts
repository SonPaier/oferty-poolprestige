/**
 * Finishing materials definitions and calculation logic
 */

export type FoilSubtype = 'jednokolorowa' | 'nadruk' | 'strukturalna';
export type UnderlayType = 'zwykly' | 'impregnowany';

export interface PoolAreas {
  totalArea: number;      // Total surface area (net bottom + walls + stairs + wading pool)
  perimeter: number;      // Total perimeter
  bottomArea: number;     // Main pool bottom (GROSS, before subtracting stairs/wading)
  netBottomArea: number;  // Main pool bottom (NET, after subtracting stairs/wading projections)
  wallArea: number;
  stairsArea?: number;
  stairsProjection?: number;
  wadingPoolArea?: number;
  wadingPoolProjection?: number;
  buttJointMeters?: number;  // Butt joint weld length for structural foil (mb)
  // Extended fields for new material calculations
  poolLength: number;
  poolWidth: number;
  poolDepth: number;
  stairsStepPerimeter: number;  // Sum of all stair step edge lengths
  wadingPoolPerimeter: number;  // Wading pool perimeter
  hasWadingWall: boolean;       // Whether wading pool has dividing wall
  isGutterPool: boolean;        // Whether pool is gutter/overflow type
}

export interface MaterialDefinition {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  calculate: (areas: PoolAreas, context: MaterialContext) => number;
  getPrice: (context: MaterialContext) => number;
  condition?: (context: MaterialContext) => boolean; // If false, material is hidden
}

export interface MaterialContext {
  selectedSubtype: FoilSubtype | null;
  underlayType: UnderlayType;
  // Reference to other material quantities for dependencies (e.g., rivets depend on profiles)
  materialQtys: Record<string, number>;
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

/**
 * Calculate underlay strips for floor - standard (2m wide rolls)
 */
function calculateUnderlayStandard(poolLength: number, poolWidth: number, perimeter: number): number {
  const strips = Math.ceil(poolWidth / 2);
  const dnoM2 = strips * poolLength * 2; // each strip is 2m wide
  const scianyM2 = perimeter * 2; // always 2m height (waste included)
  return dnoM2 + scianyM2;
}

/**
 * Calculate underlay strips for floor - impregnated (1.5m and 2m wide rolls, optimized)
 */
function calculateUnderlayImpregnated(poolLength: number, poolWidth: number, perimeter: number, poolDepth: number): number {
  // Floor: find best combo of 1.5m and 2m strips to cover poolWidth with min waste
  const dnoM2 = findBestStripCoverage(poolWidth) * poolLength;
  // Walls: find best strip width for depth (always use at least 2m equivalent - waste included)
  const wallStripWidth = poolDepth <= 1.5 ? 1.5 : 2;
  const scianyM2 = perimeter * wallStripWidth;
  return dnoM2 + scianyM2;
}

/**
 * Find best combination of 1.5m and 2m strips to cover a given width, minimizing waste.
 * Returns total strip width used (including waste).
 */
function findBestStripCoverage(targetWidth: number): number {
  let bestTotal = Infinity;
  // Try all combos of n2 (2m strips) and n15 (1.5m strips)
  const max2m = Math.ceil(targetWidth / 2) + 1;
  for (let n2 = 0; n2 <= max2m; n2++) {
    const remaining = targetWidth - n2 * 2;
    if (remaining <= 0) {
      const total = n2 * 2;
      if (total < bestTotal) bestTotal = total;
      continue;
    }
    const n15 = Math.ceil(remaining / 1.5);
    const total = n2 * 2 + n15 * 1.5;
    if (total >= targetWidth && total < bestTotal) {
      bestTotal = total;
    }
  }
  return bestTotal;
}

// Material definitions
export const FINISHING_MATERIALS: MaterialDefinition[] = [
  // 2. Podkład pod folię (zwykły / impregnowany - calculated dynamically based on underlayType)
  {
    id: 'podklad-pod-folie',
    name: 'Podkład pod folię',
    symbol: 'POD-001',
    unit: 'm²',
    calculate: (areas, ctx) => {
      if (ctx.underlayType === 'impregnowany') {
        return Math.ceil(calculateUnderlayImpregnated(areas.poolLength, areas.poolWidth, areas.perimeter, areas.poolDepth));
      }
      return Math.ceil(calculateUnderlayStandard(areas.poolLength, areas.poolWidth, areas.perimeter));
    },
    getPrice: (ctx) => ctx.underlayType === 'impregnowany' ? 32 : 16,
  },
  // 3. Klej do podkładu 20kg
  {
    id: 'klej-podklad-20kg',
    name: 'Klej do podkładu 20kg',
    symbol: 'KLE-POD-001',
    unit: 'szt',
    calculate: (areas) => Math.max(1, Math.ceil(areas.totalArea / 100)),
    getPrice: () => 400,
  },
  // 4. Pasy folii podkładowej 20m (only for structural foil)
  {
    id: 'folia-podkladowa-20m',
    name: 'Pasy folii podkładowej 20m',
    symbol: 'FOL-POD-001',
    unit: 'szt',
    calculate: (areas) => areas.buttJointMeters ? Math.ceil(areas.buttJointMeters / 20) : 0,
    getPrice: () => 500,
    condition: (ctx) => ctx.selectedSubtype === 'strukturalna',
  },
  // 5. Kątownik powlekany PVC 2m zewnętrzny
  {
    id: 'katownik-zewnetrzny-2m',
    name: 'Kątownik powlekany PVC 2m zewnętrzny',
    symbol: 'KAT-ZEW-001',
    unit: 'szt',
    calculate: (areas) => {
      const total = areas.perimeter + areas.stairsStepPerimeter + 
        (areas.hasWadingWall ? areas.wadingPoolPerimeter * 2 : areas.wadingPoolPerimeter);
      return Math.ceil(total / 2);
    },
    getPrice: () => 40,
  },
  // 6. Kątownik powlekany PVC 2m wewnętrzny
  {
    id: 'katownik-wewnetrzny-2m',
    name: 'Kątownik powlekany PVC 2m wewnętrzny',
    symbol: 'KAT-WEW-001',
    unit: 'szt',
    calculate: () => 0, // always manual
    getPrice: () => 40,
  },
  // 7. Płaskownik powlekany PVC 2m
  {
    id: 'plaskownik-pvc-2m',
    name: 'Płaskownik powlekany PVC 2m',
    symbol: 'PLA-001',
    unit: 'szt',
    calculate: () => 0, // always manual
    getPrice: () => 30,
  },
  // 8. Nity 200szt
  {
    id: 'nity-200szt',
    name: 'Nity 200szt.',
    symbol: 'NIT-001',
    unit: 'szt',
    calculate: (_areas, ctx) => {
      const totalProfiles = (ctx.materialQtys['katownik-zewnetrzny-2m'] || 0) +
        (ctx.materialQtys['katownik-wewnetrzny-2m'] || 0) +
        (ctx.materialQtys['plaskownik-pvc-2m'] || 0);
      return totalProfiles > 0 ? Math.ceil(totalProfiles / 40) : 0;
    },
    getPrice: () => 270,
  },
  // 9. Folia w płynie / wypełniacz spoin 1L
  {
    id: 'folia-w-plynie-1l',
    name: 'Folia w płynie / wypełniacz spoin 1L',
    symbol: 'FOL-PLY-001',
    unit: 'szt',
    calculate: (areas) => Math.max(1, Math.ceil(areas.totalArea / 100)),
    getPrice: (ctx) => ctx.selectedSubtype === 'strukturalna' ? 270 : 220,
  },
  // 10. Usługa foliowanie niecki
  {
    id: 'usluga-foliowanie-niecki',
    name: 'Usługa foliowanie niecki',
    symbol: 'USL-FOL-001',
    unit: 'm²',
    calculate: (areas) => Math.ceil((areas.netBottomArea + areas.wallArea) * 100) / 100,
    getPrice: (ctx) => ctx.selectedSubtype === 'strukturalna' ? 130 : 90,
  },
  // 11. Usługa foliowanie schodów
  {
    id: 'usluga-foliowanie-schodow',
    name: 'Usługa foliowanie schodów',
    symbol: 'USL-SCH-001',
    unit: 'm²',
    calculate: (areas) => areas.stairsArea ? Math.ceil(areas.stairsArea * 100) / 100 : 0,
    getPrice: () => 500,
    condition: (_ctx) => true, // shown always, qty may be 0
  },
  // 12. Usługa foliowanie rynny (only for gutter pools)
  {
    id: 'usluga-foliowanie-rynny',
    name: 'Usługa foliowanie rynny',
    symbol: 'USL-RYN-001',
    unit: 'mb',
    calculate: (areas) => Math.ceil(areas.perimeter * 100) / 100,
    getPrice: () => 500,
    condition: (_ctx) => true, // visibility controlled by isGutterPool in calculateMaterials
  },
];

/**
 * Calculate materials quantities based on pool areas and context
 */
export function calculateMaterials(areas: PoolAreas, context: MaterialContext): CalculatedMaterial[] {
  // First pass: calculate all base quantities (needed for dependencies like rivets)
  const baseQtys: Record<string, number> = {};
  for (const material of FINISHING_MATERIALS) {
    if (material.condition && !material.condition(context)) continue;
    if (material.id === 'usluga-foliowanie-rynny' && !areas.isGutterPool) continue;
    baseQtys[material.id] = material.calculate(areas, { ...context, materialQtys: {} });
  }

  // Second pass: calculate with dependencies
  const fullContext: MaterialContext = { ...context, materialQtys: baseQtys };

  return FINISHING_MATERIALS
    .filter((material) => {
      if (material.condition && !material.condition(context)) return false;
      if (material.id === 'usluga-foliowanie-rynny' && !areas.isGutterPool) return false;
      return true;
    })
    .map((material) => {
      const suggestedQty = material.id === 'nity-200szt'
        ? material.calculate(areas, fullContext) // rivets need full context
        : baseQtys[material.id] ?? 0;
      const pricePerUnit = material.getPrice(fullContext);

      // Dynamic name for folia w płynie
      let name = material.name;
      if (material.id === 'folia-w-plynie-1l' && context.selectedSubtype === 'strukturalna') {
        name = 'Folia w płynie / wypełniacz spoin 1L (do folii strukturalnej)';
      }
      // Dynamic name for podkład
      if (material.id === 'podklad-pod-folie') {
        name = context.underlayType === 'impregnowany'
          ? 'Podkład pod folię (impregnowany)'
          : 'Podkład pod folię (zwykły)';
      }

      return {
        id: material.id,
        name,
        symbol: material.symbol,
        unit: material.unit,
        suggestedQty,
        manualQty: null,
        pricePerUnit,
        total: suggestedQty * pricePerUnit,
      };
    })
    .filter((m) => m.id === 'katownik-wewnetrzny-2m' || m.id === 'plaskownik-pvc-2m' || m.suggestedQty > 0 || m.id === 'usluga-foliowanie-schodow');
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
  overflowType?: string;
  stairs?: { enabled: boolean; width?: number | 'full'; stepCount?: number; stepDepth?: number; stepHeight?: number; direction?: string };
  wadingPool?: { enabled: boolean; width?: number; length?: number; depth?: number; hasDividingWall?: boolean; dividingWallOffset?: number };
}): PoolAreas {
  const { length, width, depth, depthDeep, hasSlope, overflowType, stairs, wadingPool } = dimensions;
  
  const bottomArea = length * width;
  const avgDepth = hasSlope && depthDeep ? (depth + depthDeep) / 2 : depth;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * avgDepth;
  
  let stairsArea = 0;
  let stairsProjection = 0;
  let stairsStepPerimeter = 0;
  if (stairs?.enabled) {
    const stairsWidth = typeof stairs.width === 'number' 
      ? stairs.width 
      : (stairs.width === 'full' ? (stairs.direction === 'along-length' ? length : width) : 1.5);
    const stepCount = stairs.stepCount || 4;
    const stepDepth = stairs.stepDepth || 0.30;
    
    stairsProjection = stairsWidth * stepDepth * stepCount;
    stairsArea = stairsProjection;
    // Each step has a front edge (stairsWidth) + 2 side edges (stepDepth)
    stairsStepPerimeter = stepCount * (stairsWidth + 2 * stepDepth);
  }
  
  let wadingPoolArea = 0;
  let wadingPoolProjection = 0;
  let wadingPoolPerimeter = 0;
  let hasWadingWall = false;
  if (wadingPool?.enabled) {
    const wpWidth = wadingPool.width || 2;
    const wpLength = wadingPool.length || 1.5;
    const wpDepth = wadingPool.depth || 0.4;
    
    wadingPoolProjection = wpWidth * wpLength;
    wadingPoolPerimeter = 2 * (wpWidth + wpLength);
    hasWadingWall = wadingPool.hasDividingWall ?? false;
    
    const bottomWP = wpWidth * wpLength;
    const sideWalls = 2 * wpLength * wpDepth;
    const backWall = wpWidth * wpDepth;
    
    let dividingWallArea = 0;
    if (wadingPool.hasDividingWall) {
      const wallOffsetM = (wadingPool.dividingWallOffset || 0) / 100;
      const poolSideHeight = depth - wpDepth;
      const paddlingSideHeight = wallOffsetM;
      const wallThickness = 0.15;
      dividingWallArea = wpWidth * poolSideHeight + wpWidth * paddlingSideHeight + wpWidth * wallThickness;
    }
    
    wadingPoolArea = bottomWP + sideWalls + backWall + dividingWallArea;
  }
  
  const netBottomArea = bottomArea - stairsProjection - wadingPoolProjection;
  const totalArea = netBottomArea + wallArea + stairsArea + wadingPoolArea;
  
  return {
    totalArea,
    perimeter,
    bottomArea,
    netBottomArea,
    wallArea,
    stairsArea,
    stairsProjection,
    wadingPoolArea,
    wadingPoolProjection,
    poolLength: length,
    poolWidth: width,
    poolDepth: depth,
    stairsStepPerimeter,
    wadingPoolPerimeter,
    hasWadingWall,
    isGutterPool: overflowType === 'rynnowy',
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
    quantity: Math.ceil(totalArea * 100) / 100,
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

  let structural: FoilLineItem | null = null;
  if (structuralArea > 0 && subtype !== 'strukturalna') {
    const structuralPrice = DEFAULT_SUBTYPE_PRICES['strukturalna'];
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
