import { StairsConfig } from '@/types/configurator';

interface StairsRenderData {
  outline: { x: number; y: number }[];
  stepLines: { x1: number; y1: number; x2: number; y2: number }[];
}

interface StairsPath2DProps {
  length: number;
  width: number;
  stairs: StairsConfig;
}

/**
 * Calculate stairs outline and step lines for 2D SVG rendering.
 * Works for rectangular and oval pools with wall, corner, and diagonal (45°) placement.
 */
export function getStairsRenderData(
  length: number,
  width: number,
  stairs: StairsConfig
): StairsRenderData | null {
  if (!stairs?.enabled) return null;
  
  const halfL = length / 2;
  const halfW = width / 2;
  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  const stepDepth = stairs.stepDepth || 0.30;
  const stepCount = stairs.stepCount || 4;
  // Stairs length = stepCount × stepDepth
  const stairsLength = stepCount * stepDepth;
  
  const placement = stairs.placement || 'wall';
  const wall = stairs.wall || 'back';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  
  let outline: { x: number; y: number }[] = [];
  let stepLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  
  if (placement === 'diagonal') {
    // Diagonal 45° corner stairs - triangle shape
    // Size is based on stepCount × stepDepth
    const diagonalSize = stepCount * stepDepth;
    const xDir = corner.includes('left') ? 1 : -1;
    const yDir = corner.includes('back') ? 1 : -1;
    const baseX = corner.includes('left') ? -halfL : halfL;
    const baseY = corner.includes('back') ? -halfW : halfW;
    
    outline = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * diagonalSize, y: baseY },
      { x: baseX, y: baseY + yDir * diagonalSize }
    ];
    
    // Add diagonal step lines for triangle stairs
    for (let i = 1; i < stepCount; i++) {
      const progress = i / stepCount;
      const lineLen = diagonalSize * (1 - progress);
      stepLines.push({
        x1: baseX + xDir * lineLen,
        y1: baseY,
        x2: baseX,
        y2: baseY + yDir * lineLen
      });
    }
  } else if (placement === 'wall') {
    // Wall placement: centered on wall
    switch (wall) {
      case 'back':
        outline = [
          { x: -stairsWidth / 2, y: -halfW },
          { x: stairsWidth / 2, y: -halfW },
          { x: stairsWidth / 2, y: -halfW + stairsLength },
          { x: -stairsWidth / 2, y: -halfW + stairsLength }
        ];
        // Step lines - horizontal lines across the stairs
        for (let i = 1; i < stepCount; i++) {
          const stepY = -halfW + i * stepDepth;
          stepLines.push({
            x1: -stairsWidth / 2,
            y1: stepY,
            x2: stairsWidth / 2,
            y2: stepY
          });
        }
        break;
      case 'front':
        outline = [
          { x: -stairsWidth / 2, y: halfW },
          { x: stairsWidth / 2, y: halfW },
          { x: stairsWidth / 2, y: halfW - stairsLength },
          { x: -stairsWidth / 2, y: halfW - stairsLength }
        ];
        for (let i = 1; i < stepCount; i++) {
          const stepY = halfW - i * stepDepth;
          stepLines.push({
            x1: -stairsWidth / 2,
            y1: stepY,
            x2: stairsWidth / 2,
            y2: stepY
          });
        }
        break;
      case 'left':
        outline = [
          { x: -halfL, y: -stairsWidth / 2 },
          { x: -halfL, y: stairsWidth / 2 },
          { x: -halfL + stairsLength, y: stairsWidth / 2 },
          { x: -halfL + stairsLength, y: -stairsWidth / 2 }
        ];
        for (let i = 1; i < stepCount; i++) {
          const stepX = -halfL + i * stepDepth;
          stepLines.push({
            x1: stepX,
            y1: -stairsWidth / 2,
            x2: stepX,
            y2: stairsWidth / 2
          });
        }
        break;
      case 'right':
        outline = [
          { x: halfL, y: -stairsWidth / 2 },
          { x: halfL, y: stairsWidth / 2 },
          { x: halfL - stairsLength, y: stairsWidth / 2 },
          { x: halfL - stairsLength, y: -stairsWidth / 2 }
        ];
        for (let i = 1; i < stepCount; i++) {
          const stepX = halfL - i * stepDepth;
          stepLines.push({
            x1: stepX,
            y1: -stairsWidth / 2,
            x2: stepX,
            y2: stairsWidth / 2
          });
        }
        break;
    }
  } else {
    // Corner placement
    const isAlongLength = direction === 'along-length';
    const xDir = corner.includes('left') ? 1 : -1;
    const yDir = corner.includes('back') ? 1 : -1;
    const baseX = corner.includes('left') ? -halfL : halfL;
    const baseY = corner.includes('back') ? -halfW : halfW;
    
    if (isAlongLength) {
      outline = [
        { x: baseX, y: baseY },
        { x: baseX + xDir * stairsLength, y: baseY },
        { x: baseX + xDir * stairsLength, y: baseY + yDir * stairsWidth },
        { x: baseX, y: baseY + yDir * stairsWidth }
      ];
      // Step lines - vertical lines across the stairs
      for (let i = 1; i < stepCount; i++) {
        const stepX = baseX + xDir * i * stepDepth;
        stepLines.push({
          x1: stepX,
          y1: baseY,
          x2: stepX,
          y2: baseY + yDir * stairsWidth
        });
      }
    } else {
      outline = [
        { x: baseX, y: baseY },
        { x: baseX + xDir * stairsWidth, y: baseY },
        { x: baseX + xDir * stairsWidth, y: baseY + yDir * stairsLength },
        { x: baseX, y: baseY + yDir * stairsLength }
      ];
      // Step lines - horizontal lines across the stairs
      for (let i = 1; i < stepCount; i++) {
        const stepY = baseY + yDir * i * stepDepth;
        stepLines.push({
          x1: baseX,
          y1: stepY,
          x2: baseX + xDir * stairsWidth,
          y2: stepY
        });
      }
    }
  }
  
  return { outline, stepLines };
}

/**
 * SVG component for rendering stairs in 2D preview.
 */
export function StairsPath2D({ length, width, stairs }: StairsPath2DProps) {
  const stairsData = getStairsRenderData(length, width, stairs);
  if (!stairsData) return null;

  const { outline, stepLines } = stairsData;
  
  // Convert points to SVG path (flip Y for SVG coordinate system)
  const pathD = outline.length >= 2
    ? outline.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${-p.y}`).join(' ') + ' Z'
    : '';

  return (
    <g className="stairs-2d">
      {/* Stairs outline */}
      <path
        d={pathD}
        fill="#ffffff"
        stroke="#f97316"
        strokeWidth="0.04"
        strokeDasharray="0.1 0.05"
      />
      
      {/* Step lines */}
      {stepLines.map((line, index) => (
        <line
          key={`step-${index}`}
          x1={line.x1}
          y1={-line.y1}
          x2={line.x2}
          y2={-line.y2}
          stroke="#0c4a6e"
          strokeWidth="0.02"
          strokeDasharray="0.08 0.04"
          opacity={0.7}
        />
      ))}
    </g>
  );
}

export default StairsPath2D;
