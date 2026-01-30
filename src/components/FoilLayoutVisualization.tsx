import { useMemo } from 'react';
import { PoolDimensions } from '@/types/configurator';
import { StairsPlanResult, PaddlingPlanResult } from '@/lib/foil/types';

interface FoilLayoutVisualizationProps {
  dimensions: PoolDimensions;
  rollWidth: number; // 1.65 or 2.05
  label: string;
  stairsPlan?: StairsPlanResult | null;
  paddlingPlan?: PaddlingPlanResult | null;
  showAntiSlipIndicators?: boolean;
}

interface FoilStrip {
  x: number;
  y: number;
  width: number;
  height: number;
  isOverlap: boolean;
}

interface SurfaceLayout {
  name: string;
  realWidth: number;
  realHeight: number;
  strips: FoilStrip[];
  isAntiSlip?: boolean;
  surfaceType: 'pool' | 'stairs' | 'paddling' | 'dividing-wall';
}

const OVERLAP = 0.1; // 10cm overlap
const SCALE = 30; // pixels per meter for visualization

// Color palette
const STRIP_COLORS = {
  regular: [
    'hsl(210 80% 55% / 0.4)',
    'hsl(200 75% 50% / 0.4)',
    'hsl(220 70% 60% / 0.4)',
    'hsl(190 70% 50% / 0.4)',
  ],
  antiSlip: [
    'hsl(30 90% 55% / 0.4)',
    'hsl(35 85% 50% / 0.4)',
    'hsl(25 85% 55% / 0.4)',
    'hsl(40 80% 55% / 0.4)',
  ],
};

