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
 * - Asymmetric vertical overlap distribution for better roll utilization
 * - Cross-surface pairing with bottom strips
 * - Full BFD packing simulation (bottom + walls together) for accurate scoring
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

/** Result of full BFD packing simulation */
interface BFDPackingResult {
  totalRolls: number;
  fullyUsedRolls: number;  // rolls with waste < 0.5m
  totalWasteLength: number;
}

/**
 * Simulate full BFD packing of bottom + wall strips together
 * Returns actual roll count when all strips are packed optimally
 */
function simulateFullBFDPacking(
  bottomStrips: Array<{ rollWidth: RollWidth; length: number }>,
  wallStrips: Array<{ rollWidth: RollWidth; length: number }>
): BFDPackingResult {
  // Group all strips by width
  const byWidth = new Map<RollWidth, number[]>();
  
  for (const s of bottomStrips) {
    const arr = byWidth.get(s.rollWidth) || [];
    arr.push(s.length);
    byWidth.set(s.rollWidth, arr);
  }
  for (const s of wallStrips) {
    const arr = byWidth.get(s.rollWidth) || [];
    arr.push(s.length);
    byWidth.set(s.rollWidth, arr);
  }
  
  let totalRolls = 0;
  let fullyUsedRolls = 0;
  let totalWasteLength = 0;
  
  for (const [_width, lengths] of byWidth) {
    // Sort descending (BFD)
    const sorted = [...lengths].sort((a, b) => b - a);
    const bins: number[] = []; // remaining capacity per bin
    
    for (const len of sorted) {
      // Best-fit: find bin with smallest remaining capacity that still fits
      let bestIdx = -1;
      let bestRemaining = Infinity;
      
      for (let i = 0; i < bins.length; i++) {
        if (bins[i] >= len - 0.001) {
          const remaining = bins[i] - len;
          if (remaining < bestRemaining) {
            bestRemaining = remaining;
            bestIdx = i;
          }
        }
      }
      
      if (bestIdx >= 0) {
        bins[bestIdx] -= len;
      } else {
        bins.push(ROLL_LENGTH - len);
      }
    }
    
    totalRolls += bins.length;
    for (const remaining of bins) {
      totalWasteLength += remaining;
      if (remaining < 0.5) {
        fullyUsedRolls++;
      }
    }
  }
  
  return { totalRolls, fullyUsedRolls, totalWasteLength };
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
    return [ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE];
  } else if (depth <= DEPTH_THRESHOLD_FOR_DOUBLE_NARROW) {
    return [ROLL_WIDTH_WIDE];
  } else {
    return [ROLL_WIDTH_NARROW];
  }
}

/**
 * Get bottom strip lengths from configuration
 */
function getBottomStripLengths(config: MixConfiguration): Array<{ rollWidth: RollWidth; length: number }> {
  const bottom = config.surfaces.find(s => s.surface === 'bottom');
  if (!bottom) return [];
  
  const mix = bottom.stripMix && bottom.stripMix.length > 0
    ? bottom.stripMix
    : [{ rollWidth: bottom.rollWidth, count: bottom.stripCount }];
  
  const result: Array<{ rollWidth: RollWidth; length: number }> = [];
  for (const group of mix) {
    for (let i = 0; i < group.count; i++) {
      result.push({ rollWidth: group.rollWidth, length: bottom.stripLength });
    }
  }
  return result;
}

/**
 * Get bottom strip info from configuration for pairing (legacy, used by some scoring)
 */
