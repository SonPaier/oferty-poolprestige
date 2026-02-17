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
  it("minWaste should prefer symmetric 15m + 15.2m strips for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");

    expect(wastePlan).toBeTruthy();
    expect(wastePlan!.totalStripCount).toBe(2);
    
    // Expected: Two symmetric strips A-B-C (15m) and C-D-A (15m) with overlaps distributed
    // Total overlap = 2 strips × 0.1m = 0.2m, distributed between strips
    const lengths = wastePlan!.strips.map(s => s.totalLength).sort((a, b) => a - b);
    // Both strips should be around 15m + some overlap (total 30.2m)
    expect(lengths[0] + lengths[1]).toBeCloseTo(30.2, 1);
    // Difference between strips should be small (symmetric distribution)
    expect(Math.abs(lengths[1] - lengths[0])).toBeLessThan(1);
    
    // Both should be 1.65m wide
    expect(wastePlan!.strips.every(s => s.rollWidth === ROLL_WIDTH_NARROW)).toBe(true);
  });

  it("minWaste and minRolls should produce different wall plans for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // Expected: Min waste prefers 2 continuous strips.
    expect(wastePlan!.totalStripCount).toBe(2);

    // Expected: Min rolls should produce a DIFFERENT configuration than min waste.
    const wasteAreaStr = JSON.stringify(wastePlan!.strips.map(s => [s.rollWidth, s.totalLength]));
    const rollsAreaStr = JSON.stringify(rollsPlan!.strips.map(s => [s.rollWidth, s.totalLength]));
    expect(rollsAreaStr).not.toBe(wasteAreaStr);
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