export function FoilLayoutVisualization({ 
  dimensions, 
  rollWidth, 
  label,
  stairsPlan,
  paddlingPlan,
  showAntiSlipIndicators = false,
}: FoilLayoutVisualizationProps) {
  const depth = dimensions.depth;
  
  // Strips go ALONG the longer side for fewer joins
  const longerSide = Math.max(dimensions.length, dimensions.width);
  const shorterSide = Math.min(dimensions.length, dimensions.width);

  const layouts = useMemo(() => {
    const result: SurfaceLayout[] = [];

    // Calculate strip layout for a surface
    const calculateStrips = (stripLength: number, coverWidth: number): FoilStrip[] => {
      const strips: FoilStrip[] = [];
      const effectiveWidth = rollWidth - OVERLAP;
      let currentCover = 0;
      let stripIndex = 0;

      while (currentCover < coverWidth) {
        const isFirst = stripIndex === 0;
        const stripCover = isFirst ? rollWidth : effectiveWidth;
        const actualWidth = Math.min(stripCover, coverWidth - currentCover + (isFirst ? 0 : OVERLAP));
        
        strips.push({
          x: currentCover * SCALE - (isFirst ? 0 : OVERLAP * SCALE),
          y: 0,
          width: actualWidth * SCALE,
          height: stripLength * SCALE,
          isOverlap: false,
        });

        // Add overlap indicator if not the first strip
        if (!isFirst) {
          strips.push({
            x: (currentCover - OVERLAP) * SCALE,
            y: 0,
            width: OVERLAP * SCALE,
            height: stripLength * SCALE,
            isOverlap: true,
          });
        }

        currentCover += isFirst ? rollWidth : effectiveWidth;
        stripIndex++;
      }

      return strips;
    };

    // ===== MAIN POOL SURFACES =====
    
    // Bottom - strips along longer side
    result.push({
      name: `Dno basenu (pasy wzdłuż ${longerSide.toFixed(1)}m)`,
      realWidth: shorterSide,
      realHeight: longerSide,
      strips: calculateStrips(longerSide, shorterSide),
      isAntiSlip: false,
      surfaceType: 'pool',
    });

    // Long walls (longerSide x depth) - strips along longer side
    result.push({
      name: `Ściana boczna (pasy wzdłuż ${longerSide.toFixed(1)}m)`,
      realWidth: depth,
      realHeight: longerSide,
      strips: calculateStrips(longerSide, depth),
      isAntiSlip: false,
      surfaceType: 'pool',
    });

    // Short walls (shorterSide x depth) - strips along shorter side
    result.push({
      name: `Ściana czołowa (pasy wzdłuż ${shorterSide.toFixed(1)}m)`,
      realWidth: depth,
      realHeight: shorterSide,
      strips: calculateStrips(shorterSide, depth),
      isAntiSlip: false,
      surfaceType: 'pool',
    });

    // ===== STAIRS SURFACES =====
    if (stairsPlan && dimensions.stairs.enabled) {
      const stairs = dimensions.stairs;
      // Handle 'full' width - use the shorter side dimension
      const stepWidth = typeof stairs.width === 'number' ? stairs.width : shorterSide;
      const stepDepth = stairs.stepDepth;
      const stepHeight = stairs.stepHeight;
      const stepCount = stairs.stepCount;

      // Steps (horizontal) - anti-slip
      // Total step area as single surface
      const totalStepLength = stepDepth * stepCount;
      result.push({
        name: `Schody - stopnie (${stepCount} × ${stepDepth}m × ${stepWidth.toFixed(1)}m)`,
        realWidth: stepWidth,
        realHeight: totalStepLength,
        strips: calculateStrips(totalStepLength, stepWidth),
        isAntiSlip: true,
        surfaceType: 'stairs',
      });

      // Risers (vertical) - regular
      const totalRiserLength = stepHeight * stepCount;
      result.push({
        name: `Schody - podstopnie (${stepCount} × ${stepHeight}m × ${stepWidth.toFixed(1)}m)`,
        realWidth: stepWidth,
        realHeight: totalRiserLength,
        strips: calculateStrips(totalRiserLength, stepWidth),
        isAntiSlip: false,
        surfaceType: 'stairs',
      });
    }

    // ===== PADDLING POOL SURFACES =====
    if (paddlingPlan && dimensions.wadingPool.enabled) {
      const pool = dimensions.wadingPool;
      
      // Bottom - anti-slip
      result.push({
        name: `Brodzik - dno (${pool.width}m × ${pool.length}m)`,
        realWidth: pool.width,
        realHeight: pool.length,
        strips: calculateStrips(pool.length, pool.width),
        isAntiSlip: true,
        surfaceType: 'paddling',
      });

      // Side walls (2x) - regular
      const sideWallArea = pool.length * pool.depth * 2;
      result.push({
        name: `Brodzik - ściany boczne (2 × ${pool.length}m × ${pool.depth}m)`,
        realWidth: pool.depth,
        realHeight: pool.length * 2,
        strips: calculateStrips(pool.length * 2, pool.depth),
        isAntiSlip: false,
        surfaceType: 'paddling',
      });

      // Back wall - regular
      result.push({
        name: `Brodzik - ściana tylna (${pool.width}m × ${pool.depth}m)`,
        realWidth: pool.depth,
        realHeight: pool.width,
        strips: calculateStrips(pool.width, pool.depth),
        isAntiSlip: false,
        surfaceType: 'paddling',
      });

      // ===== DIVIDING WALL =====
      if (paddlingPlan.dividingWall) {
        const dw = paddlingPlan.dividingWall;
        
        // Pool side (taller wall)
        result.push({
          name: `Murek - strona basenu (${dw.wallWidth}m × ${dw.poolSideHeight.toFixed(2)}m)`,
          realWidth: dw.poolSideHeight,
          realHeight: dw.wallWidth,
          strips: calculateStrips(dw.wallWidth, dw.poolSideHeight),
          isAntiSlip: false,
          surfaceType: 'dividing-wall',
        });

        // Paddling side (if has height)
        if (dw.paddlingSideArea > 0) {
          result.push({
            name: `Murek - strona brodzika (${dw.wallWidth}m × ${dw.paddlingSideHeight.toFixed(2)}m)`,
            realWidth: dw.paddlingSideHeight,
            realHeight: dw.wallWidth,
            strips: calculateStrips(dw.wallWidth, dw.paddlingSideHeight),
            isAntiSlip: false,
            surfaceType: 'dividing-wall',
          });
        }

        // Top of wall
        result.push({
          name: `Murek - góra (${dw.wallWidth}m × ${dw.wallThickness}m)`,
          realWidth: dw.wallThickness,
          realHeight: dw.wallWidth,
          strips: calculateStrips(dw.wallWidth, dw.wallThickness),
          isAntiSlip: false,
          surfaceType: 'dividing-wall',
        });
      }
    }

    return result;
  }, [dimensions, rollWidth, depth, longerSide, shorterSide, stairsPlan, paddlingPlan]);

  // Calculate total strips by type
  const stripCounts = useMemo(() => {
    let regular = 0;
    let antiSlip = 0;
    
    layouts.forEach(layout => {
      const count = layout.strips.filter(s => !s.isOverlap).length;
      if (layout.isAntiSlip) {
        antiSlip += count;
      } else {
        regular += count;
      }
    });
    
    return { regular, antiSlip, total: regular + antiSlip };
  }, [layouts]);

  // Group layouts by surface type for organized display
  const groupedLayouts = useMemo(() => {
    const groups: { [key: string]: SurfaceLayout[] } = {
      pool: [],
      stairs: [],
      paddling: [],
      'dividing-wall': [],
    };
    
    layouts.forEach(layout => {
      groups[layout.surfaceType].push(layout);
    });
    
    return groups;
  }, [layouts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{label}</h4>
        <span className="text-xs text-muted-foreground">
          Szerokość rolki: {rollWidth}m | Zakładka: {OVERLAP * 100}cm
        </span>
      </div>

      {/* Legend */}
      {showAntiSlipIndicators && (
        <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30 border border-border text-xs">
          <span className="font-medium">Legenda:</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-500/60" />
            Folia regularna
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-orange-500/60" />
            Folia antypoślizgowa
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-destructive" />
            Zakładka (spaw)
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* Pool surfaces */}
        {groupedLayouts.pool.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Niecka basenu
            </h5>
            {groupedLayouts.pool.map((layout, idx) => (
              <SurfaceCard key={`pool-${idx}`} layout={layout} rollWidth={rollWidth} showAntiSlipIndicators={showAntiSlipIndicators} />
            ))}
          </div>
        )}

        {/* Stairs surfaces */}
        {groupedLayouts.stairs.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              📐 Schody
            </h5>
            {groupedLayouts.stairs.map((layout, idx) => (
              <SurfaceCard key={`stairs-${idx}`} layout={layout} rollWidth={rollWidth} showAntiSlipIndicators={showAntiSlipIndicators} />
            ))}
          </div>
        )}

        {/* Paddling pool surfaces */}
        {groupedLayouts.paddling.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              🌊 Brodzik
            </h5>
            {groupedLayouts.paddling.map((layout, idx) => (
              <SurfaceCard key={`paddling-${idx}`} layout={layout} rollWidth={rollWidth} showAntiSlipIndicators={showAntiSlipIndicators} />
            ))}
          </div>
        )}

        {/* Dividing wall surfaces */}
        {groupedLayouts['dividing-wall'].length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              🧱 Murek rozdzielający
            </h5>
            {groupedLayouts['dividing-wall'].map((layout, idx) => (
              <SurfaceCard key={`wall-${idx}`} layout={layout} rollWidth={rollWidth} showAntiSlipIndicators={showAntiSlipIndicators} />
            ))}
          </div>
        )}
      </div>

      {/* Summary for this roll width */}
      <div className="p-2 rounded bg-accent/10 border border-accent/20 text-sm">
        <div className="flex justify-between">
          <span>Łączna liczba pasów folii:</span>
          <span className="font-medium">{stripCounts.total}</span>
        </div>
        {showAntiSlipIndicators && stripCounts.antiSlip > 0 && (
          <>
            <div className="flex justify-between text-muted-foreground text-xs mt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-blue-500/60" />
                Pasy regularne:
              </span>
              <span>{stripCounts.regular}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-orange-500/60" />
                Pasy antypoślizgowe:
              </span>
              <span>{stripCounts.antiSlip}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-muted-foreground mt-1">
          <span>Liczba spawów (zakładek):</span>
          <span>{stripCounts.total > 0 ? stripCounts.total - layouts.length : 0}</span>
        </div>
      </div>
    </div>
  );
}

