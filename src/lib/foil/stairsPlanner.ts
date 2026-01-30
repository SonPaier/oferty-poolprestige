/**
 * Stairs Surface Foil Planner
 * 
 * Plans foil coverage for pool stairs:
 * - Step treads (horizontal) → anti-slip foil required
 * - Step risers (vertical) → regular foil
 * 
 * Note: Anti-slip is only for STEPS (horizontal surfaces).
 * Risers (vertical fronts of steps) use regular pool foil.
 */

import { StairsConfig, PoolDimensions } from '@/types/configurator';
import { ROLL_WIDTH_NARROW } from '../foilPlanner';
import { StairsPlanResult, ExtendedSurfaceType, ExtendedSurfacePlan } from './types';
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
 * Calculate total step (tread) area - horizontal surfaces
 * These require anti-slip foil
 */
function calculateStepArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  const stairsWidth = getStairsWidth(stairs, dimensions);
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  
  // For rectangular stairs: simple calculation
  if (stairs.shapeType === 'rectangular' || !stairs.shapeType) {
    return stepCount * stepDepth * stairsWidth;
  }
  
  // For diagonal 45° stairs: use geometry to get projection area
  // Steps are still horizontal but follow the diagonal shape
  const geometry = generateStairsGeometry(dimensions.length, dimensions.width, stairs);
  if (geometry) {
    // For diagonal stairs, projection area ≈ step area
    return calculateStairsArea(geometry.vertices);
  }
  
  return stepCount * stepDepth * stairsWidth;
}

/**
 * Calculate total riser area - vertical surfaces
 * These use regular pool foil
 */
function calculateRiserArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  const stairsWidth = getStairsWidth(stairs, dimensions);
  const stepCount = stairs.stepCount || 4;
  const stepHeight = stairs.stepHeight || 0.20;
  
  // For rectangular stairs: width × height × count
  if (stairs.shapeType === 'rectangular' || !stairs.shapeType) {
    return stepCount * stepHeight * stairsWidth;
  }
  
  // For diagonal 45° stairs: risers follow the diagonal
  // Approximate by using diagonal length × height × count
  // Each riser runs along the hypotenuse direction
  const stepDepth = stairs.stepDepth || 0.30;
  const diagonalSize = stepCount * stepDepth;
  const hypotenuseLength = diagonalSize * Math.SQRT2;
  
  // Riser area = hypotenuse length × step height × (stepCount)
  // Note: For 45° stairs, the "width" is the hypotenuse, not stairsWidth
  return stepCount * stepHeight * (hypotenuseLength / stepCount);
}

/**
 * Plan foil layout for stairs
 * 
 * @param stairs Stairs configuration
 * @param poolDepth Pool depth at stairs location
 * @param dimensions Pool dimensions
 * @returns Stairs plan with separate step and riser surfaces
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
  const stepHeight = stairs.stepHeight || 0.20;
  
  const stepArea = calculateStepArea(stairs, dimensions);
  const riserArea = calculateRiserArea(stairs, dimensions);
  
  // Create surface plans for steps and risers
  const surfaces: ExtendedSurfacePlan[] = [];
  
  // Step surface (horizontal, anti-slip)
  surfaces.push({
    type: 'stairs-step' as ExtendedSurfaceType,
    width: stepDepth,                    // Each step width
    length: stairsWidth * stepCount,     // Total linear length of steps
    area: stepArea,
    strips: [],                          // Will be populated by main planner
    recommendedRollWidth: ROLL_WIDTH_NARROW,
  });
  
  // Riser surface (vertical, regular foil)
  surfaces.push({
    type: 'stairs-riser' as ExtendedSurfaceType,
    width: stepHeight,                   // Each riser height
    length: stairsWidth * stepCount,     // Total linear length of risers
    area: riserArea,
    strips: [],
    recommendedRollWidth: ROLL_WIDTH_NARROW,
  });
  
  return {
    surfaces,
    stepArea,
    riserArea,
  };
}

/**
 * Calculate total stairs foil area (both steps and risers)
 */
export function calculateTotalStairsArea(stairs: StairsConfig, dimensions: PoolDimensions): number {
  if (!stairs.enabled) return 0;
  
  const stepArea = calculateStepArea(stairs, dimensions);
  const riserArea = calculateRiserArea(stairs, dimensions);
  
  return stepArea + riserArea;
}
