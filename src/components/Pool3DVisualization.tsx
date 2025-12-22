import { useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PoolDimensions, PoolCalculations, StairsConfig, WadingPoolConfig, CustomPoolVertex } from '@/types/configurator';
import { planFoilLayout, FoilStrip, ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE } from '@/lib/foilPlanner';

// Wall thickness constant (20cm)
const WALL_THICKNESS = 0.2;

interface Pool3DVisualizationProps {
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  rollWidth?: number;
  showFoilLayout?: boolean;
  height?: number;
}

// Generate pool shape as 2D points (XY plane, will be used for top rim and bottom)
function getPoolShape(dimensions: PoolDimensions): THREE.Vector2[] {
  const { shape, length, width, lLength2 = 3, lWidth2 = 2 } = dimensions;
  const points: THREE.Vector2[] = [];

  switch (shape) {
    case 'prostokatny':
    case 'prostokatny-schodki-zewnetrzne':
    case 'prostokatny-schodki-narozne':
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
    case 'litera-l':
      const x1 = length / 2;
      const x2 = -length / 2;
      const y1 = width / 2;
      const y2 = -width / 2;
      const y3 = y2 - lWidth2;
      const x3 = x2 + lLength2;
      
      points.push(
        new THREE.Vector2(x2, y1),
        new THREE.Vector2(x1, y1),
        new THREE.Vector2(x1, y2),
        new THREE.Vector2(x3, y2),
        new THREE.Vector2(x3, y3),
        new THREE.Vector2(x2, y3)
      );
      break;
    case 'wlasny':
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
        points.push(
          new THREE.Vector2(-length / 2, -width / 2),
          new THREE.Vector2(length / 2, -width / 2),
          new THREE.Vector2(length / 2, width / 2),
          new THREE.Vector2(-length / 2, width / 2)
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

  const isRectangular = shape === 'prostokatny' || shape === 'prostokatny-schodki-zewnetrzne' || shape === 'prostokatny-schodki-narozne';

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

// Stairs visualization - stairs descend to the pool floor
// Uses corner + direction for 8 possible configurations
function StairsMesh({ dimensions, stairs }: { dimensions: PoolDimensions; stairs: StairsConfig }) {
  if (!stairs.enabled) return null;
  
  const { shape, length, width, depth, lLength2 = 3, lWidth2 = 2 } = dimensions;
  // Provide defaults for all stairs properties to avoid NaN
  const position = stairs.position || 'inside';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  const stairsWidth = typeof stairs.width === 'number' && !isNaN(stairs.width) ? stairs.width : 1.5;
  const stepHeight = typeof stairs.stepHeight === 'number' && !isNaN(stairs.stepHeight) && stairs.stepHeight > 0 ? stairs.stepHeight : 0.29;
  const stepDepth = typeof stairs.stepDepth === 'number' && !isNaN(stairs.stepDepth) && stairs.stepDepth > 0 ? stairs.stepDepth : 0.29;
  
  const poolDepth = depth || 1.5;
  const halfL = (length || 8) / 2;
  const halfW = (width || 4) / 2;
  
  // White for stair tops like reference
  const stepTopMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
    }), []);
  
  // Blue for stair front faces
  const stepFrontMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5',
    }), []);

  const isLShape = shape === 'litera-l';
  const actualStairsWidth = stairsWidth;

  // Calculate corner base position
  const getCornerPosition = () => {
    if (isLShape) {
      // For L-shape, use inner corner
      const x3 = -halfL + lLength2;
      const y2 = -halfW;
      return { baseX: x3, baseY: y2 };
    }
    
    switch (corner) {
      case 'back-left': return { baseX: -halfL, baseY: -halfW };
      case 'back-right': return { baseX: halfL, baseY: -halfW };
      case 'front-left': return { baseX: -halfL, baseY: halfW };
      case 'front-right': return { baseX: halfL, baseY: halfW };
      default: return { baseX: -halfL, baseY: -halfW };
    }
  };

  const { baseX, baseY } = getCornerPosition();

  const steps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];
    const actualStepCount = Math.ceil(poolDepth / stepHeight);
    
    for (let i = 0; i < actualStepCount; i++) {
      const stepTop = -i * stepHeight;
      const stepZ = i * stepDepth;
      
      const stepBottom = -poolDepth;
      const thisStepHeight = Math.abs(stepTop - stepBottom);
      const posZ = (stepTop + stepBottom) / 2;
      
      let posX = 0, posY = 0;
      let sizeX = actualStairsWidth, sizeY = stepDepth;
      
      // Direction determines which axis the stairs extend along
      const isAlongLength = direction === 'along-length';
      
      // Calculate direction multipliers based on corner
      const xDir = corner.includes('left') ? 1 : -1;
      const yDir = corner.includes('back') ? 1 : -1;
      
      if (isAlongLength) {
        // Stairs extend along X axis (length)
        posX = baseX + xDir * (stepZ + stepDepth / 2);
        posY = baseY + yDir * (actualStairsWidth / 2);
        sizeX = stepDepth;
        sizeY = actualStairsWidth;
      } else {
        // Stairs extend along Y axis (width)
        posX = baseX + xDir * (actualStairsWidth / 2);
        posY = baseY + yDir * (stepZ + stepDepth / 2);
        sizeX = actualStairsWidth;
        sizeY = stepDepth;
      }
      
      // Adjust for inside/outside position
      if (position === 'outside') {
        if (isAlongLength) {
          posX = baseX - xDir * (stepZ + stepDepth / 2);
        } else {
          posY = baseY - yDir * (stepZ + stepDepth / 2);
        }
      }
      
      // Create step with white top and blue sides
      stepsArr.push(
        <group key={i} position={[posX, posY, posZ]}>
          {/* Main step body with blue sides */}
          <mesh material={stepFrontMaterial}>
            <boxGeometry args={[sizeX, sizeY, thisStepHeight]} />
          </mesh>
          {/* White top surface overlay */}
          <mesh position={[0, 0, thisStepHeight / 2 - 0.01]} material={stepTopMaterial}>
            <boxGeometry args={[sizeX, sizeY, 0.02]} />
          </mesh>
        </group>
      );
    }
    
    return stepsArr;
  }, [stepHeight, stepDepth, actualStairsWidth, corner, direction, position, baseX, baseY, poolDepth, stepTopMaterial, stepFrontMaterial]);

  return <group>{steps}</group>;
}

