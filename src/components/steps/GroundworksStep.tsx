import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Shovel, HardHat, Info, AlertCircle, Wrench, Building, Save, Check } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { ExcavationSettings, ExcavationData, calculateExcavation } from '@/types/offers';
import { formatPrice } from '@/lib/calculations';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  BLOCK_DIMENSIONS,
} from '@/components/groundworks/ReinforcementSection';
import Pool2DPreview from '@/components/Pool2DPreview';

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
}

export function GroundworksStep({ onNext, onBack, excavationSettings }: GroundworksStepProps) {
  const { state, dispatch } = useConfigurator();
  const { setExcavationSettings } = useSettings();
  const { dimensions, sections } = state;
  
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
  const [excDepth, setExcDepth] = useState(() => 
    dimensions.depth + excavationSettings.marginDepth
  );
  
  // Editable rate - track original and current
  const [excavationRate, setExcavationRate] = useState(excavationSettings.pricePerM3);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [rateChanged, setRateChanged] = useState(false);
  
  // Track if user manually overrode the quantity for wykop
  const [customQuantityOverride, setCustomQuantityOverride] = useState(false);
  
  // VAT selection
  const [vatRate, setVatRate] = useState<VatRate>(23);
  
  // Line items
  const [lineItems, setLineItems] = useState<ExcavationLineItem[]>(() => {
    const volume = excLength * excWidth * excDepth;
    return [
      {
        id: 'wykop',
        name: 'Wykop',
        quantity: volume,
        unit: 'm3' as UnitType,
        rate: excavationSettings.pricePerM3,
        netValue: volume * excavationSettings.pricePerM3,
      },
      {
        id: 'wywoz',
        name: 'Wywóz ziemi',
        quantity: 1,
        unit: 'ryczalt' as UnitType,
        rate: excavationSettings.removalFixedPrice,
        netValue: excavationSettings.removalFixedPrice,
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
  
  // Material heights (editable)
  const [sandBeddingHeight, setSandBeddingHeight] = useState(0.1); // 10cm default
  const [leanConcreteHeight, setLeanConcreteHeight] = useState(0.1); // 10cm default
  const [floorSlabThickness, setFloorSlabThickness] = useState(0.2); // 20cm default
  
  // Block layer calculation (only for masonry technology)
  const [customBlockLayers, setCustomBlockLayers] = useState<number | undefined>(undefined);
  const [customCrownHeight, setCustomCrownHeight] = useState<number | undefined>(undefined);
  
  // Calculate block data based on pool dimensions
  const blockCalculation = useMemo(() => {
    if (constructionTechnology !== 'masonry') return null;
    return calculateTotalBlocks(
      dimensions.length,
      dimensions.width,
      dimensions.depth,
      customBlockLayers,
      customCrownHeight
    );
  }, [dimensions.length, dimensions.width, dimensions.depth, constructionTechnology, customBlockLayers, customCrownHeight]);
  
  // Reset custom values when pool depth changes
  useEffect(() => {
    setCustomBlockLayers(undefined);
    setCustomCrownHeight(undefined);
  }, [dimensions.depth]);
  
  // Calculate excavation area (for material calculations)
  const excavationArea = excLength * excWidth;
  
  // Calculate floor slab area: pool dimensions + 24cm on each side
  const floorSlabArea = (dimensions.length + 0.48) * (dimensions.width + 0.48);
  
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
  }
  
  // Calculate pompogruszki quantity: 3 base + 1 for stairs + 1 for wading pool
  const pompogruszkaBaseQty = 3;
  const pompogruszkaStairsBonus = dimensions.stairs?.enabled ? 1 : 0;
  const pompogruszkaWadingBonus = dimensions.wadingPool?.enabled ? 1 : 0;
  const pompogruszkaQty = pompogruszkaBaseQty + pompogruszkaStairsBonus + pompogruszkaWadingBonus;
  
  const [constructionMaterials, setConstructionMaterials] = useState<ConstructionMaterialItem[]>(() => {
    const baseItems: ConstructionMaterialItem[] = [
      {
        id: 'podsypka',
        name: 'Podsypka piaskowa',
        quantity: excavationArea * sandBeddingHeight,
        unit: 'm³',
        rate: 120,
        netValue: excavationArea * sandBeddingHeight * 120,
      },
      {
        id: 'chudziak',
        name: 'Beton na chudziak B15',
        quantity: excavationArea * leanConcreteHeight,
        unit: 'm³',
        rate: 350,
        netValue: excavationArea * leanConcreteHeight * 350,
      },
      {
        id: 'plyta_denna',
        name: 'Beton płyta denna B25',
        quantity: Math.ceil(floorSlabArea * floorSlabThickness),
        unit: 'm³',
        rate: 450,
        netValue: Math.ceil(floorSlabArea * floorSlabThickness) * 450,
      },
      {
        id: 'pompogruszka',
        name: 'Pompogruszka',
        quantity: pompogruszkaQty,
        unit: 'szt.',
        rate: 150,
        netValue: pompogruszkaQty * 150,
      },
    ];
    return baseItems;
  });
  
  // Reinforcement hook
  const reinforcement = useReinforcement(dimensions, floorSlabThickness, constructionTechnology);
  
  // Update construction materials when dimensions, heights, or block calculation changes
  useEffect(() => {
    const currentPompogruszkaQty = pompogruszkaBaseQty + 
      (dimensions.stairs?.enabled ? 1 : 0) + 
      (dimensions.wadingPool?.enabled ? 1 : 0);
    
    setConstructionMaterials(prev => {
      // Update existing items
      let updated = prev.map(item => {
        if (item.id === 'podsypka') {
          const qty = excavationArea * sandBeddingHeight;
          return { ...item, quantity: qty, netValue: qty * item.rate };
        }
        if (item.id === 'chudziak') {
          const qty = excavationArea * leanConcreteHeight;
          return { ...item, quantity: qty, netValue: qty * item.rate };
        }
        if (item.id === 'plyta_denna') {
          const qty = Math.ceil(floorSlabArea * floorSlabThickness);
          return { ...item, quantity: qty, netValue: qty * item.rate };
        }
        if (item.id === 'pompogruszka') {
          return { ...item, quantity: currentPompogruszkaQty, netValue: currentPompogruszkaQty * item.rate };
        }
        if (item.id === 'bloczek') {
          const qty = blockCalculation?.totalBlocks || 0;
          return { ...item, quantity: qty, netValue: qty * item.rate };
        }
        return item;
      });
      
      // Add or remove bloczek based on technology
      const hasBloczek = updated.some(item => item.id === 'bloczek');
      
      if (constructionTechnology === 'masonry' && !hasBloczek && blockCalculation) {
        // Add bloczek item for masonry
        const bloczekQty = blockCalculation.totalBlocks;
        updated.push({
          id: 'bloczek',
          name: 'Bloczek betonowy 38×24×12',
          quantity: bloczekQty,
          unit: 'szt.',
          rate: 8.50,
          netValue: bloczekQty * 8.50,
        });
      } else if (constructionTechnology !== 'masonry' && hasBloczek) {
        // Remove bloczek for non-masonry
        updated = updated.filter(item => item.id !== 'bloczek');
      } else if (constructionTechnology === 'masonry' && hasBloczek && blockCalculation) {
        // Update bloczek quantity
        updated = updated.map(item => {
          if (item.id === 'bloczek') {
            const qty = blockCalculation.totalBlocks;
            return { ...item, quantity: qty, netValue: qty * item.rate };
          }
          return item;
        });
      }
      
      return updated;
    });
  }, [excavationArea, sandBeddingHeight, leanConcreteHeight, floorSlabArea, floorSlabThickness, dimensions.stairs?.enabled, dimensions.wadingPool?.enabled, constructionTechnology, blockCalculation]);
  
  // Update construction material
  const updateConstructionMaterial = (id: string, field: keyof ConstructionMaterialItem, value: any) => {
    setConstructionMaterials(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        updated.netValue = updated.quantity * updated.rate;
      }
      return updated;
    }));
  };
  
  // Calculate construction totals (materials + reinforcement)
  const materialsTotalNet = constructionMaterials.reduce((sum, item) => sum + item.netValue, 0);
  const constructionTotalNet = materialsTotalNet + reinforcement.totalNet;
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

  // Recalculate volume when dimensions change
  const excavationVolume = excLength * excWidth * excDepth;
  
  // Update line items when dimensions or rate changes
  useEffect(() => {
    setLineItems(prev => prev.map(item => {
      if (item.id === 'wykop') {
        // Only auto-update quantity if user hasn't manually overridden it
        const newQuantity = (item.unit === 'm3' && !customQuantityOverride) 
          ? excavationVolume 
          : item.quantity;
        return {
          ...item,
          quantity: newQuantity,
          rate: excavationRate,
          netValue: item.unit === 'm3' ? newQuantity * excavationRate : item.rate,
        };
      }
      return item;
    }));
  }, [excavationVolume, excavationRate, customQuantityOverride]);

  // Track if rate changed from settings
  useEffect(() => {
    setRateChanged(excavationRate !== excavationSettings.pricePerM3);
  }, [excavationRate, excavationSettings.pricePerM3]);

  // Handle rate change - just update local state
  const handleRateChange = (newRate: number) => {
    setExcavationRate(newRate);
  };

  // Show dialog when user clicks confirm button
  const handleConfirmRateChange = () => {
    if (rateChanged) {
      setShowRateDialog(true);
    }
  };

  // Save rate to global settings
  const handleSaveRateToSettings = async () => {
    await setExcavationSettings({
      ...excavationSettings,
      pricePerM3: excavationRate,
    });
    toast.success('Stawka zapisana w ustawieniach');
    setShowRateDialog(false);
    setRateChanged(false);
  };

  // Keep rate only for this offer
  const handleKeepRateLocal = () => {
    setShowRateDialog(false);
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
          if (!customQuantityOverride) {
            updated.quantity = excavationVolume;
          }
          updated.netValue = updated.quantity * updated.rate;
        } else {
          updated.netValue = updated.rate;
        }
      } else if (field === 'quantity' || field === 'rate') {
        // Mark as manually overridden when user changes quantity for wykop
        if (id === 'wykop' && field === 'quantity') {
          setCustomQuantityOverride(true);
        }
        updated.netValue = updated.unit === 'm3' 
          ? updated.quantity * updated.rate 
          : updated.rate;
      }
      
      return updated;
    }));
  };

  // Reset quantity to calculated volume
  const resetQuantityToCalculated = () => {
    setCustomQuantityOverride(false);
    setLineItems(prev => prev.map(item => {
      if (item.id === 'wykop' && item.unit === 'm3') {
        return {
          ...item,
          quantity: excavationVolume,
          netValue: excavationVolume * item.rate,
        };
      }
      return item;
    }));
  };

  // Calculate totals
  const totalNet = lineItems.reduce((sum, item) => sum + item.netValue, 0);
  const vatAmount = totalNet * (vatRate / 100);
  const totalGross = totalNet + vatAmount;

  // Build excavation data for state
  const excavation: ExcavationData = {
    excavationVolume,
    excavationPricePerM3: excavationRate,
    excavationTotal: lineItems.find(i => i.id === 'wykop')?.netValue || 0,
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
                    <p className="text-lg font-bold">{excDepth.toFixed(1)} m</p>
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
                      step="0.1"
                      value={excDepth}
                      onChange={(e) => setExcDepth(parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Objętość wykopu</p>
                      <p className="text-2xl font-bold text-primary">
                        {excavationVolume.toFixed(1)} m³
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <Label htmlFor="exc-rate" className="text-xs text-muted-foreground">Stawka za m³</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="exc-rate"
                          type="number"
                          min="0"
                          step="10"
                          value={excavationRate}
                          onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                          className="input-field w-28 text-right"
                        />
                        <span className="text-sm text-muted-foreground">zł/m³</span>
                        {rateChanged && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleConfirmRateChange}
                            className="ml-2"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Zatwierdź
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
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
                      {lineItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                className="input-field w-20 text-right"
                              />
                              {item.id === 'wykop' && item.unit === 'm3' && customQuantityOverride && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={resetQuantityToCalculated}
                                  title={`Przywróć obliczoną wartość: ${excavationVolume.toFixed(1)} m³`}
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
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={item.rate}
                              onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                              className="input-field w-24 text-right"
                            />
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Material heights configuration */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="sand-height">Wysokość podsypki (cm)</Label>
                    <Input
                      id="sand-height"
                      type="number"
                      min="5"
                      max="30"
                      step="1"
                      value={Math.round(sandBeddingHeight * 100)}
                      onChange={(e) => setSandBeddingHeight((parseFloat(e.target.value) || 10) / 100)}
                      className="input-field"
                    />
                  </div>
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

                {/* Masonry construction section - only for masonry technology */}
                {constructionTechnology === 'masonry' && blockCalculation && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border mb-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Konstrukcja murowana
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-2">
                        <Label htmlFor="block-layers" className="text-xs text-muted-foreground">
                          Warstwy bloczków
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
                              setCustomCrownHeight(undefined); // Reset crown when layers change
                            }}
                            className="input-field w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            (wyl: {calculateTotalBlocks(dimensions.length, dimensions.width, dimensions.depth).layers})
                          </span>
                        </div>
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
                            {blockCalculation.totalBlocks} szt.
                          </p>
                        </div>
                        <div className="text-muted-foreground text-sm">
                          ({blockCalculation.layers} warstw × {blockCalculation.blocksPerLayer} szt.)
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Słupy</p>
                        <p className="text-lg font-medium">{blockCalculation.columnCount} szt.</p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Bloczek {BLOCK_DIMENSIONS.length * 100}×{BLOCK_DIMENSIONS.width * 100}×{BLOCK_DIMENSIONS.height * 100} cm, słupy co 2m
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Powierzchnia wykopu</p>
                      <p className="text-2xl font-bold text-primary">
                        {excavationArea.toFixed(1)} m²
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Technologia</p>
                      <p className="text-lg font-medium">
                        {constructionTechnology === 'masonry' ? 'Murowany' : 'Lany'}
                      </p>
                    </div>
                  </div>
                </div>
                
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
                  />
                </div>
              )}

              {/* Materials + Reinforcement combined cost table */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Koszty materiałów budowlanych</h3>
                
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[200px]">Pozycja</TableHead>
                        <TableHead className="text-right w-[100px]">Ilość</TableHead>
                        <TableHead className="w-[80px]">Jednostka</TableHead>
                        <TableHead className="text-right w-[120px]">Stawka (zł)</TableHead>
                        <TableHead className="text-right w-[140px]">Wartość netto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Construction materials */}
                      {constructionMaterials.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.quantity.toFixed(2)}
                              onChange={(e) => updateConstructionMaterial(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="input-field w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              step="10"
                              value={item.rate}
                              onChange={(e) => updateConstructionMaterial(item.id, 'rate', parseFloat(e.target.value) || 0)}
                              className="input-field w-24 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(item.netValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Reinforcement rows integrated directly */}
                      <ReinforcementTableRows
                        items={reinforcement.items}
                        onToggleExpand={reinforcement.toggleExpand}
                        onUpdatePositionQuantity={reinforcement.updatePositionQuantity}
                        onUpdateItemRate={reinforcement.updateItemRate}
                        onUpdateItemQuantity={reinforcement.updateItemQuantity}
                        onUpdateItemUnit={reinforcement.updateItemUnit}
                      />
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

      {/* Rate change dialog */}
      <AlertDialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-primary" />
              Zmiana stawki za wykop
            </AlertDialogTitle>
            <AlertDialogDescription>
              Zmieniono stawkę z {formatPrice(excavationSettings.pricePerM3)}/m³ na {formatPrice(excavationRate)}/m³.
              <br /><br />
              Czy chcesz zapisać nową stawkę w ustawieniach, aby była używana dla przyszłych ofert?
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
    </div>
  );
}
