import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/calculations';
import { PoolDimensions } from '@/types/configurator';

// Types
export type ReinforcementType = 'traditional' | 'composite';
export type MeshSize = '15x15' | '20x20' | '25x25';
export type ReinforcementUnit = 'mb' | 'kg';
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

export function useReinforcement(
  dimensions: PoolDimensions,
  floorSlabThickness: number,
  constructionTechnology: ConstructionTechnology
) {
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
    const mainRate = reinforcementType === 'traditional' ? 8.50 : 12.00;
    
    const createPositions = (): ReinforcementPosition[] => {
      const positions: ReinforcementPosition[] = [
        {
          id: 'floor',
          name: 'Dno',
          enabled: true,
          quantity: calculatedPositions.floor,
          customOverride: false,
        },
      ];
      
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
      
      if (dimensions.wadingPool?.enabled) {
        positions.push({
          id: 'wadingPool',
          name: 'Brodzik',
          enabled: true,
          quantity: calculatedPositions.wadingPool,
          customOverride: false,
        });
      }
      
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
      const positions12 = createPositions();
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
    } else {
      // Composite reinforcement
      const positions8 = createPositions();
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
    
    // Always add 6mm rebar (visible in both variants)
    newItems.push({
      id: 'rebar_6mm',
      name: 'Zbrojenie 6mm',
      diameter: 6,
      unit,
      rate: 5.00,
      positions: [],
      totalQuantity: 0,
      netValue: 0,
      isExpanded: false,
    });
    
    // Always add stirrups as separate item (visible in both variants)
    newItems.push({
      id: 'strzemiona',
      name: 'Strzemiona',
      diameter: 6,
      unit,
      rate: 6.00,
      positions: [],
      totalQuantity: 0,
      netValue: 0,
      isExpanded: false,
    });
    
    setItems(newItems);
  }, [reinforcementType, constructionTechnology, dimensions.wadingPool?.enabled, dimensions.stairs?.enabled, calculatedPositions, unit]);

  // Recalculate when mesh size or unit changes
  useEffect(() => {
    setItems(prev => prev.map(item => {
      if (item.positions.length === 0) return item;
      
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

  const updateItemRate = (itemId: string, newRate: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, rate: newRate, netValue: item.totalQuantity * newRate };
    }));
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, totalQuantity: newQuantity, netValue: newQuantity * item.rate };
    }));
  };

  const toggleExpand = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, isExpanded: !item.isExpanded };
    }));
  };

  const totalNet = items.reduce((sum, item) => sum + item.netValue, 0);

  return {
    reinforcementType,
    setReinforcementType,
    unit,
    setUnit,
    meshSize,
    setMeshSize,
    items,
    totalNet,
    updatePositionQuantity,
    updateItemRate,
    updateItemQuantity,
    toggleExpand,
  };
}

// Render controls for reinforcement config
interface ReinforcementControlsProps {
  reinforcementType: ReinforcementType;
  setReinforcementType: (v: ReinforcementType) => void;
  unit: ReinforcementUnit;
  setUnit: (v: ReinforcementUnit) => void;
  meshSize: MeshSize;
  setMeshSize: (v: MeshSize) => void;
}

export function ReinforcementControls({
  reinforcementType,
  setReinforcementType,
  unit,
  setUnit,
  meshSize,
  setMeshSize,
}: ReinforcementControlsProps) {
  return (
    <div className="flex flex-wrap gap-6 items-end mb-4 p-4 rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Typ zbrojenia</Label>
        <RadioGroup
          value={reinforcementType}
          onValueChange={(v) => setReinforcementType(v as ReinforcementType)}
          className="flex flex-row gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="traditional" id="reinf-traditional" />
            <Label htmlFor="reinf-traditional" className="cursor-pointer text-sm">Tradycyjne</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="composite" id="reinf-composite" />
            <Label htmlFor="reinf-composite" className="cursor-pointer text-sm">Kompozytowe</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Jednostka</Label>
        <RadioGroup
          value={unit}
          onValueChange={(v) => setUnit(v as ReinforcementUnit)}
          className="flex flex-row gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mb" id="unit-mb" />
            <Label htmlFor="unit-mb" className="cursor-pointer text-sm">mb</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="kg" id="unit-kg" />
            <Label htmlFor="unit-kg" className="cursor-pointer text-sm">kg</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Oczko siatki</Label>
        <Select value={meshSize} onValueChange={(v) => setMeshSize(v as MeshSize)}>
          <SelectTrigger className="w-[100px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="15x15">15×15</SelectItem>
            <SelectItem value="20x20">20×20</SelectItem>
            <SelectItem value="25x25">25×25</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Render table rows for reinforcement items
interface ReinforcementTableRowsProps {
  items: ReinforcementItem[];
  unit: ReinforcementUnit;
  onToggleExpand: (itemId: string) => void;
  onUpdatePositionQuantity: (itemId: string, positionId: string, qty: number) => void;
  onUpdateItemRate: (itemId: string, rate: number) => void;
  onUpdateItemQuantity: (itemId: string, qty: number) => void;
}

export function ReinforcementTableRows({
  items,
  unit,
  onToggleExpand,
  onUpdatePositionQuantity,
  onUpdateItemRate,
  onUpdateItemQuantity,
}: ReinforcementTableRowsProps) {
  const rows: JSX.Element[] = [];
  
  items.forEach((item) => {
    // Main item row
    rows.push(
      <TableRow key={item.id} className="bg-accent/5">
        <TableCell>
          {item.positions.length > 0 ? (
            <button
              type="button"
              className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
              onClick={() => onToggleExpand(item.id)}
            >
              {item.isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {item.name}
            </button>
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
              onChange={(e) => onUpdateItemQuantity(item.id, parseFloat(e.target.value) || 0)}
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
            onChange={(e) => onUpdateItemRate(item.id, parseFloat(e.target.value) || 0)}
            className="input-field w-20 text-right"
          />
        </TableCell>
        <TableCell className="text-right font-semibold">
          {formatPrice(item.netValue)}
        </TableCell>
      </TableRow>
    );
    
    // Position sub-rows (only when expanded)
    if (item.isExpanded && item.positions.length > 0) {
      item.positions.forEach((pos) => {
        rows.push(
          <TableRow key={`${item.id}-${pos.id}`} className="bg-background">
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
                onChange={(e) => onUpdatePositionQuantity(item.id, pos.id, parseFloat(e.target.value) || 0)}
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
        );
      });
    }
  });
  
  return <>{rows}</>;
}

// Calculate column positions for 2D visualization
export function calculateColumnPositions(length: number, width: number): { x: number; y: number; label: string }[] {
  const positions: { x: number; y: number; label: string }[] = [];
  const spacing = 2; // 2m
  let labelIndex = 1;
  
  for (let x = spacing; x < length; x += spacing) {
    positions.push({ x: x - length / 2, y: -width / 2, label: `S${labelIndex++}` });
    positions.push({ x: x - length / 2, y: width / 2, label: `S${labelIndex++}` });
  }
  
  for (let y = spacing; y < width; y += spacing) {
    positions.push({ x: -length / 2, y: y - width / 2, label: `S${labelIndex++}` });
    positions.push({ x: length / 2, y: y - width / 2, label: `S${labelIndex++}` });
  }
  
  return positions;
}