// Wading pool visualization - always in corner, walls extend to pool floor
// Uses corner + direction for 8 possible configurations
function WadingPoolMesh({ dimensions, wadingPool }: { dimensions: PoolDimensions; wadingPool: WadingPoolConfig }) {
  if (!wadingPool.enabled) return null;
  
  const { shape, length, width, depth, lLength2 = 3, lWidth2 = 2 } = dimensions;
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
  
  const waterMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5',
      transparent: true,
      opacity: 0.7,
    }), []);

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
    
    const isLShape = shape === 'litera-l';
    
    if (isLShape) {
      const x3 = -halfL + lLength2;
      const y2 = -halfW;
      
      return {
        posX: x3 - sizeX / 2,
        posY: y2 + sizeY / 2,
        wallXSide: -1,
        wallYSide: 1,
        sizeX,
        sizeY,
      };
    }
    
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
  }, [shape, corner, direction, halfL, halfW, wpLength, wpWidth, lLength2]);

  const { posX, posY, sizeX, sizeY, wallXSide, wallYSide } = cornerConfig;

  return (
    <group position={[posX, posY, 0]}>
      {/* Floor of wading pool (płaskie dno brodzika) */}
      <mesh position={[0, 0, -wpDepth]}>
        <boxGeometry args={[sizeX, sizeY, WALL_THICKNESS]} />
        <meshStandardMaterial color="#0369a1" />
      </mesh>
      
      {/* Water in wading pool */}
      <mesh position={[0, 0, -wpDepth / 2]} material={waterMaterial}>
        <boxGeometry args={[sizeX - 0.02, sizeY - 0.02, wpDepth - 0.02]} />
      </mesh>
      
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

// All dimension lines
function DimensionLines({ dimensions }: { dimensions: PoolDimensions }) {
  const { length, width, depth, depthDeep, hasSlope, shape, lLength2 = 3, lWidth2 = 2 } = dimensions;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  const offset = 0.6;
  
  return (
    <group>
      {/* Length */}
      <DimensionLine
        start={[-length / 2, -width / 2 - offset, 0]}
        end={[length / 2, -width / 2 - offset, 0]}
        label={`${length.toFixed(2)} m`}
      />
      
      {/* Width */}
      <DimensionLine
        start={[length / 2 + offset, -width / 2, 0]}
        end={[length / 2 + offset, width / 2, 0]}
        label={`${width.toFixed(2)} m`}
      />
      
      {/* Depth shallow (left side) */}
      <group>
        <Line
          points={[
            [-length / 2 - offset, width / 2 + offset, 0],
            [-length / 2 - offset, width / 2 + offset, -depth]
          ]}
          color="#475569"
          lineWidth={1.5}
        />
        <Html position={[-length / 2 - offset - 0.3, width / 2 + offset, -depth / 2]} center>
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
              [length / 2 + offset, width / 2 + offset, 0],
              [length / 2 + offset, width / 2 + offset, -actualDeep]
            ]}
            color="#f97316"
            lineWidth={1.5}
          />
          <Html position={[length / 2 + offset + 0.3, width / 2 + offset, -actualDeep / 2]} center>
            <div className="bg-orange-50 px-2 py-0.5 rounded text-xs font-semibold text-orange-700 border border-orange-200 shadow-sm whitespace-nowrap">
              {actualDeep.toFixed(2)} m (głęboko)
            </div>
          </Html>
        </group>
      )}
      
      {/* L-shape additional dimensions */}
      {shape === 'litera-l' && (
        <>
          <DimensionLine
            start={[-length / 2, -width / 2 - lWidth2 - offset, 0]}
            end={[-length / 2 + lLength2, -width / 2 - lWidth2 - offset, 0]}
            label={`${lLength2.toFixed(2)} m`}
            color="#f97316"
          />
        </>
      )}
    </group>
  );
}

