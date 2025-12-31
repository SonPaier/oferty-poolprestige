/**
 * Foil Layout Planner - Advanced foil optimization following manufacturer guidelines
 * 
 * Key rules from documentation:
 * 1. Walls: Prefer HORIZONTAL strips to minimize vertical seams (only at corners)
 * 2. Bottom: Strips go ACROSS the shorter dimension (perpendicular to longer side)
 * 3. Material width selection based on wall height:
 *    - H ≤ 1.40m → use 1.65m roll
 *    - H ≤ 1.90m → use 2.05m roll  
 *    - H > 2.0m → use widening strip (additional pass)
 * 4. Overlaps: min 5cm for bottom, min 10cm for walls
 * 5. Fold at wall-bottom transition: 10-20cm
 * 6. Max roll length: 25m
 * 7. Tension shift at wall-bottom: 2-3cm towards center
 */

import { PoolDimensions, PoolShape } from '@/types/configurator';

// Constants from manufacturer guidelines
export const ROLL_WIDTH_NARROW = 1.65; // meters
export const ROLL_WIDTH_WIDE = 2.05; // meters
export const ROLL_LENGTH = 25; // meters
export const MIN_OVERLAP_BOTTOM = 0.05; // 5cm
export const MIN_OVERLAP_WALL = 0.10; // 10cm
export const FOLD_AT_BOTTOM = 0.15; // 15cm default (10-20cm range)
export const WELD_WIDTH = 0.03; // 3cm weld seam
export const TENSION_SHIFT = 0.025; // 2.5cm shift at wall-bottom transition

// Surface types for segmentation
export type SurfaceType = 'bottom' | 'bottom-slope' | 'wall-long-1' | 'wall-long-2' | 'wall-short-1' | 'wall-short-2' | 'l-arm';

// Strip direction for walls
export type StripDirection = 'horizontal' | 'vertical';

// A single foil strip
export interface FoilStrip {
  id: string;
  surface: SurfaceType;
  direction: StripDirection;
  rollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
  stripLength: number; // Length of the strip (along the strip)
  usedWidth: number; // Actual width used on this strip
  position: number; // Position from start of surface
  overlap: number; // Overlap with previous strip
  // 3D positioning for visualization
  startPoint: [number, number, number];
  endPoint: [number, number, number];
}

// Validation warning/error
export interface FoilValidationIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  stripId?: string;
  surface?: SurfaceType;
}

// Result of foil planning
export interface FoilPlanResult {
  surfaces: SurfacePlan[];
  strips: FoilStrip[];
  rolls: RollAllocation[];
  totalArea: number;
  usedArea: number;
  wasteArea: number;
  wastePercentage: number;
  issues: FoilValidationIssue[];
  // Comparison with alternatives
  comparison: {
    only165: { rolls: number; waste: number; wastePercent: number };
    only205: { rolls: number; waste: number; wastePercent: number };
    mixed: { rolls165: number; rolls205: number; waste: number; wastePercent: number };
  };
}

// Surface segment planning
export interface SurfacePlan {
  type: SurfaceType;
  width: number; // Width to cover (e.g., wall height or bottom width)
  length: number; // Length of surface
  area: number;
  strips: FoilStrip[];
  recommendedRollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
}

// Roll allocation
export interface RollAllocation {
  rollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
  count: number;
  strips: string[]; // Strip IDs allocated to this roll
  usedLength: number;
  wasteLength: number;
}

/**
 * Choose the best roll width based on wall height
 */
export function chooseRollWidth(height: number): typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE {
  // Account for fold at bottom (10-20cm)
  const effectiveHeight = height + FOLD_AT_BOTTOM;
  
  if (effectiveHeight <= 1.40) {
    return ROLL_WIDTH_NARROW;
  } else if (effectiveHeight <= 1.90) {
    return ROLL_WIDTH_WIDE;
  }
  // For heights > 1.90m, we need multiple strips but start with wider
  return ROLL_WIDTH_WIDE;
}

/**
 * Calculate number of strips needed to cover a width
 */
function calculateStripsNeeded(
  coverWidth: number, 
  rollWidth: number, 
  overlap: number
): { count: number; lastStripWidth: number } {
  if (coverWidth <= rollWidth) {
    return { count: 1, lastStripWidth: coverWidth };
  }
  
  const effectiveWidth = rollWidth - overlap;
  // First strip uses full width, subsequent strips overlap
  const remainingWidth = coverWidth - rollWidth;
  const additionalStrips = Math.ceil(remainingWidth / effectiveWidth);
  const totalStrips = 1 + additionalStrips;
  
  // Calculate last strip actual width used
  const coveredByPrevious = rollWidth + (additionalStrips - 1) * effectiveWidth;
  const lastStripWidth = coverWidth - coveredByPrevious + overlap;
  
  return { count: totalStrips, lastStripWidth: Math.min(rollWidth, lastStripWidth) };
}

