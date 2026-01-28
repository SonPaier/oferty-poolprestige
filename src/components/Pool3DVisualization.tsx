import { useRef, useMemo, Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PoolDimensions, PoolCalculations, StairsConfig, WadingPoolConfig, CustomPoolVertex, getCornerLabel } from '@/types/configurator';
import { planFoilLayout, FoilStrip, ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE } from '@/lib/foilPlanner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

// Dimension display options - exported for use in other components
export type DimensionDisplay = 'all' | 'pool' | 'stairs' | 'wading' | 'none';

// Wall thickness constant (20cm)
const WALL_THICKNESS = 0.2;

// Helper: ensure polygon vertices are in counter-clockwise order
function ensureCounterClockwise(vertices: THREE.Vector2[]): THREE.Vector2[] {
  if (vertices.length < 3) return vertices;
  // Calculate signed area (shoelace formula)
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  // If clockwise (area < 0), reverse to get counter-clockwise
  return area < 0 ? [...vertices].reverse() : vertices;
}

interface Pool3DVisualizationProps {
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  rollWidth?: number;
  showFoilLayout?: boolean;
  height?: number;
  dimensionDisplay?: DimensionDisplay;
  onDimensionDisplayChange?: (display: DimensionDisplay) => void;
}

// Generate pool shape as 2D points (XY plane, will be used for top rim and bottom)
function getPoolShape(dimensions: PoolDimensions): THREE.Vector2[] {
  const { shape, length, width } = dimensions;
  const points: THREE.Vector2[] = [];

  switch (shape) {
    case 'prostokatny':
      points.push(
        new THREE.Vector2(-length / 2, -width / 2),
        new THREE.Vector2(length / 2, -width / 2),
        new THREE.Vector2(length / 2, width / 2),
        new THREE.Vector2(-length / 2, width / 2)
      );
      break;
    case 'owalny':
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(
          new THREE.Vector2(
            Math.cos(angle) * (length / 2),
            Math.sin(angle) * (width / 2)
          )
        );
      }
      break;
    case 'nieregularny':
      if (dimensions.customVertices && dimensions.customVertices.length >= 3) {
        const minX = Math.min(...dimensions.customVertices.map(v => v.x));
        const maxX = Math.max(...dimensions.customVertices.map(v => v.x));
        const minY = Math.min(...dimensions.customVertices.map(v => v.y));
        const maxY = Math.max(...dimensions.customVertices.map(v => v.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        dimensions.customVertices.forEach(v => {
          points.push(new THREE.Vector2(v.x - centerX, v.y - centerY));
        });
      } else {
        // Custom shape not yet drawn - return small placeholder
        points.push(
          new THREE.Vector2(-1, -1),
          new THREE.Vector2(1, -1),
          new THREE.Vector2(1, 1),
          new THREE.Vector2(-1, 1)
        );
      }
      break;
    default:
      points.push(
        new THREE.Vector2(-length / 2, -width / 2),
        new THREE.Vector2(length / 2, -width / 2),
        new THREE.Vector2(length / 2, width / 2),
        new THREE.Vector2(-length / 2, width / 2)
      );
  }

  return points;
}

// Pool shell mesh - walls and bottom with thickness
function PoolMesh({ dimensions, solid = false }: { dimensions: PoolDimensions; solid?: boolean }) {
  const { depth, depthDeep, hasSlope, length, width, shape } = dimensions;
  const actualDeepDepth = hasSlope && depthDeep ? depthDeep : depth;
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  
  // Materials - nice blue like SketchUp reference
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5', // Nice medium blue
      side: THREE.DoubleSide,
    }), []);

  const bottomMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5', // Same blue for bottom
      side: THREE.DoubleSide,
    }), []);

  // Concrete shell material (outer walls) - white with lighting
  const concreteMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
      side: THREE.DoubleSide,
    }), []);

  const edgeColor = '#0c4a6e';

  const isRectangular = shape === 'prostokatny';

  // Create geometry for walls and bottom
  const { wallGeometry, bottomGeometry, edges, shellGeometry, rimGeometry } = useMemo(() => {
    if (isRectangular) {
      // Custom geometry for rectangular pools with optional slope
      const wallGeo = new THREE.BufferGeometry();
      const bottomGeo = new THREE.BufferGeometry();
      
      const halfL = length / 2;
      const halfW = width / 2;
      
      // Bottom vertices - slope goes from shallow (x=-) to deep (x=+)
      const bottomVerts = hasSlope ? [
        -halfL, -halfW, -depth,
        halfL, -halfW, -actualDeepDepth,
        halfL, halfW, -actualDeepDepth,
        -halfL, halfW, -depth,
      ] : [
        -halfL, -halfW, -depth,
        halfL, -halfW, -depth,
        halfL, halfW, -depth,
        -halfL, halfW, -depth,
      ];
      
      bottomGeo.setAttribute('position', new THREE.Float32BufferAttribute(bottomVerts, 3));
      bottomGeo.setIndex([0, 1, 2, 0, 2, 3]);
      bottomGeo.computeVertexNormals();
      
      // Wall vertices
      const wallVerts = [
        // Back wall (-y side)
        -halfL, -halfW, 0,
        halfL, -halfW, 0,
        halfL, -halfW, -actualDeepDepth,
        -halfL, -halfW, -depth,
        // Front wall (+y side)
        -halfL, halfW, 0,
        halfL, halfW, 0,
        halfL, halfW, -actualDeepDepth,
        -halfL, halfW, -depth,
        // Left wall (-x side) - shallow
        -halfL, -halfW, 0,
        -halfL, halfW, 0,
        -halfL, halfW, -depth,
        -halfL, -halfW, -depth,
        // Right wall (+x side) - deep
        halfL, -halfW, 0,
        halfL, halfW, 0,
        halfL, halfW, -actualDeepDepth,
        halfL, -halfW, -actualDeepDepth,
      ];
      
      // Reversed winding order so normals face INTO the pool (for blue inner surface)
      const wallIndices = [
        0, 1, 2, 0, 2, 3,
        4, 7, 6, 4, 6, 5,
        8, 9, 10, 8, 10, 11,
        12, 15, 14, 12, 14, 13,
      ];
      
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVerts, 3));
      wallGeo.setIndex(wallIndices);
      wallGeo.computeVertexNormals();
      
      // Create outer shell (concrete thickness)
      const shellGeo = new THREE.BufferGeometry();
      const outerHalfL = halfL + WALL_THICKNESS;
      const outerHalfW = halfW + WALL_THICKNESS;
      const bottomThickness = WALL_THICKNESS;
      const outerDepth = depth + bottomThickness;
      const outerDeepDepth = actualDeepDepth + bottomThickness;
      
      // Outer shell walls only
      const shellVerts = [
        // Back outer wall
        -outerHalfL, -outerHalfW, 0,
        outerHalfL, -outerHalfW, 0,
        outerHalfL, -outerHalfW, -outerDeepDepth,
        -outerHalfL, -outerHalfW, -outerDepth,
        // Front outer wall
        -outerHalfL, outerHalfW, 0,
        outerHalfL, outerHalfW, 0,
        outerHalfL, outerHalfW, -outerDeepDepth,
        -outerHalfL, outerHalfW, -outerDepth,
        // Left outer wall
        -outerHalfL, -outerHalfW, 0,
        -outerHalfL, outerHalfW, 0,
        -outerHalfL, outerHalfW, -outerDepth,
        -outerHalfL, -outerHalfW, -outerDepth,
        // Right outer wall
        outerHalfL, -outerHalfW, 0,
        outerHalfL, outerHalfW, 0,
        outerHalfL, outerHalfW, -outerDeepDepth,
        outerHalfL, -outerHalfW, -outerDeepDepth,
      ];
      
      shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellVerts, 3));
      // Reversed winding order so normals face OUTWARD (for white exterior)
      shellGeo.setIndex([
        0, 1, 2, 0, 2, 3,
        4, 7, 6, 4, 6, 5,
        8, 9, 10, 8, 10, 11,
        12, 15, 14, 12, 14, 13,
      ]);
      shellGeo.computeVertexNormals();
      
      // Create top rim geometry (connects inner and outer walls at top)
      const rimGeo = new THREE.BufferGeometry();
      const rimVerts = [
        // Back rim
        -halfL, -halfW, 0,
        halfL, -halfW, 0,
        outerHalfL, -outerHalfW, 0,
        -outerHalfL, -outerHalfW, 0,
        // Front rim
        -halfL, halfW, 0,
        halfL, halfW, 0,
        outerHalfL, outerHalfW, 0,
        -outerHalfL, outerHalfW, 0,
        // Left rim
        -halfL, -halfW, 0,
        -halfL, halfW, 0,
        -outerHalfL, outerHalfW, 0,
        -outerHalfL, -outerHalfW, 0,
        // Right rim
        halfL, -halfW, 0,
        halfL, halfW, 0,
        outerHalfL, outerHalfW, 0,
        outerHalfL, -outerHalfW, 0,
      ];
      
      rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimVerts, 3));
      rimGeo.setIndex([
        0, 1, 2, 0, 2, 3,  // Back rim
        4, 7, 6, 4, 6, 5,  // Front rim
        8, 11, 10, 8, 10, 9,  // Left rim
        12, 13, 14, 12, 14, 15,  // Right rim
      ]);
      rimGeo.computeVertexNormals();
      
      // Create edges
      const edgePoints: [number, number, number][][] = [
        // Inner top rim
        [[-halfL, -halfW, 0], [halfL, -halfW, 0]],
        [[halfL, -halfW, 0], [halfL, halfW, 0]],
        [[halfL, halfW, 0], [-halfL, halfW, 0]],
        [[-halfL, halfW, 0], [-halfL, -halfW, 0]],
        // Outer top rim
        [[-outerHalfL, -outerHalfW, 0], [outerHalfL, -outerHalfW, 0]],
        [[outerHalfL, -outerHalfW, 0], [outerHalfL, outerHalfW, 0]],
        [[outerHalfL, outerHalfW, 0], [-outerHalfL, outerHalfW, 0]],
        [[-outerHalfL, outerHalfW, 0], [-outerHalfL, -outerHalfW, 0]],
        // Bottom rim
        [[-halfL, -halfW, -depth], [halfL, -halfW, -actualDeepDepth]],
        [[halfL, -halfW, -actualDeepDepth], [halfL, halfW, -actualDeepDepth]],
        [[halfL, halfW, -actualDeepDepth], [-halfL, halfW, -depth]],
        [[-halfL, halfW, -depth], [-halfL, -halfW, -depth]],
        // Vertical edges
        [[-halfL, -halfW, 0], [-halfL, -halfW, -depth]],
        [[halfL, -halfW, 0], [halfL, -halfW, -actualDeepDepth]],
        [[halfL, halfW, 0], [halfL, halfW, -actualDeepDepth]],
        [[-halfL, halfW, 0], [-halfL, halfW, -depth]],
      ];
      
      return { wallGeometry: wallGeo, bottomGeometry: bottomGeo, edges: edgePoints, shellGeometry: shellGeo, rimGeometry: rimGeo };
    } else {
      // For other shapes (oval, L-shape, custom)
      const shapeObj = new THREE.Shape(shape2D);
      const bottomGeo = new THREE.ShapeGeometry(shapeObj);
      
      const wallPositions: number[] = [];
      const wallIndices: number[] = [];
      
      const numPoints = shape2D.length;
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        
        const baseIdx = i * 4;
        wallPositions.push(
          curr.x, curr.y, 0,
          next.x, next.y, 0,
          next.x, next.y, -depth,
          curr.x, curr.y, -depth
        );
        
        // Reversed winding order so normals face INTO the pool
        wallIndices.push(
          baseIdx, baseIdx + 1, baseIdx + 2,
          baseIdx, baseIdx + 2, baseIdx + 3
        );
      }
      
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
      wallGeo.setIndex(wallIndices);
      wallGeo.computeVertexNormals();
      
      // Create outer shell for non-rectangular shapes
      // Offset each point outward by WALL_THICKNESS
      const outerShape2D: THREE.Vector2[] = [];

      // Determine polygon winding (CCW    positive area)
      const signedArea = (() => {
        let sum = 0;
        for (let i = 0; i < numPoints; i++) {
          const a = shape2D[i];
          const b = shape2D[(i + 1) % numPoints];
          sum += a.x * b.y - b.x * a.y;
        }
        return sum / 2;
      })();

      // For CCW polygons, outward is the RIGHT normal; for CW, outward is the LEFT normal
      const outwardIsRight = signedArea > 0;
      const outwardNormal = (edge: THREE.Vector2) =>
        outwardIsRight
          ? new THREE.Vector2(edge.y, -edge.x) // right normal
          : new THREE.Vector2(-edge.y, edge.x); // left normal

      for (let i = 0; i < numPoints; i++) {
        const prev = shape2D[(i - 1 + numPoints) % numPoints];
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];

        // Calculate normal vectors for the two adjacent edges
        const edge1 = new THREE.Vector2(curr.x - prev.x, curr.y - prev.y).normalize();
        const edge2 = new THREE.Vector2(next.x - curr.x, next.y - curr.y).normalize();

        // Perpendicular vectors (pointing outward)
        const normal1 = outwardNormal(edge1);
        const normal2 = outwardNormal(edge2);

        // Average normal for the corner
        const avgNormal = new THREE.Vector2(
          (normal1.x + normal2.x) / 2,
          (normal1.y + normal2.y) / 2
        ).normalize();

        // Handle sharp corners by adjusting offset distance
        const dot = normal1.dot(normal2);
        const offsetMult = dot > 0.1 ? 1 / Math.max(0.5, Math.sqrt((1 + dot) / 2)) : 1.5;

        outerShape2D.push(
          new THREE.Vector2(
            curr.x + avgNormal.x * WALL_THICKNESS * offsetMult,
            curr.y + avgNormal.y * WALL_THICKNESS * offsetMult
          )
        );
      }
      
      // Create shell walls (outer walls)
      const shellPositions: number[] = [];
      const shellIndices: number[] = [];
      const outerDepth = depth + WALL_THICKNESS;
      
      for (let i = 0; i < numPoints; i++) {
        const curr = outerShape2D[i];
        const next = outerShape2D[(i + 1) % numPoints];
        
        const baseIdx = i * 4;
        shellPositions.push(
          curr.x, curr.y, 0,
          next.x, next.y, 0,
          next.x, next.y, -outerDepth,
          curr.x, curr.y, -outerDepth
        );
        
        // Reversed winding order so normals face OUTWARD
        shellIndices.push(
          baseIdx, baseIdx + 1, baseIdx + 2,
          baseIdx, baseIdx + 2, baseIdx + 3
        );
      }
      
      const shellGeo = new THREE.BufferGeometry();
      shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
      shellGeo.setIndex(shellIndices);
      shellGeo.computeVertexNormals();
      
      // Create rim geometry for non-rectangular shapes
      const rimPositions: number[] = [];
      const rimIndices: number[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        const innerCurr = shape2D[i];
        const innerNext = shape2D[(i + 1) % numPoints];
        const outerCurr = outerShape2D[i];
        const outerNext = outerShape2D[(i + 1) % numPoints];
        
        const baseIdx = i * 4;
        rimPositions.push(
          innerCurr.x, innerCurr.y, 0,
          innerNext.x, innerNext.y, 0,
          outerNext.x, outerNext.y, 0,
          outerCurr.x, outerCurr.y, 0
        );
        
        rimIndices.push(
          baseIdx, baseIdx + 1, baseIdx + 2,
          baseIdx, baseIdx + 2, baseIdx + 3
        );
      }
      
      const rimGeo = new THREE.BufferGeometry();
      rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
      rimGeo.setIndex(rimIndices);
      rimGeo.computeVertexNormals();
      
      const edgePoints: [number, number, number][][] = [];
      
      // Inner top rim
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        edgePoints.push([[curr.x, curr.y, 0], [next.x, next.y, 0]]);
      }
      
      // Outer top rim
      for (let i = 0; i < numPoints; i++) {
        const curr = outerShape2D[i];
        const next = outerShape2D[(i + 1) % numPoints];
        edgePoints.push([[curr.x, curr.y, 0], [next.x, next.y, 0]]);
      }
      
      // Inner bottom rim
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        edgePoints.push([[curr.x, curr.y, -depth], [next.x, next.y, -depth]]);
      }
      
      // Vertical edges (inner)
      const verticalEdgeCount = Math.min(numPoints, 8);
      const step = Math.max(1, Math.floor(numPoints / verticalEdgeCount));
      for (let i = 0; i < numPoints; i += step) {
        const pt = shape2D[i];
        edgePoints.push([[pt.x, pt.y, 0], [pt.x, pt.y, -depth]]);
      }
      
      return { wallGeometry: wallGeo, bottomGeometry: bottomGeo, edges: edgePoints, shellGeometry: shellGeo, rimGeometry: rimGeo };
    }
  }, [shape, length, width, depth, actualDeepDepth, hasSlope, shape2D, isRectangular]);

  return (
    <group>
      {/* Outer concrete shell - WHITE */}
      {shellGeometry && (
        <mesh geometry={shellGeometry} material={concreteMaterial} />
      )}
      
      {/* Top rim (white, connects inner and outer walls) */}
      {rimGeometry && (
        <mesh geometry={rimGeometry} material={concreteMaterial} />
      )}
      
      {/* Inner walls - BLUE */}
      <mesh geometry={wallGeometry} material={wallMaterial} />
      
      {/* Bottom (blue) */}
      {isRectangular ? (
        <mesh geometry={bottomGeometry!} material={bottomMaterial} />
      ) : (
        <mesh geometry={bottomGeometry!} material={bottomMaterial} position={[0, 0, -depth]} />
      )}
      
      {/* Edges */}
      {edges && edges.map((edge, i) => (
        <Line key={i} points={edge} color={edgeColor} lineWidth={2} />
      ))}
    </group>
  );
}

