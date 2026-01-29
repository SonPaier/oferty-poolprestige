import { 
  PoolDimensions, 
  PoolType, 
  PoolCalculations, 
  FoilCalculation,
  FilterCalculation,
  nominalLoadByType,
  CustomPoolVertex
} from '@/types/configurator';
import { Product, products, getPriceInPLN } from '@/data/products';
import { calculateStairsArea, generateStairsGeometry } from '@/lib/stairsShapeGenerator';

const OVERLAP_CM = 10; // 10cm overlap for foil welding
const OVERLAP_M = OVERLAP_CM / 100;

/**
 * Calculate pool volume and dimensions based on shape
 * NEW DIN formula: (0.37 × volume) / nominal_load + (6 × attractions)
 */
export function calculatePoolMetrics(
  dimensions: PoolDimensions,
  poolType: PoolType
): PoolCalculations {
  const { shape, length, width, depth, overflowType, attractions, customVertices, customArea, customPerimeter } = dimensions;
  
  // Water depth: depth - 10cm for skimmer pools, = depth for gutter pools
  const waterDepth = overflowType === 'skimmerowy' ? depth - 0.1 : depth;
  
  let volume: number;
  let surfaceArea: number;
  let perimeterLength: number;
  let wallArea: number;
  let bottomArea: number;

  switch (shape) {
    case 'nieregularny':
      // Custom shape - use pre-calculated values
      surfaceArea = customArea || 0;
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth;
      perimeterLength = customPerimeter || 0;
      wallArea = perimeterLength * depth;
      break;

    case 'owalny':
      // Oval pool (ellipse approximation)
      surfaceArea = Math.PI * (length / 2) * (width / 2);
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth;
      // Perimeter approximation for ellipse
      perimeterLength = Math.PI * (3 * (length / 2 + width / 2) - Math.sqrt((3 * length / 2 + width / 2) * (length / 2 + 3 * width / 2)));
      wallArea = perimeterLength * depth;
      break;

    case 'prostokatny':
    default:
      // Standard rectangle
      surfaceArea = length * width;
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth;
      perimeterLength = 2 * (length + width);
      wallArea = 2 * length * depth + 2 * width * depth;
      break;
  }
  
  // NEW DIN formula for filtration flow rate:
  // (0.37 × volume) / nominal_load + (6 × attractions)
  // Attractions now apply to ALL pool types
  const nominalLoad = nominalLoadByType[poolType];
  const requiredFlow = (0.37 * volume) / nominalLoad + (6 * attractions);
  
  // Calculate stairs area
  const stairsArea = calculateTotalStairsArea(dimensions);
  const stairsStepArea = calculateTotalStairsStepArea(dimensions);
  
  // Calculate wading pool area
  const wadingPoolArea = calculateWadingPoolArea(dimensions);
  
  return {
    volume,
    surfaceArea,
    perimeterLength,
    wallArea,
    bottomArea,
    requiredFlow,
    waterDepth,
    stairsArea,
    stairsStepArea,
    wadingPoolArea,
  };
}

/**
 * Calculate total stairs area from all stair polygons
 */
function calculateTotalStairsArea(dimensions: PoolDimensions): number {
  let totalArea = 0;
  
  // For irregular pools with custom drawn stairs
  if (dimensions.shape === 'nieregularny' && dimensions.customStairsVertices) {
    for (const vertices of dimensions.customStairsVertices) {
      if (vertices && vertices.length >= 3) {
        totalArea += calculatePolygonArea(vertices);
      }
    }
  } else if (dimensions.stairs?.enabled) {
    // For rectangular/oval pools with config-based stairs
    const stairsGeometry = generateStairsGeometry(
      dimensions.length,
      dimensions.width,
      dimensions.stairs
    );
    if (stairsGeometry) {
      totalArea = calculateStairsArea(stairsGeometry.vertices);
    }
  }
  
  return totalArea;
}

/**
 * Calculate total step (tread) surface area - horizontal surface of all steps
 * For foil calculation purposes
 */