/**
 * Plan wall strips - HORIZONTAL orientation preferred
 * Strips go along the wall length, stacked from top to bottom
 */
function planWallSurface(
  surfaceType: SurfaceType,
  wallLength: number,
  wallHeight: number,
  depthAtStart: number,
  depthAtEnd: number,
  yPosition: number,
  xPosition: number,
  isXWall: boolean,
  stripIdPrefix: string
): SurfacePlan {
  const rollWidth = chooseRollWidth(wallHeight);
  const overlap = MIN_OVERLAP_WALL;
  const { count: stripCount } = calculateStripsNeeded(wallHeight + FOLD_AT_BOTTOM, rollWidth, overlap);
  
  const strips: FoilStrip[] = [];
  let currentHeight = 0;
  
  for (let i = 0; i < stripCount; i++) {
    const isFirstStrip = i === 0;
    const stripOverlap = isFirstStrip ? 0 : overlap;
    const stripPosition = currentHeight - stripOverlap;
    
    // Calculate used width for this strip
    const remainingHeight = (wallHeight + FOLD_AT_BOTTOM) - currentHeight + stripOverlap;
    const usedWidth = Math.min(rollWidth, remainingHeight);
    
    // Calculate 3D positions based on wall orientation
    let startPoint: [number, number, number];
    let endPoint: [number, number, number];
    
    const zTop = -stripPosition;
    const zBottom = -stripPosition - usedWidth + FOLD_AT_BOTTOM;
    
    if (isXWall) {
      // Wall along X axis (front/back)
      startPoint = [-wallLength / 2, yPosition, zTop];
      endPoint = [wallLength / 2, yPosition, zBottom];
    } else {
      // Wall along Y axis (left/right)
      startPoint = [xPosition, -wallLength / 2, zTop];
      endPoint = [xPosition, wallLength / 2, zBottom];
    }
    
    strips.push({
      id: `${stripIdPrefix}-${i}`,
      surface: surfaceType,
      direction: 'horizontal',
      rollWidth,
      stripLength: wallLength,
      usedWidth,
      position: stripPosition,
      overlap: stripOverlap,
      startPoint,
      endPoint,
    });
    
    currentHeight += rollWidth - overlap;
    if (currentHeight >= wallHeight + FOLD_AT_BOTTOM) break;
  }
  
  return {
    type: surfaceType,
    width: wallHeight + FOLD_AT_BOTTOM,
    length: wallLength,
    area: wallLength * wallHeight,
    strips,
    recommendedRollWidth: rollWidth,
  };
}

/**
 * Plan bottom strips - ACROSS the shorter dimension
 * Strips go perpendicular to the longer side (fewer seams)
 */
function planBottomSurface(
  dimensions: PoolDimensions,
  stripIdPrefix: string
): SurfacePlan {
  const { length, width, depth, depthDeep, hasSlope } = dimensions;
  
  // Strips go across the shorter dimension
  const longerSide = Math.max(length, width);
  const shorterSide = Math.min(length, width);
  const isLengthLonger = length >= width;
  
  // Choose roll width - for bottom, we optimize for less waste
  const overlap = MIN_OVERLAP_BOTTOM;
  
  // Try both roll widths and pick optimal
  const calc165 = calculateStripsNeeded(shorterSide, ROLL_WIDTH_NARROW, overlap);
  const calc205 = calculateStripsNeeded(shorterSide, ROLL_WIDTH_WIDE, overlap);
  
  // Calculate waste for each option
  const waste165 = calc165.count * ROLL_WIDTH_NARROW - shorterSide - (calc165.count - 1) * overlap;
  const waste205 = calc205.count * ROLL_WIDTH_WIDE - shorterSide - (calc205.count - 1) * overlap;
  
  // Pick the one with less waste, preferring fewer strips if equal
  let rollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
  let stripCount: number;
  
  if (waste165 <= waste205 || calc165.count < calc205.count) {
    rollWidth = ROLL_WIDTH_NARROW;
    stripCount = calc165.count;
  } else {
    rollWidth = ROLL_WIDTH_WIDE;
    stripCount = calc205.count;
  }
  
  const strips: FoilStrip[] = [];
  let currentPosition = -shorterSide / 2;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  
  for (let i = 0; i < stripCount; i++) {
    const isFirstStrip = i === 0;
    const stripOverlap = isFirstStrip ? 0 : overlap;
    
    const remainingWidth = shorterSide / 2 - currentPosition + stripOverlap;
    const usedWidth = Math.min(rollWidth, remainingWidth + rollWidth);
    
    const stripCenterPos = currentPosition + rollWidth / 2 - (isFirstStrip ? 0 : overlap / 2);
    
    // Calculate 3D positions
    let startPoint: [number, number, number];
    let endPoint: [number, number, number];
    
    if (isLengthLonger) {
      // Strips go along length (X), positioned along width (Y)
      startPoint = [-longerSide / 2, stripCenterPos, -depth];
      endPoint = [longerSide / 2, stripCenterPos, hasSlope ? -actualDeep : -depth];
    } else {
      // Strips go along width (Y), positioned along length (X)
      startPoint = [stripCenterPos, -longerSide / 2, -depth];
      endPoint = [stripCenterPos, longerSide / 2, hasSlope ? -actualDeep : -depth];
    }
    
    strips.push({
      id: `${stripIdPrefix}-${i}`,
      surface: 'bottom',
      direction: 'horizontal',
      rollWidth,
      stripLength: longerSide,
      usedWidth,
      position: currentPosition,
      overlap: stripOverlap,
      startPoint,
      endPoint,
    });
    
    currentPosition += rollWidth - overlap;
    if (currentPosition >= shorterSide / 2) break;
  }
  
  return {
    type: 'bottom',
    width: shorterSide,
    length: longerSide,
    area: length * width,
    strips,
    recommendedRollWidth: rollWidth,
  };
}

