/**
 * MIX Roll Planner - Allows different roll widths per surface with auto-optimization
 * 
 * Width restrictions by foil type:
 * - jednokolorowa: 1.65m or 2.05m
 * - nadruk: only 1.65m
 * - strukturalna: only 1.65m, butt joint on bottom (no overlap)
 * 
 * Foil Assignment:
 * - MAIN: bottom, walls, dividing wall (user's choice)
 * - STRUCTURAL: stairs, paddling pool bottom (always 1.65m structural)
 * 
 * Wall Strip Optimization:
 * - Dynamically chooses optimal number of strips (1, 2, 3, 4+)
 * - Distributes vertical overlap unevenly for better roll utilization
 * - Supports cross-surface pairing with bottom strips
 */

import { PoolDimensions } from '@/types/configurator';
import { FoilSubtype } from '@/lib/finishingMaterials';
import { 
  ExtendedSurfacePlan, 
  FoilAssignment, 
  SURFACE_FOIL_ASSIGNMENT,
  WASTE_THRESHOLD,
  MIN_USABLE_WASTE_LENGTH,
  OVERLAP_STRIPS,
} from './types';
import {
  getOptimalWallStripPlan,
  wallPlanToDetailedStrips,
  WallStripPlan,
} from './wallStripOptimizer';

export const ROLL_WIDTH_NARROW = 1.65;
export const ROLL_WIDTH_WIDE = 2.05;
export const ROLL_LENGTH = 25;
export const MIN_REUSABLE_OFFCUT_LENGTH = 2; // meters
export const MIN_OVERLAP_BOTTOM = 0.05;
export const MIN_OVERLAP_WALL = 0.10;

// Vertical join overlap (wall strip-to-strip joins around the perimeter)
// Updated range: 7–15cm, default 10cm (can be optimized when it helps reuse offcuts)
export const MIN_VERTICAL_JOIN_OVERLAP = 0.07;
export const MAX_VERTICAL_JOIN_OVERLAP = 0.15;
export const DEFAULT_VERTICAL_JOIN_OVERLAP = 0.10;

export const FOLD_AT_BOTTOM = 0.15;
export const BUTT_JOINT_OVERLAP = 0; // Structural foil uses butt joint (no overlap)

// Wall overlap thresholds (for horizontal top/bottom overlaps)
export const DEPTH_THRESHOLD_FOR_WIDE = 1.55; // Depth threshold for using 2.05m roll on walls
// Above this depth, walls should be made from two narrow strips (1.65m) instead of wide rolls.
export const DEPTH_THRESHOLD_FOR_DOUBLE_NARROW = 1.95;
export const MIN_HORIZONTAL_OVERLAP = 0.05;   // Min 5cm for top/bottom weld
export const MAX_HORIZONTAL_OVERLAP = 0.10;   // Max 10cm for top/bottom weld

export type RollWidth = typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;

/**
 * Check if foil type only supports narrow (1.65m) width
 */
export function isNarrowOnlyFoil(foilSubtype?: FoilSubtype | null): boolean {
  return foilSubtype === 'nadruk' || foilSubtype === 'strukturalna';
}

/**
 * Get available widths for a given foil subtype
 */
export function getAvailableWidths(foilSubtype?: FoilSubtype | null): RollWidth[] {
  if (isNarrowOnlyFoil(foilSubtype)) {
    return [ROLL_WIDTH_NARROW];
  }
  return [ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE];
}

/**
 * Check if foil uses butt joint (no overlap on bottom)
 */
export function usesButtJoint(foilSubtype?: FoilSubtype | null): boolean {
  return foilSubtype === 'strukturalna';
}

/**
 * Calculate total butt joint weld meters for structural foil
 * 
 * For structural foils, strips on the bottom are joined with butt joints (no overlap).
 * The butt joint length = (number of joints) × (strip length)
 * Number of joints = number of strips - 1
 * 
 * @returns Total butt joint length in meters
 */
export function calculateButtJointMeters(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null
): number {
  // Only structural foil uses butt joints
  if (!usesButtJoint(foilSubtype)) return 0;
  
  const bottomSurface = config.surfaces.find(s => s.surface === 'bottom');
  if (!bottomSurface) return 0;
  
  // Get strip count from stripMix or default stripCount
  let stripCount: number;
  if (bottomSurface.stripMix && bottomSurface.stripMix.length > 0) {
    stripCount = bottomSurface.stripMix.reduce((sum, m) => sum + m.count, 0);
  } else {
    stripCount = bottomSurface.stripCount;
  }
  
  // Number of butt joints = strips - 1
  const jointCount = Math.max(0, stripCount - 1);
  
  // Each joint runs the full length of the strip
  const jointLength = bottomSurface.stripLength;
  
  return Math.round(jointCount * jointLength * 10) / 10;
}

export type SurfaceKey = 'bottom' | 'walls' | 'wall-long' | 'wall-short' | 'stairs' | 'paddling' | 'dividing-wall';

/** Optimization priority for roll selection */
export type OptimizationPriority = 'minWaste' | 'minRolls';

function getPreferredWallRollWidth(
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null
): RollWidth {
  // Printed / structural foils are narrow-only.
  if (isNarrowOnlyFoil(foilSubtype)) return ROLL_WIDTH_NARROW;

  const d = dimensions.depth;
  // Rule (independent of optimization priority):
  // - depth <= 1.55m => 1.65m
  // - 1.55m < depth <= 1.95m => 2.05m
  // - depth > 1.95m => 2×1.65m (so still narrow width)
  if (d <= DEPTH_THRESHOLD_FOR_WIDE) return ROLL_WIDTH_NARROW;
  if (d <= DEPTH_THRESHOLD_FOR_DOUBLE_NARROW) return ROLL_WIDTH_WIDE;
  return ROLL_WIDTH_NARROW;
}

/** Wall segment with label and length */
export interface WallSegment {
  label: string;  // e.g., 'A-B', 'B-C'
  length: number; // length in meters
}

/** Strip with wall labels for display */
export interface WallStripInfo {
  rollWidth: RollWidth;
  stripLength: number;
  wallLabels: string[]; // e.g., ['A-B'], ['B-C', 'C-D'], ['A-B-C-D']
  rollNumber?: number;
}

export interface SurfaceRollConfig {
  surface: SurfaceKey;
  surfaceLabel: string;
  rollWidth: RollWidth;
  /**
   * Optional strip mix for a surface (e.g. bottom can be 2×1.65 + 1×2.05).
   * When provided, `stripCount` should equal the sum of mix counts.
   */
  stripMix?: Array<{ rollWidth: RollWidth; count: number }>;
  stripCount: number;
  areaM2: number;
  wasteM2: number;
  isManualOverride: boolean;
  stripLength: number;
  coverWidth: number;
  /** Which foil pool this surface belongs to */
  foilAssignment: FoilAssignment;
}

export interface MixConfiguration {
  surfaces: SurfaceRollConfig[];
  totalRolls165: number;
  totalRolls205: number;
  totalWaste: number;
  wastePercentage: number;
  isOptimized: boolean;
}

/** Detailed result for a single surface (for UI display) */
export interface SurfaceDetailedResult {
  surfaceKey: SurfaceKey;
  surfaceLabel: string;
  strips: Array<{
    count: number;
    rollWidth: RollWidth;
    stripLength: number;
    rollNumber?: number;
    wallLabels?: string[]; // only for walls
  }>;
  coverArea: number;       // net area to cover
  totalFoilArea: number;   // total foil area (rounded up)
  weldArea: number;        // overlap/weld area (or butt joint for structural)
  wasteArea: number;       // unusable waste
  isButtJoint?: boolean;   // true for structural foil (butt joint instead of overlap)
}

/** Reusable offcut piece */
export interface ReusableOffcut {
  rollNumber: number;
  rollWidth: RollWidth;
  length: number;  // offcut length (m)
  area: number;    // offcut area (m²)
}

/**
 * Foil calculation result with separate pools for main and structural foil
 */
export interface FoilCalculationResult {
  mainPool: {
    surfaces: SurfaceRollConfig[];
    rolls: RollAllocation[];
    totalRolls165: number;
    totalRolls205: number;
    coverageArea: number;
    weldArea: number;
    wasteArea: number;
  };
  structural: {
    surfaces: SurfaceRollConfig[];
    rolls: RollAllocation[];
    totalRolls165: number;
    coverageArea: number;
    weldArea: number;
    wasteArea: number;
  };
}

export interface RollAllocation {
  rollNumber: number;
  rollWidth: RollWidth;
  usedLength: number;
  wasteLength: number;
  strips: { surface: string; stripIndex: number; length: number }[];
}

function approxEq(a: number, b: number, eps = 0.05) {
  return Math.abs(a - b) <= eps;
}

function computeWallStripCount(perimeter: number, overlapPerJoin: number): number {
  let c = 1;
  while (perimeter + c * overlapPerJoin > c * ROLL_LENGTH) c += 1;
  return c;
}

function pickVerticalJoinOverlap(perimeter: number): { stripCount: number; overlapPerJoin: number } {
  const overlapDefault = Math.max(
    MIN_VERTICAL_JOIN_OVERLAP,
    Math.min(MAX_VERTICAL_JOIN_OVERLAP, DEFAULT_VERTICAL_JOIN_OVERLAP)
  );
  const overlapMin = MIN_VERTICAL_JOIN_OVERLAP;

  const stripCountDefault = computeWallStripCount(perimeter, overlapDefault);
  const stripCountMin = computeWallStripCount(perimeter, overlapMin);

  if (stripCountMin < stripCountDefault) {
    return { stripCount: stripCountMin, overlapPerJoin: overlapMin };
  }

  return { stripCount: stripCountDefault, overlapPerJoin: overlapDefault };
}

function getBottomStripLengthsByWidth(config: MixConfiguration): Array<{ rollWidth: RollWidth; length: number }> {
  const bottom = config.surfaces.find((s) => s.surface === 'bottom');
  if (!bottom) return [];

  const mix = bottom.stripMix && bottom.stripMix.length > 0
    ? bottom.stripMix
    : [{ rollWidth: bottom.rollWidth, count: bottom.stripCount }];

  const out: Array<{ rollWidth: RollWidth; length: number }> = [];
  for (const group of mix) {
    for (let i = 0; i < group.count; i++) {
      out.push({ rollWidth: group.rollWidth, length: bottom.stripLength });
    }
  }
  return out;
}

function hasBottomOffcutCandidate(
  config: MixConfiguration,
  wallRollWidth: RollWidth | RollWidth[],
  desiredOffcutLength: number
): boolean {
  const widths = Array.isArray(wallRollWidth) ? wallRollWidth : [wallRollWidth];
  const bottomStrips = getBottomStripLengthsByWidth(config);

  return widths.some((w) =>
    bottomStrips
      .filter((s) => s.rollWidth === w)
      .some((s) => {
        const offcut = ROLL_LENGTH - s.length;
        return offcut >= MIN_REUSABLE_OFFCUT_LENGTH && approxEq(offcut, desiredOffcutLength, 0.05);
      })
  );
}

