import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { PoolDimensions, CustomPoolVertex, getCornerLabel } from '@/types/configurator';
import { DimensionDisplay } from '@/components/Pool3DVisualization';
import { getStairsRenderData, StairsPath2D } from '@/components/pool/StairsPath2D';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  analyzeTriangleGeometry, 
  calculateExpandingTrapezoidSteps 
} from '@/lib/scaleneTriangleStairs';

// Custom column counts for manual override
export interface CustomColumnCounts {
  lengthWalls: number; // columns on top/bottom walls (along length)
  widthWalls: number;  // columns on left/right walls (along width)
}

// Calculate default column counts based on pool dimensions (2m spacing)
export function calculateDefaultColumnCounts(length: number, width: number): CustomColumnCounts {
  return {
    lengthWalls: Math.max(1, Math.round(length / 2.5)),
    widthWalls: Math.max(1, Math.round(width / 2.5)),
  };
}

// Calculate total column count from custom counts
export function getTotalColumnCount(counts: CustomColumnCounts): number {
  return (counts.lengthWalls * 2) + (counts.widthWalls * 2);
}

interface Pool2DPreviewProps {
  dimensions: PoolDimensions;
  height?: number;
  dimensionDisplay?: DimensionDisplay;
  showColumns?: boolean; // Show masonry column positions
  customColumnCounts?: CustomColumnCounts; // Optional manual override for column counts
  onColumnCountsChange?: (counts: CustomColumnCounts) => void; // Callback when counts change
}

// Generate pool outline points for 2D view
function getPoolPoints(dimensions: PoolDimensions): { x: number; y: number }[] {
  const { shape, length, width, customVertices } = dimensions;
  const points: { x: number; y: number }[] = [];

  switch (shape) {
    case 'prostokatny':
      points.push(
        { x: -length / 2, y: -width / 2 },
        { x: length / 2, y: -width / 2 },
        { x: length / 2, y: width / 2 },
        { x: -length / 2, y: width / 2 }
      );
      break;
    case 'owalny':
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
          x: Math.cos(angle) * (length / 2),
          y: Math.sin(angle) * (width / 2)
        });
      }
      break;
    case 'nieregularny':
      if (customVertices && customVertices.length >= 3) {
        const minX = Math.min(...customVertices.map(v => v.x));
        const maxX = Math.max(...customVertices.map(v => v.x));
        const minY = Math.min(...customVertices.map(v => v.y));
        const maxY = Math.max(...customVertices.map(v => v.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        customVertices.forEach(v => {
          points.push({ x: v.x - centerX, y: v.y - centerY });
        });
      } else {
        // Custom shape not yet drawn - return empty/small placeholder
        points.push(
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 }
        );
      }
      break;
    default:
      points.push(
        { x: -length / 2, y: -width / 2 },
        { x: length / 2, y: -width / 2 },
        { x: length / 2, y: width / 2 },
        { x: -length / 2, y: width / 2 }
      );
  }

  return points;
}

// Wall thickness for 2D visualization (same as 3D: 24cm)
const POOL_WALL_THICKNESS_2D = 0.24;