// Water surface
function WaterSurface({ dimensions, waterDepth }: { dimensions: PoolDimensions; waterDepth: number }) {
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  const shapeObj = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  const geometry = useMemo(() => new THREE.ShapeGeometry(shapeObj), [shapeObj]);
  
  return (
    <mesh position={[0, 0, -waterDepth]} geometry={geometry}>
      <meshStandardMaterial color="#38bdf8" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Custom stairs mesh (from drawn vertices) - needs poolVertices to compute same center offset
function CustomStairsMesh({ vertices, depth, poolVertices, rotation = 0 }: { 
  vertices: CustomPoolVertex[]; 
  depth: number;
  poolVertices: CustomPoolVertex[];
  rotation?: number; // 0, 90, 180, 270 degrees
}) {
  const stepHeight = 0.29;
  const stepCount = Math.ceil(depth / stepHeight);
  
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

  // Calculate centroid for positioning
  const centroid = useMemo(() => {
    const cx = transformedVertices.reduce((sum, v) => sum + v.x, 0) / transformedVertices.length;
    const cy = transformedVertices.reduce((sum, v) => sum + v.y, 0) / transformedVertices.length;
    return { x: cx, y: cy };
  }, [transformedVertices]);

  // Calculate bounding box for step sizing
  const bounds = useMemo(() => {
    const xs = transformedVertices.map(v => v.x);
    const ys = transformedVertices.map(v => v.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  }, [transformedVertices]);

  const steps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];
    const sizeX = bounds.maxX - bounds.minX;
    const sizeY = bounds.maxY - bounds.minY;
    
    // Determine step depth based on which dimension the stairs extend along
    // Default rotation (0): entry from Y+, stairs extend along Y axis
    const isHorizontal = rotation === 90 || rotation === 270;
    const stairsExtent = isHorizontal ? sizeX : sizeY;
    const stepDepth = stairsExtent / stepCount;
    
    // Steps go from top (z=0) down to pool depth
    // Each step: top surface is white, sides are blue
    // Step i has its TOP at z = -i * stepHeight
    
    for (let i = 0; i < stepCount; i++) {
      // This step's top surface is at this Z level
      const stepTopZ = -i * stepHeight;
      // The step body extends from stepTopZ down to the pool floor
      const stepBodyHeight = depth - (i * stepHeight);
      const stepBodyCenterZ = stepTopZ - stepBodyHeight / 2;
      
      // Calculate position based on rotation and step index
      // The first step (i=0) is at the entry edge, last step is deepest
      let offsetX = 0;
      let offsetY = 0;
      let currentSizeX = sizeX;
      let currentSizeY = sizeY;
      
      // Position each step progressively deeper into the pool
      // Apply 180° flip - previously steps were going wrong direction
      switch (rotation) {
        case 0: // Entry from top (Y+), descend toward Y- (person walks from +Y toward -Y)
          // First step near +Y edge, last step near -Y edge
          offsetY = (sizeY / 2) - (stepDepth / 2) - (i * stepDepth);
          currentSizeY = stepDepth;
          break;
        case 90: // Entry from right (X+), descend toward X- (person walks from +X toward -X)
          offsetX = (sizeX / 2) - (stepDepth / 2) - (i * stepDepth);
          currentSizeX = stepDepth;
          break;
        case 180: // Entry from bottom (Y-), descend toward Y+ (person walks from -Y toward +Y)
          offsetY = -(sizeY / 2) + (stepDepth / 2) + (i * stepDepth);
          currentSizeY = stepDepth;
          break;
        case 270: // Entry from left (X-), descend toward X+ (person walks from -X toward +X)
          offsetX = -(sizeX / 2) + (stepDepth / 2) + (i * stepDepth);
          currentSizeX = stepDepth;
          break;
      }

      stepsArr.push(
        <group key={i} position={[centroid.x + offsetX, centroid.y + offsetY, stepBodyCenterZ]}>
          {/* Step body (blue) */}
          <mesh material={stepFrontMaterial}>
            <boxGeometry args={[Math.max(0.1, currentSizeX), Math.max(0.1, currentSizeY), stepBodyHeight]} />
          </mesh>
          {/* Step top surface (white) */}
          <mesh position={[0, 0, stepBodyHeight / 2 - 0.01]} material={stepTopMaterial}>
            <boxGeometry args={[Math.max(0.1, currentSizeX), Math.max(0.1, currentSizeY), 0.02]} />
          </mesh>
        </group>
      );
    }
    return stepsArr;
  }, [stepCount, stepHeight, depth, bounds, centroid, rotation, stepTopMaterial, stepFrontMaterial]);

  const sizeX = bounds.maxX - bounds.minX;
  const sizeY = bounds.maxY - bounds.minY;

  return (
    <group>
      {steps}
      {/* Dimension lines for custom stairs */}
      {/* Width dimension */}
      <DimensionLine
        start={[bounds.minX, bounds.minY - 0.3, 0.05]}
        end={[bounds.maxX, bounds.minY - 0.3, 0.05]}
        label={`${sizeX.toFixed(2)} m`}
        color="#f97316"
      />
      {/* Length dimension */}
      <DimensionLine
        start={[bounds.maxX + 0.3, bounds.minY, 0.05]}
        end={[bounds.maxX + 0.3, bounds.maxY, 0.05]}
        label={`${sizeY.toFixed(2)} m`}
        color="#f97316"
      />
    </group>
  );
}

