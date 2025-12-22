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
      // L-shape - two rectangles joined
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

// Create 3D pool geometry with optional slope
function PoolMesh({ dimensions, showFoilLayout, rollWidth = 1.65 }: { 
  dimensions: PoolDimensions; 
  showFoilLayout: boolean;
  rollWidth: number;
}) {
  const { depth, depthDeep, hasSlope, length, width } = dimensions;
  const actualDeepDepth = hasSlope && depthDeep ? depthDeep : depth;
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  
  // Create custom geometry for slope
  const geometry = useMemo(() => {
    if (hasSlope && depthDeep && depthDeep !== depth) {
      // Create slope geometry manually
      const shape = new THREE.Shape(shape2D);
      const points = shape.getPoints();
      
      const geo = new THREE.BufferGeometry();
      const vertices: number[] = [];
      const indices: number[] = [];
      
      // For rectangle with slope, create custom mesh
      if (dimensions.shape === 'prostokatny' || dimensions.shape === 'prostokatny-schodki-zewnetrzne' || dimensions.shape === 'prostokatny-schodki-narozne') {
        // Bottom surface with slope (shallow at -x, deep at +x)
        vertices.push(
          -length/2, -width/2, depth,      // 0 - shallow left back
          length/2, -width/2, depthDeep,   // 1 - deep right back
          length/2, width/2, depthDeep,    // 2 - deep right front
          -length/2, width/2, depth,       // 3 - shallow left front
          // Top rim
          -length/2, -width/2, 0,          // 4
          length/2, -width/2, 0,           // 5
          length/2, width/2, 0,            // 6
          -length/2, width/2, 0,           // 7
        );
        
        // Bottom face
        indices.push(0, 2, 1, 0, 3, 2);
        // Walls
        indices.push(4, 0, 1, 4, 1, 5); // back wall
        indices.push(5, 1, 2, 5, 2, 6); // right wall
        indices.push(6, 2, 3, 6, 3, 7); // front wall
        indices.push(7, 3, 0, 7, 0, 4); // left wall
        
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
      }
      
      // Fallback for other shapes - uniform extrusion
      const extrudeSettings = { steps: 1, depth: depth, bevelEnabled: false };
      return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }
    
    // Standard uniform depth
    const shape = new THREE.Shape(shape2D);
    const extrudeSettings = { steps: 1, depth: depth, bevelEnabled: false };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape2D, depth, depthDeep, hasSlope, length, width, dimensions.shape]);

  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    }), []);

  const edges = useMemo(() => 
    new THREE.EdgesGeometry(geometry), [geometry]);

  const edgesMaterial = useMemo(() => 
    new THREE.LineBasicMaterial({ color: '#0c4a6e', linewidth: 2 }), []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} material={wallMaterial} />
      <lineSegments geometry={edges} material={edgesMaterial} />
      
      {/* Bottom surface */}
      {!hasSlope && (
        <mesh position={[0, 0, 0.01]}>
          <shapeGeometry args={[new THREE.Shape(shape2D)]} />
          <meshStandardMaterial color="#0284c7" transparent opacity={0.6} />
        </mesh>
      )}
      
      {showFoilLayout && <FoilStrips dimensions={dimensions} rollWidth={rollWidth} />}
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
    const result: { position: [number, number, number]; size: [number, number]; color: string; type: 'bottom' | 'wall' }[] = [];
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
    
    // Bottom strips (along length)
    let currentY = -width / 2;
    let colorIndex = 0;
    
    while (currentY < width / 2) {
      const isFirst = currentY === -width / 2;
      const stripWidth = isFirst ? rollWidth : effectiveWidth;
      const actualWidth = Math.min(stripWidth, width / 2 - currentY + (isFirst ? 0 : OVERLAP));
      
      const avgDepth = hasSlope ? (depth + actualDeep) / 2 : depth;
      
      result.push({
        position: [0, currentY + actualWidth / 2, avgDepth + 0.02],
        size: [length, actualWidth],
        color: colors[colorIndex % colors.length],
        type: 'bottom',
      });
      
      currentY += isFirst ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    // Long walls (left and right)
    [-width/2, width/2].forEach((yPos, wallIdx) => {
      const wallHeight = hasSlope ? (depth + actualDeep) / 2 : depth;
      let currentX = -length / 2;
      
      while (currentX < length / 2) {
        const isFirst = currentX === -length / 2;
        const stripW = isFirst ? rollWidth : effectiveWidth;
        const actualW = Math.min(stripW, length / 2 - currentX + (isFirst ? 0 : OVERLAP));
        
        result.push({
          position: [currentX + actualW / 2, yPos + (wallIdx === 0 ? -0.02 : 0.02), wallHeight / 2],
          size: [actualW, wallHeight],
          color: colors[(colorIndex + wallIdx) % colors.length],
          type: 'wall',
        });
        
        currentX += isFirst ? rollWidth : effectiveWidth;
      }
      colorIndex++;
    });
    
    // Short walls (front and back)
    [-length/2, length/2].forEach((xPos, wallIdx) => {
      const wallDepth = wallIdx === 0 ? depth : actualDeep;
      let currentY2 = -width / 2;
      
      while (currentY2 < width / 2) {
        const isFirst = currentY2 === -width / 2;
        const stripW = isFirst ? rollWidth : effectiveWidth;
        const actualW = Math.min(stripW, width / 2 - currentY2 + (isFirst ? 0 : OVERLAP));
        
        result.push({
          position: [xPos + (wallIdx === 0 ? -0.02 : 0.02), currentY2 + actualW / 2, wallDepth / 2],
          size: [actualW, wallDepth],
          color: colors[(colorIndex + wallIdx) % colors.length],
          type: 'wall',
        });
        
        currentY2 += isFirst ? rollWidth : effectiveWidth;
      }
      colorIndex++;
    });
    
    return result;
  }, [length, width, depth, actualDeep, hasSlope, rollWidth, effectiveWidth]);

  return (
    <>
      {strips.map((strip, i) => (
        <mesh 
          key={i} 
          position={strip.position}
          rotation={strip.type === 'wall' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <planeGeometry args={strip.size} />
          <meshStandardMaterial 
            color={strip.color} 
            transparent 
            opacity={0.5} 
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

// Dimension lines with arrows
function DimensionLine({ 
  start, 
  end, 
  label, 
  color = '#64748b' 
}: { 
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
      <Line
        points={[[start[0], start[1], start[2] - 0.15], [start[0], start[1], start[2] + 0.15]]}
        color={color}
        lineWidth={1}
      />
      <Line
        points={[[end[0], end[1], end[2] - 0.15], [end[0], end[1], end[2] + 0.15]]}
        color={color}
        lineWidth={1}
      />
      <Html position={midPoint} center>
        <div className="bg-background/90 px-2 py-0.5 rounded text-xs font-medium text-foreground border border-border whitespace-nowrap">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Dimension lines group
function DimensionLines({ dimensions }: { dimensions: PoolDimensions }) {
  const { length, width, depth, depthDeep, hasSlope, shape, lLength2 = 3, lWidth2 = 2 } = dimensions;
  const actualDeep = hasSlope && depthDeep ? depthDeep : depth;
  
  const offset = 0.5;
  
  return (
    <group>
      {/* Length dimension */}
      <DimensionLine
        start={[-length / 2, -width / 2 - offset, 0]}
        end={[length / 2, -width / 2 - offset, 0]}
        label={`${length.toFixed(2)} m`}
      />
      
      {/* Width dimension */}
      <DimensionLine
        start={[length / 2 + offset, -width / 2, 0]}
        end={[length / 2 + offset, width / 2, 0]}
        label={`${width.toFixed(2)} m`}
      />
      
      {/* Depth shallow */}
      <DimensionLine
        start={[-length / 2 - offset, -width / 2 - offset, 0]}
        end={[-length / 2 - offset, -width / 2 - offset, -depth]}
        label={`${depth.toFixed(2)} m${hasSlope ? ' (płytko)' : ''}`}
      />
      
      {/* Depth deep (if slope) */}
      {hasSlope && depthDeep && (
        <DimensionLine
          start={[length / 2 + offset, -width / 2 - offset, 0]}
          end={[length / 2 + offset, -width / 2 - offset, -actualDeep]}
          label={`${actualDeep.toFixed(2)} m (głęboko)`}
          color="#f97316"
        />
      )}
      
      {/* L-shape additional */}
      {shape === 'litera-l' && (
        <>
          <DimensionLine
            start={[-length / 2, -width / 2 - lWidth2 - offset, 0]}
            end={[-length / 2 + lLength2, -width / 2 - lWidth2 - offset, 0]}
            label={`${lLength2.toFixed(2)} m`}
            color="#f97316"
          />
          <DimensionLine
            start={[-length / 2 + lLength2 + offset, -width / 2, 0]}
            end={[-length / 2 + lLength2 + offset, -width / 2 - lWidth2, 0]}
            label={`${lWidth2.toFixed(2)} m`}
            color="#f97316"
          />
        </>
      )}
    </group>
  );
}

// Water level
function WaterLevel({ dimensions, waterDepth }: { dimensions: PoolDimensions; waterDepth: number }) {
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  const shape = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -(dimensions.depth - waterDepth)]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Grid floor
function GridFloor({ size = 20 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#f1f5f9" transparent opacity={0.5} />
    </mesh>
  );
}

// Main scene
function Scene({ dimensions, calculations, showFoilLayout, rollWidth }: Pool3DVisualizationProps & { rollWidth: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const maxDimension = Math.max(dimensions.length, dimensions.width, dimensions.depth * 2);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      
      <group ref={groupRef}>
        <PoolMesh dimensions={dimensions} showFoilLayout={showFoilLayout || false} rollWidth={rollWidth} />
        <DimensionLines dimensions={dimensions} />
        {calculations && <WaterLevel dimensions={dimensions} waterDepth={calculations.waterDepth} />}
      </group>
      
      <GridFloor size={Math.max(dimensions.length, dimensions.width) * 2} />
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={maxDimension * 4}
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
      className="relative w-full rounded-lg border border-border bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden"
      style={{ height }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{
            position: [cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.7],
            fov: 45,
            near: 0.1,
            far: 1000,
          }}
          shadows
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
        🖱️ Obracaj • Scroll: Zoom • Shift+🖱️: Przesuń
      </div>
      
      <div className="absolute top-2 right-2 text-xs space-y-1 bg-background/90 p-2 rounded border border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-sky-400/50 border border-sky-600" />
          <span>Basen</span>
        </div>
        {showFoilLayout && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-400/50 border border-green-600" />
              <span>Pasy folii</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Rolka: {rollWidth}m
            </div>
          </>
        )}
      </div>
    </div>
  );
}
