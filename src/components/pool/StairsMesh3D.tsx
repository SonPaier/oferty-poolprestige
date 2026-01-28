import { useMemo } from 'react';
import * as THREE from 'three';
import { StairsConfig, StairsShapeType, Point } from '@/types/configurator';
import { 
  generateStairsGeometry, 
  getPoolCornerPosition, 
  getInwardDirections,
  StairsGeometry 
} from '@/lib/stairsShapeGenerator';

// Shared materials for all stair types
const useStairsMaterials = () => {
  const stepTopMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.6,
    }), []);
  
  const stepFrontMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({
      color: '#5b9bd5',
    }), []);

  return { stepTopMaterial, stepFrontMaterial };
};

interface StairsMesh3DProps {
  length: number;
  width: number;
  depth: number;
  stairs: StairsConfig;
}

/**
 * Reusable 3D stairs mesh component supporting shape types:
 * - Rectangular
 * - Diagonal 45°
 */
export function StairsMesh3D({ length, width, depth, stairs }: StairsMesh3DProps) {
  if (!stairs.enabled) return null;

  const { stepTopMaterial, stepFrontMaterial } = useStairsMaterials();
  
  // Determine which renderer to use based on shapeType
  const shapeType = stairs.shapeType;
  
  // If new shapeType is set, use unified renderer
  if (shapeType) {
    return (
      <UnifiedStairs
        length={length}
        width={width}
        depth={depth}
        stairs={stairs}
        stepTopMaterial={stepTopMaterial}
        stepFrontMaterial={stepFrontMaterial}
      />
    );
  }
  
  // Legacy support for old placement-based config
  return (
    <LegacyStairs
      length={length}
      width={width}
      depth={depth}
      stairs={stairs}
      stepTopMaterial={stepTopMaterial}
      stepFrontMaterial={stepFrontMaterial}
    />
  );
}

interface UnifiedStairsProps {
  length: number;
  width: number;
  depth: number;
  stairs: StairsConfig;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function UnifiedStairs({
  length,
  width,
  depth,
  stairs,
  stepTopMaterial,
  stepFrontMaterial,
}: UnifiedStairsProps) {
  const geometry = generateStairsGeometry(length, width, stairs);
  if (!geometry || geometry.vertices.length < 3) return null;
  
  const shapeType = stairs.shapeType || 'rectangular';
  const stepCount = stairs.stepCount || 4;
  const poolDepth = depth || 1.5;
  const stepHeight = poolDepth / (stepCount + 1);
  
  switch (shapeType) {
    case 'rectangular':
      return (
        <RectangularStairs3D
          vertices={geometry.vertices}
          stepCount={stepCount}
          stepHeight={stepHeight}
          poolDepth={poolDepth}
          stepTopMaterial={stepTopMaterial}
          stepFrontMaterial={stepFrontMaterial}
        />
      );
    
    case 'diagonal-45':
      return (
        <DiagonalStairs3D
          vertices={geometry.vertices}
          stepCount={stepCount}
          stepHeight={stepHeight}
          stepTopMaterial={stepTopMaterial}
          stepFrontMaterial={stepFrontMaterial}
        />
      );
    
    default:
      return null;
  }
}

interface RectangularStairs3DProps {
  vertices: Point[];
  stepCount: number;
  stepHeight: number;
  poolDepth: number;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function RectangularStairs3D({
  vertices,
  stepCount,
  stepHeight,
  poolDepth,
  stepTopMaterial,
  stepFrontMaterial,
}: RectangularStairs3DProps) {
  const steps = useMemo(() => {
    if (vertices.length !== 4) return [];
    
    const [v0, v1, v2, v3] = vertices;
    
    // Calculate dimensions
    const widthVec = { x: v1.x - v0.x, y: v1.y - v0.y };
    const depthVec = { x: v3.x - v0.x, y: v3.y - v0.y };
    const stairsWidth = Math.hypot(widthVec.x, widthVec.y);
    const stairsDepth = Math.hypot(depthVec.x, depthVec.y);
    const stepDepth = stairsDepth / stepCount;
    
    // Center of stairs base
    const centerX = (v0.x + v1.x + v2.x + v3.x) / 4;
    const centerY = (v0.y + v1.y + v2.y + v3.y) / 4;
    
    // Rotation angle
    const angle = Math.atan2(widthVec.y, widthVec.x);
    
    const stepsArr: JSX.Element[] = [];
    
    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      const stepBottom = -poolDepth;
      const thisStepHeight = Math.abs(stepTop - stepBottom);
      const posZ = (stepTop + stepBottom) / 2;
      
      // Position along depth direction
      const progress = (i + 0.5) / stepCount;
      const offsetX = v0.x + depthVec.x * progress + widthVec.x * 0.5;
      const offsetY = v0.y + depthVec.y * progress + widthVec.y * 0.5;
      
      stepsArr.push(
        <group key={i} position={[offsetX, offsetY, posZ]} rotation={[0, 0, angle]}>
          <mesh material={stepFrontMaterial}>
            <boxGeometry args={[stairsWidth, stepDepth, thisStepHeight]} />
          </mesh>
          <mesh position={[0, 0, thisStepHeight / 2 - 0.01]} material={stepTopMaterial}>
            <boxGeometry args={[stairsWidth, stepDepth, 0.02]} />
          </mesh>
        </group>
      );
    }
    
    return stepsArr;
  }, [vertices, stepCount, stepHeight, poolDepth, stepTopMaterial, stepFrontMaterial]);

