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

  const layouts = useMemo(() => {
    const result: SurfaceLayout[] = [];

    // Calculate strip layout for a surface
    const calculateStrips = (surfaceWidth: number, surfaceHeight: number): FoilStrip[] => {
      const strips: FoilStrip[] = [];
      const effectiveWidth = rollWidth - OVERLAP;
      let currentX = 0;
      let stripIndex = 0;

      while (currentX < surfaceWidth) {
        const stripWidth = Math.min(rollWidth, surfaceWidth - currentX + (stripIndex > 0 ? OVERLAP : 0));
        const x = stripIndex > 0 ? currentX - OVERLAP : currentX;
        
        strips.push({
          x: x * SCALE,
          y: 0,
          width: stripWidth * SCALE,
          height: surfaceHeight * SCALE,
          isOverlap: false,
        });

        // Add overlap indicator if not the first strip
        if (stripIndex > 0) {
          strips.push({
            x: x * SCALE,
            y: 0,
            width: OVERLAP * SCALE,
            height: surfaceHeight * SCALE,
            isOverlap: true,
          });
        }

        currentX += effectiveWidth;
        stripIndex++;
      }

      return strips;
    };

    // Bottom
    result.push({
      name: 'Dno basenu',
      realWidth: dimensions.length,
      realHeight: dimensions.width,
      strips: calculateStrips(dimensions.length, dimensions.width),
    });

    // Long walls (length x depth) - strips go along the longer side (length)
    result.push({
      name: 'Ściana boczna (długa)',
      realWidth: dimensions.length,
      realHeight: depth,
      strips: calculateStrips(dimensions.length, depth),
    });

    // Short walls (width x depth)
    result.push({
      name: 'Ściana czołowa (krótka)',
      realWidth: dimensions.width,
      realHeight: depth,
      strips: calculateStrips(dimensions.width, depth),
    });

    return result;
  }, [dimensions, rollWidth, depth]);

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
