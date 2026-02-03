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
 */

import { PoolDimensions } from '@/types/configurator';
import { FoilSubtype } from '@/lib/finishingMaterials';
import { 
  ExtendedSurfacePlan, 
  FoilAssignment, 
  SURFACE_FOIL_ASSIGNMENT,
  WASTE_THRESHOLD,
  OVERLAP_STRIPS,
} from './types';

export const ROLL_WIDTH_NARROW = 1.65;
export const ROLL_WIDTH_WIDE = 2.05;
export const ROLL_LENGTH = 25;
export const MIN_REUSABLE_OFFCUT_LENGTH = 2; // meters
export const MIN_OVERLAP_BOTTOM = 0.05;
export const MIN_OVERLAP_WALL = 0.10;
export const FOLD_AT_BOTTOM = 0.15;
export const BUTT_JOINT_OVERLAP = 0; // Structural foil uses butt joint (no overlap)

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

export type SurfaceKey = 'bottom' | 'walls' | 'wall-long' | 'wall-short' | 'stairs' | 'paddling' | 'dividing-wall';

/** Optimization priority for roll selection */
export type OptimizationPriority = 'minWaste' | 'minRolls';

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
  weldArea: number;        // overlap/weld area
  wasteArea: number;       // unusable waste
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
  // Max overlap is typically ~15cm for good welding practice
  const MAX_OVERLAP = 0.15;
  
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
  const surfaceByKey = new Map<SurfaceKey, SurfaceRollConfig>(
    config.surfaces.map((s) => [s.surface, s])
  );

  const relevantDefs = defs.filter((d) => surfaceKeys.includes(d.key));
  const relevantSurfaces = config.surfaces.filter((s) => surfaceKeys.includes(s.surface));

  let totalStripsArea = 0;
  let totalWeldArea = 0;
  let reusableWidthWasteArea = 0;

  for (const def of relevantDefs) {
    const surface = surfaceByKey.get(def.key);
    if (!surface) continue;

    const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
    const stripsPerSingle = calc.count;
    const totalStrips = stripsPerSingle * def.count;

    // Full strip area consumed (includes overlaps - this is NOT waste!)
    totalStripsArea += totalStrips * def.stripLength * surface.rollWidth;

    // Calculate weld/overlap area: number of overlaps × overlap width × strip length
    const overlapsPerSingle = Math.max(0, stripsPerSingle - 1);
    const totalOverlaps = overlapsPerSingle * def.count;
    totalWeldArea += totalOverlaps * calc.actualOverlap * def.stripLength;

    // Edge waste only (excess material on last strip beyond what's needed)
    // Note: overlap area is NOT waste - it's required for welding
    const edgeWasteWidth = calc.wasteArea;
    const edgeWasteArea = edgeWasteWidth * def.stripLength * def.count;
    const isReusable = edgeWasteWidth >= WASTE_THRESHOLD && def.stripLength >= MIN_REUSABLE_OFFCUT_LENGTH;
    if (isReusable) {
      reusableWidthWasteArea += edgeWasteArea;
    }
  }

  // Roll-end waste (length leftover) - pack only relevant surfaces
  const subConfig: MixConfiguration = {
    ...config,
    surfaces: relevantSurfaces,
  };
  const rolls = packStripsIntoRolls(subConfig);
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
 */