  return <group>{steps}</group>;
}

interface DiagonalStairs3DProps {
  vertices: Point[];
  stepCount: number;
  stepHeight: number;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function DiagonalStairs3D({
  vertices,
  stepCount,
  stepHeight,
  stepTopMaterial,
  stepFrontMaterial,
}: DiagonalStairs3DProps) {
  const steps = useMemo(() => {
    if (vertices.length !== 3) return [];
    
    const [v0, v1, v2] = vertices;
    const stepsArr: JSX.Element[] = [];
    
    // v0 = pool corner, v1 and v2 = points along pool walls
    // Steps form concentric triangles, largest at top (near pool edge), smallest at bottom
    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      // Scale: 1 = full size (first step), decreasing as we go deeper
      const scale = 1 - (i / stepCount);
      
      if (scale <= 0.05) continue; // Skip tiny steps
      
      const shape = new THREE.Shape();
      
      // Triangle from corner, scaled by progress
      const dx1 = (v1.x - v0.x) * scale;
      const dy1 = (v1.y - v0.y) * scale;
      const dx2 = (v2.x - v0.x) * scale;
      const dy2 = (v2.y - v0.y) * scale;
      
      shape.moveTo(0, 0);
      shape.lineTo(dx1, dy1);
      shape.lineTo(dx2, dy2);
      shape.closePath();
      
      const extrudeGeometry = new THREE.ExtrudeGeometry(shape, {
        depth: stepHeight,
        bevelEnabled: false,
      });
      extrudeGeometry.translate(0, 0, -stepHeight);
      
      stepsArr.push(
        <group key={i} position={[v0.x, v0.y, stepTop]}>
          <mesh geometry={extrudeGeometry} material={stepFrontMaterial} />
          <mesh position={[0, 0, 0.01]} material={stepTopMaterial}>
            <shapeGeometry args={[shape]} />
          </mesh>
        </group>
      );
    }
    
    return stepsArr;
  }, [vertices, stepCount, stepHeight, stepTopMaterial, stepFrontMaterial]);

