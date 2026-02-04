/**
 * Paddling Pool (Brodzik) Surface Foil Planner
 * 
 * Plans foil coverage for paddling pools:
 * - Bottom → anti-slip foil required
 * - External walls (3 sides) → regular foil
 * - Dividing wall (if enabled):
 *   - Pool side: height = poolDepth - paddlingDepth
 *   - Paddling side: height = dividingWallOffset (height above paddling floor)
 *   - Top: horizontal surface (like a step)
 * 
 * Dividing Wall Geometry Example:
 * Pool depth: 1.4m, Paddling depth: 0.4m, Wall offset: 0.2m
 * 
 *                 0m ──────────────────────────────────────
 *                    │                      │ wall top (0.15m wide)
 *               -0.2m├──────────────────────┼───────────────
 *                    │                      │
 *               -0.4m│    PADDLING (0.4m)   │ paddling-side wall (0.2m)
 *          paddling floor ──────────────────┘
 *                    │
 *                    │       MAIN POOL
 *                    │    pool-side wall (1.0m)
 *                    │    = poolDepth - paddlingDepth
 *               -1.4m│
 *           pool floor ──────────────────────────────────────
 */

import { WadingPoolConfig, PoolDimensions } from '@/types/configurator';
import { ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE } from '../foilPlanner';
import { 
  PaddlingPlanResult, 
  DividingWallPlan, 
  ExtendedSurfaceType,
  ExtendedSurfacePlan,
  SURFACE_FOIL_ASSIGNMENT,
  OVERLAP_WALL_TOP,
  OVERLAP_WALL_BOTTOM,
} from './types';

/**
 * Plan foil layout for paddling pool
 * 
 * @param wadingPool Wading pool configuration
 * @param poolDepth Main pool depth
 * @param dimensions Full pool dimensions
 * @returns Paddling pool plan with surfaces
 */
export function planPaddlingPoolSurface(
  wadingPool: WadingPoolConfig,
  poolDepth: number,
  dimensions: PoolDimensions
): PaddlingPlanResult | null {
  if (!wadingPool.enabled) return null;
  
  const { width, length, depth: paddlingDepth, hasDividingWall, dividingWallOffset } = wadingPool;
  
  // Convert dividingWallOffset from cm to m (it's stored as cm)
  const wallOffsetM = (dividingWallOffset || 0) / 100;
  
  // BOTTOM: paddling pool floor (anti-slip)
  const bottomArea = width * length;
  
  // EXTERNAL WALLS (3 sides, regular foil):
  // - 2 walls along the length
  // - 1 wall along the width (opposite to dividing wall)
  const sideWallsArea = 2 * (length * paddlingDepth);
  const backWallArea = width * paddlingDepth;
  const wallsArea = sideWallsArea + backWallArea;
  
  // Create surface plans
  const surfaces: ExtendedSurfacePlan[] = [];
  
  // Bottom surface (anti-slip) - uses STRUCTURAL foil
  const bottomType: ExtendedSurfaceType = 'paddling-bottom';
  surfaces.push({
    type: bottomType,
    width: width,
    length: length,
    area: bottomArea,
    strips: [],
    recommendedRollWidth: ROLL_WIDTH_NARROW,
    foilAssignment: SURFACE_FOIL_ASSIGNMENT[bottomType],
  });
  
  // External walls surface (regular foil) - uses STRUCTURAL foil
  const wallType: ExtendedSurfaceType = 'paddling-wall';
  surfaces.push({
    type: wallType,
    width: paddlingDepth,                // Wall height
    length: 2 * length + width,          // Total perimeter of 3 walls
    area: wallsArea,
    strips: [],
    recommendedRollWidth: paddlingDepth <= 1.4 ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE,
    foilAssignment: SURFACE_FOIL_ASSIGNMENT[wallType],
  });
  
  // DIVIDING WALL (if enabled) - simplified to single inner perimeter strip
  let dividingWall: DividingWallPlan | undefined;
  
  if (hasDividingWall) {
    // New simplified formula:
    // innerPerimeter = 2 × width + 2 × length
    // wallHeight = paddlingDepth - wallOffset (height of wall above paddling floor)
    // stripWidth = wallHeight + OVERLAP_WALL_TOP + OVERLAP_WALL_BOTTOM
    // area = innerPerimeter × stripWidth
    
    const innerPerimeter = 2 * width + 2 * length;
    const wallHeight = paddlingDepth - wallOffsetM;  // e.g., 0.4m - 0.1m = 0.3m
    const stripWidth = wallHeight + OVERLAP_WALL_TOP + OVERLAP_WALL_BOTTOM;  // e.g., 0.3 + 0.07 + 0.07 = 0.44m
    const area = innerPerimeter * stripWidth;  // e.g., 8m × 0.44m = 3.52 m²
    
    dividingWall = {
      innerPerimeter,
      wallHeight,
      stripWidth,
      area,
    };
    
    // Add single dividing wall surface - uses MAIN foil
    const dividingWallType: ExtendedSurfaceType = 'dividing-wall-inner';
    surfaces.push({
      type: dividingWallType,
      width: stripWidth,           // Strip width (height + overlaps)
      length: innerPerimeter,      // Inner perimeter of wading pool
      area: area,
      strips: [],
      recommendedRollWidth: ROLL_WIDTH_NARROW,  // Always narrow for wall strips
      foilAssignment: SURFACE_FOIL_ASSIGNMENT[dividingWallType], // 'main'
    });
  }
  
  return {
    surfaces,
    bottomArea,
    wallsArea,
    dividingWall,
  };
}

/**
 * Calculate total paddling pool foil area
 */
export function calculateTotalPaddlingArea(
  wadingPool: WadingPoolConfig,
  poolDepth: number
): number {
  if (!wadingPool.enabled) return 0;
  
  const plan = planPaddlingPoolSurface(wadingPool, poolDepth, {} as PoolDimensions);
  if (!plan) return 0;
  
  let totalArea = plan.bottomArea + plan.wallsArea;
  
  if (plan.dividingWall) {
    totalArea += plan.dividingWall.area;  // Simplified: single area value
  }
  
  return totalArea;
}