// Stairs visualization - import from reusable component
import { StairsMesh3D } from '@/components/pool/StairsMesh3D';

// Legacy wrapper for backwards compatibility
function StairsMesh({ dimensions, stairs }: { dimensions: PoolDimensions; stairs: StairsConfig }) {
  if (!stairs.enabled) return null;
  
  return (
    <StairsMesh3D
      length={dimensions.length}
      width={dimensions.width}
      depth={dimensions.depth}
      stairs={stairs}
    />
  );
}

// Wading pool visualization - always in corner, walls extend to pool floor
// Uses corner + direction for 8 possible configurations
function WadingPoolMesh({ dimensions, wadingPool }: { dimensions: PoolDimensions; wadingPool: WadingPoolConfig }) {
  if (!wadingPool.enabled) return null;
  
  const { shape, length, width, depth } = dimensions;
  // Provide defaults for all wading pool properties to avoid NaN/undefined
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';
  const wpWidth = typeof wadingPool.width === 'number' && !isNaN(wadingPool.width) ? wadingPool.width : 2;
  const wpLength = typeof wadingPool.length === 'number' && !isNaN(wadingPool.length) ? wadingPool.length : 1.5;
  const wpDepth = typeof wadingPool.depth === 'number' && !isNaN(wadingPool.depth) && wadingPool.depth > 0 ? wadingPool.depth : 0.4;
  
  const halfL = (length || 8) / 2;
  const halfW = (width || 4) / 2;
  
  const poolDepth = depth || 1.5;
  const internalWallHeight = poolDepth - wpDepth;
  

  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5',
    }), []);

  const concreteMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
    }), []);

  const cornerConfig = useMemo(() => {
    // Size depends on direction
    const isAlongLength = direction === 'along-length';
    const sizeX = isAlongLength ? wpWidth : wpLength;
    const sizeY = isAlongLength ? wpLength : wpWidth;
    
    // Calculate position based on corner
    let posX = 0, posY = 0;
    let wallXSide = 1, wallYSide = 1;
    
    switch (corner) {
      case 'back-left':
        posX = -halfL + sizeX / 2;
        posY = -halfW + sizeY / 2;
        wallXSide = 1;
        wallYSide = 1;
        break;
      case 'back-right':
        posX = halfL - sizeX / 2;
        posY = -halfW + sizeY / 2;
        wallXSide = -1;
        wallYSide = 1;
        break;
      case 'front-left':
        posX = -halfL + sizeX / 2;
        posY = halfW - sizeY / 2;
        wallXSide = 1;
        wallYSide = -1;
        break;
      case 'front-right':
        posX = halfL - sizeX / 2;
        posY = halfW - sizeY / 2;
        wallXSide = -1;
        wallYSide = -1;
        break;
    }
    
    return { posX, posY, wallXSide, wallYSide, sizeX, sizeY };
  }, [corner, direction, halfL, halfW, wpLength, wpWidth]);

  const { posX, posY, sizeX, sizeY, wallXSide, wallYSide } = cornerConfig;

  return (
    <group position={[posX, posY, 0]}>
      {/* Floor of wading pool (płaskie dno brodzika) */}
      <mesh position={[0, 0, -wpDepth]}>
        <boxGeometry args={[sizeX, sizeY, WALL_THICKNESS]} />
        <meshStandardMaterial color="#0369a1" />
      </mesh>
      
      {/* Water in wading pool removed */}
      
      {/* Internal wall along X axis - extends from wading pool floor to main pool floor */}
      <mesh 
        position={[0, wallYSide * sizeY / 2, -wpDepth - internalWallHeight / 2]} 
        material={concreteMaterial}
      >
        <boxGeometry args={[sizeX + WALL_THICKNESS, WALL_THICKNESS, internalWallHeight]} />
      </mesh>
      
      {/* Internal wall along Y axis - extends from wading pool floor to main pool floor */}
      <mesh 
        position={[wallXSide * sizeX / 2, 0, -wpDepth - internalWallHeight / 2]} 
        material={concreteMaterial}
      >
        <boxGeometry args={[WALL_THICKNESS, sizeY + WALL_THICKNESS, internalWallHeight]} />
      </mesh>
      
      {/* Top portion of internal walls (wading pool depth) */}
      <mesh 
        position={[0, wallYSide * sizeY / 2, -wpDepth / 2]} 
        material={wallMaterial}
      >
        <boxGeometry args={[sizeX + WALL_THICKNESS, WALL_THICKNESS, wpDepth]} />
      </mesh>
      
      <mesh 
        position={[wallXSide * sizeX / 2, 0, -wpDepth / 2]} 
        material={wallMaterial}
      >
        <boxGeometry args={[WALL_THICKNESS, sizeY + WALL_THICKNESS, wpDepth]} />
      </mesh>
    </group>
  );
}

