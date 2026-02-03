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
  usedLength: number;    // total bottom length already consumed in this physical roll
  offcutLength: number;  // remaining length available for pairing: ROLL_LENGTH - usedLength
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
  
  // IMPORTANT:
  // `stripMix.count` represents number of BOTTOM STRIPS (not necessarily number of ordered rolls).
  // Multiple bottom strips of the same width can be cut from one physical roll (25m).
  // For cross-surface pairing (bottom -> walls) we must therefore model *physical bottom rolls*
  // and compute the remaining length (offcut) after cutting all bottom strips assigned to that roll.

  // Build a list of strip lengths per width
  const stripsByWidth = new Map<RollWidth, number[]>();
  for (const group of mix) {
    const arr = stripsByWidth.get(group.rollWidth) || [];
    for (let i = 0; i < group.count; i++) arr.push(bottom.stripLength);
    stripsByWidth.set(group.rollWidth, arr);
  }

  const result: BottomStripInfo[] = [];

  // Pack bottom strips into physical rolls per width (First Fit Decreasing)
  for (const [rollWidth, stripLengths] of stripsByWidth) {
    const sorted = [...stripLengths].sort((a, b) => b - a);
    const rolls: number[] = []; // used length per roll

    for (const len of sorted) {
      let placed = false;
      for (let i = 0; i < rolls.length; i++) {
        if (ROLL_LENGTH - rolls[i] >= len - 0.001) {
          rolls[i] += len;
          placed = true;
          break;
        }
      }
      if (!placed) {
        rolls.push(len);
      }
    }

    for (const usedLength of rolls) {
      result.push({
        rollWidth,
        usedLength,
        offcutLength: Math.max(0, ROLL_LENGTH - usedLength),
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
/**
 * Pack wall strips into rolls (same width strips can share a roll)
 * Returns the actual number of rolls needed and waste
 */
function packStripsIntoRolls(
  strips: WallStripConfig[]
): { rollsNeeded: number; totalWaste: number; reusableWaste: number; nonReusableWaste: number } {
  // Group strips by width
  const byWidth = new Map<RollWidth, WallStripConfig[]>();
  for (const strip of strips) {
    const existing = byWidth.get(strip.rollWidth) || [];
    existing.push(strip);
    byWidth.set(strip.rollWidth, existing);
  }
  
  let rollsNeeded = 0;
  let totalWaste = 0;
  let reusableWaste = 0;
  let nonReusableWaste = 0;
  
  for (const [_width, widthStrips] of byWidth) {
    // Sort by length descending (First Fit Decreasing)
    const sorted = [...widthStrips].sort((a, b) => b.totalLength - a.totalLength);
    const rolls: number[] = []; // Each element is remaining space in that roll
    
    for (const strip of sorted) {
      // Find first roll that can fit this strip
      let placed = false;
      for (let i = 0; i < rolls.length; i++) {
        if (rolls[i] >= strip.totalLength) {
          rolls[i] -= strip.totalLength;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Need a new roll
        rolls.push(ROLL_LENGTH - strip.totalLength);
      }
    }
    
    rollsNeeded += rolls.length;
    for (const remaining of rolls) {
      totalWaste += remaining;
      if (remaining >= MIN_REUSABLE_OFFCUT_LENGTH) {
        reusableWaste += remaining;
      } else if (remaining > 0.01) {
        nonReusableWaste += remaining;
      }
    }
  }
  
  return { rollsNeeded, totalWaste, reusableWaste, nonReusableWaste };
}

function calculateWasteForPlan(
  strips: WallStripConfig[],
  bottomStrips: BottomStripInfo[],
  _depth: number
): { wasteArea: number; reusableArea: number; rollCount165: number; rollCount205: number; pairedLeftover: number; actualRollsNeeded: number } {
  // First, pack wall strips into rolls (considering that multiple strips can share a roll)
  const packing = packStripsIntoRolls(strips);
  
  // Calculate area-based waste using the actual roll width
  let wasteArea = 0;
  let reusableArea = 0;
  let pairedLeftover = 0;
  
  // Count rolls by width
  let rollCount165 = 0;
  let rollCount205 = 0;
  for (const strip of strips) {
    if (strip.rollWidth === ROLL_WIDTH_NARROW) rollCount165++;
    else rollCount205++;
  }
  
  // For waste calculation, use the packed rolls info
  // We need to convert linear waste to area (multiply by average width or dominant width)
  const dominantWidth = strips.length > 0 ? strips[0].rollWidth : ROLL_WIDTH_NARROW;
  wasteArea = packing.nonReusableWaste * dominantWidth;
  reusableArea = packing.reusableWaste * dominantWidth;
  
  // Check if wall strips can pair with bottom OFFCUTS (cross-surface optimization)
  const usedBottomIndices = new Set<number>();
  for (const strip of strips) {
    for (let bi = 0; bi < bottomStrips.length; bi++) {
      if (usedBottomIndices.has(bi)) continue;
      const bottom = bottomStrips[bi];
      if (bottom.rollWidth !== strip.rollWidth) continue;
      
      // bottom.offcutLength is what is actually left in that physical bottom roll
      if (strip.totalLength <= bottom.offcutLength + 0.001) {
        usedBottomIndices.add(bi);
        const leftover = bottom.offcutLength - strip.totalLength;
        pairedLeftover += Math.max(0, leftover);
        break;
      }
    }
  }
  
  return { 
    wasteArea, 
    reusableArea, 
    rollCount165, 
    rollCount205, 
    pairedLeftover,
    actualRollsNeeded: packing.rollsNeeded
  };
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
 * Exact additional ordered roll area for WALLS when we can consume bottom offcuts.
 * Works per width, using First Fit Decreasing bin packing:
 * - bins start with bottom offcuts (capacity = offcutLength)
 * - if strip doesn't fit, we open a new roll bin (capacity = 25m)
 */
function calculateAdditionalWallOrderedArea(
  strips: WallStripConfig[],
  bottomRolls: BottomStripInfo[]
): number {
  const stripsByWidth = new Map<RollWidth, number[]>();
  for (const s of strips) {
    const arr = stripsByWidth.get(s.rollWidth) || [];
    arr.push(s.totalLength);
    stripsByWidth.set(s.rollWidth, arr);
  }

  let additionalArea = 0;

  for (const [width, lengths] of stripsByWidth) {
    const bins: number[] = bottomRolls
      .filter(b => b.rollWidth === width)
      .map(b => b.offcutLength)
      .filter(cap => cap > 0.001)
      .sort((a, b) => b - a);

    const sortedLengths = [...lengths].sort((a, b) => b - a);

    let newRolls = 0;
    const capacities = [...bins];

    for (const len of sortedLengths) {
      let placed = false;

      // try existing bins first (bottom offcuts or previously opened rolls)
      for (let i = 0; i < capacities.length; i++) {
        if (capacities[i] >= len - 0.001) {
          capacities[i] -= len;
          placed = true;
          break;
        }
      }

      if (!placed) {
        // open a new roll (25m)
        newRolls++;
        capacities.push(ROLL_LENGTH - len);
      }
    }

    additionalArea += newRolls * width * ROLL_LENGTH;
  }

  return additionalArea;
}

/**
 * Calculate "width waste" - excess roll width beyond wall depth
 * This penalizes using 2.05m rolls when 1.65m would suffice
 */
function calculateWidthWaste(strips: WallStripConfig[], depth: number): number {
  let waste = 0;
  for (const strip of strips) {
    const excessWidth = Math.max(0, strip.rollWidth - depth);
    waste += excessWidth * strip.totalLength;
  }
  return waste;
}

/**
 * Select the optimal wall strip configuration based on priority
 */
export function selectOptimalWallPlan(
  plans: WallStripPlan[],
  priority: OptimizationPriority,
  bottomStrips: BottomStripInfo[] = [],
  depth: number = 1.5
): WallStripPlan | null {
  if (plans.length === 0) return null;
  
  const scoredPlans = plans.map(plan => {
    let score: number;
    
    // Recalculate waste with proper strip packing (multiple strips can share a roll)
    const { wasteArea, pairedLeftover, actualRollsNeeded } = calculateWasteForPlan(plan.strips, bottomStrips, 0);
    
    // Calculate width waste (using wider roll than needed)
    const widthWaste = calculateWidthWaste(plan.strips, depth);
    
    if (priority === 'minWaste') {
      // For minWaste, the key insight is:
      // 1. Fewer strips = fewer welds = better quality installation
      // 2. When multiple configurations fit in the same number of rolls,
      //    prefer fewer strips even if waste is slightly higher
      // 3. Non-reusable waste difference of <1m² is negligible
      
      // Calculate if waste difference is significant (> 1m²)
      const wasteSignificance = wasteArea > 1 ? wasteArea * 10_000 : 0;
      
      // Prefer more balanced strip lengths when strip count is the same
      // (e.g. 15m + 15.2m over 10m + 20.2m)
      const lengths = plan.strips.map((s) => s.totalLength);
      const imbalance = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : 0;

      score = actualRollsNeeded * 100_000_000  // Primary: minimize rolls
            + wasteSignificance                 // Secondary: only if waste > 1m²
            + plan.totalStripCount * 10_000     // Tertiary: minimize welds
            + imbalance * 1_000                 // Tie-break: more balanced splits
            + pairedLeftover * 100
            + plan.totalFoilArea * 0.01;
    } else {
      // minRolls: minimize additional ORDERED m² for walls (roll width × 25m),
      // after consuming bottom offcuts (same width) wherever possible.
      // 
      // IMPORTANT: More strips can actually be BETTER if they fit into bottom offcuts!
      // E.g., 4 short strips (5m + 5m + 10m + 10m) may all fit in leftover space,
      // while 2 long strips (10m + 20m) may require a new roll because 20m doesn't fit.

      const additionalOrderedArea = calculateAdditionalWallOrderedArea(plan.strips, bottomStrips);

      // Primary: minimize total ordered m² (area from new rolls needed for walls)
      // Secondary: minimize width waste (don't use 2.05m when 1.65m suffices)
      // Tertiary: if equal, prefer fewer strips (fewer welds) for installation quality
      score = additionalOrderedArea * 1_000_000 // Primary: minimize ordered m² for walls
            + widthWaste * 100_000              // Secondary: avoid excessive width strongly
            + plan.totalFoilArea * 1_000        // Tertiary: prefer less total foil used
            + plan.totalStripCount * 100        // Lower priority: fewer strips only as tie-break
            + wasteArea * 10
            + pairedLeftover;
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
  return selectOptimalWallPlan(plans, priority, bottomStrips, dimensions.depth);
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
