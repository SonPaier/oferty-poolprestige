import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatPrice } from '@/lib/calculations';
import { PoolDimensions, ConstructionMaterialRates, defaultConstructionMaterialRates } from '@/types/configurator';

// Types
export type ReinforcementType = 'traditional' | 'composite';
export type MeshSize = '15x15' | '20x20' | '25x25';
export type ReinforcementUnit = 'mb' | 'kg' | 'szt.';
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
  supportsKg: boolean; // Whether this item can be switched to kg
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

// =====================================================
// BLOCK AND CROWN HEIGHT CALCULATION
// =====================================================

export type BlockHeight = 12 | 14;

// Concrete block dimensions (cm converted to m)
export const BLOCK_DIMENSIONS = {
  length: 0.38, // 38 cm - length of block
  width: 0.24,  // 24 cm - wall thickness
  height: 0.12, // 12 cm - default, laid flat (na leżąco)
};

// Crown height constraints (wieniec)
const MIN_CROWN_HEIGHT = 0.18; // 18 cm minimum
const MAX_CROWN_HEIGHT = 0.30; // 30 cm maximum (to avoid needing to cut blocks)
const OPTIMAL_CROWN_HEIGHT = 0.24; // 24 cm optimal

export interface BlockLayerCalculation {
  layers: number;          // Number of block layers
  wallHeight: number;      // Height of masonry wall (m)
  crownHeight: number;     // Height of crown/wieniec (m)
  isOptimal: boolean;      // Whether crown height is at optimal 24cm
}

// Calculate crown concrete volume
export function calculateCrownConcreteVolume(
  poolLength: number,
  poolWidth: number,
  crownHeight: number
): number {
  const perimeter = 2 * (poolLength + poolWidth);
  const wallWidth = BLOCK_DIMENSIONS.width; // 0.24m
  // Volume = perimeter × wall_width × crown_height
  return perimeter * wallWidth * crownHeight;
}

// Calculate columns concrete volume
// Formula: column_width × column_depth × (pool_depth - crown_height) × column_count
export function calculateColumnsConcreteVolume(
  poolLength: number,
  poolWidth: number,
  poolDepth: number,
  crownHeight: number,
  customColumnCount?: number
): { volume: number; columnCount: number } {
  // Calculate column count - use custom count if provided, otherwise calculate default
  let columnCount: number;
  if (customColumnCount !== undefined) {
    columnCount = customColumnCount;
  } else {
    const columnsOnLength = Math.max(0, Math.floor(poolLength / 2) - 1);
    const columnsOnWidth = Math.max(0, Math.floor(poolWidth / 2) - 1);
    columnCount = (columnsOnLength * 2) + (columnsOnWidth * 2);
  }
  
  if (columnCount === 0) return { volume: 0, columnCount: 0 };
  
  const columnWidth = BLOCK_DIMENSIONS.width; // 0.24m
  const columnDepth = BLOCK_DIMENSIONS.width; // 0.24m (square columns)
  const columnHeight = poolDepth - crownHeight; // Wall height
  
  // Volume = width × depth × height × count
  const volume = columnWidth * columnDepth * columnHeight * columnCount;
  
  return { volume, columnCount };
}

// Calculate optimal number of block layers and crown height
export function calculateBlockLayers(poolDepth: number, blockHeightCm: BlockHeight = 12, customLayers?: number): BlockLayerCalculation {
  const blockHeight = blockHeightCm / 100; // convert cm to m
  
  // Maximum number of layers (if no crown)
  const maxLayers = Math.floor(poolDepth / blockHeight);
  
  // If custom layers provided, use them directly
  if (customLayers !== undefined && customLayers > 0) {
    const wallHeight = customLayers * blockHeight;
    const crownHeight = poolDepth - wallHeight;
    return {
      layers: customLayers,
      wallHeight,
      crownHeight,
      isOptimal: Math.abs(crownHeight - OPTIMAL_CROWN_HEIGHT) < 0.01,
    };
  }
  
  // Search for optimal number of layers (prioritize values close to 24cm)
  for (let layers = maxLayers; layers >= 1; layers--) {
    const wallHeight = layers * blockHeight;
    const crownHeight = poolDepth - wallHeight;
    
    // Crown must be between 18cm and 30cm
    if (crownHeight >= MIN_CROWN_HEIGHT && crownHeight <= MAX_CROWN_HEIGHT) {
      return { 
        layers, 
        wallHeight, 
        crownHeight, 
        isOptimal: Math.abs(crownHeight - OPTIMAL_CROWN_HEIGHT) < 0.01 
      };
    }
  }
  
  // Fallback - use minimum crown height
  const fallbackLayers = Math.floor((poolDepth - MIN_CROWN_HEIGHT) / blockHeight);
  const fallbackWallHeight = fallbackLayers * blockHeight;
  /* eslint-disable @typescript-eslint/no-unused-vars */
  return {
    layers: fallbackLayers,
    wallHeight: fallbackWallHeight,
    crownHeight: poolDepth - fallbackWallHeight,
    isOptimal: false,
  };
}