function computeWallStripPlanFromPerimeter(
  perimeter: number,
  config: MixConfiguration,
  wallRollWidth: RollWidth | RollWidth[]
): {
  stripCount: number;
  overlapPerJoin: number;
  totalVerticalOverlap: number;
  totalLengthNeeded: number;
  stripLengths: number[];
  preferOffcutSplit: boolean;
  basePerimeterPerStrip: number;
} {
  const { stripCount, overlapPerJoin } = pickVerticalJoinOverlap(perimeter);
  const totalVerticalOverlap = stripCount * overlapPerJoin;
  const totalLengthNeeded = perimeter + totalVerticalOverlap;

  const basePerimeterPerStrip = perimeter / stripCount;

  let preferOffcutSplit = false;
  const stripLengths: number[] = [];

  if (stripCount === 1) {
    stripLengths.push(perimeter + overlapPerJoin);
  } else if (stripCount === 2) {
    // Prefer: 15.0 + 15.2 style split when we can create/reuse an offcut.
    // (Default overlap per join = 10cm unless it changes strip count)
    preferOffcutSplit =
      basePerimeterPerStrip + totalVerticalOverlap <= ROLL_LENGTH &&
      hasBottomOffcutCandidate(config, wallRollWidth, basePerimeterPerStrip);

    if (preferOffcutSplit) {
      stripLengths.push(basePerimeterPerStrip);
      stripLengths.push(basePerimeterPerStrip + totalVerticalOverlap);
    } else {
      stripLengths.push(basePerimeterPerStrip + overlapPerJoin);
      stripLengths.push(basePerimeterPerStrip + overlapPerJoin);
    }
  } else {
    for (let i = 0; i < stripCount; i++) {
      stripLengths.push(basePerimeterPerStrip + overlapPerJoin);
    }
  }

  return {
    stripCount,
    overlapPerJoin,
    totalVerticalOverlap,
    totalLengthNeeded,
    stripLengths,
    preferOffcutSplit,
    basePerimeterPerStrip,
  };
}

interface SurfaceDefinition {
  key: SurfaceKey;
  label: string;
  stripLength: number;
  coverWidth: number;
  count: number; // e.g., 2 for walls (both sides)
  overlap: number;
  isButtJoint?: boolean; // For structural foil bottom
  foilAssignment: FoilAssignment; // Which foil pool this belongs to
}

/**
 * Calculate strips needed for a given width and roll width
 * 
 * Key insight: The overlap between strips can be adjusted (within reason) to minimize edge waste.
 * If the actual overlap needed to exactly cover the width is >= minOverlap and <= maxOverlap,
 * there's no edge waste.
 * 
 * IMPORTANT: Overlap is NOT waste - it's required material for welding. Only edge excess beyond
 * what's needed is counted as waste.
 */
function calculateStripsForWidth(
  coverWidth: number,
  rollWidth: RollWidth,
  minOverlap: number
): { count: number; coveredWidth: number; wasteArea: number; totalCoveredWidth: number; materialWidthUsed: number; actualOverlap: number } {
  // Max overlap is 10cm for optimal material usage
  const MAX_OVERLAP = 0.10;
  
  if (coverWidth <= 0) {
    return { count: 0, coveredWidth: 0, wasteArea: 0, totalCoveredWidth: 0, materialWidthUsed: 0, actualOverlap: 0 };
  }

  if (coverWidth <= rollWidth) {
    // Single strip - edge waste only (excess beyond needed width)
    const edgeWaste = rollWidth - coverWidth;
    return {
      count: 1,
      coveredWidth: coverWidth,
      wasteArea: edgeWaste,
      totalCoveredWidth: rollWidth,
      materialWidthUsed: rollWidth,
      actualOverlap: 0,
    };
  }

  // Calculate minimum strips needed with minimum overlap
  const effectiveWidthWithMinOverlap = rollWidth - minOverlap;
  const remainingAfterFirst = coverWidth - rollWidth;
  const additionalStrips = Math.ceil(remainingAfterFirst / effectiveWidthWithMinOverlap);
  const totalStrips = 1 + additionalStrips;

  // Total material width used (what we pay for) - includes all overlaps
  const materialWidthUsed = totalStrips * rollWidth;
  
  // Calculate actual overlap that would give exact coverage (if possible)
  // Formula: totalStrips * rollWidth - (totalStrips - 1) * actualOverlap = coverWidth
  // Solving: actualOverlap = (totalStrips * rollWidth - coverWidth) / (totalStrips - 1)
  const actualOverlapForExactFit = (materialWidthUsed - coverWidth) / (totalStrips - 1);
  
  let edgeWaste: number;
  let actualOverlap: number;
  
  if (actualOverlapForExactFit >= minOverlap && actualOverlapForExactFit <= MAX_OVERLAP) {
    // We can adjust overlap to get exact coverage - no edge waste!
    edgeWaste = 0;
    actualOverlap = actualOverlapForExactFit;
  } else if (actualOverlapForExactFit > MAX_OVERLAP) {
    // Even with max overlap, we have excess material on edges (this IS waste)
    const coveredWithMaxOverlap = materialWidthUsed - (totalStrips - 1) * MAX_OVERLAP;
    edgeWaste = coveredWithMaxOverlap - coverWidth;
    actualOverlap = MAX_OVERLAP;
  } else {
    // actualOverlapForExactFit < minOverlap - use minimum and accept edge waste
    const coveredWithMinOverlap = materialWidthUsed - (totalStrips - 1) * minOverlap;
    edgeWaste = coveredWithMinOverlap - coverWidth;
    actualOverlap = minOverlap;
  }

  const totalCoveredWidth = materialWidthUsed - (totalStrips - 1) * actualOverlap;

  return { 
    count: totalStrips, 
    coveredWidth: coverWidth,
    wasteArea: Math.max(0, edgeWaste), // Only edge excess is waste, NOT overlaps
    totalCoveredWidth,
    materialWidthUsed,
    actualOverlap,
  };
}

type MixedStripEval = {
  isValid: boolean;
  stripCount: number;
  materialWidthUsed: number;
  actualOverlap: number;
  totalCoveredWidth: number;
  edgeWasteWidth: number;
};

function evaluateMixedStrips(
  coverWidth: number,
  stripWidths: RollWidth[],
  minOverlap: number
): MixedStripEval {
  const MAX_OVERLAP = 0.10;

  if (coverWidth <= 0) {
    return {
      isValid: true,
      stripCount: 0,
      materialWidthUsed: 0,
      actualOverlap: 0,
      totalCoveredWidth: 0,
      edgeWasteWidth: 0,
    };
  }

  if (stripWidths.length === 0) {
    return {
      isValid: false,
      stripCount: 0,
      materialWidthUsed: 0,
      actualOverlap: 0,
      totalCoveredWidth: 0,
      edgeWasteWidth: 0,
    };
  }

  const n = stripWidths.length;
  const materialWidthUsed = stripWidths.reduce((sum, w) => sum + w, 0);

  if (n === 1) {
    const totalCoveredWidth = materialWidthUsed;
    const edgeWasteWidth = Math.max(0, totalCoveredWidth - coverWidth);
    return {
      isValid: totalCoveredWidth >= coverWidth,
      stripCount: 1,
      materialWidthUsed,
      actualOverlap: 0,
      totalCoveredWidth,
      edgeWasteWidth,
    };
  }

  const overlapForExactFit = (materialWidthUsed - coverWidth) / (n - 1);
  const actualOverlap = Math.max(minOverlap, Math.min(MAX_OVERLAP, overlapForExactFit));
  const totalCoveredWidth = materialWidthUsed - (n - 1) * actualOverlap;
  const isValid = totalCoveredWidth >= coverWidth - 1e-6;
  const edgeWasteWidth = Math.max(0, totalCoveredWidth - coverWidth);

  return {
    isValid,
    stripCount: n,
    materialWidthUsed,
    actualOverlap,
    totalCoveredWidth,
    edgeWasteWidth,
  };
}

function buildWidthsFromMix(mix: Array<{ rollWidth: RollWidth; count: number }>): RollWidth[] {
  const widths: RollWidth[] = [];
  for (const group of mix) {
    for (let i = 0; i < group.count; i++) widths.push(group.rollWidth);
  }
  return widths;
}

/**
 * Result from foil pricing calculation - separated by foil pool
 */
export interface FoilPricingResult {
  /** Main foil (bottom, walls, dividing wall) area for pricing in m² */
  mainFoilArea: number;
  /** Main foil weld/overlap area in m² */
  mainWeldArea: number;
  /** Structural foil (stairs, paddling pool bottom) area for pricing in m² */
  structuralFoilArea: number;
  /** Structural foil weld/overlap area in m² */
  structuralWeldArea: number;
  /** Total area for pricing (main + structural) */
  totalArea: number;
}

/**
 * Result from area calculation for surfaces
 */
interface SurfaceAreaResult {
  /** Total area (rounded up to 1 m²) */
  area: number;
  /** Weld/overlap area in m² */
  weldArea: number;
}

/**
 * Helper: Calculate foil area for a subset of surfaces
 */
