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

describe("wallStripOptimizer priority behavior", () => {
  it("minWaste and minRolls should produce different wall plans for 10x5x1.5m", () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeConfigForBottom10mMixedWidths();

    const wastePlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minWaste");
    const rollsPlan = getOptimalWallStripPlan(dimensions, config, "jednokolorowa", "minRolls");

    // Debug (printed in test runner output)
    // eslint-disable-next-line no-console
    console.log({
      waste: wastePlan?.strips.map((s) => ({ w: s.rollWidth, len: s.totalLength, ov: s.verticalOverlap, labels: s.wallLabels })),
      rolls: rollsPlan?.strips.map((s) => ({ w: s.rollWidth, len: s.totalLength, ov: s.verticalOverlap, labels: s.wallLabels })),
    });

    expect(wastePlan).toBeTruthy();
    expect(rollsPlan).toBeTruthy();

    // Expected: Min waste prefers 2 continuous strips.
    expect(wastePlan!.totalStripCount).toBe(2);

    // Expected: Min rolls should prefer mixed widths and 4 strips to pair with bottom offcuts.
    expect(rollsPlan!.totalStripCount).toBe(4);
    expect(rollsPlan!.strips.some((s) => s.rollWidth === ROLL_WIDTH_WIDE)).toBe(true);

    // Important rule: do not add vertical overlap to expensive 2.05m strip(s)
    for (const s of rollsPlan!.strips) {
      if (s.rollWidth === ROLL_WIDTH_WIDE) {
        expect(s.verticalOverlap).toBe(0);
      }
    }
  });
});
