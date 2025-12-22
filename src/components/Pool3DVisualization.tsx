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

// Generate pool shape as 2D points
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

// Pool shell mesh (walls only, no bottom for uniform depth)
function PoolMesh({ dimensions }: { dimensions: PoolDimensions }) {
  const { depth, depthDeep, hasSlope, length, width, shape } = dimensions;
  const actualDeepDepth = hasSlope && depthDeep ? depthDeep : depth;
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  
  // Wall material - semi-transparent blue
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }), []);

  // Bottom material - slightly darker
  const bottomMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }), []);

  // Edge material
  const edgeColor = '#0c4a6e';

  // Create geometry based on shape and slope
  const { wallGeometry, bottomGeometry, edges } = useMemo(() => {
    if (shape === 'prostokatny' || shape === 'prostokatny-schodki-zewnetrzne' || shape === 'prostokatny-schodki-narozne') {
      // Custom geometry for rectangular pools with optional slope
      const wallGeo = new THREE.BufferGeometry();
      const bottomGeo = new THREE.BufferGeometry();
      
      const halfL = length / 2;
      const halfW = width / 2;
      
      // Bottom vertices - slope goes from shallow (x=-) to deep (x=+)
      const bottomVerts = hasSlope ? [
        // Bottom surface with slope
        -halfL, -halfW, -depth,        // 0 - shallow back-left
        halfL, -halfW, -actualDeepDepth,  // 1 - deep back-right
        halfL, halfW, -actualDeepDepth,   // 2 - deep front-right
        -halfL, halfW, -depth,         // 3 - shallow front-left
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
        // Back wall
        0, 3, 2, 0, 2, 1,
        // Front wall
        4, 5, 6, 4, 6, 7,
        // Left wall
        8, 11, 10, 8, 10, 9,
        // Right wall
        12, 13, 14, 12, 14, 15,
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
      // For other shapes - uniform extrusion
      const shapeObj = new THREE.Shape(shape2D);
      const extrudeSettings = { steps: 1, depth: depth, bevelEnabled: false };
      const geo = new THREE.ExtrudeGeometry(shapeObj, extrudeSettings);
      const edgesGeo = new THREE.EdgesGeometry(geo);
      
      return { 
        wallGeometry: geo, 
        bottomGeometry: null, 
        edges: null 
      };
    }
  }, [shape, length, width, depth, actualDeepDepth, hasSlope, shape2D]);

  const isRectangular = shape === 'prostokatny' || shape === 'prostokatny-schodki-zewnetrzne' || shape === 'prostokatny-schodki-narozne';

  return (
    <group>
      {isRectangular ? (
        <>
          {/* Walls */}
          <mesh geometry={wallGeometry} material={wallMaterial} />
          {/* Bottom */}
          <mesh geometry={bottomGeometry!} material={bottomMaterial} />
          {/* Edges */}
          {edges && edges.map((edge, i) => (
            <Line key={i} points={edge} color={edgeColor} lineWidth={2} />
          ))}
        </>
      ) : (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh geometry={wallGeometry} material={wallMaterial} />
          <lineSegments>
            <edgesGeometry args={[wallGeometry]} />
            <lineBasicMaterial color={edgeColor} />
          </lineSegments>
        </group>
      )}
    </group>
  );
}

