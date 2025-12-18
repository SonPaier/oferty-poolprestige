import { 
  PoolDimensions, 
  PoolType, 
  PoolCalculations, 
  FoilCalculation,
  FilterCalculation,
  cycleTimeByType 
} from '@/types/configurator';
import { Product, products, getPriceInPLN } from '@/data/products';

const OVERLAP_CM = 10; // 10cm overlap for foil welding
const OVERLAP_M = OVERLAP_CM / 100;

/**
 * Calculate pool volume and dimensions
 */
export function calculatePoolMetrics(
  dimensions: PoolDimensions,
  poolType: PoolType
): PoolCalculations {
  const { length, width, depthShallow, depthDeep } = dimensions;
  
  // Average depth
  const avgDepth = (depthShallow + depthDeep) / 2;
  
  // Volume in m3
  const volume = length * width * avgDepth;
  
  // Surface area (water surface)
  const surfaceArea = length * width;
  
  // Perimeter
  const perimeterLength = 2 * (length + width);
  
  // Wall area (approximation with varying depth)
  const wallAreaLong = 2 * length * avgDepth;
  const wallAreaShort = 2 * width * avgDepth;
  const wallArea = wallAreaLong + wallAreaShort;
  
  // Bottom area
  const bottomArea = length * width;
  
  // Required flow rate based on pool type (DIN standards)
  const cycleTime = cycleTimeByType[poolType];
  const requiredFlow = volume / cycleTime;
  
  return {
    volume,
    surfaceArea,
    perimeterLength,
    wallArea,
    bottomArea,
    requiredFlow,
    cycleTime,
  };
}

/**
 * Optimize foil cutting to minimize waste
 * Uses combination of 1.65m and 2.05m rolls
 */
export function calculateFoilOptimization(
  dimensions: PoolDimensions,
  foilType: 'tradycyjna' | 'strukturalna',
  irregularSurchargePercent: number = 20
): FoilCalculation {
  const { length, width, depthShallow, depthDeep, isIrregular } = dimensions;
  const avgDepth = (depthShallow + depthDeep) / 2;
  
  // Total foil area needed
  // Bottom: length × width
  // Walls: 2×(length × avgDepth) + 2×(width × avgDepth)
  // Plus overlap and welding margin (15% extra)
  
  const bottomArea = length * width;
  const wallArea = 2 * (length * avgDepth) + 2 * (width * avgDepth);
  const baseArea = (bottomArea + wallArea) * 1.15; // 15% margin
  
  // Optimize roll selection
  // For bottom: prefer wider rolls (2.05m) to minimize seams
  // For walls: use based on wall height
  
  const ROLL_165 = 1.65 - OVERLAP_M;
  const ROLL_205 = 2.05 - OVERLAP_M;
  
  // Calculate how many strips needed
  let rolls165 = 0;
  let rolls205 = 0;
  
  // Bottom strips along width
  const bottomStripsNeeded = Math.ceil(width / ROLL_205);
  const bottomMeters = bottomStripsNeeded * length;
  
  // Use 2.05m rolls for bottom
  rolls205 += Math.ceil(bottomMeters / 25); // 25m per roll assumption
  
  // Wall strips
  const wallHeight = avgDepth + 0.15; // 15cm over edge
  
  if (wallHeight <= ROLL_165) {
    // Use 1.65m rolls for walls
    const wallMeters = 2 * (length + width) + 2; // +2m buffer
    rolls165 += Math.ceil(wallMeters / 25);
  } else {
    // Use 2.05m rolls
    const wallMeters = 2 * (length + width) + 2;
    rolls205 += Math.ceil(wallMeters / 25);
  }
  
  // Calculate waste
  const totalRollArea = (rolls165 * 25 * 1.65) + (rolls205 * 25 * 2.05);
  const wastePercentage = ((totalRollArea - baseArea) / totalRollArea) * 100;
  
  // Irregular pool surcharge
  const irregularSurcharge = isIrregular ? irregularSurchargePercent : 0;
  
  return {
    totalArea: baseArea * (1 + irregularSurcharge / 100),
    rolls165,
    rolls205,
    wastePercentage: Math.max(0, wastePercentage),
    irregularSurcharge,
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