// Custom wading pool mesh (from drawn vertices)
function CustomWadingPoolMesh({ vertices, wadingDepth, poolDepth, poolVertices }: { 
  vertices: CustomPoolVertex[]; 
  wadingDepth: number;
  poolDepth: number;
  poolVertices: CustomPoolVertex[];
}) {
  const waterMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#38bdf8', transparent: true, opacity: 0.5 }), []);
  const floorMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#5b9bd5' }), []);
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#5b9bd5' }), []);
  // White/gray rim material like pool edge
  const rimMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), []);

  const RIM_WIDTH = 0.15; // 15cm rim

  // Calculate pool center (same as getPoolShape uses for custom pools)
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

  const shape2D = useMemo(() => transformedVertices.map(v => new THREE.Vector2(v.x, v.y)), [transformedVertices]);
  const shapeObj = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  const floorGeo = useMemo(() => new THREE.ShapeGeometry(shapeObj), [shapeObj]);

  const centroid = useMemo(() => {
    const cx = transformedVertices.reduce((sum, v) => sum + v.x, 0) / transformedVertices.length;
    const cy = transformedVertices.reduce((sum, v) => sum + v.y, 0) / transformedVertices.length;
    return { x: cx, y: cy };
  }, [transformedVertices]);

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

  // Wading pool floor is at wadingDepth from surface (shallow area)
  const floorZ = -wadingDepth;
  // The raised platform height (from pool floor to wading floor)
  const platformHeight = poolDepth - wadingDepth;

  // Determine which edges are internal (not touching pool boundary)
  // Check if edge is near pool boundary
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

  // Check which edges are internal (threshold 0.3m from pool boundary)
  const threshold = 0.3;
  const isLeftInternal = bounds.minX > poolBounds.minX + threshold;
  const isRightInternal = bounds.maxX < poolBounds.maxX - threshold;
  const isBottomInternal = bounds.minY > poolBounds.minY + threshold;
  const isTopInternal = bounds.maxY < poolBounds.maxY - threshold;

  // Calculate actual bounds for dimensions
  const xs = transformedVertices.map(v => v.x);
  const ys = transformedVertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return (
    <group>
      {/* Platform/raised floor (the structure holding up the wading pool floor) */}
      <mesh position={[centroid.x, centroid.y, -poolDepth + platformHeight / 2]} material={wallMaterial}>
        <boxGeometry args={[bounds.sizeX, bounds.sizeY, platformHeight]} />
      </mesh>
      {/* Floor surface (top of wading pool) - blue */}
      <mesh position={[0, 0, floorZ]} geometry={floorGeo} material={floorMaterial} />
      
      {/* Internal rim/walls - only on edges facing the main pool */}
      {/* Corner pieces first (at intersections) */}
      {isLeftInternal && isBottomInternal && (
        <mesh position={[minX + RIM_WIDTH / 2, minY + RIM_WIDTH / 2, 0]} material={rimMaterial}>
          <boxGeometry args={[RIM_WIDTH, RIM_WIDTH, RIM_WIDTH]} />
        </mesh>
      )}
      {isLeftInternal && isTopInternal && (
        <mesh position={[minX + RIM_WIDTH / 2, maxY - RIM_WIDTH / 2, 0]} material={rimMaterial}>
          <boxGeometry args={[RIM_WIDTH, RIM_WIDTH, RIM_WIDTH]} />
        </mesh>
      )}
      {isRightInternal && isBottomInternal && (
        <mesh position={[maxX - RIM_WIDTH / 2, minY + RIM_WIDTH / 2, 0]} material={rimMaterial}>
          <boxGeometry args={[RIM_WIDTH, RIM_WIDTH, RIM_WIDTH]} />
        </mesh>
      )}
      {isRightInternal && isTopInternal && (
        <mesh position={[maxX - RIM_WIDTH / 2, maxY - RIM_WIDTH / 2, 0]} material={rimMaterial}>
          <boxGeometry args={[RIM_WIDTH, RIM_WIDTH, RIM_WIDTH]} />
        </mesh>
      )}
      
      {/* Left rim (X-) */}
      {isLeftInternal && (
        <group>
          {/* Vertical wall */}
          <mesh position={[minX + RIM_WIDTH / 2, centroid.y, floorZ - wadingDepth / 2]} material={wallMaterial}>
            <boxGeometry args={[RIM_WIDTH, bounds.sizeY - (isBottomInternal ? RIM_WIDTH : 0) - (isTopInternal ? RIM_WIDTH : 0), wadingDepth]} />
          </mesh>
          {/* White top rim - excluding corners */}
          <mesh position={[minX + RIM_WIDTH / 2, centroid.y, 0]} material={rimMaterial}>
            <boxGeometry args={[RIM_WIDTH, bounds.sizeY - (isBottomInternal ? RIM_WIDTH : 0) - (isTopInternal ? RIM_WIDTH : 0), RIM_WIDTH]} />
          </mesh>
        </group>
      )}
      
      {/* Right rim (X+) */}
      {isRightInternal && (
        <group>
          <mesh position={[maxX - RIM_WIDTH / 2, centroid.y, floorZ - wadingDepth / 2]} material={wallMaterial}>
            <boxGeometry args={[RIM_WIDTH, bounds.sizeY - (isBottomInternal ? RIM_WIDTH : 0) - (isTopInternal ? RIM_WIDTH : 0), wadingDepth]} />
          </mesh>
          <mesh position={[maxX - RIM_WIDTH / 2, centroid.y, 0]} material={rimMaterial}>
            <boxGeometry args={[RIM_WIDTH, bounds.sizeY - (isBottomInternal ? RIM_WIDTH : 0) - (isTopInternal ? RIM_WIDTH : 0), RIM_WIDTH]} />
          </mesh>
        </group>
      )}
      
      {/* Bottom rim (Y-) */}
      {isBottomInternal && (
        <group>
          <mesh position={[centroid.x, minY + RIM_WIDTH / 2, floorZ - wadingDepth / 2]} material={wallMaterial}>
            <boxGeometry args={[bounds.sizeX - (isLeftInternal ? RIM_WIDTH : 0) - (isRightInternal ? RIM_WIDTH : 0), RIM_WIDTH, wadingDepth]} />
          </mesh>
          <mesh position={[centroid.x, minY + RIM_WIDTH / 2, 0]} material={rimMaterial}>
            <boxGeometry args={[bounds.sizeX - (isLeftInternal ? RIM_WIDTH : 0) - (isRightInternal ? RIM_WIDTH : 0), RIM_WIDTH, RIM_WIDTH]} />
          </mesh>
        </group>
      )}
      
      {/* Top rim (Y+) */}
      {isTopInternal && (
        <group>
          <mesh position={[centroid.x, maxY - RIM_WIDTH / 2, floorZ - wadingDepth / 2]} material={wallMaterial}>
            <boxGeometry args={[bounds.sizeX - (isLeftInternal ? RIM_WIDTH : 0) - (isRightInternal ? RIM_WIDTH : 0), RIM_WIDTH, wadingDepth]} />
          </mesh>
          <mesh position={[centroid.x, maxY - RIM_WIDTH / 2, 0]} material={rimMaterial}>
            <boxGeometry args={[bounds.sizeX - (isLeftInternal ? RIM_WIDTH : 0) - (isRightInternal ? RIM_WIDTH : 0), RIM_WIDTH, RIM_WIDTH]} />
          </mesh>
        </group>
      )}
      
      {/* Water in wading pool */}
      <mesh position={[centroid.x, centroid.y, floorZ + (wadingDepth * 0.4)]} material={waterMaterial}>
        <boxGeometry args={[bounds.sizeX * 0.9, bounds.sizeY * 0.9, wadingDepth * 0.8]} />
      </mesh>
      {/* Dimension lines for wading pool */}
      {/* Width dimension */}
      <DimensionLine
        start={[minX, minY - 0.3, floorZ + 0.05]}
        end={[maxX, minY - 0.3, floorZ + 0.05]}
        label={`${bounds.sizeX.toFixed(2)} m`}
        color="#8b5cf6"
      />
      {/* Length dimension */}
      <DimensionLine
        start={[maxX + 0.3, minY, floorZ + 0.05]}
        end={[maxX + 0.3, maxY, floorZ + 0.05]}
        label={`${bounds.sizeY.toFixed(2)} m`}
        color="#8b5cf6"
      />
      {/* Depth dimension */}
      <group>
        <Line
          points={[
            [minX - 0.3, minY, 0],
            [minX - 0.3, minY, floorZ]
          ]}
          color="#8b5cf6"
          lineWidth={1.5}
        />
        <Html position={[minX - 0.5, minY, floorZ / 2]} center>
          <div className="bg-purple-50 px-2 py-0.5 rounded text-xs font-semibold text-purple-700 border border-purple-200 shadow-sm whitespace-nowrap">
            {wadingDepth.toFixed(2)} m
          </div>
        </Html>
      </group>
    </group>
  );
}

