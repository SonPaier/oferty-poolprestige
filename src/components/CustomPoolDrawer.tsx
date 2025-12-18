import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, Line, Polygon, Text, FabricObject } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, RotateCcw, Check, MousePointer, Plus, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';

// Store custom data on fabric objects using a WeakMap
const objectDataMap = new WeakMap<FabricObject, { type: string; index?: number }>();

interface Point {
  x: number;
  y: number;
}

interface CustomPoolDrawerProps {
  onComplete: (vertices: Point[], area: number, perimeter: number) => void;
  onCancel: () => void;
  initialVertices?: Point[];
}

const GRID_SIZE = 50; // pixels per meter
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

export function CustomPoolDrawer({ onComplete, onCancel, initialVertices }: CustomPoolDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [vertices, setVertices] = useState<Point[]>(initialVertices || []);
  const [isDrawing, setIsDrawing] = useState(true);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

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

  // Redraw polygon and vertices
  const redrawShape = useCallback((canvas: FabricCanvas, points: Point[]) => {
    // Remove existing polygon and vertices (keep grid)
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      const data = objectDataMap.get(obj);
      if (data?.type === 'polygon' || data?.type === 'vertex' || data?.type === 'edge-label') {
        canvas.remove(obj);
      }
    });

    if (points.length < 2) {
      // Just draw vertices
      points.forEach((point, index) => {
        const canvasPoint = metersToCanvas(point);
        const vertex = new Circle({
          left: canvasPoint.x - 8,
          top: canvasPoint.y - 8,
          radius: 8,
          fill: 'hsl(190 80% 42%)',
          stroke: 'white',
          strokeWidth: 2,
          selectable: true,
        });
        objectDataMap.set(vertex, { type: 'vertex', index });
        canvas.add(vertex);
      });
      canvas.renderAll();
      return;
    }

    // Draw polygon
    const canvasPoints = points.map(p => metersToCanvas(p));
    const polygon = new Polygon(canvasPoints, {
      fill: 'hsl(190 80% 42% / 0.2)',
      stroke: 'hsl(190 80% 42%)',
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    objectDataMap.set(polygon, { type: 'polygon' });
    canvas.add(polygon);

    // Draw vertices and edge lengths
    points.forEach((point, index) => {
      const canvasPoint = metersToCanvas(point);
      const vertex = new Circle({
        left: canvasPoint.x - 8,
        top: canvasPoint.y - 8,
        radius: 8,
        fill: selectedVertexIndex === index ? 'hsl(30 80% 50%)' : 'hsl(190 80% 42%)',
        stroke: 'white',
        strokeWidth: 2,
        selectable: true,
      });
      objectDataMap.set(vertex, { type: 'vertex', index });
      canvas.add(vertex);

      // Draw edge length label
      if (points.length >= 2) {
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
          fill: 'hsl(190 60% 30%)',
          fontWeight: 'bold',
          backgroundColor: 'white',
          selectable: false,
          evented: false,
        });
        objectDataMap.set(label, { type: 'edge-label' });
        canvas.add(label);
      }
    });

    canvas.renderAll();
  }, [metersToCanvas, selectedVertexIndex]);

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
    
    if (initialVertices && initialVertices.length > 0) {
      redrawShape(canvas, initialVertices);
      setIsDrawing(false);
    }

    return () => {
      canvas.dispose();
    };
  }, []);

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
      
      // Check if clicking near the first vertex to close the shape
      if (vertices.length >= 3) {
        const firstCanvasPoint = metersToCanvas(vertices[0]);
        const dist = Math.sqrt(
          Math.pow(snappedX - firstCanvasPoint.x, 2) + 
          Math.pow(snappedY - firstCanvasPoint.y, 2)
        );
        if (dist < 20) {
          setIsDrawing(false);
          toast.success('Kształt zamknięty! Możesz teraz edytować wierzchołki.');
          return;
        }
      }
      
      const newVertices = [...vertices, newPoint];
      setVertices(newVertices);
      redrawShape(canvas, newVertices);
    };

    canvas.on('mouse:down', handleMouseDown);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
    };
  }, [isDrawing, vertices, canvasToMeters, metersToCanvas, snapToGrid, redrawShape]);

  // Handle vertex selection and dragging
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || isDrawing) return;

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      const data = objectDataMap.get(obj);
      if (data?.type === 'vertex') {
        const index = data.index!;
        const snappedX = snapToGrid(obj.left + 8);
        const snappedY = snapToGrid(obj.top + 8);
        
        obj.set({
          left: snappedX - 8,
          top: snappedY - 8,
        });
        
        const newPoint = canvasToMeters({ x: snappedX, y: snappedY });
        const newVertices = [...vertices];
        newVertices[index] = newPoint;
        setVertices(newVertices);
      }
    };

    const handleObjectModified = () => {
      redrawShape(canvas, vertices);
    };

    const handleSelection = (e: any) => {
      const obj = e.selected?.[0];
      const data = obj ? objectDataMap.get(obj) : null;
      if (data?.type === 'vertex') {
        setSelectedVertexIndex(data.index!);
      }
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => setSelectedVertexIndex(null));

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared');
    };
  }, [isDrawing, vertices, canvasToMeters, snapToGrid, redrawShape]);

  // Update shape when vertices change
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas && !isDrawing) {
      redrawShape(canvas, vertices);
    }
  }, [vertices, isDrawing, redrawShape]);

  const handleReset = () => {
    setVertices([]);
    setIsDrawing(true);
    setSelectedVertexIndex(null);
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.clear();
      drawGrid(canvas);
    }
    toast.info('Zacznij rysować od nowa');
  };

  const handleDeleteVertex = () => {
    if (selectedVertexIndex === null) return;
    const newVertices = vertices.filter((_, i) => i !== selectedVertexIndex);
    setVertices(newVertices);
    setSelectedVertexIndex(null);
    if (newVertices.length < 3) {
      setIsDrawing(true);
    }
    const canvas = fabricRef.current;
    if (canvas) {
      redrawShape(canvas, newVertices);
    }
  };

  const handleComplete = () => {
    if (vertices.length < 3) {
      toast.error('Potrzebujesz minimum 3 punktów, aby utworzyć kształt');
      return;
    }
    const area = calculateArea(vertices);
    const perimeter = calculatePerimeter(vertices);
    onComplete(vertices, area, perimeter);
  };

  const updateVertexCoordinate = (index: number, axis: 'x' | 'y', value: number) => {
    const newVertices = [...vertices];
    newVertices[index] = { ...newVertices[index], [axis]: value };
    setVertices(newVertices);
  };

  const area = calculateArea(vertices);
  const perimeter = calculatePerimeter(vertices);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Grid3X3 className="w-4 h-4" />
            <span>1 kratka = 1 metr</span>
          </div>
          {isDrawing ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Plus className="w-4 h-4" />
              <span>Kliknij, aby dodać punkty. Kliknij pierwszy punkt, aby zamknąć.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-primary">
              <MousePointer className="w-4 h-4" />
              <span>Przeciągnij punkty, aby edytować kształt.</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          {selectedVertexIndex !== null && (
            <Button variant="destructive" size="sm" onClick={handleDeleteVertex}>
              <Trash2 className="w-4 h-4 mr-1" />
              Usuń punkt
            </Button>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <canvas ref={canvasRef} />
      </div>

      {/* Vertex coordinates editor */}
      {vertices.length > 0 && !isDrawing && (
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <Label className="text-sm font-medium mb-2 block">Współrzędne wierzchołków (metry)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {vertices.map((vertex, index) => (
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
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Powierzchnia</p>
          <p className="text-2xl font-bold text-primary">
            {area.toFixed(1)} <span className="text-sm font-normal">m²</span>
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Obwód</p>
          <p className="text-2xl font-bold">
            {perimeter.toFixed(1)} <span className="text-sm font-normal">m</span>
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
        <Button onClick={handleComplete} disabled={vertices.length < 3} className="btn-primary">
          <Check className="w-4 h-4 mr-2" />
          Zatwierdź kształt
        </Button>
      </div>
    </div>
  );
}