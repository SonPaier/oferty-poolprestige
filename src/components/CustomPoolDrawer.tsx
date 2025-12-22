import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, Line, Polygon, Text, FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, RotateCcw, Check, MousePointer, Plus, Grid3X3, Footprints, Baby, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    wadingPoolVertices?: Point[]
  ) => void;
  onCancel: () => void;
  initialPoolVertices?: Point[];
  initialStairsVertices?: Point[];
  initialWadingPoolVertices?: Point[];
}

const GRID_SIZE = 50; // pixels per meter
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

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

export function CustomPoolDrawer({ 
  onComplete, 
  onCancel, 
  initialPoolVertices,
  initialStairsVertices,
  initialWadingPoolVertices 
}: CustomPoolDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  
  // Separate vertices for each layer
  const [poolVertices, setPoolVertices] = useState<Point[]>(initialPoolVertices || []);
  const [stairsVertices, setStairsVertices] = useState<Point[]>(initialStairsVertices || []);
  const [wadingPoolVertices, setWadingPoolVertices] = useState<Point[]>(initialWadingPoolVertices || []);
  
  const [currentMode, setCurrentMode] = useState<DrawingMode>('pool');
  const [isDrawing, setIsDrawing] = useState(!initialPoolVertices || initialPoolVertices.length < 3);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

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

  // Convert canvas coordinates to meters
  const canvasToMeters = useCallback((canvasPoint: { x: number; y: number }): Point => {
    return {
      x: canvasPoint.x / GRID_SIZE,
      y: canvasPoint.y / GRID_SIZE,
    };
  }, []);

  // Convert meters to canvas coordinates
  const metersToCanvas = useCallback((point: Point): { x: number; y: number } => {
    return {
      x: point.x * GRID_SIZE,
      y: point.y * GRID_SIZE,
    };
  }, []);

  // Snap to grid
  const snapToGrid = useCallback((value: number): number => {
    return Math.round(value / (GRID_SIZE / 2)) * (GRID_SIZE / 2);
  }, []);

  // Draw grid
  const drawGrid = useCallback((canvas: FabricCanvas) => {
    // Vertical lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      const line = new Line([x, 0, x, CANVAS_HEIGHT], {
        stroke: x % (GRID_SIZE * 2) === 0 ? 'hsl(190 20% 80%)' : 'hsl(190 10% 90%)',
        strokeWidth: x % (GRID_SIZE * 2) === 0 ? 1 : 0.5,
        selectable: false,
        evented: false,
      });
      objectDataMap.set(line, { type: 'grid' });
      canvas.add(line);
      
      // Add meter labels
      if (x % GRID_SIZE === 0 && x > 0) {
        const text = new Text(`${x / GRID_SIZE}m`, {
          left: x - 10,
          top: 5,
          fontSize: 10,
          fill: 'hsl(190 20% 50%)',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(text, { type: 'grid' });
        canvas.add(text);
      }
    }
    
    // Horizontal lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      const line = new Line([0, y, CANVAS_WIDTH, y], {
        stroke: y % (GRID_SIZE * 2) === 0 ? 'hsl(190 20% 80%)' : 'hsl(190 10% 90%)',
        strokeWidth: y % (GRID_SIZE * 2) === 0 ? 1 : 0.5,
        selectable: false,
        evented: false,
      });
      objectDataMap.set(line, { type: 'grid' });
      canvas.add(line);
      
      // Add meter labels
      if (y % GRID_SIZE === 0 && y > 0) {
        const text = new Text(`${y / GRID_SIZE}m`, {
          left: 5,
          top: y - 6,
          fontSize: 10,
          fill: 'hsl(190 20% 50%)',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(text, { type: 'grid' });
        canvas.add(text);
      }
    }
  }, []);

  // Draw a single polygon layer
  const drawPolygonLayer = useCallback((
    canvas: FabricCanvas, 
    points: Point[], 
    mode: DrawingMode,
    isActiveLayer: boolean
  ) => {
    const colors = MODE_COLORS[mode];
    
    if (points.length < 2) {
      // Just draw vertices
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

    // Draw vertices and edge lengths
    points.forEach((point, index) => {
      const canvasPoint = metersToCanvas(point);
      const isSelected = isActiveLayer && selectedVertexIndex === index;
      const vertex = new Circle({
        left: canvasPoint.x - 8,
        top: canvasPoint.y - 8,
        radius: 8,
        fill: isSelected ? 'hsl(0 80% 50%)' : colors.vertex,
        stroke: 'white',
        strokeWidth: 2,
        selectable: isActiveLayer,
        evented: isActiveLayer,
        opacity: isActiveLayer ? 1 : 0.6,
      });
      objectDataMap.set(vertex, { type: 'vertex', index, layer: mode });
      canvas.add(vertex);

      // Draw edge length label only for active layer
      if (isActiveLayer && points.length >= 2) {
        const nextIndex = (index + 1) % points.length;
        const nextPoint = points[nextIndex];
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        const midX = (canvasPoint.x + metersToCanvas(nextPoint).x) / 2;
        const midY = (canvasPoint.y + metersToCanvas(nextPoint).y) / 2;
        
        const label = new Text(`${length.toFixed(1)}m`, {
          left: midX - 15,
          top: midY - 8,
          fontSize: 12,
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
  }, [metersToCanvas, selectedVertexIndex]);

  // Redraw all shapes
  const redrawAllShapes = useCallback((canvas: FabricCanvas) => {
    // Remove existing polygons and vertices (keep grid)
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const data = objectDataMap.get(obj);
      if (data?.type === 'polygon' || data?.type === 'vertex' || data?.type === 'edge-label') {
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
    }
    
    // Draw wading pool layer
    if (wadingPoolVertices.length > 0) {
      drawPolygonLayer(canvas, wadingPoolVertices, 'wadingPool', currentMode === 'wadingPool');
    }

    canvas.renderAll();
  }, [poolVertices, stairsVertices, wadingPoolVertices, currentMode, drawPolygonLayer]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
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
  }, []);

  // Redraw when vertices or mode changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas) {
      redrawAllShapes(canvas);
    }
  }, [poolVertices, stairsVertices, wadingPoolVertices, currentMode, redrawAllShapes]);

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

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      const data = objectDataMap.get(obj);
      if (data?.type === 'vertex' && data.layer === currentMode) {
        const index = data.index!;
        const snappedX = snapToGrid(obj.left + 8);
        const snappedY = snapToGrid(obj.top + 8);
        
        obj.set({
          left: snappedX - 8,
          top: snappedY - 8,
        });
        
        const newPoint = canvasToMeters({ x: snappedX, y: snappedY });
        const currentVerts = getCurrentVertices();
        const newVertices = [...currentVerts];
        newVertices[index] = newPoint;
        setCurrentVertices(newVertices);
      }
    };

    const handleSelection = (e: any) => {
      const obj = e.selected?.[0];
      const data = obj ? objectDataMap.get(obj) : null;
      if (data?.type === 'vertex' && data.layer === currentMode) {
        setSelectedVertexIndex(data.index!);
      }
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => setSelectedVertexIndex(null));

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared');
    };
  }, [isDrawing, currentMode, getCurrentVertices, setCurrentVertices, canvasToMeters, snapToGrid]);

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
    onComplete(
      poolVertices, 
      area, 
      perimeter,
      stairsVertices.length >= 3 ? stairsVertices : undefined,
      wadingPoolVertices.length >= 3 ? wadingPoolVertices : undefined
    );
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Grid3X3 className="w-4 h-4" />
            <span>1 kratka = 1 metr</span>
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
        <div className="flex gap-2">
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

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: MODE_COLORS.pool.stroke }} />
          <span>Basen</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: MODE_COLORS.stairs.stroke }} />
          <span>Schody</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: MODE_COLORS.wadingPool.stroke }} />
          <span>Brodzik</span>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <canvas ref={canvasRef} />
      </div>

      {/* Vertex coordinates editor */}
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
                <span className="text-xs text-muted-foreground block mb-1">Punkt {index + 1}</span>
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
