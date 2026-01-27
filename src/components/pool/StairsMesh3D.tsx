import { useMemo } from 'react';
import * as THREE from 'three';
import { StairsConfig } from '@/types/configurator';

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
 * Reusable 3D stairs mesh component supporting:
 * - Wall placement (back, front, left, right)
 * - Corner placement (back-left, back-right, front-left, front-right)
 * - Diagonal 45° placement
 * 
 * Works for rectangular, oval, and irregular pool shapes.
 */
export function StairsMesh3D({ length, width, depth, stairs }: StairsMesh3DProps) {
  if (!stairs.enabled) return null;

  const { stepTopMaterial, stepFrontMaterial } = useStairsMaterials();
  
  const placement = stairs.placement || 'wall';
  const wall = stairs.wall || 'back';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  const stairsWidth = typeof stairs.width === 'number' && !isNaN(stairs.width) ? stairs.width : 1.5;
  const stepDepth = typeof stairs.stepDepth === 'number' && !isNaN(stairs.stepDepth) && stairs.stepDepth > 0 ? stairs.stepDepth : 0.30;
  
  const poolDepth = depth || 1.5;
  const halfL = (length || 8) / 2;
  const halfW = (width || 4) / 2;
  
  // Use step count from config, calculate equal step heights
  const actualStepCount = stairs.stepCount && stairs.stepCount >= 2 ? stairs.stepCount : 4;
  // Divide depth into (stepCount + 1) segments so the last tread is NOT flush with the pool floor
  const actualStepHeight = poolDepth / (actualStepCount + 1);
  const actualStepDepth = stepDepth;
  const actualStairsWidth = stairsWidth;

  // For diagonal stairs, create triangular *terrace* steps
  if (placement === 'diagonal') {
    return (
      <DiagonalStairs
        corner={corner}
        halfL={halfL}
        halfW={halfW}
        stepCount={actualStepCount}
        stepHeight={actualStepHeight}
        stepDepth={actualStepDepth}
        stepTopMaterial={stepTopMaterial}
        stepFrontMaterial={stepFrontMaterial}
      />
    );
  }

  // Wall or corner placement
  return (
    <RegularStairs
      placement={placement}
      wall={wall}
      corner={corner}
      direction={direction}
      halfL={halfL}
      halfW={halfW}
      poolDepth={poolDepth}
      stairsWidth={actualStairsWidth}
      stepCount={actualStepCount}
      stepHeight={actualStepHeight}
      stepDepth={actualStepDepth}
      stepTopMaterial={stepTopMaterial}
      stepFrontMaterial={stepFrontMaterial}
    />
  );
}

interface DiagonalStairsProps {
  corner: string;
  halfL: number;
  halfW: number;
  stepCount: number;
  stepHeight: number;
  stepDepth: number;
  stepTopMaterial: THREE.Material;
  stepFrontMaterial: THREE.Material;
}

function DiagonalStairs({
  corner,
  halfL,
  halfW,
  stepCount,
  stepHeight,
  stepDepth,
  stepTopMaterial,
  stepFrontMaterial,
}: DiagonalStairsProps) {
  const diagonalSteps = useMemo(() => {
    const stepsArr: JSX.Element[] = [];

    const baseX = corner.includes('left') ? -halfL : halfL;
    const baseY = corner.includes('back') ? -halfW : halfW;

    // Total "run" along each leg for 45° stairs
    const diagonalSize = stepCount * stepDepth;

    // Create triangle shape for a given size
    const makeTriangleShape = (size: number) => {
      const shape = new THREE.Shape();
      // CCW winding order for correct normals
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

    // Create steps as terraces - each step is a thin triangular slab
    // Step 1 (top) is smallest, step N (bottom) is largest
    for (let i = 0; i < stepCount; i++) {
      // Z position: each step goes deeper
      const stepTop = -(i + 1) * stepHeight;
      const thisStepHeight = stepHeight;

      // Size of this step's triangle (grows as we go deeper)
      const treadSize = (i + 1) * stepDepth;

      if (treadSize > 0.05) {
        const shape = makeTriangleShape(treadSize);
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: thisStepHeight,
          bevelEnabled: false,
        });

        // Position so top face is at stepTop
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

interface RegularStairsProps {
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

function RegularStairs({
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
}: RegularStairsProps) {
  // Get position based on placement mode (wall or corner)
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
      // Corner placement
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
      // First step starts at -stepHeight (below pool edge), not at 0
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
        // Corner placement
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