// Foil lines visualization - shows SEAMS (joints) between strips, not strip centers
function FoilLines({ dimensions, rollWidth }: { dimensions: PoolDimensions; rollWidth: number }) {
  const { length, width, depth, depthDeep, hasSlope } = dimensions;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  const FOLD_AT_BOTTOM = 0.15; // 15cm fold at wall-bottom transition
  
  // Generate seam lines (where strips meet)
  const seamLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    
    // === BOTTOM SEAMS ===
    // Strips go across the pool perpendicular to the longer side
    const longerSide = Math.max(length, width);
    const shorterSide = Math.min(length, width);
    const isLengthLonger = length >= width;
    
    const bottomOverlap = 0.05; // 5cm overlap for bottom
    const effectiveBottomWidth = rollWidth - bottomOverlap;
    
    // Calculate how many strips needed for bottom
    const bottomStripsNeeded = Math.ceil(shorterSide / effectiveBottomWidth);
    
    // Only draw seams if more than 1 strip is needed
    if (bottomStripsNeeded > 1) {
      // Seam positions are at strip boundaries
      let seamPos = -shorterSide / 2 + rollWidth - bottomOverlap / 2;
      
      for (let i = 1; i < bottomStripsNeeded; i++) {
        if (seamPos < shorterSide / 2 - bottomOverlap) {
          if (isLengthLonger) {
            lines.push([
              [-longerSide / 2, seamPos, -depth - 0.01],
              [longerSide / 2, seamPos, hasSlope ? -actualDeep - 0.01 : -depth - 0.01]
            ]);
          } else {
            lines.push([
              [seamPos, -longerSide / 2, -depth - 0.01],
              [seamPos, longerSide / 2, hasSlope ? -actualDeep - 0.01 : -depth - 0.01]
            ]);
          }
        }
        seamPos += effectiveBottomWidth;
      }
    }
    
    // === WALL SEAMS ===
    // Only show seams if wall height + fold exceeds roll width
    const wallOverlap = 0.10; // 10cm overlap for walls
    const effectiveWallWidth = rollWidth - wallOverlap;
    
    // Calculate total height to cover (wall + fold at bottom)
    const shallowWallTotal = depth + FOLD_AT_BOTTOM;
    const deepWallTotal = actualDeep + FOLD_AT_BOTTOM;
    
    // Shallow walls (front, back, left) - only add seams if multiple strips needed
    const shallowStripsNeeded = Math.ceil(shallowWallTotal / effectiveWallWidth);
    
    if (shallowStripsNeeded > 1) {
      // Front wall (+Y)
      let seamZ = -rollWidth + wallOverlap / 2;
      for (let i = 1; i < shallowStripsNeeded; i++) {
        if (seamZ > -depth) {
          lines.push([
            [-length / 2, width / 2 - 0.01, seamZ],
            [length / 2, width / 2 - 0.01, seamZ]
          ]);
        }
        seamZ -= effectiveWallWidth;
      }
      
      // Back wall (-Y)
      seamZ = -rollWidth + wallOverlap / 2;
      for (let i = 1; i < shallowStripsNeeded; i++) {
        if (seamZ > -depth) {
          lines.push([
            [-length / 2, -width / 2 + 0.01, seamZ],
            [length / 2, -width / 2 + 0.01, seamZ]
          ]);
        }
        seamZ -= effectiveWallWidth;
      }
      
      // Left wall (-X)
      seamZ = -rollWidth + wallOverlap / 2;
      for (let i = 1; i < shallowStripsNeeded; i++) {
        if (seamZ > -depth) {
          lines.push([
            [-length / 2 + 0.01, -width / 2, seamZ],
            [-length / 2 + 0.01, width / 2, seamZ]
          ]);
        }
        seamZ -= effectiveWallWidth;
      }
    }
    
    // Right wall (+X) - deep side, may need more strips
    const deepStripsNeeded = Math.ceil(deepWallTotal / effectiveWallWidth);
    
    if (deepStripsNeeded > 1) {
      let seamZ = -rollWidth + wallOverlap / 2;
      for (let i = 1; i < deepStripsNeeded; i++) {
        if (seamZ > -actualDeep) {
          lines.push([
            [length / 2 - 0.01, -width / 2, seamZ],
            [length / 2 - 0.01, width / 2, seamZ]
          ]);
        }
        seamZ -= effectiveWallWidth;
      }
    }
    
    return lines;
  }, [dimensions, rollWidth, length, width, depth, actualDeep, hasSlope]);

  // Only render if there are seams to show
  if (seamLines.length === 0) {
    return null;
  }

  return (
    <>
      {seamLines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#dc2626"
          lineWidth={2}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      ))}
    </>
  );
}

