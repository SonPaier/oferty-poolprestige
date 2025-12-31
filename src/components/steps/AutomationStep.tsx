import { useState, useMemo, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { Cpu, Thermometer, Search, Info, Loader2, Sun, Flame, Plus, X } from 'lucide-react';
import { products, Product, ProductCategory, getPriceInPLN } from '@/data/products';
import { OfferItem } from '@/types/configurator';
import { formatPrice } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface AutomationStepProps {
  onNext: () => void;
  onBack: () => void;
}

type HeatingSourceType = 'pompa-ciepla' | 'wymiennik-co' | 'solar';

const heatingSourceLabels: Record<HeatingSourceType, { label: string; icon: React.ReactNode }> = {
  'pompa-ciepla': { label: 'Pompa ciepła', icon: <Thermometer className="w-4 h-4" /> },
  'wymiennik-co': { label: 'Wymiennik CO', icon: <Flame className="w-4 h-4" /> },
  'solar': { label: 'Kolektory słoneczne', icon: <Sun className="w-4 h-4" /> },
};

interface HeatingSelection {
  type: HeatingSourceType;
  product: Product | null;
  quantity: number;
}

export function AutomationStep({ onNext, onBack }: AutomationStepProps) {
  const { state, dispatch } = useConfigurator();
  const { sections, calculations } = state;
  
  const volume = calculations?.volume || 50;
  
  // Recommended heat pump power: roughly 1kW per 5m³ of water
  const recommendedPower = Math.ceil(volume / 5);
  
  const automationProducts = products.filter(p => p.category === 'automatyka');
  const controllers = automationProducts.filter(p => 
    p.name.toLowerCase().includes('sterownik') || 
    p.name.toLowerCase().includes('automat')
  );
  
  // Get heat exchangers and solar products from local data
  const heatExchangers = useMemo(() => {
    return products.filter(p => {
      const name = p.name.toLowerCase();
      return name.includes('wymiennik');
    });
  }, []);
  
  const solarProducts = useMemo(() => {
    return products.filter(p => {
      const name = p.name.toLowerCase();
      return name.includes('solar') || name.includes('kolektor');
    });
  }, []);

  const [selectedItems, setSelectedItems] = useState<Record<string, Product>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [dbHeatPumps, setDbHeatPumps] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Multiple heating sources
  const [heatingSources, setHeatingSources] = useState<HeatingSelection[]>([
    { type: 'pompa-ciepla', product: null, quantity: 1 }
  ]);
  
  // Extract power from pump name (e.g., "Pompa ciepła XYZ 14kW" -> 14)
  const extractPower = (name: string): number => {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*kw/i);
    if (match) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return 0;
  };

  // Fetch heat pumps from database on mount
  useEffect(() => {
    const fetchHeatPumps = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or('name.ilike.%pompa ciepła%,name.ilike.%heat pump%,category.eq.pompy_ciepla')
          .gt('price', 0)
          .order('price', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          const mapped: Product[] = data.map(p => ({
            id: p.id,
            symbol: p.symbol,
            name: p.name,
            price: p.price,
            currency: p.currency as 'PLN' | 'EUR',
            category: (p.category || 'automatyka') as ProductCategory,
            description: p.description || undefined,
          }));
          setDbHeatPumps(mapped);
        }
      } catch (err) {
        console.error('Error fetching heat pumps:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHeatPumps();
  }, []);
  
  // Search heating products in database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const searchProducts = async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${searchQuery}%,symbol.ilike.%${searchQuery}%`)
          .gt('price', 0)
          .limit(20);
        
        if (error) throw error;
        
        if (data) {
          const mapped: Product[] = data.map(p => ({
            id: p.id,
            symbol: p.symbol,
            name: p.name,
            price: p.price,
            currency: p.currency as 'PLN' | 'EUR',
            category: (p.category || 'automatyka') as ProductCategory,
            description: p.description || undefined,
          }));
          setSearchResults(mapped);
        }
      } catch (err) {
        console.error('Error searching products:', err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);
  
  // Sort heat pumps by extracted power (kW)
  const sortedHeatPumps = useMemo(() => {
    return [...dbHeatPumps]
      .map(p => ({ ...p, power: extractPower(p.name) }))
      .filter(p => p.power > 0)
      .sort((a, b) => a.power - b.power);
  }, [dbHeatPumps]);
  
  // Find suggested pump
  const suggestedPump = useMemo(() => {
    const suitable = sortedHeatPumps.find(p => p.power >= recommendedPower);
    return suitable || (sortedHeatPumps.length > 0 ? sortedHeatPumps[sortedHeatPumps.length - 1] : null);
  }, [sortedHeatPumps, recommendedPower]);
  
  // Get alternatives
  const alternatives = useMemo(() => {
    if (!suggestedPump) return [];
    const suggestedIndex = sortedHeatPumps.findIndex(p => p.id === suggestedPump.id);
    return sortedHeatPumps.slice(suggestedIndex + 1, suggestedIndex + 3);
  }, [sortedHeatPumps, suggestedPump]);

  const toggleProduct = (product: Product) => {
    setSelectedItems(prev => {
      if (prev[product.id]) {
        const { [product.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: product };
    });
  };
  
  // Add heating source
  const addHeatingSource = (type: HeatingSourceType) => {
    setHeatingSources(prev => [...prev, { type, product: null, quantity: 1 }]);
  };
  
  // Remove heating source
  const removeHeatingSource = (index: number) => {
    setHeatingSources(prev => prev.filter((_, i) => i !== index));
  };
  
  // Update heating source product
  const updateHeatingProduct = (index: number, product: Product | null) => {
    setHeatingSources(prev => prev.map((source, i) => 
      i === index ? { ...source, product } : source
    ));
  };
  
  // Update heating source quantity
  const updateHeatingQuantity = (index: number, quantity: number) => {
    setHeatingSources(prev => prev.map((source, i) => 
      i === index ? { ...source, quantity } : source
    ));
  };
  
  // Get products for heating source type
  const getProductsForHeatingType = (type: HeatingSourceType): Product[] => {
    switch (type) {
      case 'pompa-ciepla':
        return sortedHeatPumps;
      case 'wymiennik-co':
        return heatExchangers;
      case 'solar':
        return solarProducts;
      default:
        return [];
    }
  };

  // Auto-save section when selections change
  useEffect(() => {
    const items: OfferItem[] = [];
    
    // Add controllers
    Object.values(selectedItems).forEach(product => {
      items.push({
        id: `auto-${product.id}`,
        product,
        quantity: 1,
      });
    });
    
    // Add heating sources
    heatingSources.forEach((source, idx) => {
      if (source.product) {
        items.push({
          id: `heating-${idx}-${source.product.id}`,
          product: source.product,
          quantity: source.quantity,
        });
      }
    });
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'automatyka',
        data: { ...sections.automatyka, items },
      },
    });
  }, [selectedItems, heatingSources]);

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Cpu className="w-5 h-5 text-primary" />
        Automatyka i sterowanie
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Controllers */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            Sterowniki i dozowniki
          </h3>
          <div className="space-y-3">
            {controllers.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={!!selectedItems[product.id]}
                isSuggested={index === 0}
                onSelect={() => toggleProduct(product)}
              />
            ))}
          </div>
        </div>

        {/* Info panel */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            Informacje
          </h3>
          
          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
            <p className="text-sm font-medium">Zalecana moc grzewcza dla {volume.toFixed(0)} m³</p>
            <p className="text-sm text-muted-foreground">Min. ~{recommendedPower} kW</p>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
            <p>
              <strong>Wskazówka:</strong> Sterownik PCS zapewnia pełną automatyzację obsługi basenu - 
              kontrola pH, chloru, temperatury i więcej. Zarządzanie przez internet.
            </p>
          </div>
        </div>
      </div>

      {/* Heating sources */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            Źródła ogrzewania
          </h3>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => addHeatingSource('pompa-ciepla')}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Pompa ciepła
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => addHeatingSource('wymiennik-co')}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Wymiennik CO
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => addHeatingSource('solar')}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Solar
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {heatingSources.map((source, index) => {
            const sourceInfo = heatingSourceLabels[source.type];
            const availableProducts = getProductsForHeatingType(source.type);
            
            return (
              <div key={index} className="p-4 rounded-lg bg-muted/20 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {sourceInfo.icon}
                    <span className="font-medium">{sourceInfo.label} #{index + 1}</span>
                  </div>
                  {heatingSources.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeHeatingSource(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {source.type === 'pompa-ciepla' && (
                  <>
                    {/* Suggested pump */}
                    {suggestedPump && !source.product && (
                      <div className="mb-3">
                        <p className="text-xs text-accent mb-2 uppercase tracking-wide">Sugerowana</p>
                        <ProductCard
                          product={suggestedPump}
                          isSelected={false}
                          isSuggested
                          quantity={source.quantity}
                          onSelect={() => updateHeatingProduct(index, suggestedPump)}
                          onQuantityChange={(qty) => updateHeatingQuantity(index, qty)}
                        />
                      </div>
                    )}
                    
                    {/* Selected product */}
                    {source.product && (
                      <div className="mb-3">
                        <p className="text-xs text-accent mb-2 uppercase tracking-wide">Wybrano</p>
                        <ProductCard
                          product={source.product}
                          isSelected={true}
                          quantity={source.quantity}
                          onSelect={() => updateHeatingProduct(index, null)}
                          onQuantityChange={(qty) => updateHeatingQuantity(index, qty)}
                        />
                      </div>
                    )}
                    
                    {/* Alternatives */}
                    {!source.product && alternatives.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Alternatywy</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {alternatives.map(product => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              isSelected={false}
                              onSelect={() => updateHeatingProduct(index, product)}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {source.type !== 'pompa-ciepla' && (
                  <div className="space-y-2">
                    {availableProducts.length > 0 ? (
                      availableProducts.slice(0, 4).map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          isSelected={source.product?.id === product.id}
                          quantity={source.quantity}
                          onSelect={() => updateHeatingProduct(
                            index, 
                            source.product?.id === product.id ? null : product
                          )}
                          onQuantityChange={(qty) => updateHeatingQuantity(index, qty)}
                          compact
                        />
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Brak produktów tego typu w bazie
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Search all heating products */}
      <div className="glass-card p-6">
        <h3 className="text-base font-medium mb-4">Szukaj produktów grzewczych</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po nazwie lub symbolu..."
            className="pl-9 input-field"
          />
        </div>
        
        {searchQuery && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {searchResults.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={!!selectedItems[product.id]}
                    onSelect={() => toggleProduct(product)}
                    compact
                  />
                ))}
                {searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Brak wyników dla "{searchQuery}"
                  </p>
                )}
              </>
            )}
          </div>
        )}
        
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