// Generate outer shell points (pool + wall thickness) for 2D view
function getOuterShellPoints(dimensions: PoolDimensions): { x: number; y: number }[] {
  const { shape, length, width, customVertices } = dimensions;
  const points: { x: number; y: number }[] = [];
  const offset = POOL_WALL_THICKNESS_2D;

  switch (shape) {
    case 'prostokatny': {
      const outerHalfL = length / 2 + offset;
      const outerHalfW = width / 2 + offset;
      points.push(
        { x: -outerHalfL, y: -outerHalfW },
        { x: outerHalfL, y: -outerHalfW },
        { x: outerHalfL, y: outerHalfW },
        { x: -outerHalfL, y: outerHalfW }
      );
      break;
    }
    case 'owalny': {
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
          x: Math.cos(angle) * (length / 2 + offset),
          y: Math.sin(angle) * (width / 2 + offset)
        });
      }
      break;
    }
    case 'nieregularny': {
      if (customVertices && customVertices.length >= 3) {
        const minX = Math.min(...customVertices.map(v => v.x));
        const maxX = Math.max(...customVertices.map(v => v.x));
        const minY = Math.min(...customVertices.map(v => v.y));
        const maxY = Math.max(...customVertices.map(v => v.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Offset each vertex outward
        const numPoints = customVertices.length;
        for (let i = 0; i < numPoints; i++) {
          const prev = customVertices[(i - 1 + numPoints) % numPoints];
          const curr = customVertices[i];
          const next = customVertices[(i + 1) % numPoints];
          
          // Calculate edge vectors
          const edge1 = { x: curr.x - prev.x, y: curr.y - prev.y };
          const edge2 = { x: next.x - curr.x, y: next.y - curr.y };
          const len1 = Math.hypot(edge1.x, edge1.y);
          const len2 = Math.hypot(edge2.x, edge2.y);
          
          if (len1 < 0.001 || len2 < 0.001) {
            points.push({ x: curr.x - centerX, y: curr.y - centerY });
            continue;
          }
          
          // Normalize
          const e1 = { x: edge1.x / len1, y: edge1.y / len1 };
          const e2 = { x: edge2.x / len2, y: edge2.y / len2 };
          
          // Calculate signed area to determine winding
          let signedArea = 0;
          for (let j = 0; j < numPoints; j++) {
            const a = customVertices[j];
            const b = customVertices[(j + 1) % numPoints];
            signedArea += a.x * b.y - b.x * a.y;
          }
          signedArea /= 2;
          
          // Outward normals (perpendicular to edges)
          const outward = signedArea > 0;
          const n1 = outward ? { x: e1.y, y: -e1.x } : { x: -e1.y, y: e1.x };
          const n2 = outward ? { x: e2.y, y: -e2.x } : { x: -e2.y, y: e2.x };
          
          // Average normal
          let avgX = (n1.x + n2.x) / 2;
          let avgY = (n1.y + n2.y) / 2;
          const avgLen = Math.hypot(avgX, avgY);
          if (avgLen > 0.001) {
            avgX /= avgLen;
            avgY /= avgLen;
          }
          
          // Offset multiplier for sharp corners
          const dot = n1.x * n2.x + n1.y * n2.y;
          const mult = dot > 0.1 ? 1 / Math.max(0.5, Math.sqrt((1 + dot) / 2)) : 1.5;
          
          points.push({
            x: curr.x - centerX + avgX * offset * mult,
            y: curr.y - centerY + avgY * offset * mult
          });
        }
      } else {
        // Placeholder
        const outerSize = 1 + offset;
        points.push(
          { x: -outerSize, y: -outerSize },
          { x: outerSize, y: -outerSize },
          { x: outerSize, y: outerSize },
          { x: -outerSize, y: outerSize }
        );
      }
      break;
    }
    default: {
      const outerHalfL = length / 2 + offset;
      const outerHalfW = width / 2 + offset;
      points.push(
        { x: -outerHalfL, y: -outerHalfW },
        { x: outerHalfL, y: -outerHalfW },
        { x: outerHalfL, y: outerHalfW },
        { x: -outerHalfL, y: outerHalfW }
      );
    }
  }

  return points;
}

// Use shared stair render data from reusable component
function getRegularStairsData(dimensions: PoolDimensions) {
  const stairs = dimensions.stairs;
  if (!stairs?.enabled || dimensions.shape === 'nieregularny') return null;
  
  // Pass wading pool config for calculating intersection positions (E, F points)
  const wadingPoolData = dimensions.wadingPool?.enabled ? {
    enabled: dimensions.wadingPool.enabled,
    cornerIndex: dimensions.wadingPool.cornerIndex,
    direction: dimensions.wadingPool.direction,
    width: dimensions.wadingPool.width,
    length: dimensions.wadingPool.length,
  } : undefined;
  
  return getStairsRenderData(dimensions.length, dimensions.width, stairs, wadingPoolData);
}

// Legacy wrapper for places that just need points
function getRegularStairsPoints(dimensions: PoolDimensions): { x: number; y: number }[] | null {
  const data = getRegularStairsData(dimensions);
  return data?.outline || null;
}

// Generate wading pool points for rectangular pools
function getRegularWadingPoolPoints(dimensions: PoolDimensions): { x: number; y: number }[] | null {
  const wadingPool = dimensions.wadingPool;
  if (!wadingPool?.enabled || dimensions.shape === 'nieregularny') return null;
  
  const { length, width } = dimensions;
  const halfL = length / 2;
  const halfW = width / 2;
  const wpWidth = wadingPool.width || 2;
  const wpLength = wadingPool.length || 1.5;
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';
  
  const isAlongLength = direction === 'along-length';
  const xDir = corner.includes('left') ? 1 : -1;
  const yDir = corner.includes('back') ? 1 : -1;
  const baseX = corner.includes('left') ? -halfL : halfL;
  const baseY = corner.includes('back') ? -halfW : halfW;
  
  let points: { x: number; y: number }[];
  
  if (isAlongLength) {
    // Wading pool extends along X axis
    points = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * wpWidth, y: baseY },
      { x: baseX + xDir * wpWidth, y: baseY + yDir * wpLength },
      { x: baseX, y: baseY + yDir * wpLength }
    ];
  } else {
    // Wading pool extends along Y axis
    points = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * wpLength, y: baseY },
      { x: baseX + xDir * wpLength, y: baseY + yDir * wpWidth },
      { x: baseX, y: baseY + yDir * wpWidth }
    ];
  }
  
  return points;
}

