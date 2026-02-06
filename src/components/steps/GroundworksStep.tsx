import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Shovel, HardHat, Info, AlertCircle, Wrench, Building, Save, Check, Droplets, Thermometer } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { 
  ExcavationSettings, 
  ExcavationData, 
  calculateExcavation,
  FloorInsulationType,
  WallInsulationType,
  floorInsulationLabels,
  wallInsulationLabels,
  floorInsulationThickness,
  wallInsulationThickness,
} from '@/types/offers';
import { formatPrice } from '@/lib/calculations';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  useReinforcement, 
  ReinforcementControls, 
  ReinforcementTableRows, 
  ReinforcementData,
  calculateTotalBlocks,
  calculateCrownConcreteVolume,
  calculateColumnsConcreteVolume,
  calculateBlockLayers,
  BLOCK_DIMENSIONS,
  BlockHeight,
} from '@/components/groundworks/ReinforcementSection';
import Pool2DPreview, { CustomColumnCounts, calculateDefaultColumnCounts, getTotalColumnCount } from '@/components/Pool2DPreview';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { defaultConstructionMaterialRates, ConstructionMaterialRates } from '@/types/configurator';

// Helper function to round quantities based on material type
function roundQuantity(id: string, quantity: number): number {
  // Podsypka i betony - zaokrąglaj do 0.5
  if (['podsypka', 'chudziak', 'plyta_denna', 'beton_wieniec', 'beton_brodzik', 'beton_schody'].includes(id)) {
    return Math.ceil(quantity * 2) / 2;
  }
  // Bloczki, pompogruszka, zbrojenie, strzemiona - zaokrąglaj do jedności
  if (['bloczek', 'pompogruszka'].includes(id)) {
    return Math.ceil(quantity);
  }
  return quantity;
}

// Format quantity for display - hide decimals for integers
function formatQuantity(id: string, quantity: number): string {
  const rounded = roundQuantity(id, quantity);
  // If it's a whole number, show without decimals
  if (Number.isInteger(rounded)) {
    return rounded.toString();
  }
  // Otherwise show with appropriate decimals (max 2)
  return rounded.toFixed(rounded % 1 === 0.5 ? 1 : 2).replace(/\.?0+$/, '');
}

interface GroundworksStepProps {
  onNext: () => void;
  onBack: () => void;
  excavationSettings: ExcavationSettings;
}

type ScopeType = 'our' | 'investor';
type UnitType = 'm3' | 'ryczalt';
type VatRate = 0 | 8 | 23;

interface ExcavationLineItem {
  id: string;
  name: string;
  quantity: number;
  unit: UnitType;
  rate: number;
  netValue: number;
  hidden?: boolean; // For items that should be hidden when disabled
  groupId?: string; // For grouped items (e.g., 'piasek')
  customOverride?: boolean; // For manual quantity override
}