export function calculateFoilAreaForPricing(
  config: MixConfiguration,
  dimensions: PoolDimensions,
  foilSubtype?: FoilSubtype | null
): FoilPricingResult {
  // Main surfaces: bottom, wall-long, wall-short, dividing-wall
  const mainKeys: SurfaceKey[] = ['bottom', 'walls', 'wall-long', 'wall-short', 'dividing-wall'];
  // Structural surfaces: stairs, paddling
  const structuralKeys: SurfaceKey[] = ['stairs', 'paddling'];

  const mainResult = calculateAreaForSurfaces(mainKeys, config, dimensions, foilSubtype);
  const structuralResult = calculateAreaForSurfaces(structuralKeys, config, dimensions, foilSubtype);

  return {
    mainFoilArea: mainResult.area,
    mainWeldArea: mainResult.weldArea,
    structuralFoilArea: structuralResult.area,
    structuralWeldArea: structuralResult.weldArea,
    totalArea: mainResult.area + structuralResult.area,
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
  if (dimensions.stairs?.enabled) {
    const stairs = dimensions.stairs;
    const stepWidth = typeof stairs.width === 'number' ? stairs.width : shorterSide;
    const stairsLength = (stairs.stepDepth + stairs.stepHeight) * stairs.stepCount;
    
    surfaces.push({
      key: 'stairs',
      label: 'Schody',
      stripLength: stairsLength,
      coverWidth: stepWidth,
      count: 1,
      overlap: MIN_OVERLAP_WALL,
      foilAssignment: 'structural', // Always structural foil
    });
  }

  // Paddling pool (STRUCTURAL foil for bottom)
  if (dimensions.wadingPool?.enabled) {
    const pool = dimensions.wadingPool;
    
    surfaces.push({
      key: 'paddling',
      label: 'Brodzik (dno)',
      stripLength: Math.max(pool.length, pool.width),
      coverWidth: pool.depth + FOLD_AT_BOTTOM,
      count: 1,
      overlap: MIN_OVERLAP_WALL,
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
  const depth = dimensions.depth + FOLD_AT_BOTTOM;
  
  // Determine optimal roll width for wall strips
  const rollWidth = depth <= 1.50 ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE;
  
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
  foilSubtype?: FoilSubtype | null
): SurfaceDetailedResult[] {
  const results: SurfaceDetailedResult[] = [];
  const defs = getSurfaceDefinitions(dimensions, foilSubtype);
  const rolls = packStripsIntoRolls(config);
  
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
      const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      results.push({
        surfaceKey: 'bottom',
        surfaceLabel: 'Dno',
        strips: [{
          count: surface.stripCount,
          rollWidth: surface.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(surface.areaM2 * 10) / 10,
        totalFoilArea: Math.ceil(surface.areaM2 + calc.wasteArea * def.stripLength),
        weldArea: Math.round((calc.actualOverlap * def.stripLength * Math.max(0, calc.count - 1)) * 10) / 10,
        wasteArea: Math.round(surface.wasteM2 * 10) / 10,
      });
    }
  }

  // Walls (combined)
  if (wallSurfaces.length > 0) {
    const totalWallArea = wallSurfaces.reduce((sum, s) => sum + s.areaM2, 0);
    const totalWallWaste = wallSurfaces.reduce((sum, s) => sum + s.wasteM2, 0);
    const totalWallStrips = wallSurfaces.reduce((sum, s) => sum + s.stripCount, 0);
    
    // Get wall strip assignments
    const perimeter = getWallSegments(dimensions).reduce((sum, w) => sum + w.length, 0);
    const wallStripInfo = assignWallLabelsToStrips(dimensions, perimeter / totalWallStrips, totalWallStrips);
    
    const wallDefs = defs.filter(d => d.key === 'wall-long' || d.key === 'wall-short');
    let totalWeldArea = 0;
    wallDefs.forEach(def => {
      const surface = wallSurfaces.find(s => s.surface === def.key);
      if (surface) {
        const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
        totalWeldArea += calc.actualOverlap * def.stripLength * Math.max(0, calc.count - 1) * def.count;
      }
    });
    
    results.push({
      surfaceKey: 'walls',
      surfaceLabel: 'Ściany',
      strips: wallStripInfo.map((info, idx) => ({
        count: 1,
        rollWidth: wallSurfaces[0]?.rollWidth || ROLL_WIDTH_NARROW,
        stripLength: info.stripLength,
        wallLabels: info.wallLabels,
        rollNumber: idx + 1,
      })),
      coverArea: Math.round(totalWallArea * 10) / 10,
      totalFoilArea: Math.ceil(totalWallArea + totalWallWaste),
      weldArea: Math.round(totalWeldArea * 10) / 10,
      wasteArea: Math.round(totalWallWaste * 10) / 10,
    });
  }

  // Stairs
  if (stairsSurfaces.length > 0) {
    const surface = stairsSurfaces[0];
    const def = defs.find(d => d.key === 'stairs');
    if (def) {
      const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      results.push({
        surfaceKey: 'stairs',
        surfaceLabel: 'Schody',
        strips: [{
          count: surface.stripCount,
          rollWidth: surface.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(surface.areaM2 * 10) / 10,
        totalFoilArea: Math.ceil(surface.areaM2 + surface.wasteM2),
        weldArea: Math.round((calc.actualOverlap * def.stripLength * Math.max(0, calc.count - 1)) * 10) / 10,
        wasteArea: Math.round(surface.wasteM2 * 10) / 10,
      });
    }
  }

  // Paddling pool
  if (paddlingSurfaces.length > 0) {
    const surface = paddlingSurfaces[0];
    const def = defs.find(d => d.key === 'paddling');
    if (def) {
      const calc = calculateStripsForWidth(def.coverWidth, surface.rollWidth, def.overlap);
      const rollNumbers = getRollNumbersForSurface(surface.surfaceLabel);
      
      results.push({
        surfaceKey: 'paddling',
        surfaceLabel: 'Brodzik',
        strips: [{
          count: surface.stripCount,
          rollWidth: surface.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(surface.areaM2 * 10) / 10,
        totalFoilArea: Math.ceil(surface.areaM2 + surface.wasteM2),
        weldArea: Math.round((calc.actualOverlap * def.stripLength * Math.max(0, calc.count - 1)) * 10) / 10,
        wasteArea: Math.round(surface.wasteM2 * 10) / 10,
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
      
      results.push({
        surfaceKey: 'dividing-wall',
        surfaceLabel: 'Murek brodzika',
        strips: [{
          count: surface.stripCount,
          rollWidth: surface.rollWidth,
          stripLength: surface.stripLength,
          rollNumber: rollNumbers[0],
        }],
        coverArea: Math.round(surface.areaM2 * 10) / 10,
        totalFoilArea: Math.ceil(surface.areaM2 + surface.wasteM2),
        weldArea: Math.round((calc.actualOverlap * def.stripLength * Math.max(0, calc.count - 1)) * 10) / 10,
        wasteArea: Math.round(surface.wasteM2 * 10) / 10,
      });
    }
  }

  return results;
}

/**
 * Get reusable offcuts from rolls (pieces >= 30cm width and >= 2m length)
 */
export function getReusableOffcuts(config: MixConfiguration): ReusableOffcut[] {
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

  for (const def of surfaceDefinitions) {
    let optimalWidth: RollWidth;
    let wastePerSurface: number;

    // CRITICAL: Structural surfaces (stairs, paddling bottom) ALWAYS use 1.65m only
    const isStructuralSurface = def.foilAssignment === 'structural';
    const forceNarrow = narrowOnlyMain || isStructuralSurface;

    if (forceNarrow) {
      // Structural surfaces OR nadruk/strukturalna foils can only use 1.65m
      optimalWidth = ROLL_WIDTH_NARROW;
      const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
      wastePerSurface = calc.wasteArea * def.stripLength;
    } else if (priority === 'minRolls') {
      // Prefer wider rolls (2.05m) to minimize roll count
      const narrowCalc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
      const wideCalc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_WIDE, def.overlap);
      
      // Prefer wider if it uses same or fewer strips
      if (wideCalc.count <= narrowCalc.count) {
        optimalWidth = ROLL_WIDTH_WIDE;
        wastePerSurface = wideCalc.wasteArea * def.stripLength;
      } else {
        optimalWidth = ROLL_WIDTH_NARROW;
        wastePerSurface = narrowCalc.wasteArea * def.stripLength;
      }
    } else {
      // Default: minimize waste
      const optimalResult = findOptimalMixedWidths(def.coverWidth, def.stripLength, def.overlap);
      optimalWidth = optimalResult.primaryWidth;
      wastePerSurface = optimalResult.totalWaste;
    }

    const calc = calculateStripsForWidth(def.coverWidth, optimalWidth, def.overlap);
    const areaPerSurface = def.stripLength * def.coverWidth;
    const totalArea = areaPerSurface * def.count;

    surfaces.push({
      surface: def.key,
      surfaceLabel: def.label,
      rollWidth: optimalWidth,
      stripCount: calc.count * def.count,
      areaM2: totalArea,
      wasteM2: wastePerSurface * def.count,
      isManualOverride: false,
      stripLength: def.stripLength,
      coverWidth: def.coverWidth,
      foilAssignment: def.foilAssignment,
    });
  }

  return calculateTotals(surfaces, true, foilSubtype);
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

  return calculateTotals(updatedSurfaces, false, foilSubtype);
}

/**
 * Pack strips into rolls using first-fit decreasing algorithm
 */
export function packStripsIntoRolls(config: MixConfiguration): RollAllocation[] {
  interface StripToPack {
    surface: string;
    stripIndex: number;
    length: number;
    rollWidth: RollWidth;
  }

  const allStrips: StripToPack[] = [];
  
  config.surfaces.forEach((surface) => {
    for (let i = 0; i < surface.stripCount; i++) {
      allStrips.push({
        surface: surface.surfaceLabel,
        stripIndex: i + 1,
        length: surface.stripLength,
        rollWidth: surface.rollWidth,
      });
    }
  });

  // Sort by length descending
  allStrips.sort((a, b) => b.length - a.length);

  const rolls: RollAllocation[] = [];

  for (const strip of allStrips) {
    // Find a roll with same width and enough space
    let placed = false;
    for (const roll of rolls) {
      if (roll.rollWidth === strip.rollWidth && roll.usedLength + strip.length <= ROLL_LENGTH) {
        roll.strips.push({ surface: strip.surface, stripIndex: strip.stripIndex, length: strip.length });
        roll.usedLength += strip.length;
        roll.wasteLength = ROLL_LENGTH - roll.usedLength;
        placed = true;
        break;
      }
    }

    if (!placed) {
      rolls.push({
        rollNumber: rolls.length + 1,
        rollWidth: strip.rollWidth,
        usedLength: strip.length,
        wasteLength: ROLL_LENGTH - strip.length,
        strips: [{ surface: strip.surface, stripIndex: strip.stripIndex, length: strip.length }],
      });
    }
  }

  // Re-number rolls
  rolls.forEach((roll, idx) => {
    roll.rollNumber = idx + 1;
  });

  return rolls;
}

/**
 * Calculate totals for the mix configuration
 */
function calculateTotals(surfaces: SurfaceRollConfig[], isOptimized: boolean, foilSubtype?: FoilSubtype | null): MixConfiguration {
  const rolls = packStripsIntoRolls({ surfaces, totalRolls165: 0, totalRolls205: 0, totalWaste: 0, wastePercentage: 0, isOptimized });
  
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