function getBottomStripsInfo(config: MixConfiguration): BottomStripInfo[] {
  const bottom = config.surfaces.find(s => s.surface === 'bottom');
  if (!bottom) return [];
  
  const mix = bottom.stripMix && bottom.stripMix.length > 0
    ? bottom.stripMix
    : [{ rollWidth: bottom.rollWidth, count: bottom.stripCount }];

  const stripsByWidth = new Map<RollWidth, number[]>();
  for (const group of mix) {
    const arr = stripsByWidth.get(group.rollWidth) || [];
    for (let i = 0; i < group.count; i++) arr.push(bottom.stripLength);
    stripsByWidth.set(group.rollWidth, arr);
  }

  const result: BottomStripInfo[] = [];

  for (const [rollWidth, stripLengths] of stripsByWidth) {
    const sorted = [...stripLengths].sort((a, b) => b - a);
    const rolls: number[] = [];

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
 */
function generateWallPartitions(wallCount: number): number[][][] {
  const partitions: number[][][] = [];
  
  // 1 group: all walls together
  partitions.push([Array.from({ length: wallCount }, (_, i) => i)]);
  
  // wallCount groups: each wall separate
  partitions.push(Array.from({ length: wallCount }, (_, i) => [i]));
  
  // 2 groups
  for (let splitPoint = 1; splitPoint < wallCount; splitPoint++) {
    const group1 = Array.from({ length: splitPoint }, (_, i) => i);
    const group2 = Array.from({ length: wallCount - splitPoint }, (_, i) => i + splitPoint);
    partitions.push([group1, group2]);
  }
  
  // 3 groups
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
  return length <= ROLL_LENGTH + 0.001;
}

/**
 * Calculate total vertical overlap needed for a given number of strips
 */
function calculateTotalVerticalOverlap(stripCount: number): number {
  return stripCount * DEFAULT_VERTICAL_JOIN_OVERLAP;
}

/**
 * Generate overlap distribution variants for a set of strips
 * 
 * For N strips with N joins (circular), total overlap = N * 0.1m
 * Each join's overlap can go to either adjacent strip (min 0 per strip, but total must equal N*0.1)
 * 
 * Returns array of overlap-per-strip arrays
 */
function generateOverlapVariants(
  strips: Array<{ wallIndices: number[]; baseLength: number; rollWidth: RollWidth }>,
): number[][] {
  const n = strips.length;
  if (n === 0) return [[]];
  if (n === 1) return [[calculateTotalVerticalOverlap(1)]];
  
  const overlapPerJoin = DEFAULT_VERTICAL_JOIN_OVERLAP; // 0.1m
  const totalOverlap = n * overlapPerJoin;
  
  const variants: number[][] = [];
  
  if (n === 2) {
    // 2 strips, 2 joins (circular: strip0-strip1, strip1-strip0)
    // Each join's overlap can go to either strip
    // Possible: [0, 0.2], [0.1, 0.1], [0.2, 0]
    for (let toStrip0 = 0; toStrip0 <= 2; toStrip0++) {
      const overlap0 = toStrip0 * overlapPerJoin;
      const overlap1 = totalOverlap - overlap0;
      
      // Validate fits
      if (strips[0].baseLength + overlap0 <= ROLL_LENGTH + 0.001 &&
          strips[1].baseLength + overlap1 <= ROLL_LENGTH + 0.001) {
        variants.push([
          Math.round(overlap0 * 1000) / 1000,
          Math.round(overlap1 * 1000) / 1000
        ]);
      }
    }
  } else if (n === 3) {
    // 3 strips, 3 joins. Each join assigns its overlap to one of 2 adjacent strips.
    // Enumerate all 2^3 = 8 combinations
    for (let mask = 0; mask < (1 << n); mask++) {
      const overlaps = new Array(n).fill(0);
      let valid = true;
      
      for (let join = 0; join < n; join++) {
        const nextStrip = (join + 1) % n;
        // bit=0: overlap goes to strip[join], bit=1: goes to strip[nextStrip]
        if ((mask >> join) & 1) {
          overlaps[nextStrip] += overlapPerJoin;
        } else {
          overlaps[join] += overlapPerJoin;
        }
      }
      
      // Validate all strips fit in rolls
      for (let i = 0; i < n; i++) {
        if (strips[i].baseLength + overlaps[i] > ROLL_LENGTH + 0.001) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        variants.push(overlaps.map(o => Math.round(o * 1000) / 1000));
      }
    }
  } else {
    // 4+ strips: use default distribution + a few key variants
    // Default: equal distribution
    const defaultOverlaps = new Array(n).fill(overlapPerJoin);
    const defaultValid = defaultOverlaps.every((o, i) => strips[i].baseLength + o <= ROLL_LENGTH + 0.001);
    if (defaultValid) variants.push(defaultOverlaps);
    
    // Try pushing all overlap to each strip in turn
    for (let target = 0; target < n; target++) {
      const overlaps = new Array(n).fill(0);
      overlaps[target] = totalOverlap;
      if (strips[target].baseLength + totalOverlap <= ROLL_LENGTH + 0.001) {
        variants.push(overlaps);
      }
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return variants.filter(v => {
    const key = v.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build a wall strip configuration from a partition with specific widths and overlaps
 */
function buildWallStripPlan(
  partition: number[][],
  walls: WallSegment[],
  stripWidths: RollWidth[],
  overlaps: number[],
): WallStripPlan | null {
  const stripCount = partition.length;
  if (stripWidths.length !== stripCount || overlaps.length !== stripCount) return null;
  
  const totalVerticalOverlap = overlaps.reduce((s, o) => s + o, 0);
  
  const strips: WallStripConfig[] = partition.map((wallIndices, i) => {
    const baseLength = wallIndices.reduce((sum, idx) => sum + walls[idx].length, 0);
    const wallLabels = wallIndices.map(idx => walls[idx].label);
    const totalLength = baseLength + overlaps[i];
    
    return {
      wallLabels,
      wallIndices,
      baseLength,
      verticalOverlap: overlaps[i],
      totalLength: Math.round(totalLength * 1000) / 1000,
      rollWidth: stripWidths[i],
    };
  });
  
  // Validate all fit in rolls
  for (const strip of strips) {
    if (!fitsInRoll(strip.totalLength)) return null;
  }
  
  const totalFoilArea = strips.reduce(
    (sum, s) => sum + s.totalLength * s.rollWidth, 0
  );
  
  return {
    strips,
    totalStripCount: stripCount,
    totalVerticalOverlap,
    totalFoilArea,
    wasteArea: 0,
    reusableOffcutArea: 0,
    rollCount165: strips.filter(s => s.rollWidth === ROLL_WIDTH_NARROW).length,
    rollCount205: strips.filter(s => s.rollWidth === ROLL_WIDTH_WIDE).length,
    score: 0,
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
 * Generate all valid wall strip configurations with overlap variants
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
  const partitions = generateWallPartitions(wallCount);
  
  const validPlans: WallStripPlan[] = [];
  
  for (const partition of partitions) {
    const stripCount = partition.length;
    const widthCombinations = generateWidthCombinations(stripCount, availableWidths);
    
    for (const widths of widthCombinations) {
      // Build basic strip info for overlap variant generation
      const basicStrips = partition.map((wallIndices, i) => {
        const baseLength = wallIndices.reduce((sum, idx) => sum + walls[idx].length, 0);
        return { wallIndices, baseLength, rollWidth: widths[i] };
      });
      
      // Check if even minimum overlap fits
      const minOverlapPerStrip = stripCount > 0 ? calculateTotalVerticalOverlap(stripCount) / stripCount : 0;
      const anyTooLong = basicStrips.some(s => !fitsInRoll(s.baseLength + minOverlapPerStrip));
      if (anyTooLong) continue;
      
      // Generate overlap variants
      const overlapVariants = generateOverlapVariants(basicStrips);
      
      for (const overlaps of overlapVariants) {
        const plan = buildWallStripPlan(partition, walls, widths, overlaps);
        if (plan) {
          validPlans.push(plan);
        }
      }
    }
  }
  
  return validPlans;
}

/**
 * Calculate "width waste" - excess roll width beyond wall depth
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
 * Uses full BFD packing simulation (bottom + walls) for accurate scoring
 */
export function selectOptimalWallPlan(
  plans: WallStripPlan[],
  priority: OptimizationPriority,
  bottomStrips: Array<{ rollWidth: RollWidth; length: number }> = [],
  depth: number = 1.5
): WallStripPlan | null {
  if (plans.length === 0) return null;
  
  const scoredPlans = plans.map(plan => {
    // Convert wall strips for BFD simulation
    const wallStripList = plan.strips.map(s => ({
      rollWidth: s.rollWidth,
      length: s.totalLength,
    }));
    
    // Full BFD packing: bottom + walls together
    const bfd = simulateFullBFDPacking(bottomStrips, wallStripList);
    
    // Width waste
    const widthWaste = calculateWidthWaste(plan.strips, depth);
    
    let score: number;
    
    if (priority === 'minWaste') {
      // minWaste: minimize material usage and width waste
      // Primary: minimize total wall foil area (less material = less cost)
      // Secondary: width waste penalty (don't use 2.05m when 1.65m suffices)
      // Tertiary: fewer strips (fewer welds = better installation)
      // Bonus: prefer plans with more fully-used rolls (better offcuts)
      // Last: total rolls as tie-break
      score = plan.totalFoilArea * 10_000_000
            + widthWaste * 1_000_000
            + plan.totalStripCount * 100_000
            - bfd.fullyUsedRolls * 50_000
            + bfd.totalRolls * 10_000;
    } else {
      // minRolls: minimize total physical rolls (bottom + walls)
      // Strong width waste penalty to avoid unnecessary wider rolls
      score = bfd.totalRolls * 10_000_000
            + widthWaste * 1_000_000
            + plan.totalFoilArea * 10_000
            + plan.totalStripCount * 1_000;
    }
    
    return { ...plan, score };
  });
  
  scoredPlans.sort((a, b) => a.score - b.score);
  return scoredPlans[0];
}

/**
 * Get the optimal wall strip plan for given dimensions and configuration
 * Includes guardrail: if minRolls doesn't improve over minWaste, use minWaste
 */
export function getOptimalWallStripPlan(
  dimensions: PoolDimensions,
  config: MixConfiguration,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): WallStripPlan | null {
  const plans = generateWallStripConfigurations(dimensions, config, foilSubtype);
  const bottomStrips = getBottomStripLengths(config);
  
  if (priority === 'minRolls') {
    const minRollsPlan = selectOptimalWallPlan(plans, 'minRolls', bottomStrips, dimensions.depth);
    const minWastePlan = selectOptimalWallPlan(plans, 'minWaste', bottomStrips, dimensions.depth);
    
    if (!minRollsPlan) return minWastePlan;
    if (!minWastePlan) return minRollsPlan;
    
    // Guardrail: if minRolls doesn't reduce total rolls but increases foil area, use minWaste
    const wallStripsMinRolls = minRollsPlan.strips.map(s => ({ rollWidth: s.rollWidth, length: s.totalLength }));
    const wallStripsMinWaste = minWastePlan.strips.map(s => ({ rollWidth: s.rollWidth, length: s.totalLength }));
    
    const bfdMinRolls = simulateFullBFDPacking(bottomStrips, wallStripsMinRolls);
    const bfdMinWaste = simulateFullBFDPacking(bottomStrips, wallStripsMinWaste);
    
    if (bfdMinRolls.totalRolls >= bfdMinWaste.totalRolls && 
        minRollsPlan.totalFoilArea > minWastePlan.totalFoilArea + 0.01) {
      return minWastePlan;
    }
    
    return minRollsPlan;
  }
  
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