export function GroundworksStep({ onNext, onBack, excavationSettings }: GroundworksStepProps) {
  const { state, dispatch } = useConfigurator();
  const { setExcavationSettings, companySettings, setCompanySettings } = useSettings();
  const { dimensions, sections } = state;
  
  // Get material rates from settings (with fallback to defaults)
  const materialRates = companySettings.constructionMaterialRates || defaultConstructionMaterialRates;
  
  // Excavation state - editable dimensions
  const [excavationScope, setExcavationScope] = useState<ScopeType>(
    (sections.roboty_ziemne?.scope as ScopeType) || 'our'
  );
  
  // Editable excavation dimensions
  const [excLength, setExcLength] = useState(() => 
    dimensions.length + (excavationSettings.marginWidth * 2)
  );
  const [excWidth, setExcWidth] = useState(() => 
    dimensions.width + (excavationSettings.marginWidth * 2)
  );
  
  // Material heights (editable) - moved up for excavation depth calculation
  const [sandBeddingHeight, setSandBeddingHeight] = useState(0.1); // 10cm default
  const [leanConcreteHeight, setLeanConcreteHeight] = useState(0.1); // 10cm default
  const [floorSlabThickness, setFloorSlabThickness] = useState(0.2); // 20cm default
  
  // Insulation state
  const [floorInsulation, setFloorInsulation] = useState<FloorInsulationType>('none');
  const [wallInsulation, setWallInsulation] = useState<WallInsulationType>('none');
  
  // Calculate excavation depth using correct formula:
  // excDepth = pool depth + floor slab + floor insulation + lean concrete + sand bedding
  const floorInsThickness = floorInsulationThickness[floorInsulation];
  const wallInsThickness = wallInsulationThickness[wallInsulation];
  
  const [excDepth, setExcDepth] = useState(() => 
    Math.round((dimensions.depth + floorSlabThickness + floorInsThickness + leanConcreteHeight + sandBeddingHeight) * 100) / 100
  );
  
  // Update excavation depth when components change
  useEffect(() => {
    const newDepth = dimensions.depth + floorSlabThickness + floorInsulationThickness[floorInsulation] + leanConcreteHeight + sandBeddingHeight;
    setExcDepth(Math.round(newDepth * 100) / 100);
  }, [dimensions.depth, floorSlabThickness, floorInsulation, leanConcreteHeight, sandBeddingHeight]);
  
  // Drainage toggle
  const [drainageEnabled, setDrainageEnabled] = useState(false);
  const [reusePercent, setReusePercent] = useState(0);
  const [sandGroupExpanded, setSandGroupExpanded] = useState(false);
  
  // Track rate changes that need confirmation (instead of immediate dialog)
  const [changedExcavationRates, setChangedExcavationRates] = useState<Record<string, number>>({});
  const [changedMaterialRates, setChangedMaterialRates] = useState<Record<string, number>>({});
  
  // Dialog state for excavation rate changes
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [pendingExcavationRateChange, setPendingExcavationRateChange] = useState<{
    itemId: string;
    itemName: string;
    oldRate: number;
    newRate: number;
    rateKey: 'pricePerM3' | 'removalFixedPrice' | 'podsypkaRate' | 'drainageRate' | 'backfillRate';
  } | null>(null);
  
  // Material rate change dialog state
  const [showMaterialRateDialog, setShowMaterialRateDialog] = useState(false);
  const [pendingRateChange, setPendingRateChange] = useState<{
    materialId: string;
    materialName: string;
    oldRate: number;
    newRate: number;
    rateKey: keyof ConstructionMaterialRates;
  } | null>(null);
  
  // customQuantityOverride removed - now using per-item customOverride on ExcavationLineItem
  // VAT selection
  const [vatRate, setVatRate] = useState<VatRate>(23);
  
  // Calculate drainage perimeter (external excavation perimeter)
  const drainagePerimeter = 2 * (excLength + excWidth);
  
  // Line items
  const [lineItems, setLineItems] = useState<ExcavationLineItem[]>(() => {
    const volume = excLength * excWidth * excDepth;
    const excavationArea = excLength * excWidth;
    const podsypkaQty = excavationArea * 0.1; // 10cm default
    return [
      {
        id: 'wykop',
        name: 'Wykop-koparka',
        quantity: volume,
        unit: 'm3' as UnitType,
        rate: excavationSettings.pricePerM3,
        netValue: volume * excavationSettings.pricePerM3,
      },
      {
        id: 'wywoz',
        name: 'Wywóz ziemi',
        quantity: volume,
        unit: 'm3' as UnitType,
        rate: excavationSettings.removalFixedPrice,
        netValue: volume * excavationSettings.removalFixedPrice,
      },
      {
        id: 'podsypka',
        name: 'Podsypka',
        quantity: podsypkaQty,
        unit: 'm3' as UnitType,
        rate: excavationSettings.podsypkaRate || 150,
        netValue: podsypkaQty * (excavationSettings.podsypkaRate || 150),
        groupId: 'piasek',
      },
      {
        id: 'piasek_zasypka',
        name: 'Piasek do zasypu',
        quantity: 0,
        unit: 'm3' as UnitType,
        rate: excavationSettings.podsypkaRate || 150,
        netValue: 0,
        groupId: 'piasek',
      },
      {
        id: 'drenaz',
        name: 'Drenaż opaskowy',
        quantity: 2 * (excLength + excWidth),
        unit: 'm3' as UnitType,
        rate: excavationSettings.drainageRate || 220,
        netValue: 2 * (excLength + excWidth) * (excavationSettings.drainageRate || 220),
        hidden: true,
      },
    ];
  });

  // Construction state
  const [constructionScope, setConstructionScope] = useState<ScopeType>(
    (sections.prace_budowlane?.scope as ScopeType) || 'our'
  );
  const [constructionNotes, setConstructionNotes] = useState('');
  const [constructionCost, setConstructionCost] = useState(0);
  
  // Construction technology type
  type ConstructionTechnology = 'masonry' | 'poured';
  const [constructionTechnology, setConstructionTechnology] = useState<ConstructionTechnology>('masonry');
  
  // Block height selection (12cm or 14cm)
  const [blockHeight, setBlockHeight] = useState<BlockHeight>(14);
  
  // Wading pool slab thickness (płyta brodzika) - calculated like block layers but no crown
  const [wadingPoolSlabHeight, setWadingPoolSlabHeight] = useState<number>(0.20);
  const [wadingPoolSlabOverride, setWadingPoolSlabOverride] = useState(false);
  
  // (Material heights moved up to line 117-120 for excavation depth calculation)
  
  // Block layer calculation (only for masonry technology)
  const [customBlockLayers, setCustomBlockLayers] = useState<number | undefined>(undefined);
  const [customCrownHeight, setCustomCrownHeight] = useState<number | undefined>(undefined);
  
  // Custom column counts for manual override
  const [customColumnCounts, setCustomColumnCounts] = useState<CustomColumnCounts | undefined>(undefined);
  
  // Calculate default column counts based on dimensions
  const defaultColumnCounts = useMemo(() => 
    calculateDefaultColumnCounts(dimensions.length, dimensions.width), 
    [dimensions.length, dimensions.width]
  );
  
  // Current effective column counts (custom or default)
  const effectiveColumnCounts = customColumnCounts ?? defaultColumnCounts;
  const totalColumnCount = getTotalColumnCount(effectiveColumnCounts);
  
  // Calculate block data based on pool dimensions
  const blockCalculation = useMemo(() => {
    if (constructionTechnology !== 'masonry') return null;
    return calculateTotalBlocks(
      dimensions.length,
      dimensions.width,
      dimensions.depth,
      customBlockLayers,
      customCrownHeight,
      totalColumnCount,
      blockHeight
    );
  }, [dimensions.length, dimensions.width, dimensions.depth, constructionTechnology, customBlockLayers, customCrownHeight, totalColumnCount, blockHeight]);
  
  // Calculate wading pool blocks (2 non-shared walls: width + length)
  const wadingPoolBlockCalc = useMemo(() => {
    if (!dimensions.wadingPool?.enabled || constructionTechnology !== 'masonry') return null;
    return calculateBlockLayers(dimensions.wadingPool.depth, blockHeight);
  }, [dimensions.wadingPool?.enabled, dimensions.wadingPool?.depth, constructionTechnology, blockHeight]);
  
  const wadingPoolBlocks = useMemo(() => {
    if (!wadingPoolBlockCalc || !dimensions.wadingPool?.enabled) return 0;
    const wp = dimensions.wadingPool;
    const innerPerimeter = (wp.width || 0) + (wp.length || 0); // 2 non-shared walls
    const blocksPerLayer = Math.ceil(innerPerimeter / BLOCK_DIMENSIONS.length);
    return wadingPoolBlockCalc.layers * blocksPerLayer;
  }, [wadingPoolBlockCalc, dimensions.wadingPool]);
  
  // Auto-update wading pool slab height when not manually overridden
  useEffect(() => {
    if (wadingPoolBlockCalc && !wadingPoolSlabOverride) {
      setWadingPoolSlabHeight(wadingPoolBlockCalc.crownHeight);
    }
  }, [wadingPoolBlockCalc, wadingPoolSlabOverride]);
  
  // Calculate stairs blocks (total step meters / block length)
  const stairsBlocks = useMemo(() => {
    if (!dimensions.stairs?.enabled || constructionTechnology !== 'masonry') return 0;
    const s = dimensions.stairs;
    const stairsWidth = s.width === 'full' 
      ? (s.wall === 'back' || s.wall === 'front' ? dimensions.length : dimensions.width)
      : (Number(s.width) || 0);
    const totalStepMeters = (s.stepCount || 0) * stairsWidth;
    return Math.ceil(totalStepMeters / BLOCK_DIMENSIONS.length);
  }, [dimensions.stairs, dimensions.length, dimensions.width, constructionTechnology]);
  
  // Reset custom values when pool dimensions change
  useEffect(() => {
    setCustomBlockLayers(undefined);
    setCustomCrownHeight(undefined);
    setCustomColumnCounts(undefined);
  }, [dimensions.depth, dimensions.length, dimensions.width]);
  
  // Calculate excavation area (for material calculations)
  const excavationArea = excLength * excWidth;
  const excavationVolume = excLength * excWidth * excDepth;
  
  // Calculate floor slab area: pool dimensions + 24cm on each side
  const floorSlabArea = (dimensions.length + 0.48) * (dimensions.width + 0.48);
  
  // Calculate backfill (zasypka) volume:
  // Zasypka = Excavation Volume - Sand Bedding - Construction Volume (external with insulation)
  const backfillVolume = useMemo(() => {
    const wallThickness = BLOCK_DIMENSIONS.width; // 0.24m
    
    // External dimensions of construction (pool + walls + insulation)
    const extLength = dimensions.length + (wallThickness * 2) + (wallInsThickness * 2);
    const extWidth = dimensions.width + (wallThickness * 2) + (wallInsThickness * 2);
    // Height: pool depth + floor slab + lean concrete + floor insulation
    const extHeight = dimensions.depth + floorSlabThickness + leanConcreteHeight + floorInsThickness;
    
    const constructionVolume = extLength * extWidth * extHeight;
    const podsypkaVolume = excavationArea * sandBeddingHeight;
    
    return Math.max(0, excavationVolume - podsypkaVolume - constructionVolume);
  }, [dimensions.length, dimensions.width, dimensions.depth, wallInsThickness, floorInsThickness, floorSlabThickness, leanConcreteHeight, excavationVolume, excavationArea, sandBeddingHeight]);
  
  // Construction VAT
  const [constructionVatRate, setConstructionVatRate] = useState<VatRate>(23);
  
  // Construction material line items
  interface ConstructionMaterialItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    rate: number;
    netValue: number;
    customOverride?: boolean; // Mark if user manually changed quantity
  }
  
  // Grouped material items (like B25 concrete)
  interface GroupedMaterialItem {
    id: string;
    groupName: string;
    unit: string;
    rate: number;
    isExpanded: boolean;
    subItems: {
      id: string;
      name: string;
      quantity: number;
      customOverride?: boolean;
    }[];
  }
  
  // Calculate pompogruszki quantity: 3 base + 1 for stairs + 1 for wading pool
  const pompogruszkaBaseQty = 3;
  const pompogruszkaStairsBonus = dimensions.stairs?.enabled ? 1 : 0;
  const pompogruszkaWadingBonus = dimensions.wadingPool?.enabled ? 1 : 0;
  const pompogruszkaQty = pompogruszkaBaseQty + pompogruszkaStairsBonus + pompogruszkaWadingBonus;
  
  const [constructionMaterials, setConstructionMaterials] = useState<ConstructionMaterialItem[]>(() => {
    const baseItems: ConstructionMaterialItem[] = [
      {
        id: 'chudziak',
        name: 'Beton na chudziak B15',
        quantity: excavationArea * leanConcreteHeight,
        unit: 'm³',
        rate: materialRates.betonB15,
        netValue: excavationArea * leanConcreteHeight * materialRates.betonB15,
        customOverride: false,
      },
      {
        id: 'pompogruszka',
        name: 'Pompogruszka',
        quantity: pompogruszkaQty,
        unit: 'szt.',
        rate: materialRates.pompogruszka,
        netValue: pompogruszkaQty * materialRates.pompogruszka,
        customOverride: false,
      },
    ];
    return baseItems;
  });
  
  // Grouped B25 concrete (plyta denna + wieniec + slupy for masonry)
  const [b25ConcreteGroup, setB25ConcreteGroup] = useState<GroupedMaterialItem>({
    id: 'beton_b25_group',
    groupName: 'Beton B25',
    unit: 'm³',
    rate: materialRates.betonB25,
    isExpanded: false,
    subItems: [
      { id: 'plyta_denna', name: 'Płyta denna', quantity: Math.ceil(floorSlabArea * floorSlabThickness), customOverride: false },
    ],
  });
  
  // Grouped block item (bloczki: basen + brodzik + schody)
  const [blockGroup, setBlockGroup] = useState<GroupedMaterialItem>({
    id: 'block_group',
    groupName: `Bloczek betonowy 38×24×${blockHeight}`,
    unit: 'szt.',
    rate: materialRates.bloczek,
    isExpanded: false,
    subItems: [
      { id: 'bloczek_basen', name: 'Basen', quantity: 0, customOverride: false },
    ],
  });
  
  // Reinforcement hook
  const reinforcement = useReinforcement(dimensions, floorSlabThickness, constructionTechnology, materialRates);
  
  // Update construction materials when dimensions, heights, or block calculation changes
  useEffect(() => {
    const currentPompogruszkaQty = pompogruszkaBaseQty + 
      (dimensions.stairs?.enabled ? 1 : 0) + 
      (dimensions.wadingPool?.enabled ? 1 : 0);
    
    setConstructionMaterials(prev => {
      // Update existing items - skip ones with customOverride
      let updated = prev.map(item => {
        if (item.customOverride) return item;
        
        if (item.id === 'chudziak') {
          const qty = excavationArea * leanConcreteHeight;
          return { ...item, quantity: qty, netValue: qty * item.rate };
        }
        if (item.id === 'pompogruszka') {
          return { ...item, quantity: currentPompogruszkaQty, netValue: currentPompogruszkaQty * item.rate };
        }
        return item;
      });
      
      // Remove bloczek from flat list (now handled by blockGroup)
      updated = updated.filter(item => item.id !== 'bloczek');
      
      return updated;
    });
    
    // Update block group sub-items
    if (constructionTechnology === 'masonry') {
      setBlockGroup(prev => {
        const newSubItems: GroupedMaterialItem['subItems'] = [];
        
        // Pool blocks (always present for masonry)
        const existingBasen = prev.subItems.find(s => s.id === 'bloczek_basen');
        newSubItems.push({
          id: 'bloczek_basen',
          name: 'Basen',
          quantity: existingBasen?.customOverride ? existingBasen.quantity : (blockCalculation?.totalBlocks || 0),
          customOverride: existingBasen?.customOverride || false,
        });
        
        // Wading pool blocks (when enabled)
        if (dimensions.wadingPool?.enabled) {
          const existingWP = prev.subItems.find(s => s.id === 'bloczek_brodzik');
          newSubItems.push({
            id: 'bloczek_brodzik',
            name: 'Brodzik',
            quantity: existingWP?.customOverride ? existingWP.quantity : wadingPoolBlocks,
            customOverride: existingWP?.customOverride || false,
          });
        }
        
        // Stairs blocks (when enabled)
        if (dimensions.stairs?.enabled) {
          const existingStairs = prev.subItems.find(s => s.id === 'bloczek_schody');
          newSubItems.push({
            id: 'bloczek_schody',
            name: 'Schody',
            quantity: existingStairs?.customOverride ? existingStairs.quantity : stairsBlocks,
            customOverride: existingStairs?.customOverride || false,
          });
        }
        
        return { ...prev, groupName: `Bloczek betonowy 38×24×${blockHeight}`, subItems: newSubItems };
      });
    }
  }, [excavationArea, leanConcreteHeight, dimensions.stairs?.enabled, dimensions.wadingPool?.enabled, constructionTechnology, blockCalculation, blockHeight, wadingPoolBlocks, stairsBlocks]);
  
  // Update podsypka, piasek_zasypka, drenaz, and zakopanie in lineItems when excavation dimensions change
  useEffect(() => {
    const podsypkaQty = excavationArea * sandBeddingHeight;
    const drainageQty = 2 * (excLength + excWidth);
    const reusedVolume = backfillVolume * (reusePercent / 100);
    const sandForBackfill = Math.max(0, backfillVolume - reusedVolume);
    
    setLineItems(prev => {
      const updated = prev.map(item => {
        if (item.id === 'podsypka' && !item.customOverride) {
          return { ...item, quantity: podsypkaQty, netValue: podsypkaQty * item.rate };
        }
        if (item.id === 'piasek_zasypka' && !item.customOverride) {
          return { ...item, quantity: sandForBackfill, netValue: sandForBackfill * item.rate };
        }
        if (item.id === 'drenaz' && !item.customOverride) {
          return { ...item, quantity: drainageQty, netValue: drainageQty * item.rate, hidden: !drainageEnabled };
        } else if (item.id === 'drenaz' && item.customOverride) {
          return { ...item, hidden: !drainageEnabled };
        }
        if (item.id === 'zakopanie' && !item.customOverride) {
          return { ...item, quantity: backfillVolume, netValue: backfillVolume * item.rate };
        }
        return item;
      });
      
      // Add zakopanie if not present
      if (!updated.find(item => item.id === 'zakopanie')) {
        const backfillRate = excavationSettings.backfillRate ?? excavationSettings.pricePerM3;
        updated.push({
          id: 'zakopanie',
          name: 'Zakopanie-koparka',
          quantity: backfillVolume,
          unit: 'm3' as UnitType,
          rate: backfillRate,
          netValue: backfillVolume * backfillRate,
        });
      }
      
      return updated;
    });
  }, [excavationArea, sandBeddingHeight, excLength, excWidth, drainageEnabled, backfillVolume, reusePercent, excavationSettings.backfillRate, excavationSettings.pricePerM3]);

  // Update B25 concrete group when dimensions change
  useEffect(() => {
    // Calculate floor slab volume
    const floorSlabVolume = floorSlabArea * floorSlabThickness;
    
    // Calculate crown concrete volume (only for masonry technology)
    const crownConcreteVolume = blockCalculation 
      ? calculateCrownConcreteVolume(dimensions.length, dimensions.width, blockCalculation.crownHeight)
      : 0;
    
    // Calculate columns concrete volume (only for masonry technology)
    const columnsConcreteData = blockCalculation 
      ? calculateColumnsConcreteVolume(dimensions.length, dimensions.width, dimensions.depth, blockCalculation.crownHeight, totalColumnCount)
      : { volume: 0, columnCount: 0 };
    
    setB25ConcreteGroup(prev => {
      const newSubItems: GroupedMaterialItem['subItems'] = [];
      
      // Floor slab always present
      const existingFloor = prev.subItems.find(s => s.id === 'plyta_denna');
      newSubItems.push({
        id: 'plyta_denna',
        name: 'Płyta denna',
        quantity: existingFloor?.customOverride ? existingFloor.quantity : floorSlabVolume,
        customOverride: existingFloor?.customOverride || false,
      });
      
      // Crown and columns only for masonry
      if (constructionTechnology === 'masonry' && blockCalculation) {
        const existingCrown = prev.subItems.find(s => s.id === 'beton_wieniec');
        newSubItems.push({
          id: 'beton_wieniec',
          name: 'Wieniec',
          quantity: existingCrown?.customOverride ? existingCrown.quantity : crownConcreteVolume,
          customOverride: existingCrown?.customOverride || false,
        });
        
        const existingColumns = prev.subItems.find(s => s.id === 'beton_slupy');
        newSubItems.push({
          id: 'beton_slupy',
          name: `Słupy (${columnsConcreteData.columnCount} szt.)`,
          quantity: existingColumns?.customOverride ? existingColumns.quantity : columnsConcreteData.volume,
          customOverride: existingColumns?.customOverride || false,
        });
      }
      
      // Wading pool concrete (when enabled) - uses wadingPoolSlabHeight instead of floorSlabThickness
      if (dimensions.wadingPool?.enabled) {
        const wpVolume = (dimensions.wadingPool.width || 0) * (dimensions.wadingPool.length || 0) * wadingPoolSlabHeight;
        const existingWP = prev.subItems.find(s => s.id === 'beton_brodzik');
        newSubItems.push({
          id: 'beton_brodzik',
          name: 'Brodzik',
          quantity: existingWP?.customOverride ? existingWP.quantity : wpVolume,
          customOverride: existingWP?.customOverride || false,
        });
      }
      
      // Stairs concrete (when enabled)
      if (dimensions.stairs?.enabled) {
        const s = dimensions.stairs;
        const stairsArea = (Number(s.width) || 0) * (Number(s.stepCount) || 0) * (Number(s.stepDepth) || 0);
        const stairsVolume = stairsArea * floorSlabThickness;
        const existingStairs = prev.subItems.find(s => s.id === 'beton_schody');
        newSubItems.push({
          id: 'beton_schody',
          name: 'Schody',
          quantity: existingStairs?.customOverride ? existingStairs.quantity : stairsVolume,
          customOverride: existingStairs?.customOverride || false,
        });
      }
      
      return { ...prev, subItems: newSubItems };
    });
  }, [floorSlabArea, floorSlabThickness, constructionTechnology, blockCalculation, dimensions.length, dimensions.width, dimensions.depth, totalColumnCount, dimensions.wadingPool, dimensions.stairs, wadingPoolSlabHeight]);
  
  // Calculate expected values for reset functionality
  const getExpectedMaterialQuantity = useCallback((id: string): number => {
    const currentPompogruszkaQty = pompogruszkaBaseQty + 
      (dimensions.stairs?.enabled ? 1 : 0) + 
      (dimensions.wadingPool?.enabled ? 1 : 0);
    
    switch (id) {
      case 'podsypka':
        return excavationArea * sandBeddingHeight;
      case 'chudziak':
        return excavationArea * leanConcreteHeight;
      case 'pompogruszka':
        return currentPompogruszkaQty;
      // bloczek is now in blockGroup, not in constructionMaterials
      default:
        return 0;
    }
  }, [excavationArea, sandBeddingHeight, leanConcreteHeight, dimensions.stairs?.enabled, dimensions.wadingPool?.enabled, blockCalculation, wadingPoolBlocks, stairsBlocks]);

  const getExpectedB25SubItemQuantity = useCallback((subItemId: string): number => {
    const crownConcreteVolume = blockCalculation 
      ? calculateCrownConcreteVolume(dimensions.length, dimensions.width, blockCalculation.crownHeight)
      : 0;
    
    const columnsConcreteData = blockCalculation 
      ? calculateColumnsConcreteVolume(dimensions.length, dimensions.width, dimensions.depth, blockCalculation.crownHeight, totalColumnCount)
      : { volume: 0, columnCount: 0 };
    
    switch (subItemId) {
      case 'plyta_denna':
        return floorSlabArea * floorSlabThickness;
      case 'beton_wieniec':
        return crownConcreteVolume;
      case 'beton_slupy':
        return columnsConcreteData.volume;
      case 'beton_brodzik':
        return dimensions.wadingPool?.enabled 
          ? (dimensions.wadingPool.width || 0) * (dimensions.wadingPool.length || 0) * wadingPoolSlabHeight 
          : 0;
      case 'beton_schody': {
        if (!dimensions.stairs?.enabled) return 0;
        const s = dimensions.stairs;
        return (Number(s.width) || 0) * (Number(s.stepCount) || 0) * (Number(s.stepDepth) || 0) * floorSlabThickness;
      }
      default:
        return 0;
    }
  }, [floorSlabArea, floorSlabThickness, blockCalculation, dimensions.length, dimensions.width, dimensions.depth, dimensions.wadingPool, dimensions.stairs, wadingPoolSlabHeight]);

  // Helper to get rate key from material id (construction materials only)
  const getMaterialRateKey = (id: string): keyof ConstructionMaterialRates | null => {
    switch (id) {
      case 'chudziak': return 'betonB15';
      case 'pompogruszka': return 'pompogruszka';
      // bloczek is now in blockGroup with its own rate handling
      default: return null;
    }
  };

  // Update construction material
  const updateConstructionMaterial = (id: string, field: keyof ConstructionMaterialItem, value: any) => {
    setConstructionMaterials(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity') {
        updated.customOverride = true; // Mark as manually changed
        updated.netValue = updated.quantity * updated.rate;
      }
      if (field === 'rate') {
        updated.netValue = updated.quantity * updated.rate;
        // Track that rate was changed (don't open dialog immediately)
        const rateKey = getMaterialRateKey(id);
        if (rateKey) {
          if (value !== materialRates[rateKey]) {
            setChangedMaterialRates(prev => ({ ...prev, [id]: value }));
          } else {
            // Rate matches default, remove from changed list
            setChangedMaterialRates(prev => {
              const { [id]: _, ...rest } = prev;
              return rest;
            });
          }
        }
      }
      return updated;
    }));
  };
  
  // Confirm material rate change - opens dialog
  const confirmMaterialRateChange = (id: string, itemName: string) => {
    const rateKey = getMaterialRateKey(id);
    const newRate = changedMaterialRates[id];
    if (rateKey && newRate !== undefined) {
      setPendingRateChange({
        materialId: id,
        materialName: itemName,
        oldRate: materialRates[rateKey],
        newRate,
        rateKey,
      });
      setShowMaterialRateDialog(true);
    }
  };

  // Reset construction material to calculated value
  const resetConstructionMaterialQuantity = (id: string) => {
    const expectedQty = getExpectedMaterialQuantity(id);
    setConstructionMaterials(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { 
        ...item, 
        quantity: expectedQty, 
        customOverride: false,
        netValue: expectedQty * item.rate 
      };
    }));
  };
  
  // Update B25 group sub-item quantity
  const updateB25SubItemQuantity = (subItemId: string, newQuantity: number) => {
    setB25ConcreteGroup(prev => ({
      ...prev,
      subItems: prev.subItems.map(item => 
        item.id === subItemId 
          ? { ...item, quantity: newQuantity, customOverride: true }
          : item
      ),
    }));
  };

  // Reset B25 sub-item to calculated value
  const resetB25SubItemQuantity = (subItemId: string) => {
    const expectedQty = getExpectedB25SubItemQuantity(subItemId);
    setB25ConcreteGroup(prev => ({
      ...prev,
      subItems: prev.subItems.map(item => 
        item.id === subItemId 
          ? { ...item, quantity: expectedQty, customOverride: false }
          : item
      ),
    }));
  };
  
  // Update B25 group rate
  const updateB25Rate = (newRate: number) => {
    setB25ConcreteGroup(prev => ({ ...prev, rate: newRate }));
    // Track that rate was changed (don't open dialog immediately)
    if (newRate !== materialRates.betonB25) {
      setChangedMaterialRates(prev => ({ ...prev, 'beton_b25_group': newRate }));
    } else {
      setChangedMaterialRates(prev => {
        const { 'beton_b25_group': _, ...rest } = prev;
        return rest;
      });
    }
  };
  
  // Confirm B25 rate change - opens dialog
  const confirmB25RateChange = () => {
    const newRate = changedMaterialRates['beton_b25_group'];
    if (newRate !== undefined) {
      setPendingRateChange({
        materialId: 'beton_b25_group',
        materialName: 'Beton B25',
        oldRate: materialRates.betonB25,
        newRate,
        rateKey: 'betonB25',
      });
      setShowMaterialRateDialog(true);
    }
  };
  
  // Handle save rate to global settings
  const handleSaveMaterialRateToSettings = async () => {
    if (!pendingRateChange) return;
    const updatedRates = { ...materialRates, [pendingRateChange.rateKey]: pendingRateChange.newRate };
    await setCompanySettings({
      ...companySettings,
      constructionMaterialRates: updatedRates,
    });
    toast.success(`Stawka dla "${pendingRateChange.materialName}" zapisana w ustawieniach`);
    // Remove from changed rates tracking
    setChangedMaterialRates(prev => {
      const { [pendingRateChange.materialId]: _, ...rest } = prev;
      return rest;
    });
    setShowMaterialRateDialog(false);
    setPendingRateChange(null);
  };
  
  // Keep rate only for this offer
  const handleKeepMaterialRateLocal = () => {
    // Remove from changed rates tracking (user confirmed it's just for this offer)
    if (pendingRateChange) {
      setChangedMaterialRates(prev => {
        const { [pendingRateChange.materialId]: _, ...rest } = prev;
        return rest;
      });
    }
    setShowMaterialRateDialog(false);
    setPendingRateChange(null);
  };
  
  // Toggle B25 group expand
  const toggleB25Expand = () => {
    setB25ConcreteGroup(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  };
  
  // Toggle block group expand
  const toggleBlockGroupExpand = () => {
    setBlockGroup(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  };
  
  // Update block group sub-item quantity
  const updateBlockSubItemQuantity = (subItemId: string, newQuantity: number) => {
    setBlockGroup(prev => ({
      ...prev,
      subItems: prev.subItems.map(item => 
        item.id === subItemId 
          ? { ...item, quantity: newQuantity, customOverride: true }
          : item
      ),
    }));
  };
  
  // Reset block sub-item to calculated value
  const getExpectedBlockSubItemQuantity = useCallback((subItemId: string): number => {
    switch (subItemId) {
      case 'bloczek_basen': return blockCalculation?.totalBlocks || 0;
      case 'bloczek_brodzik': return wadingPoolBlocks;
      case 'bloczek_schody': return stairsBlocks;
      default: return 0;
    }
  }, [blockCalculation, wadingPoolBlocks, stairsBlocks]);
  
  const resetBlockSubItemQuantity = (subItemId: string) => {
    const expectedQty = getExpectedBlockSubItemQuantity(subItemId);
    setBlockGroup(prev => ({
      ...prev,
      subItems: prev.subItems.map(item => 
        item.id === subItemId 
          ? { ...item, quantity: expectedQty, customOverride: false }
          : item
      ),
    }));
  };
  
  // Update block group rate
  const updateBlockGroupRate = (newRate: number) => {
    setBlockGroup(prev => ({ ...prev, rate: newRate }));
    if (newRate !== materialRates.bloczek) {
      setChangedMaterialRates(prev => ({ ...prev, 'block_group': newRate }));
    } else {
      setChangedMaterialRates(prev => {
        const { 'block_group': _, ...rest } = prev;
        return rest;
      });
    }
  };
  
  // Confirm block group rate change
  const confirmBlockGroupRateChange = () => {
    const newRate = changedMaterialRates['block_group'];
    if (newRate !== undefined) {
      setPendingRateChange({
        materialId: 'block_group',
        materialName: `Bloczek betonowy 38×24×${blockHeight}`,
        oldRate: materialRates.bloczek,
        newRate,
        rateKey: 'bloczek',
      });
      setShowMaterialRateDialog(true);
    }
  };
  
  // Block group totals
  const blockGroupTotalQuantity = blockGroup.subItems.reduce((sum, item) => sum + item.quantity, 0);
  const blockGroupTotalRounded = Math.ceil(blockGroupTotalQuantity);
  const blockGroupTotalNet = blockGroupTotalRounded * blockGroup.rate;
  
  // Helper to get reinforcement rate key from item id
  const getReinforcementRateKey = (itemId: string): keyof ConstructionMaterialRates | null => {
    switch (itemId) {
      case 'rebar_12mm': return 'zbrojenie12mm';
      case 'rebar_6mm': return 'zbrojenie6mm';
      case 'composite_8mm': return 'zbrojenieKompozytowe';
      case 'strzemiona': return 'strzemiona';
      default: return null;
    }
  };

  // Wrapper for reinforcement rate update with dialog prompt
  const handleReinforcementRateChange = (itemId: string, newRate: number) => {
    // First update the item rate in reinforcement hook
    reinforcement.updateItemRate(itemId, newRate);
    
    // Track that rate was changed (don't open dialog immediately)
    const rateKey = getReinforcementRateKey(itemId);
    if (rateKey) {
      if (newRate !== materialRates[rateKey]) {
        setChangedMaterialRates(prev => ({ ...prev, [itemId]: newRate }));
      } else {
        setChangedMaterialRates(prev => {
          const { [itemId]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };
  
  // Confirm reinforcement rate change - opens dialog
  const confirmReinforcementRateChange = (itemId: string) => {
    const rateKey = getReinforcementRateKey(itemId);
    const newRate = changedMaterialRates[itemId];
    const item = reinforcement.items.find(i => i.id === itemId);
    if (rateKey && newRate !== undefined && item) {
      setPendingRateChange({
        materialId: itemId,
        materialName: item.name,
        oldRate: materialRates[rateKey],
        newRate,
        rateKey,
      });
      setShowMaterialRateDialog(true);
    }
  };
  
  // Calculate B25 total quantity (sum of sub-items, rounded to 0.5)
  const b25TotalQuantity = b25ConcreteGroup.subItems.reduce((sum, item) => sum + item.quantity, 0);
  const b25TotalRounded = Math.ceil(b25TotalQuantity * 2) / 2;
  const b25TotalNet = b25TotalRounded * b25ConcreteGroup.rate;
  
  // ============ LABOR COST SECTION ============
  // Use rates from settings (with fallback to defaults)
  const LABOR_BASE_RATE = materialRates.laborPoolRate ?? 700; // PLN/m²
  const LABOR_STAIRS_RATE = materialRates.laborStairsRate ?? 1000; // PLN/m²
  const LABOR_WADING_RATE = materialRates.laborWadingRate ?? 1000; // PLN/m²
  
  // Pool floor area (length * width)
  const poolFloorArea = Math.round(dimensions.length * dimensions.width);
  
  // Stairs projection area
  const stairsProjectionArea = useMemo(() => {
    const s = dimensions.stairs;
    if (!s?.enabled) return 0;
    const w = Number(s.width) || 0;
    const sc = Number(s.stepCount) || 0;
    const sd = Number(s.stepDepth) || 0;
    return w * sc * sd;
  }, [dimensions.stairs]);
  
  // Wading pool area
  const wadingPoolProjectionArea = useMemo(() => {
    const wp = dimensions.wadingPool;
    if (!wp?.enabled) return 0;
    return (wp.width || 0) * (wp.length || 0);
  }, [dimensions.wadingPool]);
  
  type LaborUnitType = 'm2' | 'ryczalt';
  
  interface LaborLineItem {
    id: string;
    name: string;
    quantity: number;
    unit: LaborUnitType;
    rate: number;
    netValue: number;
    customOverride?: boolean;
    hidden?: boolean;
  }
  
  const [laborItems, setLaborItems] = useState<LaborLineItem[]>(() => [
    {
      id: 'labor_pool',
      name: 'Prace budowlane – basen',
      quantity: poolFloorArea,
      unit: 'm2',
      rate: LABOR_BASE_RATE,
      netValue: poolFloorArea * LABOR_BASE_RATE,
    },
    {
      id: 'labor_stairs',
      name: 'Prace budowlane – schody',
      quantity: stairsProjectionArea,
      unit: 'm2',
      rate: LABOR_STAIRS_RATE,
      netValue: stairsProjectionArea * LABOR_STAIRS_RATE,
      hidden: !dimensions.stairs?.enabled,
    },
    {
      id: 'labor_wading',
      name: 'Prace budowlane – brodzik',
      quantity: wadingPoolProjectionArea,
      unit: 'm2',
      rate: LABOR_WADING_RATE,
      netValue: wadingPoolProjectionArea * LABOR_WADING_RATE,
      hidden: !dimensions.wadingPool?.enabled,
    },
  ]);
  
  // Sync labor items when dimensions change
  useEffect(() => {
    setLaborItems(prev => prev.map(item => {
      if (item.id === 'labor_pool' && !item.customOverride) {
        const qty = item.unit === 'ryczalt' ? 1 : poolFloorArea;
        return { ...item, quantity: qty, netValue: qty * item.rate };
      }
      if (item.id === 'labor_stairs') {
        const updated = { ...item, hidden: !dimensions.stairs?.enabled };
        if (!item.customOverride) {
          const qty = item.unit === 'ryczalt' ? 1 : stairsProjectionArea;
          updated.quantity = qty;
          updated.netValue = qty * item.rate;
        }
        return updated;
      }
      if (item.id === 'labor_wading') {
        const updated = { ...item, hidden: !dimensions.wadingPool?.enabled };
        if (!item.customOverride) {
          const qty = item.unit === 'ryczalt' ? 1 : wadingPoolProjectionArea;
          updated.quantity = qty;
          updated.netValue = qty * item.rate;
        }
        return updated;
      }
      return item;
    }));
  }, [poolFloorArea, stairsProjectionArea, wadingPoolProjectionArea, dimensions.stairs?.enabled, dimensions.wadingPool?.enabled]);
  
  // Helper to get labor rate key from item id
  const getLaborRateKey = (id: string): keyof ConstructionMaterialRates | null => {
    switch (id) {
      case 'labor_pool': return 'laborPoolRate';
      case 'labor_stairs': return 'laborStairsRate';
      case 'labor_wading': return 'laborWadingRate';
      default: return null;
    }
  };

  const updateLaborItem = (id: string, field: keyof LaborLineItem, value: any) => {
    setLaborItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity') {
        updated.customOverride = true;
        updated.netValue = updated.quantity * updated.rate;
      }
      if (field === 'rate') {
        updated.netValue = updated.quantity * updated.rate;
        // Track rate change for confirmation
        const rateKey = getLaborRateKey(id);
        if (rateKey) {
          if (value !== materialRates[rateKey]) {
            setChangedMaterialRates(prev => ({ ...prev, [id]: value }));
          } else {
            setChangedMaterialRates(prev => {
              const { [id]: _, ...rest } = prev;
              return rest;
            });
          }
        }
      }
      if (field === 'unit') {
        const newUnit = value as LaborUnitType;
        if (newUnit === 'ryczalt') {
          updated.quantity = 1;
          updated.netValue = updated.rate;
          updated.customOverride = false;
        } else {
          // Switch back to m² - recalculate from dimensions
          const expectedQty = getExpectedLaborQuantity(id);
          updated.quantity = expectedQty;
          updated.netValue = expectedQty * updated.rate;
          updated.customOverride = false;
        }
      }
      return updated;
    }));
  };

  // Confirm labor rate change - opens dialog
  const confirmLaborRateChange = (id: string) => {
    const rateKey = getLaborRateKey(id);
    const newRate = changedMaterialRates[id];
    const item = laborItems.find(i => i.id === id);
    if (rateKey && newRate !== undefined && item) {
      setPendingRateChange({
        materialId: id,
        materialName: item.name,
        oldRate: materialRates[rateKey],
        newRate,
        rateKey,
      });
      setShowMaterialRateDialog(true);
    }
  };
  
  const getExpectedLaborQuantity = useCallback((id: string): number => {
    switch (id) {
      case 'labor_pool': return poolFloorArea;
      case 'labor_stairs': return stairsProjectionArea;
      case 'labor_wading': return wadingPoolProjectionArea;
      default: return 0;
    }
  }, [poolFloorArea, stairsProjectionArea, wadingPoolProjectionArea]);
  
  const resetLaborItemQuantity = (id: string) => {
    const expectedQty = getExpectedLaborQuantity(id);
    setLaborItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, quantity: expectedQty, customOverride: false, netValue: expectedQty * item.rate };
    }));
  };
  
  // ============ TOTALS ============
  // Calculate construction totals (materials + B25 group + reinforcement + labor) using rounded quantities
  const materialsTotalNet = constructionMaterials.reduce((sum, item) => {
    const roundedQty = roundQuantity(item.id, item.quantity);
    return sum + (roundedQty * item.rate);
  }, 0);
  const laborTotalNet = laborItems.filter(i => !i.hidden).reduce((sum, item) => sum + item.netValue, 0);
  const constructionTotalNet = materialsTotalNet + b25TotalNet + (constructionTechnology === 'masonry' ? blockGroupTotalNet : 0) + reinforcement.totalNet + laborTotalNet;
  const constructionVatAmount = constructionTotalNet * (constructionVatRate / 100);
  const constructionTotalGross = constructionTotalNet + constructionVatAmount;
  
  // Get pool, stairs, wading pool dimensions for display
  const poolDims = {
    length: dimensions.length,
    width: dimensions.width,
    depth: dimensions.depth,
    depthDeep: dimensions.depthDeep,
  };
  const stairsDims = dimensions.stairs;
  const wadingPoolDims = dimensions.wadingPool;

  // excavationVolume is already defined at line 271
  // Update line items when dimensions change (auto-update quantity only if not manually overridden)
  useEffect(() => {
    const reusedVolume = backfillVolume * (reusePercent / 100);
    const wywozVolume = Math.max(0, excavationVolume - reusedVolume);
    
    setLineItems(prev => prev.map(item => {
      // Update wykop quantity
      if (item.id === 'wykop' && item.unit === 'm3' && !item.customOverride) {
        return {
          ...item,
          quantity: excavationVolume,
          netValue: excavationVolume * item.rate,
        };
      }
      // Update wywoz quantity (reduced by reused earth)
      if (item.id === 'wywoz' && item.unit === 'm3' && !item.customOverride) {
        return {
          ...item,
          quantity: wywozVolume,
          netValue: wywozVolume * item.rate,
        };
      }
      return item;
    }));
  }, [excavationVolume, backfillVolume, reusePercent]);

  // Save excavation rate to global settings
  const handleSaveRateToSettings = async () => {
    if (pendingExcavationRateChange) {
      await setExcavationSettings({
        ...excavationSettings,
        [pendingExcavationRateChange.rateKey]: pendingExcavationRateChange.newRate,
      });
      toast.success('Stawka zapisana w ustawieniach');
      // Remove from changed rates tracking
      setChangedExcavationRates(prev => {
        const { [pendingExcavationRateChange.itemId]: _, ...rest } = prev;
        return rest;
      });
    }
    setShowRateDialog(false);
    setPendingExcavationRateChange(null);
  };

  // Keep rate only for this offer
  const handleKeepRateLocal = () => {
    // Remove from changed rates tracking
    if (pendingExcavationRateChange) {
      setChangedExcavationRates(prev => {
        const { [pendingExcavationRateChange.itemId]: _, ...rest } = prev;
        return rest;
      });
    }
    setShowRateDialog(false);
    setPendingExcavationRateChange(null);
  };

  // Get excavation rate key from item id
  const getExcavationRateKey = (id: string): 'pricePerM3' | 'removalFixedPrice' | 'podsypkaRate' | 'drainageRate' | 'backfillRate' | null => {
    switch (id) {
      case 'wykop': return 'pricePerM3';
      case 'wywoz': return 'removalFixedPrice';
      case 'podsypka': return 'podsypkaRate';
      case 'piasek_zasypka': return 'podsypkaRate';
      case 'drenaz': return 'drainageRate';
      case 'zakopanie': return 'backfillRate';
      default: return null;
    }
  };

  // Update line item
  const updateLineItem = (id: string, field: keyof ExcavationLineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalculate net value
      if (field === 'unit') {
        if (value === 'm3') {
          // When switching to m3, only reset to calculated volume if not manually overridden
          if (!updated.customOverride) {
            updated.quantity = excavationVolume;
          }
          updated.netValue = updated.quantity * updated.rate;
        } else {
          updated.netValue = updated.rate;
        }
      } else if (field === 'quantity' || field === 'rate') {
        // Mark as manually overridden when user changes quantity
        if (field === 'quantity') {
          updated.customOverride = true;
        }
        // For wykop/wywoz, unit can be m3 or ryczalt
        // For podsypka/drenaz, always multiply quantity * rate
        if (id === 'wykop' || id === 'wywoz') {
          updated.netValue = updated.unit === 'm3' 
            ? updated.quantity * updated.rate 
            : updated.rate;
        } else {
          updated.netValue = updated.quantity * updated.rate;
        }
        
        // Round rate to integer for wykop, wywoz, and zakopanie
        if (field === 'rate' && (id === 'wykop' || id === 'wywoz' || id === 'zakopanie')) {
          updated.rate = Math.round(updated.rate);
          updated.netValue = updated.unit === 'm3' 
            ? updated.quantity * updated.rate 
            : updated.rate;
        }
        
        // Track rate change (don't open dialog immediately)
        if (field === 'rate') {
          const rateKey = getExcavationRateKey(id);
          if (rateKey) {
            const settingsRate = excavationSettings[rateKey];
            if (value !== settingsRate) {
              setChangedExcavationRates(prev => ({ ...prev, [id]: value }));
            } else {
              setChangedExcavationRates(prev => {
                const { [id]: _, ...rest } = prev;
                return rest;
              });
            }
          }
        }
      }
      
      return updated;
    }));
  };

  // Confirm excavation rate change - opens dialog
  const confirmExcavationRateChange = (id: string, itemName: string) => {
    const rateKey = getExcavationRateKey(id);
    const newRate = changedExcavationRates[id];
    if (rateKey && newRate !== undefined) {
      setPendingExcavationRateChange({
        itemId: id,
        itemName,
        oldRate: excavationSettings[rateKey],
        newRate,
        rateKey,
      });
      setShowRateDialog(true);
    }
  };

  // Get expected (auto-calculated) quantity for any excavation line item
  const getExpectedExcavationQuantity = useCallback((id: string): number => {
    const reusedVolume = backfillVolume * (reusePercent / 100);
    switch (id) {
      case 'wykop': return excavationVolume;
      case 'wywoz': return Math.max(0, excavationVolume - reusedVolume);
      case 'podsypka': return excavationArea * sandBeddingHeight;
      case 'piasek_zasypka': return Math.max(0, backfillVolume - reusedVolume);
      case 'drenaz': return 2 * (excLength + excWidth);
      case 'zakopanie': return backfillVolume;
      default: return 0;
    }
  }, [excavationVolume, backfillVolume, reusePercent, excavationArea, sandBeddingHeight, excLength, excWidth]);

  // Reset any excavation line item quantity to calculated value
  const resetExcavationItemQuantity = (id: string) => {
    const expectedQty = getExpectedExcavationQuantity(id);
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        quantity: expectedQty,
        customOverride: false,
        netValue: expectedQty * item.rate,
      };
    }));
  };

  // Piasek group calculations
  const piasekGroupItems = lineItems.filter(item => item.groupId === 'piasek');
  const piasekTotalQty = piasekGroupItems.reduce((s, i) => s + i.quantity, 0);
  const piasekTotalNet = piasekGroupItems.reduce((s, i) => s + i.netValue, 0);
  const piasekGroupRate = piasekGroupItems[0]?.rate || 0;
  
  const updatePiasekGroupRate = (newRate: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.groupId === 'piasek') {
        return { ...item, rate: newRate, netValue: item.quantity * newRate };
      }
      return item;
    }));
    if (newRate !== (excavationSettings.podsypkaRate || 150)) {
      setChangedExcavationRates(prev => ({ ...prev, piasek_group: newRate }));
    } else {
      setChangedExcavationRates(prev => {
        const { piasek_group: _, ...rest } = prev;
        return rest;
      });
    }
  };
  
  const confirmPiasekGroupRateChange = () => {
    const newRate = changedExcavationRates['piasek_group'];
    if (newRate !== undefined) {
      setPendingExcavationRateChange({
        itemId: 'piasek_group',
        itemName: 'Piasek',
        oldRate: excavationSettings.podsypkaRate || 150,
        newRate,
        rateKey: 'podsypkaRate',
      });
      setShowRateDialog(true);
    }
  };

  // Calculate totals (excluding hidden items like disabled drainage)
  const totalNet = lineItems.filter(item => !item.hidden).reduce((sum, item) => sum + item.netValue, 0);
  const vatAmount = totalNet * (vatRate / 100);
  const totalGross = totalNet + vatAmount;

  // Build excavation data for state
  const wykopItem = lineItems.find(i => i.id === 'wykop');
  const excavation: ExcavationData = {
    excavationVolume,
    excavationPricePerM3: wykopItem?.rate || excavationSettings.pricePerM3,
    excavationTotal: wykopItem?.netValue || 0,
    removalFixedPrice: lineItems.find(i => i.id === 'wywoz')?.netValue || 0,
  };

  // Save excavation scope to sections
  useEffect(() => {
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'roboty_ziemne',
        data: {
          ...sections.roboty_ziemne,
          scope: excavationScope,
          excavation: excavationScope === 'our' ? {
            ...excavation,
            customDimensions: { length: excLength, width: excWidth, depth: excDepth },
            lineItems,
            vatRate,
          } : null,
          items: [],
        },
      },
    });
  }, [excavationScope, excavation, excLength, excWidth, excDepth, lineItems, vatRate]);

  // Save construction scope to sections
  useEffect(() => {
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'prace_budowlane',
        data: {
          ...sections.prace_budowlane,
          scope: constructionScope,
          notes: constructionNotes,
          excavation: constructionScope === 'our' ? {
            technology: constructionTechnology,
            lineItems: constructionMaterials,
            reinforcement: {
              type: reinforcement.reinforcementType,
              unit: reinforcement.unit,
              meshSize: reinforcement.meshSize,
              items: reinforcement.items,
              totalNet: reinforcement.totalNet,
            },
            vatRate: constructionVatRate,
            sandBeddingHeight,
            leanConcreteHeight,
            floorSlabThickness,
            totalNet: constructionTotalNet,
            totalGross: constructionTotalGross,
          } : null,
          estimatedCost: constructionScope === 'our' ? constructionTotalNet : 0,
          items: [],
        },
      },
    });
  }, [constructionScope, constructionNotes, constructionTechnology, constructionMaterials, constructionVatRate, sandBeddingHeight, leanConcreteHeight, floorSlabThickness, constructionTotalNet, constructionTotalGross, reinforcement.reinforcementType, reinforcement.unit, reinforcement.meshSize, reinforcement.items, reinforcement.totalNet]);

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Shovel className="w-5 h-5 text-primary" />
        Roboty ziemne i prace budowlane
      </div>

      <Tabs defaultValue="excavation" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="excavation" className="flex items-center gap-2">
            <Shovel className="w-4 h-4" />
            Roboty ziemne
          </TabsTrigger>
          <TabsTrigger value="construction" className="flex items-center gap-2">
            <HardHat className="w-4 h-4" />
            Prace budowlane
          </TabsTrigger>
        </TabsList>

        {/* EXCAVATION TAB */}
        <TabsContent value="excavation">
          {/* Scope selection */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-base font-medium mb-4">Zakres prac</h3>
            <RadioGroup
              value={excavationScope}
              onValueChange={(v) => setExcavationScope(v as ScopeType)}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setExcavationScope('our')}>
                <RadioGroupItem value="our" id="excavation-scope-our" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="excavation-scope-our" className="cursor-pointer font-medium">
                    W naszym zakresie
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wykonamy roboty ziemne zgodnie z kalkulacją poniżej
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setExcavationScope('investor')}>
                <RadioGroupItem value="investor" id="excavation-scope-investor" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="excavation-scope-investor" className="cursor-pointer font-medium">
                    W zakresie inwestora
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Roboty ziemne po stronie klienta - nie wliczane do oferty
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {excavationScope === 'investor' ? (
            <div className="glass-card p-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">Roboty ziemne w zakresie inwestora</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na ofercie pojawi się informacja, że roboty ziemne są po stronie klienta.
                    Poniższe wymiary wykopu mają charakter informacyjny.
                  </p>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Wymagane wymiary wykopu (informacyjnie):
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Długość</p>
                    <p className="text-lg font-bold">{excLength.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Szerokość</p>
                    <p className="text-lg font-bold">{excWidth.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Głębokość</p>
                    <p className="text-lg font-bold">{excDepth.toFixed(2)} m</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Objętość wykopu: <strong>{excavationVolume.toFixed(1)} m³</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dimensions section */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Wymiary wykopu</h3>
                
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Kalkulacja wykopu</p>
                      <p className="text-muted-foreground">
                        Basen: {dimensions.length}×{dimensions.width}m + margines {excavationSettings.marginWidth}m z każdej strony.
                        Możesz edytować wymiary poniżej.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="exc-length">Długość (m)</Label>
                    <Input
                      id="exc-length"
                      type="number"
                      min="1"
                      step="0.1"
                      value={excLength}
                      onChange={(e) => setExcLength(parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exc-width">Szerokość (m)</Label>
                    <Input
                      id="exc-width"
                      type="number"
                      min="1"
                      step="0.1"
                      value={excWidth}
                      onChange={(e) => setExcWidth(parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exc-depth">Głębokość (m)</Label>
                    <Input
                      id="exc-depth"
                      type="number"
                      min="0.5"
                      step="0.01"
                      value={excDepth.toFixed(2)}
                      onChange={(e) => setExcDepth(Math.round((parseFloat(e.target.value) || 0) * 100) / 100)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1 p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Objętość wykopu</p>
                    <p className="text-2xl font-bold text-primary">
                      {excavationVolume.toFixed(1)} m³
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
                    <Checkbox 
                      id="drainage-enabled"
                      checked={drainageEnabled}
                      onCheckedChange={(checked) => setDrainageEnabled(!!checked)}
                    />
                    <div className="flex flex-col">
                      <Label htmlFor="drainage-enabled" className="cursor-pointer flex items-center gap-2">
                        <Droplets className="w-4 h-4" />
                        Drenaż opaskowy
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Obwód: {drainagePerimeter.toFixed(1)} mb
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sand bedding height - affects podsypka quantity */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border">
                  <Label htmlFor="sand-height-exc" className="whitespace-nowrap">Wysokość podsypki:</Label>
                  <Input
                    id="sand-height-exc"
                    type="number"
                    min="5"
                    max="30"
                    step="1"
                    value={Math.round(sandBeddingHeight * 100)}
                    onChange={(e) => setSandBeddingHeight((parseFloat(e.target.value) || 10) / 100)}
                    className="input-field w-20"
                  />
                  <span className="text-sm text-muted-foreground">cm</span>
                </div>

                {/* Wykorzystanie gruntu z wykopu */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border mt-4">
                  <Label htmlFor="reuse-percent" className="whitespace-nowrap text-sm">Wykorzystanie gruntu z wykopu:</Label>
                  <Input
                    id="reuse-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={reusePercent}
                    onChange={(e) => setReusePercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="input-field w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  {reusePercent > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(backfillVolume * reusePercent / 100).toFixed(1)} m³ gruntu ponownie wykorzystane)
                    </span>
                  )}
                </div>
              </div>

              {/* Cost table */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Koszt robót ziemnych</h3>
                
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[200px]">Nazwa czynności</TableHead>
                        <TableHead className="text-right w-[100px]">Ilość</TableHead>
                        <TableHead className="w-[120px]">Jednostka</TableHead>
                        <TableHead className="text-right w-[120px]">Stawka (zł)</TableHead>
                        <TableHead className="text-right w-[140px]">Wartość netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Wykop and Wywóz */}
                      {lineItems.filter(item => !item.hidden && !item.groupId && (item.id === 'wykop' || item.id === 'wywoz')).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.customOverride && (
                              <span className="ml-2 text-xs text-warning">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity.toFixed(1)}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="input-field w-20 text-right"
                              />
                              {item.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => resetExcavationItemQuantity(item.id)}
                                  title={`Przywróć: ${getExpectedExcavationQuantity(item.id).toFixed(1)} m³`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.unit}
                              onValueChange={(v) => updateLineItem(item.id, 'unit', v as UnitType)}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="m3">m³</SelectItem>
                                <SelectItem value="ryczalt">ryczałt</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step={1}
                                value={Math.round(item.rate)}
                                onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="input-field w-24 text-right"
                              />
                              {changedExcavationRates[item.id] !== undefined && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                  onClick={() => confirmExcavationRateChange(item.id, item.name)}
                                  title="Zatwierdź zmianę stawki"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.netValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Piasek group header */}
                      <TableRow className="bg-accent/5">
                        <TableCell>
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                            onClick={() => setSandGroupExpanded(!sandGroupExpanded)}
                          >
                            {sandGroupExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            Piasek
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium block text-right pr-2">
                            {piasekTotalQty.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">m³</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={Math.round(piasekGroupRate)}
                              onChange={(e) => updatePiasekGroupRate(parseFloat(e.target.value) || 0)}
                              className="input-field w-24 text-right"
                            />
                            {changedExcavationRates['piasek_group'] !== undefined && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                onClick={confirmPiasekGroupRateChange}
                                title="Zatwierdź zmianę stawki"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(piasekTotalNet)}
                        </TableCell>
                      </TableRow>
                      
                      {/* Piasek sub-items */}
                      {sandGroupExpanded && piasekGroupItems.map((subItem) => (
                        <TableRow key={subItem.id} className="bg-background">
                          <TableCell className="pl-10 text-muted-foreground">
                            └ {subItem.name}
                            {subItem.customOverride && (
                              <span className="text-xs text-warning ml-1">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={subItem.quantity.toFixed(1)}
                                onChange={(e) => {
                                  const newQty = parseFloat(e.target.value) || 0;
                                  setLineItems(prev => prev.map(item => 
                                    item.id === subItem.id 
                                      ? { ...item, quantity: newQty, netValue: newQty * item.rate, customOverride: true }
                                      : item
                                  ));
                                }}
                                className="input-field w-20 text-right"
                              />
                              {subItem.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setLineItems(prev => prev.map(item => 
                                      item.id === subItem.id 
                                        ? { ...item, customOverride: false }
                                        : item
                                    ));
                                  }}
                                  title="Przywróć obliczoną wartość"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">m³</TableCell>
                          <TableCell className="text-right text-muted-foreground pr-2">
                            {piasekGroupRate.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPrice(subItem.netValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Remaining items (drenaż, zakopanie) */}
                      {lineItems.filter(item => !item.hidden && !item.groupId && item.id !== 'wykop' && item.id !== 'wywoz').map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.customOverride && (
                              <span className="ml-2 text-xs text-warning">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity.toFixed(1)}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="input-field w-20 text-right"
                              />
                              {item.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => resetExcavationItemQuantity(item.id)}
                                  title={`Przywróć: ${getExpectedExcavationQuantity(item.id).toFixed(1)}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {item.id === 'drenaz' ? 'mb' : 'm³'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step={item.id === 'zakopanie' ? 1 : 10}
                                value={Math.round(item.rate)}
                                onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="input-field w-24 text-right"
                              />
                              {changedExcavationRates[item.id] !== undefined && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                  onClick={() => confirmExcavationRateChange(item.id, item.name)}
                                  title="Zatwierdź zmianę stawki"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.netValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Razem netto
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-primary">
                          {formatPrice(totalNet)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          VAT
                        </TableCell>
                        <TableCell>
                          <Select
                            value={vatRate.toString()}
                            onValueChange={(v) => setVatRate(parseInt(v) as VatRate)}
                          >
                            <SelectTrigger className="w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="8">8%</SelectItem>
                              <SelectItem value="23">23%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPrice(vatAmount)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={4} className="text-right font-medium">
                          Razem brutto
                        </TableCell>
                        <TableCell className="text-right font-bold text-xl">
                          {formatPrice(totalGross)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* CONSTRUCTION TAB */}
        <TabsContent value="construction">
          {/* Scope selection */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-base font-medium mb-4">Zakres prac budowlanych</h3>
            <RadioGroup
              value={constructionScope}
              onValueChange={(v) => setConstructionScope(v as ScopeType)}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setConstructionScope('our')}>
                <RadioGroupItem value="our" id="construction-our" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="construction-our" className="cursor-pointer font-medium flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    W naszym zakresie
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wykonamy prace budowlane (szalunki, zbrojenie, betonowanie, izolacje)
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setConstructionScope('investor')}>
                <RadioGroupItem value="investor" id="construction-investor" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="construction-investor" className="cursor-pointer font-medium flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    W zakresie inwestora
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prace budowlane po stronie klienta - nie wliczane do oferty
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {constructionScope === 'investor' ? (
            <div className="glass-card p-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">Prace budowlane w zakresie inwestora</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na ofercie pojawi się informacja, że prace budowlane są po stronie klienta.
                    Klient odpowiedzialny jest za przygotowanie niecki betonowej zgodnie z projektem.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="investor-notes">Uwagi dla inwestora</Label>
                  <Textarea
                    id="investor-notes"
                    value={constructionNotes}
                    onChange={(e) => setConstructionNotes(e.target.value)}
                    placeholder="Dodatkowe informacje dla inwestora dotyczące wymagań budowlanych..."
                    className="mt-2"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pool dimensions reference */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Parametry budowy</h3>
                
                {/* Pool, Stairs, Wading Pool dimensions */}
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <Info className="w-4 h-4 text-accent mt-0.5" />
                    <p className="text-sm font-medium">Wymiary konstrukcji</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Pool */}
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Basen</p>
                      <p className="text-sm font-medium">
                        {poolDims.length} × {poolDims.width} × {poolDims.depth}
                        {poolDims.depthDeep && ` - ${poolDims.depthDeep}`} m
                      </p>
                    </div>
                    {/* Stairs */}
                    {stairsDims.enabled && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Schody</p>
                        <p className="text-sm font-medium">
                          {stairsDims.width === 'full' ? 'Pełna szer.' : `${stairsDims.width} m`} × {stairsDims.stepCount} stopni
                        </p>
                      </div>
                    )}
                    {/* Wading Pool */}
                    {wadingPoolDims.enabled && (
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">Brodzik</p>
                        <p className="text-sm font-medium">
                          {wadingPoolDims.width} × {wadingPoolDims.length} × {wadingPoolDims.depth} m
                        </p>
                      </div>
                    )}
                    {/* Excavation area & Technology */}
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Pow. wykopu</p>
                      <p className="text-sm font-bold text-primary">{excavationArea.toFixed(1)} m²</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {constructionTechnology === 'masonry' ? 'Murowany' : 'Lany'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Technology selection */}
                <div className="mb-6">
                  <Label className="mb-2 block">Technologia budowy</Label>
                  <RadioGroup
                    value={constructionTechnology}
                    onValueChange={(v) => setConstructionTechnology(v as ConstructionTechnology)}
                    className="flex flex-row gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="masonry" id="tech-masonry" />
                      <Label htmlFor="tech-masonry" className="cursor-pointer">Bloczek betonowy (murowany)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="poured" id="tech-poured" />
                      <Label htmlFor="tech-poured" className="cursor-pointer">Technologia lana</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Block height selection (only for masonry) */}
                {constructionTechnology === 'masonry' && (
                  <div className="mb-6">
                    <Label className="mb-2 block">Wysokość bloczka</Label>
                    <RadioGroup
                      value={String(blockHeight)}
                      onValueChange={(v) => setBlockHeight(Number(v) as BlockHeight)}
                      className="flex flex-row gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="12" id="block-12" />
                        <Label htmlFor="block-12" className="cursor-pointer">12 cm</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="14" id="block-14" />
                        <Label htmlFor="block-14" className="cursor-pointer">14 cm</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Wading pool slab thickness (only when wading pool enabled and masonry) */}
                {dimensions.wadingPool?.enabled && constructionTechnology === 'masonry' && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <div className="space-y-2 flex-1 max-w-[200px]">
                        <Label htmlFor="wp-slab-height">Grub. płyty brodzika (cm)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="wp-slab-height"
                            type="number"
                            min="18"
                            max="30"
                            step="1"
                            value={Math.round(wadingPoolSlabHeight * 100)}
                            onChange={(e) => {
                              const val = Math.min(30, Math.max(18, parseFloat(e.target.value) || 18));
                              setWadingPoolSlabHeight(val / 100);
                              setWadingPoolSlabOverride(true);
                            }}
                            className="input-field"
                          />
                          {wadingPoolSlabOverride && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setWadingPoolSlabOverride(false);
                                const wpBlockCalc = calculateBlockLayers(dimensions.wadingPool!.depth, blockHeight);
                                setWadingPoolSlabHeight(wpBlockCalc.crownHeight);
                              }}
                              title="Przywróć wartość obliczoną"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Material heights configuration */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="concrete-height">Wysokość chudziaka (cm)</Label>
                    <Input
                      id="concrete-height"
                      type="number"
                      min="5"
                      max="30"
                      step="1"
                      value={Math.round(leanConcreteHeight * 100)}
                      onChange={(e) => setLeanConcreteHeight((parseFloat(e.target.value) || 10) / 100)}
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor-slab-height">Wysokość płyty dennej (cm)</Label>
                    <Input
                      id="floor-slab-height"
                      type="number"
                      min="10"
                      max="40"
                      step="1"
                      value={Math.round(floorSlabThickness * 100)}
                      onChange={(e) => setFloorSlabThickness((parseFloat(e.target.value) || 20) / 100)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Insulation options */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border mb-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Thermometer className="w-4 h-4" />
                    Ocieplenie basenu
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="floor-insulation">Ocieplenie dna</Label>
                      <Select
                        value={floorInsulation}
                        onValueChange={(v) => setFloorInsulation(v as FloorInsulationType)}
                      >
                        <SelectTrigger id="floor-insulation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {(Object.keys(floorInsulationLabels) as FloorInsulationType[]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {floorInsulationLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {floorInsulation !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Grubość: {Math.round(floorInsulationThickness[floorInsulation] * 100)} cm
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="wall-insulation">Ocieplenie ścian</Label>
                      <Select
                        value={wallInsulation}
                        onValueChange={(v) => setWallInsulation(v as WallInsulationType)}
                      >
                        <SelectTrigger id="wall-insulation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {(Object.keys(wallInsulationLabels) as WallInsulationType[]).map((type) => (
                            <SelectItem key={type} value={type}>
                              {wallInsulationLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {wallInsulation !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Grubość: {Math.round(wallInsulationThickness[wallInsulation] * 100)} cm
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {(floorInsulation !== 'none' || wallInsulation !== 'none') && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-primary mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Wpływ na obliczenia</p>
                          <p className="text-muted-foreground">
                            Głębokość wykopu: <strong>{excDepth.toFixed(2)} m</strong> 
                            {' '}(basen {dimensions.depth}m + płyta {Math.round(floorSlabThickness * 100)}cm 
                            {floorInsulation !== 'none' && ` + ocieplenie dna ${Math.round(floorInsThickness * 100)}cm`}
                            {' '}+ chudziak {Math.round(leanConcreteHeight * 100)}cm + podsypka {Math.round(sandBeddingHeight * 100)}cm)
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Zasypka: <strong>{backfillVolume.toFixed(1)} m³</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {constructionTechnology === 'masonry' && blockCalculation && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border mb-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Konstrukcja murowana
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label htmlFor="block-layers" className="text-xs text-muted-foreground">
                          Warstwy bloczków (basen)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="block-layers"
                            type="number"
                            min="1"
                            max="20"
                            step="1"
                            value={customBlockLayers ?? blockCalculation.layers}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setCustomBlockLayers(val > 0 ? val : undefined);
                              setCustomCrownHeight(undefined);
                            }}
                            className="input-field w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            (wyl: {calculateTotalBlocks(dimensions.length, dimensions.width, dimensions.depth).layers})
                          </span>
                        </div>
                        {dimensions.wadingPool?.enabled && wadingPoolBlockCalc && (
                          <p className="text-xs text-muted-foreground">
                            Brodzik: {wadingPoolBlockCalc.layers} warstw
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Wysokość ściany
                        </Label>
                        <p className="text-lg font-semibold">
                          {Math.round(blockCalculation.wallHeight * 100)} cm
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="crown-height" className="text-xs text-muted-foreground">
                          Wysokość wieńca (cm)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="crown-height"
                            type="number"
                            min="18"
                            max="36"
                            step="1"
                            value={Math.round(blockCalculation.crownHeight * 100)}
                            onChange={(e) => {
                              const val = (parseFloat(e.target.value) || 18) / 100;
                              if (val >= 0.18) {
                                setCustomCrownHeight(val);
                                setCustomBlockLayers(undefined); // Reset layers when crown changes
                              }
                            }}
                            className="input-field w-20"
                          />
                          {blockCalculation.isOptimal && (
                            <span className="text-xs text-green-600 font-medium">✓ opt.</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          min. 18cm, opt. 24cm
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Bloczki w warstwie
                        </Label>
                        <p className="text-lg font-semibold">
                          {blockCalculation.blocksPerLayer} szt.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Razem bloczków</p>
                          <p className="text-2xl font-bold text-primary">
                            {(blockCalculation.totalBlocks + wadingPoolBlocks + stairsBlocks)} szt.
                          </p>
                        </div>
                        <div className="text-muted-foreground text-sm space-y-0.5">
                          <div>Basen: {blockCalculation.totalBlocks} szt. ({blockCalculation.layers} warstw × {blockCalculation.blocksPerLayer} szt.)</div>
                          {dimensions.wadingPool?.enabled && wadingPoolBlockCalc && (
                            <div>Brodzik: {wadingPoolBlocks} szt. ({wadingPoolBlockCalc.layers} warstw × {Math.ceil(((dimensions.wadingPool.width || 0) + (dimensions.wadingPool.length || 0)) / BLOCK_DIMENSIONS.length)} szt.)</div>
                          )}
                          {dimensions.stairs?.enabled && stairsBlocks > 0 && (
                            <div>Schody: {stairsBlocks} szt. ({dimensions.stairs.stepCount} stopni × {dimensions.stairs.width === 'full' ? (dimensions.stairs.wall === 'back' || dimensions.stairs.wall === 'front' ? dimensions.length : dimensions.width) : dimensions.stairs.width} m)</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Słupy</p>
                        <p className="text-lg font-medium">{blockCalculation.columnCount} szt.</p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Bloczek {BLOCK_DIMENSIONS.length * 100}×{BLOCK_DIMENSIONS.width * 100}×{blockHeight} cm, słupy co 2m
                    </p>
                  </div>
                )}


                
                {/* Reinforcement controls in material requirements section */}
                <ReinforcementControls
                  reinforcementType={reinforcement.reinforcementType}
                  setReinforcementType={reinforcement.setReinforcementType}
                  meshSize={reinforcement.meshSize}
                  setMeshSize={reinforcement.setMeshSize}
                />
              </div>

              {/* 2D Preview with column positions (only for masonry) */}
              {constructionTechnology === 'masonry' && dimensions.shape === 'prostokatny' && (
                <div className="glass-card p-6">
                  <h3 className="text-base font-medium mb-4">Rozmieszczenie słupów (widok 2D)</h3>
                  <Pool2DPreview 
                    dimensions={dimensions} 
                    height={250}
                    showColumns={true}
                    customColumnCounts={customColumnCounts}
                    onColumnCountsChange={setCustomColumnCounts}
                  />
                  
                  {/* Column count control panel */}
                  <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Słupy wzdłuż długości
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const current = effectiveColumnCounts.lengthWalls;
                              if (current > 0) {
                                setCustomColumnCounts({
                                  ...effectiveColumnCounts,
                                  lengthWalls: current - 1
                                });
                              }
                            }}
                            disabled={effectiveColumnCounts.lengthWalls <= 0}
                          >
                            -
                          </Button>
                          <span className="text-lg font-semibold w-8 text-center">
                            {effectiveColumnCounts.lengthWalls}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const current = effectiveColumnCounts.lengthWalls;
                              const maxColumns = Math.floor(dimensions.length / 1.5);
                              if (current < maxColumns) {
                                setCustomColumnCounts({
                                  ...effectiveColumnCounts,
                                  lengthWalls: current + 1
                                });
                              }
                            }}
                            disabled={effectiveColumnCounts.lengthWalls >= Math.floor(dimensions.length / 1.5)}
                          >
                            +
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          (wyl: {defaultColumnCounts.lengthWalls})
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Słupy wzdłuż szerokości
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const current = effectiveColumnCounts.widthWalls;
                              if (current > 0) {
                                setCustomColumnCounts({
                                  ...effectiveColumnCounts,
                                  widthWalls: current - 1
                                });
                              }
                            }}
                            disabled={effectiveColumnCounts.widthWalls <= 0}
                          >
                            -
                          </Button>
                          <span className="text-lg font-semibold w-8 text-center">
                            {effectiveColumnCounts.widthWalls}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const current = effectiveColumnCounts.widthWalls;
                              const maxColumns = Math.floor(dimensions.width / 1.5);
                              if (current < maxColumns) {
                                setCustomColumnCounts({
                                  ...effectiveColumnCounts,
                                  widthWalls: current + 1
                                });
                              }
                            }}
                            disabled={effectiveColumnCounts.widthWalls >= Math.floor(dimensions.width / 1.5)}
                          >
                            +
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          (wyl: {defaultColumnCounts.widthWalls})
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Razem słupów
                        </Label>
                        <p className="text-2xl font-bold text-primary">
                          {totalColumnCount} szt.
                        </p>
                      </div>
                      
                      <div className="flex items-end">
                        {customColumnCounts && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCustomColumnCounts(undefined)}
                            className="flex items-center gap-2"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Przywróć domyślne
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Słupy rozmieszczone równomiernie wzdłuż ścian. Min. odległość między słupami: {dimensions.length > 0 && effectiveColumnCounts.lengthWalls > 0 ? (dimensions.length / (effectiveColumnCounts.lengthWalls + 1)).toFixed(2) : '—'} m (długość), {dimensions.width > 0 && effectiveColumnCounts.widthWalls > 0 ? (dimensions.width / (effectiveColumnCounts.widthWalls + 1)).toFixed(2) : '—'} m (szerokość)
                    </p>
                  </div>
                </div>
              )}

              {/* Materials + Reinforcement combined cost table */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Koszt budowy</h3>
                
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[280px]">Pozycja</TableHead>
                        <TableHead className="w-[100px] text-right pr-2">Ilość</TableHead>
                        <TableHead className="w-[80px]">Jednostka</TableHead>
                        <TableHead className="w-[100px] text-right pr-2">Stawka (zł)</TableHead>
                        <TableHead className="w-[140px] text-right">Wartość netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Concretes first: B15 then B25 group */}
                      {constructionMaterials.filter(item => item.id === 'chudziak').map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.customOverride && (
                              <span className="ml-2 text-xs text-amber-600">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={formatQuantity(item.id, item.quantity)}
                                onChange={(e) => updateConstructionMaterial(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="input-field w-[70px] text-right"
                              />
                              {item.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resetConstructionMaterialQuantity(item.id)}
                                  title={`Przywróć: ${formatQuantity(item.id, getExpectedMaterialQuantity(item.id))}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="10"
                                value={item.rate}
                                onChange={(e) => updateConstructionMaterial(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="input-field w-[80px] text-right"
                              />
                              {changedMaterialRates[item.id] !== undefined && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                  onClick={() => confirmMaterialRateChange(item.id, item.name)}
                                  title="Zatwierdź zmianę stawki"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(roundQuantity(item.id, item.quantity) * item.rate)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* B25 Concrete Group (right after B15) */}
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                            onClick={toggleB25Expand}
                          >
                            {b25ConcreteGroup.isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {b25ConcreteGroup.groupName}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium block text-right pr-2">
                            {formatQuantity('beton_wieniec', b25TotalQuantity)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b25ConcreteGroup.unit}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={b25ConcreteGroup.rate}
                              onChange={(e) => updateB25Rate(parseFloat(e.target.value) || 0)}
                              className="input-field w-[80px] text-right"
                            />
                            {changedMaterialRates['beton_b25_group'] !== undefined && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                onClick={confirmB25RateChange}
                                title="Zatwierdź zmianę stawki"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(b25TotalNet)}
                        </TableCell>
                      </TableRow>
                      
                      {/* B25 sub-items (when expanded) */}
                      {b25ConcreteGroup.isExpanded && b25ConcreteGroup.subItems.map((subItem) => (
                        <TableRow key={subItem.id} className="bg-background">
                          <TableCell className="pl-10 text-muted-foreground">
                            └ {subItem.name}
                            {subItem.customOverride && (
                              <span className="ml-2 text-xs text-amber-600">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={subItem.quantity.toFixed(2)}
                                onChange={(e) => updateB25SubItemQuantity(subItem.id, parseFloat(e.target.value) || 0)}
                                className="input-field w-[70px] text-right"
                              />
                              {subItem.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resetB25SubItemQuantity(subItem.id)}
                                  title={`Przywróć: ${getExpectedB25SubItemQuantity(subItem.id).toFixed(2)}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{b25ConcreteGroup.unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground pr-2">
                            {b25ConcreteGroup.rate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatPrice(Math.ceil(subItem.quantity * 2) / 2 * b25ConcreteGroup.rate)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Remaining materials: Pompogruszka */}
                      {constructionMaterials.filter(item => item.id !== 'chudziak').map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.name}
                            {item.customOverride && (
                              <span className="ml-2 text-xs text-amber-600">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step={['pompogruszka'].includes(item.id) ? '1' : '0.5'}
                                value={formatQuantity(item.id, item.quantity)}
                                onChange={(e) => updateConstructionMaterial(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="input-field w-[70px] text-right"
                              />
                              {item.customOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resetConstructionMaterialQuantity(item.id)}
                                  title={`Przywróć: ${formatQuantity(item.id, getExpectedMaterialQuantity(item.id))}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="10"
                                value={item.rate}
                                onChange={(e) => updateConstructionMaterial(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="input-field w-[80px] text-right"
                              />
                              {changedMaterialRates[item.id] !== undefined && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                  onClick={() => confirmMaterialRateChange(item.id, item.name)}
                                  title="Zatwierdź zmianę stawki"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(roundQuantity(item.id, item.quantity) * item.rate)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Block Group (bloczki: basen + brodzik + schody) - only for masonry */}
                      {constructionTechnology === 'masonry' && (
                        <>
                          <TableRow>
                            <TableCell>
                              <button
                                type="button"
                                className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                                onClick={toggleBlockGroupExpand}
                              >
                                {blockGroup.isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                {blockGroup.groupName}
                              </button>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium block text-right pr-2">
                                {formatQuantity('bloczek', blockGroupTotalQuantity)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{blockGroup.unit}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={blockGroup.rate}
                                  onChange={(e) => updateBlockGroupRate(parseFloat(e.target.value) || 0)}
                                  className="input-field w-[80px] text-right"
                                />
                                {changedMaterialRates['block_group'] !== undefined && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success hover:text-success/80 hover:bg-success/10"
                                    onClick={confirmBlockGroupRateChange}
                                    title="Zatwierdź zmianę stawki"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatPrice(blockGroupTotalNet)}
                            </TableCell>
                          </TableRow>
                          
                          {/* Block sub-items (when expanded) */}
                          {blockGroup.isExpanded && blockGroup.subItems.map((subItem) => (
                            <TableRow key={subItem.id} className="bg-background">
                              <TableCell className="pl-10 text-muted-foreground">
                                └ {subItem.name}
                                {subItem.customOverride && (
                                  <span className="ml-2 text-xs text-amber-600">(zmieniono)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={Math.ceil(subItem.quantity)}
                                    onChange={(e) => updateBlockSubItemQuantity(subItem.id, parseFloat(e.target.value) || 0)}
                                    className="input-field w-[70px] text-right"
                                  />
                                  {subItem.customOverride && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => resetBlockSubItemQuantity(subItem.id)}
                                      title={`Przywróć: ${Math.ceil(getExpectedBlockSubItemQuantity(subItem.id))}`}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{blockGroup.unit}</TableCell>
                              <TableCell className="text-right text-muted-foreground pr-2">
                                {blockGroup.rate.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatPrice(Math.ceil(subItem.quantity) * blockGroup.rate)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}

                      {/* Reinforcement rows */}
                      <ReinforcementTableRows
                        items={reinforcement.items}
                        onToggleExpand={reinforcement.toggleExpand}
                        onUpdatePositionQuantity={reinforcement.updatePositionQuantity}
                        onResetPositionQuantity={reinforcement.resetPositionQuantity}
                        onUpdateItemRate={handleReinforcementRateChange}
                        onUpdateItemQuantity={reinforcement.updateItemQuantity}
                        onUpdateItemUnit={reinforcement.updateItemUnit}
                        changedRates={changedMaterialRates}
                        onConfirmRateChange={confirmReinforcementRateChange}
                      />
                      
                      {/* Labor cost rows */}
                      {laborItems.filter(item => !item.hidden).map((item) => (
                        <TableRow key={item.id} className="bg-accent/5">
                          <TableCell className="font-medium">
                            {item.name}
                            {item.customOverride && (
                              <span className="ml-2 text-xs text-amber-600">(zmieniono)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {item.unit === 'ryczalt' ? (
                                <span className="text-sm text-muted-foreground pr-2">ryczałt</span>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  step={item.id === 'labor_pool' ? "1" : "0.1"}
                                  value={item.id === 'labor_pool' ? String(Math.round(item.quantity)) : item.quantity.toFixed(2)}
                                  onChange={(e) => updateLaborItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="input-field w-[70px] text-right"
                                />
                              )}
                              {item.customOverride && item.unit !== 'ryczalt' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => resetLaborItemQuantity(item.id)}
                                  title={`Przywróć: ${item.id === 'labor_pool' ? Math.round(getExpectedLaborQuantity(item.id)) : getExpectedLaborQuantity(item.id).toFixed(2)}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.unit}
                              onValueChange={(v) => updateLaborItem(item.id, 'unit', v)}
                            >
                              <SelectTrigger className="w-[90px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                <SelectItem value="m2">m²</SelectItem>
                                <SelectItem value="ryczalt">ryczałt</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="100"
                                value={item.rate}
                                onChange={(e) => updateLaborItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                className="input-field w-[80px] text-right"
                              />
                              {changedMaterialRates[item.id] !== undefined && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => confirmLaborRateChange(item.id)}
                                  title="Zatwierdź zmianę stawki"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.netValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Razem netto
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-primary">
                          {formatPrice(constructionTotalNet)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          VAT
                        </TableCell>
                        <TableCell>
                          <Select
                            value={constructionVatRate.toString()}
                            onValueChange={(v) => setConstructionVatRate(parseInt(v) as VatRate)}
                          >
                            <SelectTrigger className="w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="8">8%</SelectItem>
                              <SelectItem value="23">23%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPrice(constructionVatAmount)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-primary/5">
                        <TableCell colSpan={4} className="text-right font-medium">
                          Razem brutto
                        </TableCell>
                        <TableCell className="text-right font-bold text-xl">
                          {formatPrice(constructionTotalGross)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <Label htmlFor="construction-notes">Uwagi</Label>
                  <Textarea
                    id="construction-notes"
                    value={constructionNotes}
                    onChange={(e) => setConstructionNotes(e.target.value)}
                    placeholder="Dodatkowe uwagi dotyczące prac budowlanych..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rate change dialog for excavation */}
      <AlertDialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" />
              Zmiana stawki
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingExcavationRateChange && (
                <>
                  Zmieniono stawkę dla <strong>{pendingExcavationRateChange.itemName}</strong> z {formatPrice(pendingExcavationRateChange.oldRate)} na {formatPrice(pendingExcavationRateChange.newRate)}.
                  <br /><br />
                  Czy chcesz zapisać nową stawkę w ustawieniach, aby była używana dla przyszłych ofert?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepRateLocal}>
              Tylko dla tej oferty
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveRateToSettings}>
              Zapisz w ustawieniach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rate change dialog for construction materials */}
      <AlertDialog open={showMaterialRateDialog} onOpenChange={setShowMaterialRateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" />
              Zmiana stawki materiału
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRateChange && (
                <>
                  Zmieniono stawkę dla <strong>{pendingRateChange.materialName}</strong> z {formatPrice(pendingRateChange.oldRate)} na {formatPrice(pendingRateChange.newRate)}.
                  <br /><br />
                  Czy chcesz zapisać nową stawkę w ustawieniach, aby była używana dla przyszłych ofert?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepMaterialRateLocal}>
              Tylko dla tej oferty
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveMaterialRateToSettings}>
              Zapisz w ustawieniach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
