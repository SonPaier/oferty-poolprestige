import { useState, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Cpu, Thermometer, Search, Info } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { OfferItem } from '@/types/configurator';
import { formatPrice } from '@/lib/calculations';

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
  
  // All heating products (heat pumps and heat exchangers)
  const allHeating = automationProducts.filter(p => 
    p.name.toLowerCase().includes('pompa ciepła') ||
    p.name.toLowerCase().includes('wymiennik') ||
    p.subcategory === 'grzanie'
  );
  
  // Get heat pumps specifically
  const heatPumps = allHeating.filter(p => 
    p.name.toLowerCase().includes('pompa ciepła')
  );
  
  // Sort heat pumps by power (extract from name or specs)
  const sortedHeatPumps = [...heatPumps].sort((a, b) => {
    const powerA = a.specs?.moc as number || 0;
    const powerB = b.specs?.moc as number || 0;
    return powerA - powerB;
  });
  
  // Find suggested pump (closest to recommended power)
  const suggestedPump = sortedHeatPumps.find(p => {
    const power = p.specs?.moc as number || 0;
    return power >= recommendedPower;
  }) || sortedHeatPumps[sortedHeatPumps.length - 1];
  
  // Get alternatives (2 higher power options)
  const suggestedIndex = sortedHeatPumps.findIndex(p => p.id === suggestedPump?.id);
  const alternatives = sortedHeatPumps.slice(suggestedIndex + 1, suggestedIndex + 3);

  const [selectedItems, setSelectedItems] = useState<Record<string, Product>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter heating products by search
  const filteredHeating = useMemo(() => {
    if (!searchQuery.trim()) return allHeating;
    const query = searchQuery.toLowerCase();
    return allHeating.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.symbol.toLowerCase().includes(query)
    );
  }, [allHeating, searchQuery]);

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
                {filteredHeating.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={!!selectedItems[product.id]}
                    onSelect={() => toggleProduct(product)}
                    compact
                  />
                ))}
                {filteredHeating.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Brak wyników dla "{searchQuery}"
                  </p>
                )}
              </div>
            )}
          </div>
          
          {allHeating.length === 0 && !searchQuery && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Brak produktów w tej kategorii
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
