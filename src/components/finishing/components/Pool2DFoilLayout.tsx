import { useMemo, useState, useCallback } from 'react';
import { PoolDimensions } from '@/types/configurator';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  MixConfiguration, 
  calculateSurfaceDetails,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
} from '@/lib/foil/mixPlanner';
import { FoilSubtype } from '@/lib/finishingMaterials';

interface Pool2DFoilLayoutProps {
  dimensions: PoolDimensions;
  mixConfig: MixConfiguration;
  foilSubtype: FoilSubtype | null;
  height?: number;
}

// Wall thickness constant (24cm)
const POOL_WALL_THICKNESS = 0.24;

// Colors
const FOIL_STRIP_COLORS = {
  main: [
    'hsl(210 80% 60% / 0.35)',
    'hsl(200 75% 55% / 0.35)',
    'hsl(220 70% 65% / 0.35)',
  ],
  structural: 'hsl(30 90% 55% / 0.5)',
  seam: 'hsl(0 0% 30%)',
  structuralBorder: 'hsl(30 90% 45%)',
};

export function Pool2DFoilLayout({ 
  dimensions, 
  mixConfig,
  foilSubtype,
  height = 350,
}: Pool2DFoilLayoutProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const { length, width, depth, stairs, wadingPool } = dimensions;
  
  // Calculate surface details for foil strips
  const surfaceDetails = useMemo(() => 
    calculateSurfaceDetails(mixConfig, dimensions, foilSubtype, 'minWaste'),
    [mixConfig, dimensions, foilSubtype]
  );
  
  const bottomSurface = surfaceDetails.find(s => s.surfaceKey === 'bottom');
  const wallsSurface = surfaceDetails.find(s => s.surfaceKey === 'walls');
  
  // Calculate foil strips on bottom
  const bottomStrips = useMemo(() => {
    if (!bottomSurface) return [];
    
    const strips: { x: number; y: number; w: number; h: number; colorIndex: number }[] = [];
    const longerSide = Math.max(length, width);
    const shorterSide = Math.min(length, width);
    const isLengthLonger = length >= width;
    
    let currentX = -shorterSide / 2;
    let colorIndex = 0;
    
    for (const strip of bottomSurface.strips) {
      const stripWidth = strip.rollWidth;
      const stripLength = longerSide;
      
      for (let i = 0; i < strip.count; i++) {
        if (isLengthLonger) {
          // Strips along length (horizontal in view)
          strips.push({
            x: -length / 2,
            y: currentX,
            w: length,
            h: stripWidth,
            colorIndex: colorIndex % FOIL_STRIP_COLORS.main.length,
          });
        } else {
          // Strips along width (vertical in view)
          strips.push({
            x: currentX,
            y: -width / 2,
            w: stripWidth,
            h: width,
            colorIndex: colorIndex % FOIL_STRIP_COLORS.main.length,
          });
        }
        currentX += stripWidth;
        colorIndex++;
      }
    }
    
    return strips;
  }, [bottomSurface, length, width]);
  
  // Calculate seam lines on bottom (between strips)
  const bottomSeams = useMemo(() => {
    if (bottomStrips.length <= 1) return [];
    
    const seams: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const longerSide = Math.max(length, width);
    const isLengthLonger = length >= width;
    
    for (let i = 1; i < bottomStrips.length; i++) {
      const strip = bottomStrips[i];
      if (isLengthLonger) {
        // Horizontal seam line
        seams.push({
          x1: -length / 2,
          y1: strip.y,
          x2: length / 2,
          y2: strip.y,
        });
      } else {
        // Vertical seam line  
        seams.push({
          x1: strip.x,
          y1: -width / 2,
          x2: strip.x,
          y2: width / 2,
        });
      }
    }
    
    return seams;
  }, [bottomStrips, length, width]);
  
  // Wall seam positions (corners + join points)
  const wallSeams = useMemo(() => {
    if (!wallsSurface) return [];
    
    const seams: { x: number; y: number; label: string }[] = [];
    const halfL = length / 2;
    const halfW = width / 2;
    
    // Corner positions (A, B, C, D clockwise from top-left)
    const corners = [
      { x: -halfL, y: -halfW, label: 'A' },
      { x: halfL, y: -halfW, label: 'B' },
      { x: halfL, y: halfW, label: 'C' },
      { x: -halfL, y: halfW, label: 'D' },
    ];
    
    // Add all corners as potential seam points
    corners.forEach(c => seams.push(c));
    
    // If there are multiple strips, add intermediate join points
    if (wallsSurface.strips.length >= 2) {
      // Calculate join positions based on strip lengths
      let perimeter = 2 * length + 2 * width;
      let currentPos = 0;
      
      for (let i = 0; i < wallsSurface.strips.length - 1; i++) {
        currentPos += wallsSurface.strips[i].stripLength;
        
        // Convert position along perimeter to x,y coordinates
        let pos = currentPos % perimeter;
        let x: number, y: number;
        
        if (pos <= length) {
          // Top edge (A to B)
          x = -halfL + pos;
          y = -halfW;
        } else if (pos <= length + width) {
          // Right edge (B to C)
          x = halfL;
          y = -halfW + (pos - length);
        } else if (pos <= 2 * length + width) {
          // Bottom edge (C to D)
          x = halfL - (pos - length - width);
          y = halfW;
        } else {
          // Left edge (D to A)
          x = -halfL;
          y = halfW - (pos - 2 * length - width);
        }
        
        seams.push({ x, y, label: `J${i + 1}` });
      }
    }
    
    return seams;
  }, [wallsSurface, length, width]);
  
  // Stairs area
  const stairsArea = useMemo(() => {
    if (!stairs?.enabled) return null;
    
    const stairsWidth = typeof stairs.width === 'number' 
      ? stairs.width 
      : (stairs.width === 'full' 
        ? (stairs.direction === 'along-length' ? length : width) 
        : 1.5);
    const stairsDepth = (stairs.stepDepth || 0.30) * (stairs.stepCount || 4);
    
    // Position based on cornerLabel (A, B, C, D)
    const cornerLabel = stairs.cornerLabel || 'A';
    const halfL = length / 2;
    const halfW = width / 2;
    
    let x: number, y: number, w: number, h: number;
    
    if (cornerLabel === 'A') {
      x = -halfL;
      y = -halfW;
      w = stairs.direction === 'along-length' ? stairsDepth : stairsWidth;
      h = stairs.direction === 'along-length' ? stairsWidth : stairsDepth;
    } else if (cornerLabel === 'B') {
      w = stairs.direction === 'along-length' ? stairsDepth : stairsWidth;
      h = stairs.direction === 'along-length' ? stairsWidth : stairsDepth;
      x = halfL - w;
      y = -halfW;
    } else if (cornerLabel === 'C') {
      w = stairs.direction === 'along-length' ? stairsDepth : stairsWidth;
      h = stairs.direction === 'along-length' ? stairsWidth : stairsDepth;
      x = halfL - w;
      y = halfW - h;
    } else { // D
      w = stairs.direction === 'along-length' ? stairsDepth : stairsWidth;
      h = stairs.direction === 'along-length' ? stairsWidth : stairsDepth;
      x = -halfL;
      y = halfW - h;
    }
    
    return { x, y, w, h };
  }, [stairs, length, width]);
  
  // Wading pool area
  const wadingPoolArea = useMemo(() => {
    if (!wadingPool?.enabled) return null;
    
    const wpWidth = wadingPool.width || 2;
    const wpLength = wadingPool.length || 3;
    const cornerLabel = wadingPool.cornerLabel || 'C';
    const halfL = length / 2;
    const halfW = width / 2;
    
    let x: number, y: number;
    
    if (cornerLabel === 'A') {
      x = -halfL;
      y = -halfW;
    } else if (cornerLabel === 'B') {
      x = halfL - wpLength;
      y = -halfW;
    } else if (cornerLabel === 'C') {
      x = halfL - wpLength;
      y = halfW - wpWidth;
    } else { // D
      x = -halfL;
      y = halfW - wpWidth;
    }
    
    return { x, y, w: wpLength, h: wpWidth };
  }, [wadingPool, length, width]);
  
  // Calculate viewBox
  const padding = 1.5;
  const viewWidth = length + POOL_WALL_THICKNESS * 2 + padding * 2;
  const viewHeight = width + POOL_WALL_THICKNESS * 2 + padding * 2;
  
  const baseViewBox = {
    x: -(length / 2 + POOL_WALL_THICKNESS + padding),
    y: -(width / 2 + POOL_WALL_THICKNESS + padding),
    w: viewWidth,
    h: viewHeight,
  };
  
  const scaledViewBox = {
    x: baseViewBox.x + (baseViewBox.w * (1 - 1/zoom)) / 2 - pan.x / 100,
    y: baseViewBox.y + (baseViewBox.h * (1 - 1/zoom)) / 2 - pan.y / 100,
    w: baseViewBox.w / zoom,
    h: baseViewBox.h / zoom,
  };
  
  const zoomPercentage = Math.round(zoom * 100);
  
  // Zoom/pan handlers
  const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev * 1.3, 5)), []);
  const handleZoomOut = useCallback(() => setZoom(prev => Math.max(prev / 1.3, 0.5)), []);
  const handleReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => e.deltaY < 0 ? Math.min(prev * 1.1, 5) : Math.max(prev / 1.1, 0.5));
  }, []);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);
  
  const handleMouseUp = useCallback(() => setIsDragging(false), []);
  const handleMouseLeave = useCallback(() => setIsDragging(false), []);

  return (
    <div 
      className="relative w-full rounded-lg border overflow-hidden"
      style={{ height, cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${scaledViewBox.x} ${scaledViewBox.y} ${scaledViewBox.w} ${scaledViewBox.h}`}
        className="bg-slate-100"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Pool shell (outer wall) */}
        <rect
          x={-(length / 2 + POOL_WALL_THICKNESS)}
          y={-(width / 2 + POOL_WALL_THICKNESS)}
          width={length + POOL_WALL_THICKNESS * 2}
          height={width + POOL_WALL_THICKNESS * 2}
          fill="#e5e7eb"
          stroke="#9ca3af"
          strokeWidth="0.02"
        />
        
        {/* Pool interior (water area) */}
        <rect
          x={-length / 2}
          y={-width / 2}
          width={length}
          height={width}
          fill="#dbeafe"
          stroke="#3b82f6"
          strokeWidth="0.02"
        />
        
        {/* Foil strips on bottom */}
        {bottomStrips.map((strip, i) => (
          <rect
            key={`strip-${i}`}
            x={strip.x}
            y={strip.y}
            width={strip.w}
            height={strip.h}
            fill={FOIL_STRIP_COLORS.main[strip.colorIndex]}
            stroke="none"
          />
        ))}
        
        {/* Seam lines on bottom */}
        {bottomSeams.map((seam, i) => (
          <line
            key={`seam-${i}`}
            x1={seam.x1}
            y1={seam.y1}
            x2={seam.x2}
            y2={seam.y2}
            stroke={FOIL_STRIP_COLORS.seam}
            strokeWidth="0.03"
            strokeDasharray="0.1 0.05"
          />
        ))}
        
        {/* Structural foil on stairs */}
        {stairsArea && (
          <g>
            <rect
              x={stairsArea.x}
              y={stairsArea.y}
              width={stairsArea.w}
              height={stairsArea.h}
              fill={FOIL_STRIP_COLORS.structural}
              stroke={FOIL_STRIP_COLORS.structuralBorder}
              strokeWidth="0.04"
            />
            <text
              x={stairsArea.x + stairsArea.w / 2}
              y={stairsArea.y + stairsArea.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="0.18"
              fill="#92400e"
              fontWeight="bold"
            >
              Schody
            </text>
            <text
              x={stairsArea.x + stairsArea.w / 2}
              y={stairsArea.y + stairsArea.h / 2 + 0.22}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="0.12"
              fill="#b45309"
            >
              (strukturalna)
            </text>
          </g>
        )}
        
        {/* Structural foil on wading pool */}
        {wadingPoolArea && (
          <g>
            <rect
              x={wadingPoolArea.x}
              y={wadingPoolArea.y}
              width={wadingPoolArea.w}
              height={wadingPoolArea.h}
              fill={FOIL_STRIP_COLORS.structural}
              stroke={FOIL_STRIP_COLORS.structuralBorder}
              strokeWidth="0.04"
            />
            <text
              x={wadingPoolArea.x + wadingPoolArea.w / 2}
              y={wadingPoolArea.y + wadingPoolArea.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="0.18"
              fill="#92400e"
              fontWeight="bold"
            >
              Brodzik
            </text>
            <text
              x={wadingPoolArea.x + wadingPoolArea.w / 2}
              y={wadingPoolArea.y + wadingPoolArea.h / 2 + 0.22}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="0.12"
              fill="#b45309"
            >
              (strukturalna)
            </text>
          </g>
        )}
        
        {/* Wall seam indicators (corners and joins) */}
        {wallSeams.map((seam, i) => (
          <g key={`wall-seam-${i}`}>
            <circle
              cx={seam.x}
              cy={seam.y}
              r="0.12"
              fill={i < 4 ? '#6366f1' : '#ef4444'}
              stroke="#fff"
              strokeWidth="0.02"
            />
            <text
              x={seam.x}
              y={seam.y + 0.04}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="0.1"
              fill="#fff"
              fontWeight="bold"
            >
              {seam.label}
            </text>
          </g>
        ))}
        
        {/* Wall perimeter outline (foil edge) */}
        <rect
          x={-length / 2}
          y={-width / 2}
          width={length}
          height={width}
          fill="none"
          stroke="#1e40af"
          strokeWidth="0.05"
          strokeDasharray="0.15 0.08"
        />
        
        {/* Legend */}
        <g transform={`translate(${-length/2 - 0.2}, ${-width/2 - 0.8})`}>
          <rect x="0" y="0" width="0.25" height="0.15" fill={FOIL_STRIP_COLORS.main[0]} />
          <text x="0.32" y="0.12" fontSize="0.12" fill="#374151">Folia główna</text>
          
          <rect x="1.5" y="0" width="0.25" height="0.15" fill={FOIL_STRIP_COLORS.structural} stroke={FOIL_STRIP_COLORS.structuralBorder} strokeWidth="0.02" />
          <text x="1.82" y="0.12" fontSize="0.12" fill="#374151">Folia strukturalna</text>
          
          <line x1="3.3" y1="0.075" x2="3.6" y2="0.075" stroke={FOIL_STRIP_COLORS.seam} strokeWidth="0.03" strokeDasharray="0.05 0.025" />
          <text x="3.67" y="0.12" fontSize="0.12" fill="#374151">Zgrzew/łączenie</text>
        </g>
      </svg>
      
      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex gap-1">
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={handleZoomIn} title="Powiększ">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={handleZoomOut} title="Pomniejsz">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/90 hover:bg-white" onClick={handleReset} title="Reset">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Title */}
      <div className="absolute top-2 left-2 bg-white/90 rounded px-2 py-1 text-xs font-medium">
        Rozkład folii (widok z góry) • {zoomPercentage}%
      </div>
    </div>
  );
}