// Calculate number of blocks per layer
export function calculateBlocksPerLayer(
  poolLength: number,
  poolWidth: number,
  customColumnCount?: number
): number {
  const perimeter = 2 * (poolLength + poolWidth); // m
  const columnWidth = BLOCK_DIMENSIONS.width; // 0.24m
  const blockLength = BLOCK_DIMENSIONS.length; // 0.38m
  
  // Calculate column count - use custom count if provided, otherwise calculate default
  let columnCount: number;
  if (customColumnCount !== undefined) {
    columnCount = customColumnCount;
  } else {
    const columnsOnLength = Math.max(0, Math.floor(poolLength / 2) - 1);
    const columnsOnWidth = Math.max(0, Math.floor(poolWidth / 2) - 1);
    columnCount = (columnsOnLength * 2) + (columnsOnWidth * 2);
  }
  
  // Subtract space occupied by columns
  const effectiveLength = perimeter - (columnCount * columnWidth);
  
  return Math.ceil(effectiveLength / blockLength);
}

// Calculate total number of blocks
export function calculateTotalBlocks(
  poolLength: number,
  poolWidth: number,
  poolDepth: number,
  customLayers?: number,
  customCrownHeight?: number,
  customColumnCount?: number,
  blockHeightCm: BlockHeight = 12
): { 
  layers: number; 
  blocksPerLayer: number; 
  totalBlocks: number; 
  crownHeight: number;
  wallHeight: number;
  columnCount: number;
  isOptimal: boolean;
} {
  const blockHeight = blockHeightCm / 100;
  // Calculate column count - use custom count if provided, otherwise calculate default
  let columnCount: number;
  if (customColumnCount !== undefined) {
    columnCount = customColumnCount;
  } else {
    const columnsOnLength = Math.max(0, Math.floor(poolLength / 2) - 1);
    const columnsOnWidth = Math.max(0, Math.floor(poolWidth / 2) - 1);
    columnCount = (columnsOnLength * 2) + (columnsOnWidth * 2);
  }
  
  // Calculate layers and crown height
  let layerCalc = calculateBlockLayers(poolDepth, blockHeightCm);
  
  // Apply custom values if provided
  if (customLayers !== undefined && customLayers > 0) {
    const wallHeight = customLayers * blockHeight;
    const crownHeight = poolDepth - wallHeight;
    layerCalc = {
      layers: customLayers,
      wallHeight,
      crownHeight,
      isOptimal: Math.abs(crownHeight - OPTIMAL_CROWN_HEIGHT) < 0.01,
    };
  }
  
  if (customCrownHeight !== undefined && customCrownHeight >= MIN_CROWN_HEIGHT) {
    const wallHeight = poolDepth - customCrownHeight;
    const layers = Math.round(wallHeight / blockHeight);
    layerCalc = {
      layers,
      wallHeight: layers * blockHeight,
      crownHeight: poolDepth - (layers * blockHeight),
      isOptimal: Math.abs(customCrownHeight - OPTIMAL_CROWN_HEIGHT) < 0.01,
    };
  }
  
  const blocksPerLayer = calculateBlocksPerLayer(poolLength, poolWidth, columnCount);
  const totalBlocks = layerCalc.layers * blocksPerLayer;
  
  return {
    layers: layerCalc.layers,
    blocksPerLayer,
    totalBlocks,
    crownHeight: layerCalc.crownHeight,
    wallHeight: layerCalc.wallHeight,
    columnCount,
    isOptimal: layerCalc.isOptimal,
  };
}