function calculateAreaForSurfaces(
  surfaceKeys: SurfaceKey[],
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null
): SurfaceAreaResult {
  const defs = getSurfaceDefinitions(dimensions, foilSubtype);
  const surfacesByKey = new Map<SurfaceKey, SurfaceRollConfig[]>();
  for (const s of config.surfaces) {
    const arr = surfacesByKey.get(s.surface) ?? [];
    arr.push(s);
    surfacesByKey.set(s.surface, arr);
  }

  const relevantDefs = defs.filter((d) => surfaceKeys.includes(d.key));
  const relevantSurfaces = config.surfaces.filter((s) => surfaceKeys.includes(s.surface));

  let totalStripsArea = 0;
  let totalWeldArea = 0;
  let reusableWidthWasteArea = 0;

  for (const def of relevantDefs) {
    const surfaceEntries = surfacesByKey.get(def.key);
    if (!surfaceEntries || surfaceEntries.length === 0) continue;

    // SPECIAL CASE: Stairs use different cutting logic
    if (def.key === 'stairs' && dimensions.stairs?.enabled) {
      const stairs = dimensions.stairs;
      const stairsWidth = typeof stairs.width === 'number' ? stairs.width : Math.min(dimensions.length, dimensions.width);
      const stepDepth = stairs.stepDepth || 0.30;
      const stepCount = stairs.stepCount || 4;
      const stairsFootprintLength = stepDepth * stepCount;
      
      // Calculate based on cutting logic
      if (stairsWidth > ROLL_WIDTH_NARROW) {
        // Cut from roll width transversely: 1.65m × stairsWidth
        totalStripsArea += ROLL_WIDTH_NARROW * stairsWidth;
      } else {
        // Standard cut along roll: footprintLength × rollWidth
        totalStripsArea += stairsFootprintLength * ROLL_WIDTH_NARROW;
      }
      // NO weld area for stairs (overlap = 0)
      // NO reusable waste for stairs (waste is small piece)
      continue;
    }

    // NOTE: We treat multiple entries for the same surface as additive (rare, but safe).
    for (const surface of surfaceEntries) {
      if (!surface.stripMix) {
        const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
        const stripsPerSingle = calc.count;
        const totalStrips = stripsPerSingle * def.count;

        // Full strip area consumed (includes overlaps - this is NOT waste!)
        totalStripsArea += totalStrips * def.stripLength * surface.rollWidth;

        // Calculate weld/overlap area
        const overlapsPerSingle = Math.max(0, stripsPerSingle - 1);
        const totalOverlaps = overlapsPerSingle * def.count;
        totalWeldArea += totalOverlaps * calc.actualOverlap * def.stripLength;

        // Edge waste only
        const edgeWasteWidth = calc.wasteArea;
        const edgeWasteArea = edgeWasteWidth * def.stripLength * def.count;
        const isReusable = edgeWasteWidth >= WASTE_THRESHOLD && def.stripLength >= MIN_REUSABLE_OFFCUT_LENGTH;
        if (isReusable) reusableWidthWasteArea += edgeWasteArea;
      } else {
        const widths = buildWidthsFromMix(surface.stripMix);
        const evalRes = evaluateMixedStrips(def.coverWidth, widths, def.overlap);
        if (!evalRes.isValid) continue;

        totalStripsArea += evalRes.materialWidthUsed * def.stripLength * def.count;
        const overlapsPerSingle = Math.max(0, evalRes.stripCount - 1);
        const totalOverlaps = overlapsPerSingle * def.count;
        totalWeldArea += totalOverlaps * evalRes.actualOverlap * def.stripLength;

        const edgeWasteWidth = evalRes.edgeWasteWidth;
        const edgeWasteArea = edgeWasteWidth * def.stripLength * def.count;
        const isReusable = edgeWasteWidth >= WASTE_THRESHOLD && def.stripLength >= MIN_REUSABLE_OFFCUT_LENGTH;
        if (isReusable) reusableWidthWasteArea += edgeWasteArea;
      }
    }
  }

  // Roll-end waste (length leftover) - pack only relevant surfaces
  const subConfig: MixConfiguration = {
    ...config,
    surfaces: relevantSurfaces,
  };
  const rolls = packStripsIntoRolls(subConfig, dimensions);
  const unusableRollEndWasteArea = rolls.reduce((sum, r) => {
    if (r.wasteLength > 0 && r.wasteLength < MIN_REUSABLE_OFFCUT_LENGTH) {
      return sum + r.wasteLength * r.rollWidth;
    }
    return sum;
  }, 0);

  const rawArea = totalStripsArea - reusableWidthWasteArea + unusableRollEndWasteArea;
  
  return {
    // Round UP to nearest 1 m² (whole number)
    area: Math.ceil(rawArea),
    weldArea: Math.round(totalWeldArea * 10) / 10, // Round weld area to 0.1
  };
}

/**
 * Ilość folii do wyceny (m²) - osobno dla głównej i strukturalnej:
 * - liczymy pełną powierzchnię pasów (z zakładami = pełna szerokość rolki na pas)
 * - odejmujemy odpad, który *może* być użyty ponownie (>= 30cm szer. oraz >= 2m dł.)
 * - dodajemy odpad z końcówek rolek, którego nie da się użyć (dł. < 2m)
 * - zaokrąglamy w GÓRĘ do 1 m² (pełne metry)
 * 
 * IMPORTANT: This function now uses calculateSurfaceDetails internally to ensure
 * consistency between pricing display and the detailed breakdown table.
 */
export function calculateFoilAreaForPricing(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): FoilPricingResult {
  // Use calculateSurfaceDetails to get consistent values with the table
  const surfaceDetails = calculateSurfaceDetails(config, dimensions, foilSubtype, priority);
  
  // Main surfaces: bottom, walls, dividing-wall
  const mainSurfaceKeys: SurfaceKey[] = ['bottom', 'walls', 'dividing-wall'];
  // Structural surfaces: stairs, paddling
  const structuralSurfaceKeys: SurfaceKey[] = ['stairs', 'paddling'];
  
  const mainSurfaces = surfaceDetails.filter(s => mainSurfaceKeys.includes(s.surfaceKey));
  const structuralSurfaces = surfaceDetails.filter(s => structuralSurfaceKeys.includes(s.surfaceKey));
  
  const mainFoilArea = mainSurfaces.reduce((sum, s) => sum + s.totalFoilArea, 0);
  const mainWeldArea = mainSurfaces.reduce((sum, s) => sum + s.weldArea, 0);
  const structuralFoilArea = structuralSurfaces.reduce((sum, s) => sum + s.totalFoilArea, 0);
  const structuralWeldArea = structuralSurfaces.reduce((sum, s) => sum + s.weldArea, 0);
  
  return {
    mainFoilArea,
    mainWeldArea,
    structuralFoilArea,
    structuralWeldArea,
    totalArea: mainFoilArea + structuralFoilArea,
  };
}

/**
 * Compare waste for both roll widths
 */
function compareRollWidths(
  coverWidth: number,
  stripLength: number,
  overlap: number
): { narrow: { strips: number; waste: number }; wide: { strips: number; waste: number }; optimal: RollWidth } {
  const narrowCalc = calculateStripsForWidth(coverWidth, ROLL_WIDTH_NARROW, overlap);
  const wideCalc = calculateStripsForWidth(coverWidth, ROLL_WIDTH_WIDE, overlap);

  const narrowWaste = narrowCalc.wasteArea * stripLength;
  const wideWaste = wideCalc.wasteArea * stripLength;

  // Prefer less waste; if equal, prefer fewer strips
  let optimal: RollWidth;
  if (narrowWaste < wideWaste) {
    optimal = ROLL_WIDTH_NARROW;
  } else if (wideWaste < narrowWaste) {
    optimal = ROLL_WIDTH_WIDE;
  } else {
    optimal = narrowCalc.count <= wideCalc.count ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE;
  }

  return {
    narrow: { strips: narrowCalc.count, waste: narrowWaste },
    wide: { strips: wideCalc.count, waste: wideWaste },
    optimal,
  };
}

/**
 * Get surface definitions from pool dimensions
 */
function getSurfaceDefinitions(dimensions: PoolDimensions, foilSubtype?: FoilSubtype | null): SurfaceDefinition[] {
  const surfaces: SurfaceDefinition[] = [];
  const { length, width, depth } = dimensions;

  // Longer and shorter sides
  const longerSide = Math.max(length, width);
  const shorterSide = Math.min(length, width);

  // Determine if structural foil (butt joint on bottom)
  const isButtJointBottom = usesButtJoint(foilSubtype);
  const bottomOverlap = isButtJointBottom ? BUTT_JOINT_OVERLAP : MIN_OVERLAP_BOTTOM;

  // Bottom - strips along longer side, cover shorter side (MAIN foil)
  surfaces.push({
    key: 'bottom',
    label: 'Dno',
    stripLength: longerSide,
    coverWidth: shorterSide,
    count: 1,
    overlap: bottomOverlap,
    isButtJoint: isButtJointBottom,
    foilAssignment: 'main',
  });

  // Long walls (2×) - strips along longer side, cover depth (MAIN foil)
  surfaces.push({
    key: 'wall-long',
    label: 'Ściany długie (2×)',
    stripLength: longerSide,
    coverWidth: depth + FOLD_AT_BOTTOM,
    count: 2,
    overlap: MIN_OVERLAP_WALL,
    foilAssignment: 'main',
  });

  // Short walls (2×) - strips along shorter side, cover depth (MAIN foil)
  surfaces.push({
    key: 'wall-short',
    label: 'Ściany krótkie (2×)',
    stripLength: shorterSide,
    coverWidth: depth + FOLD_AT_BOTTOM,
    count: 2,
    overlap: MIN_OVERLAP_WALL,
    foilAssignment: 'main',
  });

  // Stairs (STRUCTURAL foil - always anti-slip)
  // Only count horizontal footprint (stepDepth × stepCount) - risers are NOT covered with anti-slip foil
  // 
  // CUTTING LOGIC:
  // - If stair width <= 1.65m: cut one strip of length = footprint, width = stair width
  // - If stair width > 1.65m: cut from ROLL WIDTH transversely:
  //   - Cut a strip of LENGTH = stair width from the 1.65m wide roll
  //   - Then cut that strip into stepDepth pieces (one per step)
  //   - Waste = (1.65m - stepCount * stepDepth) × stair width
  //   - NO OVERLAP between step pieces (they're separate treads)
  if (dimensions.stairs?.enabled) {
    const stairs = dimensions.stairs;
    const stepWidth = typeof stairs.width === 'number' ? stairs.width : shorterSide;
    const stepDepth = stairs.stepDepth || 0.30;
    const stepCount = stairs.stepCount || 4;
    
    // Total footprint = stepDepth × stepCount (only treads, no risers)
    const stairsFootprintLength = stepDepth * stepCount;
    
    // For stairs, NO overlap between strips (each step is separate piece)
    // If width > roll width, we cut transversely from roll
    surfaces.push({
      key: 'stairs',
      label: 'Schody',
      stripLength: stepWidth > ROLL_WIDTH_NARROW ? stepWidth : stairsFootprintLength,
      coverWidth: stepWidth > ROLL_WIDTH_NARROW ? stairsFootprintLength : stepWidth,
      count: 1,
      overlap: 0, // NO overlap for stairs - separate pieces per step
      foilAssignment: 'structural', // Always structural foil
    });
  }

  // Paddling pool bottom (STRUCTURAL foil) - strips laid parallel to longer edge, butt joint
  if (dimensions.wadingPool?.enabled) {
    const pool = dimensions.wadingPool;
    
    // Strips are laid parallel to the longer edge of the wading pool floor
    // coverWidth = shorter edge (the width that strips need to cover)
    // stripLength = longer edge (each strip runs full length of this edge)
    // Butt joint = no overlap between strips (structural foil requirement)
    const longerEdge = Math.max(pool.length, pool.width);
    const shorterEdge = Math.min(pool.length, pool.width);
    
    surfaces.push({
      key: 'paddling',
      label: 'Brodzik (dno)',
      stripLength: longerEdge,
      coverWidth: shorterEdge,
      count: 1,
      overlap: BUTT_JOINT_OVERLAP, // Butt joint - no overlap for structural foil
      isButtJoint: true,
      foilAssignment: 'structural', // Bottom always structural
    });
    
    // Dividing wall (if enabled) uses MAIN foil
    if (pool.hasDividingWall && pool.dividingWallOffset && pool.dividingWallOffset > 0) {
      const wallOffsetM = pool.dividingWallOffset / 100; // Convert cm to m
      const wallHeight = depth - pool.depth + wallOffsetM;
      
      surfaces.push({
        key: 'dividing-wall',
        label: 'Murek brodzika',
        stripLength: pool.width,
        coverWidth: wallHeight,
        count: 1,
        overlap: MIN_OVERLAP_WALL,
        foilAssignment: 'main', // Dividing wall uses main foil
      });
    }
  }

  return surfaces;
}