// Transform custom element vertices to be centered relative to pool
function transformCustomVertices(
  vertices: CustomPoolVertex[],
  poolVertices?: CustomPoolVertex[]
): { x: number; y: number }[] {
  if (!vertices || vertices.length < 3) return [];
  
  // Get pool center for offset
  let poolCenterX = 0;
  let poolCenterY = 0;
  
  if (poolVertices && poolVertices.length >= 3) {
    const minX = Math.min(...poolVertices.map(v => v.x));
    const maxX = Math.max(...poolVertices.map(v => v.x));
    const minY = Math.min(...poolVertices.map(v => v.y));
    const maxY = Math.max(...poolVertices.map(v => v.y));
    poolCenterX = (minX + maxX) / 2;
    poolCenterY = (minY + maxY) / 2;
  }
  
  return vertices.map(v => ({
    x: v.x - poolCenterX,
    y: v.y - poolCenterY
  }));
}

export default function Pool2DPreview({ 
  dimensions, 
  height = 300, 
  dimensionDisplay = 'pool', 
  showColumns = false,
  customColumnCounts,
  onColumnCountsChange 
}: Pool2DPreviewProps) {
  const poolPoints = useMemo(() => getPoolPoints(dimensions), [dimensions]);
  const outerShellPoints = useMemo(() => getOuterShellPoints(dimensions), [dimensions]);
  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Reset zoom/pan when dimensions change significantly
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [dimensions.shape, dimensions.length, dimensions.width]);
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.3, 5));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.3, 0.5));
  }, []);
  
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev * 1.1, 5));
    } else {
      setZoom(prev => Math.max(prev / 1.1, 0.5));
    }
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Get full stairs data including step lines
  const stairsData = useMemo(() => {
    // Check for custom stairs vertices array with at least 3 vertices (valid polygon)
    const customStairsValid = dimensions.customStairsVertices?.[0]?.length >= 3;
    if (dimensions.shape === 'nieregularny' && customStairsValid) {
      const stairsVerts = dimensions.customStairsVertices[0];
      // Transform vertices for rendering (centered on pool)
      const outline = transformCustomVertices(
        stairsVerts,
        dimensions.customVertices
      );
      
      // Generate step lines based on stairs config and rotation (arrow direction)
      const stepCount = dimensions.stairs.stepCount || 4;
      const stepLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
      
      // Get pool center for transformation
      let poolCenterX = 0;
      let poolCenterY = 0;
      if (dimensions.customVertices && dimensions.customVertices.length >= 3) {
        const minX = Math.min(...dimensions.customVertices.map(v => v.x));
        const maxX = Math.max(...dimensions.customVertices.map(v => v.x));
        const minY = Math.min(...dimensions.customVertices.map(v => v.y));
        const maxY = Math.max(...dimensions.customVertices.map(v => v.y));
        poolCenterX = (minX + maxX) / 2;
        poolCenterY = (minY + maxY) / 2;
      }
      
      // Transform stairs vertices
      const transformedVerts = stairsVerts.map(v => ({
        x: v.x - poolCenterX,
        y: v.y - poolCenterY
      }));
      
      // Check for scalene triangle (3 vertices with unequal arms)
      if (transformedVerts.length === 3) {
        const triangleGeom = analyzeTriangleGeometry(transformedVerts);
        
        if (triangleGeom && triangleGeom.isScalene) {
          // === SCALENE TRIANGLE: Variable depth step lines ===
          const minDepth = dimensions.stairs.minStepDepth ?? 0.20;
          const maxDepth = dimensions.stairs.maxStepDepth ?? 0.30;
          
          // Calculate expanding steps to get positions
          const expandingSteps = calculateExpandingTrapezoidSteps(
            triangleGeom, 
            stepCount, 
            minDepth, 
            maxDepth
          );
          
          // Generate step lines at variable positions
          let accumulatedPosition = 0;
          for (let i = 0; i < expandingSteps.length - 1; i++) {
            accumulatedPosition += expandingSteps[i].depth;
            const progress = accumulatedPosition / triangleGeom.height;
            
            // Calculate line endpoints by interpolating along legs
            const leftPoint = {
              x: triangleGeom.oppositeVertex.x + progress * (triangleGeom.longestEdge.start.x - triangleGeom.oppositeVertex.x),
              y: triangleGeom.oppositeVertex.y + progress * (triangleGeom.longestEdge.start.y - triangleGeom.oppositeVertex.y),
            };
            const rightPoint = {
              x: triangleGeom.oppositeVertex.x + progress * (triangleGeom.longestEdge.end.x - triangleGeom.oppositeVertex.x),
              y: triangleGeom.oppositeVertex.y + progress * (triangleGeom.longestEdge.end.y - triangleGeom.oppositeVertex.y),
            };
            
            stepLines.push({
              x1: leftPoint.x,
              y1: leftPoint.y,
              x2: rightPoint.x,
              y2: rightPoint.y
            });
          }
          
          return { outline, stepLines };
        }
      }
      
      // === REGULAR GEOMETRY: Equal spacing ===
      // Get rotation from stairs rotation data (arrow direction)
      // UI convention (stairsAngleLabels): 0°=↓, 90°=←, 180°=↑, 270°=→
      const rotation = dimensions.customStairsRotations?.[0] ?? 135; // default diagonal
      const rotRad = (rotation * Math.PI) / 180;
      const descentVec = { x: -Math.sin(rotRad), y: Math.cos(rotRad) };
      // Perpendicular vector for step lines
      const perpVec = { x: -descentVec.y, y: descentVec.x };
      
      // Project all vertices onto descent axis to find extent
      const projections = transformedVerts.map(v => 
        v.x * descentVec.x + v.y * descentVec.y
      );
      const minProj = Math.min(...projections);
      const maxProj = Math.max(...projections);
      const totalExtent = maxProj - minProj;
      
      // Generate step lines perpendicular to descent direction
      for (let i = 1; i < stepCount; i++) {
        const progress = i / stepCount;
        const sliceProj = minProj + progress * totalExtent;
        
        // Find intersection points of this slice line with polygon edges
        const intersections: { x: number; y: number }[] = [];
        const n = transformedVerts.length;
        
        for (let j = 0; j < n; j++) {
          const curr = transformedVerts[j];
          const next = transformedVerts[(j + 1) % n];
          
          const currProj = curr.x * descentVec.x + curr.y * descentVec.y;
          const nextProj = next.x * descentVec.x + next.y * descentVec.y;
          
          // Check if slice line crosses this edge
          if ((currProj <= sliceProj && nextProj >= sliceProj) || 
              (currProj >= sliceProj && nextProj <= sliceProj)) {
            if (Math.abs(nextProj - currProj) > 0.001) {
              const t = (sliceProj - currProj) / (nextProj - currProj);
              intersections.push({
                x: curr.x + t * (next.x - curr.x),
                y: curr.y + t * (next.y - curr.y)
              });
            }
          }
        }
        
        // If we found 2 intersection points, create the step line
        if (intersections.length >= 2) {
          // Sort by perpendicular projection to get correct order
          intersections.sort((a, b) => 
            (a.x * perpVec.x + a.y * perpVec.y) - (b.x * perpVec.x + b.y * perpVec.y)
          );
          stepLines.push({
            x1: intersections[0].x,
            y1: intersections[0].y,
            x2: intersections[intersections.length - 1].x,
            y2: intersections[intersections.length - 1].y
          });
        }
      }
      
      return { outline, stepLines };
    }
    // For regular shapes, get full stairs data
    return getRegularStairsData(dimensions);
  }, [dimensions]);
  
  const stairsPoints = stairsData?.outline || null;
  const stairsStepLines = stairsData?.stepLines || [];
  
  const wadingPoolPoints = useMemo(() => {
    // Check for custom wading pool vertices array with at least 3 vertices (valid polygon)
    const customWadingValid = dimensions.customWadingPoolVertices?.[0]?.length >= 3;
    if (dimensions.shape === 'nieregularny' && customWadingValid) {
      return transformCustomVertices(
        dimensions.customWadingPoolVertices[0],
        dimensions.customVertices
      );
    }
    // For regular shapes, generate wading pool points from config
    return getRegularWadingPoolPoints(dimensions);
  }, [dimensions]);
  
  // Calculate bounding box for all elements (including outer shell)
  const bounds = useMemo(() => {
    const allPoints = [...outerShellPoints]; // Start with outer shell for proper bounding
    if (stairsPoints) allPoints.push(...stairsPoints);
    if (wadingPoolPoints) allPoints.push(...wadingPoolPoints);
    
    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));
    
    return { minX, maxX, minY, maxY };
  }, [outerShellPoints, stairsPoints, wadingPoolPoints]);
  
  // Calculate internal pool bounds (for dimension lines - without wall thickness)
  const poolBounds = useMemo(() => {
    const minX = Math.min(...poolPoints.map(p => p.x));
    const maxX = Math.max(...poolPoints.map(p => p.x));
    const minY = Math.min(...poolPoints.map(p => p.y));
    const maxY = Math.max(...poolPoints.map(p => p.y));
    return { minX, maxX, minY, maxY };
  }, [poolPoints]);
  
  // Calculate bounds for stairs and wading pool individually
  const stairsBounds = useMemo(() => {
    if (!stairsPoints || stairsPoints.length < 2) return null;
    const minX = Math.min(...stairsPoints.map(p => p.x));
    const maxX = Math.max(...stairsPoints.map(p => p.x));
    const minY = Math.min(...stairsPoints.map(p => p.y));
    const maxY = Math.max(...stairsPoints.map(p => p.y));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [stairsPoints]);
  
  const wadingBounds = useMemo(() => {
    if (!wadingPoolPoints || wadingPoolPoints.length < 2) return null;
    const minX = Math.min(...wadingPoolPoints.map(p => p.x));
    const maxX = Math.max(...wadingPoolPoints.map(p => p.x));
    const minY = Math.min(...wadingPoolPoints.map(p => p.y));
    const maxY = Math.max(...wadingPoolPoints.map(p => p.y));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [wadingPoolPoints]);
  
  // Calculate SVG viewBox with padding
  const viewBox = useMemo(() => {
    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.15;
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const w = (bounds.maxX - bounds.minX) + padding * 2;
    const h = (bounds.maxY - bounds.minY) + padding * 2;
    return `${x} ${y} ${w} ${h}`;
  }, [bounds]);
  
  // Convert points to SVG path
  const pointsToPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    // Flip Y axis for SVG (SVG Y goes down, our Y goes up)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${-p.y}`).join(' ') + ' Z';
  };
  
  const outerShellPath = pointsToPath(outerShellPoints);
  const poolPath = pointsToPath(poolPoints);
  const stairsPath = stairsPoints ? pointsToPath(stairsPoints) : '';
  const wadingPoolPath = wadingPoolPoints ? pointsToPath(wadingPoolPoints) : '';
  
  // Calculate internal pool dimensions (for display - without wall thickness)
  const poolWidth = poolBounds.maxX - poolBounds.minX;
  const poolHeight = poolBounds.maxY - poolBounds.minY;
  
  // Dimension visibility flags
  const showPoolDims = dimensionDisplay === 'all' || dimensionDisplay === 'pool';
  const showStairsDims = dimensionDisplay === 'all' || dimensionDisplay === 'stairs';
  const showWadingDims = dimensionDisplay === 'all' || dimensionDisplay === 'wading';
  
  // Calculate column positions for masonry pools
  // Half-spacing at corners, junction columns at wading pool contact points
  // Perimeter ordering: top wall (left→right), right wall (top→bottom), bottom wall (right→left), left wall (bottom→top)
  const columnPositions = useMemo(() => {
    if (!showColumns || dimensions.shape !== 'prostokatny') return [];
    
    const { length, width } = dimensions;
    const counts = customColumnCounts ?? calculateDefaultColumnCounts(length, width);
    const wallOffset = 0.12; // half of 0.24m wall thickness
    const halfL = length / 2;
    const halfW = width / 2;
    
    // Find wading pool junction points on the pool walls
    const junctions: { wall: 'top' | 'bottom' | 'left' | 'right'; pos: number }[] = [];
    const wp = dimensions.wadingPool;
    if (wp?.enabled && wp.position !== 'outside') {
      const corner = wp.corner || 'back-left';
      const direction = wp.direction || 'along-width';
      const wpWidth = wp.width || 2;
      const wpLength = wp.length || 1.5;
      
      // Determine which wall the wading pool is attached to and where junction points are
      // Junction points are where the wading pool's inner walls meet the pool wall
      const isAlongLength = direction === 'along-length';
      
      if (corner === 'back-left') {
        if (isAlongLength) {
          // Attached to back wall (top), junction at x = -halfL + wpWidth
          junctions.push({ wall: 'top', pos: -halfL + wpWidth });
          // Attached to left wall, junction at y = -halfW + wpLength
          junctions.push({ wall: 'left', pos: -halfW + wpLength });
        } else {
          // along-width: attached to back wall, junction at x = -halfL + wpLength
          junctions.push({ wall: 'top', pos: -halfL + wpLength });
          // Attached to left wall, junction at y = -halfW + wpWidth
          junctions.push({ wall: 'left', pos: -halfW + wpWidth });
        }
      } else if (corner === 'back-right') {
        if (isAlongLength) {
          junctions.push({ wall: 'top', pos: halfL - wpWidth });
          junctions.push({ wall: 'right', pos: -halfW + wpLength });
        } else {
          junctions.push({ wall: 'top', pos: halfL - wpLength });
          junctions.push({ wall: 'right', pos: -halfW + wpWidth });
        }
      } else if (corner === 'front-left') {
        if (isAlongLength) {
          junctions.push({ wall: 'bottom', pos: -halfL + wpWidth });
          junctions.push({ wall: 'left', pos: halfW - wpLength });
        } else {
          junctions.push({ wall: 'bottom', pos: -halfL + wpLength });
          junctions.push({ wall: 'left', pos: halfW - wpWidth });
        }
      } else if (corner === 'front-right') {
        if (isAlongLength) {
          junctions.push({ wall: 'bottom', pos: halfL - wpWidth });
          junctions.push({ wall: 'right', pos: halfW - wpLength });
        } else {
          junctions.push({ wall: 'bottom', pos: halfL - wpLength });
          junctions.push({ wall: 'right', pos: halfW - wpWidth });
        }
      }
    }
    
    // Helper: distribute n columns on a segment [start, end] with half-spacing at edges
    // Returns positions along the segment
    function distributeOnSegment(start: number, end: number, n: number): number[] {
      if (n <= 0) return [];
      const segLen = Math.abs(end - start);
      if (segLen < 0.3) return []; // too short
      const dir = end > start ? 1 : -1;
      const fullSpacing = segLen / n;
      const halfSpacing = fullSpacing / 2;
      const positions: number[] = [];
      for (let i = 0; i < n; i++) {
        positions.push(start + dir * (halfSpacing + i * fullSpacing));
      }
      return positions;
    }
    
    // Helper: calculate column count for a sub-segment based on proportional share
    function columnsForSegment(segLen: number, totalLen: number, totalCols: number): number {
      if (totalLen <= 0) return 0;
      return Math.max(0, Math.round((segLen / totalLen) * totalCols));
    }
    
    // Build columns wall by wall in perimeter order
    const allPositions: { x: number; y: number; label: string }[] = [];
    
    // Helper to add columns on a wall, splitting by junction points
    function addWallColumns(
      wall: 'top' | 'bottom' | 'left' | 'right',
      wallStart: number, // coordinate along wall direction
      wallEnd: number,
      totalCols: number,
      fixedCoord: number, // the perpendicular coordinate (with wallOffset)
      isHorizontal: boolean
    ) {
      const wallJunctions = junctions.filter(j => j.wall === wall);
      
      if (wallJunctions.length === 0) {
        // No junctions - distribute evenly with half-spacing
        const positions = distributeOnSegment(wallStart, wallEnd, totalCols);
        for (const pos of positions) {
          if (isHorizontal) {
            allPositions.push({ x: pos, y: fixedCoord, label: '' });
          } else {
            allPositions.push({ x: fixedCoord, y: pos, label: '' });
          }
        }
      } else {
        // Sort junction positions along wall direction
        const juncPositions = wallJunctions.map(j => j.pos);
        const dir = wallEnd > wallStart ? 1 : -1;
        juncPositions.sort((a, b) => (a - b) * dir);
        
        // Build segments: wallStart -> junc1 -> junc2 -> ... -> wallEnd
        const breakpoints = [wallStart, ...juncPositions, wallEnd];
        const wallLen = Math.abs(wallEnd - wallStart);
        
        // Junction columns consume from totalCols budget
        const remainingCols = Math.max(0, totalCols - wallJunctions.length);
        
        for (let s = 0; s < breakpoints.length - 1; s++) {
          const segStart = breakpoints[s];
          const segEnd = breakpoints[s + 1];
          const segLen = Math.abs(segEnd - segStart);
          
          // Add junction column at segStart (except for the very first segment start = corner)
          if (s > 0) {
            if (isHorizontal) {
              allPositions.push({ x: segStart, y: fixedCoord, label: '' });
            } else {
              allPositions.push({ x: fixedCoord, y: segStart, label: '' });
            }
          }
          
          // Distribute remaining columns proportionally on this segment
          const segCols = columnsForSegment(segLen, wallLen, remainingCols);
          const positions = distributeOnSegment(segStart, segEnd, segCols);
          for (const pos of positions) {
            if (isHorizontal) {
              allPositions.push({ x: pos, y: fixedCoord, label: '' });
            } else {
              allPositions.push({ x: fixedCoord, y: pos, label: '' });
            }
          }
        }
      }
    }
    
    // Top wall (back): left to right, y = -(halfW + wallOffset)
    addWallColumns('top', -halfL, halfL, counts.lengthWalls, -(halfW + wallOffset), true);
    // Right wall: top to bottom, x = halfL + wallOffset
    addWallColumns('right', -halfW, halfW, counts.widthWalls, halfL + wallOffset, false);
    // Bottom wall (front): right to left, y = halfW + wallOffset
    addWallColumns('bottom', halfL, -halfL, counts.lengthWalls, halfW + wallOffset, true);
    // Left wall: bottom to top, x = -(halfL + wallOffset)
    addWallColumns('left', halfW, -halfW, counts.widthWalls, -(halfL + wallOffset), false);
    
    // Assign sequential labels
    allPositions.forEach((pos, i) => {
      pos.label = `S${i + 1}`;
    });
    
    return allPositions;
  }, [showColumns, dimensions.shape, dimensions.length, dimensions.width, dimensions.wadingPool, customColumnCounts]);
  
  // Calculate scaled viewBox for zoom
  const scaledViewBox = useMemo(() => {
    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.15;
    const baseW = (bounds.maxX - bounds.minX) + padding * 2;
    const baseH = (bounds.maxY - bounds.minY) + padding * 2;
    
    // Scale the viewBox dimensions inversely to zoom level
    const scaledW = baseW / zoom;
    const scaledH = baseH / zoom;
    
    // Center offset adjusted by pan
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Pan is in pixels, convert to viewBox units
    // Approximate conversion: viewBox units per pixel
    const unitsPerPixel = baseW / 400; // Rough estimate based on typical container width
    
    const x = centerX - scaledW / 2 - (pan.x * unitsPerPixel / zoom);
    const y = -centerY - scaledH / 2 + (pan.y * unitsPerPixel / zoom);
    
    return `${x} ${y} ${scaledW} ${scaledH}`;
  }, [bounds, zoom, pan]);
  
  // Calculate zoom percentage for display
  const zoomPercentage = Math.round(zoom * 100);
  
  return (
    <div 
      className="w-full rounded-lg overflow-hidden bg-[#a8c8a0] relative select-none"
      style={{ height, cursor: isDragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default') }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        viewBox={scaledViewBox}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid2d" width="1" height="1" patternUnits="userSpaceOnUse">
            <path 
              d="M 1 0 L 0 0 0 1" 
              fill="none" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="0.02"
            />
          </pattern>
        </defs>
        <rect 
          x={bounds.minX - 10} 
          y={-bounds.maxY - 10} 
          width={poolWidth + 20} 
          height={poolHeight + 20} 
          fill="url(#grid2d)" 
        />
        
        {/* Outer shell (concrete wall thickness) - render first (below pool) */}
        <path
          d={outerShellPath}
          fill="#d1d5db"
          stroke="#9ca3af"
          strokeWidth="0.03"
        />
        
        {/* Pool outline (inner, blue water area) */}
        <path
          d={poolPath}
          fill="#5b9bd5"
          stroke="#0c4a6e"
          strokeWidth="0.05"
        />
        
        {/* Corner labels (A, B, C, D...) for non-oval shapes */}
        {dimensions.shape !== 'owalny' && poolPoints.map((point, index) => (
          <g key={`corner-${index}`}>
            {/* Corner vertex marker */}
            <circle
              cx={point.x}
              cy={-point.y}
              r={0.15}
              fill="#0c4a6e"
              stroke="white"
              strokeWidth="0.03"
            />
            {/* Corner label */}
            <text
              x={point.x + 0.25}
              y={-point.y - 0.15}
              fontSize="0.3"
              fill="#0c4a6e"
              fontWeight="bold"
            >
              {getCornerLabel(index)}
            </text>
          </g>
        ))}
        
        {/* Stairs outline */}
        {stairsPath && (
          <path
            d={stairsPath}
            fill="#ffffff"
            stroke="#f97316"
            strokeWidth="0.04"
            strokeDasharray="0.1 0.05"
          />
        )}
        
        {/* Stairs step lines - dashed lines showing individual steps */}
        {stairsStepLines.map((line, index) => (
          <line
            key={`step-${index}`}
            x1={line.x1}
            y1={-line.y1}
            x2={line.x2}
            y2={-line.y2}
            stroke="#0c4a6e"
            strokeWidth="0.02"
            strokeDasharray="0.08 0.04"
            opacity={0.7}
          />
        ))}
        
        {/* Wading pool */}
        {wadingPoolPath && (
          <path
            d={wadingPoolPath}
            fill="#7ec8e3"
            stroke="#10b981"
            strokeWidth="0.04"
            strokeDasharray="0.1 0.05"
          />
        )}
        
        {/* Column positions for masonry pools */}
        {columnPositions.map((col, index) => (
          <g key={`col-${index}`}>
            {/* Column square (24x24cm) */}
            <rect
              x={col.x - 0.12}
              y={-col.y - 0.12}
              width={0.24}
              height={0.24}
              fill="#f97316"
              stroke="#ea580c"
              strokeWidth="0.02"
              opacity={0.9}
            />
            {/* Column label */}
            <text
              x={col.x}
              y={-col.y + 0.04}
              textAnchor="middle"
              fontSize="0.12"
              fill="white"
              fontWeight="bold"
            >
              {col.label}
            </text>
          </g>
        ))}
        
        {/* Pool Dimension lines - only when pool dims enabled (internal dimensions) */}
        {showPoolDims && (
          <>
            {/* Width dimension (bottom) - uses internal pool bounds */}
            <g>
              <line
                x1={poolBounds.minX}
                y1={-poolBounds.minY + 0.4}
                x2={poolBounds.maxX}
                y2={-poolBounds.minY + 0.4}
                stroke="#f97316"
                strokeWidth="0.03"
                markerStart="url(#arrowStart)"
                markerEnd="url(#arrowEnd)"
              />
              <text
                x={(poolBounds.minX + poolBounds.maxX) / 2}
                y={-poolBounds.minY + 0.7}
                textAnchor="middle"
                fontSize="0.25"
                fill="#f97316"
                fontWeight="bold"
              >
                {poolWidth.toFixed(2)} m
              </text>
            </g>
            
            {/* Height dimension (right) - uses internal pool bounds */}
            <g>
              <line
                x1={poolBounds.maxX + 0.4}
                y1={-poolBounds.minY}
                x2={poolBounds.maxX + 0.4}
                y2={-poolBounds.maxY}
                stroke="#f97316"
                strokeWidth="0.03"
              />
              <text
                x={poolBounds.maxX + 0.7}
                y={-(poolBounds.minY + poolBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.25"
                fill="#f97316"
                fontWeight="bold"
                transform={`rotate(-90 ${poolBounds.maxX + 0.7} ${-(poolBounds.minY + poolBounds.maxY) / 2})`}
              >
                {poolHeight.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Stairs Dimension lines */}
        {showStairsDims && stairsBounds && stairsPath && (
          <>
            {/* Stairs width */}
            <g>
              <line
                x1={stairsBounds.minX}
                y1={-stairsBounds.maxY - 0.2}
                x2={stairsBounds.maxX}
                y2={-stairsBounds.maxY - 0.2}
                stroke="#22c55e"
                strokeWidth="0.03"
              />
              <text
                x={(stairsBounds.minX + stairsBounds.maxX) / 2}
                y={-stairsBounds.maxY - 0.35}
                textAnchor="middle"
                fontSize="0.2"
                fill="#22c55e"
                fontWeight="bold"
              >
                {stairsBounds.width.toFixed(2)} m
              </text>
            </g>
            {/* Stairs height */}
            <g>
              <line
                x1={stairsBounds.minX - 0.2}
                y1={-stairsBounds.minY}
                x2={stairsBounds.minX - 0.2}
                y2={-stairsBounds.maxY}
                stroke="#22c55e"
                strokeWidth="0.03"
              />
              <text
                x={stairsBounds.minX - 0.35}
                y={-(stairsBounds.minY + stairsBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.2"
                fill="#22c55e"
                fontWeight="bold"
                transform={`rotate(-90 ${stairsBounds.minX - 0.35} ${-(stairsBounds.minY + stairsBounds.maxY) / 2})`}
              >
                {stairsBounds.height.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Wading Pool Dimension lines */}
        {showWadingDims && wadingBounds && wadingPoolPath && (
          <>
            {/* Wading pool width */}
            <g>
              <line
                x1={wadingBounds.minX}
                y1={-wadingBounds.maxY - 0.2}
                x2={wadingBounds.maxX}
                y2={-wadingBounds.maxY - 0.2}
                stroke="#3b82f6"
                strokeWidth="0.03"
              />
              <text
                x={(wadingBounds.minX + wadingBounds.maxX) / 2}
                y={-wadingBounds.maxY - 0.35}
                textAnchor="middle"
                fontSize="0.2"
                fill="#3b82f6"
                fontWeight="bold"
              >
                {wadingBounds.width.toFixed(2)} m
              </text>
            </g>
            {/* Wading pool height */}
            <g>
              <line
                x1={wadingBounds.maxX + 0.2}
                y1={-wadingBounds.minY}
                x2={wadingBounds.maxX + 0.2}
                y2={-wadingBounds.maxY}
                stroke="#3b82f6"
                strokeWidth="0.03"
              />
              <text
                x={wadingBounds.maxX + 0.35}
                y={-(wadingBounds.minY + wadingBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.2"
                fill="#3b82f6"
                fontWeight="bold"
                transform={`rotate(-90 ${wadingBounds.maxX + 0.35} ${-(wadingBounds.minY + wadingBounds.maxY) / 2})`}
              >
                {wadingBounds.height.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowStart"
            markerWidth="0.2"
            markerHeight="0.2"
            refX="0.1"
            refY="0.1"
            orient="auto"
          >
            <path d="M 0.2 0.1 L 0 0.1" stroke="#f97316" strokeWidth="0.03" />
          </marker>
          <marker
            id="arrowEnd"
            markerWidth="0.2"
            markerHeight="0.2"
            refX="0.1"
            refY="0.1"
            orient="auto"
          >
            <path d="M 0 0.1 L 0.2 0.1" stroke="#f97316" strokeWidth="0.03" />
          </marker>
        </defs>
      </svg>
      
      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-white/90 hover:bg-white"
          onClick={handleZoomIn}
          title="Powiększ"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-white/90 hover:bg-white"
          onClick={handleZoomOut}
          title="Pomniejsz"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7 bg-white/90 hover:bg-white"
          onClick={handleReset}
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title & zoom info */}
      <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs font-medium">
        Widok z góry (2D) • {zoomPercentage}%
      </div>
    </div>
  );
}
