import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, Line, Polygon, Text, FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, RotateCcw, Check, MousePointer, Plus, Grid3X3, Footprints, Baby, Waves, RotateCw, Calculator, Triangle } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCornerLabel, stairsAngleLabels, StairsConfig } from '@/types/configurator';

// Store custom data on fabric objects using a WeakMap
const objectDataMap = new WeakMap<FabricObject, { type: string; index?: number; layer?: DrawingMode }>();

interface Point {
  x: number;
  y: number;
}

export type DrawingMode = 'pool' | 'stairs' | 'wadingPool';

interface CustomPoolDrawerProps {
  onComplete: (
    poolVertices: Point[], 
    area: number, 
    perimeter: number,
    stairsVertices?: Point[],
    wadingPoolVertices?: Point[],
    stairsRotation?: number,
    stairsConfig?: Partial<StairsConfig>
  ) => void;
  onCancel: () => void;
  initialPoolVertices?: Point[];
  initialStairsVertices?: Point[];
  initialWadingPoolVertices?: Point[];
  initialStairsRotation?: number;
  initialLength?: number;
  initialWidth?: number;
  shape?: 'prostokatny' | 'nieregularny';
  initialStairsConfig?: Partial<StairsConfig>;
}

const GRID_SIZE = 30; // pixels per meter (smaller to fit 25m)
const GRID_OFFSET = GRID_SIZE; // 1m offset for -1 start

// Default grid dimensions in meters
const DEFAULT_GRID_WIDTH = 25;
const DEFAULT_GRID_HEIGHT = 25;

// Colors for different drawing modes
const MODE_COLORS = {
  pool: { fill: 'hsl(190 80% 42% / 0.2)', stroke: 'hsl(190 80% 42%)', vertex: 'hsl(190 80% 42%)' },
  stairs: { fill: 'hsl(30 80% 50% / 0.3)', stroke: 'hsl(30 80% 50%)', vertex: 'hsl(30 80% 50%)' },
  wadingPool: { fill: 'hsl(280 60% 50% / 0.3)', stroke: 'hsl(280 60% 50%)', vertex: 'hsl(280 60% 50%)' },
};

const MODE_LABELS: Record<DrawingMode, string> = {
  pool: 'Basen',
  stairs: 'Schody',
  wadingPool: 'Brodzik',
};

