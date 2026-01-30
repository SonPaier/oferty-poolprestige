/**
 * Extended Foil Planner Module
 * 
 * Exports all foil planning functionality including:
 * - Types and interfaces
 * - Helper functions
 * - Stairs planner
 * - Paddling pool planner
 */

// Types
export * from './types';

// Helper functions
export {
  isStructuralFoil,
  isButtJointFoil,
  getAntiSlipFoilForStairs,
  scoreCuttingPlan,
  calculateButtJointLength,
} from './helpers';

// Stairs planner
export {
  planStairsSurface,
  calculateTotalStairsArea,
} from './stairsPlanner';

// Paddling pool planner
export {
  planPaddlingPoolSurface,
  calculateTotalPaddlingArea,
} from './paddlingPlanner';
