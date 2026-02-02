/**
 * Extended Foil Planner Types
 * 
 * Supports:
 * - Stairs (steps = anti-slip, risers = regular foil)
 * - Paddling pools (bottom = anti-slip, walls = regular foil)
 * - Dividing wall with correct geometry
 * - Structural foils with butt joints
 * 
 * Foil Assignment Rules:
 * - MAIN FOIL: bottom, walls, dividing wall (user's choice: plain/printed/structural)
 * - STRUCTURAL FOIL: stairs (steps + risers), paddling pool bottom (anti-slip)
 */

import { FoilStrip, ROLL_WIDTH_NARROW, ROLL_WIDTH_WIDE } from '../foilPlanner';

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
  | 'paddling-wall'         // Paddling pool external walls (regular foil)
  // Dividing wall surfaces
  | 'dividing-wall-pool'    // Wall facing main pool (regular foil)
  | 'dividing-wall-paddling' // Wall facing paddling pool (regular foil)
  | 'dividing-wall-top';    // Top of dividing wall (horizontal, like step)

/**
 * Foil assignment type - determines which foil pool a surface belongs to
 * - 'main': Uses the user-selected foil (plain/printed/structural)
 * - 'structural': Always uses structural anti-slip foil (1.65m only)
 */
export type FoilAssignment = 'main' | 'structural';

/**
 * Mapping of surface types to their foil assignment
 * 
 * Main foil: bottom, walls, dividing wall (murek)
 * Structural foil: stairs, paddling pool bottom
 */
export const SURFACE_FOIL_ASSIGNMENT: Record<ExtendedSurfaceType, FoilAssignment> = {
  // Main pool surfaces - use user's selected foil
  'bottom': 'main',
  'bottom-slope': 'main',
  'wall-long-1': 'main',
  'wall-long-2': 'main',
  'wall-short-1': 'main',
  'wall-short-2': 'main',
  'l-arm': 'main',
  
  // Dividing wall (murek) - uses MAIN foil (same as pool walls)
  'dividing-wall-pool': 'main',
  'dividing-wall-paddling': 'main',
  'dividing-wall-top': 'main',
  
  // Stairs - always use STRUCTURAL anti-slip foil
  'stairs-step': 'structural',
  'stairs-riser': 'structural',
  
  // Paddling pool bottom - always use STRUCTURAL anti-slip foil
  'paddling-bottom': 'structural',
  
  // Paddling pool external walls (without dividing wall) - structural
  'paddling-wall': 'structural',
};

// Extended surface plan that accepts extended surface types
export interface ExtendedSurfacePlan {
  type: ExtendedSurfaceType;
  width: number;
  length: number;
  area: number;
  strips: FoilStrip[];
  recommendedRollWidth: typeof ROLL_WIDTH_NARROW | typeof ROLL_WIDTH_WIDE;
  /** Which foil pool this surface belongs to */
  foilAssignment: FoilAssignment;
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
export interface ExtendedFoilPlanResult {
  // Main pool foil surfaces
  mainPoolSurfaces: ExtendedSurfacePlan[];
  
  // Structural foil surfaces (stairs + paddling bottom)
  structuralSurfaces: ExtendedSurfacePlan[];
  
  // Stairs data
  stairsPlan?: StairsPlanResult;
  
  // Paddling pool data
  paddlingPlan?: PaddlingPlanResult;
  
  // Structural foil flags
  isStructural: boolean;       // Whether selected main foil is structural
  buttJointLength: number;     // Total length of butt joints (m) for welding service
  
  // Optimization score (lower = better)
  score: number;
  
  // Summary areas by foil type
  mainFoilTotalArea: number;
  structuralFoilTotalArea: number;
}

// Surfaces that require anti-slip foil (unless main foil is already structural)
export const ANTI_SLIP_SURFACES: ExtendedSurfaceType[] = [
  'stairs-step',
  'paddling-bottom',
];

// Default wall thickness for dividing wall (15cm)
export const DIVIDING_WALL_THICKNESS = 0.15;

// Algorithm constants
export const WASTE_THRESHOLD = 0.30;        // Strip < 30cm = waste
export const OVERLAP_STRIPS = 0.10;         // Overlap between strips: 10cm
export const OVERLAP_WALL_BOTTOM = 0.07;    // Weld at wall bottom: 7cm
export const OVERLAP_WALL_TOP = 0.07;       // Connection at top: 7cm
export const DEPTH_THRESHOLD_NARROW = 1.50; // Up to 1.50m → use 1.65m foil
export const DEPTH_THRESHOLD_WIDE = 1.95;   // 1.51-1.95m → use 2.05m foil
// >1.95m → use two 1.65m strips with overlap