// =====================================================
// REINFORCEMENT CALCULATION
// =====================================================

// Price per tonne for steel reinforcement
const STEEL_PRICE_PER_TONNE = 3500;
const STEEL_PRICE_PER_KG = STEEL_PRICE_PER_TONNE / 1000; // 3.50 zł/kg

// Weight per meter (kg/mb) - only for traditional steel reinforcement
const KG_PER_MB: Record<number, number> = {
  6: 0.222,
  12: 0.888,
};

// Rate per mb derived from kg price
function ratePerMb(diameter: number): number {
  return STEEL_PRICE_PER_KG * (KG_PER_MB[diameter] || 0);
}

// Check if item supports kg unit (only traditional steel, not composite)
function supportsKgUnit(itemId: string): boolean {
  return itemId !== 'composite_8mm';
}

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
   const slabLength = length + 0.88; // external (pool+0.48) + 20cm each side
   const slabWidth = width + 0.88;
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

// Calculate stirrups (strzemiona) for columns and crown
function calculateStirrups(
  length: number,
  width: number,
  depth: number,
  crownHeight: number,
  columnCount: number
): { columnsQty: number; crownQty: number; total: number; columnHeight: number; perimeter: number } {
  const spacing = 0.20; // 20 cm
  const columnHeight = Math.max(0, depth - crownHeight);
  const perimeter = 2 * (length + width);
  
  const stirrupsPerColumn = Math.ceil(columnHeight / spacing);
  const columnsQty = stirrupsPerColumn * columnCount;
  const crownQty = Math.ceil(perimeter / spacing);
  
  return { columnsQty, crownQty, total: columnsQty + crownQty, columnHeight, perimeter };
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
  constructionTechnology: ConstructionTechnology,
  materialRates: ConstructionMaterialRates = defaultConstructionMaterialRates
) {
  const [reinforcementType, setReinforcementType] = useState<ReinforcementType>('composite');
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
    
    // Crown height for stirrups
    const blockCalc = calculateBlockLayers(dimensions.depth);
    const stirrupData = calculateStirrups(
      dimensions.length, dimensions.width, dimensions.depth,
      blockCalc.crownHeight, columnData.count
    );
    
    return {
      floor: floorMb,
      columns: columnData,
      ringBeam: ringBeamMb,
      wadingPool: wadingPoolMb,
      stairs: stairsMb,
      stirrups: stirrupData,
    };
  }, [dimensions, meshSize, floorSlabThickness]);

  // Initialize/update items when type changes
  useEffect(() => {
    const mainDiameter = reinforcementType === 'traditional' ? 12 : 8;
    const mainRate = reinforcementType === 'traditional' ? materialRates.zbrojenie12mm : materialRates.zbrojenieKompozytowe;
    
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
    
    // Calculate main reinforcement positions (no reserve)
    const mainPositions = createPositions();
    const mainTotalMb = mainPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
    
    if (reinforcementType === 'traditional') {
      const rate12 = unit === 'mb' ? ratePerMb(12) : STEEL_PRICE_PER_KG;
      const total12 = unit === 'mb' ? mainTotalMb : mbToKg(mainTotalMb, 12);
      
      newItems.push({
        id: 'rebar_12mm',
        name: 'Zbrojenie 12mm',
        diameter: 12,
        unit,
        rate: rate12,
        positions: mainPositions,
        totalQuantity: total12,
        netValue: total12 * rate12,
        isExpanded: false,
        supportsKg: true,
      });
    } else {
      // Composite reinforcement - always in mb
      newItems.push({
        id: 'composite_8mm',
        name: 'Zbrojenie kompozytowe 8mm',
        diameter: 8,
        unit: 'mb',
        rate: materialRates.zbrojenieKompozytowe,
        positions: mainPositions,
        totalQuantity: mainTotalMb,
        netValue: mainTotalMb * materialRates.zbrojenieKompozytowe,
        isExpanded: false,
        supportsKg: false,
      });
    }
    
    // Auto-calculate 6mm rebar: 50mb per every 500mb of main reinforcement
    const rebar6mbAuto = Math.ceil(mainTotalMb / 500) * 50;
    const rate6 = unit === 'mb' ? ratePerMb(6) : STEEL_PRICE_PER_KG;
    const total6 = unit === 'mb' ? rebar6mbAuto : mbToKg(rebar6mbAuto, 6);
    
    newItems.push({
      id: 'rebar_6mm',
      name: 'Zbrojenie 6mm',
      diameter: 6,
      unit,
      rate: rate6,
      positions: [{
        id: 'auto_reserve',
        name: `Zapas (50mb / 500mb zbrojenia)`,
        enabled: true,
        quantity: rebar6mbAuto,
        customOverride: false,
      }],
      totalQuantity: total6,
      netValue: total6 * rate6,
      isExpanded: false,
      supportsKg: true,
    });
    
    // Stirrups - auto-calculated for masonry, manual for poured
    const stirrupPositions: ReinforcementPosition[] = constructionTechnology === 'masonry' ? [
      {
        id: 'stirrup_columns',
        name: `Słupy (${calculatedPositions.stirrups.columnHeight.toFixed(2)}m × ${calculatedPositions.columns.count} szt.)`,
        enabled: true,
        quantity: calculatedPositions.stirrups.columnsQty,
        customOverride: false,
      },
      {
        id: 'stirrup_crown',
        name: `Wieniec (obwód ${calculatedPositions.stirrups.perimeter.toFixed(1)}m)`,
        enabled: true,
        quantity: calculatedPositions.stirrups.crownQty,
        customOverride: false,
      },
    ] : [];
    
    const stirrupTotal = stirrupPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
    
    newItems.push({
      id: 'strzemiona',
      name: 'Strzemiona 18×18',
      diameter: 6,
      unit: 'szt.',
      rate: materialRates.strzemiona,
      positions: stirrupPositions,
      totalQuantity: stirrupTotal,
      netValue: stirrupTotal * materialRates.strzemiona,
      isExpanded: false,
      supportsKg: false,
    });
    
    setItems(newItems);
  }, [reinforcementType, constructionTechnology, dimensions.wadingPool?.enabled, dimensions.stairs?.enabled, calculatedPositions, unit]);

  // Recalculate when mesh size or unit changes
  useEffect(() => {
    setItems(prev => {
      // First pass: update positions for main rebar items
      const updated = prev.map(item => {
        if (item.id === 'rebar_6mm') return item; // handle separately below
        if (item.positions.length === 0) return item;
        
        const updatedPositions = item.positions.map(pos => {
          if (pos.customOverride) return pos;
          
          let newQty = 0;
          switch (pos.id) {
            case 'floor': newQty = calculatedPositions.floor; break;
            case 'columns': newQty = calculatedPositions.columns.mb; break;
            case 'ringBeam': newQty = calculatedPositions.ringBeam; break;
            case 'wadingPool': newQty = calculatedPositions.wadingPool; break;
            case 'stairs': newQty = calculatedPositions.stairs; break;
            case 'stirrup_columns': newQty = calculatedPositions.stirrups.columnsQty; break;
            case 'stirrup_crown': newQty = calculatedPositions.stirrups.crownQty; break;
          }
          return { ...pos, quantity: newQty };
        });
        
        const totalMb = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
        
        // For stirrups: always szt., no conversion
        if (item.id === 'strzemiona') {
          return { ...item, positions: updatedPositions, totalQuantity: totalMb, netValue: totalMb * item.rate };
        }
        
        // For main rebar: convert based on unit and recalc rate
        const isComposite = item.id === 'composite_8mm';
        const displayQty = isComposite ? totalMb : (unit === 'mb' ? totalMb : mbToKg(totalMb, item.diameter));
        const rate = isComposite ? item.rate : (unit === 'mb' ? ratePerMb(item.diameter) : STEEL_PRICE_PER_KG);
        
        return {
          ...item,
          unit: isComposite ? 'mb' : unit,
          rate,
          positions: updatedPositions,
          totalQuantity: displayQty,
          netValue: displayQty * rate,
        };
      });
      
      // Second pass: recalculate 6mm based on main rebar total mb
      const mainItem = updated.find(i => i.id === 'rebar_12mm' || i.id === 'composite_8mm');
      const mainTotalMb = mainItem?.positions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0) || 0;
      const rebar6mbAuto = Math.ceil(mainTotalMb / 500) * 50;
      
      return updated.map(item => {
        if (item.id !== 'rebar_6mm') return item;
        
        const autoPos = item.positions.find(p => p.id === 'auto_reserve');
        const currentQtyMb = (autoPos && !autoPos.customOverride) ? rebar6mbAuto : (autoPos?.quantity || rebar6mbAuto);
        
        const updatedPositions = item.positions.map(pos => {
          if (pos.id === 'auto_reserve' && !pos.customOverride) {
            return { ...pos, quantity: rebar6mbAuto };
          }
          return pos;
        });
        
        const totalMb = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
        const displayQty = unit === 'mb' ? totalMb : mbToKg(totalMb, 6);
        const rate = unit === 'mb' ? ratePerMb(6) : STEEL_PRICE_PER_KG;
        
        return {
          ...item,
          unit,
          rate,
          positions: updatedPositions,
          totalQuantity: displayQty,
          netValue: displayQty * rate,
        };
      });
    });
  }, [meshSize, unit, calculatedPositions]);

  const updatePositionQuantity = (itemId: string, positionId: string, newQuantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      const updatedPositions = item.positions.map(pos => {
        if (pos.id !== positionId) return pos;
        return { ...pos, quantity: newQuantity, customOverride: true };
      });
      
      const totalQty = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      const displayQty = item.id === 'strzemiona' ? totalQty : (unit === 'mb' ? totalQty : mbToKg(totalQty, item.diameter));
      
      return {
        ...item,
        positions: updatedPositions,
        totalQuantity: displayQty,
        netValue: displayQty * item.rate,
      };
    }));
  };

  const resetPositionQuantity = (itemId: string, positionId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      
      const updatedPositions = item.positions.map(pos => {
        if (pos.id !== positionId) return pos;
        let resetQty = 0;
        switch (pos.id) {
          case 'floor': resetQty = calculatedPositions.floor; break;
          case 'columns': resetQty = calculatedPositions.columns.mb; break;
          case 'ringBeam': resetQty = calculatedPositions.ringBeam; break;
          case 'wadingPool': resetQty = calculatedPositions.wadingPool; break;
          case 'stairs': resetQty = calculatedPositions.stairs; break;
          case 'stirrup_columns': resetQty = calculatedPositions.stirrups.columnsQty; break;
          case 'stirrup_crown': resetQty = calculatedPositions.stirrups.crownQty; break;
        }
        return { ...pos, quantity: resetQty, customOverride: false };
      });
      
      const totalQty = updatedPositions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
      const displayQty = item.id === 'strzemiona' ? totalQty : (unit === 'mb' ? totalQty : mbToKg(totalQty, item.diameter));
      
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

  const updateItemUnit = (itemId: string, newUnit: ReinforcementUnit) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId || !item.supportsKg) return item;
      
      // Recalculate quantity and rate based on new unit
      let newQuantity = item.totalQuantity;
      if (item.positions.length > 0) {
        const totalMb = item.positions.reduce((sum, p) => sum + (p.enabled ? p.quantity : 0), 0);
        newQuantity = newUnit === 'mb' ? totalMb : mbToKg(totalMb, item.diameter);
      }
      
      // Recalculate rate: mb → price per meter, kg → price per kg
      const newRate = newUnit === 'mb' ? ratePerMb(item.diameter) : STEEL_PRICE_PER_KG;
      
      return { 
        ...item, 
        unit: newUnit, 
        rate: newRate,
        totalQuantity: newQuantity,
        netValue: newQuantity * newRate 
      };
    }));
  };

  const toggleExpand = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, isExpanded: !item.isExpanded };
    }));
  };

  // Calculate total using rounded quantities
  const totalNet = items.reduce((sum, item) => {
    const roundedQty = Math.ceil(item.totalQuantity);
    return sum + (roundedQty * item.rate);
  }, 0);

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
    resetPositionQuantity,
    updateItemRate,
    updateItemQuantity,
    updateItemUnit,
    toggleExpand,
  };
}
interface ReinforcementControlsProps {
  reinforcementType: ReinforcementType;
  setReinforcementType: (v: ReinforcementType) => void;
  meshSize: MeshSize;
  setMeshSize: (v: MeshSize) => void;
}