// Dimension lines
function DimensionLine({ start, end, label, color = '#475569' }: { 
  start: [number, number, number]; 
  end: [number, number, number]; 
  label: string;
  color?: string;
}) {
  const midPoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1.5} />
      {/* End caps */}
      <Line
        points={[[start[0], start[1] - 0.1, start[2]], [start[0], start[1] + 0.1, start[2]]]}
        color={color}
        lineWidth={1}
      />
      <Line
        points={[[end[0], end[1] - 0.1, end[2]], [end[0], end[1] + 0.1, end[2]]]}
        color={color}
        lineWidth={1}
      />
      <Html position={midPoint} center>
        <div className="bg-background/95 px-2 py-0.5 rounded text-xs font-semibold text-foreground border border-border shadow-sm whitespace-nowrap">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Corner labels for pool vertices (A, B, C, D...)
function CornerLabels({ dimensions }: { dimensions: PoolDimensions }) {
  const { shape, length, width, customVertices } = dimensions;
  
  // Don't show labels for oval shapes
  if (shape === 'owalny') return null;
  
  // Get corner points based on shape
  const corners = useMemo(() => {
    if (shape === 'nieregularny' && customVertices && customVertices.length >= 3) {
      // For irregular shapes, use custom vertices centered
      const minX = Math.min(...customVertices.map(v => v.x));
      const maxX = Math.max(...customVertices.map(v => v.x));
      const minY = Math.min(...customVertices.map(v => v.y));
      const maxY = Math.max(...customVertices.map(v => v.y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      return customVertices.map(v => ({
        x: v.x - centerX,
        y: v.y - centerY
      }));
    }
    
    // For rectangular shape, return 4 corners
    const halfL = length / 2;
    const halfW = width / 2;
    return [
      { x: -halfL, y: -halfW }, // A - back-left
      { x: halfL, y: -halfW },  // B - back-right
      { x: halfL, y: halfW },   // C - front-right
      { x: -halfL, y: halfW }   // D - front-left
    ];
  }, [shape, length, width, customVertices]);
  
  return (
    <group>
      {corners.map((corner, index) => (
        <group key={`corner-${index}`}>
          {/* Corner marker sphere */}
          <mesh position={[corner.x, corner.y, 0.05]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#0c4a6e" />
          </mesh>
          {/* Corner label */}
          <Html position={[corner.x + 0.2, corner.y + 0.2, 0.15]} center>
            <div className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs font-bold shadow-md">
              {getCornerLabel(index)}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// Pool dimension lines (main pool only) - offset increased for better readability
function PoolDimensionLines({ dimensions }: { dimensions: PoolDimensions }) {
  const { shape, length, width, depth, depthDeep, hasSlope, customVertices } = dimensions;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  const offset = 1.2; // Increased offset for better visibility
  
  // Calculate actual pool dimensions based on shape
  let poolLength = length;
  let poolWidth = width;
  
  if (shape === 'nieregularny' && customVertices && customVertices.length >= 3) {
    const minX = Math.min(...customVertices.map(v => v.x));
    const maxX = Math.max(...customVertices.map(v => v.x));
    const minY = Math.min(...customVertices.map(v => v.y));
    const maxY = Math.max(...customVertices.map(v => v.y));
    poolLength = maxX - minX;
    poolWidth = maxY - minY;
  }
  
  const halfL = poolLength / 2;
  const halfW = poolWidth / 2;
  
  return (
    <group>
      {/* Corner labels */}
      <CornerLabels dimensions={dimensions} />
      
      {/* Length */}
      <DimensionLine
        start={[-halfL, -halfW - offset, 0]}
        end={[halfL, -halfW - offset, 0]}
        label={`${poolLength.toFixed(2)} m`}
      />
      
      {/* Width */}
      <DimensionLine
        start={[halfL + offset, -halfW, 0]}
        end={[halfL + offset, halfW, 0]}
        label={`${poolWidth.toFixed(2)} m`}
      />
      
      {/* Depth shallow (left side) */}
      <group>
        <Line
          points={[
            [-halfL - offset, halfW + offset, 0],
            [-halfL - offset, halfW + offset, -depth]
          ]}
          color="#475569"
          lineWidth={1.5}
        />
        <Html position={[-halfL - offset - 0.5, halfW + offset, -depth / 2]} center>
          <div className="bg-background/95 px-2 py-0.5 rounded text-xs font-semibold text-foreground border border-border shadow-sm whitespace-nowrap">
            {depth.toFixed(2)} m{hasSlope ? ' (płytko)' : ''}
          </div>
        </Html>
      </group>
      
      {/* Depth deep (right side) - only if slope */}
      {hasSlope && (
        <group>
          <Line
            points={[
              [halfL + offset, halfW + offset, 0],
              [halfL + offset, halfW + offset, -actualDeep]
            ]}
            color="#f97316"
            lineWidth={1.5}
          />
          <Html position={[halfL + offset + 0.5, halfW + offset, -actualDeep / 2]} center>
            <div className="bg-orange-50 px-2 py-0.5 rounded text-xs font-semibold text-orange-700 border border-orange-200 shadow-sm whitespace-nowrap">
              {actualDeep.toFixed(2)} m (głęboko)
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

// Stairs dimension lines wrapper (dimensions are rendered inside CustomStairsMesh)
function StairsDimensionLines({ dimensions }: { dimensions: PoolDimensions }) {
  // For regular stairs (non-custom), show dimensions
  if (!dimensions.stairs?.enabled) return null;
  if (dimensions.shape === 'nieregularny') return null; // Custom stairs have their own dimension lines
  
  const { length, width, depth } = dimensions;
  const stairs = dimensions.stairs;
  const halfL = length / 2;
  const halfW = width / 2;
  // Handle "full" width - use pool width if full, otherwise use specified value
  const stairsWidth = stairs.width === 'full' ? width : (typeof stairs.width === 'number' ? stairs.width : 1.5);
  
  const placement = stairs.placement || 'wall';
  const wall = stairs.wall || 'back';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  // Use configured stepCount, calculate stairsLength based on stepCount × stepDepth
  const stepCount = stairs.stepCount || 4;
  const stepDepth = stairs.stepDepth || 0.30;
  const stairsLength = stepCount * stepDepth;
  
  // Calculate position based on placement
  let posX: number, posY: number, dirX: number, dirY: number;
  let isAlongLength: boolean;
  
  if (placement === 'wall') {
    switch (wall) {
      case 'back': posX = 0; posY = -halfW; dirX = 0; dirY = 1; isAlongLength = true; break;
      case 'front': posX = 0; posY = halfW; dirX = 0; dirY = -1; isAlongLength = true; break;
      case 'left': posX = -halfL; posY = 0; dirX = 1; dirY = 0; isAlongLength = false; break;
      case 'right': posX = halfL; posY = 0; dirX = -1; dirY = 0; isAlongLength = false; break;
      default: posX = 0; posY = -halfW; dirX = 0; dirY = 1; isAlongLength = true;
    }
  } else {
    isAlongLength = direction === 'along-length';
    posX = corner.includes('left') ? -halfL : halfL;
    posY = corner.includes('back') ? -halfW : halfW;
    dirX = corner.includes('left') ? 1 : -1;
    dirY = corner.includes('back') ? 1 : -1;
  }
  
  return (
    <group>
      {isAlongLength ? (
        <>
          {/* Width (perpendicular to stairs direction) */}
          <DimensionLine
            start={[posX - stairsWidth / 2, posY + dirY * stairsLength + dirY * 0.8, 0.05]}
            end={[posX + stairsWidth / 2, posY + dirY * stairsLength + dirY * 0.8, 0.05]}
            label={`${stairsWidth.toFixed(2)} m`}
            color="#f97316"
          />
          {/* Length (along stairs direction) */}
          <DimensionLine
            start={[posX + stairsWidth / 2 + 0.5, posY, 0.05]}
            end={[posX + stairsWidth / 2 + 0.5, posY + dirY * stairsLength, 0.05]}
            label={`${stairsLength.toFixed(2)} m`}
            color="#f97316"
          />
        </>
      ) : (
        <>
          {/* Width (perpendicular to stairs direction) */}
          <DimensionLine
            start={[posX + dirX * stairsLength + dirX * 0.8, posY - stairsWidth / 2, 0.05]}
            end={[posX + dirX * stairsLength + dirX * 0.8, posY + stairsWidth / 2, 0.05]}
            label={`${stairsWidth.toFixed(2)} m`}
            color="#f97316"
          />
          {/* Length (along stairs direction) */}
          <DimensionLine
            start={[posX, posY + stairsWidth / 2 + 0.5, 0.05]}
            end={[posX + dirX * stairsLength, posY + stairsWidth / 2 + 0.5, 0.05]}
            label={`${stairsLength.toFixed(2)} m`}
            color="#f97316"
          />
        </>
      )}
    </group>
  );
}

// Wading pool dimension lines wrapper (dimensions are rendered inside CustomWadingPoolMesh)
function WadingDimensionLines({ dimensions }: { dimensions: PoolDimensions }) {
  // For regular wading pool (non-custom), show dimensions
  if (!dimensions.wadingPool?.enabled) return null;
  if (dimensions.shape === 'nieregularny') return null; // Custom wading pools have their own dimension lines
  
  const { length, width, depth } = dimensions;
  const wadingPool = dimensions.wadingPool;
  const halfL = length / 2;
  const halfW = width / 2;
  
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';
  const isAlongLength = direction === 'along-length';
  const wpWidth = wadingPool.width || 2;
  const wpLength = wadingPool.length || 1.5;
  const wpDepth = wadingPool.depth || 0.4;
  
  const sizeX = isAlongLength ? wpWidth : wpLength;
  const sizeY = isAlongLength ? wpLength : wpWidth;
  
  let posX = 0, posY = 0;
  switch (corner) {
    case 'back-left':
      posX = -halfL + sizeX / 2;
      posY = -halfW + sizeY / 2;
      break;
    case 'back-right':
      posX = halfL - sizeX / 2;
      posY = -halfW + sizeY / 2;
      break;
    case 'front-left':
      posX = -halfL + sizeX / 2;
      posY = halfW - sizeY / 2;
      break;
    case 'front-right':
      posX = halfL - sizeX / 2;
      posY = halfW - sizeY / 2;
      break;
  }
  
  return (
    <group position={[posX, posY, 0]}>
      <DimensionLine
        start={[-sizeX / 2, -sizeY / 2 - 0.8, -wpDepth + 0.05]}
        end={[sizeX / 2, -sizeY / 2 - 0.8, -wpDepth + 0.05]}
        label={`${sizeX.toFixed(2)} m`}
        color="#8b5cf6"
      />
      <DimensionLine
        start={[sizeX / 2 + 0.8, -sizeY / 2, -wpDepth + 0.05]}
        end={[sizeX / 2 + 0.8, sizeY / 2, -wpDepth + 0.05]}
        label={`${sizeY.toFixed(2)} m`}
        color="#8b5cf6"
      />
      <group>
        <Line
          points={[
            [-sizeX / 2 - 0.8, -sizeY / 2, 0],
            [-sizeX / 2 - 0.8, -sizeY / 2, -wpDepth]
          ]}
          color="#8b5cf6"
          lineWidth={1.5}
        />
        <Html position={[-sizeX / 2 - 1.0, -sizeY / 2, -wpDepth / 2]} center>
          <div className="bg-purple-50 px-2 py-0.5 rounded text-xs font-semibold text-purple-700 border border-purple-200 shadow-sm whitespace-nowrap">
            {wpDepth.toFixed(2)} m
          </div>
        </Html>
      </group>
    </group>
  );
}

// Combined dimension lines with display filter
function DimensionLines({ dimensions, display }: { dimensions: PoolDimensions; display: DimensionDisplay }) {
  if (display === 'none') return null;
  
  const showPool = display === 'all' || display === 'pool';
  const showStairs = display === 'all' || display === 'stairs';
  const showWading = display === 'all' || display === 'wading';
  
  return (
    <group>
      {showPool && <PoolDimensionLines dimensions={dimensions} />}
      {showStairs && <StairsDimensionLines dimensions={dimensions} />}
      {showWading && <WadingDimensionLines dimensions={dimensions} />}
    </group>
  );
}

// Custom stairs mesh (from drawn vertices) - uses actual polygon shape
// Supports 8 rotation angles: 0, 45, 90, 135, 180, 225, 270, 315 degrees
function CustomStairsMesh({ vertices, depth, poolVertices, rotation = 0, showDimensions = true, stairsConfig }: { 
  vertices: CustomPoolVertex[]; 
  depth: number;
  poolVertices: CustomPoolVertex[];
  rotation?: number; // 0, 45, 90, 135, 180, 225, 270, 315 degrees
  showDimensions?: boolean;
  stairsConfig?: StairsConfig;
}) {
  // Use stairs config values if provided, otherwise fall back to defaults
  // Calculate step height based on formula: riserHeight = poolDepth / (stepCount + 1)
  const configStepCount = stairsConfig?.stepCount || 4;
  const stepCount = configStepCount;
  const stepHeight = depth / (stepCount + 1);
  
  const stepTopMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: '#ffffff', 
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }), []);
  const stepFrontMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ 
      color: '#5b9bd5',
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }), []);

  // Calculate pool center (same as getPoolShape uses for custom pools)
  const poolCenter = useMemo(() => {
    if (!poolVertices || poolVertices.length < 3) return { x: 0, y: 0 };
    const minX = Math.min(...poolVertices.map(v => v.x));
    const maxX = Math.max(...poolVertices.map(v => v.x));
    const minY = Math.min(...poolVertices.map(v => v.y));
    const maxY = Math.max(...poolVertices.map(v => v.y));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }, [poolVertices]);

  // Transform stairs vertices to be relative to pool center (same transform as pool)
  const transformedVertices = useMemo(() => 
    vertices.map(v => ({ x: v.x - poolCenter.x, y: v.y - poolCenter.y })),
  [vertices, poolCenter]);

  // Calculate bounding box for step sizing and dimensions
  const bounds = useMemo(() => {
    const xs = transformedVertices.map(v => v.x);
    const ys = transformedVertices.map(v => v.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  }, [transformedVertices]);

  const sizeX = bounds.maxX - bounds.minX;
  const sizeY = bounds.maxY - bounds.minY;
  
  // Check if rotation is diagonal (45, 135, 225, 315)
  const isDiagonal = rotation === 45 || rotation === 135 || rotation === 225 || rotation === 315;

  // Create stairs using actual polygon shape with ExtrudeGeometry
  const steps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];
    if (transformedVertices.length < 3) return stepsArr;
    
    // For diagonal angles, use diagonal slicing approach
    if (isDiagonal) {
      // Calculate the diagonal extent - the polygon will be sliced diagonally
      const diagonalExtent = Math.sqrt(sizeX * sizeX + sizeY * sizeY);
      const stepDepth = diagonalExtent / stepCount;
      
      // Determine direction vector based on rotation angle
      // The arrow shows the direction you WALK when entering (where you're going TO)
      // Steps should be sliced so first step is at ENTRY point, last step at bottom
      // Canvas: Y grows DOWN, X grows RIGHT
      // Arrow drawn using: dx = sin(rotation), dy = cos(rotation)
      // 
      // 0°: Arrow points DOWN (0, +1 in canvas), entry from top, steps toward bottom
      // 90°: Arrow points RIGHT (+1, 0), entry from left, steps toward right
      // 180°: Arrow points UP (0, -1), entry from bottom, steps toward top
      // 270°: Arrow points LEFT (-1, 0), entry from right, steps toward left
      // 315°: Arrow points DOWN-LEFT (-0.707, +0.707), entry from top-right, steps toward bottom-left
      
      let dirX: number, dirY: number;
      let startCornerX: number, startCornerY: number;
      
      switch (rotation) {
        case 45: // Arrow points DOWN-RIGHT (+0.707, +0.707), steps go toward maxX, maxY
          dirX = 1 / Math.SQRT2;
          dirY = 1 / Math.SQRT2;
          startCornerX = bounds.minX;
          startCornerY = bounds.minY;
          break;
        case 135: // Arrow points UP-RIGHT (+0.707, -0.707), steps go toward maxX, minY
          dirX = 1 / Math.SQRT2;
          dirY = -1 / Math.SQRT2;
          startCornerX = bounds.minX;
          startCornerY = bounds.maxY;
          break;
        case 225: // Arrow points UP-LEFT (-0.707, -0.707), steps go toward minX, minY
          dirX = -1 / Math.SQRT2;
          dirY = -1 / Math.SQRT2;
          startCornerX = bounds.maxX;
          startCornerY = bounds.maxY;
          break;
        case 315: // Arrow points DOWN-LEFT (-0.707, +0.707), steps go toward minX, maxY
        default:
          dirX = -1 / Math.SQRT2;
          dirY = 1 / Math.SQRT2;
          startCornerX = bounds.maxX;
          startCornerY = bounds.minY;
          break;
      }
      
      for (let i = 0; i < stepCount; i++) {
        // Step tops start one riser below the pool edge (consistent with stepHeight = depth/(stepCount+1))
        const stepTopZ = -(i + 1) * stepHeight;
        const stepBodyHeight = depth - ((i + 1) * stepHeight);
        
        // Calculate slice positions along the diagonal
        const startDist = i * stepDepth;
        const endDist = (i + 1) * stepDepth;
        
        // Slice the polygon diagonally
        const slicedVertices = slicePolygonDiagonal(
          transformedVertices,
          startCornerX, startCornerY,
          dirX, dirY,
          startDist, endDist
        );
        
        if (slicedVertices.length < 3) continue;
        
        // Create shape from sliced vertices
        const shape2D = slicedVertices.map(v => new THREE.Vector2(v.x, v.y));
        const stepShape = new THREE.Shape(shape2D);
        
        const stepBodyGeo = new THREE.ExtrudeGeometry(stepShape, {
          depth: stepBodyHeight,
          bevelEnabled: false,
        });
        stepBodyGeo.translate(0, 0, stepTopZ - stepBodyHeight);
        
        const stepTopGeo = new THREE.ShapeGeometry(stepShape);
        
        stepsArr.push(
          <group key={i}>
            <mesh geometry={stepBodyGeo} material={stepFrontMaterial} />
            <mesh position={[0, 0, stepTopZ - 0.01]} geometry={stepTopGeo} material={stepTopMaterial} />
          </group>
        );
      }
      
      return stepsArr;
    }
    
    // For orthogonal angles (0, 90, 180, 270), use existing axis-aligned slicing
    const isHorizontal = rotation === 90 || rotation === 270;
    const stairsExtent = isHorizontal ? sizeX : sizeY;
    const stepDepth = stairsExtent / stepCount;
    
     for (let i = 0; i < stepCount; i++) {
       // Step tops start one riser below the pool edge (consistent with stepHeight = depth/(stepCount+1))
       const stepTopZ = -(i + 1) * stepHeight;
       const stepBodyHeight = depth - ((i + 1) * stepHeight);
      
      // Calculate slice ratio for this step
      const startRatio = i / stepCount;
      const endRatio = (i + 1) / stepCount;
      
      // Slice the polygon based on rotation direction
      // NOTE: Canvas Y axis is inverted (Y grows downward), so rotation 0/180 are swapped
      let slicedVertices: { x: number; y: number }[];
      
      if (rotation === 0) {
        // Entry from top in canvas (Y grows down), so in 3D we slice from minY to maxY
        // First step at minY (top in 3D), last step at maxY (bottom in 3D)
        const yStart = bounds.minY + startRatio * sizeY;
        const yEnd = bounds.minY + endRatio * sizeY;
        slicedVertices = slicePolygonY(transformedVertices, yStart, yEnd);
      } else if (rotation === 180) {
        // Entry from bottom in canvas, so in 3D we slice from maxY to minY
        const yStart = bounds.maxY - startRatio * sizeY;
        const yEnd = bounds.maxY - endRatio * sizeY;
        slicedVertices = slicePolygonY(transformedVertices, yEnd, yStart);
      } else if (rotation === 90) {
        // Entry from right (X+), steps slice along X axis from max to min
        const xStart = bounds.maxX - startRatio * sizeX;
        const xEnd = bounds.maxX - endRatio * sizeX;
        slicedVertices = slicePolygonX(transformedVertices, xEnd, xStart);
      } else {
        // rotation === 270: Entry from left (X-), steps slice along X axis from min to max
        const xStart = bounds.minX + startRatio * sizeX;
        const xEnd = bounds.minX + endRatio * sizeX;
        slicedVertices = slicePolygonX(transformedVertices, xStart, xEnd);
      }
      
      if (slicedVertices.length < 3) continue;
      
      // Create shape from sliced vertices
      const shape2D = slicedVertices.map(v => new THREE.Vector2(v.x, v.y));
      const stepShape = new THREE.Shape(shape2D);
      
      // Create extruded geometry for step body
      // IMPORTANT: all pool geometry uses Z as depth (down). The whole scene is rotated later,
      // so we must NOT rotate extrusions here (it caused skewed/empty spaces).
      const stepBodyGeo = new THREE.ExtrudeGeometry(stepShape, {
        depth: stepBodyHeight,
        bevelEnabled: false,
      });
      // ExtrudeGeometry extrudes along +Z from 0..depth; move it so the top is at stepTopZ.
      stepBodyGeo.translate(0, 0, stepTopZ - stepBodyHeight);
      
      // Create thin surface for step top
      const stepTopGeo = new THREE.ShapeGeometry(stepShape);
      
      stepsArr.push(
        <group key={i}>
          {/* Step body (blue) */}
          <mesh geometry={stepBodyGeo} material={stepFrontMaterial} />
          {/* Step top surface (white) */}
          <mesh position={[0, 0, stepTopZ - 0.01]} geometry={stepTopGeo} material={stepTopMaterial} />
        </group>
      );
    }
    return stepsArr;
  }, [stepCount, stepHeight, depth, bounds, transformedVertices, rotation, sizeX, sizeY, stepTopMaterial, stepFrontMaterial]);

  return (
    <group>
      {steps}
      {/* Dimension lines for custom stairs - only show if showDimensions is true */}
      {showDimensions && (
        <>
          {/* Width dimension - moved further away */}
          <DimensionLine
            start={[bounds.minX, bounds.minY - 1.0, 0.05]}
            end={[bounds.maxX, bounds.minY - 1.0, 0.05]}
            label={`${sizeX.toFixed(2)} m`}
            color="#f97316"
          />
          {/* Length dimension - moved further away */}
          <DimensionLine
            start={[bounds.maxX + 1.0, bounds.minY, 0.05]}
            end={[bounds.maxX + 1.0, bounds.maxY, 0.05]}
            label={`${sizeY.toFixed(2)} m`}
            color="#f97316"
          />
        </>
      )}
    </group>
  );
}

// Helper: Slice polygon horizontally (by Y range)
function slicePolygonY(vertices: { x: number; y: number }[], yMin: number, yMax: number): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const n = vertices.length;
  
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    
    // Check if current point is in range
    if (curr.y >= yMin && curr.y <= yMax) {
      result.push(curr);
    }
    
    // Check for intersections with yMin and yMax
    if ((curr.y < yMin && next.y > yMin) || (curr.y > yMin && next.y < yMin)) {
      const t = (yMin - curr.y) / (next.y - curr.y);
      result.push({ x: curr.x + t * (next.x - curr.x), y: yMin });
    }
    if ((curr.y < yMax && next.y > yMax) || (curr.y > yMax && next.y < yMax)) {
      const t = (yMax - curr.y) / (next.y - curr.y);
      result.push({ x: curr.x + t * (next.x - curr.x), y: yMax });
    }
  }
  
  // Sort points to form a proper polygon (clockwise order)
  if (result.length < 3) return result;
  
  const cx = result.reduce((s, v) => s + v.x, 0) / result.length;
  const cy = result.reduce((s, v) => s + v.y, 0) / result.length;
  result.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  
  return result;
}

// Helper: Slice polygon vertically (by X range)
function slicePolygonX(vertices: { x: number; y: number }[], xMin: number, xMax: number): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const n = vertices.length;
  
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    
    // Check if current point is in range
    if (curr.x >= xMin && curr.x <= xMax) {
      result.push(curr);
    }
    
    // Check for intersections with xMin and xMax
    if ((curr.x < xMin && next.x > xMin) || (curr.x > xMin && next.x < xMin)) {
      const t = (xMin - curr.x) / (next.x - curr.x);
      result.push({ x: xMin, y: curr.y + t * (next.y - curr.y) });
    }
    if ((curr.x < xMax && next.x > xMax) || (curr.x > xMax && next.x < xMax)) {
      const t = (xMax - curr.x) / (next.x - curr.x);
      result.push({ x: xMax, y: curr.y + t * (next.y - curr.y) });
    }
  }
  
  // Sort points to form a proper polygon (clockwise order)
  if (result.length < 3) return result;
  
  const cx = result.reduce((s, v) => s + v.x, 0) / result.length;
  const cy = result.reduce((s, v) => s + v.y, 0) / result.length;
  result.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  
  return result;
}