// 8 rotation angles for stairs (45° increments)
const STAIRS_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function CustomPoolDrawer({ 
  onComplete, 
  onCancel, 
  initialPoolVertices,
  initialStairsVertices,
  initialWadingPoolVertices,
  initialStairsRotation,
  initialLength,
  initialWidth,
  shape = 'nieregularny',
  initialStairsConfig
}: CustomPoolDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  
  // Grid dimensions state (in meters)
  const [gridWidth, setGridWidth] = useState<number>(DEFAULT_GRID_WIDTH);
  const [gridHeight, setGridHeight] = useState<number>(DEFAULT_GRID_HEIGHT);
  
  // Calculate canvas dimensions based on grid size
  const canvasWidth = (gridWidth + 2) * GRID_SIZE; // +2 for -1m offset on each side
  const canvasHeight = (gridHeight + 2) * GRID_SIZE;
  
  // Stairs parameters state
  const [stairsWidth, setStairsWidth] = useState<number>(initialStairsConfig?.width as number || 1.5);
  const [stairsStepCount, setStairsStepCount] = useState<number>(initialStairsConfig?.stepCount || 4);
  const [stairsStepDepth, setStairsStepDepth] = useState<number>(initialStairsConfig?.stepDepth || 0.30);
  const [stairsType, setStairsType] = useState<'rectangular' | 'diagonal'>(
    initialStairsConfig?.placement === 'diagonal' ? 'diagonal' : 'rectangular'
  );
  
  // Generate initial vertices from length/width if provided and no custom vertices
  const generateInitialRectangle = useCallback((): Point[] => {
    if (initialPoolVertices && initialPoolVertices.length >= 3) {
      return initialPoolVertices;
    }
    if (initialLength && initialWidth && shape === 'prostokatny') {
      // Generate rectangle at origin (0,0 to length, width)
      return [
        { x: 0, y: 0 },
        { x: initialLength, y: 0 },
        { x: initialLength, y: initialWidth },
        { x: 0, y: initialWidth }
      ];
    }
    return [];
  }, [initialPoolVertices, initialLength, initialWidth, shape]);
  
  // Separate vertices for each layer
  const [poolVertices, setPoolVertices] = useState<Point[]>(() => generateInitialRectangle());
  const [stairsVertices, setStairsVertices] = useState<Point[]>(initialStairsVertices || []);
  const [wadingPoolVertices, setWadingPoolVertices] = useState<Point[]>(initialWadingPoolVertices || []);
  
  // Stairs rotation (0, 45, 90, 135, 180, 225, 270, 315 degrees) - indicates entry direction
  const [stairsRotation, setStairsRotation] = useState<number>(initialStairsRotation || 0);
  
  const [currentMode, setCurrentMode] = useState<DrawingMode>('pool');
  const [isDrawing, setIsDrawing] = useState(() => generateInitialRectangle().length < 3);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Get current vertices based on mode
  const getCurrentVertices = useCallback(() => {
    switch (currentMode) {
      case 'pool': return poolVertices;
      case 'stairs': return stairsVertices;
      case 'wadingPool': return wadingPoolVertices;
    }
  }, [currentMode, poolVertices, stairsVertices, wadingPoolVertices]);

  // Set current vertices based on mode
  const setCurrentVertices = useCallback((vertices: Point[]) => {
    switch (currentMode) {
      case 'pool': setPoolVertices(vertices); break;
      case 'stairs': setStairsVertices(vertices); break;
      case 'wadingPool': setWadingPoolVertices(vertices); break;
    }
  }, [currentMode]);

  // Generate stairs shape from parameters (width, stepCount, stepDepth)
  // Creates a rectangle or triangle anchored at the first vertex of existing stairs or at pool corner
  const generateStairsFromParams = useCallback((
    width: number, 
    stepCount: number, 
    stepDepth: number,
    type: 'rectangular' | 'diagonal',
    baseVertices?: Point[]
  ): Point[] => {
    const stairsLength = stepCount * stepDepth;
    
    // For diagonal (45°) stairs, create a right triangle
    // The legs are equal: size = stepCount * stepDepth
    if (type === 'diagonal') {
      const diagonalSize = stairsLength;
      
      // If we have existing vertices, use the FIRST vertex as anchor (pool corner)
      if (baseVertices && baseVertices.length >= 3) {
        // First vertex is the corner anchor point
        const anchor = baseVertices[0];
        
        // Determine the direction based on existing shape
        // The second and third vertices tell us which quadrant we're in
        const dx1 = baseVertices[1].x - anchor.x;
        const dy1 = baseVertices[1].y - anchor.y;
        const dx2 = baseVertices[2].x - anchor.x;
        const dy2 = baseVertices[2].y - anchor.y;
        
        // Determine x and y direction from anchor
        const xDir = Math.abs(dx1) > Math.abs(dx2) ? Math.sign(dx1) || 1 : Math.sign(dx2) || 1;
        const yDir = Math.abs(dy1) > Math.abs(dy2) ? Math.sign(dy1) || 1 : Math.sign(dy2) || 1;
        
        return [
          { x: anchor.x, y: anchor.y },
          { x: anchor.x + xDir * diagonalSize, y: anchor.y },
          { x: anchor.x, y: anchor.y + yDir * diagonalSize }
        ];
      }
      
      // Default: place at corner A of pool
      if (poolVertices.length >= 3) {
        const corner = poolVertices[0];
        return [
          { x: corner.x, y: corner.y },
          { x: corner.x + diagonalSize, y: corner.y },
          { x: corner.x, y: corner.y + diagonalSize }
        ];
      }
      
      return [];
    }
    
    // Rectangular stairs
    // If we have existing vertices, use the FIRST vertex as anchor
    if (baseVertices && baseVertices.length >= 4) {
      // First vertex is the anchor corner
      const anchor = baseVertices[0];
      
      // Determine directions based on existing vertices
      const dx = baseVertices[1].x - anchor.x;
      const dy = baseVertices[3].y - anchor.y;
      const xDir = Math.sign(dx) || 1;
      const yDir = Math.sign(dy) || 1;
      
      return [
        { x: anchor.x, y: anchor.y },
        { x: anchor.x + xDir * width, y: anchor.y },
        { x: anchor.x + xDir * width, y: anchor.y + yDir * stairsLength },
        { x: anchor.x, y: anchor.y + yDir * stairsLength }
      ];
    }
    
    // Default: place at corner A (0,0) of pool
    if (poolVertices.length >= 3) {
      const corner = poolVertices[0];
      return [
        { x: corner.x, y: corner.y },
        { x: corner.x + width, y: corner.y },
        { x: corner.x + width, y: corner.y + stairsLength },
        { x: corner.x, y: corner.y + stairsLength }
      ];
    }
    
    return [];
  }, [poolVertices]);

  // Update stairs shape when parameters change
  const handleStairsParamsChange = useCallback((
    newWidth?: number,
    newStepCount?: number,
    newStepDepth?: number,
    newType?: 'rectangular' | 'diagonal'
  ) => {
    const w = newWidth ?? stairsWidth;
    const count = newStepCount ?? stairsStepCount;
    const depth = newStepDepth ?? stairsStepDepth;
    const type = newType ?? stairsType;
    
    if (newWidth !== undefined) setStairsWidth(w);
    if (newStepCount !== undefined) setStairsStepCount(count);
    if (newStepDepth !== undefined) setStairsStepDepth(depth);
    if (newType !== undefined) setStairsType(type);
    
    // Regenerate stairs shape if we already have stairs drawn
    if (stairsVertices.length >= 3) {
      const newVerts = generateStairsFromParams(w, count, depth, type, stairsVertices);
      setStairsVertices(newVerts);
    }
  }, [stairsWidth, stairsStepCount, stairsStepDepth, stairsType, stairsVertices, generateStairsFromParams]);

  // Calculate total stairs depth (how far they extend into the pool)
  const calculateTotalStairsDepth = useCallback(() => {
    return stairsStepCount * stairsStepDepth;
  }, [stairsStepCount, stairsStepDepth]);

  // Calculate polygon area using Shoelace formula
  const calculateArea = useCallback((points: Point[]): number => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  }, []);

  // Calculate perimeter
  const calculatePerimeter = useCallback((points: Point[]): number => {
    if (points.length < 2) return 0;
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }, []);

  // Convert canvas coordinates to meters (accounting for -1m offset)
  const canvasToMeters = useCallback((canvasPoint: { x: number; y: number }): Point => {
    return {
      x: (canvasPoint.x - GRID_OFFSET) / GRID_SIZE,
      y: (canvasPoint.y - GRID_OFFSET) / GRID_SIZE,
    };
  }, []);

  // Convert meters to canvas coordinates (accounting for -1m offset)
  const metersToCanvas = useCallback((point: Point): { x: number; y: number } => {
    return {
      x: point.x * GRID_SIZE + GRID_OFFSET,
      y: point.y * GRID_SIZE + GRID_OFFSET,
    };
  }, []);

  // Snap to grid (snap to 0.5m increments)
  const snapToGrid = useCallback((value: number): number => {
    // Snap relative to grid offset
    const relativeValue = value - GRID_OFFSET;
    const snapped = Math.round(relativeValue / (GRID_SIZE / 2)) * (GRID_SIZE / 2);
    return snapped + GRID_OFFSET;
  }, []);

  // Draw grid from -1m to gridWidth/gridHeight
  const drawGrid = useCallback((canvas: FabricCanvas) => {
    // Draw from -1 to gridWidth meters (vertical lines)
    for (let m = -1; m <= gridWidth; m++) {
      const x = m * GRID_SIZE + GRID_OFFSET;
      
      // Vertical lines
      const isMainLine = m % 5 === 0;
      const isOrigin = m === 0;
      const line = new Line([x, 0, x, canvasHeight], {
        stroke: isOrigin ? 'hsl(190 50% 50%)' : isMainLine ? 'hsl(190 20% 70%)' : 'hsl(190 10% 85%)',
        strokeWidth: isOrigin ? 2 : isMainLine ? 1 : 0.5,
        selectable: false,
        evented: false,
      });
      objectDataMap.set(line, { type: 'grid' });
      canvas.add(line);
      
      // Add meter labels for every 5m and at 0
      if (m % 5 === 0 || m === 0) {
        const text = new Text(`${m}`, {
          left: x - 6,
          top: 3,
          fontSize: 9,
          fill: isOrigin ? 'hsl(190 50% 40%)' : 'hsl(190 20% 50%)',
          fontWeight: isOrigin ? 'bold' : 'normal',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(text, { type: 'grid' });
        canvas.add(text);
      }
    }
    
    // Horizontal lines from -1 to gridHeight
    for (let m = -1; m <= gridHeight; m++) {
      const y = m * GRID_SIZE + GRID_OFFSET;
      
      const isMainLine = m % 5 === 0;
      const isOrigin = m === 0;
      const line = new Line([0, y, canvasWidth, y], {
        stroke: isOrigin ? 'hsl(190 50% 50%)' : isMainLine ? 'hsl(190 20% 70%)' : 'hsl(190 10% 85%)',
        strokeWidth: isOrigin ? 2 : isMainLine ? 1 : 0.5,
        selectable: false,
        evented: false,
      });
      objectDataMap.set(line, { type: 'grid' });
      canvas.add(line);
      
      // Add meter labels for every 5m and at 0
      if ((m % 5 === 0 || m === 0) && m !== 0) {
        const text = new Text(`${m}`, {
          left: 3,
          top: y - 5,
          fontSize: 9,
          fill: 'hsl(190 20% 50%)',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(text, { type: 'grid' });
        canvas.add(text);
      }
    }
  }, [gridWidth, gridHeight, canvasWidth, canvasHeight]);

  // Draw a single polygon layer with corner labels
  const drawPolygonLayer = useCallback((
    canvas: FabricCanvas, 
    points: Point[], 
    mode: DrawingMode,
    isActiveLayer: boolean
  ) => {
    const colors = MODE_COLORS[mode];
    
    if (points.length < 2) {
      // Just draw vertices with labels
      points.forEach((point, index) => {
        const canvasPoint = metersToCanvas(point);
        const vertex = new Circle({
          left: canvasPoint.x - 8,
          top: canvasPoint.y - 8,
          radius: 8,
          fill: colors.vertex,
          stroke: 'white',
          strokeWidth: 2,
          selectable: isActiveLayer,
          evented: isActiveLayer,
          opacity: isActiveLayer ? 1 : 0.6,
        });
        objectDataMap.set(vertex, { type: 'vertex', index, layer: mode });
        canvas.add(vertex);
        
        // Add corner label for pool (A, B, C, D...)
        if (mode === 'pool') {
          const label = new Text(getCornerLabel(index), {
            left: canvasPoint.x + 10,
            top: canvasPoint.y - 15,
            fontSize: 14,
            fill: colors.stroke,
            fontWeight: 'bold',
            selectable: false,
            evented: false,
          });
          objectDataMap.set(label, { type: 'corner-label', layer: mode });
          canvas.add(label);
        }
      });
      return;
    }

    // Draw polygon
    const canvasPoints = points.map(p => metersToCanvas(p));
    const polygon = new Polygon(canvasPoints, {
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 2,
      selectable: false,
      evented: false,
      opacity: isActiveLayer ? 1 : 0.5,
    });
    objectDataMap.set(polygon, { type: 'polygon', layer: mode });
    canvas.add(polygon);

    // Draw vertices, corner labels, and edge lengths
    points.forEach((point, index) => {
      const canvasPoint = metersToCanvas(point);
      const vertex = new Circle({
        left: canvasPoint.x - 8,
        top: canvasPoint.y - 8,
        radius: 8,
        fill: colors.vertex,
        stroke: 'white',
        strokeWidth: 2,
        selectable: isActiveLayer,
        evented: isActiveLayer,
        opacity: isActiveLayer ? 1 : 0.6,
      });
      objectDataMap.set(vertex, { type: 'vertex', index, layer: mode });
      canvas.add(vertex);

      // Add corner label for pool (A, B, C, D...)
      if (mode === 'pool') {
        const label = new Text(getCornerLabel(index), {
          left: canvasPoint.x + 10,
          top: canvasPoint.y - 15,
          fontSize: 14,
          fill: colors.stroke,
          fontWeight: 'bold',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(label, { type: 'corner-label', layer: mode });
        canvas.add(label);
      }

      // Draw edge length label with wall name only for active layer
      if (isActiveLayer && points.length >= 2) {
        const nextIndex = (index + 1) % points.length;
        const nextPoint = points[nextIndex];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const midX = (canvasPoint.x + metersToCanvas(nextPoint).x) / 2;
        const midY = (canvasPoint.y + metersToCanvas(nextPoint).y) / 2;
        
        // For pool, show wall label (A-B, B-C, etc.)
        const wallLabel = mode === 'pool' 
          ? `${getCornerLabel(index)}-${getCornerLabel(nextIndex)}: ${length.toFixed(1)}m`
          : `${length.toFixed(1)}m`;
        
        const label = new Text(wallLabel, {
          left: midX - (mode === 'pool' ? 25 : 15),
          top: midY - 8,
          fontSize: 11,
          fill: colors.stroke,
          fontWeight: 'bold',
          backgroundColor: 'white',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(label, { type: 'edge-label', layer: mode });
        canvas.add(label);
      }
    });
  }, [metersToCanvas]);

  // Draw direction arrow for stairs with 8 directions
  const drawStairsArrow = useCallback((canvas: FabricCanvas, points: Point[], rotation: number) => {
    if (points.length < 3) return;
    
    // Calculate centroid
    const canvasPoints = points.map(p => metersToCanvas(p));
    const cx = canvasPoints.reduce((sum, p) => sum + p.x, 0) / canvasPoints.length;
    const cy = canvasPoints.reduce((sum, p) => sum + p.y, 0) / canvasPoints.length;
    
    // Arrow length
    const arrowLen = 40;
    const arrowHead = 12;
    
    // Calculate arrow direction based on rotation (8 directions)
    const radians = (rotation * Math.PI) / 180;
    const dx = Math.sin(radians);
    const dy = Math.cos(radians);
    
    const endX = cx + dx * arrowLen;
    const endY = cy + dy * arrowLen;
    
    // Arrow shaft
    const shaft = new Line([cx, cy, endX, endY], {
      stroke: MODE_COLORS.stairs.stroke,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    });
    objectDataMap.set(shaft, { type: 'arrow', layer: 'stairs' });
    canvas.add(shaft);
    
    // Arrow head (two lines)
    const headAngle1 = Math.atan2(dy, dx) + Math.PI * 0.75;
    const headAngle2 = Math.atan2(dy, dx) - Math.PI * 0.75;
    
    const head1 = new Line([
      endX, endY,
      endX + Math.cos(headAngle1) * arrowHead,
      endY + Math.sin(headAngle1) * arrowHead
    ], {
      stroke: MODE_COLORS.stairs.stroke,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    });
    objectDataMap.set(head1, { type: 'arrow', layer: 'stairs' });
    canvas.add(head1);
    
    const head2 = new Line([
      endX, endY,
      endX + Math.cos(headAngle2) * arrowHead,
      endY + Math.sin(headAngle2) * arrowHead
    ], {
      stroke: MODE_COLORS.stairs.stroke,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    });
    objectDataMap.set(head2, { type: 'arrow', layer: 'stairs' });
    canvas.add(head2);
  }, [metersToCanvas]);

  // Redraw all shapes
  const redrawAllShapes = useCallback((canvas: FabricCanvas) => {
    // Remove existing polygons, vertices, and arrows (keep grid)
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const data = objectDataMap.get(obj);
      if (data?.type === 'polygon' || data?.type === 'vertex' || data?.type === 'edge-label' || data?.type === 'arrow' || data?.type === 'corner-label') {
        canvas.remove(obj);
      }
    });

    // Draw layers in order: pool first (background), then stairs, then wading pool
    // Draw pool layer
    if (poolVertices.length > 0) {
      drawPolygonLayer(canvas, poolVertices, 'pool', currentMode === 'pool');
    }
    
    // Draw stairs layer
    if (stairsVertices.length > 0) {
      drawPolygonLayer(canvas, stairsVertices, 'stairs', currentMode === 'stairs');
      // Draw direction arrow for stairs
      if (stairsVertices.length >= 3) {
        drawStairsArrow(canvas, stairsVertices, stairsRotation);
      }
    }
    
    // Draw wading pool layer
    if (wadingPoolVertices.length > 0) {
      drawPolygonLayer(canvas, wadingPoolVertices, 'wadingPool', currentMode === 'wadingPool');
    }

    canvas.renderAll();
  }, [poolVertices, stairsVertices, wadingPoolVertices, currentMode, drawPolygonLayer, stairsRotation, drawStairsArrow]);

  // Initialize canvas and reinitialize when grid size changes
  useEffect(() => {
    if (!canvasRef.current) return;

    // Dispose previous canvas if exists
    if (fabricRef.current) {
      fabricRef.current.dispose();
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 'white',
      selection: false,
    });

    fabricRef.current = canvas;
    drawGrid(canvas);
    
    // Draw initial shapes
    redrawAllShapes(canvas);

    return () => {
      canvas.dispose();
    };
  }, [canvasWidth, canvasHeight, drawGrid, redrawAllShapes]);

  // Redraw when vertices or mode changes (but NOT during dragging)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas && !isDragging) {
      redrawAllShapes(canvas);
    }
  }, [poolVertices, stairsVertices, wadingPoolVertices, currentMode, redrawAllShapes, isDragging]);

  // Update vertex selection highlight without full redraw
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    canvas.getObjects().forEach(obj => {
      const data = objectDataMap.get(obj);
      if (data?.type === 'vertex' && data.layer === currentMode) {
        const isSelected = data.index === selectedVertexIndex;
        const colors = MODE_COLORS[currentMode];
        (obj as Circle).set({
          fill: isSelected ? 'hsl(0 80% 50%)' : colors.vertex
        });
      }
    });
    canvas.renderAll();
  }, [selectedVertexIndex, currentMode]);

  // Handle mode change
  const handleModeChange = (mode: DrawingMode) => {
    // Check if pool is drawn before allowing stairs/wading pool
    if ((mode === 'stairs' || mode === 'wadingPool') && poolVertices.length < 3) {
      toast.error('Najpierw narysuj kształt basenu');
      return;
    }
    
    setCurrentMode(mode);
    setSelectedVertexIndex(null);
    
    const currentVerts = mode === 'pool' ? poolVertices : mode === 'stairs' ? stairsVertices : wadingPoolVertices;
    setIsDrawing(currentVerts.length < 3);
  };

  // Handle canvas click to add vertices
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: any) => {
      if (!isDrawing) return;
      
      const pointer = canvas.getViewportPoint(e.e);
      const snappedX = snapToGrid(pointer.x);
      const snappedY = snapToGrid(pointer.y);
      
      const newPoint = canvasToMeters({ x: snappedX, y: snappedY });
      const currentVerts = getCurrentVertices();
      
      // Check if clicking near the first vertex to close the shape
      if (currentVerts.length >= 3) {
        const firstCanvasPoint = metersToCanvas(currentVerts[0]);
        const dist = Math.sqrt(
          Math.pow(snappedX - firstCanvasPoint.x, 2) + 
          Math.pow(snappedY - firstCanvasPoint.y, 2)
        );
        if (dist < 20) {
          setIsDrawing(false);
          toast.success(`${MODE_LABELS[currentMode]} zamknięty! Możesz teraz edytować wierzchołki.`);
          return;
        }
      }
      
      const newVertices = [...currentVerts, newPoint];
      setCurrentVertices(newVertices);
    };

    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [isDrawing, currentMode, getCurrentVertices, setCurrentVertices, canvasToMeters, metersToCanvas, snapToGrid]);

  // Handle vertex selection and dragging
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || isDrawing) return;

    // Track the vertex being dragged and its new position
    let draggedVertexData: { index: number; layer: DrawingMode } | null = null;
    let draggedNewPoint: Point | null = null;

    const handleMouseDown = () => {
      setIsDragging(true);
    };

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      const data = objectDataMap.get(obj);
      if (data?.type === 'vertex' && data.layer === currentMode) {
        const index = data.index!;
        const snappedX = snapToGrid(obj.left + 8);
        const snappedY = snapToGrid(obj.top + 8);
        
        // Update visual position only
        obj.set({
          left: snappedX - 8,
          top: snappedY - 8,
        });
        
        // Store the new position for when drag ends
        draggedVertexData = { index, layer: currentMode };
        draggedNewPoint = canvasToMeters({ x: snappedX, y: snappedY });
      }
    };

    const handleObjectModified = () => {
      // Update state only after dragging is complete
      if (draggedVertexData && draggedNewPoint) {
        const { index, layer } = draggedVertexData;
        const newPoint = draggedNewPoint;
        
        // Update the correct vertex array based on layer
        if (layer === 'pool') {
          setPoolVertices(prev => {
            const newVertices = [...prev];
            newVertices[index] = newPoint;
            return newVertices;
          });
        } else if (layer === 'stairs') {
          setStairsVertices(prev => {
            const newVertices = [...prev];
            newVertices[index] = newPoint;
            return newVertices;
          });
        } else if (layer === 'wadingPool') {
          setWadingPoolVertices(prev => {
            const newVertices = [...prev];
            newVertices[index] = newPoint;
            return newVertices;
          });
        }
        
        draggedVertexData = null;
        draggedNewPoint = null;
      }
      setIsDragging(false);
    };

    const handleSelection = (e: any) => {
      const obj = e.selected?.[0];
      const data = obj ? objectDataMap.get(obj) : null;
      if (data?.type === 'vertex' && data.layer === currentMode) {
        setSelectedVertexIndex(data.index!);
      }
    };

    const handleSelectionCleared = () => {
      setSelectedVertexIndex(null);
      setIsDragging(false);
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [isDrawing, currentMode, canvasToMeters, snapToGrid]);

  const handleReset = () => {
    setCurrentVertices([]);
    setIsDrawing(true);
    setSelectedVertexIndex(null);
    toast.info(`Zacznij rysować ${MODE_LABELS[currentMode]} od nowa`);
  };

  const handleResetAll = () => {
    setPoolVertices([]);
    setStairsVertices([]);
    setWadingPoolVertices([]);
    setCurrentMode('pool');
    setIsDrawing(true);
    setSelectedVertexIndex(null);
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.clear();
      drawGrid(canvas);
    }
    toast.info('Wszystko zresetowane');
  };

  const handleDeleteVertex = () => {
    if (selectedVertexIndex === null) return;
    const currentVerts = getCurrentVertices();
    const newVertices = currentVerts.filter((_, i) => i !== selectedVertexIndex);
    setCurrentVertices(newVertices);
    setSelectedVertexIndex(null);
    if (newVertices.length < 3) {
      setIsDrawing(true);
    }
  };

  const handleComplete = () => {
    if (poolVertices.length < 3) {
      toast.error('Potrzebujesz minimum 3 punktów, aby utworzyć kształt basenu');
      return;
    }
    const area = calculateArea(poolVertices);
    const perimeter = calculatePerimeter(poolVertices);
    
    // Create stairs config from current parameters
    const stairsConfig: Partial<StairsConfig> = {
      width: stairsWidth,
      stepCount: stairsStepCount,
      stepDepth: stairsStepDepth,
      angle: stairsRotation,
      placement: stairsType === 'diagonal' ? 'diagonal' : 'corner',
    };
    
    onComplete(
      poolVertices, 
      area, 
      perimeter,
      stairsVertices.length >= 3 ? stairsVertices : undefined,
      wadingPoolVertices.length >= 3 ? wadingPoolVertices : undefined,
      stairsVertices.length >= 3 ? stairsRotation : undefined,
      stairsVertices.length >= 3 ? stairsConfig : undefined
    );
  };

  const handleRotateStairs = () => {
    // Cycle through 8 directions (45° increments)
    const currentIndex = STAIRS_ANGLES.indexOf(stairsRotation);
    const nextIndex = (currentIndex + 1) % STAIRS_ANGLES.length;
    setStairsRotation(STAIRS_ANGLES[nextIndex]);
  };

  const getRotationLabel = (rotation: number): string => {
    return stairsAngleLabels[rotation] || `${rotation}°`;
  };

  const updateVertexCoordinate = (index: number, axis: 'x' | 'y', value: number) => {
    const currentVerts = getCurrentVertices();
    const newVertices = [...currentVerts];
    newVertices[index] = { ...newVertices[index], [axis]: value };
    setCurrentVertices(newVertices);
  };

  const currentVerts = getCurrentVertices();
  const area = calculateArea(poolVertices);
  const perimeter = calculatePerimeter(poolVertices);
  const colors = MODE_COLORS[currentMode];

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <Tabs value={currentMode} onValueChange={(v) => handleModeChange(v as DrawingMode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pool" className="flex items-center gap-2">
            <Waves className="w-4 h-4" />
            <span>Basen</span>
            {poolVertices.length >= 3 && <Check className="w-3 h-3 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="stairs" className="flex items-center gap-2">
            <Footprints className="w-4 h-4" />
            <span>Schody</span>
            {stairsVertices.length >= 3 && <Check className="w-3 h-3 text-green-500" />}
          </TabsTrigger>
          <TabsTrigger value="wadingPool" className="flex items-center gap-2">
            <Baby className="w-4 h-4" />
            <span>Brodzik</span>
            {wadingPoolVertices.length >= 3 && <Check className="w-3 h-3 text-green-500" />}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Grid3X3 className="w-4 h-4" />
              <span>Siatka:</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="5"
                max="50"
                step="5"
                value={gridWidth}
                onChange={(e) => setGridWidth(Math.max(5, Math.min(50, parseInt(e.target.value) || 25)))}
                className="w-16 h-7 text-xs px-2"
                title="Szerokość siatki (m)"
              />
              <span className="text-xs text-muted-foreground">×</span>
              <Input
                type="number"
                min="5"
                max="50"
                step="5"
                value={gridHeight}
                onChange={(e) => setGridHeight(Math.max(5, Math.min(50, parseInt(e.target.value) || 25)))}
                className="w-16 h-7 text-xs px-2"
                title="Wysokość siatki (m)"
              />
              <span className="text-xs text-muted-foreground">m (od -1m)</span>
            </div>
          </div>
          <div className="flex gap-2">
            {currentMode === 'stairs' && stairsVertices.length >= 3 && (
              <Button variant="secondary" size="sm" onClick={handleRotateStairs}>
                <RotateCw className="w-4 h-4 mr-1" />
                {getRotationLabel(stairsRotation)}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset {MODE_LABELS[currentMode]}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleResetAll}>
              Reset wszystko
            </Button>
            {selectedVertexIndex !== null && (
              <Button variant="destructive" size="sm" onClick={handleDeleteVertex}>
                <Trash2 className="w-4 h-4 mr-1" />
                Usuń punkt
              </Button>
            )}
          </div>
        </div>
        {isDrawing ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.stroke }}>
            <Plus className="w-4 h-4" />
            <span>Kliknij, aby dodać punkty {MODE_LABELS[currentMode]}. Kliknij pierwszy punkt, aby zamknąć.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.stroke }}>
            <MousePointer className="w-4 h-4" />
            <span>Przeciągnij punkty, aby edytować {MODE_LABELS[currentMode]}.</span>
          </div>
        )}
      </div>


      <div className="border border-border rounded-lg overflow-auto bg-white max-h-[500px]">
        <canvas ref={canvasRef} />
      </div>

      {/* Stairs parameters controls - visible when in stairs mode */}
      {currentMode === 'stairs' && (
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-orange-600" />
              <Label className="font-medium text-orange-800">Parametry schodów</Label>
            </div>
            {/* Stairs type toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-orange-700">Typ:</Label>
              <div className="flex rounded-md border border-orange-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleStairsParamsChange(undefined, undefined, undefined, 'rectangular')}
                  className={`px-3 py-1 text-xs flex items-center gap-1 transition-colors ${
                    stairsType === 'rectangular' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  <div className="w-3 h-3 border border-current" />
                  Prostokąt
                </button>
                <button
                  type="button"
                  onClick={() => handleStairsParamsChange(undefined, undefined, undefined, 'diagonal')}
                  className={`px-3 py-1 text-xs flex items-center gap-1 transition-colors ${
                    stairsType === 'diagonal' 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-white text-orange-700 hover:bg-orange-100'
                  }`}
                >
                  <Triangle className="w-3 h-3" />
                  45°
                </button>
              </div>
            </div>
          </div>
          
          <div className={`grid gap-4 ${stairsType === 'rectangular' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* Width only for rectangular stairs */}
            {stairsType === 'rectangular' && (
              <div>
                <Label htmlFor="drawerStairsWidth" className="text-xs text-orange-700">Szerokość (m)</Label>
                <Input
                  id="drawerStairsWidth"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={stairsWidth}
                  onChange={(e) => handleStairsParamsChange(parseFloat(e.target.value) || 1.5, undefined, undefined, undefined)}
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div>
              <Label htmlFor="drawerStepCount" className="text-xs text-orange-700">Liczba stopni</Label>
              <Input
                id="drawerStepCount"
                type="number"
                step="1"
                min="2"
                max="15"
                value={stairsStepCount}
                onChange={(e) => handleStairsParamsChange(undefined, parseInt(e.target.value) || 4, undefined, undefined)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="drawerStepDepth" className="text-xs text-orange-700">Głęb. stopnia (cm)</Label>
              <Input
                id="drawerStepDepth"
                type="number"
                step="5"
                min="20"
                max="60"
                value={Math.round(stairsStepDepth * 100)}
                onChange={(e) => handleStairsParamsChange(undefined, undefined, (parseFloat(e.target.value) || 30) / 100, undefined)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          
          <div className="mt-2 text-xs text-orange-600">
            {stairsType === 'diagonal' ? (
              <>
                Rozmiar boku trójkąta: {(calculateTotalStairsDepth() * 100).toFixed(0)} cm
                {stairsVertices.length < 3 && (
                  <span className="ml-2">• Narysuj 3 punkty trójkąta lub wygeneruj automatycznie</span>
                )}
              </>
            ) : (
              <>
                Długość schodów: {(calculateTotalStairsDepth() * 100).toFixed(0)} cm
                {stairsVertices.length < 3 && (
                  <span className="ml-2">• Narysuj 4 punkty prostokąta lub wygeneruj automatycznie</span>
                )}
              </>
            )}
          </div>
          
          {stairsVertices.length < 3 && poolVertices.length >= 3 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => {
                const newVerts = generateStairsFromParams(stairsWidth, stairsStepCount, stairsStepDepth, stairsType);
                if (newVerts.length >= 3) {
                  setStairsVertices(newVerts);
                  setIsDrawing(false);
                  toast.success(stairsType === 'diagonal' 
                    ? 'Schody 45° wygenerowane - możesz je teraz przesuwać'
                    : 'Schody wygenerowane - możesz je teraz przesuwać'
                  );
                }
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              {stairsType === 'diagonal' ? 'Generuj trójkąt schodów 45°' : 'Generuj prostokąt schodów'}
            </Button>
          )}
        </div>
      )}

      {/* Vertex coordinates editor with corner labels */}
      {currentVerts.length > 0 && !isDrawing && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <Label className="text-sm font-medium mb-2 block">
            Współrzędne wierzchołków {MODE_LABELS[currentMode]} (metry)
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentVerts.map((vertex, index) => (
              <div 
                key={index} 
                className={`p-2 rounded border ${selectedVertexIndex === index ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <span className="text-xs text-muted-foreground block mb-1">
                  {currentMode === 'pool' ? `Narożnik ${getCornerLabel(index)}` : `Punkt ${index + 1}`}
                </span>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    value={vertex.x}
                    onChange={(e) => updateVertexCoordinate(index, 'x', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs px-1"
                    title="X (m)"
                  />
                  <Input
                    type="number"
                    step="0.5"
                    value={vertex.y}
                    onChange={(e) => updateVertexCoordinate(index, 'y', parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs px-1"
                    title="Y (m)"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculations summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Powierzchnia basenu</p>
          <p className="text-2xl font-bold text-primary">
            {area.toFixed(1)} <span className="text-sm font-normal">m²</span>
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Obwód basenu</p>
          <p className="text-2xl font-bold">
            {perimeter.toFixed(1)} <span className="text-sm font-normal">m</span>
          </p>
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex gap-4 text-sm">
        <div className={`flex items-center gap-2 ${poolVertices.length >= 3 ? 'text-green-600' : 'text-muted-foreground'}`}>
          <Waves className="w-4 h-4" />
          Basen: {poolVertices.length >= 3 ? '✓ Gotowy' : `${poolVertices.length}/3 punktów`}
        </div>
        <div className={`flex items-center gap-2 ${stairsVertices.length >= 3 ? 'text-green-600' : 'text-muted-foreground'}`}>
          <Footprints className="w-4 h-4" />
          Schody: {stairsVertices.length >= 3 ? '✓ Gotowe' : stairsVertices.length > 0 ? `${stairsVertices.length}/3 punktów` : 'Opcjonalne'}
        </div>
        <div className={`flex items-center gap-2 ${wadingPoolVertices.length >= 3 ? 'text-green-600' : 'text-muted-foreground'}`}>
          <Baby className="w-4 h-4" />
          Brodzik: {wadingPoolVertices.length >= 3 ? '✓ Gotowy' : wadingPoolVertices.length > 0 ? `${wadingPoolVertices.length}/3 punktów` : 'Opcjonalny'}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
        <Button onClick={handleComplete} disabled={poolVertices.length < 3} className="btn-primary">
          <Check className="w-4 h-4 mr-2" />
          Zatwierdź kształt
        </Button>
      </div>
    </div>
  );
}