// Surface card component
interface SurfaceCardProps {
  layout: SurfaceLayout;
  rollWidth: number;
  showAntiSlipIndicators: boolean;
}

function SurfaceCard({ layout, rollWidth, showAntiSlipIndicators }: SurfaceCardProps) {
  const stripColors = layout.isAntiSlip ? STRIP_COLORS.antiSlip : STRIP_COLORS.regular;
  let stripColorIndex = 0;

  // Calculate SVG dimensions with proper scaling
  const maxWidth = 400;
  const maxHeight = 120;
  const padding = 20;
  
  const rawWidth = layout.realWidth * SCALE;
  const rawHeight = layout.realHeight * SCALE;
  
  const scaleRatio = Math.min(
    (maxWidth - padding * 2) / rawWidth,
    (maxHeight - padding * 2) / rawHeight,
    1
  );
  
  const scaledWidth = rawWidth * scaleRatio;
  const scaledHeight = rawHeight * scaleRatio;

  return (
    <div className={`p-3 rounded-lg border ${layout.isAntiSlip ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' : 'bg-muted/30 border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium flex items-center gap-2">
          {layout.name}
          {showAntiSlipIndicators && layout.isAntiSlip && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
              🟧 antypoślizgowa
            </span>
          )}
          {showAntiSlipIndicators && !layout.isAntiSlip && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
              🟦 regularna
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {layout.realWidth.toFixed(2)}m × {layout.realHeight.toFixed(2)}m = {(layout.realWidth * layout.realHeight).toFixed(2)}m²
        </span>
      </div>
      
      <div className="flex justify-center overflow-x-auto">
        <svg
          width={scaledWidth + padding * 2}
          height={scaledHeight + padding * 2 + 15}
          viewBox={`-${padding} -${padding} ${rawWidth + padding * 2} ${rawHeight + padding * 2 + 15}`}
          className="border border-border/50 rounded bg-background"
        >
          {/* Background grid */}
          <defs>
            <pattern id={`grid-${layout.name}-${rollWidth}`} width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
              <path d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          
          {/* Surface outline */}
          <rect
            x="0"
            y="0"
            width={rawWidth}
            height={rawHeight}
            fill={`url(#grid-${layout.name}-${rollWidth})`}
            stroke={layout.isAntiSlip ? 'hsl(30 90% 50%)' : 'hsl(var(--foreground))'}
            strokeWidth="2"
          />

          {/* Foil strips */}
          {layout.strips.map((strip, stripIndex) => {
            if (strip.isOverlap) {
              return (
                <rect
                  key={stripIndex}
                  x={strip.x}
                  y={strip.y}
                  width={strip.width}
                  height={strip.height}
                  fill="none"
                  stroke="hsl(var(--destructive))"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              );
            } else {
              const color = stripColors[stripColorIndex % stripColors.length];
              stripColorIndex++;
              return (
                <g key={stripIndex}>
                  <rect
                    x={strip.x}
                    y={strip.y}
                    width={strip.width}
                    height={strip.height}
                    fill={color}
                    stroke={layout.isAntiSlip ? 'hsl(30 70% 40% / 0.6)' : 'hsl(var(--foreground) / 0.5)'}
                    strokeWidth="1"
                  />
                  {/* Strip width label */}
                  <text
                    x={strip.x + strip.width / 2}
                    y={strip.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[8px] fill-foreground font-medium"
                  >
                    {(strip.width / SCALE).toFixed(2)}m
                  </text>
                </g>
              );
            }
          })}

          {/* Dimension labels */}
          <text
            x={rawWidth / 2}
            y={rawHeight + 12}
            textAnchor="middle"
            className="text-[10px] fill-muted-foreground"
          >
            {layout.realWidth.toFixed(2)} m
          </text>
          <text
            x={-10}
            y={rawHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, -10, ${rawHeight / 2})`}
            className="text-[10px] fill-muted-foreground"
          >
            {layout.realHeight.toFixed(2)} m
          </text>
        </svg>
      </div>

      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>Pasy folii: {layout.strips.filter(s => !s.isOverlap).length}</span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-destructive"></span>
          Zakładka (spaw)
        </span>
      </div>
    </div>
  );
}
