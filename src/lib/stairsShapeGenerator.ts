/**
 * Stair Shape Generator
 * 
 * Generates vertices and step lines for stair shape types:
 * - Rectangular: 4 vertices, steps perpendicular to entry direction
 * - Diagonal 45°: 3 vertices (isosceles right triangle)
 */

import { Point, StairsShapeType, StairsConfig } from '@/types/configurator';

export interface StepLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StairsGeometry {
  vertices: Point[];
  stepLines: StepLine[];
  totalPathLength: number;
}

/**
 * Get the corner position for a rectangular pool based on corner index
 */
export function getPoolCornerPosition(
  length: number,
  width: number,
  cornerIndex: number
): Point {
  const halfL = length / 2;
  const halfW = width / 2;
  
  // For rectangular pool: A=back-left, B=back-right, C=front-right, D=front-left
  switch (cornerIndex % 4) {
    case 0: return { x: -halfL, y: -halfW }; // A (back-left)
    case 1: return { x: halfL, y: -halfW };  // B (back-right)
    case 2: return { x: halfL, y: halfW };   // C (front-right)
    case 3: return { x: -halfL, y: halfW };  // D (front-left)
    default: return { x: -halfL, y: -halfW };
  }
}

/**
 * Get inward direction vectors for a corner (pointing into the pool)
 */
export function getInwardDirections(cornerIndex: number): { dx1: number; dy1: number; dx2: number; dy2: number } {
  // Returns two unit vectors pointing inward from the corner
  switch (cornerIndex % 4) {
    case 0: return { dx1: 1, dy1: 0, dx2: 0, dy2: 1 };  // A: right & down
    case 1: return { dx1: -1, dy1: 0, dx2: 0, dy2: 1 }; // B: left & down
    case 2: return { dx1: -1, dy1: 0, dx2: 0, dy2: -1 }; // C: left & up
    case 3: return { dx1: 1, dy1: 0, dx2: 0, dy2: -1 };  // D: right & up
    default: return { dx1: 1, dy1: 0, dx2: 0, dy2: 1 };
  }
}

/**
 * Generate rectangular stairs geometry
 * Direction parameter determines which wall the stairs WIDTH runs parallel to:
 * - 'along-length': stairs width is parallel to the pool's length axis (A-B or C-D walls)
 *                   steps extend perpendicular into the pool
 * - 'along-width': stairs width is parallel to the pool's width axis (A-D or B-C walls)
 *                  steps extend perpendicular into the pool
 */
export function generateRectangularStairs(
  cornerPos: Point,
  cornerIndex: number,
  stairsWidth: number,
  stepCount: number,
  stepDepth: number,
  direction: 'along-length' | 'along-width' = 'along-width'
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = getInwardDirections(cornerIndex);
  const stairsLength = stepCount * stepDepth;
  
  // Inward directions from getInwardDirections:
  // Corner A (0, back-left): dx1=1 (right), dx2=1 (down) - adjacent walls are A-B (right) and A-D (down)
  // Corner B (1, back-right): dx1=-1 (left), dx2=1 (down) - adjacent walls are A-B (left) and B-C (down)
  // Corner C (2, front-right): dx1=-1 (left), dx2=-1 (up) - adjacent walls are C-D (left) and B-C (up)
  // Corner D (3, front-left): dx1=1 (right), dx2=-1 (up) - adjacent walls are C-D (right) and A-D (up)
  
  // The direction defines which wall the stair WIDTH is parallel to:
  // - along-length: width parallel to horizontal walls (A-B, C-D) → use dx1 for width, dx2 for depth
  // - along-width: width parallel to vertical walls (A-D, B-C) → use dx2 for width, dx1 for depth
  
  let widthDx: number, widthDy: number;  // Direction for stair width (parallel to selected wall)
  let lengthDx: number, lengthDy: number; // Direction for stair length/depth (into pool)
  
  if (direction === 'along-length') {
    // Stairs width runs along horizontal walls (A-B, C-D)
    // Width uses dx1 direction (horizontal), depth uses dx2 direction (vertical into pool)
    widthDx = dx1;
    widthDy = dy1;
    lengthDx = dx2;
    lengthDy = dy2;
  } else {
    // Default: Stairs width runs along vertical walls (A-D, B-C)
    // Width uses dx2 direction (vertical), depth uses dx1 direction (horizontal into pool)
    widthDx = dx2;
    widthDy = dy2;
    lengthDx = dx1;
    lengthDy = dy1;
  }
  
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },
    { x: cornerPos.x + widthDx * stairsWidth, y: cornerPos.y + widthDy * stairsWidth },
    { x: cornerPos.x + widthDx * stairsWidth + lengthDx * stairsLength, y: cornerPos.y + widthDy * stairsWidth + lengthDy * stairsLength },
    { x: cornerPos.x + lengthDx * stairsLength, y: cornerPos.y + lengthDy * stairsLength },
  ];
  
  // Step lines perpendicular to entry direction (parallel to width direction)
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i * stepDepth;
    stepLines.push({
      x1: cornerPos.x + lengthDx * progress,
      y1: cornerPos.y + lengthDy * progress,
      x2: cornerPos.x + widthDx * stairsWidth + lengthDx * progress,
      y2: cornerPos.y + widthDy * stairsWidth + lengthDy * progress,
    });
  }
  
  return { vertices, stepLines, totalPathLength: stairsLength };
}

