import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { PoolDimensions } from '@/types/configurator';
import { MixConfiguration } from '@/lib/foil/mixPlanner';

interface Foil3DVisualizationProps {
  dimensions: PoolDimensions;
  config: MixConfiguration;
}

// Colors for strips - alternating for visibility
const STRIP_COLORS_165 = [
  new THREE.Color('#3B82F6'), // blue-500
  new THREE.Color('#60A5FA'), // blue-400
];

const STRIP_COLORS_205 = [
  new THREE.Color('#10B981'), // emerald-500
  new THREE.Color('#34D399'), // emerald-400
];

// Calculate strip positions for a surface
function calculateStripPositions(
  coverWidth: number,
  rollWidth: number,
  overlap: number
): number[] {
  const positions: number[] = [];
  let currentPos = 0;

  while (currentPos < coverWidth) {
    positions.push(currentPos);
    currentPos += rollWidth - (positions.length > 0 ? overlap : 0);
    if (positions.length > 20) break; // Safety limit
  }

  return positions;
}

// Single strip mesh component
interface StripMeshProps {
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  length: number;
  color: THREE.Color;
  opacity?: number;
}

function StripMesh({ position, rotation, width, length, color, opacity = 0.6 }: StripMeshProps) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Pool shell component
interface PoolShellProps {
  dimensions: PoolDimensions;
}

