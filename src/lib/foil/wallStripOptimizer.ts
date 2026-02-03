/**
 * Wall Strip Optimizer - Flexible strip configuration for walls
 * 
 * Generates and evaluates all sensible wall strip configurations (1, 2, 3, 4+ strips)
 * and selects the optimal one based on the chosen priority:
 * - minWaste: Minimize unusable waste
 * - minRolls: Minimize total m² of foil to order
 * 
 * Key features:
 * - Dynamic strip count (not fixed to 2 or 4)
 * - Uneven vertical overlap distribution for better roll utilization
 * - Cross-surface pairing with bottom strips
 */

import { PoolDimensions } from '@/types/configurator';
import { FoilSubtype } from '@/lib/finishingMaterials';
import { 
  ROLL_LENGTH,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
  RollWidth,
  MIN_REUSABLE_OFFCUT_LENGTH,
  DEFAULT_VERTICAL_JOIN_OVERLAP,
  MIN_VERTICAL_JOIN_OVERLAP,
  MAX_VERTICAL_JOIN_OVERLAP,
  DEPTH_THRESHOLD_FOR_WIDE,
  DEPTH_THRESHOLD_FOR_DOUBLE_NARROW,
  isNarrowOnlyFoil,
  getWallSegments,
  WallSegment,
  OptimizationPriority,
  MixConfiguration,
} from './mixPlanner';

/** Single wall strip in a configuration */
export interface WallStripConfig {
  wallLabels: string[];      // e.g., ['A-B'] or ['A-B', 'B-C'] for continuous
  wallIndices: number[];     // indices of walls covered by this strip
  baseLength: number;        // sum of wall lengths (without overlap)
  verticalOverlap: number;   // overlap assigned to this strip
  totalLength: number;       // baseLength + verticalOverlap
  rollWidth: RollWidth;      // 1.65 or 2.05
}

/** A complete wall strip configuration */
export interface WallStripPlan {
  strips: WallStripConfig[];
  totalStripCount: number;
  totalVerticalOverlap: number;
  totalFoilArea: number;       // sum of (stripLength × rollWidth)
  wasteArea: number;           // non-reusable waste
  reusableOffcutArea: number;  // reusable offcut area (>= 2m length)
  rollCount165: number;
  rollCount205: number;
  score: number;               // optimization score (lower = better)
}

/** Bottom strip info for pairing */
interface BottomStripInfo {
  rollWidth: RollWidth;
  length: number;
  offcutLength: number;  // ROLL_LENGTH - length
}

/**
 * Get available roll widths based on depth and foil type
 */
function getWallWidthsForDepth(
  depth: number,
  foilSubtype?: FoilSubtype | null
): RollWidth[] {
  if (isNarrowOnlyFoil(foilSubtype)) {
    return [ROLL_WIDTH_NARROW];
  }
  
  if (depth <= DEPTH_THRESHOLD_FOR_WIDE) {
    // Depth <= 1.55m: can use either 1.65m or 2.05m (prefer 1.65m for less waste)
    return [ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE];
  } else if (depth <= DEPTH_THRESHOLD_FOR_DOUBLE_NARROW) {
    // 1.55m < depth <= 1.95m: must use 2.05m
    return [ROLL_WIDTH_WIDE];
  } else {
    // depth > 1.95m: must use 1.65m (2 strips stacked)
    return [ROLL_WIDTH_NARROW];
  }
}

/**
 * Get bottom strip info from configuration for pairing
 */
function getBottomStripsInfo(config: MixConfiguration): BottomStripInfo[] {
  const bottom = config.surfaces.find(s => s.surface === 'bottom');
  if (!bottom) return [];
  
  const mix = bottom.stripMix && bottom.stripMix.length > 0
    ? bottom.stripMix
    : [{ rollWidth: bottom.rollWidth, count: bottom.stripCount }];
  
  const result: BottomStripInfo[] = [];
  for (const group of mix) {
    for (let i = 0; i < group.count; i++) {
      result.push({
        rollWidth: group.rollWidth,
        length: bottom.stripLength,
        offcutLength: ROLL_LENGTH - bottom.stripLength,
      });
    }
  }
  return result;
}

/**
 * Generate all possible wall strip partitions
 * A partition divides 4 walls into groups (1-4 groups)
 * 
 * For 4 walls [A-B, B-C, C-D, D-A], possible partitions:
 * - 1 strip: [A-B-C-D-A] (whole perimeter, if <= 25m)
 * - 2 strips: [A-B-C, C-D-A], [A-B, B-C-D-A], etc.
 * - 3 strips: [A-B, B-C, C-D-A], [A-B, B-C-D, D-A], etc.
 * - 4 strips: [A-B], [B-C], [C-D], [D-A]
 */