/**
 * Generate diagonal 45° stairs geometry (isosceles right triangle)
 * Two sides lie along the pool walls, the hypotenuse faces the pool interior.
 * Steps run parallel to the hypotenuse (the diagonal line).
 */
export function generateDiagonal45Stairs(
  cornerPos: Point,
  cornerIndex: number,
  stepCount: number,
  stepDepth: number
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = getInwardDirections(cornerIndex);
  const diagonalSize = stepCount * stepDepth;
  
  // Triangle vertices: corner + two points along the pool walls
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },  // Pool corner
    { x: cornerPos.x + dx1 * diagonalSize, y: cornerPos.y + dy1 * diagonalSize },  // Along wall 1
    { x: cornerPos.x + dx2 * diagonalSize, y: cornerPos.y + dy2 * diagonalSize },  // Along wall 2
  ];
  
  // Step lines parallel to hypotenuse (from wall 1 vertex toward wall 2 vertex)
  // Each step is at a certain distance from the corner
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i / stepCount;
    // Points along each wall edge at progress distance from corner
    const p1x = cornerPos.x + dx1 * diagonalSize * progress;
    const p1y = cornerPos.y + dy1 * diagonalSize * progress;
    const p2x = cornerPos.x + dx2 * diagonalSize * progress;
    const p2y = cornerPos.y + dy2 * diagonalSize * progress;
    
    stepLines.push({ x1: p1x, y1: p1y, x2: p2x, y2: p2y });
  }
  
  return { vertices, stepLines, totalPathLength: diagonalSize * Math.SQRT2 };
}

/**
 * Main generator function - dispatches to specific shape generators
 * 
 * For cornerIndex >= 4, these are wading pool intersection points (E, F) 
 * and need special handling. The actual position will be passed via stairs.vertices
 * or calculated from wading pool config.
 */