  return <group>{steps}</group>;
}

// ===== LEGACY SUPPORT =====

interface LegacyStairsProps {
  length: number;
  width: number;
  depth: number;
  stairs: StairsConfig;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function LegacyStairs({
  length,
  width,
  depth,
  stairs,
  stepTopMaterial,
  stepFrontMaterial,
}: LegacyStairsProps) {
  const placement = stairs.placement || 'wall';
  const wall = stairs.wall || 'back';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  const stairsWidth = typeof stairs.width === 'number' && !isNaN(stairs.width) ? stairs.width : 1.5;
  const stepDepth = typeof stairs.stepDepth === 'number' && !isNaN(stairs.stepDepth) && stairs.stepDepth > 0 ? stairs.stepDepth : 0.30;
  
  const poolDepth = depth || 1.5;
  const halfL = (length || 8) / 2;
  const halfW = (width || 4) / 2;
  
  const actualStepCount = stairs.stepCount && stairs.stepCount >= 2 ? stairs.stepCount : 4;
  const actualStepHeight = poolDepth / (actualStepCount + 1);

  if (placement === 'diagonal') {
    return (
      <LegacyDiagonalStairs
        corner={corner}
        halfL={halfL}
        halfW={halfW}
        stepCount={actualStepCount}
        stepHeight={actualStepHeight}
        stepDepth={stepDepth}
        stepTopMaterial={stepTopMaterial}
        stepFrontMaterial={stepFrontMaterial}
      />
    );
  }

  return (
    <LegacyRegularStairs
      placement={placement}
      wall={wall}
      corner={corner}
      direction={direction}
      halfL={halfL}
      halfW={halfW}
      poolDepth={poolDepth}
      stairsWidth={stairsWidth}
      stepCount={actualStepCount}
      stepHeight={actualStepHeight}
      stepDepth={stepDepth}
      stepTopMaterial={stepTopMaterial}
      stepFrontMaterial={stepFrontMaterial}
    />
  );
}

interface LegacyDiagonalStairsProps {
  corner: string;
  halfL: number;
  halfW: number;
  stepCount: number;
  stepHeight: number;
  stepDepth: number;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function LegacyDiagonalStairs({
  corner,
  halfL,
  halfW,
  stepCount,
  stepHeight,
  stepDepth,
  stepTopMaterial,
  stepFrontMaterial,
}: LegacyDiagonalStairsProps) {
  const diagonalSteps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];

    const baseX = corner.includes('left') ? -halfL : halfL;
    const baseY = corner.includes('back') ? -halfW : halfW;

    const makeTriangleShape = (size: number) => {
      const shape = new THREE.Shape();
      switch (corner) {
        case 'back-left':
          shape.moveTo(0, 0);
          shape.lineTo(size, 0);
          shape.lineTo(0, size);
          shape.closePath();
          break;
        case 'back-right':
          shape.moveTo(0, 0);
          shape.lineTo(0, size);
          shape.lineTo(-size, 0);
          shape.closePath();
          break;
        case 'front-left':
          shape.moveTo(0, 0);
          shape.lineTo(0, -size);
          shape.lineTo(size, 0);
          shape.closePath();
          break;
        case 'front-right':
          shape.moveTo(0, 0);
          shape.lineTo(-size, 0);
          shape.lineTo(0, -size);
          shape.closePath();
          break;
      }
      return shape;
    };

    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      const thisStepHeight = stepHeight;
      const treadSize = (i + 1) * stepDepth;

      if (treadSize > 0.05) {
        const shape = makeTriangleShape(treadSize);
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: thisStepHeight,
          bevelEnabled: false,
        });
        geometry.translate(0, 0, -thisStepHeight);

        stepsArr.push(
          <group key={i} position={[baseX, baseY, stepTop]}>
            <mesh geometry={geometry} material={stepFrontMaterial} />
            <mesh position={[0, 0, 0.01]} material={stepTopMaterial}>
              <shapeGeometry args={[shape]} />
            </mesh>
          </group>
        );
      }
    }

    return stepsArr;
  }, [corner, halfL, halfW, stepCount, stepHeight, stepDepth, stepTopMaterial, stepFrontMaterial]);

  return <group>{diagonalSteps}</group>;
}

