import { useMemo } from 'react';
import { PoolDimensions, CustomPoolVertex, StairsConfig } from '@/types/configurator';
import { DimensionDisplay } from '@/components/Pool3DVisualization';

interface Pool2DPreviewProps {
  dimensions: PoolDimensions;
  height?: number;
  dimensionDisplay?: DimensionDisplay;
}

// Generate pool outline points for 2D view
function getPoolPoints(dimensions: PoolDimensions): { x: number; y: number }[] {
  const { shape, length, width, customVertices } = dimensions;
  const points: { x: number; y: number }[] = [];

  switch (shape) {
    case 'prostokatny':
      points.push(
        { x: -length / 2, y: -width / 2 },
        { x: length / 2, y: -width / 2 },
        { x: length / 2, y: width / 2 },
        { x: -length / 2, y: width / 2 }
      );
      break;
    case 'owalny':
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
          x: Math.cos(angle) * (length / 2),
          y: Math.sin(angle) * (width / 2)
        });
      }
      break;
    case 'wlasny':
      if (customVertices && customVertices.length >= 3) {
        const minX = Math.min(...customVertices.map(v => v.x));
        const maxX = Math.max(...customVertices.map(v => v.x));
        const minY = Math.min(...customVertices.map(v => v.y));
        const maxY = Math.max(...customVertices.map(v => v.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        customVertices.forEach(v => {
          points.push({ x: v.x - centerX, y: v.y - centerY });
        });
      } else {
        // Custom shape not yet drawn - return empty/small placeholder
        points.push(
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 }
        );
      }
      break;
    default:
      points.push(
        { x: -length / 2, y: -width / 2 },
        { x: length / 2, y: -width / 2 },
        { x: length / 2, y: width / 2 },
        { x: -length / 2, y: width / 2 }
      );
  }

  return points;
}

// Generate stairs points for rectangular/oval pools
function getRegularStairsPoints(dimensions: PoolDimensions): { x: number; y: number }[] | null {
  const stairs = dimensions.stairs;
  if (!stairs?.enabled || dimensions.shape === 'wlasny') return null;
  
  const { length, width, depth } = dimensions;
  const halfL = length / 2;
  const halfW = width / 2;
  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  const stepDepth = stairs.stepDepth || 0.29;
  const stepCount = Math.ceil(depth / (stairs.stepHeight || 0.29));
  const stairsLength = stepCount * stepDepth;
  
  const placement = stairs.placement || 'wall';
  const wall = stairs.wall || 'back';
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  
  let points: { x: number; y: number }[] = [];
  
  if (placement === 'diagonal') {
    // Diagonal 45° corner stairs - triangle shape
    const xDir = corner.includes('left') ? 1 : -1;
    const yDir = corner.includes('back') ? 1 : -1;
    const baseX = corner.includes('left') ? -halfL : halfL;
    const baseY = corner.includes('back') ? -halfW : halfW;
    
    points = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * stairsWidth, y: baseY },
      { x: baseX, y: baseY + yDir * stairsWidth }
    ];
  } else if (placement === 'wall') {
    // Wall placement: centered on wall
    switch (wall) {
      case 'back':
        points = [
          { x: -stairsWidth / 2, y: -halfW },
          { x: stairsWidth / 2, y: -halfW },
          { x: stairsWidth / 2, y: -halfW + stairsLength },
          { x: -stairsWidth / 2, y: -halfW + stairsLength }
        ];
        break;
      case 'front':
        points = [
          { x: -stairsWidth / 2, y: halfW },
          { x: stairsWidth / 2, y: halfW },
          { x: stairsWidth / 2, y: halfW - stairsLength },
          { x: -stairsWidth / 2, y: halfW - stairsLength }
        ];
        break;
      case 'left':
        points = [
          { x: -halfL, y: -stairsWidth / 2 },
          { x: -halfL, y: stairsWidth / 2 },
          { x: -halfL + stairsLength, y: stairsWidth / 2 },
          { x: -halfL + stairsLength, y: -stairsWidth / 2 }
        ];
        break;
      case 'right':
        points = [
          { x: halfL, y: -stairsWidth / 2 },
          { x: halfL, y: stairsWidth / 2 },
          { x: halfL - stairsLength, y: stairsWidth / 2 },
          { x: halfL - stairsLength, y: -stairsWidth / 2 }
        ];
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
      points = [
        { x: baseX, y: baseY },
        { x: baseX + xDir * stairsLength, y: baseY },
        { x: baseX + xDir * stairsLength, y: baseY + yDir * stairsWidth },
        { x: baseX, y: baseY + yDir * stairsWidth }
      ];
    } else {
      points = [
        { x: baseX, y: baseY },
        { x: baseX + xDir * stairsWidth, y: baseY },
        { x: baseX + xDir * stairsWidth, y: baseY + yDir * stairsLength },
        { x: baseX, y: baseY + yDir * stairsLength }
      ];
    }
  }
  
  return points;
}

