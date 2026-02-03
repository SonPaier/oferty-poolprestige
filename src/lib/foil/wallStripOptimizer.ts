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
  
  // Helper: generate all ways to split walls into k groups
  // Each group is a contiguous range of wall indices (wrapping around)
  function generateKPartitions(k: number): number[][][] {
    if (k === 1) {
      // Single group with all walls
      return [[Array.from({ length: wallCount }, (_, i) => i)]];
    }
    
    if (k === wallCount) {
      // Each wall in its own group
      return [Array.from({ length: wallCount }, (_, i) => [i])];
    }
    
    const result: number[][][] = [];
    
    // For k groups, we need to choose k-1 split points among wallCount positions
    // Each split creates a new group
    function generateSplits(startWall: number, remaining: number, current: number[][]): void {
      if (remaining === 0) {
        // Last group gets all remaining walls
        const lastGroup: number[] = [];
        for (let i = startWall; i < wallCount; i++) {
          lastGroup.push(i);
        }
        // Also wrap around to include walls before the first split
        for (let i = 0; i < current[0][0]; i++) {
          lastGroup.push(i);
        }
        if (lastGroup.length > 0) {
          result.push([...current, lastGroup]);
        }
        return;
      }
      
      // For remaining groups, try all valid end positions
      const minWallsPerGroup = 1;
      const maxEndWall = wallCount - remaining * minWallsPerGroup;
      
      for (let endWall = startWall + minWallsPerGroup - 1; endWall < maxEndWall; endWall++) {
        const group: number[] = [];
        for (let i = startWall; i <= endWall; i++) {
          group.push(i);
        }
        generateSplits(endWall + 1, remaining - 1, [...current, group]);
      }
    }
    
    // Start from wall 0, need k-1 more splits after the first group
    for (let firstGroupEnd = 0; firstGroupEnd < wallCount - k + 1; firstGroupEnd++) {
      const firstGroup = Array.from({ length: firstGroupEnd + 1 }, (_, i) => i);
      generateSplits(firstGroupEnd + 1, k - 1, [firstGroup]);
    }
    
    return result;
  }
  
  // Generate partitions for 1, 2, 3, 4 strips
  for (let k = 1; k <= wallCount; k++) {
    const kPartitions = generateKPartitions(k);
    partitions.push(...kPartitions);
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
  strips: Array<{ wallIndices: number[]; baseLength: number }>,
  totalOverlap: number,
  bottomStrips: BottomStripInfo[],
  availableWidths: RollWidth[]
): number[] {
  const stripCount = strips.length;
  if (stripCount === 0) return [];
  if (stripCount === 1) return [totalOverlap];
  
  // Default: even distribution
  const baseOverlapPerStrip = totalOverlap / stripCount;
  const overlaps = new Array(stripCount).fill(baseOverlapPerStrip);
  
  // Try to optimize: move overlap to strips where it helps
  // A strip benefits from more overlap if:
  // 1. Its base length + extra overlap still fits in a roll
  // 2. It creates a better pairing opportunity with bottom offcuts
  
  const bottomOffcutLengths = bottomStrips
    .filter(b => availableWidths.includes(b.rollWidth))
    .map(b => b.offcutLength)
    .filter(len => len >= MIN_REUSABLE_OFFCUT_LENGTH);
  
  if (bottomOffcutLengths.length === 0) {
    // No pairing opportunities, use even distribution
    return overlaps;
  }
  
  // Sort strips by base length (ascending) - shorter strips can absorb more overlap
  const sortedIndices = strips
    .map((s, i) => ({ index: i, baseLength: s.baseLength }))
    .sort((a, b) => a.baseLength - b.baseLength);
  
  // Try to push overlap to shorter strips
  let remainingOverlap = totalOverlap;
  const assignedOverlaps = new Array(stripCount).fill(0);
  
  for (const { index, baseLength } of sortedIndices) {
    // How much overlap can this strip absorb?
    const maxOverlap = Math.min(
      MAX_VERTICAL_JOIN_OVERLAP * 2,  // Don't exceed reasonable max
      ROLL_LENGTH - baseLength,        // Must fit in roll
      remainingOverlap                 // Can't assign more than remaining
    );
    
    // Try to find a good pairing with bottom offcuts
    let bestOverlap = MIN_VERTICAL_JOIN_OVERLAP;
    
    for (const offcutLen of bottomOffcutLengths) {
      // If baseLength + overlap ≈ offcutLen, we can pair them
      const idealOverlap = offcutLen - baseLength;
      if (idealOverlap >= MIN_VERTICAL_JOIN_OVERLAP && idealOverlap <= maxOverlap) {
        bestOverlap = Math.max(bestOverlap, idealOverlap);
      }
    }
    
    // Ensure we have at least minimum overlap
    const assignedOverlap = Math.max(MIN_VERTICAL_JOIN_OVERLAP, Math.min(maxOverlap, bestOverlap));
    assignedOverlaps[index] = assignedOverlap;
    remainingOverlap -= assignedOverlap;
  }
  
  // If we have remaining overlap, distribute it evenly
  if (remainingOverlap > 0.01) {
    const extraPerStrip = remainingOverlap / stripCount;
    for (let i = 0; i < stripCount; i++) {
      // Only add if it still fits in roll
      const newOverlap = assignedOverlaps[i] + extraPerStrip;
      const stripLen = strips[i].baseLength + newOverlap;
      if (fitsInRoll(stripLen)) {
        assignedOverlaps[i] = newOverlap;
      }
    }
  }
  
  return assignedOverlaps;
}

