import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatPrice } from '@/lib/calculations';
import { PoolDimensions } from '@/types/configurator';
import { cn } from '@/lib/utils';

// Types
type ReinforcementType = 'traditional' | 'composite';
type MeshSize = '15x15' | '20x20' | '25x25';
type ReinforcementUnit = 'mb' | 'kg';
type ConstructionTechnology = 'masonry' | 'poured';

interface ReinforcementPosition {
  id: string;
  name: string;
  enabled: boolean;
  quantity: number;
  customOverride: boolean;
}

interface ReinforcementItem {
  id: string;
  name: string;
  diameter: number;
  unit: ReinforcementUnit;
  rate: number;
  positions: ReinforcementPosition[];
  totalQuantity: number;
  netValue: number;
  isExpanded: boolean;
}

interface ReinforcementSectionProps {
  dimensions: PoolDimensions;
  floorSlabThickness: number;
  constructionTechnology: ConstructionTechnology;
  onChange?: (data: ReinforcementData) => void;
}

export interface ReinforcementData {
  type: ReinforcementType;
  unit: ReinforcementUnit;
  meshSize: MeshSize;
  items: ReinforcementItem[];
  totalNet: number;
}

// Weight per meter (kg/mb)
const KG_PER_MB: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  12: 0.888,
};

// Mesh size in meters
const MESH_SIZE_M: Record<MeshSize, number> = {
  '15x15': 0.15,
  '20x20': 0.20,
  '25x25': 0.25,
};

// Calculate floor slab double mesh reinforcement (mb)
function calculateFloorMesh(
  length: number, 
  width: number, 
  meshSize: MeshSize
): number {
  const slabLength = length + 0.48; // +24cm each side
  const slabWidth = width + 0.48;
  const mesh = MESH_SIZE_M[meshSize];
  
  // Grid cells
  const cellsX = Math.ceil(slabLength / mesh);
  const cellsY = Math.ceil(slabWidth / mesh);
  
  // Bars in one layer
  const barsAlongX = cellsY + 1;
  const barsAlongY = cellsX + 1;
  
  const mbOneLayer = (barsAlongX * slabLength) + (barsAlongY * slabWidth);
  return mbOneLayer * 2; // Double mesh
}

// Calculate columns for masonry pool (spacing 2m)
function calculateColumns(
  length: number, 
  width: number, 
  depth: number, 
  slabThickness: number
): { count: number; mb: number } {
  // Internal columns at 2m spacing (not at corners)
  const columnsOnLength = Math.max(0, Math.floor(length / 2) - 1);
  const columnsOnWidth = Math.max(0, Math.floor(width / 2) - 1);
  const totalColumns = (columnsOnLength * 2) + (columnsOnWidth * 2);
  
  // 4 bars per column, length = depth + slab thickness
  const barLength = depth + slabThickness;
  const mb = totalColumns * 4 * barLength;
  
  return { count: totalColumns, mb };
}

// Calculate ring beam (wieniec)
function calculateRingBeam(length: number, width: number): number {
  const perimeter = 2 * (length + width);
  return 4 * perimeter; // 4 bars around
}

// Calculate wading pool mesh
function calculateWadingPoolMesh(
  wadingPool: PoolDimensions['wadingPool'],
  meshSize: MeshSize
): number {
  if (!wadingPool?.enabled) return 0;
  
  const wpLength = wadingPool.width; // External dimension
  const wpWidth = wadingPool.length;
  const mesh = MESH_SIZE_M[meshSize];
  
  const cellsX = Math.ceil(wpLength / mesh);
  const cellsY = Math.ceil(wpWidth / mesh);
  
  const barsAlongX = cellsY + 1;
  const barsAlongY = cellsX + 1;
  
  const mbOneLayer = (barsAlongX * wpLength) + (barsAlongY * wpWidth);
  return mbOneLayer * 2; // Double mesh
}