function generateWallPartitions(wallCount: number): number[][][] {
  const partitions: number[][][] = [];
  
  // 1 grupa: wszystkie ściany razem
  partitions.push([Array.from({ length: wallCount }, (_, i) => i)]);
  
  // wallCount grup: każda ściana osobno
  partitions.push(Array.from({ length: wallCount }, (_, i) => [i]));
  
  // 2 grupy: wszystkie możliwe podziały na dwie ciągłe części
  for (let splitPoint = 1; splitPoint < wallCount; splitPoint++) {
    const group1 = Array.from({ length: splitPoint }, (_, i) => i);
    const group2 = Array.from({ length: wallCount - splitPoint }, (_, i) => i + splitPoint);
    partitions.push([group1, group2]);
  }
  
  // 3 grupy: wszystkie możliwe podziały na trzy ciągłe części
  for (let split1 = 1; split1 < wallCount - 1; split1++) {
    for (let split2 = split1 + 1; split2 < wallCount; split2++) {
      const group1 = Array.from({ length: split1 }, (_, i) => i);
      const group2 = Array.from({ length: split2 - split1 }, (_, i) => i + split1);
      const group3 = Array.from({ length: wallCount - split2 }, (_, i) => i + split2);
      partitions.push([group1, group2, group3]);
    }
  }
  
  return partitions;
}

/**
 * Check if a strip length fits within a single roll
 */
function fitsInRoll(length: number): boolean {
  return length <= ROLL_LENGTH + 0.001;  // Small tolerance
}

/**
 * Calculate total vertical overlap needed for a given number of strips
 * The overlap can be distributed unevenly among strips
 */
function calculateTotalVerticalOverlap(stripCount: number): number {
  // Each strip needs overlap with the next (circular)
  // Total overlap = stripCount × overlap per join
  return stripCount * DEFAULT_VERTICAL_JOIN_OVERLAP;
}

/**
 * Distribute vertical overlap unevenly among strips to optimize roll usage
 * 
 * Strategy: Assign more overlap to strips that can better utilize it
 * (e.g., strips that would leave reusable offcuts when paired with bottom)
 */
function distributeVerticalOverlap(
  strips: Array<{ wallIndices: number[]; baseLength: number; rollWidth: RollWidth }>,
  _totalOverlap: number,
  _bottomStrips: BottomStripInfo[],
  _availableWidths: RollWidth[]
): number[] {
  const stripCount = strips.length;
  if (stripCount === 0) return [];
  if (stripCount === 1) return [_totalOverlap];
  
  const overlapsPerStrip = new Array(stripCount).fill(0);
  const overlapPerJoin = DEFAULT_VERTICAL_JOIN_OVERLAP; // 0.1m
  
  // Dla każdego łączenia (cyklicznie)
  for (let i = 0; i < stripCount; i++) {
    const idx1 = i;
    const idx2 = (i + 1) % stripCount;
    
    const strip1 = strips[idx1];
    const strip2 = strips[idx2];
    
    // Przypisz zakład do tańszego pasa (węższa rolka = tańsza)
    // Przy równych szerokościach - do dłuższego pasa
    let targetIdx: number;
    
    if (strip1.rollWidth !== strip2.rollWidth) {
      // Różne szerokości - zakład do węższego (tańszego)
      targetIdx = strip1.rollWidth < strip2.rollWidth ? idx1 : idx2;
    } else {
      // Ta sama szerokość - zakład do dłuższego
      targetIdx = strip1.baseLength >= strip2.baseLength ? idx1 : idx2;
    }
    
    overlapsPerStrip[targetIdx] += overlapPerJoin;
  }
  
  return overlapsPerStrip;
}

/**
 * Calculate waste for a strip configuration
 */