// Generate wading pool points for rectangular pools
function getRegularWadingPoolPoints(dimensions: PoolDimensions): { x: number; y: number }[] | null {
  const wadingPool = dimensions.wadingPool;
  if (!wadingPool?.enabled || dimensions.shape === 'wlasny') return null;
  
  const { length, width } = dimensions;
  const halfL = length / 2;
  const halfW = width / 2;
  const wpWidth = wadingPool.width || 2;
  const wpLength = wadingPool.length || 1.5;
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';
  
  const isAlongLength = direction === 'along-length';
  const xDir = corner.includes('left') ? 1 : -1;
  const yDir = corner.includes('back') ? 1 : -1;
  const baseX = corner.includes('left') ? -halfL : halfL;
  const baseY = corner.includes('back') ? -halfW : halfW;
  
  let points: { x: number; y: number }[];
  
  if (isAlongLength) {
    // Wading pool extends along X axis
    points = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * wpWidth, y: baseY },
      { x: baseX + xDir * wpWidth, y: baseY + yDir * wpLength },
      { x: baseX, y: baseY + yDir * wpLength }
    ];
  } else {
    // Wading pool extends along Y axis
    points = [
      { x: baseX, y: baseY },
      { x: baseX + xDir * wpLength, y: baseY },
      { x: baseX + xDir * wpLength, y: baseY + yDir * wpWidth },
      { x: baseX, y: baseY + yDir * wpWidth }
    ];
  }
  
  return points;
}

// Transform custom element vertices to be centered relative to pool
function transformCustomVertices(
  vertices: CustomPoolVertex[],
  poolVertices?: CustomPoolVertex[]
): { x: number; y: number }[] {
  if (!vertices || vertices.length < 3) return [];
  
  // Get pool center for offset
  let poolCenterX = 0;
  let poolCenterY = 0;
  
  if (poolVertices && poolVertices.length >= 3) {
    const minX = Math.min(...poolVertices.map(v => v.x));
    const maxX = Math.max(...poolVertices.map(v => v.x));
    const minY = Math.min(...poolVertices.map(v => v.y));
    const maxY = Math.max(...poolVertices.map(v => v.y));
    poolCenterX = (minX + maxX) / 2;
    poolCenterY = (minY + maxY) / 2;
  }
  
  return vertices.map(v => ({
    x: v.x - poolCenterX,
    y: v.y - poolCenterY
  }));
}