// Calculate stairs reinforcement
function calculateStairs(stairs: PoolDimensions['stairs']): number {
  if (!stairs?.enabled) return 0;
  
  const stairWidth = stairs.width === 'full' ? 2 : stairs.width; // Default 2m if full
  const stepCount = stairs.stepCount || 4;
  
  // 2x total length of all steps
  const totalStepLength = stairWidth * stepCount;
  return 2 * totalStepLength;
}

// Convert mb to kg
function mbToKg(mb: number, diameter: number): number {
  return mb * (KG_PER_MB[diameter] || 0);
}

export function ReinforcementSection({
  dimensions,
  floorSlabThickness,
  constructionTechnology,
  onChange,
}: ReinforcementSectionProps) {
  const [reinforcementType, setReinforcementType] = useState<ReinforcementType>('traditional');
  const [unit, setUnit] = useState<ReinforcementUnit>('mb');
  const [meshSize, setMeshSize] = useState<MeshSize>('20x20');
  const [items, setItems] = useState<ReinforcementItem[]>([]);

  // Calculate positions based on dimensions
  const calculatedPositions = useMemo(() => {
    const floorMb = calculateFloorMesh(dimensions.length, dimensions.width, meshSize);
    const columnData = calculateColumns(dimensions.length, dimensions.width, dimensions.depth, floorSlabThickness);
    const ringBeamMb = calculateRingBeam(dimensions.length, dimensions.width);
    const wadingPoolMb = calculateWadingPoolMesh(dimensions.wadingPool, meshSize);
    const stairsMb = calculateStairs(dimensions.stairs);
    
    return {
      floor: floorMb,
      columns: columnData,
      ringBeam: ringBeamMb,
      wadingPool: wadingPoolMb,
      stairs: stairsMb,
    };
  }, [dimensions, meshSize, floorSlabThickness]);

  // Initialize/update items when type changes
  useEffect(() => {
    const mainDiameter = reinforcementType === 'traditional' ? 12 : 8;
    const mainRate = reinforcementType === 'traditional' ? 8.50 : 12.00; // Composite is more expensive
    
    const createPositions = (diameter: number): ReinforcementPosition[] => {
      const positions: ReinforcementPosition[] = [
        {
          id: 'floor',
          name: 'Dno',
          enabled: true,
          quantity: calculatedPositions.floor,
          customOverride: false,
        },
      ];
      
      // Columns only for masonry
      if (constructionTechnology === 'masonry') {
        positions.push({
          id: 'columns',
          name: 'Słupy',
          enabled: true,
          quantity: calculatedPositions.columns.mb,
          customOverride: false,
        });
        positions.push({
          id: 'ringBeam',
          name: 'Wieniec',
          enabled: true,
          quantity: calculatedPositions.ringBeam,
          customOverride: false,
        });
      }
      
      // Wading pool if enabled
      if (dimensions.wadingPool?.enabled) {
        positions.push({
          id: 'wadingPool',
          name: 'Brodzik',
          enabled: true,
          quantity: calculatedPositions.wadingPool,
          customOverride: false,
        });
      }
      
      // Stairs if enabled
      if (dimensions.stairs?.enabled) {
        positions.push({
          id: 'stairs',
          name: 'Schody',
          enabled: true,
          quantity: calculatedPositions.stairs,
          customOverride: false,
        });
      }
      
      return positions;
    };

    const newItems: ReinforcementItem[] = [];
    
    if (reinforcementType === 'traditional') {
      // Rebar 12mm
      const positions12 = createPositions(12);
      const total12 = positions12.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      
      newItems.push({
        id: 'rebar_12mm',
        name: 'Zbrojenie 12mm',
        diameter: 12,
        unit,
        rate: mainRate,
        positions: positions12,
        totalQuantity: unit === 'mb' ? total12 : mbToKg(total12, 12),
        netValue: (unit === 'mb' ? total12 : mbToKg(total12, 12)) * mainRate,
        isExpanded: true,
      });
      
      // Rebar 6mm (stirrups - manual entry, starts at 0)
      newItems.push({
        id: 'rebar_6mm',
        name: 'Zbrojenie 6mm (strzemiona)',
        diameter: 6,
        unit,
        rate: 5.00,
        positions: [],
        totalQuantity: 0,
        netValue: 0,
        isExpanded: false,
      });
    } else {
      // Composite 8mm
      const positions8 = createPositions(8);
      const total8 = positions8.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      
      newItems.push({
        id: 'composite_8mm',
        name: 'Zbrojenie kompozytowe 8mm',
        diameter: 8,
        unit,
        rate: 12.00,
        positions: positions8,
        totalQuantity: unit === 'mb' ? total8 : mbToKg(total8, 8),
        netValue: (unit === 'mb' ? total8 : mbToKg(total8, 8)) * 12.00,
        isExpanded: true,
      });
    }
    
    setItems(newItems);
  }, [reinforcementType, constructionTechnology, dimensions.wadingPool?.enabled, dimensions.stairs?.enabled, calculatedPositions, unit]);

  // Recalculate when mesh size or unit changes
  useEffect(() => {
    setItems(prev => prev.map(item => {
      if (item.positions.length === 0) return item; // Skip 6mm
      
      const updatedPositions = item.positions.map(pos => {
        if (pos.customOverride) return pos;
        
        let newQty = 0;
        switch (pos.id) {
          case 'floor':
            newQty = calculatedPositions.floor;
            break;
          case 'columns':
            newQty = calculatedPositions.columns.mb;
            break;
          case 'ringBeam':
            newQty = calculatedPositions.ringBeam;
            break;
          case 'wadingPool':
            newQty = calculatedPositions.wadingPool;
            break;
          case 'stairs':
            newQty = calculatedPositions.stairs;
            break;
        }
        return { ...pos, quantity: newQty };
      });
      
      const totalMb = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      const displayQty = unit === 'mb' ? totalMb : mbToKg(totalMb, item.diameter);
      
      return {
        ...item,
        unit,
        positions: updatedPositions,
        totalQuantity: displayQty,
        netValue: displayQty * item.rate,
      };
    }));
  }, [meshSize, unit, calculatedPositions]);

  // Notify parent of changes
  useEffect(() => {
    const totalNet = items.reduce((sum, item) => sum + item.netValue, 0);
    onChange?.({
      type: reinforcementType,
      unit,
      meshSize,
      items,
      totalNet,
    });
  }, [items, reinforcementType, unit, meshSize, onChange]);

  // Update position quantity
  const updatePositionQuantity = (itemId: string, positionId: string, newQuantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      const updatedPositions = item.positions.map(pos => {
        if (pos.id !== positionId) return pos;
        return { ...pos, quantity: newQuantity, customOverride: true };
      });
      
      const totalMb = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      const displayQty = unit === 'mb' ? totalMb : mbToKg(totalMb, item.diameter);
      
      return {
        ...item,
        positions: updatedPositions,
        totalQuantity: displayQty,
        netValue: displayQty * item.rate,
      };
    }));
  };

  // Update item rate
  const updateItemRate = (itemId: string, newRate: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, rate: newRate, netValue: item.totalQuantity * newRate };
    }));
  };

  // Update item total quantity (for 6mm without positions)
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, totalQuantity: newQuantity, netValue: newQuantity * item.rate };
    }));
  };

  // Toggle item expansion
  const toggleExpand = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, isExpanded: !item.isExpanded };
    }));
  };

  const totalNet = items.reduce((sum, item) => sum + item.netValue, 0);

  return (
    <div className="space-y-4">
      {/* Configuration row */}
      <div className="flex flex-wrap gap-6 items-end">
        {/* Type selection */}
        <div className="space-y-2">
          <Label>Typ zbrojenia</Label>
          <RadioGroup
            value={reinforcementType}
            onValueChange={(v) => setReinforcementType(v as ReinforcementType)}
            className="flex flex-row gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="traditional" id="reinf-traditional" />
              <Label htmlFor="reinf-traditional" className="cursor-pointer">Tradycyjne</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="composite" id="reinf-composite" />
              <Label htmlFor="reinf-composite" className="cursor-pointer">Kompozytowe</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Unit selection */}
        <div className="space-y-2">
          <Label>Jednostka</Label>
          <RadioGroup
            value={unit}
            onValueChange={(v) => setUnit(v as ReinforcementUnit)}
            className="flex flex-row gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mb" id="unit-mb" />
              <Label htmlFor="unit-mb" className="cursor-pointer">Metry bieżące (mb)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="kg" id="unit-kg" />
              <Label htmlFor="unit-kg" className="cursor-pointer">Kilogramy (kg)</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Mesh size */}
        <div className="space-y-2">
          <Label>Oczko siatki</Label>
          <Select value={meshSize} onValueChange={(v) => setMeshSize(v as MeshSize)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15x15">15×15 cm</SelectItem>
              <SelectItem value="20x20">20×20 cm</SelectItem>
              <SelectItem value="25x25">25×25 cm</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reinforcement table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[250px]">Pozycja</TableHead>
              <TableHead className="text-right w-[100px]">Ilość</TableHead>
              <TableHead className="w-[60px]">Jdn.</TableHead>
              <TableHead className="text-right w-[100px]">Stawka (zł)</TableHead>
              <TableHead className="text-right w-[120px]">Wartość netto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Collapsible key={item.id} open={item.isExpanded} asChild>
                <>
                  {/* Main item row */}
                  <TableRow className="bg-muted/10">
                    <TableCell>
                      {item.positions.length > 0 ? (
                        <CollapsibleTrigger asChild>
                          <button
                            className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                            onClick={() => toggleExpand(item.id)}
                          >
                            {item.isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {item.name}
                          </button>
                        </CollapsibleTrigger>
                      ) : (
                        <span className="font-medium">{item.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.positions.length === 0 ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={item.totalQuantity.toFixed(1)}
                          onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                          className="input-field w-20 text-right"
                        />
                      ) : (
                        <span className="font-medium">{item.totalQuantity.toFixed(1)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.rate}
                        onChange={(e) => updateItemRate(item.id, parseFloat(e.target.value) || 0)}
                        className="input-field w-20 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPrice(item.netValue)}
                    </TableCell>
                  </TableRow>
                  
                  {/* Position sub-rows */}
                  <CollapsibleContent asChild>
                    <>
                      {item.positions.map((pos) => (
                        <TableRow key={pos.id} className="bg-background">
                          <TableCell className="pl-10 text-muted-foreground">
                            └ {pos.name}
                            {pos.customOverride && (
                              <span className="ml-2 text-xs text-accent">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={pos.quantity.toFixed(1)}
                              onChange={(e) => updatePositionQuantity(item.id, pos.id, parseFloat(e.target.value) || 0)}
                              className="input-field w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.rate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPrice(pos.quantity * item.rate)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Subtotal row */}
                      {item.positions.length > 0 && (
                        <TableRow className="bg-muted/5 border-t">
                          <TableCell className="pl-10 font-medium text-sm">
                            Razem {item.name.split(' ')[1]}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.totalQuantity.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell />
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.netValue)}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-medium">
                Razem zbrojenie netto
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-primary">
                {formatPrice(totalNet)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}

// Export column positions calculation for 2D visualization
export function calculateColumnPositions(length: number, width: number): { x: number; y: number; label: string }[] {
  const positions: { x: number; y: number; label: string }[] = [];
  const spacing = 2; // 2m
  let labelIndex = 1;
  
  // Columns along length (top and bottom walls)
  for (let x = spacing; x < length; x += spacing) {
    positions.push({ 
      x: x - length / 2, 
      y: -width / 2, 
      label: `S${labelIndex++}` 
    }); // top
    positions.push({ 
      x: x - length / 2, 
      y: width / 2, 
      label: `S${labelIndex++}` 
    }); // bottom
  }
  
  // Columns along width (left and right walls)
  for (let y = spacing; y < width; y += spacing) {
    positions.push({ 
      x: -length / 2, 
      y: y - width / 2, 
      label: `S${labelIndex++}` 
    }); // left
    positions.push({ 
      x: length / 2, 
      y: y - width / 2, 
      label: `S${labelIndex++}` 
    }); // right
  }
  
  return positions;
}