/**
 * Get wall segments with labels for a given pool shape
 */
export function getWallSegments(dimensions: PoolDimensions): WallSegment[] {
  if (dimensions.shape === 'nieregularny' && dimensions.customVertices && dimensions.customVertices.length > 2) {
    const vertices = dimensions.customVertices;
    return vertices.map((vertex, i) => {
      const nextVertex = vertices[(i + 1) % vertices.length];
      const dx = nextVertex.x - vertex.x;
      const dy = nextVertex.y - vertex.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      return {
        label: `${String.fromCharCode(65 + i)}-${String.fromCharCode(65 + ((i + 1) % vertices.length))}`,
        length: length,
      };
    });
  }
  
  // Rectangular pool: 4 walls (A-B, B-C, C-D, D-A)
  const longerSide = Math.max(dimensions.length, dimensions.width);
  const shorterSide = Math.min(dimensions.length, dimensions.width);
  
  return [
    { label: 'A-B', length: longerSide },
    { label: 'B-C', length: shorterSide },
    { label: 'C-D', length: longerSide },
    { label: 'D-A', length: shorterSide },
  ];
}

/**
 * Assign wall labels to strips based on strip lengths
 */
export function assignWallLabelsToStrips(
  dimensions: PoolDimensions,
  stripLength: number,
  stripCount: number
): WallStripInfo[] {
  const walls = getWallSegments(dimensions);
  const perimeter = walls.reduce((sum, w) => sum + w.length, 0);
  const depth = dimensions.depth;
  
  // Determine optimal roll width for wall strips (use new threshold)
  const rollWidth = depth <= DEPTH_THRESHOLD_FOR_WIDE ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE;
  
  const strips: WallStripInfo[] = [];
  let remainingLength = perimeter;
  let currentWallIndex = 0;
  let offsetInCurrentWall = 0;
  
  for (let i = 0; i < stripCount; i++) {
    const thisStripLength = stripLength;
    const coveredLabels: string[] = [];
    let lengthToCover = thisStripLength;
    
    while (lengthToCover > 0 && currentWallIndex < walls.length) {
      const wall = walls[currentWallIndex];
      const remainingInWall = wall.length - offsetInCurrentWall;
      
      if (coveredLabels.length === 0 || coveredLabels[coveredLabels.length - 1] !== wall.label) {
        coveredLabels.push(wall.label);
      }
      
      if (lengthToCover >= remainingInWall) {
        lengthToCover -= remainingInWall;
        currentWallIndex++;
        offsetInCurrentWall = 0;
      } else {
        offsetInCurrentWall += lengthToCover;
        lengthToCover = 0;
      }
    }
    
    // Create combined label like "A-B-C" from ["A-B", "B-C"]
    const combinedLabel = coveredLabels.length > 0 
      ? coveredLabels.map(l => l.split('-')[0]).join('-') + '-' + coveredLabels[coveredLabels.length - 1].split('-')[1]
      : 'A-B';
    
    strips.push({
      rollWidth,
      stripLength: thisStripLength,
      wallLabels: [combinedLabel],
    });
    
    remainingLength -= thisStripLength;
  }
  
  return strips;
}

/**
 * Calculate detailed surface information for UI display
 */
