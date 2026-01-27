import { useMemo } from 'react';
import { PoolDimensions, PoolCorner, WallDirection, StairsConfig, WadingPoolConfig } from '@/types/configurator';

export interface GeometryWarning {
  type: 'collision' | 'out-of-bounds' | 'overlap';
  severity: 'warning' | 'error';
  message: string;
  affectedElements: ('stairs' | 'wading-pool')[];
}

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Get bounding box for stairs based on corner, direction, and dimensions
function getStairsBoundingBox(
  stairs: StairsConfig,
  poolLength: number,
  poolWidth: number,
  poolDepth: number
): BoundingBox | null {
  if (!stairs.enabled) return null;

  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  const stepDepth = stairs.stepDepth || 0.30;
  const stepHeight = stairs.stepHeight || 0.20;
  const stepCount = Math.ceil(poolDepth / stepHeight);
  const stairsLength = stepCount * stepDepth;

  // For wall placement
  if (stairs.placement === 'wall') {
    const wall = stairs.wall || 'back';
    
    switch (wall) {
      case 'back': // Top wall (y = 0)
        return {
          minX: (poolLength - stairsWidth) / 2,
          maxX: (poolLength + stairsWidth) / 2,
          minY: 0,
          maxY: stairsLength
        };
      case 'front': // Bottom wall (y = poolWidth)
        return {
          minX: (poolLength - stairsWidth) / 2,
          maxX: (poolLength + stairsWidth) / 2,
          minY: poolWidth - stairsLength,
          maxY: poolWidth
        };
      case 'left': // Left wall (x = 0)
        return {
          minX: 0,
          maxX: stairsLength,
          minY: (poolWidth - stairsWidth) / 2,
          maxY: (poolWidth + stairsWidth) / 2
        };
      case 'right': // Right wall (x = poolLength)
        return {
          minX: poolLength - stairsLength,
          maxX: poolLength,
          minY: (poolWidth - stairsWidth) / 2,
          maxY: (poolWidth + stairsWidth) / 2
        };
    }
  }

  // For corner placement
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  
  // Determine stair extent based on direction
  const extentAlongDir = stairsWidth;
  const extentPerpDir = stairsLength;

  switch (corner) {
    case 'back-left':
      if (direction === 'along-width') {
        return { minX: 0, maxX: extentPerpDir, minY: 0, maxY: extentAlongDir };
      } else {
        return { minX: 0, maxX: extentAlongDir, minY: 0, maxY: extentPerpDir };
      }
    case 'back-right':
      if (direction === 'along-width') {
        return { minX: poolLength - extentPerpDir, maxX: poolLength, minY: 0, maxY: extentAlongDir };
      } else {
        return { minX: poolLength - extentAlongDir, maxX: poolLength, minY: 0, maxY: extentPerpDir };
      }
    case 'front-left':
      if (direction === 'along-width') {
        return { minX: 0, maxX: extentPerpDir, minY: poolWidth - extentAlongDir, maxY: poolWidth };
      } else {
        return { minX: 0, maxX: extentAlongDir, minY: poolWidth - extentPerpDir, maxY: poolWidth };
      }
    case 'front-right':
      if (direction === 'along-width') {
        return { minX: poolLength - extentPerpDir, maxX: poolLength, minY: poolWidth - extentAlongDir, maxY: poolWidth };
      } else {
        return { minX: poolLength - extentAlongDir, maxX: poolLength, minY: poolWidth - extentPerpDir, maxY: poolWidth };
      }
  }

  return null;
}

// Get bounding box for wading pool based on corner, direction, and dimensions
function getWadingPoolBoundingBox(
  wadingPool: WadingPoolConfig,
  poolLength: number,
  poolWidth: number
): BoundingBox | null {
  if (!wadingPool.enabled) return null;

  const wadingWidth = wadingPool.width || 2;
  const wadingLength = wadingPool.length || 1.5;
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';

  // Width is along the wall direction, length extends into the pool
  const extentAlongWall = direction === 'along-width' ? wadingWidth : wadingLength;
  const extentIntoPool = direction === 'along-width' ? wadingLength : wadingWidth;

  switch (corner) {
    case 'back-left':
      return { minX: 0, maxX: extentIntoPool, minY: 0, maxY: extentAlongWall };
    case 'back-right':
      return { minX: poolLength - extentIntoPool, maxX: poolLength, minY: 0, maxY: extentAlongWall };
    case 'front-left':
      return { minX: 0, maxX: extentIntoPool, minY: poolWidth - extentAlongWall, maxY: poolWidth };
    case 'front-right':
      return { minX: poolLength - extentIntoPool, maxX: poolLength, minY: poolWidth - extentAlongWall, maxY: poolWidth };
  }

  return null;
}

// Check if two bounding boxes overlap
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY);
}