function calculateWasteForPlan(
  strips: WallStripConfig[],
  bottomStrips: BottomStripInfo[],
  _depth: number
): { wasteArea: number; reusableArea: number; rollCount165: number; rollCount205: number; pairedLeftover: number } {
  let wasteArea = 0;
  let reusableArea = 0;
  let rollCount165 = 0;
  let rollCount205 = 0;
  let pairedLeftover = 0;  // How much space is wasted when pairing with bottom offcuts
  
  // Track which bottom strips are "used" for pairing
  const usedBottomIndices = new Set<number>();
  
  for (const strip of strips) {
    const rollWaste = ROLL_LENGTH - strip.totalLength;
    
    // Check if this can pair with a bottom strip of same width
    let paired = false;
    for (let bi = 0; bi < bottomStrips.length; bi++) {
      if (usedBottomIndices.has(bi)) continue;
      
      const bottom = bottomStrips[bi];
      if (bottom.rollWidth !== strip.rollWidth) continue;
      
      // Can they share a roll?
      if (strip.totalLength + bottom.length <= ROLL_LENGTH + 0.001) {
        // They can pair!
        paired = true;
        usedBottomIndices.add(bi);
        
        const combinedWaste = ROLL_LENGTH - strip.totalLength - bottom.length;
        pairedLeftover += combinedWaste;  // Track leftover from pairing
        
        if (combinedWaste >= MIN_REUSABLE_OFFCUT_LENGTH) {
          reusableArea += combinedWaste * strip.rollWidth;
        } else if (combinedWaste > 0.01) {
          wasteArea += combinedWaste * strip.rollWidth;
        }
        break;
      }
    }
    
    if (!paired) {
      // This strip needs its own roll
      if (rollWaste >= MIN_REUSABLE_OFFCUT_LENGTH) {
        reusableArea += rollWaste * strip.rollWidth;
      } else if (rollWaste > 0.01) {
        wasteArea += rollWaste * strip.rollWidth;
      }
    }
    
    // Count rolls by width
    if (strip.rollWidth === ROLL_WIDTH_NARROW) {
      rollCount165++;
    } else {
      rollCount205++;
    }
  }
  
  return { wasteArea, reusableArea, rollCount165, rollCount205, pairedLeftover };
}

/**
 * Build a wall strip configuration from a partition with specific widths
 */
function buildWallStripPlan(
  partition: number[][],
  walls: WallSegment[],
  stripWidths: RollWidth[], // Width for each strip in the partition
  bottomStrips: BottomStripInfo[],
  depth: number
): WallStripPlan | null {
  const stripCount = partition.length;
  if (stripWidths.length !== stripCount) return null;
  
  const totalVerticalOverlap = calculateTotalVerticalOverlap(stripCount);
  
  // Build basic strip info with widths
  const basicStrips = partition.map((wallIndices, i) => {
    const baseLength = wallIndices.reduce((sum, idx) => sum + walls[idx].length, 0);
    const wallLabels = wallIndices.map(idx => walls[idx].label);
    return { wallIndices, baseLength, wallLabels, rollWidth: stripWidths[i] };
  });
  
  // Check if all strips can fit in rolls (with minimum overlap)
  const minOverlapPerStrip = stripCount > 0 ? totalVerticalOverlap / stripCount : 0;
  for (const strip of basicStrips) {
    if (!fitsInRoll(strip.baseLength + minOverlapPerStrip)) {
      return null;  // This partition is not valid
    }
  }
  
  // Distribute vertical overlap optimally (now with rollWidth info)
  const overlaps = distributeVerticalOverlap(
    basicStrips,
    totalVerticalOverlap,
    bottomStrips,
    stripWidths
  );
  
  // Build final strip configs with overlaps applied
  const strips: WallStripConfig[] = basicStrips.map((strip, i) => {
    const totalLength = strip.baseLength + overlaps[i];
    
    return {
      wallLabels: strip.wallLabels,
      wallIndices: strip.wallIndices,
      baseLength: strip.baseLength,
      verticalOverlap: overlaps[i],
      totalLength: Math.round(totalLength * 10) / 10,
      rollWidth: strip.rollWidth,
    };
  });
  
  // Calculate total foil area
  const totalFoilArea = strips.reduce(
    (sum, s) => sum + s.totalLength * s.rollWidth,
    0
  );
  
  // Calculate waste
  const { wasteArea, reusableArea, rollCount165, rollCount205 } = calculateWasteForPlan(
    strips,
    bottomStrips,
    depth
  );
  
  return {
    strips,
    totalStripCount: stripCount,
    totalVerticalOverlap,
    totalFoilArea,
    wasteArea,
    reusableOffcutArea: reusableArea,
    rollCount165,
    rollCount205,
    score: 0,  // Will be calculated during selection
  };
}

/**
 * Generate all width combinations for a given number of strips
 */
function generateWidthCombinations(
  stripCount: number,
  availableWidths: RollWidth[]
): RollWidth[][] {
  if (stripCount === 0) return [[]];
  if (availableWidths.length === 1) {
    return [Array(stripCount).fill(availableWidths[0])];
  }
  
  // Generate all combinations of widths
  const combinations: RollWidth[][] = [];
  const stack: RollWidth[][] = [[]];
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.length === stripCount) {
      combinations.push(current);
      continue;
    }
    for (const width of availableWidths) {
      stack.push([...current, width]);
    }
  }
  
  return combinations;
}

/**
 * Generate all valid wall strip configurations
 */