interface LegacyRegularStairsProps {
  placement: string;
  wall: string;
  corner: string;
  direction: string;
  halfL: number;
  halfW: number;
  poolDepth: number;
  stairsWidth: number;
  stepCount: number;
  stepHeight: number;
  stepDepth: number;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function LegacyRegularStairs({
  placement,
  wall,
  corner,
  direction,
  halfL,
  halfW,
  poolDepth,
  stairsWidth,
  stepCount,
  stepHeight,
  stepDepth,
  stepTopMaterial,
  stepFrontMaterial,
}: LegacyRegularStairsProps) {
  const getPositionConfig = () => {
    if (placement === 'wall') {
      switch (wall) {
        case 'back': return { baseX: 0, baseY: -halfW, isAlongLength: true, xDir: 0, yDir: 1 };
        case 'front': return { baseX: 0, baseY: halfW, isAlongLength: true, xDir: 0, yDir: -1 };
        case 'left': return { baseX: -halfL, baseY: 0, isAlongLength: false, xDir: 1, yDir: 0 };
        case 'right': return { baseX: halfL, baseY: 0, isAlongLength: false, xDir: -1, yDir: 0 };
        default: return { baseX: 0, baseY: -halfW, isAlongLength: true, xDir: 0, yDir: 1 };
      }
    } else {
      const isAlongLength = direction === 'along-length';
      const xDir = corner.includes('left') ? 1 : -1;
      const yDir = corner.includes('back') ? 1 : -1;
      
      let baseX: number, baseY: number;
      switch (corner) {
        case 'back-left': baseX = -halfL; baseY = -halfW; break;
        case 'back-right': baseX = halfL; baseY = -halfW; break;
        case 'front-left': baseX = -halfL; baseY = halfW; break;
        case 'front-right': baseX = halfL; baseY = halfW; break;
        default: baseX = -halfL; baseY = -halfW;
      }
      
      return { baseX, baseY, isAlongLength, xDir, yDir };
    }
  };

  const { baseX, baseY, isAlongLength, xDir, yDir } = getPositionConfig();

  const steps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];
    
    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      const stepZ = i * stepDepth;
      
      const stepBottom = -poolDepth;
      const thisStepHeight = Math.abs(stepTop - stepBottom);
      const posZ = (stepTop + stepBottom) / 2;
      
      let posX = 0, posY = 0;
      let sizeX = stairsWidth, sizeY = stepDepth;
      
      if (placement === 'wall') {
        if (isAlongLength) {
          posX = baseX;
          posY = baseY + yDir * (stepZ + stepDepth / 2);
          sizeX = stairsWidth;
          sizeY = stepDepth;
        } else {
          posX = baseX + xDir * (stepZ + stepDepth / 2);
          posY = baseY;
          sizeX = stepDepth;
          sizeY = stairsWidth;
        }
      } else {
        if (isAlongLength) {
          posX = baseX + xDir * (stepZ + stepDepth / 2);
          posY = baseY + yDir * (stairsWidth / 2);
          sizeX = stepDepth;
          sizeY = stairsWidth;
        } else {
          posX = baseX + xDir * (stairsWidth / 2);
          posY = baseY + yDir * (stepZ + stepDepth / 2);
          sizeX = stairsWidth;
          sizeY = stepDepth;
        }
      }
      
      stepsArr.push(
        <group key={i} position={[posX, posY, posZ]}>
          <mesh material={stepFrontMaterial}>
            <boxGeometry args={[sizeX, sizeY, thisStepHeight]} />
          </mesh>
          <mesh position={[0, 0, thisStepHeight / 2 - 0.01]} material={stepTopMaterial}>
            <boxGeometry args={[sizeX, sizeY, 0.02]} />
          </mesh>
        </group>
      );
    }
    
    return stepsArr;
  }, [stepCount, stepHeight, stepDepth, stairsWidth, placement, baseX, baseY, xDir, yDir, isAlongLength, poolDepth, stepTopMaterial, stepFrontMaterial]);

  return <group>{steps}</group>;
}

export default StairsMesh3D;
