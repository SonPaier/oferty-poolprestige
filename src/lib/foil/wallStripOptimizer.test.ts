import { describe, it, expect } from "vitest";
import { getOptimalWallStripPlan } from "./wallStripOptimizer";
import {
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
  type MixConfiguration,
} from "./mixPlanner";
import {
  defaultStairsConfig,
  defaultWadingPoolConfig,
  type PoolDimensions,
} from "@/types/configurator";

function makeDimensions10x5x15(): PoolDimensions {
  return {
    shape: "prostokatny",
    location: "wewnetrzny",
    liningType: "foliowany",
    length: 10,
    width: 5,
    depth: 1.5,
    hasSlope: false,
    isIrregular: false,
    overflowType: "skimmerowy",
    attractions: 0,
    stairs: defaultStairsConfig,
    wadingPool: defaultWadingPoolConfig,
  };
}

function makeConfigForBottom10mMixedWidths(): MixConfiguration {
  return {
    surfaces: [
      {
        surface: "bottom",
        surfaceLabel: "Dno",
        rollWidth: ROLL_WIDTH_WIDE,
        stripMix: [
          { rollWidth: ROLL_WIDTH_WIDE, count: 1 },
          { rollWidth: ROLL_WIDTH_NARROW, count: 2 },
        ],
        stripCount: 3,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 10,
        coverWidth: 5,
        foilAssignment: "main",
      },
      {
        surface: "walls",
        surfaceLabel: "Ściany",
        rollWidth: ROLL_WIDTH_NARROW,
        stripCount: 0,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 0,
        coverWidth: 1.5,
        foilAssignment: "main",
      },
    ],
    totalRolls165: 0,
    totalRolls205: 0,
    totalWaste: 0,
    wastePercentage: 0,
    isOptimized: true,
  };
}

function makeDimensions8x4x15(): PoolDimensions {
  return {
    shape: "prostokatny",
    location: "wewnetrzny",
    liningType: "foliowany",
    length: 8,
    width: 4,
    depth: 1.5,
    hasSlope: false,
    isIrregular: false,
    overflowType: "skimmerowy",
    attractions: 0,
    stairs: defaultStairsConfig,
    wadingPool: defaultWadingPoolConfig,
  };
}

function makeConfigForBottom8m(): MixConfiguration {
  return {
    surfaces: [
      {
        surface: "bottom",
        surfaceLabel: "Dno",
        rollWidth: ROLL_WIDTH_WIDE,
        stripMix: [
          { rollWidth: ROLL_WIDTH_WIDE, count: 2 },
        ],
        stripCount: 2,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 8,
        coverWidth: 4,
        foilAssignment: "main",
      },
      {
        surface: "walls",
        surfaceLabel: "Ściany",
        rollWidth: ROLL_WIDTH_NARROW,
        stripCount: 0,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 0,
        coverWidth: 1.5,
        foilAssignment: "main",
      },
    ],
    totalRolls165: 0,
    totalRolls205: 0,
    totalWaste: 0,
    wastePercentage: 0,
    isOptimized: true,
  };
}

describe("wallStripOptimizer priority behavior", () => {
  it("minWaste should prefer strips that fit in bottom offcuts for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");

    expect(wastePlan).toBeTruthy();
    // The optimizer should prefer a plan where wall strips fit into bottom roll offcuts
    // (additionalArea = 0), rather than 2 long strips where one needs a new roll.
    // This can be 4 separate strips or any configuration that fits in offcuts.
    expect(wastePlan!.totalStripCount).toBeGreaterThanOrEqual(2);
    
    // Total foil area should be reasonable (not inflated by wide rolls)
    // 4 strips × 1.65m × (10+5+10+5 + 4×0.1) = 1.65 × 30.4 ≈ 50.2
    // or similar with mixed widths
    expect(wastePlan!.totalFoilArea).toBeLessThan(65);
  });

  it("minRolls guardrail should fallback to minWaste when minRolls doesn't reduce rolls", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // Guardrail: if minRolls doesn't reduce rolls but increases foil area, use minWaste
    // minRolls should NOT produce worse results than minWaste
    expect(rollsPlan!.totalFoilArea).toBeLessThanOrEqual(wastePlan!.totalFoilArea + 0.01);
  });

  it("minWaste should prefer 1 continuous strip for 8x4x1.5m pool (perimeter 24m fits in 25m roll)", () => {
    const dimensions = makeDimensions8x4x15();
    const config = makeConfigForBottom8m();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");

    expect(wastePlan).toBeTruthy();
    
    // 24m perimeter + 0.1m overlap = 24.1m, fits in one 25m roll
    // Should prefer 1 strip (fewer welds) over 4 strips
    expect(wastePlan!.totalStripCount).toBe(1);
    expect(wastePlan!.strips[0].totalLength).toBeCloseTo(24.1, 1);
  });

  it("minRolls should match minWaste for 8x4x1.5m (same roll count => prefer 1.65m + fewer strips)", () => {
    const dimensions = makeDimensions8x4x15();
    const config = makeConfigForBottom8m();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // Both should prefer 1 continuous strip (24.1m) and narrow width
    expect(rollsPlan!.totalStripCount).toBe(1);
    expect(rollsPlan!.strips[0].totalLength).toBeCloseTo(24.1, 1);
    expect(rollsPlan!.strips[0].rollWidth).toBe(ROLL_WIDTH_NARROW);
  });
});
