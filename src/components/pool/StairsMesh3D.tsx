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
  wadingPool?: { 
    enabled: boolean;
    cornerIndex?: number; 
    direction?: 'along-length' | 'along-width';
    width?: number;
    length?: number;
  };
}

/**
 * Calculate the position for wading pool intersection points (E=4, F=5)
 */
function getWadingPoolIntersectionPosition(
  cornerIndex: number,
  length: number,
  width: number,
  wadingPool?: StairsMesh3DProps['wadingPool']
): Point | null {
  if (!wadingPool?.enabled || cornerIndex < 4) return null;
  
  const wadingCorner = wadingPool.cornerIndex ?? 0;
  const wadingDir = wadingPool.direction || 'along-width';
  const wadingWidth = wadingPool.width || 2;
  const wadingLength = wadingPool.length || 1.5;
  
  const halfL = length / 2;
  const halfW = width / 2;
  
  // E = index 4, F = index 5
  const isE = cornerIndex === 4;
  
  switch (wadingCorner) {
    case 0: // Corner A (back-left)
      if (wadingDir === 'along-length') {
        return isE 
          ? { x: -halfL + wadingWidth, y: -halfW } // E on back wall
          : { x: -halfL, y: -halfW + wadingLength }; // F on left wall
      } else {
        return isE
          ? { x: -halfL, y: -halfW + wadingWidth } // E on left wall
          : { x: -halfL + wadingLength, y: -halfW }; // F on back wall
      }
    case 1: // Corner B (back-right)
      if (wadingDir === 'along-length') {
        return isE
          ? { x: halfL - wadingWidth, y: -halfW } // E on back wall
          : { x: halfL, y: -halfW + wadingLength }; // F on right wall
      } else {
        return isE
          ? { x: halfL, y: -halfW + wadingWidth } // E on right wall
          : { x: halfL - wadingLength, y: -halfW }; // F on back wall
      }
    case 2: // Corner C (front-right)
      if (wadingDir === 'along-length') {
        return isE
          ? { x: halfL - wadingWidth, y: halfW } // E on front wall
          : { x: halfL, y: halfW - wadingLength }; // F on right wall
      } else {
        return isE
          ? { x: halfL, y: halfW - wadingWidth } // E on right wall
          : { x: halfL - wadingLength, y: halfW }; // F on front wall
      }
    case 3: // Corner D (front-left)
      if (wadingDir === 'along-length') {
        return isE
          ? { x: -halfL + wadingWidth, y: halfW } // E on front wall
          : { x: -halfL, y: halfW - wadingLength }; // F on left wall
      } else {
        return isE
          ? { x: -halfL, y: halfW - wadingWidth } // E on left wall
          : { x: -halfL + wadingLength, y: halfW }; // F on front wall
      }
    default:
      return null;
  }
}

/**
 * Reusable 3D stairs mesh component supporting shape types:
 * - Rectangular
 * - Diagonal 45°
 */
export function StairsMesh3D({ length, width, depth, stairs, wadingPool }: StairsMesh3DProps) {
  if (!stairs.enabled) return null;

  const { stepTopMaterial, stepFrontMaterial } = useStairsMaterials();
  
  // Calculate wading pool intersection position if needed
  const wadingIntersectionPos = useMemo(() => {
    const cornerIndex = stairs.cornerIndex ?? 0;
    if (cornerIndex >= 4) {
      return getWadingPoolIntersectionPosition(cornerIndex, length, width, wadingPool);
    }
    return null;
  }, [stairs.cornerIndex, length, width, wadingPool]);
  
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
        wadingIntersectionPos={wadingIntersectionPos}
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
  wadingIntersectionPos?: Point | null;
}

