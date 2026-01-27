import { useMemo } from 'react';
import { PoolDimensions, StairsConfig, WadingPoolConfig } from '@/types/configurator';

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

// Get bounding box for stairs based on placement, corner, direction, and dimensions
// Coordinates: X = length (left to right), Y = width (back to front)
// Origin at back-left corner (0,0)
function getStairsBoundingBox(
  stairs: StairsConfig,
  poolLength: number,
  poolWidth: number,
  poolDepth: number
): BoundingBox | null {
  if (!stairs.enabled) return null;

  const stairsWidth = typeof stairs.width === 'number' ? stairs.width : 1.5;
  const stepDepth = stairs.stepDepth || 0.30;
  // Use stepCount from config, not calculated from height
  const stepCount = stairs.stepCount || 4;
  const stairsLength = stepCount * stepDepth;

  // For wall placement - stairs centered on wall, extending into pool
  if (stairs.placement === 'wall') {
    const wall = stairs.wall || 'back';
    
    switch (wall) {
      case 'back': // Back wall (Y=0), stairs extend into pool (+Y direction)
        return {
          minX: (poolLength - stairsWidth) / 2,
          maxX: (poolLength + stairsWidth) / 2,
          minY: 0,
          maxY: stairsLength
        };
      case 'front': // Front wall (Y=poolWidth), stairs extend into pool (-Y direction)
        return {
          minX: (poolLength - stairsWidth) / 2,
          maxX: (poolLength + stairsWidth) / 2,
          minY: poolWidth - stairsLength,
          maxY: poolWidth
        };
      case 'left': // Left wall (X=0), stairs extend into pool (+X direction)
        return {
          minX: 0,
          maxX: stairsLength,
          minY: (poolWidth - stairsWidth) / 2,
          maxY: (poolWidth + stairsWidth) / 2
        };
      case 'right': // Right wall (X=poolLength), stairs extend into pool (-X direction)
        return {
          minX: poolLength - stairsLength,
          maxX: poolLength,
          minY: (poolWidth - stairsWidth) / 2,
          maxY: (poolWidth + stairsWidth) / 2
        };
    }
  }

  // For diagonal placement (45° corner stairs) - triangular shape approximated as square bounding box
  if (stairs.placement === 'diagonal') {
    const corner = stairs.corner || 'back-left';
    const diagonalSize = stairsWidth; // The triangle extends this far in both X and Y
    
    switch (corner) {
      case 'back-left':
        return { minX: 0, maxX: diagonalSize, minY: 0, maxY: diagonalSize };
      case 'back-right':
        return { minX: poolLength - diagonalSize, maxX: poolLength, minY: 0, maxY: diagonalSize };
      case 'front-left':
        return { minX: 0, maxX: diagonalSize, minY: poolWidth - diagonalSize, maxY: poolWidth };
      case 'front-right':
        return { minX: poolLength - diagonalSize, maxX: poolLength, minY: poolWidth - diagonalSize, maxY: poolWidth };
    }
  }

  // For corner placement - stairs start at corner, extend along one wall direction
  const corner = stairs.corner || 'back-left';
  const direction = stairs.direction || 'along-width';
  
  // Width is along the selected direction, length (steps) is perpendicular
  const isAlongLength = direction === 'along-length';
  const sizeAlongDir = stairsWidth;
  const sizePerp = stairsLength;

  switch (corner) {
    case 'back-left': // Corner at (0, 0)
      if (isAlongLength) {
        // Steps extend along X, stair body extends along Y
        return { minX: 0, maxX: sizeAlongDir, minY: 0, maxY: sizePerp };
      } else {
        // Steps extend along Y, stair body extends along X
        return { minX: 0, maxX: sizePerp, minY: 0, maxY: sizeAlongDir };
      }
    case 'back-right': // Corner at (poolLength, 0)
      if (isAlongLength) {
        return { minX: poolLength - sizeAlongDir, maxX: poolLength, minY: 0, maxY: sizePerp };
      } else {
        return { minX: poolLength - sizePerp, maxX: poolLength, minY: 0, maxY: sizeAlongDir };
      }
    case 'front-left': // Corner at (0, poolWidth)
      if (isAlongLength) {
        return { minX: 0, maxX: sizeAlongDir, minY: poolWidth - sizePerp, maxY: poolWidth };
      } else {
        return { minX: 0, maxX: sizePerp, minY: poolWidth - sizeAlongDir, maxY: poolWidth };
      }
    case 'front-right': // Corner at (poolLength, poolWidth)
      if (isAlongLength) {
        return { minX: poolLength - sizeAlongDir, maxX: poolLength, minY: poolWidth - sizePerp, maxY: poolWidth };
      } else {
        return { minX: poolLength - sizePerp, maxX: poolLength, minY: poolWidth - sizeAlongDir, maxY: poolWidth };
      }
  }

  return null;
}

// Get bounding box for wading pool based on corner, direction, and dimensions
// Same coordinate system as stairs
function getWadingPoolBoundingBox(
  wadingPool: WadingPoolConfig,
  poolLength: number,
  poolWidth: number
): BoundingBox | null {
  if (!wadingPool.enabled) return null;

  const wpWidth = wadingPool.width || 2; // Width along wall
  const wpLength = wadingPool.length || 1.5; // Length into pool
  const corner = wadingPool.corner || 'back-left';
  const direction = wadingPool.direction || 'along-width';

  // Direction determines orientation:
  // along-width: wpWidth goes along Y axis, wpLength goes along X axis
  // along-length: wpWidth goes along X axis, wpLength goes along Y axis
  const isAlongLength = direction === 'along-length';
  const sizeX = isAlongLength ? wpWidth : wpLength;
  const sizeY = isAlongLength ? wpLength : wpWidth;

  switch (corner) {
    case 'back-left': // Corner at (0, 0)
      return { minX: 0, maxX: sizeX, minY: 0, maxY: sizeY };
    case 'back-right': // Corner at (poolLength, 0)
      return { minX: poolLength - sizeX, maxX: poolLength, minY: 0, maxY: sizeY };
    case 'front-left': // Corner at (0, poolWidth)
      return { minX: 0, maxX: sizeX, minY: poolWidth - sizeY, maxY: poolWidth };
    case 'front-right': // Corner at (poolLength, poolWidth)
      return { minX: poolLength - sizeX, maxX: poolLength, minY: poolWidth - sizeY, maxY: poolWidth };
  }

  return null;
}

// Check if two bounding boxes overlap (strict overlap, not just touching)
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  // No overlap if one is completely to the left, right, above, or below the other
  const noOverlap = a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY;
  return !noOverlap;
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

// Calculate overlap area between two boxes (for debugging)
function getOverlapArea(a: BoundingBox, b: BoundingBox): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return overlapX * overlapY;
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

    // Debug logging (can be removed in production)
    // console.log('Stairs BB:', stairsBB);
    // console.log('Wading BB:', wadingBB);

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
      const overlapArea = getOverlapArea(stairsBB, wadingBB);
      warnings.push({
        type: 'collision',
        severity: 'error',
        message: `Schody i brodzik nakładają się na siebie (${overlapArea.toFixed(2)} m²). Wybierz różne narożniki lub zmień wymiary.`,
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
    dimensions.stairs.stepCount, // Added stepCount instead of stepHeight
    dimensions.stairs.stepDepth,
    dimensions.wadingPool.enabled,
    dimensions.wadingPool.corner,
    dimensions.wadingPool.direction,
    dimensions.wadingPool.width,
    dimensions.wadingPool.length
  ]);
}
