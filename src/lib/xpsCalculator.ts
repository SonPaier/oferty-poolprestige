/**
 * XPS Panel Calculator
 * 
 * Calculates the number of XPS boards needed for staggered ("na mijankę") layout
 * with offcut reuse between rows.
 * 
 * Board dimensions: 1.25m x 0.60m (0.75 m² each)
 * Packages: 5cm = 6m² (8 boards), 10cm = 3m² (4 boards)
 */

const BOARD_LENGTH = 1.25; // m
const BOARD_WIDTH = 0.60;  // m
const STAGGER_OFFSET = BOARD_LENGTH / 2; // 0.625m offset for odd rows

const BOARDS_PER_PACKAGE_5CM = 8;  // 6m² / 0.75m²
const BOARDS_PER_PACKAGE_10CM = 4; // 3m² / 0.75m²

export interface XpsPanelResult {
  panels: number;       // total boards needed
  packages: number;     // packages (rounded up)
  areaCovered: number;  // actual area covered in m²
}

/**
 * Calculate XPS boards for a rectangular area with staggered layout.
 * Boards are laid lengthwise along areaLength, rows progress along areaWidth.
 * Odd rows are offset by half a board length; offcuts from one row can be
 * reused at the start of the next if large enough.
 */
export function calculateXpsPanels(
  areaLength: number,
  areaWidth: number,
  thickness: '5cm' | '10cm'
): XpsPanelResult {
  if (areaLength <= 0 || areaWidth <= 0) {
    return { panels: 0, packages: 0, areaCovered: 0 };
  }

  const rows = Math.ceil(areaWidth / BOARD_WIDTH);
  let totalPanels = 0;
  let prevOffcut = 0; // leftover from previous row that might be reusable

  for (let i = 0; i < rows; i++) {
    const isOddRow = i % 2 === 1;
    const effectiveLength = isOddRow ? areaLength + STAGGER_OFFSET : areaLength;

    // Check if we can reuse the offcut from the previous row at the start
    let remainingLength = effectiveLength;
    if (prevOffcut > 0) {
      // In a staggered row, we need a piece of STAGGER_OFFSET at the start
      // In an even row after an odd one, we might reuse the offcut too
      const neededPiece = isOddRow ? STAGGER_OFFSET : 0;
      if (neededPiece > 0 && prevOffcut >= neededPiece) {
        // Reuse offcut for the stagger piece - no extra board needed for it
        remainingLength = areaLength; // only need to cover the actual length after the offset piece
        prevOffcut = 0;
      } else {
        prevOffcut = 0; // can't reuse, discard
      }
    }

    const boardsInRow = Math.ceil(remainingLength / BOARD_LENGTH);
    totalPanels += boardsInRow;

    // Calculate offcut from this row
    const coveredLength = boardsInRow * BOARD_LENGTH;
    const offcut = coveredLength - remainingLength;
    prevOffcut = offcut;
  }

  const boardsPerPackage = thickness === '5cm' ? BOARDS_PER_PACKAGE_5CM : BOARDS_PER_PACKAGE_10CM;
  const packages = Math.ceil(totalPanels / boardsPerPackage);

  return {
    panels: totalPanels,
    packages,
    areaCovered: totalPanels * BOARD_LENGTH * BOARD_WIDTH,
  };
}

/**
 * Calculate XPS for pool floor insulation.
 * Floor slab dimensions: (length + 0.88) x (width + 0.88)
 */
export function calculateFloorXps(
  poolLength: number,
  poolWidth: number,
  thickness: '5cm' | '10cm'
): XpsPanelResult {
  const slabLength = poolLength + 0.88;
  const slabWidth = poolWidth + 0.88;
  return calculateXpsPanels(slabLength, slabWidth, thickness);
}

/**
 * Calculate XPS for pool wall insulation.
 * External perimeter: 2 * ((length + 0.48) + (width + 0.48))
 * "Unrolled" as a rectangle: perimeter x depth
 */
export function calculateWallXps(
  poolLength: number,
  poolWidth: number,
  poolDepth: number,
  thickness: '5cm' | '10cm'
): XpsPanelResult {
  const perimeter = 2 * ((poolLength + 0.48) + (poolWidth + 0.48));
  return calculateXpsPanels(perimeter, poolDepth, thickness);
}

/**
 * Calculate PUR foam area for walls (sprayed, no packages - just m²).
 */
export function calculateWallPurArea(
  poolLength: number,
  poolWidth: number,
  poolDepth: number
): number {
  const perimeter = 2 * ((poolLength + 0.48) + (poolWidth + 0.48));
  return perimeter * poolDepth;
}
