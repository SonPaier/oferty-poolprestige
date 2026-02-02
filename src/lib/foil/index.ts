/**
 * Extended Foil Planner Module
 * 
 * Exports all foil planning functionality including:
 * - Types and interfaces
 * - Helper functions
 * - Stairs planner
 * - Paddling pool planner
 * - MIX roll configuration planner
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

// MIX roll planner
export {
  autoOptimizeMixConfig,
  updateSurfaceRollWidth,
  packStripsIntoRolls,
  calculateComparison,
  isNarrowOnlyFoil,
  getAvailableWidths,
  usesButtJoint,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
  ROLL_LENGTH,
  BUTT_JOINT_OVERLAP,
} from './mixPlanner';

export type {
  MixConfiguration,
  SurfaceRollConfig,
  RollAllocation,
  SurfaceKey,
  RollWidth,
} from './mixPlanner';
