/**
 * Scalene Triangle Stairs Geometry
 * 
 * For triangular stairs with unequal arms:
 * 1. Descent direction is automatically perpendicular to the longest edge (base)
 * 2. Steps are expanding trapezoids - depth grows from narrow to wide end
 */

export interface Point {
  x: number;
  y: number;
}

export interface TriangleGeometry {
  // The three vertices
  vertices: Point[];
  // Longest edge (base) - where steps are parallel to
  longestEdge: {
    startIndex: number;
    endIndex: number;
    start: Point;
    end: Point;
    length: number;
  };
  // The vertex opposite to the longest edge (apex/narrow end)
  oppositeVertex: Point;
  oppositeVertexIndex: number;
  // The two legs connecting apex to base
  leftLeg: { length: number; start: Point; end: Point };
  rightLeg: { length: number; start: Point; end: Point };
  // Height from apex to base (perpendicular distance)
  height: number;
  // Is this a scalene triangle (unequal legs)?
  isScalene: boolean;
}

export interface TrapezoidStep {
  position: number; // Distance from apex along height
  depth: number; // Depth of this step (varies)
  widthStart: number; // Width at start of step
  widthEnd: number; // Width at end of step
}

/**
 * Calculate distance between two points
 */
function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  
  if (lineLength === 0) return distance(point, lineStart);
  
  // Perpendicular distance = |cross product| / |line length|
  const cross = Math.abs((point.x - lineStart.x) * dy - (point.y - lineStart.y) * dx);
  return cross / lineLength;
}

/**
 * Analyze triangle geometry to identify longest edge, apex, and legs
 */
export function analyzeTriangleGeometry(vertices: Point[]): TriangleGeometry | null {
  if (vertices.length !== 3) return null;
  
  // Calculate all three edge lengths
  const edges = [
    { startIndex: 0, endIndex: 1, length: distance(vertices[0], vertices[1]) },
    { startIndex: 1, endIndex: 2, length: distance(vertices[1], vertices[2]) },
    { startIndex: 2, endIndex: 0, length: distance(vertices[2], vertices[0]) },
  ];
  
  // Find longest edge (base)
  const longestEdge = edges.reduce((max, edge) => 
    edge.length > max.length ? edge : max, edges[0]);
  
  const longestEdgeData = {
    startIndex: longestEdge.startIndex,
    endIndex: longestEdge.endIndex,
    start: vertices[longestEdge.startIndex],
    end: vertices[longestEdge.endIndex],
    length: longestEdge.length,
  };
  
  // Find opposite vertex (apex) - the one not on the longest edge
  const oppositeVertexIndex = [0, 1, 2].find(
    i => i !== longestEdge.startIndex && i !== longestEdge.endIndex
  )!;
  const oppositeVertex = vertices[oppositeVertexIndex];
  
  // Calculate height (perpendicular distance from apex to base)
  const height = pointToLineDistance(
    oppositeVertex, 
    longestEdgeData.start, 
    longestEdgeData.end
  );
  
  // Find the two legs (edges connecting apex to base vertices)
  const leftLegLength = distance(oppositeVertex, longestEdgeData.start);
  const rightLegLength = distance(oppositeVertex, longestEdgeData.end);
  
  const leftLeg = {
    length: leftLegLength,
    start: oppositeVertex,
    end: longestEdgeData.start,
  };
  
  const rightLeg = {
    length: rightLegLength,
    start: oppositeVertex,
    end: longestEdgeData.end,
  };
  
  // Determine if scalene (unequal legs) - threshold of 10cm difference
  const isScalene = Math.abs(leftLegLength - rightLegLength) > 0.1;
  
  return {
    vertices,
    longestEdge: longestEdgeData,
    oppositeVertex,
    oppositeVertexIndex,
    leftLeg,
    rightLeg,
    height,
    isScalene,
  };
}

/**
 * Calculate step positions with variable depth (expanding trapezoids)
 * Depth increases from narrow apex to wide base
 */
export function calculateExpandingTrapezoidSteps(
  geometry: TriangleGeometry,
  stepCount: number,
  minDepth: number = 0.20, // 20cm at narrow end
  maxDepth: number = 0.30, // 30cm at wide end
): TrapezoidStep[] {
  const { height, longestEdge } = geometry;
  const steps: TrapezoidStep[] = [];
  
  // Calculate preliminary step depths with linear interpolation
  const preliminarySteps: { depth: number }[] = [];
  for (let i = 0; i < stepCount; i++) {
    const progress = stepCount > 1 ? i / (stepCount - 1) : 0;
    // Depth increases from narrow (apex) to wide (base)
    const depth = minDepth + progress * (maxDepth - minDepth);
    preliminarySteps.push({ depth });
  }
  
  // Calculate total preliminary depth
  const totalPreliminaryDepth = preliminarySteps.reduce((sum, s) => sum + s.depth, 0);
  
  // Scale to fit actual height
  const scale = height / totalPreliminaryDepth;
  
  // Generate final step data with positions
  let currentPosition = 0;
  for (let i = 0; i < stepCount; i++) {
    const scaledDepth = preliminarySteps[i].depth * scale;
    
    // Calculate width at this position (linear interpolation along height)
    const progress = currentPosition / height;
    const nextProgress = (currentPosition + scaledDepth) / height;
    const widthStart = longestEdge.length * progress;
    const widthEnd = longestEdge.length * nextProgress;
    
    steps.push({
      position: currentPosition,
      depth: scaledDepth,
      widthStart,
      widthEnd,
    });
    
    currentPosition += scaledDepth;
  }
  
  return steps;
}