// Helper: Slice polygon diagonally using two parallel lines perpendicular to direction
function slicePolygonDiagonal(
  vertices: { x: number; y: number }[],
  startX: number, startY: number,
  dirX: number, dirY: number,
  distStart: number, distEnd: number
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const n = vertices.length;
  
  // For each vertex, calculate its distance along the slice direction from start point
  const getDistance = (v: { x: number; y: number }) => {
    return (v.x - startX) * dirX + (v.y - startY) * dirY;
  };
  
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    
    const currDist = getDistance(curr);
    const nextDist = getDistance(next);
    
    // Check if current point is in range
    if (currDist >= distStart && currDist <= distEnd) {
      result.push(curr);
    }
    
    // Check for intersections with start line
    if ((currDist < distStart && nextDist > distStart) || (currDist > distStart && nextDist < distStart)) {
      const t = (distStart - currDist) / (nextDist - currDist);
      result.push({ 
        x: curr.x + t * (next.x - curr.x), 
        y: curr.y + t * (next.y - curr.y) 
      });
    }
    
    // Check for intersections with end line
    if ((currDist < distEnd && nextDist > distEnd) || (currDist > distEnd && nextDist < distEnd)) {
      const t = (distEnd - currDist) / (nextDist - currDist);
      result.push({ 
        x: curr.x + t * (next.x - curr.x), 
        y: curr.y + t * (next.y - curr.y) 
      });
    }
  }
  
  // Sort points to form a proper polygon (clockwise order around centroid)
  if (result.length < 3) return result;
  
  const cx = result.reduce((s, v) => s + v.x, 0) / result.length;
  const cy = result.reduce((s, v) => s + v.y, 0) / result.length;
  result.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  
  return result;
}

