import { describe, it, expect } from 'vitest';
import type { PoolDimensions } from '@/types/configurator';
import { defaultStairsConfig, defaultWadingPoolConfig } from '@/types/configurator';
import {
  packStripsIntoRolls,
  type MixConfiguration,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
} from './mixPlanner';

function makeDimensions10x5x15(): PoolDimensions {
  // minimal shape config needed by getWallSegments(dimensions) used inside packing
  return {
    shape: 'prostokatny',
    location: 'wewnetrzny',
    liningType: 'foliowany',
    length: 10,
    width: 5,
    depth: 1.5,
    hasSlope: false,
    isIrregular: false,
    overflowType: 'skimmerowy',
    attractions: 0,
    stairs: defaultStairsConfig,
    wadingPool: defaultWadingPoolConfig,
  };
}

function makeMainConfigBottomMixedAndWallsPresent(): MixConfiguration {
  return {
    surfaces: [
      {
        surface: 'bottom',
        surfaceLabel: 'Dno',
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
        foilAssignment: 'main',
      },
      // These exist only to enable dimensions-aware continuous wall injection.
      {
        surface: 'wall-long',
        surfaceLabel: 'Ściany długie (2×)',
        rollWidth: ROLL_WIDTH_NARROW,
        stripCount: 2,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 10,
        coverWidth: 1.65,
        foilAssignment: 'main',
      },
      {
        surface: 'wall-short',
        surfaceLabel: 'Ściany krótkie (2×)',
        rollWidth: ROLL_WIDTH_NARROW,
        stripCount: 2,
        areaM2: 0,
        wasteM2: 0,
        isManualOverride: false,
        stripLength: 5,
        coverWidth: 1.65,
        foilAssignment: 'main',
      },
    ],
    totalRolls165: 0,
    totalRolls205: 0,
    totalWaste: 0,
    wastePercentage: 0,
    isOptimized: true,
  };
}

describe('mixPlanner.packStripsIntoRolls (minRolls) packing behavior', () => {
  it('should not open an extra 1.65m roll for a short wall when it can fit into a bottom offcut (10x5x1.5)', () => {
    const dimensions = makeDimensions10x5x15();
    const config = makeMainConfigBottomMixedAndWallsPresent();

    const rolls = packStripsIntoRolls(config, dimensions, 'jednokolorowa', 'minRolls');

    const rolls165 = rolls.filter((r) => r.rollWidth === ROLL_WIDTH_NARROW);
    const rolls205 = rolls.filter((r) => r.rollWidth === ROLL_WIDTH_WIDE);

    // Expected outcome for the screenshot scenario:
    // - 1× 2.05m roll (bottom 10m + short wall ~5m)
    // - 2× 1.65m rolls (one packs both 10.2m walls, one packs bottom 10+10 plus short wall ~5)
    expect(rolls205.length).toBe(1);
    expect(rolls165.length).toBe(2);
    expect(rolls.length).toBe(3);

    // Ensure we have at least one 1.65m roll that contains BOTH bottom and wall strips (consuming a bottom offcut)
    const hasBottomOffcutConsumption = rolls165.some((r) => {
      const hasBottom = r.strips.some((s) => s.surface === 'Dno');
      const hasWall = r.strips.some((s) => s.surface === 'Ściany');
      return hasBottom && hasWall;
    });
    expect(hasBottomOffcutConsumption).toBe(true);

    // Guardrail: we should not end up with a dedicated 1.65m roll that only contains a single short wall strip.
    const hasLoneShortWallRoll = rolls165.some((r) => {
      if (r.strips.length !== 1) return false;
      const only = r.strips[0];
      return only.surface === 'Ściany' && only.length <= 6;
    });
    expect(hasLoneShortWallRoll).toBe(false);
  });
});