/**
 * Calculate waste for a strip configuration
 */
function calculateWasteForPlan(
  strips: WallStripConfig[],
  bottomStrips: BottomStripInfo[],
  depth: number
): { wasteArea: number; reusableArea: number; rollCount165: number; rollCount205: number } {
  let wasteArea = 0;
  let reusableArea = 0;
  let rollCount165 = 0;
  let rollCount205 = 0;
  
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
  
  return { wasteArea, reusableArea, rollCount165, rollCount205 };
}

/**
 * Build a wall strip configuration from a partition
 */
function buildWallStripPlan(
  partition: number[][],
  walls: WallSegment[],
  availableWidths: RollWidth[],
  bottomStrips: BottomStripInfo[],
  depth: number,
  preferredWidth: RollWidth
): WallStripPlan | null {
  const stripCount = partition.length;
  const totalVerticalOverlap = calculateTotalVerticalOverlap(stripCount);
  
  // Build basic strip info
  const basicStrips = partition.map(wallIndices => {
    const baseLength = wallIndices.reduce((sum, idx) => sum + walls[idx].length, 0);
    const wallLabels = wallIndices.map(idx => walls[idx].label);
    return { wallIndices, baseLength, wallLabels };
  });
  
  // Check if all strips can fit in rolls (with minimum overlap)
  const minOverlapPerStrip = stripCount > 0 ? totalVerticalOverlap / stripCount : 0;
  for (const strip of basicStrips) {
    if (!fitsInRoll(strip.baseLength + minOverlapPerStrip)) {
      return null;  // This partition is not valid
    }
  }
  
  // Distribute vertical overlap optimally
  const overlaps = distributeVerticalOverlap(
    basicStrips,
    totalVerticalOverlap,
    bottomStrips,
    availableWidths
  );
  
  // Assign roll widths to each strip
  // Strategy: use preferred width unless pairing benefits from different width
  const strips: WallStripConfig[] = basicStrips.map((strip, i) => {
    const totalLength = strip.baseLength + overlaps[i];
    
    // Choose width: prefer matching bottom offcuts if possible
    let bestWidth = preferredWidth;
    if (availableWidths.length > 1) {
      // Check if any width gives better pairing
      for (const width of availableWidths) {
        const matchingOffcuts = bottomStrips.filter(
          b => b.rollWidth === width && b.offcutLength >= totalLength - 0.1
        );
        if (matchingOffcuts.length > 0) {
          bestWidth = width;
          break;
        }
      }
    }
    
    return {
      wallLabels: strip.wallLabels,
      wallIndices: strip.wallIndices,
      baseLength: strip.baseLength,
      verticalOverlap: overlaps[i],
      totalLength: Math.round(totalLength * 10) / 10,
      rollWidth: bestWidth,
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
  const preferredWidth = availableWidths.includes(ROLL_WIDTH_WIDE) && depth > DEPTH_THRESHOLD_FOR_WIDE
    ? ROLL_WIDTH_WIDE
    : ROLL_WIDTH_NARROW;
  
  const bottomStrips = getBottomStripsInfo(config);
  const partitions = generateWallPartitions(wallCount);
  
  const validPlans: WallStripPlan[] = [];
  
  for (const partition of partitions) {
    const plan = buildWallStripPlan(
      partition,
      walls,
      availableWidths,
      bottomStrips,
      depth,
      preferredWidth
    );
    
    if (plan) {
      validPlans.push(plan);
    }
  }
  
  return validPlans;
}

/**
 * Select the optimal wall strip configuration based on priority
 */
export function selectOptimalWallPlan(
  plans: WallStripPlan[],
  priority: OptimizationPriority
): WallStripPlan | null {
  if (plans.length === 0) return null;
  
  // Score each plan based on priority
  const scoredPlans = plans.map(plan => {
    let score: number;
    
    if (priority === 'minWaste') {
      // Primary: minimize waste area
      // Secondary: fewer strips (simpler installation)
      // Tertiary: less total foil area
      score = plan.wasteArea * 1000 + plan.totalStripCount * 10 + plan.totalFoilArea * 0.01;
    } else {
      // minRolls: minimize total m² of foil to order
      // Primary: minimize total foil area (fewer/smaller rolls)
      // Secondary: minimize waste (better utilization)
      // Tertiary: fewer strips
      score = plan.totalFoilArea * 100 + plan.wasteArea * 10 + plan.totalStripCount;
    }
    
    return { ...plan, score };
  });
  
  // Sort by score (ascending = better)
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
  return selectOptimalWallPlan(plans, priority);
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