function calculateTotalStairsStepArea(dimensions: PoolDimensions): number {
  let totalArea = 0;
  const stepCount = dimensions.stairs?.stepCount || 4;
  
  // For irregular pools with custom drawn stairs
  if (dimensions.shape === 'nieregularny' && dimensions.customStairsVertices) {
    for (const vertices of dimensions.customStairsVertices) {
      if (vertices && vertices.length >= 3) {
        // Each stair polygon has multiple steps
        // Approximate: total polygon area represents the footprint
        // Step surface = perimeter_of_step * step_depth for each step
        // Simplified: total area / stepCount * stepCount (same as total area conceptually)
        // But we want the sum of horizontal treads surfaces
        const polygonArea = calculatePolygonArea(vertices);
        // For irregular stairs, approximate step surfaces based on polygon
        totalArea += polygonArea; // Simplified - full area represents all treads
      }
    }
  } else if (dimensions.stairs?.enabled) {
    // For rectangular stairs: stepCount treads, each tread = width × stepDepth
    const stairsWidth = typeof dimensions.stairs.width === 'number' ? dimensions.stairs.width : 1.5;
    const stepDepth = dimensions.stairs.stepDepth || 0.30;
    
    if (dimensions.stairs.shapeType === 'diagonal-45') {
      // Diagonal 45° - treads are trapezoidal, approximate as triangular decrease
      const diagonalSize = stepCount * stepDepth;
      // Average width of treads in a diagonal stair
      // Each step has decreasing width from base to apex
      // Sum of widths: diagonalSize * (1/stepCount + 2/stepCount + ... + stepCount/stepCount)
      // = diagonalSize * (stepCount+1)/2/stepCount
      const avgWidth = diagonalSize * (stepCount + 1) / (2 * stepCount);
      totalArea = stepCount * avgWidth * stepDepth;
    } else {
      // Rectangular: simple width × depth × count
      totalArea = stepCount * stairsWidth * stepDepth;
    }
  }
  
  return totalArea;
}

/**
 * Calculate wading pool area
 */
function calculateWadingPoolArea(dimensions: PoolDimensions): number {
  let totalArea = 0;
  
  // For irregular pools with custom drawn wading pools
  if (dimensions.shape === 'nieregularny' && dimensions.customWadingPoolVertices) {
    for (const vertices of dimensions.customWadingPoolVertices) {
      if (vertices && vertices.length >= 3) {
        totalArea += calculatePolygonArea(vertices);
      }
    }
  } else if (dimensions.wadingPool?.enabled) {
    // For rectangular pools: width × length (external dimensions including walls)
    const wadingWidth = dimensions.wadingPool.width || 2;
    const wadingLength = dimensions.wadingPool.length || 1.5;
    totalArea = wadingWidth * wadingLength;
  }
  
  return totalArea;
}

/**
 * Calculate polygon area using Shoelace formula
 */
