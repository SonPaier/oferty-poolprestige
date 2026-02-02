/**
 * MIX Roll Planner - Allows different roll widths per surface with auto-optimization
 * 
 * Width restrictions by foil type:
 * - jednokolorowa: 1.65m or 2.05m
 * - nadruk: only 1.65m
 * - strukturalna: only 1.65m, butt joint on bottom (no overlap)
 */

import { PoolDimensions } from '@/types/configurator';
import { FoilSubtype } from '@/lib/finishingMaterials';

export const ROLL_WIDTH_NARROW = 1.65;
export const ROLL_WIDTH_WIDE = 2.05;
export const ROLL_LENGTH = 25;
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

export type SurfaceKey = 'bottom' | 'wall-long' | 'wall-short' | 'stairs' | 'paddling';

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
}

export interface MixConfiguration {
  surfaces: SurfaceRollConfig[];
  totalRolls165: number;
  totalRolls205: number;
  totalWaste: number;
  wastePercentage: number;
  isOptimized: boolean;
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
}

/**
 * Calculate strips needed for a given width and roll width
 */
function calculateStripsForWidth(
  coverWidth: number,
  rollWidth: RollWidth,
  overlap: number
): { count: number; usedArea: number; wasteArea: number } {
  if (coverWidth <= 0) {
    return { count: 0, usedArea: 0, wasteArea: 0 };
  }

  if (coverWidth <= rollWidth) {
    return { 
      count: 1, 
      usedArea: rollWidth,
      wasteArea: rollWidth - coverWidth
    };
  }

  const effectiveWidth = rollWidth - overlap;
  const remainingAfterFirst = coverWidth - rollWidth;
  const additionalStrips = Math.ceil(remainingAfterFirst / effectiveWidth);
  const totalStrips = 1 + additionalStrips;

  const totalMaterial = rollWidth + additionalStrips * effectiveWidth;
  const wasteArea = totalMaterial - coverWidth;

  return { 
    count: totalStrips, 
    usedArea: totalMaterial,
    wasteArea: Math.max(0, wasteArea)
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

  // Bottom - strips along longer side, cover shorter side
  surfaces.push({
    key: 'bottom',
    label: 'Dno',
    stripLength: longerSide,
    coverWidth: shorterSide,
    count: 1,
    overlap: bottomOverlap,
    isButtJoint: isButtJointBottom,
  });

  // Long walls (2×) - strips along longer side, cover depth
  surfaces.push({
    key: 'wall-long',
    label: 'Ściany długie (2×)',
    stripLength: longerSide,
    coverWidth: depth + FOLD_AT_BOTTOM,
    count: 2,
    overlap: MIN_OVERLAP_WALL,
  });

  // Short walls (2×) - strips along shorter side, cover depth
  surfaces.push({
    key: 'wall-short',
    label: 'Ściany krótkie (2×)',
    stripLength: shorterSide,
    coverWidth: depth + FOLD_AT_BOTTOM,
    count: 2,
    overlap: MIN_OVERLAP_WALL,
  });

  // Stairs
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
    });
  }

  // Paddling pool
  if (dimensions.wadingPool?.enabled) {
    const pool = dimensions.wadingPool;
    const paddlingPerimeter = 2 * pool.length + 2 * pool.width + pool.depth * 4;
    
    surfaces.push({
      key: 'paddling',
      label: 'Brodzik',
      stripLength: Math.max(pool.length, pool.width),
      coverWidth: pool.depth + FOLD_AT_BOTTOM,
      count: 1,
      overlap: MIN_OVERLAP_WALL,
    });
  }

  return surfaces;
}

/**
 * Auto-optimize roll width selection for all surfaces
 */
export function autoOptimizeMixConfig(dimensions: PoolDimensions, foilSubtype?: FoilSubtype | null): MixConfiguration {
  const surfaceDefinitions = getSurfaceDefinitions(dimensions, foilSubtype);
  const surfaces: SurfaceRollConfig[] = [];
  const availableWidths = getAvailableWidths(foilSubtype);
  const narrowOnly = isNarrowOnlyFoil(foilSubtype);

  for (const def of surfaceDefinitions) {
    let optimalWidth: RollWidth;
    let wastePerSurface: number;

    if (narrowOnly) {
      // Nadruk and strukturalna can only use 1.65m
      optimalWidth = ROLL_WIDTH_NARROW;
      const calc = calculateStripsForWidth(def.coverWidth, ROLL_WIDTH_NARROW, def.overlap);
      wastePerSurface = calc.wasteArea * def.stripLength;
    } else {
      // Jednokolorowa can use either width - pick optimal
      const comparison = compareRollWidths(def.coverWidth, def.stripLength, def.overlap);
      optimalWidth = comparison.optimal;
      wastePerSurface = optimalWidth === ROLL_WIDTH_NARROW ? comparison.narrow.waste : comparison.wide.waste;
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
    });
  }

  return calculateTotals(surfaces, true, foilSubtype);
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
