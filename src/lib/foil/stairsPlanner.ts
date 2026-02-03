/**
 * Stairs Surface Foil Planner
 * 
 * Plans foil coverage for pool stairs:
 * - Only counts horizontal footprint (stepDepth × stepCount)
 * - Risers (vertical fronts) are NOT covered with anti-slip foil
 * - NO overlap between step pieces (each step is separate)
 * 
 * CUTTING LOGIC:
 * - If stair width <= 1.65m: one strip of footprintLength × stairWidth
 * - If stair width > 1.65m: cut from roll width transversely
 *   - Cut strip of LENGTH = stair width from 1.65m roll
 *   - Cut into stepDepth pieces (one per step)
 *   - Waste = (1.65m - footprintLength) × stairWidth
 */

import { StairsConfig, PoolDimensions } from '@/types/configurator';
import { ROLL_WIDTH_NARROW } from '../foilPlanner';
import { StairsPlanResult, ExtendedSurfaceType, ExtendedSurfacePlan, SURFACE_FOIL_ASSIGNMENT } from './types';
import { calculateStairsArea, generateStairsGeometry } from '../stairsShapeGenerator';

/**
 * Calculate effective stairs width based on configuration
 */
function getStairsWidth(stairs: StairsConfig, dimensions: PoolDimensions): number {
  if (typeof stairs.width === 'number') {
    return stairs.width;
  }
  // 'full' width = along selected wall
  return stairs.direction === 'along-length' ? dimensions.length : dimensions.width;
}

/**
 * Calculate horizontal footprint area (projection on pool bottom)
 * This is the ONLY area that requires anti-slip foil
 * 
 * Formula: width × (stepDepth × stepCount)
 */
function calculateStairFootprintArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  const stairsWidth = getStairsWidth(stairs, dimensions);
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  
  // For rectangular stairs: simple calculation
  if (stairs.shapeType === 'rectangular' || !stairs.shapeType) {
    return stepCount * stepDepth * stairsWidth;
  }
  
  // For diagonal 45° stairs: use geometry to get projection area
  const geometry = generateStairsGeometry(dimensions.length, dimensions.width, stairs);
  if (geometry) {
    return calculateStairsArea(geometry.vertices);
  }
  
  return stepCount * stepDepth * stairsWidth;
}

/**
 * Calculate foil material area needed for stairs
 * Uses transverse cutting logic when width > roll width
 * 
 * @returns { materialArea: number, wasteArea: number }
 */
function calculateStairsFoilMaterial(stairs: StairsConfig, dimensions: PoolDimensions): { materialArea: number, wasteArea: number } {
  const stairsWidth = getStairsWidth(stairs, dimensions);
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  const footprintLength = stepCount * stepDepth;
  
  if (stairsWidth > ROLL_WIDTH_NARROW) {
    // Cut from roll width transversely:
    // - Strip length = stair width
    // - Material = 1.65m × stairWidth
    // - Waste = (1.65m - footprintLength) × stairWidth
    const materialArea = ROLL_WIDTH_NARROW * stairsWidth;
    const wasteArea = Math.max(0, (ROLL_WIDTH_NARROW - footprintLength) * stairsWidth);
    return { materialArea, wasteArea };
  } else {
    // Standard: stair width fits within roll
    // - Strip length = footprintLength
    // - Material = footprintLength × 1.65m
    // - Waste = (1.65m - stairWidth) × footprintLength
    const materialArea = footprintLength * ROLL_WIDTH_NARROW;
    const wasteArea = Math.max(0, (ROLL_WIDTH_NARROW - stairsWidth) * footprintLength);
    return { materialArea, wasteArea };
  }
}

/**
 * Plan foil layout for stairs
 * 
 * Only covers horizontal footprint (treads) - risers are NOT included
 * NO overlap between step pieces
 * 
 * @param stairs Stairs configuration
 * @param poolDepth Pool depth at stairs location
 * @param dimensions Pool dimensions
 * @returns Stairs plan with footprint surface only
 */
export function planStairsSurface(
  stairs: StairsConfig,
  poolDepth: number,
  dimensions: PoolDimensions
): StairsPlanResult | null {
  if (!stairs.enabled) return null;
  
  const stairsWidth = getStairsWidth(stairs, dimensions);
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  
  // Only calculate footprint area (no risers, no overlap)
  const footprintArea = calculateStairFootprintArea(stairs, dimensions);
  const footprintLength = stepCount * stepDepth;
  
  // Create surface plan for stairs footprint only
  const surfaces: ExtendedSurfacePlan[] = [];
  
  // Stair footprint (horizontal treads) - STRUCTURAL anti-slip foil
  // NO overlap between steps
  const stepType: ExtendedSurfaceType = 'stairs-step';
  surfaces.push({
    type: stepType,
    width: footprintLength,              // Total depth of all steps
    length: stairsWidth,                 // Width of stairs
    area: footprintArea,
    strips: [],                          // Will be populated by main planner
    recommendedRollWidth: ROLL_WIDTH_NARROW,
    foilAssignment: SURFACE_FOIL_ASSIGNMENT[stepType], // 'structural'
  });
  
  return {
    surfaces,
    stepArea: footprintArea,
    riserArea: 0,  // Risers are NOT covered with anti-slip foil
  };
}

/**
 * Calculate total stairs foil area (horizontal footprint only)
 */
export function calculateTotalStairsArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  if (!stairs.enabled) return 0;
  
  // Only footprint area - no risers
  return calculateStairFootprintArea(stairs, dimensions);
}

/**
 * Calculate total foil material needed for stairs (includes waste from cutting)
 */
export function calculateStairsFoilMaterialArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  if (!stairs.enabled) return 0;
  
  const { materialArea } = calculateStairsFoilMaterial(stairs, dimensions);
  return materialArea;
}