function calculatePolygonArea(vertices: CustomPoolVertex[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  
  return Math.abs(area) / 2;
}

export interface FoilStrip {
  surface: 'bottom' | 'wall-long' | 'wall-short';
  rollWidth: 1.65 | 2.05;
  stripLength: number; // length along the longer side
  usedWidth: number; // actual width used (can be less than rollWidth)
  wasteWidth: number; // unused width
}

export interface FoilRollAllocation {
  rollWidth: 1.65 | 2.05;
  count: number;
  usedArea: number;
  wasteArea: number;
}

export interface FoilOptimizationResult extends FoilCalculation {
  strips: FoilStrip[];
  rolls165: number;
  rolls205: number;
  mixedRolls: FoilRollAllocation[];
  totalUsedArea: number;
  totalWasteArea: number;
  wastePercentage: number;
  baseAreaWithMargin: number;
  // Comparisons
  onlyRolls165: { rolls: number; waste: number; wastePercent: number };
  onlyRolls205: { rolls: number; waste: number; wastePercent: number };
  mixedOptimal: { rolls165: number; rolls205: number; waste: number; wastePercent: number };
}

const ROLL_165_WIDTH = 1.65;
const ROLL_205_WIDTH = 2.05;
const ROLL_LENGTH = 25; // meters
const OVERLAP = 0.1; // 10cm overlap for welding

/**
 * Optimize foil cutting to minimize waste
 * Strips go along the LONGER side of each surface
 * Can mix 1.65m and 2.05m rolls for optimal coverage
 */
export function calculateFoilOptimization(
  dimensions: PoolDimensions,
  foilType: 'tradycyjna' | 'strukturalna',
  irregularSurchargePercent: number = 20
): FoilOptimizationResult {
  const { length, width, depth, isIrregular } = dimensions;
  
  // Determine longer/shorter sides for each surface
  // Strips go ALONG the longer side (fewer joins)
  const longerSide = Math.max(length, width);
  const shorterSide = Math.min(length, width);
  
  // Surfaces to cover with strips going along the longer dimension
  const surfaces = [
    { type: 'bottom' as const, stripLength: longerSide, coverWidth: shorterSide },
    { type: 'wall-long' as const, stripLength: longerSide, coverWidth: depth },
    { type: 'wall-long' as const, stripLength: longerSide, coverWidth: depth }, // two long walls
    { type: 'wall-short' as const, stripLength: shorterSide, coverWidth: depth },
    { type: 'wall-short' as const, stripLength: shorterSide, coverWidth: depth }, // two short walls
  ];
  
  // Calculate base areas
  const bottomArea = length * width;
  const wallArea = 2 * (length * depth) + 2 * (width * depth);
  const baseArea = bottomArea + wallArea;
  const baseAreaWithMargin = baseArea * 1.1; // 10% seam allowance
  
  // Irregular pool surcharge
  const irregularSurcharge = isIrregular ? irregularSurchargePercent : 0;
  const totalAreaNeeded = baseAreaWithMargin * (1 + irregularSurcharge / 100);
  
  // Optimization: Find best strip arrangement for each surface
  // Try to use roll widths that minimize waste for each strip
  const optimizeStrips = (coverWidth: number): { strips: { width: 1.65 | 2.05; used: number }[]; waste: number } => {
    const effectiveWidth165 = ROLL_165_WIDTH - OVERLAP;
    const effectiveWidth205 = ROLL_205_WIDTH - OVERLAP;
    
    // Try different combinations and find the one with minimum waste
    let bestResult = { strips: [] as { width: 1.65 | 2.05; used: number }[], waste: Infinity };
    
    // Dynamic programming approach - try all combinations up to reasonable count
    const maxStrips = Math.ceil(coverWidth / effectiveWidth165) + 2;
    
    const tryCombo = (n165: number, n205: number): { waste: number; valid: boolean } => {
      // First strip uses full width, subsequent strips overlap
      let totalCover = 0;
      if (n165 + n205 > 0) {
        // First strip
        if (n165 > 0) {
          totalCover = ROLL_165_WIDTH;
          for (let i = 1; i < n165; i++) totalCover += effectiveWidth165;
        } else {
          totalCover = ROLL_205_WIDTH;
          n205--;
        }
        // Add remaining 2.05 strips
        totalCover += n205 * effectiveWidth205;
        // Add remaining 1.65 strips if first was 2.05
        if (n165 > 0) {
          // already counted
        }
      }
      
      // Recalculate properly
      totalCover = 0;
      let remaining165 = n165;
      let remaining205 = n205;
      let isFirst = true;
      
      while (remaining165 > 0 || remaining205 > 0) {
        // Choose which roll to use next
        const use165 = remaining165 > 0;
        const use205 = remaining205 > 0;
        
        if (use165) {
          totalCover += isFirst ? ROLL_165_WIDTH : effectiveWidth165;
          remaining165--;
        } else if (use205) {
          totalCover += isFirst ? ROLL_205_WIDTH : effectiveWidth205;
          remaining205--;
        }
        isFirst = false;
      }
      
      const waste = totalCover - coverWidth;
      return { waste, valid: totalCover >= coverWidth && waste >= 0 };
    };
    
    // Brute force optimal combination (small search space)
    for (let n165 = 0; n165 <= maxStrips; n165++) {
      for (let n205 = 0; n205 <= maxStrips; n205++) {
        if (n165 + n205 === 0) continue;
        
        let totalCover = 0;
        const strips: { width: 1.65 | 2.05; used: number }[] = [];
        let remaining165 = n165;
        let remaining205 = n205;
        let isFirst = true;
        
        while (remaining165 > 0 || remaining205 > 0) {
          // Prefer the roll that fits better
          const widthNeeded = coverWidth - totalCover;
          const use165Next = remaining165 > 0;
          const use205Next = remaining205 > 0;
          
          // Choose the better fit
          let useWidth: 1.65 | 2.05;
          if (use165Next && !use205Next) {
            useWidth = 1.65;
          } else if (!use165Next && use205Next) {
            useWidth = 2.05;
          } else {
            // Both available - choose based on remaining width
            const cover165 = isFirst ? ROLL_165_WIDTH : effectiveWidth165;
            const cover205 = isFirst ? ROLL_205_WIDTH : effectiveWidth205;
            
            // Prefer the one that creates less waste for this strip
            if (widthNeeded <= cover165) {
              useWidth = 1.65; // 1.65 is enough
            } else if (widthNeeded <= cover205) {
              useWidth = 2.05; // need 2.05
            } else {
              // Both will have waste, prefer bigger
              useWidth = 2.05;
            }
          }
          
          if (useWidth === 1.65) {
            const cover = isFirst ? ROLL_165_WIDTH : effectiveWidth165;
            strips.push({ width: 1.65, used: Math.min(cover, widthNeeded) });
            totalCover += cover;
            remaining165--;
          } else {
            const cover = isFirst ? ROLL_205_WIDTH : effectiveWidth205;
            strips.push({ width: 2.05, used: Math.min(cover, widthNeeded) });
            totalCover += cover;
            remaining205--;
          }
          isFirst = false;
          
          if (totalCover >= coverWidth) break;
        }
        
        if (totalCover >= coverWidth) {
          const waste = totalCover - coverWidth;
          if (waste < bestResult.waste) {
            bestResult = { strips, waste };
          }
        }
      }
    }
    
    return bestResult;
  };
  
  // Calculate optimal strip layout for each surface
  const allStrips: FoilStrip[] = [];
  let totalRolls165Used = 0;
  let totalRolls205Used = 0;
  
  surfaces.forEach(surface => {
    const result = optimizeStrips(surface.coverWidth);
    result.strips.forEach(strip => {
      allStrips.push({
        surface: surface.type,
        rollWidth: strip.width,
        stripLength: surface.stripLength,
        usedWidth: strip.used,
        wasteWidth: strip.width - strip.used,
      });
      if (strip.width === 1.65) totalRolls165Used++;
      else totalRolls205Used++;
    });
  });
  
  // Calculate total roll usage (how many full rolls needed)
  // Each strip uses stripLength from a roll, rolls are 25m long
  const usage165: number[] = [];
  const usage205: number[] = [];
  
  allStrips.forEach(strip => {
    if (strip.rollWidth === 1.65) {
      usage165.push(strip.stripLength);
    } else {
      usage205.push(strip.stripLength);
    }
  });
  
  // Pack strips into rolls (simple first-fit decreasing)
  const packIntoRolls = (lengths: number[]): number => {
    if (lengths.length === 0) return 0;
    
    const sorted = [...lengths].sort((a, b) => b - a);
    const rolls: number[] = [];
    
    sorted.forEach(len => {
      // Find a roll with enough space
      let placed = false;
      for (let i = 0; i < rolls.length; i++) {
        if (rolls[i] + len <= ROLL_LENGTH) {
          rolls[i] += len;
          placed = true;
          break;
        }
      }
      if (!placed) {
        rolls.push(len);
      }
    });
    
    return rolls.length;
  };
  
  const rolls165Needed = packIntoRolls(usage165);
  const rolls205Needed = packIntoRolls(usage205);
  
  // Calculate total areas
  const totalUsedArea = allStrips.reduce((sum, s) => sum + s.stripLength * s.usedWidth, 0);
  const totalRollArea = (rolls165Needed * ROLL_165_WIDTH * ROLL_LENGTH) + (rolls205Needed * ROLL_205_WIDTH * ROLL_LENGTH);
  const totalWasteArea = totalRollArea - totalUsedArea;
  const wastePercentage = totalRollArea > 0 ? (totalWasteArea / totalRollArea) * 100 : 0;
  
  // Calculate comparison scenarios
  const calcOnlyRolls = (rollWidth: number): { rolls: number; waste: number; wastePercent: number } => {
    const rollArea = rollWidth * ROLL_LENGTH;
    const rolls = Math.ceil(totalAreaNeeded / rollArea);
    const totalArea = rolls * rollArea;
    const waste = totalArea - totalAreaNeeded;
    return { rolls, waste, wastePercent: (waste / totalArea) * 100 };
  };
  
  const onlyRolls165 = calcOnlyRolls(ROLL_165_WIDTH);
  const onlyRolls205 = calcOnlyRolls(ROLL_205_WIDTH);
  
  return {
    totalArea: totalAreaNeeded,
    rolls165: rolls165Needed,
    rolls205: rolls205Needed,
    wastePercentage,
    irregularSurcharge,
    strips: allStrips,
    mixedRolls: [
      { rollWidth: 1.65, count: rolls165Needed, usedArea: usage165.reduce((a, b) => a + b, 0) * ROLL_165_WIDTH, wasteArea: 0 },
      { rollWidth: 2.05, count: rolls205Needed, usedArea: usage205.reduce((a, b) => a + b, 0) * ROLL_205_WIDTH, wasteArea: 0 },
    ],
    totalUsedArea,
    totalWasteArea,
    baseAreaWithMargin,
    onlyRolls165,
    onlyRolls205,
    mixedOptimal: { 
      rolls165: rolls165Needed, 
      rolls205: rolls205Needed, 
      waste: totalWasteArea, 
      wastePercent: wastePercentage 
    },
  };
}

/**
 * Select appropriate pump based on required flow
 */
export function selectPump(requiredFlow: number): {
  suggested: Product | undefined;
  alternatives: Product[];
} {
  const pumps = products
    .filter(p => p.category === 'pompy' && p.specs?.wydajnosc)
    .sort((a, b) => (a.specs?.wydajnosc as number) - (b.specs?.wydajnosc as number));
  
  // Find pump that meets or exceeds required flow
  const suitable = pumps.filter(p => (p.specs?.wydajnosc as number) >= requiredFlow);
  
  if (suitable.length === 0) {
    return { suggested: pumps[pumps.length - 1], alternatives: pumps.slice(-3) };
  }
  
  // Suggested: smallest pump that meets requirement
  const suggested = suitable[0];
  
  // Alternatives: 2 cheaper options (if available) and 2 more powerful
  const cheaperOptions = pumps
    .filter(p => getPriceInPLN(p) < getPriceInPLN(suggested) && (p.specs?.wydajnosc as number) >= requiredFlow * 0.8)
    .slice(-2);
  
  const strongerOptions = suitable.slice(1, 3);
  
  return {
    suggested,
    alternatives: [...cheaperOptions, ...strongerOptions].slice(0, 4),
  };
}

/**
 * Select appropriate filter based on pump flow
 */
export function selectFilter(requiredFlow: number): FilterCalculation & {
  suggested: Product | undefined;
  alternatives: Product[];
} {
  const filters = products
    .filter(p => p.category === 'filtry' && p.specs?.wydajnosc)
    .sort((a, b) => (a.specs?.wydajnosc as number) - (b.specs?.wydajnosc as number));
  
  // Find filter that meets or exceeds required flow
  const suitable = filters.filter(p => (p.specs?.wydajnosc as number) >= requiredFlow);
  
  const suggested = suitable[0] || filters[filters.length - 1];
  
  // Calculate filter media needed (rough estimate based on filter diameter)
  // ~100kg per 500mm diameter
  const diameter = suggested?.specs?.srednica as number || 600;
  const filterMediaKg = Math.ceil((diameter / 500) * 100);
  
  const alternatives = suitable.slice(1, 4);
  
  return {
    requiredFlow,
    filterMediaKg,
    suggested,
    alternatives,
    suggestedFilter: suggested,
  };
}

/**
 * Calculate recommended number of lights
 */
export function calculateLightingRecommendation(surfaceArea: number): {
  count: number;
  wattage: number;
} {
  // ~1 light per 10m² of surface area
  const count = Math.max(1, Math.ceil(surfaceArea / 10));
  const wattage = count <= 2 ? 30 : 14; // Larger pools use more efficient LED
  
  return { count, wattage };
}

/**
 * Calculate required nozzles and drains
 */
export function calculateHydraulics(volume: number, requiredFlow: number): {
  nozzles: number;
  drains: number;
  skimmers: number;
} {
  // ~1 nozzle per 5m³/h of flow
  const nozzles = Math.max(2, Math.ceil(requiredFlow / 5));
  
  // 1 drain per 20m³ volume, minimum 1
  const drains = Math.max(1, Math.ceil(volume / 20));
  
  // 1 skimmer per 25m² of surface, minimum 1
  const skimmers = Math.max(1, Math.ceil(volume / 25));
  
  return { nozzles, drains, skimmers };
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  }).format(price);
}