/**
 * Pack strips into rolls using first-fit decreasing algorithm
 */
function packStripsIntoRolls(
  strips: FoilStrip[]
): RollAllocation[] {
  // Group strips by roll width
  const strips165 = strips.filter(s => s.rollWidth === ROLL_WIDTH_NARROW);
  const strips205 = strips.filter(s => s.rollWidth === ROLL_WIDTH_WIDE);
  
  const packGroup = (groupStrips: FoilStrip[], rollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE): RollAllocation[] => {
    if (groupStrips.length === 0) return [];
    
    // Sort by length descending (first-fit decreasing)
    const sorted = [...groupStrips].sort((a, b) => b.stripLength - a.stripLength);
    const rolls: RollAllocation[] = [];
    
    for (const strip of sorted) {
      // Find a roll with enough space
      let placed = false;
      for (const roll of rolls) {
        if (roll.usedLength + strip.stripLength <= ROLL_LENGTH) {
          roll.strips.push(strip.id);
          roll.usedLength += strip.stripLength;
          roll.wasteLength = ROLL_LENGTH - roll.usedLength;
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        rolls.push({
          rollWidth,
          count: 1,
          strips: [strip.id],
          usedLength: strip.stripLength,
          wasteLength: ROLL_LENGTH - strip.stripLength,
        });
      }
    }
    
    return rolls;
  };
  
  return [...packGroup(strips165, ROLL_WIDTH_NARROW), ...packGroup(strips205, ROLL_WIDTH_WIDE)];
}

/**
 * Validate foil plan against manufacturer rules
 */
function validatePlan(strips: FoilStrip[], rolls: RollAllocation[]): FoilValidationIssue[] {
  const issues: FoilValidationIssue[] = [];
  
  // Check each strip
  for (const strip of strips) {
    // Check max roll length
    if (strip.stripLength > ROLL_LENGTH) {
      issues.push({
        type: 'error',
        code: 'STRIP_TOO_LONG',
        message: `Pas ${strip.id} przekracza max długość rolki 25m (${strip.stripLength.toFixed(2)}m)`,
        stripId: strip.id,
        surface: strip.surface,
      });
    }
    
    // Check minimum overlap
    const minOverlap = strip.surface === 'bottom' ? MIN_OVERLAP_BOTTOM : MIN_OVERLAP_WALL;
    if (strip.overlap > 0 && strip.overlap < minOverlap) {
      issues.push({
        type: 'error',
        code: 'OVERLAP_TOO_SMALL',
        message: `Zakładka pasa ${strip.id} jest za mała (${(strip.overlap * 100).toFixed(0)}cm < ${(minOverlap * 100).toFixed(0)}cm)`,
        stripId: strip.id,
        surface: strip.surface,
      });
    }
    
    // Warning for vertical seams on walls (not at corners)
    if (strip.surface.startsWith('wall') && strip.direction === 'vertical') {
      issues.push({
        type: 'warning',
        code: 'VERTICAL_SEAM_ON_WALL',
        message: `Pas ${strip.id} ma pionową spoinę poza narożnikiem`,
        stripId: strip.id,
        surface: strip.surface,
      });
    }
  }
  
  return issues;
}

/**
 * Calculate comparison with alternative roll configurations
 */
function calculateComparison(totalArea: number): FoilPlanResult['comparison'] {
  const rollArea165 = ROLL_WIDTH_NARROW * ROLL_LENGTH;
  const rollArea205 = ROLL_WIDTH_WIDE * ROLL_LENGTH;
  
  const rolls165 = Math.ceil(totalArea / rollArea165);
  const rolls205 = Math.ceil(totalArea / rollArea205);
  
  const waste165 = rolls165 * rollArea165 - totalArea;
  const waste205 = rolls205 * rollArea205 - totalArea;
  
  return {
    only165: {
      rolls: rolls165,
      waste: waste165,
      wastePercent: (waste165 / (rolls165 * rollArea165)) * 100,
    },
    only205: {
      rolls: rolls205,
      waste: waste205,
      wastePercent: (waste205 / (rolls205 * rollArea205)) * 100,
    },
    mixed: {
      rolls165: 0,
      rolls205: 0,
      waste: 0,
      wastePercent: 0,
    },
  };
}

/**
 * Main planning function
 */
export function planFoilLayout(
  dimensions: PoolDimensions,
  irregularSurchargePercent: number = 20
): FoilPlanResult {
  const { length, width, depth, depthDeep, hasSlope, shape, isIrregular } = dimensions;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  
  const surfaces: SurfacePlan[] = [];
  let allStrips: FoilStrip[] = [];
  
  // 1. Plan bottom surface
  const bottomPlan = planBottomSurface(dimensions, 'bottom');
  surfaces.push(bottomPlan);
  allStrips = [...allStrips, ...bottomPlan.strips];
  
  // 2. Plan wall surfaces
  // Front wall (+Y)
  const frontWall = planWallSurface(
    'wall-long-1',
    length,
    depth,
    depth,
    actualDeep,
    width / 2,
    0,
    true,
    'wall-front'
  );
  surfaces.push(frontWall);
  allStrips = [...allStrips, ...frontWall.strips];
  
  // Back wall (-Y)
  const backWall = planWallSurface(
    'wall-long-2',
    length,
    depth,
    depth,
    actualDeep,
    -width / 2,
    0,
    true,
    'wall-back'
  );
  surfaces.push(backWall);
  allStrips = [...allStrips, ...backWall.strips];
  
  // Left wall (-X)
  const leftWall = planWallSurface(
    'wall-short-1',
    width,
    depth,
    depth,
    depth,
    0,
    -length / 2,
    false,
    'wall-left'
  );
  surfaces.push(leftWall);
  allStrips = [...allStrips, ...leftWall.strips];
  
  // Right wall (+X)
  const rightWall = planWallSurface(
    'wall-short-2',
    width,
    actualDeep,
    actualDeep,
    actualDeep,
    0,
    length / 2,
    false,
    'wall-right'
  );
  surfaces.push(rightWall);
  allStrips = [...allStrips, ...rightWall.strips];
  
  // Custom shapes are handled via customVertices, no L-shape specific logic needed
  
  // 3. Pack strips into rolls
  const rolls = packStripsIntoRolls(allStrips);
  
  // 4. Calculate areas
  const baseArea = surfaces.reduce((sum, s) => sum + s.area, 0);
  const usedArea = allStrips.reduce((sum, s) => sum + s.stripLength * s.usedWidth, 0);
  const irregularSurcharge = isIrregular ? irregularSurchargePercent : 0;
  const totalArea = baseArea * 1.1 * (1 + irregularSurcharge / 100); // 10% seam + irregular
  
  const rolls165 = rolls.filter(r => r.rollWidth === ROLL_WIDTH_NARROW);
  const rolls205 = rolls.filter(r => r.rollWidth === ROLL_WIDTH_WIDE);
  
  const totalRollArea = 
    rolls165.length * ROLL_WIDTH_NARROW * ROLL_LENGTH +
    rolls205.length * ROLL_WIDTH_WIDE * ROLL_LENGTH;
  
  const wasteArea = totalRollArea - usedArea;
  const wastePercentage = totalRollArea > 0 ? (wasteArea / totalRollArea) * 100 : 0;
  
  // 5. Validate
  const issues = validatePlan(allStrips, rolls);
  
  // 6. Calculate comparison
  const comparison = calculateComparison(totalArea);
  comparison.mixed = {
    rolls165: rolls165.length,
    rolls205: rolls205.length,
    waste: wasteArea,
    wastePercent: wastePercentage,
  };
  
  return {
    surfaces,
    strips: allStrips,
    rolls,
    totalArea,
    usedArea,
    wasteArea,
    wastePercentage,
    issues,
    comparison,
  };
}

/**
 * Get strip lines for 3D visualization
 */
export function getStripLinesFor3D(plan: FoilPlanResult): Array<{
  points: [number, number, number][];
  isWall: boolean;
}> {
  return plan.strips.map(strip => ({
    points: [strip.startPoint, strip.endPoint],
    isWall: strip.surface.startsWith('wall'),
  }));
}