export function generateStairsGeometry(
  length: number,
  width: number,
  stairs: StairsConfig,
  wadingPoolPosition?: Point,  // Optional: custom position for wading pool intersection points
  wadingPoolConfig?: { cornerIndex: number; direction: 'along-length' | 'along-width' } // Wading pool configuration
): StairsGeometry | null {
  if (!stairs.enabled) return null;
  
  const shapeType = stairs.shapeType || 'rectangular';
  const cornerIndex = stairs.cornerIndex ?? 0;
  
  // For wading pool intersection points (E=4, F=5), use custom position if provided
  // Otherwise fall back to pool corner position (which will be wrong but at least renders)
  let cornerPos: Point;
  if (cornerIndex >= 4 && wadingPoolPosition) {
    cornerPos = wadingPoolPosition;
  } else {
    cornerPos = getPoolCornerPosition(length, width, cornerIndex);
  }
  
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  
  const direction = stairs.direction || 'along-width';
  
  // For wading pool intersection points (E/F), use special direction calculation
  if (cornerIndex >= 4 && wadingPoolConfig) {
    const isPointE = cornerIndex === 4;
    const inwardDirs = getInwardDirectionsForWadingIntersection(
      wadingPoolConfig.cornerIndex,
      isPointE,
      wadingPoolConfig.direction,
      direction
    );
    
    switch (shapeType) {
      case 'rectangular':
        return generateRectangularStairsWithDirections(
          cornerPos, inwardDirs, stairsWidth, stepCount, stepDepth, direction
        );
      
      case 'diagonal-45':
        return generateDiagonal45StairsWithDirections(
          cornerPos, inwardDirs, stepCount, stepDepth
        );
      
      default:
        return generateRectangularStairsWithDirections(
          cornerPos, inwardDirs, stairsWidth, stepCount, stepDepth, direction
        );
    }
  }
  
  // For standard corners (A, B, C, D), use original logic
  switch (shapeType) {
    case 'rectangular':
      return generateRectangularStairs(cornerPos, cornerIndex, stairsWidth, stepCount, stepDepth, direction);
    
    case 'diagonal-45':
      return generateDiagonal45Stairs(cornerPos, cornerIndex, stepCount, stepDepth);
    
    default:
      return generateRectangularStairs(cornerPos, cornerIndex, stairsWidth, stepCount, stepDepth, direction);
  }
}

/**
 * Get inward directions for wading pool intersection points (E=4, F=5)
 * These points are on the pool walls, so we need directions that:
 * 1. Go INTO the main pool (not into the wading pool or outside)
 * 2. For rectangular stairs: allow choosing parallel to wading pool edge or pool wall
 * 3. For diagonal 45° stairs: always face the pool interior
 */