export default function Pool2DPreview({ dimensions, height = 300, dimensionDisplay = 'pool' }: Pool2DPreviewProps) {
  const poolPoints = useMemo(() => getPoolPoints(dimensions), [dimensions]);
  
  const stairsPoints = useMemo(() => {
    // Check for custom stairs vertices array
    if (dimensions.shape === 'wlasny' && dimensions.customStairsVertices?.[0]) {
      return transformCustomVertices(
        dimensions.customStairsVertices[0],
        dimensions.customVertices
      );
    }
    // For regular shapes, generate stairs points from config
    return getRegularStairsPoints(dimensions);
  }, [dimensions]);
  
  const wadingPoolPoints = useMemo(() => {
    // Check for custom wading pool vertices array
    if (dimensions.shape === 'wlasny' && dimensions.customWadingPoolVertices?.[0]) {
      return transformCustomVertices(
        dimensions.customWadingPoolVertices[0],
        dimensions.customVertices
      );
    }
    // For regular shapes, generate wading pool points from config
    return getRegularWadingPoolPoints(dimensions);
  }, [dimensions]);
  
  // Calculate bounding box for all elements
  const bounds = useMemo(() => {
    const allPoints = [...poolPoints];
    if (stairsPoints) allPoints.push(...stairsPoints);
    if (wadingPoolPoints) allPoints.push(...wadingPoolPoints);
    
    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));
    
    return { minX, maxX, minY, maxY };
  }, [poolPoints, stairsPoints, wadingPoolPoints]);
  
  // Calculate bounds for stairs and wading pool individually
  const stairsBounds = useMemo(() => {
    if (!stairsPoints || stairsPoints.length < 2) return null;
    const minX = Math.min(...stairsPoints.map(p => p.x));
    const maxX = Math.max(...stairsPoints.map(p => p.x));
    const minY = Math.min(...stairsPoints.map(p => p.y));
    const maxY = Math.max(...stairsPoints.map(p => p.y));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [stairsPoints]);
  
  const wadingBounds = useMemo(() => {
    if (!wadingPoolPoints || wadingPoolPoints.length < 2) return null;
    const minX = Math.min(...wadingPoolPoints.map(p => p.x));
    const maxX = Math.max(...wadingPoolPoints.map(p => p.x));
    const minY = Math.min(...wadingPoolPoints.map(p => p.y));
    const maxY = Math.max(...wadingPoolPoints.map(p => p.y));
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [wadingPoolPoints]);
  
  // Calculate SVG viewBox with padding
  const viewBox = useMemo(() => {
    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.15;
    const x = bounds.minX - padding;
    const y = bounds.minY - padding;
    const w = (bounds.maxX - bounds.minX) + padding * 2;
    const h = (bounds.maxY - bounds.minY) + padding * 2;
    return `${x} ${y} ${w} ${h}`;
  }, [bounds]);
  
  // Convert points to SVG path
  const pointsToPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    // Flip Y axis for SVG (SVG Y goes down, our Y goes up)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${-p.y}`).join(' ') + ' Z';
  };
  
  const poolPath = pointsToPath(poolPoints);
  const stairsPath = stairsPoints ? pointsToPath(stairsPoints) : '';
  const wadingPoolPath = wadingPoolPoints ? pointsToPath(wadingPoolPoints) : '';
  
  // Calculate dimension labels
  const poolWidth = bounds.maxX - bounds.minX;
  const poolHeight = bounds.maxY - bounds.minY;
  
  // Dimension visibility flags
  const showPoolDims = dimensionDisplay === 'all' || dimensionDisplay === 'pool';
  const showStairsDims = dimensionDisplay === 'all' || dimensionDisplay === 'stairs';
  const showWadingDims = dimensionDisplay === 'all' || dimensionDisplay === 'wading';
  
  return (
    <div 
      className="w-full rounded-lg overflow-hidden bg-[#a8c8a0] relative"
      style={{ height }}
    >
      <svg
        viewBox={viewBox}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid2d" width="1" height="1" patternUnits="userSpaceOnUse">
            <path 
              d="M 1 0 L 0 0 0 1" 
              fill="none" 
              stroke="rgba(255,255,255,0.3)" 
              strokeWidth="0.02"
            />
          </pattern>
        </defs>
        <rect 
          x={bounds.minX - 10} 
          y={-bounds.maxY - 10} 
          width={poolWidth + 20} 
          height={poolHeight + 20} 
          fill="url(#grid2d)" 
        />
        
        {/* Pool outline */}
        <path
          d={poolPath}
          fill="#5b9bd5"
          stroke="#0c4a6e"
          strokeWidth="0.05"
        />
        
        {/* Stairs */}
        {stairsPath && (
          <path
            d={stairsPath}
            fill="#ffffff"
            stroke="#f97316"
            strokeWidth="0.04"
            strokeDasharray="0.1 0.05"
          />
        )}
        
        {/* Wading pool */}
        {wadingPoolPath && (
          <path
            d={wadingPoolPath}
            fill="#7ec8e3"
            stroke="#10b981"
            strokeWidth="0.04"
            strokeDasharray="0.1 0.05"
          />
        )}
        
        {/* Pool Dimension lines - only when pool dims enabled */}
        {showPoolDims && (
          <>
            {/* Width dimension (bottom) */}
            <g>
              <line
                x1={bounds.minX}
                y1={-bounds.minY + 0.4}
                x2={bounds.maxX}
                y2={-bounds.minY + 0.4}
                stroke="#f97316"
                strokeWidth="0.03"
                markerStart="url(#arrowStart)"
                markerEnd="url(#arrowEnd)"
              />
              <text
                x={(bounds.minX + bounds.maxX) / 2}
                y={-bounds.minY + 0.7}
                textAnchor="middle"
                fontSize="0.25"
                fill="#f97316"
                fontWeight="bold"
              >
                {poolWidth.toFixed(2)} m
              </text>
            </g>
            
            {/* Height dimension (right) */}
            <g>
              <line
                x1={bounds.maxX + 0.4}
                y1={-bounds.minY}
                x2={bounds.maxX + 0.4}
                y2={-bounds.maxY}
                stroke="#f97316"
                strokeWidth="0.03"
              />
              <text
                x={bounds.maxX + 0.7}
                y={-(bounds.minY + bounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.25"
                fill="#f97316"
                fontWeight="bold"
                transform={`rotate(-90 ${bounds.maxX + 0.7} ${-(bounds.minY + bounds.maxY) / 2})`}
              >
                {poolHeight.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Stairs Dimension lines */}
        {showStairsDims && stairsBounds && stairsPath && (
          <>
            {/* Stairs width */}
            <g>
              <line
                x1={stairsBounds.minX}
                y1={-stairsBounds.maxY - 0.2}
                x2={stairsBounds.maxX}
                y2={-stairsBounds.maxY - 0.2}
                stroke="#22c55e"
                strokeWidth="0.03"
              />
              <text
                x={(stairsBounds.minX + stairsBounds.maxX) / 2}
                y={-stairsBounds.maxY - 0.35}
                textAnchor="middle"
                fontSize="0.2"
                fill="#22c55e"
                fontWeight="bold"
              >
                {stairsBounds.width.toFixed(2)} m
              </text>
            </g>
            {/* Stairs height */}
            <g>
              <line
                x1={stairsBounds.minX - 0.2}
                y1={-stairsBounds.minY}
                x2={stairsBounds.minX - 0.2}
                y2={-stairsBounds.maxY}
                stroke="#22c55e"
                strokeWidth="0.03"
              />
              <text
                x={stairsBounds.minX - 0.35}
                y={-(stairsBounds.minY + stairsBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.2"
                fill="#22c55e"
                fontWeight="bold"
                transform={`rotate(-90 ${stairsBounds.minX - 0.35} ${-(stairsBounds.minY + stairsBounds.maxY) / 2})`}
              >
                {stairsBounds.height.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Wading Pool Dimension lines */}
        {showWadingDims && wadingBounds && wadingPoolPath && (
          <>
            {/* Wading pool width */}
            <g>
              <line
                x1={wadingBounds.minX}
                y1={-wadingBounds.maxY - 0.2}
                x2={wadingBounds.maxX}
                y2={-wadingBounds.maxY - 0.2}
                stroke="#3b82f6"
                strokeWidth="0.03"
              />
              <text
                x={(wadingBounds.minX + wadingBounds.maxX) / 2}
                y={-wadingBounds.maxY - 0.35}
                textAnchor="middle"
                fontSize="0.2"
                fill="#3b82f6"
                fontWeight="bold"
              >
                {wadingBounds.width.toFixed(2)} m
              </text>
            </g>
            {/* Wading pool height */}
            <g>
              <line
                x1={wadingBounds.maxX + 0.2}
                y1={-wadingBounds.minY}
                x2={wadingBounds.maxX + 0.2}
                y2={-wadingBounds.maxY}
                stroke="#3b82f6"
                strokeWidth="0.03"
              />
              <text
                x={wadingBounds.maxX + 0.35}
                y={-(wadingBounds.minY + wadingBounds.maxY) / 2}
                textAnchor="middle"
                fontSize="0.2"
                fill="#3b82f6"
                fontWeight="bold"
                transform={`rotate(-90 ${wadingBounds.maxX + 0.35} ${-(wadingBounds.minY + wadingBounds.maxY) / 2})`}
              >
                {wadingBounds.height.toFixed(2)} m
              </text>
            </g>
          </>
        )}
        
        {/* Arrow markers */}
        <defs>
          <marker
            id="arrowStart"
            markerWidth="0.2"
            markerHeight="0.2"
            refX="0.1"
            refY="0.1"
            orient="auto"
          >
            <path d="M 0.2 0.1 L 0 0.1" stroke="#f97316" strokeWidth="0.03" />
          </marker>
          <marker
            id="arrowEnd"
            markerWidth="0.2"
            markerHeight="0.2"
            refX="0.1"
            refY="0.1"
            orient="auto"
          >
            <path d="M 0 0.1 L 0.2 0.1" stroke="#f97316" strokeWidth="0.03" />
          </marker>
        </defs>
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white/90 rounded p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-[#5b9bd5] border border-[#0c4a6e]" />
          <span>Basen</span>
        </div>
        {stairsPath && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-white border border-[#f97316] border-dashed" />
            <span>Schody</span>
          </div>
        )}
        {wadingPoolPath && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-[#7ec8e3] border border-[#10b981] border-dashed" />
            <span>Brodzik</span>
          </div>
        )}
      </div>
      
      {/* Title */}
      <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs font-medium">
        Widok z góry (2D)
      </div>
    </div>
  );
}
