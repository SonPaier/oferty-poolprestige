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
 */
export function generateRectangularStairs(
  cornerPos: Point,
  cornerIndex: number,
  stairsWidth: number,
  stepCount: number,
  stepDepth: number
): StairsGeometry {
  const { dx1, dy1, dx2, dy2 } = getInwardDirections(cornerIndex);
  const stairsLength = stepCount * stepDepth;
  
  // Primary direction is along the wall (dx2, dy2), secondary is into pool (dx1, dy1)
  const vertices: Point[] = [
    { x: cornerPos.x, y: cornerPos.y },
    { x: cornerPos.x + dx2 * stairsWidth, y: cornerPos.y + dy2 * stairsWidth },
    { x: cornerPos.x + dx2 * stairsWidth + dx1 * stairsLength, y: cornerPos.y + dy2 * stairsWidth + dy1 * stairsLength },
    { x: cornerPos.x + dx1 * stairsLength, y: cornerPos.y + dy1 * stairsLength },
  ];
  
  // Step lines perpendicular to entry direction
  const stepLines: StepLine[] = [];
  for (let i = 1; i < stepCount; i++) {
    const progress = i * stepDepth;
    stepLines.push({
      x1: cornerPos.x + dx1 * progress,
      y1: cornerPos.y + dy1 * progress,
      x2: cornerPos.x + dx2 * stairsWidth + dx1 * progress,
      y2: cornerPos.y + dy2 * stairsWidth + dy1 * progress,
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
 */
export function generateStairsGeometry(
  length: number,
  width: number,
  stairs: StairsConfig
): StairsGeometry | null {
  if (!stairs.enabled) return null;
  
  const shapeType = stairs.shapeType || 'rectangular';
  const cornerIndex = stairs.cornerIndex ?? 0;
  const cornerPos = getPoolCornerPosition(length, width, cornerIndex);
  
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  
  switch (shapeType) {
    case 'rectangular':
      return generateRectangularStairs(cornerPos, cornerIndex, stairsWidth, stepCount, stepDepth);
    
    case 'diagonal-45':
      return generateDiagonal45Stairs(cornerPos, cornerIndex, stepCount, stepDepth);
    
    default:
      return generateRectangularStairs(cornerPos, cornerIndex, stairsWidth, stepCount, stepDepth);
  }
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
