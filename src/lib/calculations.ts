import { 
  PoolDimensions, 
  PoolType, 
  PoolCalculations, 
  FoilCalculation,
  FilterCalculation,
  nominalLoadByType
} from '@/types/configurator';
import { Product, products, getPriceInPLN } from '@/data/products';

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
  const { shape, length, width, depth, lLength2, lWidth2, overflowType, attractions } = dimensions;
  
  // Water depth: depth - 10cm for skimmer pools, = depth for gutter pools
  const waterDepth = overflowType === 'skimmerowy' ? depth - 0.1 : depth;
  
  let volume: number;
  let surfaceArea: number;
  let perimeterLength: number;
  let wallArea: number;
  let bottomArea: number;

  switch (shape) {
    case 'owalny':
      // Oval pool (ellipse approximation)
      surfaceArea = Math.PI * (length / 2) * (width / 2);
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth;
      // Perimeter approximation for ellipse
      perimeterLength = Math.PI * (3 * (length / 2 + width / 2) - Math.sqrt((3 * length / 2 + width / 2) * (length / 2 + 3 * width / 2)));
      wallArea = perimeterLength * depth; // Wall area uses full depth (niecka)
      break;

    case 'litera-l':
      // L-shaped pool - two rectangles
      const l1Area = length * width;
      const l2Area = (lLength2 || 3) * (lWidth2 || 2);
      surfaceArea = l1Area + l2Area;
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth;
      // Perimeter for L-shape
      perimeterLength = 2 * length + 2 * width + 2 * (lLength2 || 3) + 2 * (lWidth2 || 2) - 2 * Math.min(width, lWidth2 || 2);
      wallArea = perimeterLength * depth;
      break;

    case 'prostokatny-schodki-zewnetrzne':
    case 'prostokatny-schodki-narozne':
      // Rectangle with steps - slight area increase
      surfaceArea = length * width;
      bottomArea = surfaceArea;
      volume = surfaceArea * waterDepth * 0.95; // Steps reduce effective volume
      perimeterLength = 2 * (length + width) + 2; // Extra for steps
      wallArea = 2 * length * depth + 2 * width * depth + 3; // Extra for step walls
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
  // Attractions only apply to public pools (hotelowy)
  const nominalLoad = nominalLoadByType[poolType];
  const effectiveAttractions = poolType === 'hotelowy' ? attractions : 0;
  const requiredFlow = (0.37 * volume) / nominalLoad + (6 * effectiveAttractions);
  
  return {
    volume,
    surfaceArea,
    perimeterLength,
    wallArea,
    bottomArea,
    requiredFlow,
    waterDepth,
  };
}

export interface FoilRollSimulation {
  rollWidth: number;
  rollLength: number;
  rollArea: number;
  rollsNeeded: number;
  totalRollArea: number;
  wastePercentage: number;
  wasteArea: number;
}

export interface FoilOptimizationResult extends FoilCalculation {
  simulation165: FoilRollSimulation;
  simulation205: FoilRollSimulation;
  suggestedRoll: '165' | '205';
  baseAreaWithMargin: number;
}

/**
 * Optimize foil cutting to minimize waste
 * Calculates both 1.65m and 2.05m roll options for comparison
 */
export function calculateFoilOptimization(
  dimensions: PoolDimensions,
  foilType: 'tradycyjna' | 'strukturalna',
  irregularSurchargePercent: number = 20
): FoilOptimizationResult {
  const { length, width, depth, isIrregular } = dimensions;
  
  // Total foil area needed - strips go along the LONGER side
  const longerSide = Math.max(length, width);
  const shorterSide = Math.min(length, width);
  
  const bottomArea = length * width;
  const wallArea = 2 * (length * depth) + 2 * (width * depth);
  const baseArea = bottomArea + wallArea;
  const baseAreaWithMargin = baseArea * 1.1; // 10% seam allowance
  
  // Irregular pool surcharge
  const irregularSurcharge = isIrregular ? irregularSurchargePercent : 0;
  const totalAreaNeeded = baseAreaWithMargin * (1 + irregularSurcharge / 100);
  
  // Simulate using only 1.65m rolls
  const ROLL_165_WIDTH = 1.65;
  const ROLL_165_LENGTH = 25;
  const ROLL_165_AREA = ROLL_165_WIDTH * ROLL_165_LENGTH; // 41.25 m²
  
  const rolls165Needed = Math.ceil(totalAreaNeeded / ROLL_165_AREA);
  const totalArea165 = rolls165Needed * ROLL_165_AREA;
  const waste165 = totalArea165 - totalAreaNeeded;
  const wastePercent165 = (waste165 / totalArea165) * 100;
  
  const simulation165: FoilRollSimulation = {
    rollWidth: ROLL_165_WIDTH,
    rollLength: ROLL_165_LENGTH,
    rollArea: ROLL_165_AREA,
    rollsNeeded: rolls165Needed,
    totalRollArea: totalArea165,
    wastePercentage: wastePercent165,
    wasteArea: waste165,
  };
  
  // Simulate using only 2.05m rolls
  const ROLL_205_WIDTH = 2.05;
  const ROLL_205_LENGTH = 25;
  const ROLL_205_AREA = ROLL_205_WIDTH * ROLL_205_LENGTH; // 51.25 m²
  
  const rolls205Needed = Math.ceil(totalAreaNeeded / ROLL_205_AREA);
  const totalArea205 = rolls205Needed * ROLL_205_AREA;
  const waste205 = totalArea205 - totalAreaNeeded;
  const wastePercent205 = (waste205 / totalArea205) * 100;
  
  const simulation205: FoilRollSimulation = {
    rollWidth: ROLL_205_WIDTH,
    rollLength: ROLL_205_LENGTH,
    rollArea: ROLL_205_AREA,
    rollsNeeded: rolls205Needed,
    totalRollArea: totalArea205,
    wastePercentage: wastePercent205,
    wasteArea: waste205,
  };
  
  // Determine which option is better (less total area = less waste = cheaper)
  const suggestedRoll: '165' | '205' = totalArea165 <= totalArea205 ? '165' : '205';
  
  return {
    totalArea: totalAreaNeeded,
    rolls165: suggestedRoll === '165' ? rolls165Needed : 0,
    rolls205: suggestedRoll === '205' ? rolls205Needed : 0,
    wastePercentage: suggestedRoll === '165' ? wastePercent165 : wastePercent205,
    irregularSurcharge,
    simulation165,
    simulation205,
    suggestedRoll,
    baseAreaWithMargin,
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
