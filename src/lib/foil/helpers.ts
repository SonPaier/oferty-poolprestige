/**
 * Foil Planner Helper Functions
 * 
 * - Foil type detection
 * - Anti-slip foil matching
 * - Plan scoring
 */

import { FoilPlanResult } from '../foilPlanner';
import { FoilProduct } from './types';

/**
 * Check if a product is a structural (anti-slip) foil
 * Structural foils include Relief, Touch, Ceramics series
 */
export function isStructuralFoil(product?: FoilProduct | null): boolean {
  if (!product) return false;
  return product.foil_category === 'strukturalna';
}

/**
 * Check if a product uses butt joint (no overlap)
 * Touch and Ceramics series use butt joints
 */
export function isButtJointFoil(product?: FoilProduct | null): boolean {
  if (!product) return false;
  return product.joint_type === 'butt';
}

/**
 * Find matching anti-slip foil for stairs/paddling pool
 * 
 * Priority:
 * 1. If selected foil is already structural → use it
 * 2. Find structural foil with matching shade (color)
 * 3. Fallback to any structural foil
 * 
 * @param selectedProduct Main pool foil selection
 * @param allProducts Available products to search
 * @returns Matching anti-slip product or null
 */
export function getAntiSlipFoilForStairs(
  selectedProduct: FoilProduct | null,
  allProducts: FoilProduct[]
): FoilProduct | null {
  // If main foil is already structural, use it everywhere
  if (selectedProduct && isStructuralFoil(selectedProduct)) {
    return selectedProduct;
  }
  
  // Find structural foil with matching shade
  if (selectedProduct?.shade) {
    const matchingShade = allProducts.find(
      p => isStructuralFoil(p) && p.shade === selectedProduct.shade
    );
    if (matchingShade) return matchingShade;
  }
  
  // Fallback: any structural foil
  return allProducts.find(p => isStructuralFoil(p)) || null;
}

/**
 * Calculate optimization score for a foil cutting plan
 * Lower score = better plan
 * 
 * Scoring factors:
 * - Waste percentage (major factor)
 * - Number of validation issues
 * - Number of strips (more strips = more welds)
 * - Number of rolls (cost factor)
 * - Bonus for using single roll width (simpler execution)
 */
export function scoreCuttingPlan(plan: FoilPlanResult): number {
  let score = 0;
  
  // Penalties
  score += plan.wastePercentage * 10;        // Waste is expensive
  score += plan.issues.length * 50;           // Validation issues are critical
  score += plan.strips.length * 2;            // Each strip = a weld seam
  score += plan.rolls.length * 5;             // Each roll = material cost
  
  // Bonuses
  const uniqueWidths = new Set(plan.strips.map(s => s.rollWidth));
  if (uniqueWidths.size === 1) {
    score -= 20;  // Using single width simplifies work
  }
  
  // Bonus for good roll utilization (less than 10% waste per roll)
  const wellUtilizedRolls = plan.rolls.filter(
    r => r.wasteLength < 0.1 * 25 // Less than 2.5m waste per 25m roll
  ).length;
  score -= wellUtilizedRolls * 3;
  
  return Math.max(0, score);
}

/**
 * Calculate total butt joint length from bottom strips
 * Used for structural foils that require butt welding service
 */
export function calculateButtJointLength(strips: { 
  surface: string; 
  stripLength: number; 
  overlap: number;
}[]): number {
  // Butt joints occur between adjacent strips on the bottom
  const bottomStrips = strips.filter(s => 
    s.surface === 'bottom' || 
    s.surface === 'bottom-slope' ||
    s.surface === 'paddling-bottom'
  );
  
  if (bottomStrips.length <= 1) return 0;
  
  // Sum of all strip lengths (each joint runs the full strip length)
  // Number of joints = number of strips - 1
  let totalJointLength = 0;
  for (let i = 1; i < bottomStrips.length; i++) {
    // Joint length is the shorter of the two adjacent strip lengths
    totalJointLength += Math.min(
      bottomStrips[i - 1].stripLength,
      bottomStrips[i].stripLength
    );
  }
  
  return totalJointLength;
}
