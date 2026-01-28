// Pool visualization components - reusable across all pool shapes

export { StairsMesh3D } from './StairsMesh3D';
export { StairsPath2D, getStairsRenderData } from './StairsPath2D';

// Re-export stair shape generator utilities
export { 
  generateStairsGeometry,
  generateRectangularStairs,
  generateDiagonal45Stairs,
  generateLShapeStairs,
  generateTriangleStairs,
  calculateStairsArea,
  isPointInStairs,
  getPoolCornerPosition,
  getInwardDirections,
} from '@/lib/stairsShapeGenerator';
