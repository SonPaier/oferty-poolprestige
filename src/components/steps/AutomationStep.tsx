import { useState, useMemo, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Cpu, Thermometer, Search, Info, Loader2 } from 'lucide-react';
import { products, Product, ProductCategory, getPriceInPLN } from '@/data/products';
import { OfferItem } from '@/types/configurator';
import { formatPrice } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';

interface AutomationStepProps {
  onNext: () => void;
  onBack: () => void;
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
  
  // All heating products from local data (for non-pump items)
  const localHeating = automationProducts.filter(p => 
    p.name.toLowerCase().includes('wymiennik') ||
    (p.subcategory === 'grzanie' && !p.name.toLowerCase().includes('pompa ciepła'))
  );

  const [selectedItems, setSelectedItems] = useState<Record<string, Product>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [dbHeatPumps, setDbHeatPumps] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
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
          .gt('price', 0) // Exclude products with price 0
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
  
  // Search heat pumps in database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const searchPumps = async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`name.ilike.%${searchQuery}%,symbol.ilike.%${searchQuery}%`)
          .gt('price', 0) // Exclude products with price 0
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
          // Filter by search query client-side for accuracy
          const filtered = mapped.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error searching heat pumps:', err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchPumps, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);
  
  // Sort heat pumps by extracted power (kW)
  const sortedHeatPumps = useMemo(() => {
    return [...dbHeatPumps]
      .map(p => ({ ...p, power: extractPower(p.name) }))
      .filter(p => p.power > 0) // Only pumps with detectable power
      .sort((a, b) => a.power - b.power);
  }, [dbHeatPumps]);
  
  // Find suggested pump - first one with power >= recommended
  const suggestedPump = useMemo(() => {
    const suitable = sortedHeatPumps.find(p => p.power >= recommendedPower);
    // If no pump meets requirements, suggest the most powerful one
    return suitable || (sortedHeatPumps.length > 0 ? sortedHeatPumps[sortedHeatPumps.length - 1] : null);
  }, [sortedHeatPumps, recommendedPower]);
  
  // Get alternatives (2 more powerful options than suggested)
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

  const handleNext = () => {
    const items: OfferItem[] = Object.values(selectedItems).map(product => ({
      id: `auto-${product.id}`,
      product,
      quantity: 1,
    }));
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'automatyka',
        data: { ...sections.automatyka, items },
      },
    });
    
    onNext();
  };

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Cpu className="w-5 h-5 text-primary" />
        Automatyka i sterowanie
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Heating */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            Ogrzewanie
          </h3>
          
          {/* Recommended power info */}
          <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-accent mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Zalecana moc dla {volume.toFixed(0)} m³</p>
                <p className="text-muted-foreground">
                  Min. ~{recommendedPower} kW
                </p>
              </div>
            </div>
          </div>
          
          {/* Suggested heat pump */}
          {suggestedPump && (
            <div className="mb-4">
              <p className="text-xs text-accent mb-2 uppercase tracking-wide">Sugerowana</p>
              <ProductCard
                product={suggestedPump}
                isSelected={!!selectedItems[suggestedPump.id]}
                isSuggested
                onSelect={() => toggleProduct(suggestedPump)}
              />
            </div>
          )}
          
          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Alternatywy (większa moc)</p>
              <div className="space-y-2">
                {alternatives.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={!!selectedItems[product.id]}
                    onSelect={() => toggleProduct(product)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Search all heating products */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Szukaj dowolnej pompy</p>
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
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && dbHeatPumps.length === 0 && !searchQuery && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak pomp ciepła w bazie danych
            </p>
          )}
        </div>
      </div>

      <div className="p-4 mt-4 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
        <p>
          <strong>Wskazówka:</strong> Sterownik PCS zapewnia pełną automatyzację obsługi basenu - 
          kontrola pH, chloru, temperatury i więcej. Zarządzanie przez internet.
        </p>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button onClick={handleNext} className="btn-primary px-8">
          Dalej: Podsumowanie
        </Button>
      </div>
    </div>
  );
}