// Check if a bounding box extends beyond pool boundaries
function isOutOfBounds(box: BoundingBox, poolLength: number, poolWidth: number): boolean {
  const tolerance = 0.01; // 1cm tolerance
  return (
    box.minX < -tolerance ||
    box.minY < -tolerance ||
    box.maxX > poolLength + tolerance ||
    box.maxY > poolWidth + tolerance
  );
}

// Check if element is too large for the pool
function isTooLarge(box: BoundingBox, poolLength: number, poolWidth: number): boolean {
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  return boxWidth > poolLength || boxHeight > poolWidth;
}

export function usePoolGeometryValidation(dimensions: PoolDimensions): GeometryWarning[] {
  return useMemo(() => {
    const warnings: GeometryWarning[] = [];
    
    // Only validate for standard shapes (rectangular, oval)
    if (dimensions.shape === 'nieregularny') {
      return warnings;
    }

    const poolLength = dimensions.length || 8;
    const poolWidth = dimensions.width || 4;
    const poolDepth = dimensions.depth || 1.5;

    const stairsBB = getStairsBoundingBox(dimensions.stairs, poolLength, poolWidth, poolDepth);
    const wadingBB = getWadingPoolBoundingBox(dimensions.wadingPool, poolLength, poolWidth);

    // Check stairs bounds
    if (stairsBB) {
      if (isTooLarge(stairsBB, poolLength, poolWidth)) {
        warnings.push({
          type: 'out-of-bounds',
          severity: 'error',
          message: 'Schody są zbyt duże dla tego basenu. Zmniejsz szerokość schodów lub zwiększ wymiary basenu.',
          affectedElements: ['stairs']
        });
      } else if (isOutOfBounds(stairsBB, poolLength, poolWidth)) {
        warnings.push({
          type: 'out-of-bounds',
          severity: 'warning',
          message: 'Schody wykraczają poza granice basenu.',
          affectedElements: ['stairs']
        });
      }
    }

    // Check wading pool bounds
    if (wadingBB) {
      if (isTooLarge(wadingBB, poolLength, poolWidth)) {
        warnings.push({
          type: 'out-of-bounds',
          severity: 'error',
          message: 'Brodzik jest zbyt duży dla tego basenu. Zmniejsz wymiary brodzika lub zwiększ wymiary basenu.',
          affectedElements: ['wading-pool']
        });
      } else if (isOutOfBounds(wadingBB, poolLength, poolWidth)) {
        warnings.push({
          type: 'out-of-bounds',
          severity: 'warning',
          message: 'Brodzik wykracza poza granice basenu.',
          affectedElements: ['wading-pool']
        });
      }
    }

    // Check collision between stairs and wading pool
    if (stairsBB && wadingBB && boxesOverlap(stairsBB, wadingBB)) {
      warnings.push({
        type: 'collision',
        severity: 'error',
        message: 'Schody i brodzik nakładają się na siebie. Wybierz różne narożniki lub zmień wymiary.',
        affectedElements: ['stairs', 'wading-pool']
      });
    }

    // Check if stairs take too much of pool area (more than 30%)
    if (stairsBB && dimensions.stairs.enabled) {
      const stairsArea = (stairsBB.maxX - stairsBB.minX) * (stairsBB.maxY - stairsBB.minY);
      const poolArea = poolLength * poolWidth;
      if (stairsArea / poolArea > 0.3) {
        warnings.push({
          type: 'overlap',
          severity: 'warning',
          message: `Schody zajmują ${Math.round(stairsArea / poolArea * 100)}% powierzchni basenu.`,
          affectedElements: ['stairs']
        });
      }
    }

    // Check if wading pool takes too much of pool area (more than 40%)
    if (wadingBB && dimensions.wadingPool.enabled) {
      const wadingArea = (wadingBB.maxX - wadingBB.minX) * (wadingBB.maxY - wadingBB.minY);
      const poolArea = poolLength * poolWidth;
      if (wadingArea / poolArea > 0.4) {
        warnings.push({
          type: 'overlap',
          severity: 'warning',
          message: `Brodzik zajmuje ${Math.round(wadingArea / poolArea * 100)}% powierzchni basenu.`,
          affectedElements: ['wading-pool']
        });
      }
    }

    return warnings;
  }, [
    dimensions.shape,
    dimensions.length,
    dimensions.width,
    dimensions.depth,
    dimensions.stairs.enabled,
    dimensions.stairs.placement,
    dimensions.stairs.wall,
    dimensions.stairs.corner,
    dimensions.stairs.direction,
    dimensions.stairs.width,
    dimensions.stairs.stepHeight,
    dimensions.stairs.stepDepth,
    dimensions.wadingPool.enabled,
    dimensions.wadingPool.corner,
    dimensions.wadingPool.direction,
    dimensions.wadingPool.width,
    dimensions.wadingPool.length
  ]);
}