export function calculateSurfaceDetails(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): SurfaceDetailedResult[] {
  const results: SurfaceDetailedResult[] = [];
  const defs = getSurfaceDefinitions(dimensions, foilSubtype);
  const rolls = packStripsIntoRolls(config, dimensions, foilSubtype, priority);

  const rollBySurfaceStrip = new Map<string, number>();
  for (const r of rolls) {
    for (const s of r.strips) {
      rollBySurfaceStrip.set(`${s.surface}__${s.stripIndex}`, r.rollNumber);
    }
  }
  
  // Group surfaces by type for display
  const bottomSurfaces = config.surfaces.filter(s => s.surface === 'bottom');
  const wallSurfaces = config.surfaces.filter(s => s.surface === 'wall-long' || s.surface === 'wall-short');
  const stairsSurfaces = config.surfaces.filter(s => s.surface === 'stairs');
  const paddlingSurfaces = config.surfaces.filter(s => s.surface === 'paddling');
  const dividingWallSurfaces = config.surfaces.filter(s => s.surface === 'dividing-wall');
  
  // Helper to get roll numbers for a surface
  const getRollNumbersForSurface = (surfaceLabel: string): number[] => {
    return rolls
      .filter(r => r.strips.some(s => s.surface === surfaceLabel))
      .map(r => r.rollNumber);
  };

  // Bottom
  if (bottomSurfaces.length > 0) {
    const surface = bottomSurfaces[0];
    const def = defs.find(d => d.key === 'bottom');
    if (def) {
      const bottomLabel = surface.surfaceLabel;

      const coverArea = def.stripLength * def.coverWidth;

      let totalFoilAreaRaw: number;
      let weldArea: number;
      let wasteArea: number;
      let strips: SurfaceDetailedResult['strips'];

      // Calculate roll-end waste for bottom strips (unusable leftovers < 2m)
      // Only count waste from rolls that ONLY contain bottom strips
      let bottomRollEndWaste = 0;
      for (const r of rolls) {
        const bottomStripsInRoll = r.strips.filter((s) => s.surface === bottomLabel);
        const otherStripsInRoll = r.strips.filter((s) => s.surface !== bottomLabel);
        
        // If this roll contains ONLY bottom strips and has unusable leftover
        if (bottomStripsInRoll.length > 0 && otherStripsInRoll.length === 0) {
          if (r.wasteLength > 0 && r.wasteLength < MIN_REUSABLE_OFFCUT_LENGTH) {
            bottomRollEndWaste += r.wasteLength * r.rollWidth;
          }
        }
      }

      // Structural foil uses butt joint (no overlap), so weldArea = 0 for bottom
      const isButtJointBottom = usesButtJoint(foilSubtype);
      
      if (surface.stripMix && surface.stripMix.length > 0) {
        const widths = buildWidthsFromMix(surface.stripMix);
        const evalRes = evaluateMixedStrips(def.coverWidth, widths, def.overlap);
        totalFoilAreaRaw = evalRes.materialWidthUsed * def.stripLength;
        // For butt joint, no overlap area on bottom
        weldArea = isButtJointBottom ? 0 : Math.max(0, evalRes.stripCount - 1) * evalRes.actualOverlap * def.stripLength;
        wasteArea = Math.max(0, totalFoilAreaRaw - coverArea - weldArea);

        // Display per roll number (so we don't incorrectly show 2×10m as coming from one roll)
        const perRoll: Array<{ rollNumber: number; rollWidth: RollWidth; count: number }> = [];
        for (const r of rolls) {
          const bottomStripsInRoll = r.strips.filter((s) => s.surface === bottomLabel);
          if (bottomStripsInRoll.length === 0) continue;
          perRoll.push({
            rollNumber: r.rollNumber,
            rollWidth: r.rollWidth,
            count: bottomStripsInRoll.length,
          });
        }

        perRoll.sort((a, b) => {
          if (a.rollWidth !== b.rollWidth) return b.rollWidth - a.rollWidth;
          return a.rollNumber - b.rollNumber;
        });

        strips = perRoll.map((p) => ({
          count: p.count,
          rollWidth: p.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: p.rollNumber,
        }));
      } else {
        const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
        totalFoilAreaRaw = surface.stripCount * surface.rollWidth * surface.stripLength;
        const overlapsCount = Math.max(0, calc.count - 1);
        // For butt joint, no overlap area on bottom
        weldArea = isButtJointBottom ? 0 : overlapsCount * calc.actualOverlap * def.stripLength;
        wasteArea = Math.max(0, totalFoilAreaRaw - coverArea - weldArea);
        
        // Group by roll number even for single-width configuration
        const perRoll: Array<{ rollNumber: number; rollWidth: RollWidth; count: number }> = [];
        for (const r of rolls) {
          const bottomStripsInRoll = r.strips.filter((s) => s.surface === bottomLabel);
          if (bottomStripsInRoll.length === 0) continue;
          perRoll.push({
            rollNumber: r.rollNumber,
            rollWidth: r.rollWidth,
            count: bottomStripsInRoll.length,
          });
        }
        
        perRoll.sort((a, b) => {
          if (a.rollWidth !== b.rollWidth) return b.rollWidth - a.rollWidth;
          return a.rollNumber - b.rollNumber;
        });
        
        strips = perRoll.length > 0 
          ? perRoll.map((p) => ({
              count: p.count,
              rollWidth: p.rollWidth,
              stripLength: surface.stripLength,
              rollNumber: p.rollNumber,
            }))
          : [{
              count: surface.stripCount,
              rollWidth: surface.rollWidth,
              stripLength: surface.stripLength,
              rollNumber: getRollNumbersForSurface(bottomLabel)[0],
            }];
      }

      // Add roll-end waste to total foil area (we need to order it)
      // and to waste area (it's not usable)
      const totalFoilAreaWithWaste = totalFoilAreaRaw + bottomRollEndWaste;
      const totalWasteArea = wasteArea + bottomRollEndWaste;

      // Use the already-calculated isButtJointBottom for the result

      results.push({
        surfaceKey: 'bottom',
        surfaceLabel: 'Dno',
        strips,
        coverArea: Math.round(coverArea * 10) / 10,
        totalFoilArea: Math.ceil(totalFoilAreaWithWaste),
        weldArea: Math.round(weldArea * 10) / 10,
        wasteArea: Math.round(totalWasteArea * 10) / 10,
        isButtJoint: isButtJointBottom,
      });
    }
  }

  // Walls - use flexible strip optimizer for both priorities
  // The optimizer dynamically chooses the optimal number of strips (1, 2, 3, 4+)
  if (wallSurfaces.length > 0) {
    const walls = getWallSegments(dimensions);
    const perimeter = walls.reduce((sum, w) => sum + w.length, 0);
    const depth = dimensions.depth;
    
    const fallbackWidth = getPreferredWallRollWidth(dimensions, foilSubtype);
    
    // Helper for horizontal overlap
    const getHorizontalOverlapForWidth = (w: RollWidth): { overlap: number; edgeWastePerSide: number } => {
      const foilOverhang = w - depth;
      const overlapPerSide = foilOverhang / 2;

      if (overlapPerSide >= MIN_HORIZONTAL_OVERLAP && overlapPerSide <= MAX_HORIZONTAL_OVERLAP) {
        return { overlap: overlapPerSide, edgeWastePerSide: 0 };
      }
      if (overlapPerSide > MAX_HORIZONTAL_OVERLAP) {
        return { overlap: MAX_HORIZONTAL_OVERLAP, edgeWastePerSide: overlapPerSide - MAX_HORIZONTAL_OVERLAP };
      }
      return { overlap: MIN_HORIZONTAL_OVERLAP, edgeWastePerSide: 0 };
    };
    
    // Get optimal wall strip plan from the flexible optimizer
    const wallPlan = getOptimalWallStripPlan(dimensions, config, foilSubtype, priority);
    
    let strips: SurfaceDetailedResult['strips'];
    
    if (wallPlan && wallPlan.strips.length > 0) {
      // Use the optimized plan
      strips = wallPlan.strips.map((strip, i) => ({
        count: 1,
        rollWidth: strip.rollWidth,
        stripLength: strip.totalLength,
        wallLabels: strip.wallLabels,
        rollNumber: rollBySurfaceStrip.get(`Ściany__${i + 1}`) ?? i + 1,
      }));
    } else {
      // Fallback: legacy 2-strip continuous mode
      const { stripCount, overlapPerJoin, stripLengths } = computeWallStripPlanFromPerimeter(
        perimeter, 
        config, 
        fallbackWidth
      );
      
      const wallStrips = assignWallLabelsToStrips(dimensions, stripLengths[0] ?? perimeter / stripCount, stripCount);
      
      strips = [];
      for (let i = 0; i < stripCount; i++) {
        const stripLen = stripLengths[i] ?? perimeter / stripCount + overlapPerJoin;
        strips.push({
          count: 1,
          rollWidth: fallbackWidth,
          stripLength: Math.round(stripLen * 10) / 10,
          wallLabels: wallStrips[i]?.wallLabels ?? [],
          rollNumber: rollBySurfaceStrip.get(`Ściany__${i + 1}`) ?? i + 1,
        });
      }
    }
    
    // Calculate areas based on the chosen strip configuration
    const totalUsedFoilArea = strips.reduce((sum, s) => sum + s.stripLength * s.rollWidth, 0);
    const coverArea = perimeter * depth;
    
    const verticalWeldArea = strips.length * DEFAULT_VERTICAL_JOIN_OVERLAP * depth;
    const horizontalWeldArea = strips.reduce((sum, s) => {
      const { overlap } = getHorizontalOverlapForWidth(s.rollWidth);
      return sum + (overlap * 2) * s.stripLength;
    }, 0);
    const totalWeldArea = verticalWeldArea + horizontalWeldArea;
    
    const edgeWasteArea = strips.reduce((sum, s) => {
      const { edgeWastePerSide } = getHorizontalOverlapForWidth(s.rollWidth);
      return sum + (edgeWastePerSide * 2) * s.stripLength;
    }, 0);
    
    let totalRollEndWaste = 0;
    for (const s of strips) {
      const rollWaste = ROLL_LENGTH - s.stripLength;
      const isReusable = rollWaste >= MIN_REUSABLE_OFFCUT_LENGTH;
      if (!isReusable && rollWaste > 0) {
        totalRollEndWaste += rollWaste * s.rollWidth;
      }
    }
    
    const totalWasteArea = edgeWasteArea + totalRollEndWaste;
    
    results.push({
      surfaceKey: 'walls',
      surfaceLabel: 'Ściany',
      strips,
      coverArea: Math.round(coverArea * 10) / 10,
      totalFoilArea: Math.ceil(totalUsedFoilArea + totalRollEndWaste),
      weldArea: Math.round(totalWeldArea * 10) / 10,
      wasteArea: Math.round(totalWasteArea * 10) / 10,
    });
  }

  // Stairs
  if (stairsSurfaces.length > 0) {
    const surface = stairsSurfaces[0];
    const def = defs.find(d => d.key === 'stairs');
    if (def && dimensions.stairs) {
      const stairs = dimensions.stairs;
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      // Stair parameters
      const stairsWidth = typeof stairs.width === 'number' ? stairs.width : Math.min(dimensions.length, dimensions.width);
      const stepDepth = stairs.stepDepth || 0.30;
      const stepCount = stairs.stepCount || 4;
      const stairsFootprintLength = stepDepth * stepCount;
      
      // NEW CUTTING LOGIC:
      // If stair width > roll width (1.65m), cut transversely from roll:
      // - Strip length = stair width (2.0m in example)
      // - Strip pieces = stepCount pieces of stepDepth each
      // - Waste = (1.65m - footprintLength) × stairWidth
      
      // Calculate areas
      let totalFoilAreaRaw: number;
      let wasteArea: number;
      let displayStripLength: number;
      let displayRollWidth: RollWidth;
      
      if (stairsWidth > ROLL_WIDTH_NARROW) {
        // Cut from roll width transversely
        // We cut one strip of length = stairsWidth from 1.65m roll
        // Then cut into stepDepth pieces
        displayStripLength = stairsWidth;
        displayRollWidth = ROLL_WIDTH_NARROW;
        
        // Material used = 1.65m × stairsWidth (one full strip from roll width)
        totalFoilAreaRaw = ROLL_WIDTH_NARROW * stairsWidth;
        
        // Waste = unused portion of roll width after cutting all steps
        // (1.65 - stepCount * stepDepth) × stairsWidth
        const unusedRollWidth = ROLL_WIDTH_NARROW - stairsFootprintLength;
        wasteArea = Math.max(0, unusedRollWidth * stairsWidth);
      } else {
        // Standard: stair width fits within roll, cut along roll length
        displayStripLength = stairsFootprintLength;
        displayRollWidth = ROLL_WIDTH_NARROW;
        
        // Material = footprint length × roll width
        totalFoilAreaRaw = stairsFootprintLength * ROLL_WIDTH_NARROW;
        
        // Waste = (roll width - stair width) × footprint length
        const unusedWidth = ROLL_WIDTH_NARROW - stairsWidth;
        wasteArea = Math.max(0, unusedWidth * stairsFootprintLength);
      }
      
      // Net cover area (actual surface covered)
      const coverArea = stairsWidth * stairsFootprintLength;
      
      // NO weld/overlap for stairs - each step is separate piece
      const weldArea = 0;
      
      // Build detailed label with stair parameters
      const stairsLabel = `Schody (${stairsWidth.toFixed(2)}m × ${stairsFootprintLength.toFixed(2)}m, ${stepCount} stopni × ${(stepDepth * 100).toFixed(0)}cm)`;
      
      results.push({
        surfaceKey: 'stairs',
        surfaceLabel: stairsLabel,
        strips: [{
          count: 1,
          rollWidth: displayRollWidth,
          stripLength: displayStripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(coverArea * 10) / 10,
        totalFoilArea: Math.ceil(totalFoilAreaRaw),
        weldArea: weldArea,
        wasteArea: Math.round(wasteArea * 10) / 10,
      });
    }
  }

  // Paddling pool bottom - structural foil with butt joint (no overlap)
  if (paddlingSurfaces.length > 0) {
    const surface = paddlingSurfaces[0];
    const def = defs.find(d => d.key === 'paddling');
    if (def) {
      // Recalculate strip count based on actual coverWidth (shorter edge of wading pool)
      const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      // Use the correct strip count from calculation
      const stripCount = calc.count;
      
      // Total foil area = strips × rollWidth × stripLength
      const totalFoilAreaRaw = stripCount * surface.rollWidth * def.stripLength;
      
      // Net cover area (actual wading pool floor area)
      const coverArea = def.coverWidth * def.stripLength;
      
      // Waste = foil area - cover area (edge waste from strips being wider than needed)
      const wasteWidth = (stripCount * surface.rollWidth) - def.coverWidth;
      const wasteArea = wasteWidth * def.stripLength;
      
      // Butt joint: weldArea = 0 (no overlap), but we track butt joint length separately
      // Note: butt joint length = (stripCount - 1) × stripLength
      const buttJointLength = Math.max(0, stripCount - 1) * def.stripLength;
      
      results.push({
        surfaceKey: 'paddling',
        surfaceLabel: 'Brodzik',
        strips: [{
          count: stripCount,
          rollWidth: surface.rollWidth,
          stripLength: def.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(coverArea * 10) / 10,
        totalFoilArea: Math.ceil(totalFoilAreaRaw),
        weldArea: 0, // Butt joint - no overlap area
        wasteArea: Math.round(wasteArea * 10) / 10,
        isButtJoint: true,
      });
    }
  }

  // Dividing wall
  if (dividingWallSurfaces.length > 0) {
    const surface = dividingWallSurfaces[0];
    const def = defs.find(d => d.key === 'dividing-wall');
    if (def) {
      const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      const totalFoilAreaRaw = surface.stripCount * surface.rollWidth * surface.stripLength;
      const overlapsCount = Math.max(0, calc.count - 1);
      const weldArea = overlapsCount * calc.actualOverlap * def.stripLength;
      const coverArea = totalFoilAreaRaw - weldArea;
      
      results.push({
        surfaceKey: 'dividing-wall',
        surfaceLabel: 'Murek brodzika',
        strips: [{
          count: surface.stripCount,
          rollWidth: surface.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(coverArea * 10) / 10,
        totalFoilArea: Math.ceil(totalFoilAreaRaw),
        weldArea: Math.round(weldArea * 10) / 10,
        wasteArea: 0,
      });
    }
  }

  return results;
}

/**
 * Get reusable offcuts from rolls (pieces >= 30cm width and >= 2m length)
 */
export function getReusableOffcuts(config: MixConfiguration): ReusableOffcut[] {
  // We need dimensions-aware packing for correct wall perimeter reuse/offcuts.
  // Callers that don't have dimensions can still call packStripsIntoRolls without it,
  // but UI should always pass dimensions.
  const rolls = packStripsIntoRolls(config);
  const offcuts: ReusableOffcut[] = [];
  
  for (const roll of rolls) {
    // Only roll-end waste that's >= MIN_REUSABLE_OFFCUT_LENGTH is reusable
    if (roll.wasteLength >= MIN_REUSABLE_OFFCUT_LENGTH) {
      offcuts.push({
        rollNumber: roll.rollNumber,
        rollWidth: roll.rollWidth,
        length: Math.round(roll.wasteLength * 10) / 10,
        area: Math.round(roll.wasteLength * roll.rollWidth * 100) / 100,
      });
    }
  }
  
  return offcuts;
}

/** Dimensions-aware reusable offcuts (preferred). */
export function getReusableOffcutsWithDimensions(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): ReusableOffcut[] {
  const rolls = packStripsIntoRolls(config, dimensions, foilSubtype, priority);
  const offcuts: ReusableOffcut[] = [];

  for (const roll of rolls) {
    if (roll.wasteLength >= MIN_REUSABLE_OFFCUT_LENGTH) {
      offcuts.push({
        rollNumber: roll.rollNumber,
        rollWidth: roll.rollWidth,
        length: Math.round(roll.wasteLength * 10) / 10,
        area: Math.round(roll.wasteLength * roll.rollWidth * 100) / 100,
      });
    }
  }

  return offcuts;
}

/** Unusable waste pieces (length < 2m OR width < 0.5m) */
export interface UnusableWaste {
  rollNumber: number;
  rollWidth: RollWidth;
  length: number;  // waste length (m)
  width: number;   // waste width (m) - for edge trims may be less than rollWidth
  area: number;    // waste area (m²)
  source: string;  // surface that generated this waste
}

/** Structural foil waste with potential for cross-utilization */
export interface StructuralWastePiece {
  source: 'stairs' | 'paddling';
  length: number;  // m
  width: number;   // m
  area: number;    // m²
}

/**
 * Check if a waste piece is unusable (cannot be reused)
 * Criteria: length < 2m OR width < 0.5m
 */
function isWasteUnusable(length: number, width: number): boolean {
  return length < MIN_REUSABLE_OFFCUT_LENGTH || width < WASTE_THRESHOLD;
}

/**
 * Check if waste piece A can cover the needs of surface B
 * For cross-utilization between stairs and paddling pool
 */
function canWasteCoverSurface(
  waste: StructuralWastePiece,
  targetSurface: 'stairs' | 'paddling',
  dimensions: PoolDimensions
): { canCover: boolean; usedArea: number } {
  if (waste.source === targetSurface) {
    return { canCover: false, usedArea: 0 };
  }
  
  // Get target surface requirements
  if (targetSurface === 'stairs' && dimensions.stairs?.enabled) {
    const stairs = dimensions.stairs;
    const stairsWidth = typeof stairs.width === 'number' ? stairs.width : Math.min(dimensions.length, dimensions.width);
    const stepDepth = stairs.stepDepth || 0.30;
    const stepCount = stairs.stepCount || 4;
    const stairsFootprintLength = stepDepth * stepCount;
    
    // Waste must fit stairs (stairsWidth × stairsFootprintLength)
    if (waste.length >= stairsWidth && waste.width >= stairsFootprintLength) {
      return { canCover: true, usedArea: stairsWidth * stairsFootprintLength };
    }
  }
  
  if (targetSurface === 'paddling' && dimensions.wadingPool?.enabled) {
    const pp = dimensions.wadingPool;
    const ppLength = pp.length || 2;
    const ppWidth = pp.width || 2;
    const longerEdge = Math.max(ppLength, ppWidth);
    const shorterEdge = Math.min(ppLength, ppWidth);
    
    // For paddling, waste must cover at least one strip (longerEdge × 1.65m or portion)
    // We check if waste can contribute to reducing ordered strips
    // Waste can partially cover if: length >= longerEdge AND width can contribute to strips
    if (waste.length >= longerEdge && waste.width > 0) {
      // Can cover portion of paddling width
      const usableWidth = Math.min(waste.width, shorterEdge);
      return { canCover: true, usedArea: longerEdge * usableWidth };
    }
  }
  
  return { canCover: false, usedArea: 0 };
}

/** Get unusable waste pieces (offcuts < 2m length OR < 0.5m width) */
export function getUnusableWaste(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): UnusableWaste[] {
  const rolls = packStripsIntoRolls(config, dimensions, foilSubtype, priority);
  const wastes: UnusableWaste[] = [];

  // Get waste from roll packing (bottom, walls)
  for (const roll of rolls) {
    // Waste is unusable if length < 2m OR width (rollWidth) < 0.5m
    if (roll.wasteLength > 0 && isWasteUnusable(roll.wasteLength, roll.rollWidth)) {
      // Determine source based on strips in the roll
      const surfaceNames = [...new Set(roll.strips.map(s => s.surface))];
      const source = surfaceNames.join(' + ');
      
      wastes.push({
        rollNumber: roll.rollNumber,
        rollWidth: roll.rollWidth,
        length: Math.round(roll.wasteLength * 10) / 10,
        width: roll.rollWidth, // For roll-end waste, width = roll width
        area: Math.round(roll.wasteLength * roll.rollWidth * 100) / 100,
        source,
      });
    }
  }

  // Calculate structural wastes (stairs and paddling) with cross-utilization
  const structuralWastes: StructuralWastePiece[] = [];
  
  // Determine structural roll number - all structural surfaces share the same roll
  const maxMainRollNumber = rolls.length > 0 ? Math.max(...rolls.map(r => r.rollNumber)) : 0;
  const structuralRollNumber = maxMainRollNumber + 1;
  
  // Calculate stairs waste
  if (dimensions.stairs?.enabled) {
    const stairs = dimensions.stairs;
    const stairsWidth = typeof stairs.width === 'number' ? stairs.width : Math.min(dimensions.length, dimensions.width);
    const stepDepth = stairs.stepDepth || 0.30;
    const stepCount = stairs.stepCount || 4;
    const stairsFootprintLength = stepDepth * stepCount;
    
    // Waste dimensions: (1.65 - footprintLength) × stairsWidth
    const wasteWidth = ROLL_WIDTH_NARROW - stairsFootprintLength;
    const wasteLength = stairsWidth;
    const wasteArea = wasteWidth * wasteLength;
    
    if (wasteArea > 0.01) {
      structuralWastes.push({
        source: 'stairs',
        length: wasteLength,
        width: wasteWidth,
        area: wasteArea,
      });
    }
  }
  
  // Calculate paddling pool waste
  if (dimensions.wadingPool?.enabled) {
    const pp = dimensions.wadingPool;
    const ppWidth = pp.width || 2;
    const ppLength = pp.length || 2;
    
    const longerEdge = Math.max(ppWidth, ppLength);
    const shorterEdge = Math.min(ppWidth, ppLength);
    
    // Calculate strip count for shorter edge (coverWidth)
    const stripCount = Math.ceil(shorterEdge / ROLL_WIDTH_NARROW);
    
    // Total foil width used = stripCount × 1.65m
    // Waste width = (stripCount × 1.65m) - shorterEdge
    const totalFoilWidth = stripCount * ROLL_WIDTH_NARROW;
    const wasteWidth = totalFoilWidth - shorterEdge;
    
    // Waste piece dimensions
    const wasteLength = longerEdge;
    const wasteArea = wasteWidth * wasteLength;
    
    if (wasteArea > 0.01) {
      structuralWastes.push({
        source: 'paddling',
        length: wasteLength,
        width: wasteWidth,
        area: wasteArea,
      });
    }
  }
  
  // Check cross-utilization between stairs and paddling wastes
  let stairsWasteReduced = false;
  let paddlingWasteReduced = false;
  
  for (const waste of structuralWastes) {
    // Check if this waste can cover the other surface
    if (waste.source === 'stairs' && !paddlingWasteReduced) {
      const crossCheck = canWasteCoverSurface(waste, 'paddling', dimensions);
      if (crossCheck.canCover && crossCheck.usedArea >= waste.area * 0.5) {
        // Stairs waste can be used for paddling - mark as utilized (not waste)
        stairsWasteReduced = true;
        continue; // Don't add to unusable waste
      }
    }
    if (waste.source === 'paddling' && !stairsWasteReduced) {
      const crossCheck = canWasteCoverSurface(waste, 'stairs', dimensions);
      if (crossCheck.canCover && crossCheck.usedArea >= waste.area * 0.5) {
        // Paddling waste can be used for stairs - mark as utilized
        paddlingWasteReduced = true;
        continue; // Don't add to unusable waste
      }
    }
    
    // Check if waste is unusable (< 2m length OR < 0.5m width)
    if (isWasteUnusable(waste.length, waste.width)) {
      wastes.push({
        rollNumber: structuralRollNumber,
        rollWidth: ROLL_WIDTH_NARROW,
        length: Math.round(waste.length * 100) / 100,
        width: Math.round(waste.width * 100) / 100,
        area: Math.round(waste.area * 100) / 100,
        source: waste.source === 'stairs' ? 'Schody' : 'Brodzik',
      });
    }
  }

  return wastes;
}

/**
 * Auto-optimize roll width selection for all surfaces
 */
export function autoOptimizeMixConfig(
  dimensions: PoolDimensions, 
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): MixConfiguration {
  const surfaceDefinitions = getSurfaceDefinitions(dimensions, foilSubtype);
  const surfaces: SurfaceRollConfig[] = [];
  const narrowOnlyMain = isNarrowOnlyFoil(foilSubtype);
  const depth = dimensions.depth;

  // Determine wall width based on depth (installation constraint, not optimization)
  // - depth <= 1.55m: must use 1.65m
  // - 1.55m < depth <= 1.95m: must use 2.05m
  // - depth > 1.95m: must use 1.65m (2 strips stacked)
  const wallRollWidth: RollWidth = narrowOnlyMain
    ? ROLL_WIDTH_NARROW
    : depth <= DEPTH_THRESHOLD_FOR_WIDE
      ? ROLL_WIDTH_NARROW
      : depth <= DEPTH_THRESHOLD_FOR_DOUBLE_NARROW
        ? ROLL_WIDTH_WIDE
        : ROLL_WIDTH_NARROW;

  for (const def of surfaceDefinitions) {
    let optimalWidth: RollWidth;
    let wastePerSurface: number;
    let stripMix: Array<{ rollWidth: RollWidth; count: number }> | undefined;

    // CRITICAL: Structural surfaces (stairs, paddling bottom) ALWAYS use 1.65m only
    const isStructuralSurface = def.foilAssignment === 'structural';
    const forceNarrow = narrowOnlyMain || isStructuralSurface;

    const isWall = def.key === 'wall-long' || def.key === 'wall-short';

    if (isWall) {
      // Walls use depth-based width (not optimization-based)
      optimalWidth = wallRollWidth;
      const calc = calculateStripsForWidth(def.coverWidth, optimalWidth, def.overlap);
      wastePerSurface = calc.wasteArea * def.stripLength;
    } else if (forceNarrow) {
      // Structural surfaces OR nadruk/strukturalna foils can only use 1.65m
      optimalWidth = ROLL_WIDTH_NARROW;
      const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
      wastePerSurface = calc.wasteArea * def.stripLength;
    } else if (def.key === 'bottom') {
      // Bottom: try mixed widths to optimize based on priority
      // For minRolls: prefer mix that allows pairing with wall strips of same width
      // For minWaste: prefer mix with least edge waste
      
      const candidates: Array<{ 
        mix: Array<{ rollWidth: RollWidth; count: number }>; 
        eval: MixedStripEval;
        narrowCount: number;
        wideCount: number;
      }> = [];
      
      const maxWidth = ROLL_WIDTH_WIDE;
      const minWidth = ROLL_WIDTH_NARROW;
      const minStrips = Math.max(1, Math.ceil(def.coverWidth / maxWidth));
      const maxStrips = Math.ceil(def.coverWidth / minWidth) + 2;

      for (let n = minStrips; n <= maxStrips; n++) {
        for (let wideCount = 0; wideCount <= n; wideCount++) {
          const narrowCount = n - wideCount;
          if (wideCount === 0 && narrowCount === 0) continue;
          const mix: Array<{ rollWidth: RollWidth; count: number }> = [
            ...(wideCount > 0 ? [{ rollWidth: ROLL_WIDTH_WIDE as RollWidth, count: wideCount }] : []),
            ...(narrowCount > 0 ? [{ rollWidth: ROLL_WIDTH_NARROW as RollWidth, count: narrowCount }] : []),
          ];
          const widths = buildWidthsFromMix(mix);
          const evalRes = evaluateMixedStrips(def.coverWidth, widths, def.overlap);
          if (!evalRes.isValid) continue;
          candidates.push({ mix, eval: evalRes, narrowCount, wideCount });
        }
      }

      // Sort based on priority
      candidates.sort((a, b) => {
        if (priority === 'minRolls') {
          // minRolls: prioritize configurations that maximize pairing with walls
          // Walls use wallRollWidth, so we want bottom strips of matching width
          
          // Calculate how many bottom strips can pair with wall strips
          // Wall strips are at wallRollWidth
          const aMatchingStrips = wallRollWidth === ROLL_WIDTH_NARROW ? a.narrowCount : a.wideCount;
          const bMatchingStrips = wallRollWidth === ROLL_WIDTH_NARROW ? b.narrowCount : b.wideCount;
          
          // Calculate total m² ordered for bottom
          const aBottomM2 = a.eval.materialWidthUsed * def.stripLength;
          const bBottomM2 = b.eval.materialWidthUsed * def.stripLength;
          
          // Primary: minimize total bottom m² (fewer/narrower strips = less material)
          if (Math.abs(aBottomM2 - bBottomM2) > 0.1) return aBottomM2 - bBottomM2;
          
          // Secondary: prefer more strips matching wall width (better pairing)
          if (aMatchingStrips !== bMatchingStrips) return bMatchingStrips - aMatchingStrips;
          
          // Tertiary: fewer strips
          return a.eval.stripCount - b.eval.stripCount;
        }

        // minWaste: minimize edge waste, then fewer strips
        const aWaste = a.eval.edgeWasteWidth * def.stripLength;
        const bWaste = b.eval.edgeWasteWidth * def.stripLength;
        if (Math.abs(aWaste - bWaste) > 1e-6) return aWaste - bWaste;
        return a.eval.stripCount - b.eval.stripCount;
      });

      const best = candidates[0];
      if (best) {
        const areaPerSurface = def.stripLength * def.coverWidth;
        const totalArea = areaPerSurface * def.count;
        const totalStrips = best.eval.stripCount * def.count;
        const edgeWasteArea = best.eval.edgeWasteWidth * def.stripLength * def.count;

        // Choose representative width for legacy fields
        const hasWide = best.mix.some((m) => m.rollWidth === ROLL_WIDTH_WIDE);
        optimalWidth = hasWide ? ROLL_WIDTH_WIDE : ROLL_WIDTH_NARROW;
        stripMix = best.mix;
        wastePerSurface = edgeWasteArea;

        surfaces.push({
          surface: def.key,
          surfaceLabel: def.label,
          rollWidth: optimalWidth,
          stripMix,
          stripCount: totalStrips,
          areaM2: totalArea,
          wasteM2: wastePerSurface,
          isManualOverride: false,
          stripLength: def.stripLength,
          coverWidth: def.coverWidth,
          foilAssignment: def.foilAssignment,
        });

        continue;
      }

      // Fallback if no valid mix found
      optimalWidth = ROLL_WIDTH_NARROW;
      const calc = calculateStripsForWidth(def.coverWidth, optimalWidth, def.overlap);
      wastePerSurface = calc.wasteArea * def.stripLength;
    } else {
      // Other surfaces (dividing wall, etc.) - use standard optimization
      if (priority === 'minRolls') {
        const narrowCalc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
        const wideCalc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_WIDE, def.overlap);
        
        const narrowTotalM2 = narrowCalc.count * def.stripLength * ROLL_WIDTH_NARROW;
        const wideTotalM2 = wideCalc.count * def.stripLength * ROLL_WIDTH_WIDE;
        
        if (wideTotalM2 <= narrowTotalM2) {
          optimalWidth = ROLL_WIDTH_WIDE;
          wastePerSurface = wideCalc.wasteArea * def.stripLength;
        } else {
          optimalWidth = ROLL_WIDTH_NARROW;
          wastePerSurface = narrowCalc.wasteArea * def.stripLength;
        }
      } else {
        const optimalResult = findOptimalMixedWidths(def.coverWidth, def.stripLength, def.overlap);
        optimalWidth = optimalResult.primaryWidth;
        wastePerSurface = optimalResult.totalWaste;
      }
    }

    const calc = calculateStripsForWidth(def.coverWidth, optimalWidth, def.overlap);
    const areaPerSurface = def.stripLength * def.coverWidth;
    const totalArea = areaPerSurface * def.count;

    surfaces.push({
      surface: def.key,
      surfaceLabel: def.label,
      rollWidth: optimalWidth,
      stripMix,
      stripCount: calc.count * def.count,
      areaM2: totalArea,
      wasteM2: wastePerSurface * def.count,
      isManualOverride: false,
      stripLength: def.stripLength,
      coverWidth: def.coverWidth,
      foilAssignment: def.foilAssignment,
    });
  }

  return calculateTotals(surfaces, true, foilSubtype, dimensions);
}

/**
 * Find optimal combination of roll widths for a given cover width
 * Tests all possible combinations of 1.65m and 2.05m strips
 */
function findOptimalMixedWidths(
  coverWidth: number,
  stripLength: number,
  overlap: number
): { primaryWidth: RollWidth; totalWaste: number } {
  // Option 1: All narrow (1.65m)
  const narrowCalc = calculateStripsForWidth(coverWidth, ROLL_WIDTH_NARROW, overlap);
  const narrowWaste = narrowCalc.wasteArea * stripLength;

  // Option 2: All wide (2.05m)
  const wideCalc = calculateStripsForWidth(coverWidth, ROLL_WIDTH_WIDE, overlap);
  const wideWaste = wideCalc.wasteArea * stripLength;

  // Option 3: Try mixed combinations - start with wide, fill remainder with narrow
  let bestMixedWaste = Infinity;
  let bestMixedWidth: RollWidth = ROLL_WIDTH_NARROW;

  // Try: 1 wide + rest narrow
  const afterOneWide = coverWidth - ROLL_WIDTH_WIDE;
  if (afterOneWide > 0) {
    const narrowForRest = calculateStripsForWidth(afterOneWide, ROLL_WIDTH_NARROW, overlap);
    const mixedWaste1 = ((ROLL_WIDTH_WIDE - Math.min(ROLL_WIDTH_WIDE, coverWidth)) + narrowForRest.wasteArea) * stripLength;
    if (mixedWaste1 < bestMixedWaste) {
      bestMixedWaste = mixedWaste1;
      bestMixedWidth = ROLL_WIDTH_WIDE;
    }
  }

  // Try: 1 narrow + rest with wide
  const afterOneNarrow = coverWidth - ROLL_WIDTH_NARROW;
  if (afterOneNarrow > 0) {
    const wideForRest = calculateStripsForWidth(afterOneNarrow, ROLL_WIDTH_WIDE, overlap);
    const mixedWaste2 = ((ROLL_WIDTH_NARROW - Math.min(ROLL_WIDTH_NARROW, coverWidth)) + wideForRest.wasteArea) * stripLength;
    if (mixedWaste2 < bestMixedWaste) {
      bestMixedWaste = mixedWaste2;
      bestMixedWidth = ROLL_WIDTH_NARROW;
    }
  }

  // Compare all options and pick the best
  const options: { width: RollWidth; waste: number }[] = [
    { width: ROLL_WIDTH_NARROW, waste: narrowWaste },
    { width: ROLL_WIDTH_WIDE, waste: wideWaste },
  ];

  // Only consider mixed if it's actually better
  if (bestMixedWaste < Math.min(narrowWaste, wideWaste)) {
    options.push({ width: bestMixedWidth, waste: bestMixedWaste });
  }

  // Sort by waste ascending, then by strip count (fewer is better)
  options.sort((a, b) => {
    if (Math.abs(a.waste - b.waste) < 0.01) {
      // If waste is similar, prefer fewer strips
      const aStrips = calculateStripsForWidth(coverWidth, a.width as RollWidth, overlap).count;
      const bStrips = calculateStripsForWidth(coverWidth, b.width as RollWidth, overlap).count;
      return aStrips - bStrips;
    }
    return a.waste - b.waste;
  });

  return { primaryWidth: options[0].width as RollWidth, totalWaste: options[0].waste };
}

/**
 * Update a single surface's roll width and recalculate
 */
export function updateSurfaceRollWidth(
  currentConfig: MixConfiguration,
  surfaceKey: SurfaceKey,
  newWidth: RollWidth,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null
): MixConfiguration {
  // For nadruk/strukturalna, only allow 1.65m width
  const allowedWidth = isNarrowOnlyFoil(foilSubtype) ? ROLL_WIDTH_NARROW : newWidth;
  
  const surfaceDefinitions = getSurfaceDefinitions(dimensions, foilSubtype);
  
  const updatedSurfaces = currentConfig.surfaces.map((surface) => {
    if (surface.surface !== surfaceKey) {
      return surface;
    }

    const def = surfaceDefinitions.find(d => d.key === surfaceKey);
    if (!def) return surface;

    const calc = calculateStripsForWidth(def.coverWidth, allowedWidth, def.overlap);
    const comparison = compareRollWidths(def.coverWidth, def.stripLength, def.overlap);
    const wastePerSurface = allowedWidth === ROLL_WIDTH_NARROW ? comparison.narrow.waste : comparison.wide.waste;

    return {
      ...surface,
      rollWidth: allowedWidth,
      stripCount: calc.count * def.count,
      wasteM2: wastePerSurface * def.count,
      isManualOverride: !isNarrowOnlyFoil(foilSubtype), // Only mark as manual if width choice exists
    };
  });

  return calculateTotals(updatedSurfaces, false, foilSubtype, dimensions);
}

/**
 * Pack strips into rolls using first-fit decreasing algorithm
 */
export function packStripsIntoRolls(
  config: MixConfiguration,
  dimensions?: PoolDimensions,
  foilSubtype?: FoilSubtype | null,
  priority: OptimizationPriority = 'minWaste'
): RollAllocation[] {
  interface StripToPack {
    surface: string;
    stripIndex: number;
    length: number;
    rollWidth: RollWidth;
  }

  const allStrips: StripToPack[] = [];

  const wallSurfaces = config.surfaces.filter(
    (s) => s.surface === 'wall-long' || s.surface === 'wall-short'
  );
  const shouldUseContinuousWallStrips = Boolean(dimensions) && wallSurfaces.length > 0;
  
  config.surfaces.forEach((surface) => {
    // NOTE: When we pack with dimensions-aware mode we inject wall strips
    // based on perimeter and skip the legacy wall-long/wall-short strips to avoid double counting.
    if (shouldUseContinuousWallStrips && (surface.surface === 'wall-long' || surface.surface === 'wall-short')) {
      return;
    }
    const mix = surface.stripMix && surface.stripMix.length > 0
      ? surface.stripMix
      : [{ rollWidth: surface.rollWidth, count: surface.stripCount }];

    let stripIndex = 1;
    for (const group of mix) {
      for (let i = 0; i < group.count; i++) {
        allStrips.push({
          surface: surface.surfaceLabel,
          stripIndex,
          length: surface.stripLength,
          rollWidth: group.rollWidth,
        });
        stripIndex++;
      }
    }
  });

  // Inject wall strips using the flexible optimizer (same for both priorities)
  if (shouldUseContinuousWallStrips && dimensions) {
    const fallbackWidth = getPreferredWallRollWidth(dimensions, foilSubtype);
    
    // Get optimal wall strip plan from the flexible optimizer
    const wallPlan = getOptimalWallStripPlan(dimensions, config, foilSubtype, priority);
    
    if (wallPlan && wallPlan.strips.length > 0) {
      // Use the optimized plan
      for (let i = 0; i < wallPlan.strips.length; i++) {
        const strip = wallPlan.strips[i];
        allStrips.push({
          surface: 'Ściany',
          stripIndex: i + 1,
          length: strip.totalLength,
          rollWidth: strip.rollWidth,
        });
      }
    } else {
      // Fallback: legacy 2-strip continuous mode
      const walls = getWallSegments(dimensions);
      const perimeter = walls.reduce((sum, w) => sum + w.length, 0);
      
      const { stripCount, overlapPerJoin, stripLengths } = computeWallStripPlanFromPerimeter(
        perimeter, 
        config, 
        fallbackWidth
      );
      
      for (let i = 0; i < stripCount; i++) {
        const stripLen = stripLengths[i] ?? perimeter / stripCount + overlapPerJoin;
        
        allStrips.push({
          surface: 'Ściany',
          stripIndex: i + 1,
          length: stripLen,
          rollWidth: fallbackWidth,
        });
      }
    }
  }

  // Group by roll width
  const byWidth = new Map<RollWidth, StripToPack[]>();
  for (const strip of allStrips) {
    const arr = byWidth.get(strip.rollWidth) ?? [];
    arr.push(strip);
    byWidth.set(strip.rollWidth, arr);
  }

  const widthCandidates: RollWidth[] = [ROLL_WIDTH_WIDE, ROLL_WIDTH_NARROW];
  const widthOrder: RollWidth[] = widthCandidates.filter((w) => byWidth.has(w));
  const rolls: RollAllocation[] = [];

  for (const width of widthOrder) {
    const group = byWidth.get(width) ?? [];
    const groupRolls: RollAllocation[] = [];

    const bottoms = group.filter((s) => s.surface === 'Dno');
    const walls = group.filter((s) => s.surface === 'Ściany');
    const others = group.filter((s) => s.surface !== 'Dno' && s.surface !== 'Ściany');

    // Packing strategy:
    // We previously did a greedy "bottom+wall" pairing first, but that can be suboptimal.
    // Example (10x5): pairing 10m(bottom)+10.2m(wall) twice leaves two ~4.8m leftovers,
    // forcing a new roll for a 5m wall strip. A standard bin-packing pass avoids this.
    //
    // We now use Best-Fit Decreasing (BFD):
    // - primary: minimize number of rolls (by filling existing rolls whenever possible)
    // - tie-breakers (minRolls): avoid leaving non-reusable end leftovers (<2m), and prefer
    //   placing wall strips into rolls that already contain bottom strips (consume bottom offcuts).
    const remaining: StripToPack[] = [...bottoms, ...walls, ...others];

    const surfacePriority = (s: StripToPack) => {
      if (s.surface === 'Dno') return 0;
      if (s.surface === 'Ściany') return 1;
      return 2;
    };

    remaining.sort((a, b) => {
      const dl = b.length - a.length;
      if (Math.abs(dl) > 1e-9) return dl;
      // For minRolls, process bottom first on ties to encourage consolidating bottom strips
      // into fewer physical rolls (longer offcuts), which often lets walls fit into those offcuts.
      if (priority === 'minRolls') return surfacePriority(a) - surfacePriority(b);
      return 0;
    });

    const canFit = (roll: RollAllocation, len: number) => roll.usedLength + len <= ROLL_LENGTH + 1e-9;

    const pickBestRollIndex = (strip: StripToPack): number => {
      let bestIdx = -1;
      let bestPenalty = Number.POSITIVE_INFINITY;

      for (let i = 0; i < groupRolls.length; i++) {
        const roll = groupRolls[i];
        if (!canFit(roll, strip.length)) continue;

        const remainingAfter = ROLL_LENGTH - (roll.usedLength + strip.length);

        let penalty: number;
        if (priority === 'minRolls') {
          const isNonReusableEnd = remainingAfter > 0.001 && remainingAfter < MIN_REUSABLE_OFFCUT_LENGTH;
          penalty = (isNonReusableEnd ? 1_000_000 : 0) + remainingAfter;

          // Prefer consuming bottom offcuts for walls before opening/using other rolls.
          if (strip.surface === 'Ściany' && roll.strips.some((x) => x.surface === 'Dno')) {
            penalty -= 0.1; // tiny bonus (tie-break only)
          }
        } else {
          // minWaste: classic best-fit (minimize leftover per roll)
          penalty = remainingAfter;
        }

        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestIdx = i;
        }
      }

      return bestIdx;
    };

    for (const strip of remaining) {
      const idx = pickBestRollIndex(strip);
      if (idx >= 0) {
        const roll = groupRolls[idx];
        roll.strips.push({ surface: strip.surface, stripIndex: strip.stripIndex, length: strip.length });
        roll.usedLength += strip.length;
        roll.wasteLength = ROLL_LENGTH - roll.usedLength;
        continue;
      }

      groupRolls.push({
        rollNumber: 0,
        rollWidth: width,
        usedLength: strip.length,
        wasteLength: ROLL_LENGTH - strip.length,
        strips: [{ surface: strip.surface, stripIndex: strip.stripIndex, length: strip.length }],
      });
    }

    rolls.push(...groupRolls);
  }

  // Re-number rolls sequentially
  rolls.forEach((roll, idx) => {
    roll.rollNumber = idx + 1;
  });

  return rolls;
}

/**
 * Calculate totals for the mix configuration
 */
function calculateTotals(
  surfaces: SurfaceRollConfig[],
  isOptimized: boolean,
  foilSubtype?: FoilSubtype | null,
  dimensions?: PoolDimensions
): MixConfiguration {
  const rolls = packStripsIntoRolls(
    { surfaces, totalRolls165: 0, totalRolls205: 0, totalWaste: 0, wastePercentage: 0, isOptimized },
    dimensions
  );
  
  const rolls165 = rolls.filter(r => r.rollWidth === ROLL_WIDTH_NARROW).length;
  const rolls205 = rolls.filter(r => r.rollWidth === ROLL_WIDTH_WIDE).length;
  
  const totalRollArea = 
    rolls165 * ROLL_WIDTH_NARROW * ROLL_LENGTH +
    rolls205 * ROLL_WIDTH_WIDE * ROLL_LENGTH;

  const totalWaste = rolls.reduce((sum, r) => sum + r.wasteLength * r.rollWidth, 0);
  const wastePercentage = totalRollArea > 0 ? (totalWaste / totalRollArea) * 100 : 0;

  return {
    surfaces,
    totalRolls165: rolls165,
    totalRolls205: rolls205,
    totalWaste,
    wastePercentage,
    isOptimized,
  };
}

/**
 * Calculate comparison for showing alternative configurations
 */
export function calculateComparison(dimensions: PoolDimensions): {
  only165: { rolls: number; wasteM2: number; wastePercent: number };
  only205: { rolls: number; wasteM2: number; wastePercent: number };
  mixed: { rolls165: number; rolls205: number; wasteM2: number; wastePercent: number };
} {
  const surfaceDefinitions = getSurfaceDefinitions(dimensions);
  
  // Calculate for 1.65m only
  let total165Strips = 0;
  let total165WasteArea = 0;
  
  for (const def of surfaceDefinitions) {
    const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
    total165Strips += calc.count * def.count;
    total165WasteArea += calc.wasteArea * def.stripLength * def.count;
  }

  // Calculate for 2.05m only
  let total205Strips = 0;
  let total205WasteArea = 0;
  
  for (const def of surfaceDefinitions) {
    const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_WIDE, def.overlap);
    total205Strips += calc.count * def.count;
    total205WasteArea += calc.wasteArea * def.stripLength * def.count;
  }

  // Get optimized mix
  const mixConfig = autoOptimizeMixConfig(dimensions);

  // Estimate roll counts (simplified - actual packing may differ)
  const totalStripLength165 = surfaceDefinitions.reduce((sum, def) => {
    const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
    return sum + calc.count * def.count * def.stripLength;
  }, 0);
  const rolls165Only = Math.ceil(totalStripLength165 / ROLL_LENGTH);

  const totalStripLength205 = surfaceDefinitions.reduce((sum, def) => {
    const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_WIDE, def.overlap);
    return sum + calc.count * def.count * def.stripLength;
  }, 0);
  const rolls205Only = Math.ceil(totalStripLength205 / ROLL_LENGTH);

  const rollArea165 = rolls165Only * ROLL_WIDTH_NARROW * ROLL_LENGTH;
  const rollArea205 = rolls205Only * ROLL_WIDTH_WIDE * ROLL_LENGTH;

  return {
    only165: {
      rolls: rolls165Only,
      wasteM2: total165WasteArea,
      wastePercent: rollArea165 > 0 ? (total165WasteArea / rollArea165) * 100 : 0,
    },
    only205: {
      rolls: rolls205Only,
      wasteM2: total205WasteArea,
      wastePercent: rollArea205 > 0 ? (total205WasteArea / rollArea205) * 100 : 0,
    },
    mixed: {
      rolls165: mixConfig.totalRolls165,
      rolls205: mixConfig.totalRolls205,
      wasteM2: mixConfig.totalWaste,
      wastePercent: mixConfig.wastePercentage,
    },
  };
}

/**
 * Partition surfaces by foil assignment type
 * Returns surfaces grouped into main pool foil and structural foil
 */
export function partitionSurfacesByFoilType(
  surfaces: SurfaceRollConfig[]
): { main: SurfaceRollConfig[]; structural: SurfaceRollConfig[] } {
  return {
    main: surfaces.filter(s => s.foilAssignment === 'main'),
    structural: surfaces.filter(s => s.foilAssignment === 'structural'),
  };
}
