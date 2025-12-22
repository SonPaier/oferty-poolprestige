import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { PoolDimensions, PoolShape, PoolCalculations } from '@/types/configurator';

interface Pool3DVisualizationProps {
  dimensions: PoolDimensions;
  calculations: PoolCalculations | null;
  rollWidth?: number;
  showFoilLayout?: boolean;
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
        // Center the custom shape
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
        // Fallback to rectangle
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

// Create 3D pool mesh from 2D shape
function PoolMesh({ dimensions, showFoilLayout, rollWidth = 1.65 }: { 
  dimensions: PoolDimensions; 
  showFoilLayout: boolean;
  rollWidth: number;
}) {
  const depth = dimensions.depth;
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  
  // Create extruded geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(shape2D);
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [shape2D, depth]);

  // Pool walls material
  const wallMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    }), []);

  // Bottom material
  const bottomMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.5,
    }), []);

  // Edge material for outline
  const edgesMaterial = useMemo(() => 
    new THREE.LineBasicMaterial({ color: '#0c4a6e', linewidth: 2 }), []);

  const edges = useMemo(() => 
    new THREE.EdgesGeometry(geometry), [geometry]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Pool body */}
      <mesh geometry={geometry} material={wallMaterial} />
      
      {/* Edges outline */}
      <lineSegments geometry={edges} material={edgesMaterial} />
      
      {/* Bottom surface */}
      <mesh position={[0, 0, 0.01]}>
        <shapeGeometry args={[new THREE.Shape(shape2D)]} />
        <meshStandardMaterial color="#0284c7" transparent opacity={0.6} />
      </mesh>
      
      {/* Foil strips visualization */}
      {showFoilLayout && <FoilStrips dimensions={dimensions} rollWidth={rollWidth} />}
    </group>
  );
}

// Foil strips visualization on pool surfaces
function FoilStrips({ dimensions, rollWidth }: { dimensions: PoolDimensions; rollWidth: number }) {
  const { length, width, depth } = dimensions;
  const OVERLAP = 0.1;
  const effectiveWidth = rollWidth - OVERLAP;
  
  const strips = useMemo(() => {
    const result: { position: [number, number, number]; size: [number, number]; color: string; rotation?: [number, number, number] }[] = [];
    const colors = ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
    
    // Calculate bottom strips (along length)
    let currentX = -width / 2;
    let colorIndex = 0;
    
    while (currentX < width / 2) {
      const stripWidth = currentX === -width / 2 ? rollWidth : effectiveWidth;
      const actualWidth = Math.min(stripWidth, width / 2 - currentX + OVERLAP);
      
      result.push({
        position: [0, currentX + actualWidth / 2, depth + 0.02],
        size: [length, actualWidth],
        color: colors[colorIndex % colors.length],
      });
      
      currentX += currentX === -width / 2 ? rollWidth : effectiveWidth;
      colorIndex++;
    }
    
    return result;
  }, [length, width, depth, rollWidth, effectiveWidth]);

  return (
    <>
      {strips.map((strip, i) => (
        <mesh key={i} position={strip.position}>
          <planeGeometry args={strip.size} />
          <meshStandardMaterial 
            color={strip.color} 
            transparent 
            opacity={0.4} 
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
  offset = 0.3,
  color = '#64748b' 
}: { 
  start: [number, number, number]; 
  end: [number, number, number]; 
  label: string;
  offset?: number;
  color?: string;
}) {
  const midPoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  // Calculate direction and perpendicular for offset
  const dir = new THREE.Vector3(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  ).normalize();

  return (
    <group>
      {/* Main dimension line */}
      <Line
        points={[start, end]}
        color={color}
        lineWidth={1.5}
      />
      
      {/* Extension lines at ends */}
      <Line
        points={[
          [start[0], start[1], start[2] - 0.15],
          [start[0], start[1], start[2] + 0.15],
        ]}
        color={color}
        lineWidth={1}
      />
      <Line
        points={[
          [end[0], end[1], end[2] - 0.15],
          [end[0], end[1], end[2] + 0.15],
        ]}
        color={color}
        lineWidth={1}
      />
      
      {/* Label */}
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
  const { length, width, depth, shape, lLength2 = 3, lWidth2 = 2 } = dimensions;
  
  const offset = 0.5;
  
  return (
    <group>
      {/* Length dimension (X axis) */}
      <DimensionLine
        start={[-length / 2, -width / 2 - offset, 0]}
        end={[length / 2, -width / 2 - offset, 0]}
        label={`${length.toFixed(2)} m`}
      />
      
      {/* Width dimension (Y axis) */}
      <DimensionLine
        start={[length / 2 + offset, -width / 2, 0]}
        end={[length / 2 + offset, width / 2, 0]}
        label={`${width.toFixed(2)} m`}
      />
      
      {/* Depth dimension (Z axis) */}
      <DimensionLine
        start={[-length / 2 - offset, -width / 2 - offset, 0]}
        end={[-length / 2 - offset, -width / 2 - offset, -depth]}
        label={`${depth.toFixed(2)} m`}
      />
      
      {/* L-shape additional dimensions */}
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

// Water level indicator
function WaterLevel({ dimensions, waterDepth }: { dimensions: PoolDimensions; waterDepth: number }) {
  const shape2D = useMemo(() => getPoolShape(dimensions), [dimensions]);
  const shape = useMemo(() => new THREE.Shape(shape2D), [shape2D]);
  
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -(dimensions.depth - waterDepth)]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial 
          color="#38bdf8" 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// Grid floor
function GridFloor({ size = 20 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        color="#f1f5f9" 
        transparent 
        opacity={0.5}
      />
    </mesh>
  );
}

// Main scene component
function Scene({ dimensions, calculations, showFoilLayout, rollWidth }: Pool3DVisualizationProps & { rollWidth: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Calculate camera distance based on pool size
  const maxDimension = Math.max(dimensions.length, dimensions.width, dimensions.depth * 2);
  const cameraDistance = maxDimension * 1.5;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      
      <group ref={groupRef}>
        <PoolMesh 
          dimensions={dimensions} 
          showFoilLayout={showFoilLayout || false}
          rollWidth={rollWidth}
        />
        
        <DimensionLines dimensions={dimensions} />
        
        {calculations && (
          <WaterLevel dimensions={dimensions} waterDepth={calculations.waterDepth} />
        )}
      </group>
      
      <GridFloor size={Math.max(dimensions.length, dimensions.width) * 2} />
      
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={cameraDistance * 3}
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
}: Pool3DVisualizationProps) {
  const maxDimension = Math.max(dimensions.length, dimensions.width, dimensions.depth * 2);
  const cameraDistance = maxDimension * 1.8;

  return (
    <div className="relative w-full h-[400px] rounded-lg border border-border bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden">
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
      
      {/* Controls hint */}
      <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        🖱️ Obracaj • Scroll: Zoom • Shift+🖱️: Przesuń
      </div>
      
      {/* Legend */}
      <div className="absolute top-2 right-2 text-xs space-y-1 bg-background/90 p-2 rounded border border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-sky-400/50 border border-sky-600" />
          <span>Basen</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-sky-300/50 border border-sky-500" />
          <span>Poziom wody</span>
        </div>
        {showFoilLayout && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-400/50 border border-green-600" />
            <span>Pasy folii</span>
          </div>
        )}
      </div>
    </div>
  );
}
