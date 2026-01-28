/**
 * Geometry constraints utilities for pool drawer
 * Prevents stairs/wading pool from being drawn outside pool boundaries
 * and from overlapping each other.
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInsidePolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Check if a point is on or very close to a polygon edge
 */
export function isPointOnPolygonEdge(point: Point, polygon: Point[], tolerance: number = 0.05): boolean {
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = polygon[i];
    const p2 = polygon[j];
    
    // Calculate distance from point to line segment
    const dist = distanceToLineSegment(point, p1, p2);
    if (dist <= tolerance) return true;
  }
  
  return false;
}

/**
 * Calculate distance from a point to a line segment
 */
function distanceToLineSegment(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // p1 and p2 are the same point
    return Math.sqrt(Math.pow(point.x - p1.x, 2) + Math.pow(point.y - p1.y, 2));
  }
  
  // Calculate projection of point onto line
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  
  return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2));
}

/**
 * Check if a point is inside or on the edge of a polygon
 */
export function isPointInsideOrOnPolygon(point: Point, polygon: Point[], tolerance: number = 0.05): boolean {
  return isPointInsidePolygon(point, polygon) || isPointOnPolygonEdge(point, polygon, tolerance);
}

/**
 * Check if all vertices of a polygon are inside another polygon
 */
export function isPolygonInsidePolygon(inner: Point[], outer: Point[], tolerance: number = 0.05): boolean {
  if (inner.length < 3 || outer.length < 3) return false;
  
  return inner.every(point => isPointInsideOrOnPolygon(point, outer, tolerance));
}

/**
 * Calculate polygon area using Shoelace formula
 */
function calculatePolygonArea(polygon: Point[]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Calculate polygon centroid
 */
export function getPolygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
  return { x: cx, y: cy };
}

/**
 * Check if two line segments intersect (excluding endpoints)
 */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  
  return false;
}

function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * Check if two polygons overlap (share any interior area)
 */
export function doPolygonsOverlap(poly1: Point[], poly2: Point[]): boolean {
  if (poly1.length < 3 || poly2.length < 3) return false;
  
  // Check if any vertex of poly1 is inside poly2
  for (const point of poly1) {
    if (isPointInsidePolygon(point, poly2)) return true;
  }
  
  // Check if any vertex of poly2 is inside poly1
  for (const point of poly2) {
    if (isPointInsidePolygon(point, poly1)) return true;
  }
  
  // Check if any edges intersect
  for (let i = 0; i < poly1.length; i++) {
    const j = (i + 1) % poly1.length;
    for (let k = 0; k < poly2.length; k++) {
      const l = (k + 1) % poly2.length;
      if (segmentsIntersect(poly1[i], poly1[j], poly2[k], poly2[l])) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate overlap area between two polygons using Sutherland-Hodgman clipping
 * Returns approximate overlap area (simplified approach)
 */
export function calculateOverlapArea(poly1: Point[], poly2: Point[]): number {
  if (!doPolygonsOverlap(poly1, poly2)) return 0;
  
  // Simplified: count vertices of one polygon inside the other
  // This is an approximation - for precise calculation we'd need polygon clipping
  const clipped = clipPolygon(poly1, poly2);
  return calculatePolygonArea(clipped);
}

/**
 * Sutherland-Hodgman polygon clipping algorithm
 */
function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  let output = [...subject];
  
  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) break;
    
    const input = output;
    output = [];
    
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];
    
    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const next = input[(j + 1) % input.length];
      
      const currentInside = isLeft(edgeStart, edgeEnd, current) >= 0;
      const nextInside = isLeft(edgeStart, edgeEnd, next) >= 0;
      
      if (currentInside) {
        output.push(current);
        if (!nextInside) {
          const intersection = lineIntersection(edgeStart, edgeEnd, current, next);
          if (intersection) output.push(intersection);
        }
      } else if (nextInside) {
        const intersection = lineIntersection(edgeStart, edgeEnd, current, next);
        if (intersection) output.push(intersection);
      }
    }
  }
  
  return output;
}

function isLeft(p0: Point, p1: Point, p2: Point): number {
  return (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 0.0001) return null;
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
}

/**
 * Validation result for a new vertex or polygon position
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a new vertex position keeps the element inside the pool
 */