/**
 * Calculate rotation angle perpendicular to the longest edge
 * Returns angle in degrees (0-360) pointing from base toward apex
 */
export function calculatePerpendicularRotation(geometry: TriangleGeometry): number {
  const { longestEdge, oppositeVertex } = geometry;
  
  // Vector along the longest edge
  const edgeVec = {
    x: longestEdge.end.x - longestEdge.start.x,
    y: longestEdge.end.y - longestEdge.start.y,
  };
  
  // Perpendicular vector (rotate 90°)
  // Two options: (y, -x) or (-y, x) - pick the one pointing toward apex
  const perpVec1 = { x: edgeVec.y, y: -edgeVec.x };
  const perpVec2 = { x: -edgeVec.y, y: edgeVec.x };
  
  // Center of longest edge
  const edgeCenter = {
    x: (longestEdge.start.x + longestEdge.end.x) / 2,
    y: (longestEdge.start.y + longestEdge.end.y) / 2,
  };
  
  // Vector from edge center to apex
  const toApex = {
    x: oppositeVertex.x - edgeCenter.x,
    y: oppositeVertex.y - edgeCenter.y,
  };
  
  // Pick perpendicular that points toward apex (positive dot product)
  const dot1 = perpVec1.x * toApex.x + perpVec1.y * toApex.y;
  const perpVec = dot1 > 0 ? perpVec1 : perpVec2;
  
  // We want descent direction (from apex toward base), so negate
  const descentVec = { x: -perpVec.x, y: -perpVec.y };
  
  // Convert to angle in degrees
  const angleRad = Math.atan2(descentVec.y, descentVec.x);
  let angleDeg = (angleRad * 180) / Math.PI;
  
  // Normalize to 0-360
  angleDeg = ((angleDeg % 360) + 360) % 360;
  
  return angleDeg;
}

/**
 * Slice the triangle to create a trapezoid step at given height range
 * Returns vertices of the trapezoid slice
 */
export function sliceTriangleForStep(
  geometry: TriangleGeometry,
  positionStart: number, // Distance from apex
  positionEnd: number, // Distance from apex
): Point[] {
  const { longestEdge, oppositeVertex, height, leftLeg, rightLeg } = geometry;
  
  // Progress along height (0 = apex, 1 = base)
  const progressStart = positionStart / height;
  const progressEnd = Math.min(positionEnd / height, 1);
  
  // Interpolate points along left and right legs
  const leftStart = {
    x: oppositeVertex.x + progressStart * (longestEdge.start.x - oppositeVertex.x),
    y: oppositeVertex.y + progressStart * (longestEdge.start.y - oppositeVertex.y),
  };
  const leftEnd = {
    x: oppositeVertex.x + progressEnd * (longestEdge.start.x - oppositeVertex.x),
    y: oppositeVertex.y + progressEnd * (longestEdge.start.y - oppositeVertex.y),
  };
  const rightStart = {
    x: oppositeVertex.x + progressStart * (longestEdge.end.x - oppositeVertex.x),
    y: oppositeVertex.y + progressStart * (longestEdge.end.y - oppositeVertex.y),
  };
  const rightEnd = {
    x: oppositeVertex.x + progressEnd * (longestEdge.end.x - oppositeVertex.x),
    y: oppositeVertex.y + progressEnd * (longestEdge.end.y - oppositeVertex.y),
  };
  
  // Return trapezoid vertices (in order for proper polygon)
  // For first step (at apex), might be a triangle if progressStart is 0
  if (progressStart < 0.001) {
    // Triangle at apex
    return [oppositeVertex, leftEnd, rightEnd];
  }
  
  // Trapezoid
  return [leftStart, leftEnd, rightEnd, rightStart];
}

/**
 * Generate step line positions for 2D preview (variable spacing)
 * Returns array of progress values (0-1) where step lines should be drawn
 */
export function generateStepLinePositions(
  geometry: TriangleGeometry,
  stepCount: number,
  minDepth: number = 0.20,
  maxDepth: number = 0.30,
): number[] {
  const steps = calculateExpandingTrapezoidSteps(geometry, stepCount, minDepth, maxDepth);
  const positions: number[] = [];
  
  let accumulated = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    accumulated += steps[i].depth;
    positions.push(accumulated / geometry.height);
  }
  
  return positions;
}