function getInwardDirectionsForWadingIntersection(
  wadingCornerIndex: number,  // The corner where wading pool is placed (0-3)
  isPointE: boolean,          // true for E (index 4), false for F (index 5)
  wadingDirection: 'along-length' | 'along-width',
  stairsDirection: 'along-length' | 'along-width'
): { dx1: number; dy1: number; dx2: number; dy2: number } {
  // E and F are on different walls depending on wading pool configuration
  // For each point, determine which direction goes INTO the main pool
  
  // The key insight:
  // - Point E is at the end of wading pool's "width" axis
  // - Point F is at the end of wading pool's "length" axis (depth into pool)
  
  // We need to return inward directions such that:
  // - dx1/dy1 is along the pool wall (for stair width)
  // - dx2/dy2 is perpendicular into the pool (for stair depth/descent)
  
  switch (wadingCornerIndex) {
    case 0: // Wading at Corner A (back-left)
      if (wadingDirection === 'along-length') {
        // E on back wall (x = -halfL + wadingWidth, y = -halfW)
        // F on left wall (x = -halfL, y = -halfW + wadingLength)
        if (isPointE) {
          // E: stairs go into pool (positive Y) or along back wall (positive X)
          return stairsDirection === 'along-length'
            ? { dx1: 1, dy1: 0, dx2: 0, dy2: 1 }  // Width along X+, depth along Y+
            : { dx1: 0, dy1: 1, dx2: 1, dy2: 0 }; // Width along Y+, depth along X+
        } else {
          // F: stairs go into pool (positive X) or along left wall (positive Y)
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: 1, dx2: 1, dy2: 0 }  // Width along Y+, depth along X+
            : { dx1: 1, dy1: 0, dx2: 0, dy2: 1 }; // Width along X+, depth along Y+
        }
      } else {
        // E on left wall, F on back wall
        if (isPointE) {
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: 1, dx2: 1, dy2: 0 }
            : { dx1: 1, dy1: 0, dx2: 0, dy2: 1 };
        } else {
          return stairsDirection === 'along-length'
            ? { dx1: 1, dy1: 0, dx2: 0, dy2: 1 }
            : { dx1: 0, dy1: 1, dx2: 1, dy2: 0 };
        }
      }
      
    case 1: // Wading at Corner B (back-right)
      if (wadingDirection === 'along-length') {
        if (isPointE) {
          // E on back wall: go into pool (Y+) or along wall (X-)
          return stairsDirection === 'along-length'
            ? { dx1: -1, dy1: 0, dx2: 0, dy2: 1 }
            : { dx1: 0, dy1: 1, dx2: -1, dy2: 0 };
        } else {
          // F on right wall: go into pool (X-) or along wall (Y+)
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: 1, dx2: -1, dy2: 0 }
            : { dx1: -1, dy1: 0, dx2: 0, dy2: 1 };
        }
      } else {
        if (isPointE) {
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: 1, dx2: -1, dy2: 0 }
            : { dx1: -1, dy1: 0, dx2: 0, dy2: 1 };
        } else {
          return stairsDirection === 'along-length'
            ? { dx1: -1, dy1: 0, dx2: 0, dy2: 1 }
            : { dx1: 0, dy1: 1, dx2: -1, dy2: 0 };
        }
      }
      
    case 2: // Wading at Corner C (front-right)
      if (wadingDirection === 'along-length') {
        if (isPointE) {
          // E on front wall: go into pool (Y-) or along wall (X-)
          return stairsDirection === 'along-length'
            ? { dx1: -1, dy1: 0, dx2: 0, dy2: -1 }
            : { dx1: 0, dy1: -1, dx2: -1, dy2: 0 };
        } else {
          // F on right wall: go into pool (X-) or along wall (Y-)
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: -1, dx2: -1, dy2: 0 }
            : { dx1: -1, dy1: 0, dx2: 0, dy2: -1 };
        }
      } else {
        if (isPointE) {
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: -1, dx2: -1, dy2: 0 }
            : { dx1: -1, dy1: 0, dx2: 0, dy2: -1 };
        } else {
          return stairsDirection === 'along-length'
            ? { dx1: -1, dy1: 0, dx2: 0, dy2: -1 }
            : { dx1: 0, dy1: -1, dx2: -1, dy2: 0 };
        }
      }
      
    case 3: // Wading at Corner D (front-left)
      if (wadingDirection === 'along-length') {
        if (isPointE) {
          // E on front wall: go into pool (Y-) or along wall (X+)
          return stairsDirection === 'along-length'
            ? { dx1: 1, dy1: 0, dx2: 0, dy2: -1 }
            : { dx1: 0, dy1: -1, dx2: 1, dy2: 0 };
        } else {
          // F on left wall: go into pool (X+) or along wall (Y-)
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: -1, dx2: 1, dy2: 0 }
            : { dx1: 1, dy1: 0, dx2: 0, dy2: -1 };
        }
      } else {
        if (isPointE) {
          return stairsDirection === 'along-width'
            ? { dx1: 0, dy1: -1, dx2: 1, dy2: 0 }
            : { dx1: 1, dy1: 0, dx2: 0, dy2: -1 };
        } else {
          return stairsDirection === 'along-length'
            ? { dx1: 1, dy1: 0, dx2: 0, dy2: -1 }
            : { dx1: 0, dy1: -1, dx2: 1, dy2: 0 };
        }
      }
      
    default:
      return { dx1: 1, dy1: 0, dx2: 0, dy2: 1 };
  }
}

/**
 * Generate rectangular stairs with explicit direction vectors (for wading pool intersection points)
 */
function generateRectangularStairsWithDirections(
  cornerPos: Point,
  directions: { dx1: number; dy1: number; dx2: number; dy2: number },
  stairsWidth: number,
  stepCount: number,
  stepDepth: number,
  stairsDirection: 'along-length' | 'along-width'
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = directions;
  const stairsLength = stepCount * stepDepth;
  
  // For wading pool intersection points, dx1/dy1 is width direction, dx2/dy2 is depth direction
  // The stairsDirection affects how we interpret the directions from the wading intersection function
  let widthDx: number, widthDy: number;
  let lengthDx: number, lengthDy: number;
  
  if (stairsDirection === 'along-length') {
    widthDx = dx1;
    widthDy = dy1;
    lengthDx = dx2;
    lengthDy = dy2;
  } else {
    widthDx = dx2;
    widthDy = dy2;
    lengthDx = dx1;
    lengthDy = dy1;
  }
  
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },
    { x: cornerPos.x + widthDx * stairsWidth, y: cornerPos.y + widthDy * stairsWidth },
    { x: cornerPos.x + widthDx * stairsWidth + lengthDx * stairsLength, y: cornerPos.y + widthDy * stairsWidth + lengthDy * stairsLength },
    { x: cornerPos.x + lengthDx * stairsLength, y: cornerPos.y + lengthDy * stairsLength },
  ];
  
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i * stepDepth;
    stepLines.push({
      x1: cornerPos.x + lengthDx * progress,
      y1: cornerPos.y + lengthDy * progress,
      x2: cornerPos.x + widthDx * stairsWidth + lengthDx * progress,
      y2: cornerPos.y + widthDy * stairsWidth + lengthDy * progress,
    });
  }
  
  return { vertices, stepLines, totalPathLength: stairsLength };
}