function UnifiedStairs({
  length,
  width,
  depth,
  stairs,
  stepTopMaterial,
  stepFrontMaterial,
  wadingIntersectionPos,
}: UnifiedStairsProps) {
  const geometry = generateStairsGeometry(length, width, stairs, wadingIntersectionPos ?? undefined);
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
    
    // Vertices from stairsShapeGenerator:
    // v0 = corner position (starting point)
    // v1 = v0 + width direction
    // v2 = v0 + width + length (depth)
    // v3 = v0 + length (depth)
    // The LENGTH (depth) direction is where steps descend into pool
    const [v0, v1, v2, v3] = vertices;
    
    // Width vector: v0 -> v1 (parallel to pool wall, stair width)
    const widthVec = { x: v1.x - v0.x, y: v1.y - v0.y };
    // Length/depth vector: v0 -> v3 (perpendicular to wall, into pool)
    const lengthVec = { x: v3.x - v0.x, y: v3.y - v0.y };
    
    const stairsWidth = Math.hypot(widthVec.x, widthVec.y);
    const stairsLength = Math.hypot(lengthVec.x, lengthVec.y);
    const stepDepth = stairsLength / stepCount;
    
    // Normalize vectors
    const widthNorm = { x: widthVec.x / stairsWidth, y: widthVec.y / stairsWidth };
    const lengthNorm = { x: lengthVec.x / stairsLength, y: lengthVec.y / stairsLength };
    
    // Rotation angle based on width direction
    const angle = Math.atan2(widthVec.y, widthVec.x);
    
    const stepsArr: JSX.Element[] = [];
    
    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      const stepBottom = -poolDepth;
      const thisStepHeight = Math.abs(stepTop - stepBottom);
      const posZ = (stepTop + stepBottom) / 2;
      
      // Position: start from v0, move along length direction by step progress, center on width
      const progress = (i + 0.5) * stepDepth;
      const posX = v0.x + lengthNorm.x * progress + widthNorm.x * stairsWidth * 0.5;
      const posY = v0.y + lengthNorm.y * progress + widthNorm.y * stairsWidth * 0.5;
      
      stepsArr.push(
        <group key={i} position={[posX, posY, posZ]} rotation={[0, 0, angle]}>
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
    // Vector from corner to each wall point
    const dx1 = v1.x - v0.x;
    const dy1 = v1.y - v0.y;
    const dx2 = v2.x - v0.x;
    const dy2 = v2.y - v0.y;
    
    // Steps are sliced parallel to the hypotenuse (line from v1 to v2)
    // Each step takes up 1/stepCount of the triangle
    // First step (i=0) is at the outer edge (full size), last step is smallest
    for (let i = 0; i < stepCount; i++) {
      const stepTop = -(i + 1) * stepHeight;
      
      // Outer ratio (start of this step) - step 0 starts at ratio 0 (outer edge)
      const outerRatio = i / stepCount;
      // Inner ratio (end of this step)
      const innerRatio = (i + 1) / stepCount;
      
      // Create trapezoid shape for this step (slice between two parallel lines)
      // Outer edge points (at outerRatio distance from hypotenuse toward corner)
      const outer1x = v0.x + dx1 * (1 - outerRatio);
      const outer1y = v0.y + dy1 * (1 - outerRatio);
      const outer2x = v0.x + dx2 * (1 - outerRatio);
      const outer2y = v0.y + dy2 * (1 - outerRatio);
      
      // Inner edge points (at innerRatio distance from hypotenuse toward corner)
      const inner1x = v0.x + dx1 * (1 - innerRatio);
      const inner1y = v0.y + dy1 * (1 - innerRatio);
      const inner2x = v0.x + dx2 * (1 - innerRatio);
      const inner2y = v0.y + dy2 * (1 - innerRatio);
      
      const shape = new THREE.Shape();
      
      // Draw trapezoid (or triangle for last step)
      shape.moveTo(outer1x - v0.x, outer1y - v0.y);
      shape.lineTo(outer2x - v0.x, outer2y - v0.y);
      shape.lineTo(inner2x - v0.x, inner2y - v0.y);
      if (innerRatio < 0.999) {
        shape.lineTo(inner1x - v0.x, inner1y - v0.y);
      }
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
