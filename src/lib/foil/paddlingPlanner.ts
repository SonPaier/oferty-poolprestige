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
  DIVIDING_WALL_THICKNESS 
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
  
  // Bottom surface (anti-slip)
  surfaces.push({
    type: 'paddling-bottom' as ExtendedSurfaceType,
    width: width,
    length: length,
    area: bottomArea,
    strips: [],
    recommendedRollWidth: ROLL_WIDTH_NARROW,
  });
  
  // External walls surface (regular foil)
  surfaces.push({
    type: 'paddling-wall' as ExtendedSurfaceType,
    width: paddlingDepth,                // Wall height
    length: 2 * length + width,          // Total perimeter of 3 walls
    area: wallsArea,
    strips: [],
    recommendedRollWidth: paddlingDepth <= 1.4 ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE,
  });
  
  // DIVIDING WALL (if enabled)
  let dividingWall: DividingWallPlan | undefined;
  
  if (hasDividingWall) {
    // Pool side height: from pool floor to wall top
    // = poolDepth - paddlingDepth (since wall top is at paddlingDepth - wallOffset from water surface)
    // Actually: wall top is at depth (paddlingDepth - wallOffset)
    // Pool side height = poolDepth - (paddlingDepth - wallOffset) = poolDepth - paddlingDepth + wallOffset
    // Wait, let me recalculate based on the user's example:
    // Pool 1.4m, paddling 0.4m, wall offset 0.2m
    // Pool side: 1.4 - 0.4 = 1.0m (from pool floor at -1.4m to wall top at -0.2m... no that's 1.2m)
    // 
    // Let me re-read the user's specification:
    // "od strony basenu mur brodzika będzie miał 1.2m wysokości" - but they said 1.0m in the plan
    // 
    // Actually user said: "głębokość_basenu - głębokość_brodzika = 1.4m - 0.4m = 1.0m"
    // So pool side height = poolDepth - paddlingDepth (NOT including wallOffset)
    // The wall top is at -0.2m (paddlingDepth - wallOffset = 0.4 - 0.2 = 0.2m from surface)
    // The pool floor is at -1.4m
    // So the wall height on pool side = 1.4 - 0.2 = 1.2m
    // 
    // But user's calculation says 1.0m... Let me check the ASCII diagram:
    // "ściana podniesiona 1.0m (od strony basenu) (1.4m - 0.4m = 1.0m)"
    // 
    // I think the user means the wall goes from pool floor to paddling floor level,
    // not to the wall top. The wall offset is ABOVE the paddling floor.
    // So: pool side = poolDepth - paddlingDepth (wall from pool floor to paddling floor)
    //     paddling side = wallOffset (wall from paddling floor to wall top)
    //     top = horizontal surface of wall
    
    const poolSideHeight = poolDepth - paddlingDepth;  // From pool floor to paddling floor level
    const paddlingSideHeight = wallOffsetM;            // From paddling floor to wall top
    const wallThickness = DIVIDING_WALL_THICKNESS;     // 15cm
    
    // Areas
    const poolSideArea = width * poolSideHeight;
    const paddlingSideArea = width * paddlingSideHeight;
    const topArea = width * wallThickness;
    
    dividingWall = {
      poolSideArea,
      paddlingSideArea,
      topArea,
      poolSideHeight,
      paddlingSideHeight,
      wallWidth: width,
      wallThickness,
    };
    
    // Add dividing wall surfaces
    
    // Pool side of dividing wall (regular foil)
    surfaces.push({
      type: 'dividing-wall-pool' as ExtendedSurfaceType,
      width: poolSideHeight,
      length: width,
      area: poolSideArea,
      strips: [],
      recommendedRollWidth: poolSideHeight <= 1.4 ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE,
    });
    
    // Paddling side of dividing wall (regular foil)
    if (paddlingSideHeight > 0) {
      surfaces.push({
        type: 'dividing-wall-paddling' as ExtendedSurfaceType,
        width: paddlingSideHeight,
        length: width,
        area: paddlingSideArea,
        strips: [],
        recommendedRollWidth: ROLL_WIDTH_NARROW, // Usually small height
      });
    }
    
    // Top of dividing wall (horizontal, regular foil - like a step)
    surfaces.push({
      type: 'dividing-wall-top' as ExtendedSurfaceType,
      width: wallThickness,
      length: width,
      area: topArea,
      strips: [],
      recommendedRollWidth: ROLL_WIDTH_NARROW,
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
    totalArea += plan.dividingWall.poolSideArea;
    totalArea += plan.dividingWall.paddlingSideArea;
    totalArea += plan.dividingWall.topArea;
  }
  
  return totalArea;
}