// Foil strips visualization
function FoilStrips({ dimensions, rollWidth }: { dimensions: PoolDimensions; rollWidth: number }) {
  const { length, width, depth, depthDeep, hasSlope } = dimensions;
  const OVERLAP = 0.1;
  const effectiveWidth = rollWidth - OVERLAP;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  
  const strips = useMemo(() => {
    const result: { position: [number, number, number]; size: [number, number]; color: string; rotation: [number, number, number] }[] = [];
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
    
    let colorIndex = 0;
    
    // Bottom strips (along length axis)
    let currentY = -width / 2;
    while (currentY < width / 2) {
      const isFirst = currentY === -width / 2;
      const stripW = isFirst ? rollWidth : effectiveWidth;
      const actualW = Math.min(stripW, width / 2 - currentY + (isFirst ? 0 : OVERLAP));
      
      const avgZ = hasSlope ? -(depth + actualDeep) / 2 : -depth;
      
      result.push({
        position: [0, currentY + actualW / 2, avgZ - 0.02],
        size: [length - 0.1, actualW - 0.05],
        color: colors[colorIndex % colors.length],
        rotation: [0, 0, 0],
      });
      
      currentY += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    // Back wall strips (-Y)
    let currentX = -length / 2;
    while (currentX < length / 2) {
      const isFirst = currentX === -length / 2;
      const stripW = isFirst ? rollWidth : effectiveWidth;
      const actualW = Math.min(stripW, length / 2 - currentX + (isFirst ? 0 : OVERLAP));
      
      // Calculate interpolated depth at this X position
      const tLeft = (currentX + length/2) / length;
      const tRight = (currentX + actualW + length/2) / length;
      const depthLeft = hasSlope ? depth + tLeft * (actualDeep - depth) : depth;
      const depthRight = hasSlope ? depth + tRight * (actualDeep - depth) : depth;
      const avgWallHeight = (depthLeft + depthRight) / 2;
      
      result.push({
        position: [currentX + actualW / 2, -width / 2 + 0.02, -avgWallHeight / 2],
        size: [actualW - 0.05, avgWallHeight - 0.05],
        color: colors[colorIndex % colors.length],
        rotation: [Math.PI / 2, 0, 0],
      });
      
      currentX += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    // Front wall strips (+Y)
    currentX = -length / 2;
    while (currentX < length / 2) {
      const isFirst = currentX === -length / 2;
      const stripW = isFirst ? rollWidth : effectiveWidth;
      const actualW = Math.min(stripW, length / 2 - currentX + (isFirst ? 0 : OVERLAP));
      
      const tLeft = (currentX + length/2) / length;
      const tRight = (currentX + actualW + length/2) / length;
      const depthLeft = hasSlope ? depth + tLeft * (actualDeep - depth) : depth;
      const depthRight = hasSlope ? depth + tRight * (actualDeep - depth) : depth;
      const avgWallHeight = (depthLeft + depthRight) / 2;
      
      result.push({
        position: [currentX + actualW / 2, width / 2 - 0.02, -avgWallHeight / 2],
        size: [actualW - 0.05, avgWallHeight - 0.05],
        color: colors[colorIndex % colors.length],
        rotation: [Math.PI / 2, 0, 0],
      });
      
      currentX += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    // Left wall (-X) - shallow side
    currentY = -width / 2;
    while (currentY < width / 2) {
      const isFirst = currentY === -width / 2;
      const stripW = isFirst ? rollWidth : effectiveWidth;
      const actualW = Math.min(stripW, width / 2 - currentY + (isFirst ? 0 : OVERLAP));
      
      result.push({
        position: [-length / 2 + 0.02, currentY + actualW / 2, -depth / 2],
        size: [depth - 0.05, actualW - 0.05],
        color: colors[colorIndex % colors.length],
        rotation: [0, Math.PI / 2, 0],
      });
      
      currentY += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    // Right wall (+X) - deep side
    currentY = -width / 2;
    while (currentY < width / 2) {
      const isFirst = currentY === -width / 2;
      const stripW = isFirst ? rollWidth : effectiveWidth;
      const actualW = Math.min(stripW, width / 2 - currentY + (isFirst ? 0 : OVERLAP));
      
      result.push({
        position: [length / 2 - 0.02, currentY + actualW / 2, -actualDeep / 2],
        size: [actualDeep - 0.05, actualW - 0.05],
        color: colors[colorIndex % colors.length],
        rotation: [0, Math.PI / 2, 0],
      });
      
      currentY += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    return result;
  }, [length, width, depth, actualDeep, hasSlope, rollWidth, effectiveWidth]);

  return (
    <>
      {strips.map((strip, i) => (
        <mesh key={i} position={strip.position} rotation={strip.rotation}>
          <planeGeometry args={strip.size} />
          <meshStandardMaterial 
            color={strip.color} 
            transparent 
            opacity={0.6} 
            side={THREE.DoubleSide}
          />
        </mesh>
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
      
      {/* L-shape */}
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
  const shape = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  
  return (
    <mesh position={[0, 0, -waterDepth]} rotation={[0, 0, 0]}>
      <shapeGeometry args={[shape]} />
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
      
      <PoolMesh dimensions={dimensions} />
      <DimensionLines dimensions={dimensions} />
      
      {calculations && (
        <WaterSurface dimensions={dimensions} waterDepth={calculations.waterDepth} />
      )}
      
      {showFoilLayout && <FoilStrips dimensions={dimensions} rollWidth={rollWidth} />}
      
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
  const cameraDistance = maxDimension * 1.5;

  return (
    <div 
      className="relative w-full rounded-lg border border-border bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden"
      style={{ height }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{
            position: [cameraDistance * 0.8, -cameraDistance * 0.6, cameraDistance * 0.6],
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
          <div className="w-3 h-3 rounded bg-sky-500/40 border border-sky-600" />
          <span>Ściany</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-sky-600/60 border border-sky-700" />
          <span>Dno</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-sky-300/40 border border-sky-400" />
          <span>Woda</span>
        </div>
        {showFoilLayout && (
          <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
            <div className="w-3 h-3 rounded bg-green-500/60 border border-green-600" />
            <span>Pasy folii ({rollWidth}m)</span>
          </div>
        )}
      </div>
    </div>
  );
}
