import { useRef, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PoolDimensions, PoolCalculations } from '@/types/configurator';

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

// Pool shell mesh - walls and bottom correctly oriented
function PoolMesh({ dimensions, solid = false }: { dimensions: PoolDimensions; solid?: boolean }) {
  const { depth, depthDeep, hasSlope, length, width, shape } = dimensions;
  const actualDeepDepth = hasSlope && depthDeep ? depthDeep : depth;
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  
  // Materials - solid or transparent based on prop
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: solid ? '#0284c7' : '#0ea5e9',
      transparent: !solid,
      opacity: solid ? 1 : 0.35,
      side: THREE.DoubleSide,
    }), [solid]);

  const bottomMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: solid ? '#0369a1' : '#0284c7',
      transparent: !solid,
      opacity: solid ? 1 : 0.6,
      side: THREE.DoubleSide,
    }), [solid]);

  const edgeColor = '#0c4a6e';

  const isRectangular = shape === 'prostokatny' || shape === 'prostokatny-schodki-zewnetrzne' || shape === 'prostokatny-schodki-narozne';

  // Create geometry for walls and bottom
  const { wallGeometry, bottomGeometry, edges } = useMemo(() => {
    if (isRectangular) {
      // Custom geometry for rectangular pools with optional slope
      const wallGeo = new THREE.BufferGeometry();
      const bottomGeo = new THREE.BufferGeometry();
      
      const halfL = length / 2;
      const halfW = width / 2;
      
      // Bottom vertices - slope goes from shallow (x=-) to deep (x=+)
      // Bottom is in XY plane at Z = -depth
      const bottomVerts = hasSlope ? [
        -halfL, -halfW, -depth,           // 0 - shallow back-left
        halfL, -halfW, -actualDeepDepth,  // 1 - deep back-right
        halfL, halfW, -actualDeepDepth,   // 2 - deep front-right
        -halfL, halfW, -depth,            // 3 - shallow front-left
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
      
      const wallIndices = [
        0, 3, 2, 0, 2, 1,  // Back wall
        4, 5, 6, 4, 6, 7,  // Front wall
        8, 11, 10, 8, 10, 9,  // Left wall
        12, 13, 14, 12, 14, 15,  // Right wall
      ];
      
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVerts, 3));
      wallGeo.setIndex(wallIndices);
      wallGeo.computeVertexNormals();
      
      // Create edges
      const edgePoints: [number, number, number][][] = [
        // Top rim
        [[-halfL, -halfW, 0], [halfL, -halfW, 0]],
        [[halfL, -halfW, 0], [halfL, halfW, 0]],
        [[halfL, halfW, 0], [-halfL, halfW, 0]],
        [[-halfL, halfW, 0], [-halfL, -halfW, 0]],
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
      
      return { wallGeometry: wallGeo, bottomGeometry: bottomGeo, edges: edgePoints };
    } else {
      // For other shapes - build walls and bottom separately with correct orientation
      const shapeObj = new THREE.Shape(shape2D);
      
      // Bottom - ShapeGeometry in XY plane, then move down to -depth
      const bottomGeo = new THREE.ShapeGeometry(shapeObj);
      
      // Walls - create manually by extruding points vertically
      const wallPositions: number[] = [];
      const wallIndices: number[] = [];
      
      const numPoints = shape2D.length;
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        
        const baseIdx = i * 4;
        // Four vertices per wall segment
        wallPositions.push(
          curr.x, curr.y, 0,           // top-left
          next.x, next.y, 0,           // top-right
          next.x, next.y, -depth,      // bottom-right
          curr.x, curr.y, -depth       // bottom-left
        );
        
        // Two triangles per wall segment
        wallIndices.push(
          baseIdx, baseIdx + 3, baseIdx + 2,
          baseIdx, baseIdx + 2, baseIdx + 1
        );
      }
      
      const wallGeo = new THREE.BufferGeometry();
      wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
      wallGeo.setIndex(wallIndices);
      wallGeo.computeVertexNormals();
      
      // Create edge lines for the shape
      const edgePoints: [number, number, number][][] = [];
      
      // Top rim
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        edgePoints.push([[curr.x, curr.y, 0], [next.x, next.y, 0]]);
      }
      
      // Bottom rim
      for (let i = 0; i < numPoints; i++) {
        const curr = shape2D[i];
        const next = shape2D[(i + 1) % numPoints];
        edgePoints.push([[curr.x, curr.y, -depth], [next.x, next.y, -depth]]);
      }
      
      // Vertical edges (only at corners for readability)
      const verticalEdgeCount = Math.min(numPoints, 8);
      const step = Math.max(1, Math.floor(numPoints / verticalEdgeCount));
      for (let i = 0; i < numPoints; i += step) {
        const pt = shape2D[i];
        edgePoints.push([[pt.x, pt.y, 0], [pt.x, pt.y, -depth]]);
      }
      
      return { wallGeometry: wallGeo, bottomGeometry: bottomGeo, edges: edgePoints };
    }
  }, [shape, length, width, depth, actualDeepDepth, hasSlope, shape2D, isRectangular]);

  return (
    <group>
      {/* Walls */}
      <mesh geometry={wallGeometry} material={wallMaterial} />
      
      {/* Bottom - for non-rectangular, position at -depth in Z */}
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

// Foil lines visualization - dashed red lines showing where foil strips go
function FoilLines({ dimensions, rollWidth }: { dimensions: PoolDimensions; rollWidth: number }) {
  const { length, width, depth, depthDeep, hasSlope } = dimensions;
  const OVERLAP = 0.1;
  const effectiveWidth = rollWidth - OVERLAP;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  
  const lines = useMemo(() => {
    const result: { points: [number, number, number][]; }[] = [];
    
    // Bottom foil lines - parallel to length axis, spacing = rollWidth
    let currentY = -width / 2 + rollWidth;
    while (currentY < width / 2) {
      const z1 = hasSlope ? -depth : -depth;
      const z2 = hasSlope ? -actualDeep : -depth;
      result.push({
        points: [
          [-length / 2, currentY, z1 - 0.01],
          [length / 2, currentY, z2 - 0.01]
        ]
      });
      currentY += effectiveWidth;
    }
    
    // Back wall lines (-Y side)
    let currentX = -length / 2 + rollWidth;
    while (currentX < length / 2) {
      const t = (currentX + length / 2) / length;
      const zBottom = hasSlope ? -(depth + t * (actualDeep - depth)) : -depth;
      result.push({
        points: [
          [currentX, -width / 2 + 0.01, 0],
          [currentX, -width / 2 + 0.01, zBottom]
        ]
      });
      currentX += effectiveWidth;
    }
    
    // Front wall lines (+Y side)
    currentX = -length / 2 + rollWidth;
    while (currentX < length / 2) {
      const t = (currentX + length / 2) / length;
      const zBottom = hasSlope ? -(depth + t * (actualDeep - depth)) : -depth;
      result.push({
        points: [
          [currentX, width / 2 - 0.01, 0],
          [currentX, width / 2 - 0.01, zBottom]
        ]
      });
      currentX += effectiveWidth;
    }
    
    // Left wall lines (-X side)
    currentY = -width / 2 + rollWidth;
    while (currentY < width / 2) {
      result.push({
        points: [
          [-length / 2 + 0.01, currentY, 0],
          [-length / 2 + 0.01, currentY, -depth]
        ]
      });
      currentY += effectiveWidth;
    }
    
    // Right wall lines (+X side)
    currentY = -width / 2 + rollWidth;
    while (currentY < width / 2) {
      result.push({
        points: [
          [length / 2 - 0.01, currentY, 0],
          [length / 2 - 0.01, currentY, -actualDeep]
        ]
      });
      currentY += effectiveWidth;
    }
    
    return result;
  }, [length, width, depth, actualDeep, hasSlope, rollWidth, effectiveWidth]);

  return (
    <>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
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

// Main scene
function Scene({ dimensions, calculations, showFoilLayout, rollWidth }: Pool3DVisualizationProps & { rollWidth: number }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={0.8} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      
      {/* Pool mesh - solid when showing foil, transparent otherwise */}
      <PoolMesh dimensions={dimensions} solid={showFoilLayout} />
      <DimensionLines dimensions={dimensions} />
      
      {/* Water only when not showing foil layout */}
      {calculations && !showFoilLayout && (
        <WaterSurface dimensions={dimensions} waterDepth={calculations.waterDepth} />
      )}
      
      {/* Foil lines instead of filled strips */}
      {showFoilLayout && <FoilLines dimensions={dimensions} rollWidth={rollWidth} />}
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={Math.max(dimensions.length, dimensions.width) * 4}
        target={[0, 0, -dimensions.depth / 2]}
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
      className="relative w-full rounded-lg border border-border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden"
      style={{ height }}
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