export function validateVertexPosition(
  newVertex: Point,
  poolVertices: Point[],
  elementType: 'stairs' | 'wadingPool'
): ValidationResult {
  if (poolVertices.length < 3) {
    return { valid: false, error: 'Najpierw narysuj kształt basenu' };
  }
  
  // Check if the new vertex is inside or on the pool boundary
  if (!isPointInsideOrOnPolygon(newVertex, poolVertices, 0.05)) {
    const label = elementType === 'stairs' ? 'Schody' : 'Brodzik';
    return { 
      valid: false, 
      error: `${label} muszą znajdować się wewnątrz basenu` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate that a polygon (stairs or wading pool) stays inside the pool
 */
export function validatePolygonInPool(
  polygon: Point[],
  poolVertices: Point[],
  elementType: 'stairs' | 'wadingPool'
): ValidationResult {
  if (poolVertices.length < 3) {
    return { valid: false, error: 'Najpierw narysuj kształt basenu' };
  }
  
  if (polygon.length < 3) {
    return { valid: true }; // Not enough vertices yet
  }
  
  // Check if all vertices are inside or on the pool boundary
  for (const vertex of polygon) {
    if (!isPointInsideOrOnPolygon(vertex, poolVertices, 0.05)) {
      const label = elementType === 'stairs' ? 'Schody' : 'Brodzik';
      return { 
        valid: false, 
        error: `${label} wykraczają poza granice basenu` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate that stairs and wading pool don't overlap
 */
export function validateNoOverlap(
  stairsVertices: Point[],
  wadingPoolVertices: Point[]
): ValidationResult {
  if (stairsVertices.length < 3 || wadingPoolVertices.length < 3) {
    return { valid: true }; // Can't overlap if not complete
  }
  
  if (doPolygonsOverlap(stairsVertices, wadingPoolVertices)) {
    return { 
      valid: false, 
      error: 'Schody i brodzik nie mogą na siebie nachodzić' 
    };
  }
  
  return { valid: true };
}

/**
 * Full validation for element placement
 */
export function validateElementPlacement(
  element: Point[],
  elementType: 'stairs' | 'wadingPool',
  poolVertices: Point[],
  otherElement: Point[]
): ValidationResult {
  // Check if inside pool
  const inPoolResult = validatePolygonInPool(element, poolVertices, elementType);
  if (!inPoolResult.valid) return inPoolResult;
  
  // Check no overlap with other element
  const otherType = elementType === 'stairs' ? 'wadingPool' : 'stairs';
  if (otherElement.length >= 3 && element.length >= 3) {
    const overlapResult = validateNoOverlap(
      elementType === 'stairs' ? element : otherElement,
      elementType === 'wadingPool' ? element : otherElement
    );
    if (!overlapResult.valid) return overlapResult;
  }
  
  return { valid: true };
}

/**
 * Constrain a point to be inside a polygon
 * If the point is outside, find the closest point on the polygon boundary
 */
export function constrainPointToPolygon(point: Point, polygon: Point[]): Point {
  if (polygon.length < 3) return point;
  
  // If already inside, return as-is
  if (isPointInsideOrOnPolygon(point, polygon, 0.01)) {
    return point;
  }
  
  // Find closest point on polygon boundary
  let minDist = Infinity;
  let closestPoint = point;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p1 = polygon[i];
    const p2 = polygon[j];
    
    const closest = closestPointOnSegment(point, p1, p2);
    const dist = Math.sqrt(Math.pow(point.x - closest.x, 2) + Math.pow(point.y - closest.y, 2));
    
    if (dist < minDist) {
      minDist = dist;
      closestPoint = closest;
    }
  }
  
  // Move slightly inside the polygon
  const centroid = getPolygonCentroid(polygon);
  const dx = centroid.x - closestPoint.x;
  const dy = centroid.y - closestPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len > 0) {
    // Move 5cm inside from the edge
    const insetDist = 0.05;
    return {
      x: closestPoint.x + (dx / len) * insetDist,
      y: closestPoint.y + (dy / len) * insetDist
    };
  }
  
  return closestPoint;
}

function closestPointOnSegment(point: Point, p1: Point, p2: Point): Point {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) return p1;
  
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy
  };
}
