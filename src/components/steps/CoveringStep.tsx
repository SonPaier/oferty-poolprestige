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
  GripVertical
} from 'lucide-react';
import { Product, getPriceInPLN } from '@/data/products';
import { formatPrice, calculateFoilOptimization, FoilOptimizationResult } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';
import { useFoilProducts, useProducts, getDbProductPriceInPLN, DbProduct } from '@/hooks/useProducts';
import { ProductCard } from '@/components/ProductCard';
import { supabase } from '@/integrations/supabase/client';

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

  // Calculate stairs and wading pool areas for anti-slip foil
  const stairsArea = useMemo(() => {
    if (dimensions.customStairsVertices && dimensions.customStairsVertices.length > 0) {
      return dimensions.customStairsVertices.length * 4; // 4m² per stair set
    }
    return dimensions.stairs.enabled ? 4 : 0;
  }, [dimensions]);

  const wadingPoolArea = useMemo(() => {
    if (dimensions.customWadingPoolVertices && dimensions.customWadingPoolVertices.length > 0) {
      return dimensions.customWadingPoolVertices.length * 2; // 2m² per wading pool
    }
    return dimensions.wadingPool.enabled ? 2 : 0;
  }, [dimensions]);

  // Initialize materials when foil calculation changes
  useEffect(() => {
    if (foilCalc && !isCeramic) {
      const totalArea = foilCalc.totalArea;
      const antislipArea = stairsArea + wadingPoolArea;
      
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
      
      // Add anti-slip foil if stairs or wading pool
      if (antislipArea > 0) {
        defaultMaterials.push({
          id: 'antislip',
          name: 'Folia antypoślizgowa',
          symbol: 'ANTYSLIP',
          unit: 'm²',
          suggestedQty: Math.ceil(antislipArea),
          manualQty: null,
          pricePerUnit: 120,
        });
      }
      
      setMaterials(defaultMaterials);
    }
  }, [foilCalc, isCeramic, stairsArea, wadingPoolArea, dimensions]);

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
                    <p className="text-sm font-medium">Zapotrzebowanie</p>
                    <p className="text-2xl font-bold mt-1">
                      {foilCalc.totalArea.toFixed(1)} m²
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <p>Rolki 1,65m: {foilCalc.rolls165} szt.</p>
                      <p>Rolki 2,05m: {foilCalc.rolls205} szt.</p>
                      <p className="text-primary font-medium">
                        Odpad: {foilCalc.wastePercentage.toFixed(1)}%
                      </p>
                      {(stairsArea > 0 || wadingPoolArea > 0) && (
                        <p className="text-accent">
                          Folia antypoślizgowa: {stairsArea + wadingPoolArea} m²
                        </p>
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
                <p className="text-sm text-muted-foreground">Wybrana folia</p>
                <p className="font-medium truncate">{selectedFoil.name}</p>
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