// Custom wading pool mesh (from drawn vertices) - uses actual polygon shape
function CustomWadingPoolMesh({ vertices, wadingDepth, poolDepth, poolVertices, showDimensions = true }: { 
  vertices: CustomPoolVertex[]; 
  wadingDepth: number;
  poolDepth: number;
  poolVertices: CustomPoolVertex[];
  showDimensions?: boolean;
}) {
  const floorMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#5b9bd5' }), []);
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#5b9bd5' }), []);
  const rimMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), []);

  const RIM_WIDTH = 0.15;

  // Calculate pool center
  const poolCenter = useMemo(() => {
    if (!poolVertices || poolVertices.length < 3) return { x: 0, y: 0 };
    const minX = Math.min(...poolVertices.map(v => v.x));
    const maxX = Math.max(...poolVertices.map(v => v.x));
    const minY = Math.min(...poolVertices.map(v => v.y));
    const maxY = Math.max(...poolVertices.map(v => v.y));
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }, [poolVertices]);

  // Transform wading pool vertices to be relative to pool center
  const transformedVertices = useMemo(() => 
    vertices.map(v => ({ x: v.x - poolCenter.x, y: v.y - poolCenter.y })),
  [vertices, poolCenter]);

  // Transform pool vertices for edge detection
  const transformedPoolVertices = useMemo(() => 
    poolVertices.map(v => ({ x: v.x - poolCenter.x, y: v.y - poolCenter.y })),
  [poolVertices, poolCenter]);

  // Create shape from actual polygon vertices
  const shape2D = useMemo(() => transformedVertices.map(v => new THREE.Vector2(v.x, v.y)), [transformedVertices]);
  const shapeObj = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  const floorGeo = useMemo(() => new THREE.ShapeGeometry(shapeObj), [shapeObj]);

  // Create extruded platform geometry using actual shape
  // Keep Z as depth (down). No extra rotation here.
  const platformHeight = poolDepth - wadingDepth;
  const platformGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(shapeObj, {
      depth: platformHeight,
      bevelEnabled: false,
    });
    // Place platform from z=-poolDepth up to z=-wadingDepth
    geo.translate(0, 0, -poolDepth);
    return geo;
  }, [shapeObj, platformHeight, poolDepth]);

  const bounds = useMemo(() => {
    const xs = transformedVertices.map(v => v.x);
    const ys = transformedVertices.map(v => v.y);
    return { 
      sizeX: Math.max(...xs) - Math.min(...xs), 
      sizeY: Math.max(...ys) - Math.min(...ys),
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [transformedVertices]);

  const floorZ = -wadingDepth;

  // Check which edges are internal (not touching pool boundary)
  const poolBounds = useMemo(() => {
    const xs = transformedPoolVertices.map(v => v.x);
    const ys = transformedPoolVertices.map(v => v.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [transformedPoolVertices]);

  // Generate walls and rims from actual polygon edges
  const { walls, rims } = useMemo(() => {
    const wallElements: JSX.Element[] = [];
    const rimElements: JSX.Element[] = [];
    const threshold = 0.3;
    
    for (let i = 0; i < transformedVertices.length; i++) {
      const curr = transformedVertices[i];
      const next = transformedVertices[(i + 1) % transformedVertices.length];
      
      // Calculate edge midpoint
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      
      // Check if this edge is internal (not on pool boundary)
      const isOnPoolBoundary = 
        (Math.abs(midX - poolBounds.minX) < threshold) ||
        (Math.abs(midX - poolBounds.maxX) < threshold) ||
        (Math.abs(midY - poolBounds.minY) < threshold) ||
        (Math.abs(midY - poolBounds.maxY) < threshold);
      
      // Also check if edge is close to any pool edge
      const distToPoolEdge = Math.min(
        pointToLineDistance({ x: midX, y: midY }, transformedPoolVertices)
      );
      
      if (isOnPoolBoundary || distToPoolEdge < threshold) continue;
      
      // This is an internal edge - create wall and rim
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Wall
      wallElements.push(
        <mesh 
          key={`wall-${i}`}
          position={[midX, midY, floorZ - wadingDepth / 2]}
          rotation={[0, 0, angle]}
          material={wallMaterial}
        >
          <boxGeometry args={[length, RIM_WIDTH, wadingDepth]} />
        </mesh>
      );
      
      // White rim on top
      rimElements.push(
        <mesh 
          key={`rim-${i}`}
          position={[midX, midY, 0]}
          rotation={[0, 0, angle]}
          material={rimMaterial}
        >
          <boxGeometry args={[length + RIM_WIDTH, RIM_WIDTH, RIM_WIDTH]} />
        </mesh>
      );
    }
    
    return { walls: wallElements, rims: rimElements };
  }, [transformedVertices, transformedPoolVertices, poolBounds, floorZ, wadingDepth, wallMaterial, rimMaterial]);

  // Water shape (slightly inset from wading pool shape)

  const { minX, maxX, minY, maxY, sizeX, sizeY } = bounds;

  return (
    <group>
      {/* Platform using actual polygon shape */}
      <mesh geometry={platformGeo} material={wallMaterial} />
      
      {/* Floor surface */}
      <mesh position={[0, 0, floorZ]} geometry={floorGeo} material={floorMaterial} />
      
      {/* Internal walls and rims */}
      {walls}
      {rims}
      
      {/* Water removed */}
      
      {/* Dimension lines - only show if showDimensions is true, with larger offset */}
      {showDimensions && (
        <>
          <DimensionLine
            start={[minX, minY - 1.0, floorZ + 0.05]}
            end={[maxX, minY - 1.0, floorZ + 0.05]}
            label={`${sizeX.toFixed(2)} m`}
            color="#8b5cf6"
          />
          <DimensionLine
            start={[maxX + 1.0, minY, floorZ + 0.05]}
            end={[maxX + 1.0, maxY, floorZ + 0.05]}
            label={`${sizeY.toFixed(2)} m`}
            color="#8b5cf6"
          />
          <group>
            <Line
              points={[
                [minX - 1.0, minY, 0],
                [minX - 1.0, minY, floorZ]
              ]}
              color="#8b5cf6"
              lineWidth={1.5}
            />
            <Html position={[minX - 1.3, minY, floorZ / 2]} center>
              <div className="bg-purple-50 px-2 py-0.5 rounded text-xs font-semibold text-purple-700 border border-purple-200 shadow-sm whitespace-nowrap">
                {wadingDepth.toFixed(2)} m
              </div>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}

// Helper: Calculate minimum distance from point to polygon edges
function pointToLineDistance(point: { x: number; y: number }, polygon: { x: number; y: number }[]): number {
  let minDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dist = pointToSegmentDistance(point, a, b);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

function pointToSegmentDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

// Helper: Inset polygon by given amount
function insetPolygon(vertices: { x: number; y: number }[], amount: number): { x: number; y: number }[] {
  if (vertices.length < 3) return vertices;
  
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
  
  return vertices.map(v => {
    const dx = v.x - cx;
    const dy = v.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return v;
    const scale = Math.max(0, (len - amount) / len);
    return { x: cx + dx * scale, y: cy + dy * scale };
  });
}

// Main scene
function Scene({ dimensions, calculations: _calculations, showFoilLayout, rollWidth, dimensionDisplay }: Pool3DVisualizationProps & { rollWidth: number; dimensionDisplay: DimensionDisplay }) {
  const isCustomShape = dimensions.shape === 'nieregularny';
  // Check for multiple custom stairs (array of arrays)
  const customStairsArrays = dimensions.customStairsVertices || [];
  const customWadingArrays = dimensions.customWadingPoolVertices || [];
  const hasCustomStairs = isCustomShape && customStairsArrays.length > 0 && customStairsArrays.some(arr => arr.length >= 3);
  const hasCustomWadingPool = isCustomShape && customWadingArrays.length > 0 && customWadingArrays.some(arr => arr.length >= 3);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      
      {/* Rotate entire pool so it lies flat (Z becomes depth going down, Y goes back) */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Pool mesh - solid when showing foil, transparent otherwise */}
        <PoolMesh dimensions={dimensions} solid={showFoilLayout} />
        <DimensionLines dimensions={dimensions} display={dimensionDisplay} />
        
        {/* Custom stairs from drawn vertices - render all */}
        {hasCustomStairs && customStairsArrays.map((stairsVerts, index) => (
          stairsVerts.length >= 3 && (
            <CustomStairsMesh 
              key={`stairs-${index}`}
              vertices={stairsVerts} 
              depth={dimensions.depth} 
              poolVertices={dimensions.customVertices || []}
              rotation={dimensions.customStairsRotations?.[index] || 0}
              showDimensions={dimensionDisplay === 'all' || dimensionDisplay === 'stairs'}
              stairsConfig={dimensions.stairs}
            />
          )
        ))}
        
        {/* Regular stairs (for non-custom shapes) */}
        {!hasCustomStairs && dimensions.stairs?.enabled && (
          <StairsMesh dimensions={dimensions} stairs={dimensions.stairs} />
        )}
        
        {/* Custom wading pools from drawn vertices - render all */}
        {hasCustomWadingPool && customWadingArrays.map((wadingVerts, index) => (
          wadingVerts.length >= 3 && (
            <CustomWadingPoolMesh 
              key={`wading-${index}`}
              vertices={wadingVerts} 
              wadingDepth={dimensions.wadingPool?.depth || 0.4}
              poolDepth={dimensions.depth}
              poolVertices={dimensions.customVertices || []}
              showDimensions={dimensionDisplay === 'all' || dimensionDisplay === 'wading'}
            />
          )
        ))}
        
        {/* Regular wading pool (for non-custom shapes) */}
        {!hasCustomWadingPool && dimensions.wadingPool?.enabled && (
          <WadingPoolMesh dimensions={dimensions} wadingPool={dimensions.wadingPool} />
        )}
        
        {/* Water surface removed - no water generation */}
        
        {/* Foil lines instead of filled strips */}
        {showFoilLayout && <FoilLines dimensions={dimensions} rollWidth={rollWidth} />}
      </group>
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={Math.max(dimensions.length, dimensions.width) * 4}
        target={[0, -dimensions.depth / 2, 0]}
      />
    </>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
      <div className="text-muted-foreground text-sm">Ładowanie wizualizacji 3D...</div>
    </div>
  );
}

export function Pool3DVisualization({ 
  dimensions, 
  calculations,
  rollWidth = 1.65,
  showFoilLayout = false,
  height = 400,
  dimensionDisplay: externalDimensionDisplay,
  onDimensionDisplayChange,
}: Pool3DVisualizationProps) {
  // Use external state if provided, otherwise use internal state
  const [internalDimensionDisplay, setInternalDimensionDisplay] = useState<DimensionDisplay>('pool');
  const dimensionDisplay = externalDimensionDisplay ?? internalDimensionDisplay;
  const setDimensionDisplay = onDimensionDisplayChange ?? setInternalDimensionDisplay;
  
  const maxDimension = Math.max(dimensions.length, dimensions.width, dimensions.depth * 2);
  const cameraDistance = maxDimension * 1.8;

  // Check if stairs or wading pool exist
  const hasStairs = dimensions.stairs?.enabled || 
    (dimensions.shape === 'nieregularny' && dimensions.customStairsVertices?.some(arr => arr.length >= 3));
  const hasWadingPool = dimensions.wadingPool?.enabled || 
    (dimensions.shape === 'nieregularny' && dimensions.customWadingPoolVertices?.some(arr => arr.length >= 3));

  return (
    <div 
      className="relative w-full rounded-lg border border-border overflow-hidden"
      style={{ height, backgroundColor: '#a8c8a0' }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{
            // Natural top-down view - looking into the pool from above at an angle
            position: [cameraDistance * 0.6, cameraDistance * 0.9, cameraDistance * 0.6],
            fov: 45,
            near: 0.1,
            far: 1000,
          }}
        >
          <Scene 
            dimensions={dimensions} 
            calculations={calculations}
            showFoilLayout={showFoilLayout}
            rollWidth={rollWidth}
            dimensionDisplay={dimensionDisplay}
          />
        </Canvas>
      </Suspense>
      
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        🖱️ Obracaj • Scroll: Zoom
      </div>
    </div>
  );
}