/**
 * Generate diagonal 45° stairs with explicit direction vectors (for wading pool intersection points)
 */
function generateDiagonal45StairsWithDirections(
  cornerPos: Point,
  directions: { dx1: number; dy1: number; dx2: number; dy2: number },
  stepCount: number,
  stepDepth: number
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = directions;
  const diagonalSize = stepCount * stepDepth;
  
  // Triangle vertices: corner + two points along the inward directions
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },  // Intersection point
    { x: cornerPos.x + dx1 * diagonalSize, y: cornerPos.y + dy1 * diagonalSize },  // Along direction 1
    { x: cornerPos.x + dx2 * diagonalSize, y: cornerPos.y + dy2 * diagonalSize },  // Along direction 2
  ];
  
  // Step lines parallel to hypotenuse
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i / stepCount;
    const p1x = cornerPos.x + dx1 * diagonalSize * progress;
    const p1y = cornerPos.y + dy1 * diagonalSize * progress;
    const p2x = cornerPos.x + dx2 * diagonalSize * progress;
    const p2y = cornerPos.y + dy2 * diagonalSize * progress;
    
    stepLines.push({ x1: p1x, y1: p1y, x2: p2x, y2: p2y });
  }
  
  return { vertices, stepLines, totalPathLength: diagonalSize * Math.SQRT2 };
}

/**
 * Generate rectangular stairs from a specific position (not necessarily a pool corner)
 */
function generateRectangularStairsFromPosition(
  cornerPos: Point,
  cornerIndex: number,
  stairsWidth: number,
  stepCount: number,
  stepDepth: number,
  direction: 'along-length' | 'along-width'
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = getInwardDirections(cornerIndex);
  const stairsLength = stepCount * stepDepth;
  
  let widthDx: number, widthDy: number;
  let lengthDx: number, lengthDy: number;
  
  if (direction === 'along-length') {
    widthDx = dx1;
    widthDy = dy1;
    lengthDx = dx2;
    lengthDy = dy2;
  } else {
    widthDx = dx2;
    widthDy = dy2;
    lengthDx = dx1;
    lengthDy = dy1;
  }
  
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },
    { x: cornerPos.x + widthDx * stairsWidth, y: cornerPos.y + widthDy * stairsWidth },
    { x: cornerPos.x + widthDx * stairsWidth + lengthDx * stairsLength, y: cornerPos.y + widthDy * stairsWidth + lengthDy * stairsLength },
    { x: cornerPos.x + lengthDx * stairsLength, y: cornerPos.y + lengthDy * stairsLength },
  ];
  
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i * stepDepth;
    stepLines.push({
      x1: cornerPos.x + lengthDx * progress,
      y1: cornerPos.y + lengthDy * progress,
      x2: cornerPos.x + widthDx * stairsWidth + lengthDx * progress,
      y2: cornerPos.y + widthDy * stairsWidth + lengthDy * progress,
    });
  }
  
  return { vertices, stepLines, totalPathLength: stairsLength };
}

/**
 * Calculate stairs area from vertices
 */
export function calculateStairsArea(vertices: Point[]): number {
  if (vertices.length < 3) return 0;
  
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Check if a point is inside the stairs polygon
 */
export function isPointInStairs(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}
