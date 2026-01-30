import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Palette, 
  Info, 
  Calculator, 
  Loader2, 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  Package,
  Layers,
  GripVertical,
  HelpCircle,
  Footprints,
  Waves
} from 'lucide-react';
import { Product, getPriceInPLN } from '@/data/products';
import { formatPrice, calculateFoilOptimization, FoilOptimizationResult } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';
import { useFoilProducts, useProducts, getDbProductPriceInPLN, DbProduct } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { supabase } from '@/integrations/supabase/client';
// Import new foil planners
import { 
  planStairsSurface, 
  planPaddlingPoolSurface,
  isStructuralFoil,
  isButtJointFoil,
  getAntiSlipFoilForStairs,
  calculateButtJointLength,
  StairsPlanResult,
  PaddlingPlanResult,
  FoilProduct
} from '@/lib/foil';
import { Badge } from '@/components/ui/badge';
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';

interface CoveringStepProps {
  onNext: () => void;
  onBack: () => void;
}

// Foil category types
type FoilCategory = 'jednokolorowa' | 'nadruk' | 'strukturalna';

const foilCategoryLabels: Record<FoilCategory, string> = {
  jednokolorowa: 'Jednokolorowa',
  nadruk: 'Nadruk',
  strukturalna: 'Strukturalna',
};

const foilCategoryDescriptions: Record<FoilCategory, string> = {
  jednokolorowa: 'Alkorplan 2000 - gładka, dostępna w 1.65m i 2.05m',
  nadruk: 'Alkorplan 2000 z nadrukiem - tylko 1.65m',
  strukturalna: 'Alkorplan 3000 - premium, tylko 1.65m',
};

// Color display names
const colorLabels: Record<string, string> = {
  'niebieska': 'Niebieska',
  'biała': 'Biała',
  'turkus': 'Turkus',
  'szara': 'Szara',
  'piaskowa': 'Piaskowa',
  'persja niebieska': 'Persja Niebieska',
  'bizancjum niebieska': 'Bizancjum Niebieska',
  'marble': 'Marble',
  'vanity': 'Vanity',
  'greek': 'Greek',
  'carrara': 'Carrara',
  'antracyt': 'Antracyt',
  'standard': 'Standard',
};

// Color hex values for visual indicator
const colorHex: Record<string, string> = {
  'niebieska': '#3B82F6',
  'biała': '#F8FAFC',
  'turkus': '#14B8A6',
  'szara': '#6B7280',
  'piaskowa': '#D4A574',
  'persja niebieska': '#1E40AF',
  'bizancjum niebieska': '#312E81',
  'marble': '#E2E8F0',
  'vanity': '#C084FC',
  'greek': '#0EA5E9',
  'carrara': '#F1F5F9',
  'antracyt': '#374151',
  'standard': '#60A5FA',
};

// Material item with editable quantity
interface MaterialItem {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  suggestedQty: number;
  manualQty: number | null;
  pricePerUnit: number;
  productId?: string;
  isManual?: boolean;
}

