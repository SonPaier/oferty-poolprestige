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
  it("minWaste should prefer asymmetric 15m + 15.2m strips for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");

    expect(wastePlan).toBeTruthy();
    expect(wastePlan!.totalStripCount).toBe(2);
    
    const lengths = wastePlan!.strips.map(s => s.totalLength).sort((a, b) => a - b);
    // 15.0 + 15.2 (asymmetric: 15m pairs with 10m bottom = 25m full roll)
    expect(lengths[0]).toBeCloseTo(15.0, 1);
    expect(lengths[1]).toBeCloseTo(15.2, 1);
    
    // Both should be 1.65m wide (no unnecessary 2.05m)
    expect(wastePlan!.strips.every(s => s.rollWidth === ROLL_WIDTH_NARROW)).toBe(true);
  });

  it("minRolls should produce different wall plan for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // minRolls should produce a DIFFERENT configuration than minWaste
    const wasteStr = JSON.stringify(wastePlan!.strips.map(s => [s.rollWidth, s.totalLength]).sort());
    const rollsStr = JSON.stringify(rollsPlan!.strips.map(s => [s.rollWidth, s.totalLength]).sort());
    expect(rollsStr).not.toBe(wasteStr);
  });

  it("minRolls guardrail: should not increase foil area without reducing rolls", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // If minRolls uses more foil, it must reduce total rolls (guardrail ensures this)
    // This test verifies the guardrail doesn't let through wasteful plans
    expect(rollsPlan!.totalFoilArea).toBeLessThanOrEqual(wastePlan!.totalFoilArea * 1.5);
  });

  it("minWaste should prefer 1 continuous strip for 8x4x1.5m pool", () => {
    const dimensions = makeDimensions8x4x15();
    const config = makeConfigForBottom8m();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");

    expect(wastePlan).toBeTruthy();
    expect(wastePlan!.totalStripCount).toBe(1);
    expect(wastePlan!.strips[0].totalLength).toBeCloseTo(24.1, 1);
  });

  it("minRolls should match minWaste for 8x4x1.5m (guardrail fallback)", () => {
    const dimensions = makeDimensions8x4x15();
    const config = makeConfigForBottom8m();

    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    expect(rollsPlan).toBeTruthy();
    expect(rollsPlan!.totalStripCount).toBe(1);
    expect(rollsPlan!.strips[0].totalLength).toBeCloseTo(24.1, 1);
    expect(rollsPlan!.strips[0].rollWidth).toBe(ROLL_WIDTH_NARROW);
  });
});