/**
 * Extended Foil Planner Types
 * 
 * Supports:
 * - Stairs (steps = anti-slip, risers = regular foil)
 * - Paddling pools (bottom = anti-slip, walls = regular foil)
 * - Dividing wall with correct geometry
 * - Structural foils with butt joints
 */

import { FoilPlanResult, FoilStrip, ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE } from '../foilPlanner';

// Extended surface types for stairs, paddling pools, and dividing walls
export type ExtendedSurfaceType =
  // Main pool surfaces (from original)
  | 'bottom'
  | 'bottom-slope'
  | 'wall-long-1'
  | 'wall-long-2'
  | 'wall-short-1'
  | 'wall-short-2'
  | 'l-arm'
  // Stairs surfaces
  | 'stairs-step'           // Horizontal step treads (anti-slip)
  | 'stairs-riser'          // Vertical step risers (regular foil)
  // Paddling pool surfaces
  | 'paddling-bottom'       // Paddling pool bottom (anti-slip)
  | 'paddling-wall'         // Paddling pool walls (regular foil)
  // Dividing wall surfaces
  | 'dividing-wall-pool'    // Wall facing main pool (regular foil)
  | 'dividing-wall-paddling' // Wall facing paddling pool (regular foil)
  | 'dividing-wall-top';    // Top of dividing wall (horizontal, like step)

// Extended surface plan that accepts extended surface types
export interface ExtendedSurfacePlan {
  type: ExtendedSurfaceType;
  width: number;
  length: number;
  area: number;
  strips: FoilStrip[];
  recommendedRollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
}

// Foil type classification
export type FoilCategory = 'jednokolorowa' | 'nadruk' | 'strukturalna';
export type JointType = 'overlap' | 'butt' | null;

// Product interface for foil (minimal subset needed for planning)
export interface FoilProduct {
  id: string;
  name: string;
  foil_category?: FoilCategory;
  joint_type?: JointType;
  shade?: string;
  foil_width?: number;
  available_widths?: number[];
  overlap_width?: number;
}

// Stairs plan result
export interface StairsPlanResult {
  surfaces: ExtendedSurfacePlan[];
  stepArea: number;      // Total horizontal step area (anti-slip)
  riserArea: number;     // Total vertical riser area (regular foil)
  antiSlipProductId?: string;
}

// Dividing wall breakdown
export interface DividingWallPlan {
  poolSideArea: number;      // Wall facing main pool (height = poolDepth - paddlingDepth)
  paddlingSideArea: number;  // Wall facing paddling pool (height = dividingWallOffset)
  topArea: number;           // Top of wall (horizontal, treated like step)
  poolSideHeight: number;    // Height from pool bottom to wall top
  paddlingSideHeight: number; // Height of wall above paddling pool floor (= dividingWallOffset)
  wallWidth: number;         // Width of dividing wall (same as paddling pool width)
  wallThickness: number;     // Thickness of wall (default 0.15m)
}

// Paddling pool plan result
export interface PaddlingPlanResult {
  surfaces: ExtendedSurfacePlan[];
  bottomArea: number;    // Paddling pool bottom (anti-slip)
  wallsArea: number;     // 3 external walls (regular foil)
  dividingWall?: DividingWallPlan;
}

// Extended foil plan result with stairs and paddling pool
export interface ExtendedFoilPlanResult extends FoilPlanResult {
  // Stairs data
  stairsPlan?: StairsPlanResult;
  
  // Paddling pool data
  paddlingPlan?: PaddlingPlanResult;
  
  // Structural foil flags
  isStructural: boolean;       // Whether selected foil is structural (anti-slip)
  buttJointLength: number;     // Total length of butt joints (m) for welding service
  
  // Optimization score (lower = better)
  score: number;
  
  // Anti-slip summary (total area requiring anti-slip foil)
  antiSlipTotalArea: number;
}

// Surfaces that require anti-slip foil (unless main foil is already structural)
export const ANTI_SLIP_SURFACES: ExtendedSurfaceType[] = [
  'stairs-step',
  'paddling-bottom',
];

// Default wall thickness for dividing wall (15cm)
export const DIVIDING_WALL_THICKNESS = 0.15;