export function ReinforcementControls({
  reinforcementType,
  setReinforcementType,
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
  onToggleExpand: (itemId: string) => void;
  onUpdatePositionQuantity: (itemId: string, positionId: string, qty: number) => void;
  onResetPositionQuantity: (itemId: string, positionId: string) => void;
  onUpdateItemRate: (itemId: string, rate: number) => void;
  onUpdateItemQuantity: (itemId: string, qty: number) => void;
  onUpdateItemUnit: (itemId: string, unit: ReinforcementUnit) => void;
  changedRates?: Record<string, number>; // Track which rates have pending changes
  onConfirmRateChange?: (itemId: string) => void; // Callback when user confirms rate change
}

// Format quantity for reinforcement - always round to integers, no decimals
function formatReinforcementQuantity(qty: number): string {
  const rounded = Math.ceil(qty);
  return rounded.toString();
}

export function ReinforcementTableRows({
  items,
  onToggleExpand,
  onUpdatePositionQuantity,
  onResetPositionQuantity,
  onUpdateItemRate,
  onUpdateItemQuantity,
  onUpdateItemUnit,
  changedRates = {},
  onConfirmRateChange,
}: ReinforcementTableRowsProps) {
  const rows: JSX.Element[] = [];
  
  items.forEach((item) => {
    const roundedTotal = Math.ceil(item.totalQuantity);
    
    // Main item row
    rows.push(
      <TableRow key={item.id}>
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
        <TableCell>
          {item.positions.length === 0 ? (
            <Input
              type="number"
              min="0"
              step="1"
              value={formatReinforcementQuantity(item.totalQuantity)}
              onChange={(e) => onUpdateItemQuantity(item.id, parseFloat(e.target.value) || 0)}
              className="input-field w-[80px] text-right ml-auto"
            />
          ) : (
            <span className="font-medium block text-right pr-2">{formatReinforcementQuantity(item.totalQuantity)}</span>
          )}
        </TableCell>
        <TableCell>
          {item.supportsKg ? (
            <Select 
              value={item.unit} 
              onValueChange={(v) => onUpdateItemUnit(item.id, v as ReinforcementUnit)}
            >
              <SelectTrigger className="w-[70px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="mb">mb</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">{item.unit}</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={item.rate}
              onChange={(e) => onUpdateItemRate(item.id, parseFloat(e.target.value) || 0)}
              className="input-field w-[80px] text-right"
            />
            {changedRates[item.id] !== undefined && onConfirmRateChange && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                onClick={() => onConfirmRateChange(item.id)}
                title="Zatwierdź zmianę stawki"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right font-semibold">
          {formatPrice(roundedTotal * item.rate)}
        </TableCell>
      </TableRow>
    );
    
    // Position sub-rows (only when expanded)
    if (item.isExpanded && item.positions.length > 0) {
      item.positions.forEach((pos) => {
        const roundedPosQty = Math.ceil(pos.quantity);
        rows.push(
          <TableRow key={`${item.id}-${pos.id}`} className="bg-background">
            <TableCell className="pl-10 text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>└ {pos.name}</span>
                {pos.customOverride && (
                  <>
                    <span className="text-xs text-accent">(zmieniono)</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => onResetPositionQuantity(item.id, pos.id)}
                      title="Przywróć obliczoną wartość"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Input
                type="number"
                min="0"
                step="1"
                value={formatReinforcementQuantity(pos.quantity)}
                onChange={(e) => onUpdatePositionQuantity(item.id, pos.id, parseFloat(e.target.value) || 0)}
                className="input-field w-[80px] text-right ml-auto"
              />
            </TableCell>
            <TableCell className="text-muted-foreground">{item.unit}</TableCell>
            <TableCell className="text-right text-muted-foreground pr-2">
              {item.rate.toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatPrice(roundedPosQty * item.rate)}
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
