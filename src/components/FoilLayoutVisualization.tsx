import { useMemo } from 'react';
import { PoolDimensions } from '@/types/configurator';

interface FoilLayoutVisualizationProps {
  dimensions: PoolDimensions;
  rollWidth: number; // 1.65 or 2.05
  label: string;
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
}

const OVERLAP = 0.1; // 10cm overlap
const SCALE = 30; // pixels per meter for visualization

export function FoilLayoutVisualization({ dimensions, rollWidth, label }: FoilLayoutVisualizationProps) {
  const depth = dimensions.depth;
  
  // Strips go ALONG the longer side for fewer joins
  const longerSide = Math.max(dimensions.length, dimensions.width);
  const shorterSide = Math.min(dimensions.length, dimensions.width);

  const layouts = useMemo(() => {
    const result: SurfaceLayout[] = [];

    // Calculate strip layout for a surface
    // stripLength = dimension along which strips run (longer side)
    // coverWidth = dimension to cover with strips (shorter side)
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

    // Bottom - strips along longer side
    result.push({
      name: `Dno basenu (pasy wzdłuż ${longerSide}m)`,
      realWidth: shorterSide,
      realHeight: longerSide,
      strips: calculateStrips(longerSide, shorterSide),
    });

    // Long walls (longerSide x depth) - strips along longer side
    result.push({
      name: `Ściana boczna (pasy wzdłuż ${longerSide}m)`,
      realWidth: depth,
      realHeight: longerSide,
      strips: calculateStrips(longerSide, depth),
    });

    // Short walls (shorterSide x depth) - strips along shorter side
    result.push({
      name: `Ściana czołowa (pasy wzdłuż ${shorterSide}m)`,
      realWidth: depth,
      realHeight: shorterSide,
      strips: calculateStrips(shorterSide, depth),
    });

    return result;
  }, [dimensions, rollWidth, depth, longerSide, shorterSide]);

  // Calculate total strips needed
  const totalStrips = layouts.reduce((sum, layout) => {
    return sum + layout.strips.filter(s => !s.isOverlap).length;
  }, 0);

  // Color palette for strips
  const stripColors = [
    'hsl(var(--primary) / 0.4)',
    'hsl(var(--accent) / 0.4)',
    'hsl(190 70% 50% / 0.4)',
    'hsl(210 70% 50% / 0.4)',
    'hsl(170 70% 50% / 0.4)',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{label}</h4>
        <span className="text-xs text-muted-foreground">
          Szerokość rolki: {rollWidth}m | Zakładka: {OVERLAP * 100}cm
        </span>
      </div>

      <div className="space-y-4">
        {layouts.map((layout, layoutIndex) => {
          const svgWidth = Math.min(layout.realWidth * SCALE + 20, 500);
          const svgHeight = Math.min(layout.realHeight * SCALE + 40, 200);
          const scaleRatio = Math.min(
            (500 - 20) / (layout.realWidth * SCALE),
            (200 - 40) / (layout.realHeight * SCALE),
            1
          );

          let stripColorIndex = 0;

          return (
            <div key={layoutIndex} className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{layout.name}</span>
                <span className="text-xs text-muted-foreground">
                  {layout.realWidth.toFixed(2)}m × {layout.realHeight.toFixed(2)}m = {(layout.realWidth * layout.realHeight).toFixed(2)}m²
                </span>
              </div>
              
              <div className="flex justify-center overflow-x-auto">
                <svg
                  width={svgWidth}
                  height={svgHeight}
                  viewBox={`-10 -10 ${layout.realWidth * SCALE + 20} ${layout.realHeight * SCALE + 30}`}
                  className="border border-border/50 rounded bg-background"
                >
                  {/* Background grid */}
                  <defs>
                    <pattern id={`grid-${layoutIndex}-${rollWidth}`} width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
                      <path d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                  </defs>
                  
                  {/* Pool surface outline */}
                  <rect
                    x="0"
                    y="0"
                    width={layout.realWidth * SCALE}
                    height={layout.realHeight * SCALE}
                    fill={`url(#grid-${layoutIndex}-${rollWidth})`}
                    stroke="hsl(var(--foreground))"
                    strokeWidth="2"
                  />

                  {/* Foil strips */}
                  {layout.strips.map((strip, stripIndex) => {
                    if (strip.isOverlap) {
                      // Overlap area with dashed pattern
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
                            stroke="hsl(var(--foreground) / 0.5)"
                            strokeWidth="1"
                          />
                          {/* Strip label */}
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
                    x={layout.realWidth * SCALE / 2}
                    y={layout.realHeight * SCALE + 15}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground"
                  >
                    {layout.realWidth.toFixed(2)} m
                  </text>
                  <text
                    x={-15}
                    y={layout.realHeight * SCALE / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, -15, ${layout.realHeight * SCALE / 2})`}
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
        })}
      </div>

      {/* Summary for this roll width */}
      <div className="p-2 rounded bg-accent/10 border border-accent/20 text-sm">
        <div className="flex justify-between">
          <span>Łączna liczba pasów folii:</span>
          <span className="font-medium">{totalStrips}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Liczba spawów (zakładek):</span>
          <span>{totalStrips > 0 ? totalStrips - layouts.length : 0}</span>
        </div>
      </div>
    </div>
  );
}