export function CoveringStep({ onNext, onBack }: CoveringStepProps) {
  const { state, dispatch } = useConfigurator();
  const { companySettings } = useSettings();
  const { dimensions, sections, foilType } = state;
  
  // Check if ceramic pool
  const isCeramic = dimensions.liningType === 'ceramiczny';
  
  // Fetch foils from database
  const { data: dbFoils, isLoading: foilsLoading } = useFoilProducts();
  
  // Search state for product search
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults, isLoading: searchLoading } = useProducts(searchQuery, 20);
  
  // State
  const [foilCategory, setFoilCategory] = useState<FoilCategory>('jednokolorowa');
  const [selectedColor, setSelectedColor] = useState<string>('niebieska');
  const [selectedFoil, setSelectedFoil] = useState<Product | null>(null);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  
  // Calculate foil optimization
  const foilCalc = useMemo(() => {
    return calculateFoilOptimization(
      dimensions,
      foilType,
      companySettings.irregularSurchargePercent
    );
  }, [dimensions, foilType, companySettings.irregularSurchargePercent]);

  // Use new foil planners for stairs and paddling pool
  const stairsPlan = useMemo((): StairsPlanResult | null => {
    if (!dimensions.stairs.enabled) return null;
    return planStairsSurface(dimensions.stairs, dimensions.depth, dimensions);
  }, [dimensions]);

  const paddlingPlan = useMemo((): PaddlingPlanResult | null => {
    if (!dimensions.wadingPool.enabled) return null;
    return planPaddlingPoolSurface(dimensions.wadingPool, dimensions.depth, dimensions);
  }, [dimensions]);

  // Calculate anti-slip areas from plans
  const antiSlipBreakdown = useMemo(() => {
    const stairsStepArea = stairsPlan?.stepArea || 0;
    const paddlingBottomArea = paddlingPlan?.bottomArea || 0;
    const totalAntiSlip = stairsStepArea + paddlingBottomArea;
    
    // Regular foil areas for stairs/paddling (risers, walls, dividing wall)
    const stairsRiserArea = stairsPlan?.riserArea || 0;
    const paddlingWallsArea = paddlingPlan?.wallsArea || 0;
    const dividingWallArea = paddlingPlan?.dividingWall 
      ? paddlingPlan.dividingWall.poolSideArea + 
        paddlingPlan.dividingWall.paddlingSideArea + 
        paddlingPlan.dividingWall.topArea
      : 0;
    const totalRegularExtra = stairsRiserArea + paddlingWallsArea + dividingWallArea;
    
    return {
      stairsStepArea,
      stairsRiserArea,
      paddlingBottomArea,
      paddlingWallsArea,
      dividingWall: paddlingPlan?.dividingWall,
      totalAntiSlip,
      totalRegularExtra,
    };
  }, [stairsPlan, paddlingPlan]);

  // Check if selected foil is structural (anti-slip already)
  const selectedFoilIsStructural = useMemo(() => {
    if (!selectedFoil) return false;
    return foilCategory === 'strukturalna';
  }, [selectedFoil, foilCategory]);

  // Check if selected foil uses butt joint (structural foils)
  const selectedFoilIsButtJoint = useMemo(() => {
    if (!selectedFoil || !dbFoils) return false;
    // Find the foil in dbFoils to check its properties
    const dbFoil = dbFoils.find(f => f.id === selectedFoil.id);
    // Structural foils use butt joints
    return foilCategory === 'strukturalna' || dbFoil?.type === 'strukturalna';
  }, [selectedFoil, dbFoils, foilCategory]);

  // Calculate butt joint length for structural foils
  const buttJointInfo = useMemo(() => {
    if (!selectedFoilIsButtJoint || !foilCalc) return null;
    
    // Estimate butt joint length from bottom strips
    // Butt joints occur between adjacent strips on the pool bottom
    const bottomStrips = foilCalc.strips?.filter(s => 
      s.surface === 'bottom'
    ) || [];
    
    if (bottomStrips.length <= 1) return { length: 0, cost: 0 };
    
    // Calculate total joint length (between adjacent strips)
    let totalJointLength = 0;
    for (let i = 1; i < bottomStrips.length; i++) {
      // Joint runs the full strip length (the shorter of the two)
      totalJointLength += Math.min(
        bottomStrips[i - 1].stripLength,
        bottomStrips[i].stripLength
      );
    }
    
    const BUTT_WELD_PRICE_PER_M = 15; // zł/mb
    
    return {
      length: totalJointLength,
      cost: totalJointLength * BUTT_WELD_PRICE_PER_M,
      pricePerM: BUTT_WELD_PRICE_PER_M,
    };
  }, [selectedFoilIsButtJoint, foilCalc]);

  // Initialize materials when foil calculation changes
  useEffect(() => {
    if (foilCalc && !isCeramic) {
      const totalArea = foilCalc.totalArea + antiSlipBreakdown.totalRegularExtra;
      const antislipArea = antiSlipBreakdown.totalAntiSlip;
      
      const defaultMaterials: MaterialItem[] = [
        {
          id: 'foil-main',
          name: 'Folia basenowa',
          symbol: 'FOLIA',
          unit: 'm²',
          suggestedQty: Math.ceil(totalArea),
          manualQty: null,
          pricePerUnit: 85,
        },
        {
          id: 'underlay',
          name: 'Podkład pod folię (geowłóknina)',
          symbol: 'PODKLAD',
          unit: 'm²',
          suggestedQty: Math.ceil(totalArea * 1.1), // +10% for overlaps
          manualQty: null,
          pricePerUnit: 12,
        },
        {
          id: 'rivets',
          name: 'Nity montażowe',
          symbol: 'NITY',
          unit: 'szt',
          suggestedQty: Math.ceil(totalArea * 2), // ~2 per m²
          manualQty: null,
          pricePerUnit: 0.5,
        },
        {
          id: 'glue',
          name: 'Klej do folii',
          symbol: 'KLEJ',
          unit: 'szt',
          suggestedQty: Math.ceil(totalArea / 15), // 1 tube per 15m²
          manualQty: null,
          pricePerUnit: 65,
        },
        {
          id: 'profiles',
          name: 'Kątownik aluminiowy',
          symbol: 'KATOWNIK',
          unit: 'mb',
          suggestedQty: Math.ceil((dimensions.length + dimensions.width) * 2 * 1.1), // perimeter + 10%
          manualQty: null,
          pricePerUnit: 25,
        },
      ];
      
      // Add anti-slip foil if stairs or wading pool (and main foil is NOT structural)
      if (antislipArea > 0 && !selectedFoilIsStructural) {
        defaultMaterials.push({
          id: 'antislip',
          name: 'Folia antypoślizgowa (schody/brodzik)',
          symbol: 'ANTYSLIP',
          unit: 'm²',
          suggestedQty: Math.ceil(antislipArea * 1.1), // +10% for overlaps
          manualQty: null,
          pricePerUnit: 120,
        });
      }
      
      // Add butt welding service for structural foils
      if (selectedFoilIsButtJoint && buttJointInfo && buttJointInfo.length > 0) {
        defaultMaterials.push({
          id: 'butt-welding',
          name: 'Usługa zgrzewania doczołowego',
          symbol: 'ZGRZEW-DOC',
          unit: 'mb',
          suggestedQty: Math.ceil(buttJointInfo.length * 10) / 10, // Round to 0.1m
          manualQty: null,
          pricePerUnit: buttJointInfo.pricePerM,
        });
      }
      
      // Add extra regular foil for risers, paddling walls, dividing wall
      if (antiSlipBreakdown.totalRegularExtra > 0) {
        // This is already included in the main foil calculation via totalArea adjustment
        // No need for separate line item, but we track it for display
      }
      
      setMaterials(defaultMaterials);
    }
  }, [foilCalc, isCeramic, antiSlipBreakdown, selectedFoilIsStructural, selectedFoilIsButtJoint, buttJointInfo, dimensions]);

  // Get available colors from database
  const availableColors = useMemo(() => {
    if (!dbFoils) return [];
    
    // Map foil category to database type
    const dbType = foilCategory === 'strukturalna' ? 'strukturalna' : 'tradycyjna';
    const foilsOfType = dbFoils.filter(f => f.type === dbType);
    const colors = [...new Set(foilsOfType.map(f => f.color))];
    return colors.sort();
  }, [dbFoils, foilCategory]);

  // Get displayed foils
  const displayedFoils = useMemo(() => {
    if (!dbFoils) return [];
    
    const dbType = foilCategory === 'strukturalna' ? 'strukturalna' : 'tradycyjna';
    let filtered = dbFoils.filter(f => f.type === dbType);
    
    // Filter by color if selected
    if (selectedColor && filtered.some(f => f.color === selectedColor)) {
      filtered = filtered.filter(f => f.color === selectedColor);
    }
    
    // For non-jednokolorowa, only show 1.65m width
    if (foilCategory !== 'jednokolorowa') {
      filtered = filtered.filter(f => f.width === 1.65);
    }
    
    return filtered.map(f => ({
      id: f.id,
      symbol: f.symbol,
      name: f.name,
      price: f.price,
      currency: f.currency,
      category: 'folia' as const,
      specs: { szerokosc: f.width, typ: f.type, grubosc: 1.5 },
    }));
  }, [dbFoils, foilCategory, selectedColor]);

  // Set first available color when category changes
  useEffect(() => {
    if (availableColors.length > 0 && !availableColors.includes(selectedColor)) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors, selectedColor]);

  // Handle material quantity change
  const handleMaterialQtyChange = (id: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setMaterials(prev => prev.map(m => 
      m.id === id ? { ...m, manualQty: numValue } : m
    ));
  };

  // Reset to suggested quantity
  const resetToSuggested = (id: string) => {
    setMaterials(prev => prev.map(m => 
      m.id === id ? { ...m, manualQty: null } : m
    ));
  };

  // Add product from search
  const handleAddProduct = (product: DbProduct) => {
    const newMaterial: MaterialItem = {
      id: `manual-${Date.now()}`,
      name: product.name,
      symbol: product.symbol,
      unit: 'szt',
      suggestedQty: 1,
      manualQty: 1,
      pricePerUnit: getDbProductPriceInPLN(product),
      productId: product.id,
      isManual: true,
    };
    setMaterials(prev => [...prev, newMaterial]);
    setShowSearch(false);
    setSearchQuery('');
  };

  // Remove manual material
  const handleRemoveMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // Handle foil selection
  const handleFoilSelect = (product: Product) => {
    setSelectedFoil(product);
    
    // Update main foil price in materials
    setMaterials(prev => prev.map(m => 
      m.id === 'foil-main' 
        ? { ...m, pricePerUnit: getPriceInPLN(product), name: product.name }
        : m
    ));
    
    // Update section with selected foil
    const item: OfferItem = {
      id: `foil-${product.id}`,
      product,
      quantity: Math.ceil(foilCalc?.totalArea || 0),
    };
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'wykonczenie',
        data: {
          ...sections.wykonczenie,
          items: [item],
          suggestedProduct: product,
        },
      },
    });
  };

  // Calculate total
  const totalCost = useMemo(() => {
    return materials.reduce((sum, m) => {
      const qty = m.manualQty ?? m.suggestedQty;
      return sum + (qty * m.pricePerUnit);
    }, 0);
  }, [materials]);

  // If ceramic pool, show placeholder
  if (isCeramic) {
    return (
      <div className="animate-slide-up">
        <div className="section-header">
          <Layers className="w-5 h-5 text-primary" />
          Pokrycie basenu
        </div>
        
        <Card className="glass-card">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Layers className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Basen ceramiczny</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Tu będzie kalkulacja na basen ceramiczny. 
                Funkcjonalność w przygotowaniu.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div className="section-header">
        <Palette className="w-5 h-5 text-primary" />
        Pokrycie basenu - Folia
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Configuration */}
        <div className="space-y-4">
          {/* Foil category selection */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kategoria folii</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={foilCategory}
                onValueChange={(v) => setFoilCategory(v as FoilCategory)}
                className="space-y-2"
              >
                {(Object.keys(foilCategoryLabels) as FoilCategory[]).map(cat => (
                  <div key={cat} className="relative">
                    <RadioGroupItem value={cat} id={cat} className="peer sr-only" />
                    <Label
                      htmlFor={cat}
                      className="flex flex-col p-3 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                    >
                      <span className="font-medium">{foilCategoryLabels[cat]}</span>
                      <span className="text-xs text-muted-foreground">
                        {foilCategoryDescriptions[cat]}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Color filter */}
          {availableColors.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Kolor folii</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: colorHex[selectedColor] || '#60A5FA' }}
                        />
                        {colorLabels[selectedColor] || selectedColor}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableColors.map(color => (
                      <SelectItem key={color} value={color}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-border"
                            style={{ backgroundColor: colorHex[color] || '#60A5FA' }}
                          />
                          {colorLabels[color] || color}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Calculation summary */}
          {foilCalc && (
            <Card className="glass-card border-accent/20 bg-accent/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <Calculator className="w-4 h-4 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Zapotrzebowanie</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <HelpCircle className="w-3 h-3 mr-1" />
                            Szczegóły
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Sposób kalkulacji rolek folii</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 text-sm">
                            {/* Legend */}
                            <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30 border border-border">
                              <span className="text-xs font-medium">Legenda:</span>
                              <span className="flex items-center gap-1 text-xs">
                                <span className="w-3 h-3 rounded-sm bg-blue-500" />
                                Folia regularna
                              </span>
                              <span className="flex items-center gap-1 text-xs">
                                <span className="w-3 h-3 rounded-sm bg-orange-500" />
                                Folia antypoślizgowa
                              </span>
                            </div>
                            
                            {/* Section 1: Basic pool surface */}
                            <div>
                              <h4 className="font-semibold mb-2">1. Obliczenie powierzchni niecki</h4>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Dno basenu: {dimensions.length} × {dimensions.width} = {(dimensions.length * dimensions.width).toFixed(2)} m²</li>
                                <li>Ściany długie: 2 × {dimensions.length} × {dimensions.depth} = {(2 * dimensions.length * dimensions.depth).toFixed(2)} m²</li>
                                <li>Ściany krótkie: 2 × {dimensions.width} × {dimensions.depth} = {(2 * dimensions.width * dimensions.depth).toFixed(2)} m²</li>
                                <li className="font-medium text-foreground">Suma podstawowa: {((dimensions.length * dimensions.width) + (2 * dimensions.length * dimensions.depth) + (2 * dimensions.width * dimensions.depth)).toFixed(2)} m²</li>
                              </ul>
                            </div>
                            
                            {/* Section 1a: Stairs */}
                            {dimensions.stairs.enabled && stairsPlan && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <span>📐</span>
                                  1a. Schody
                                </h4>
                                <div className="space-y-2 text-muted-foreground">
                                  <ul className="list-disc list-inside space-y-1">
                                    <li>Liczba stopni: {dimensions.stairs.stepCount}</li>
                                    <li>Wymiary stopnia: {dimensions.stairs.stepDepth}m × {dimensions.stairs.stepHeight}m</li>
                                    <li>Szerokość schodów: {dimensions.stairs.width}m</li>
                                  </ul>
                                  
                                  <div className="mt-3 rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-xs">
                                      <tbody>
                                        <tr className="border-b border-border">
                                          <td className="p-2 bg-muted/30">Stopnie (poziome)</td>
                                          <td className="p-2 text-right font-medium">{stairsPlan.stepArea.toFixed(2)} m²</td>
                                          <td className="p-2 text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                              🟧 antypoślizgowa
                                            </span>
                                          </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                          <td className="p-2 bg-muted/30">Podstopnie (pionowe)</td>
                                          <td className="p-2 text-right font-medium">{stairsPlan.riserArea.toFixed(2)} m²</td>
                                          <td className="p-2 text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                              🟦 regularna
                                            </span>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="p-2 bg-muted/50 font-medium">Razem schody</td>
                                          <td className="p-2 text-right font-bold">{(stairsPlan.stepArea + stairsPlan.riserArea).toFixed(2)} m²</td>
                                          <td className="p-2"></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Section 1b: Paddling pool */}
                            {dimensions.wadingPool.enabled && paddlingPlan && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <span>🌊</span>
                                  1b. Brodzik
                                </h4>
                                <div className="space-y-2 text-muted-foreground">
                                  <ul className="list-disc list-inside space-y-1">
                                    <li>Wymiary: {dimensions.wadingPool.width}m × {dimensions.wadingPool.length}m × {dimensions.wadingPool.depth}m</li>
                                  </ul>
                                  
                                  <div className="mt-3 rounded-lg border border-border overflow-hidden">
                                    <table className="w-full text-xs">
                                      <tbody>
                                        <tr className="border-b border-border">
                                          <td className="p-2 bg-muted/30">Dno brodzika</td>
                                          <td className="p-2 text-right font-medium">{paddlingPlan.bottomArea.toFixed(2)} m²</td>
                                          <td className="p-2 text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                              🟧 antypoślizgowa
                                            </span>
                                          </td>
                                        </tr>
                                        <tr className="border-b border-border">
                                          <td className="p-2 bg-muted/30">Ściany zewnętrzne (3 strony)</td>
                                          <td className="p-2 text-right font-medium">{paddlingPlan.wallsArea.toFixed(2)} m²</td>
                                          <td className="p-2 text-right">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                              🟦 regularna
                                            </span>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="p-2 bg-muted/50 font-medium">Razem brodzik</td>
                                          <td className="p-2 text-right font-bold">{(paddlingPlan.bottomArea + paddlingPlan.wallsArea).toFixed(2)} m²</td>
                                          <td className="p-2"></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                  
                                  {/* Dividing wall detail */}
                                  {paddlingPlan.dividingWall && (
                                    <div className="mt-3">
                                      <p className="text-sm font-medium text-foreground mb-2">Murek rozdzielający:</p>
                                      <div className="rounded-lg border border-border overflow-hidden">
                                        <table className="w-full text-xs">
                                          <tbody>
                                            <tr className="border-b border-border">
                                              <td className="p-2 bg-muted/30">Strona basenu (wys. {(dimensions.depth - dimensions.wadingPool.depth).toFixed(2)}m)</td>
                                              <td className="p-2 text-right font-medium">{paddlingPlan.dividingWall.poolSideArea.toFixed(2)} m²</td>
                                              <td className="p-2 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                  🟦 regularna
                                                </span>
                                              </td>
                                            </tr>
                                            {paddlingPlan.dividingWall.paddlingSideArea > 0 && (
                                              <tr className="border-b border-border">
                                                <td className="p-2 bg-muted/30">Strona brodzika</td>
                                                <td className="p-2 text-right font-medium">{paddlingPlan.dividingWall.paddlingSideArea.toFixed(2)} m²</td>
                                                <td className="p-2 text-right">
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    🟦 regularna
                                                  </span>
                                                </td>
                                              </tr>
                                            )}
                                            <tr className="border-b border-border">
                                              <td className="p-2 bg-muted/30">Góra murka (szer. 0.15m)</td>
                                              <td className="p-2 text-right font-medium">{paddlingPlan.dividingWall.topArea.toFixed(2)} m²</td>
                                              <td className="p-2 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                  🟦 regularna
                                                </span>
                                              </td>
                                            </tr>
                                            <tr>
                                              <td className="p-2 bg-muted/50 font-medium">Razem murek</td>
                                              <td className="p-2 text-right font-bold">
                                                {(paddlingPlan.dividingWall.poolSideArea + 
                                                  paddlingPlan.dividingWall.paddlingSideArea + 
                                                  paddlingPlan.dividingWall.topArea).toFixed(2)} m²
                                              </td>
                                              <td className="p-2"></td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Section 2: Overages */}
                            <div className="border-t pt-4">
                              <h4 className="font-semibold mb-2">2. Naddatki</h4>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Zakładki spawów: +10% na zakłady między pasami</li>
                                {dimensions.isIrregular && (
                                  <li>Kształt nieregularny: +{companySettings.irregularSurchargePercent || 20}% na docinanie</li>
                                )}
                              </ul>
                            </div>
                            
                            {/* Section 3: Roll optimization */}
                            <div className="border-t pt-4">
                              <h4 className="font-semibold mb-2">3. Optymalizacja rolek</h4>
                              <p className="text-muted-foreground mb-2">
                                Folia jest układana pasami wzdłuż dłuższego boku basenu, aby zminimalizować ilość spawów.
                              </p>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Rolki 1,65m: optymalne dla węższych powierzchni</li>
                                <li>Rolki 2,05m: optymalne dla szerszych powierzchni</li>
                                <li>Długość rolki: 25 mb</li>
                                <li>Zakładka między pasami: 10 cm</li>
                              </ul>
                            </div>
                            
                            {/* Section 4: Results summary */}
                            <div className="border-t pt-4">
                              <h4 className="font-semibold mb-2">4. Podsumowanie</h4>
                              
                              {/* Foil type breakdown table */}
                              <div className="rounded-lg border border-border overflow-hidden mb-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                      <th className="p-2 text-left font-medium">Typ folii</th>
                                      <th className="p-2 text-right font-medium">Powierzchnia</th>
                                      <th className="p-2 text-right font-medium">Rolki</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="border-b border-border">
                                      <td className="p-2">
                                        <span className="flex items-center gap-2">
                                          <span className="w-3 h-3 rounded-sm bg-blue-500" />
                                          Folia główna (niecka)
                                        </span>
                                      </td>
                                      <td className="p-2 text-right font-medium">{foilCalc.totalArea.toFixed(1)} m²</td>
                                      <td className="p-2 text-right text-muted-foreground">
                                        {foilCalc.rolls165 > 0 && <span>1,65m: {foilCalc.rolls165}</span>}
                                        {foilCalc.rolls165 > 0 && foilCalc.rolls205 > 0 && <span>, </span>}
                                        {foilCalc.rolls205 > 0 && <span>2,05m: {foilCalc.rolls205}</span>}
                                      </td>
                                    </tr>
                                    {antiSlipBreakdown.totalRegularExtra > 0 && (
                                      <tr className="border-b border-border">
                                        <td className="p-2">
                                          <span className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-sm bg-blue-500" />
                                            Dodatkowa folia regularna
                                          </span>
                                          <span className="block text-xs text-muted-foreground mt-0.5">
                                            (podstopnie + ściany brodzika + murek)
                                          </span>
                                        </td>
                                        <td className="p-2 text-right font-medium">{antiSlipBreakdown.totalRegularExtra.toFixed(1)} m²</td>
                                        <td className="p-2 text-right text-muted-foreground">-</td>
                                      </tr>
                                    )}
                                    {antiSlipBreakdown.totalAntiSlip > 0 && !selectedFoilIsStructural && (
                                      <tr className="border-b border-border">
                                        <td className="p-2">
                                          <span className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-sm bg-orange-500" />
                                            Folia antypoślizgowa
                                          </span>
                                          <span className="block text-xs text-muted-foreground mt-0.5">
                                            (stopnie schodów + dno brodzika)
                                          </span>
                                        </td>
                                        <td className="p-2 text-right font-medium">{antiSlipBreakdown.totalAntiSlip.toFixed(1)} m²</td>
                                        <td className="p-2 text-right text-muted-foreground">-</td>
                                      </tr>
                                    )}
                                    <tr className="bg-muted/30">
                                      <td className="p-2 font-medium" colSpan={2}>
                                        RAZEM folia regularna
                                      </td>
                                      <td className="p-2 text-right font-bold">
                                        {(foilCalc.totalArea + antiSlipBreakdown.totalRegularExtra).toFixed(1)} m²
                                      </td>
                                    </tr>
                                    {antiSlipBreakdown.totalAntiSlip > 0 && !selectedFoilIsStructural && (
                                      <tr className="bg-orange-50 dark:bg-orange-900/10">
                                        <td className="p-2 font-medium" colSpan={2}>
                                          RAZEM antypoślizgowa
                                        </td>
                                        <td className="p-2 text-right font-bold text-orange-700 dark:text-orange-400">
                                          {antiSlipBreakdown.totalAntiSlip.toFixed(1)} m²
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Structural foil note */}
                              {selectedFoilIsStructural && antiSlipBreakdown.totalAntiSlip > 0 && (
                                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-3">
                                  <p className="text-xs text-green-800 dark:text-green-300">
                                    ✓ <strong>Folia strukturalna jest antypoślizgowa</strong> — nie wymaga osobnej folii na schody/dno brodzika
                                  </p>
                                </div>
                              )}
                              
                              {/* Basic stats */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-xs text-muted-foreground">Rolki 1,65m</p>
                                  <p className="font-medium">{foilCalc.rolls165} szt.</p>
                                </div>
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-xs text-muted-foreground">Rolki 2,05m</p>
                                  <p className="font-medium">{foilCalc.rolls205} szt.</p>
                                </div>
                                <div className="p-2 rounded bg-muted/50">
                                  <p className="text-xs text-muted-foreground">Odpad</p>
                                  <p className="font-medium">{foilCalc.wastePercentage.toFixed(1)}%</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Section 5: Strips layout */}
                            {foilCalc.strips && foilCalc.strips.length > 0 && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2">5. Układ pasów</h4>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {foilCalc.strips.map((strip, idx) => (
                                    <div key={idx} className="flex justify-between text-xs p-1 rounded bg-muted/30">
                                      <span className="text-muted-foreground">
                                        {strip.surface === 'bottom' ? 'Dno' : 
                                         strip.surface === 'wall-long' ? 'Ściana długa' : 'Ściana krótka'}
                                      </span>
                                      <span>
                                        {strip.rollWidth}m × {strip.stripLength.toFixed(2)}m 
                                        <span className="text-muted-foreground ml-1">(użyte: {strip.usedWidth.toFixed(2)}m)</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Section 6: Visual layout */}
                            <div className="border-t pt-4">
                              <h4 className="font-semibold mb-2">6. Wizualizacja układu folii</h4>
                              <FoilLayoutVisualization
                                dimensions={dimensions}
                                rollWidth={1.65}
                                label="Układ pasów folii (rolka 1.65m)"
                                stairsPlan={stairsPlan}
                                paddlingPlan={paddlingPlan}
                                showAntiSlipIndicators
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      {foilCalc.totalArea.toFixed(1)} m²
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <p>Rolki 1,65m: {foilCalc.rolls165} szt.</p>
                      <p>Rolki 2,05m: {foilCalc.rolls205} szt.</p>
                      <p className="text-primary font-medium">
                        Odpad: {foilCalc.wastePercentage.toFixed(1)}%
                      </p>
                      {antiSlipBreakdown.totalAntiSlip > 0 && (
                        <div className="pt-1 border-t border-border/50 mt-1">
                          <p className="text-accent font-medium flex items-center gap-1">
                            <Footprints className="w-3 h-3" />
                            Folia antypoślizgowa: {antiSlipBreakdown.totalAntiSlip.toFixed(1)} m²
                            {selectedFoilIsStructural && (
                              <span className="text-xs text-muted-foreground">(strukturalna)</span>
                            )}
                          </p>
                          {antiSlipBreakdown.stairsStepArea > 0 && (
                            <p className="text-xs text-muted-foreground ml-4">
                              • Stopnie schodów: {antiSlipBreakdown.stairsStepArea.toFixed(1)} m²
                            </p>
                          )}
                          {antiSlipBreakdown.paddlingBottomArea > 0 && (
                            <p className="text-xs text-muted-foreground ml-4">
                              • Dno brodzika: {antiSlipBreakdown.paddlingBottomArea.toFixed(1)} m²
                            </p>
                          )}
                        </div>
                      )}
                      {antiSlipBreakdown.totalRegularExtra > 0 && (
                        <div className="pt-1">
                          <p className="text-muted-foreground text-xs flex items-center gap-1">
                            <Waves className="w-3 h-3" />
                            Dodatkowa folia główna: {antiSlipBreakdown.totalRegularExtra.toFixed(1)} m²
                          </p>
                          {antiSlipBreakdown.stairsRiserArea > 0 && (
                            <p className="text-xs text-muted-foreground ml-4">
                              • Podstopnie: {antiSlipBreakdown.stairsRiserArea.toFixed(1)} m²
                            </p>
                          )}
                          {antiSlipBreakdown.paddlingWallsArea > 0 && (
                            <p className="text-xs text-muted-foreground ml-4">
                              • Ściany brodzika: {antiSlipBreakdown.paddlingWallsArea.toFixed(1)} m²
                            </p>
                          )}
                          {antiSlipBreakdown.dividingWall && (
                            <>
                              <p className="text-xs text-muted-foreground ml-4">
                                • Murek (strona basenu): {antiSlipBreakdown.dividingWall.poolSideArea.toFixed(1)} m²
                              </p>
                              {antiSlipBreakdown.dividingWall.paddlingSideArea > 0 && (
                                <p className="text-xs text-muted-foreground ml-4">
                                  • Murek (strona brodzika): {antiSlipBreakdown.dividingWall.paddlingSideArea.toFixed(1)} m²
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground ml-4">
                                • Góra murka: {antiSlipBreakdown.dividingWall.topArea.toFixed(1)} m²
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {foilsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ładowanie folii...
            </div>
          )}
        </div>

        {/* Middle column: Foil products */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Wybierz folię</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
              {displayedFoils.length === 0 && !foilsLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Brak folii dla wybranych kryteriów
                </p>
              )}
              {displayedFoils.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedFoil?.id === product.id}
                  isSuggested={index === 0}
                  onSelect={() => handleFoilSelect(product)}
                  compact
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Materials list */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Materiały</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Dodaj
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Product search */}
              {showSearch && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Szukaj produktu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {searchLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Szukanie...
                    </div>
                  )}
                  {searchResults && searchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {searchResults.slice(0, 10).map(product => (
                        <button
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                        >
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.symbol} • {formatPrice(getDbProductPriceInPLN(product))}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Materials list */}
              <div className="space-y-2">
                {materials.map(material => (
                  <div 
                    key={material.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border"
                  >
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{material.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(material.pricePerUnit)}/{material.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={material.manualQty ?? material.suggestedQty}
                        onChange={(e) => handleMaterialQtyChange(material.id, e.target.value)}
                        className="w-20 h-8 text-sm text-right"
                      />
                      <span className="text-xs text-muted-foreground w-8">
                        {material.unit}
                      </span>
                      {material.manualQty !== null && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => resetToSuggested(material.id)}
                          title="Przywróć sugerowaną ilość"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      )}
                      {material.isManual && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveMaterial(material.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Razem materiały:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(totalCost)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected foil summary */}
          {selectedFoil && foilCalc && (
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Wybrana folia</p>
                    <p className="font-medium truncate">{selectedFoil.name}</p>
                  </div>
                  {selectedFoilIsButtJoint && (
                    <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30 text-xs">
                      Zgrzewanie doczołowe
                    </Badge>
                  )}
                </div>
                
                {/* Butt joint info */}
                {selectedFoilIsButtJoint && buttJointInfo && buttJointInfo.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-accent/10 border border-accent/20">
                    <p className="text-xs text-accent font-medium">
                      Zgrzewy doczołowe: {buttJointInfo.length.toFixed(1)} mb
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Usługa: {buttJointInfo.length.toFixed(1)} mb × {formatPrice(buttJointInfo.pricePerM)}/mb = {formatPrice(buttJointInfo.cost)}
                    </p>
                  </div>
                )}
                
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {foilCalc.totalArea.toFixed(1)} m² × {formatPrice(getPriceInPLN(selectedFoil))}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(getPriceInPLN(selectedFoil) * foilCalc.totalArea)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