// Main scene
function Scene({ dimensions, calculations, showFoilLayout, rollWidth }: Pool3DVisualizationProps & { rollWidth: number }) {
  const isCustomShape = dimensions.shape === 'wlasny';
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
        <DimensionLines dimensions={dimensions} />
        
        {/* Custom stairs from drawn vertices - render all */}
        {hasCustomStairs && customStairsArrays.map((stairsVerts, index) => (
          stairsVerts.length >= 3 && (
            <CustomStairsMesh 
              key={`stairs-${index}`}
              vertices={stairsVerts} 
              depth={dimensions.depth} 
              poolVertices={dimensions.customVertices || []}
              rotation={dimensions.customStairsRotations?.[index] || 0}
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
            />
          )
        ))}
        
        {/* Regular wading pool (for non-custom shapes) */}
        {!hasCustomWadingPool && dimensions.wadingPool?.enabled && (
          <WadingPoolMesh dimensions={dimensions} wadingPool={dimensions.wadingPool} />
        )}
        
        {/* Water only when not showing foil layout */}
        {calculations && !showFoilLayout && (
          <WaterSurface dimensions={dimensions} waterDepth={calculations.waterDepth} />
        )}
        
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
}: Pool3DVisualizationProps) {
  const maxDimension = Math.max(dimensions.length, dimensions.width, dimensions.depth * 2);
  const cameraDistance = maxDimension * 1.8;

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
          />
        </Canvas>
      </Suspense>
      
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        🖱️ Obracaj • Scroll: Zoom
      </div>
      
      <div className="absolute top-2 right-2 text-xs space-y-1 bg-background/95 p-2 rounded border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-300 border border-gray-400" />
          <span>Konstrukcja</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${showFoilLayout ? 'bg-sky-600' : 'bg-sky-500/40'} border border-sky-600`} />
          <span>Ściany</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${showFoilLayout ? 'bg-sky-700' : 'bg-sky-600/60'} border border-sky-700`} />
          <span>Dno</span>
        </div>
        {!showFoilLayout && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-sky-300/40 border border-sky-400" />
            <span>Woda</span>
          </div>
        )}
        {dimensions.stairs?.enabled && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-200 border border-gray-300" />
            <span>Schodki</span>
          </div>
        )}
        {dimensions.wadingPool?.enabled && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-sky-200 border border-sky-300" />
            <span>Brodzik</span>
          </div>
        )}
        {showFoilLayout && (
          <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
            <div className="w-3 h-1 border-t-2 border-dashed border-red-600" />
            <span>Linie folii ({rollWidth}m)</span>
          </div>
        )}
      </div>
    </div>
  );
}