function PoolShell({ dimensions }: PoolShellProps) {
  const { length, width, depth } = dimensions;
  const halfL = length / 2;
  const halfW = width / 2;

  return (
    <group>
      {/* Bottom */}
      <mesh position={[0, 0, -depth]} rotation={[0, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color="#e5e7eb" side={THREE.DoubleSide} />
      </mesh>

      {/* Front wall (+Y) */}
      <mesh position={[0, halfW, -depth / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, depth]} />
        <meshStandardMaterial color="#d1d5db" side={THREE.DoubleSide} />
      </mesh>

      {/* Back wall (-Y) */}
      <mesh position={[0, -halfW, -depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, depth]} />
        <meshStandardMaterial color="#d1d5db" side={THREE.DoubleSide} />
      </mesh>

      {/* Left wall (-X) */}
      <mesh position={[-halfL, 0, -depth / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#c4c8cc" side={THREE.DoubleSide} />
      </mesh>

      {/* Right wall (+X) */}
      <mesh position={[halfL, 0, -depth / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#c4c8cc" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Foil strips on pool surfaces
interface FoilStripsProps {
  dimensions: PoolDimensions;
  config: MixConfiguration;
}

function FoilStrips({ dimensions, config }: FoilStripsProps) {
  const { length, width, depth } = dimensions;
  const halfL = length / 2;
  const halfW = width / 2;
  const OVERLAP = 0.1;
  const offset = 0.01; // Small offset to prevent z-fighting

  const strips: JSX.Element[] = [];
  let stripId = 0;

  // Get config for a surface
  const getConfigForSurface = (key: string) => {
    return config.surfaces.find(s => s.surface === key);
  };

  // Bottom strips
  const bottomConfig = getConfigForSurface('bottom');
  if (bottomConfig) {
    const rollWidth = bottomConfig.rollWidth;
    const colors = rollWidth === 1.65 ? STRIP_COLORS_165 : STRIP_COLORS_205;
    const shorterSide = Math.min(length, width);
    const longerSide = Math.max(length, width);
    const isLengthLonger = length >= width;
    
    const positions = calculateStripPositions(shorterSide, rollWidth, OVERLAP);
    positions.forEach((pos, idx) => {
      const color = colors[idx % colors.length];
      const stripWidth = Math.min(rollWidth, shorterSide - pos);
      const centerOffset = pos + stripWidth / 2 - shorterSide / 2;

      if (isLengthLonger) {
        strips.push(
          <StripMesh
            key={stripId++}
            position={[0, centerOffset, -depth + offset]}
            rotation={[0, 0, 0]}
            width={stripWidth}
            length={longerSide}
            color={color}
          />
        );
      } else {
        strips.push(
          <StripMesh
            key={stripId++}
            position={[centerOffset, 0, -depth + offset]}
            rotation={[0, 0, Math.PI / 2]}
            width={stripWidth}
            length={longerSide}
            color={color}
          />
        );
      }
    });
  }

  // Long walls
  const longWallConfig = getConfigForSurface('wall-long');
  if (longWallConfig) {
    const rollWidth = longWallConfig.rollWidth;
    const colors = rollWidth === 1.65 ? STRIP_COLORS_165 : STRIP_COLORS_205;
    const coverHeight = depth;
    const longerSide = Math.max(length, width);
    const shorterSide = Math.min(length, width);
    
    const positions = calculateStripPositions(coverHeight, rollWidth, OVERLAP);
    
    // Front wall (+Y)
    positions.forEach((pos, idx) => {
      const color = colors[idx % colors.length];
      const stripHeight = Math.min(rollWidth, coverHeight - pos);
      const zPos = -pos - stripHeight / 2;
      
      strips.push(
        <StripMesh
          key={stripId++}
          position={[0, halfW + offset, zPos]}
          rotation={[Math.PI / 2, 0, 0]}
          width={stripHeight}
          length={longerSide}
          color={color}
        />
      );
    });

    // Back wall (-Y)
    positions.forEach((pos, idx) => {
      const color = colors[idx % colors.length];
      const stripHeight = Math.min(rollWidth, coverHeight - pos);
      const zPos = -pos - stripHeight / 2;
      
      strips.push(
        <StripMesh
          key={stripId++}
          position={[0, -halfW - offset, zPos]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={stripHeight}
          length={longerSide}
          color={color}
        />
      );
    });
  }

  // Short walls
  const shortWallConfig = getConfigForSurface('wall-short');
  if (shortWallConfig) {
    const rollWidth = shortWallConfig.rollWidth;
    const colors = rollWidth === 1.65 ? STRIP_COLORS_165 : STRIP_COLORS_205;
    const coverHeight = depth;
    const shorterSide = Math.min(length, width);
    
    const positions = calculateStripPositions(coverHeight, rollWidth, OVERLAP);
    
    // Left wall (-X)
    positions.forEach((pos, idx) => {
      const color = colors[idx % colors.length];
      const stripHeight = Math.min(rollWidth, coverHeight - pos);
      const zPos = -pos - stripHeight / 2;
      
      strips.push(
        <StripMesh
          key={stripId++}
          position={[-halfL - offset, 0, zPos]}
          rotation={[0, Math.PI / 2, Math.PI / 2]}
          width={stripHeight}
          length={shorterSide}
          color={color}
        />
      );
    });

    // Right wall (+X)
    positions.forEach((pos, idx) => {
      const color = colors[idx % colors.length];
      const stripHeight = Math.min(rollWidth, coverHeight - pos);
      const zPos = -pos - stripHeight / 2;
      
      strips.push(
        <StripMesh
          key={stripId++}
          position={[halfL + offset, 0, zPos]}
          rotation={[0, -Math.PI / 2, Math.PI / 2]}
          width={stripHeight}
          length={shorterSide}
          color={color}
        />
      );
    });
  }

  return <group>{strips}</group>;
}

// Main scene component
function Scene({ dimensions, config }: Foil3DVisualizationProps) {
  const { length, width, depth } = dimensions;
  const maxDim = Math.max(length, width, depth);
  const cameraDistance = maxDim * 2.5;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance * 0.8]}
        fov={50}
      />
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={maxDim * 0.5}
        maxDistance={maxDim * 8}
        target={[0, 0, -depth / 2]}
      />
      
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={0.9} />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} />

      <PoolShell dimensions={dimensions} />
      <FoilStrips dimensions={dimensions} config={config} />

      {/* Ground plane - positioned at z=0 (pool edge level) */}
      <mesh position={[0, 0, 0.005]} rotation={[0, 0, 0]}>
        <planeGeometry args={[length + 4, width + 4]} />
        <meshStandardMaterial color="#a8c8a0" />
      </mesh>

      {/* Grid helper on ground */}
      <gridHelper 
        args={[Math.max(length, width) + 4, Math.ceil(Math.max(length, width) + 4), '#666', '#888']} 
        rotation={[Math.PI / 2, 0, 0]} 
        position={[0, 0, 0.01]} 
      />
    </>
  );
}

export function Foil3DVisualization({ dimensions, config }: Foil3DVisualizationProps) {
  return (
    <div className="relative w-full h-[400px] rounded-lg border bg-background overflow-hidden">
      <Canvas>
        <Scene dimensions={dimensions} config={config} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex items-center gap-4 p-2 rounded bg-background/80 backdrop-blur text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-500" />
          Rolka 1.65m
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-500" />
          Rolka 2.05m
        </span>
      </div>
    </div>
  );
}