export function generateWallStripConfigurations(
  dimensions: PoolDimensions,
  config: MixConfiguration,
  foilSubtype?: FoilSubtype | null
): WallStripPlan[] {
  const walls = getWallSegments(dimensions);
  const wallCount = walls.length;
  const depth = dimensions.depth;
  
  const availableWidths = getWallWidthsForDepth(depth, foilSubtype);
  const bottomStrips = getBottomStripsInfo(config);
  const partitions = generateWallPartitions(wallCount);
  
  const validPlans: WallStripPlan[] = [];
  
  for (const partition of partitions) {
    const stripCount = partition.length;
    
    // Generate all possible width combinations for this partition
    const widthCombinations = generateWidthCombinations(stripCount, availableWidths);
    
    for (const widths of widthCombinations) {
      const plan = buildWallStripPlan(
        partition,
        walls,
        widths,
        bottomStrips,
        depth
      );
      
      if (plan) {
        validPlans.push(plan);
      }
    }
  }
  
  return validPlans;
}

function estimateAdditionalWallRollArea(
  plan: WallStripPlan,
  bottomStrips: BottomStripInfo[]
): number {
  // How much FULL roll area we need to order specifically for walls,
  // assuming we can pack wall strips into offcuts from bottom rolls.
  // If a wall strip fits into a bottom offcut (same width), it does not require a new roll.
  const usedBottom = new Set<number>();
  let additionalArea = 0;

  for (const strip of plan.strips) {
    let paired = false;
    for (let bi = 0; bi < bottomStrips.length; bi++) {
      if (usedBottom.has(bi)) continue;
      const bottom = bottomStrips[bi];
      if (bottom.rollWidth !== strip.rollWidth) continue;

      if (strip.totalLength <= bottom.offcutLength + 0.001) {
        usedBottom.add(bi);
        paired = true;
        break;
      }
    }

    if (!paired) {
      additionalArea += strip.rollWidth * ROLL_LENGTH;
    }
  }

  return additionalArea;
}

/**
 * Select the optimal wall strip configuration based on priority
 */
export function selectOptimalWallPlan(
  plans: WallStripPlan[],
  priority: OptimizationPriority,
  bottomStrips: BottomStripInfo[] = []
): WallStripPlan | null {
  if (plans.length === 0) return null;
  
  const scoredPlans = plans.map(plan => {
    let score: number;
    
    // Recalculate waste with pairedLeftover tracking
    const { wasteArea, pairedLeftover } = calculateWasteForPlan(plan.strips, bottomStrips, 0);
    
    if (priority === 'minWaste') {
      // 1. Minimalizuj odpad nieużyteczny
      // 2. Minimalizuj resztki z parowania (preferuj dokładne dopasowanie do offcutów)
      // 3. Minimalizuj liczbę pasów (= mniej rolek)
      // 4. Mniejsza powierzchnia folii
      score = wasteArea * 1_000_000 
            + pairedLeftover * 10_000  // Prefer exact fits over loose fits
            + plan.totalStripCount * 100 
            + plan.totalFoilArea * 0.01;
    } else {
      // minRolls:
      // 1. Minimalizuj dodatkową powierzchnię rolek wymaganych SPECJALNIE na ściany
      //    (czyli preferuj takie pasy ścian, które mieszczą się w resztkach z dna).
      // 2. Minimalizuj resztki z parowania
      // 3. Dopiero potem minimalizuj m² folii na ściany (gdy dodatkowe rolki są równe).
      const additionalWallRollArea = estimateAdditionalWallRollArea(plan, bottomStrips);
      score = additionalWallRollArea * 1_000_000
            + pairedLeftover * 10_000
            + plan.totalFoilArea * 1000
            + wasteArea * 10
            + plan.totalStripCount;
    }
    
    return { ...plan, score };
  });
  
  scoredPlans.sort((a, b) => a.score - b.score);
  return scoredPlans[0];
}

/**
 * Get the optimal wall strip plan for given dimensions and configuration
 */
export function getOptimalWallStripPlan(
  dimensions: PoolDimensions,
  config: MixConfiguration,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): WallStripPlan | null {
  const plans = generateWallStripConfigurations(dimensions, config, foilSubtype);
  const bottomStrips = getBottomStripsInfo(config);
  return selectOptimalWallPlan(plans, priority, bottomStrips);
}

/**
 * Convert WallStripConfig to the format needed by calculateSurfaceDetails
 */
export function wallPlanToDetailedStrips(
  plan: WallStripPlan
): Array<{
  count: number;
  rollWidth: RollWidth;
  stripLength: number;
  wallLabels: string[];
}> {
  return plan.strips.map(strip => ({
    count: 1,
    rollWidth: strip.rollWidth,
    stripLength: strip.totalLength,
    wallLabels: strip.wallLabels,
  }));
}
