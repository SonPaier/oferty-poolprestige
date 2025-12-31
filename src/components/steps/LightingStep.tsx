import { useState, useMemo, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { ProductCard } from '@/components/ProductCard';
import { Lightbulb, Info, Lamp } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { calculateLightingRecommendation } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface LightingStepProps {
  onNext: () => void;
  onBack: () => void;
}

type BulbColorType = 'biala-cieple' | 'biala-zimne' | 'rgb' | 'dmx';

const bulbColorLabels: Record<BulbColorType, string> = {
  'biala-cieple': 'Biała ciepła',
  'biala-zimne': 'Biała zimna',
  'rgb': 'RGB',
  'dmx': 'DMX',
};

export function LightingStep({ onNext, onBack }: LightingStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections, dimensions } = state;
  
  const surfaceArea = calculations?.surfaceArea || 32;
  const lightingRec = calculateLightingRecommendation(surfaceArea);
  
  const hasStairs = dimensions.customStairsVertices && dimensions.customStairsVertices.length > 2;
  const hasWadingPool = dimensions.customWadingPoolVertices && dimensions.customWadingPoolVertices.length > 2;
  
  const lightingProducts = products.filter(p => p.category === 'oswietlenie');
  
  // Separate large lamps and small lamps
  const largeLamps = useMemo(() => {
    return lightingProducts
      .filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('lampa') && !name.includes('mini') && !name.includes('mała');
      })
      .sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
  }, [lightingProducts]);
  
  const smallLamps = useMemo(() => {
    return lightingProducts
      .filter(p => {
        const name = p.name.toLowerCase();
        return name.includes('mini') || name.includes('mała') || name.includes('spot');
      })
      .sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
  }, [lightingProducts]);
  
  // Categorize bulbs by color type
  const categorizeBulb = (bulb: Product): BulbColorType => {
    const name = bulb.name.toLowerCase();
    if (name.includes('dmx')) return 'dmx';
    if (name.includes('rgb')) return 'rgb';
    if (name.includes('zimn') || name.includes('cold')) return 'biala-zimne';
    return 'biala-cieple';
  };
  
  const allBulbs = useMemo(() => {
    return lightingProducts.filter(p => p.name.toLowerCase().includes('żarówka'));
  }, [lightingProducts]);
  
  const [bulbColorFilter, setBulbColorFilter] = useState<BulbColorType | 'all'>('all');
  
  const filteredBulbs = useMemo(() => {
    if (bulbColorFilter === 'all') {
      return allBulbs.sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
    }
    return allBulbs
      .filter(b => categorizeBulb(b) === bulbColorFilter)
      .sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
  }, [allBulbs, bulbColorFilter]);

  // State for selections
  const [selectedLargeLamp, setSelectedLargeLamp] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedBulb, setSelectedBulb] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedSmallLamp, setSelectedSmallLamp] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedSmallBulb, setSelectedSmallBulb] = useState<{ product: Product; quantity: number } | null>(null);

  // Calculate recommended small lamp count (1 per stair set + 1 per wading pool)
  const smallLampCount = (hasStairs ? 2 : 0) + (hasWadingPool ? 2 : 0);

  const handleLargeLampSelect = (product: Product) => {
    setSelectedLargeLamp(prev => 
      prev?.product.id === product.id ? null : { product, quantity: lightingRec.count }
    );
  };

  const handleBulbSelect = (product: Product) => {
    setSelectedBulb(prev => 
      prev?.product.id === product.id ? null : { product, quantity: lightingRec.count }
    );
  };

  const handleSmallLampSelect = (product: Product) => {
    setSelectedSmallLamp(prev => 
      prev?.product.id === product.id ? null : { product, quantity: smallLampCount || 2 }
    );
  };

  const handleSmallBulbSelect = (product: Product) => {
    setSelectedSmallBulb(prev => 
      prev?.product.id === product.id ? null : { product, quantity: smallLampCount || 2 }
    );
  };

  // Auto-save section when selections change
  useEffect(() => {
    const items: OfferItem[] = [];
    
    if (selectedLargeLamp) {
      items.push({
        id: `lamp-large-${selectedLargeLamp.product.id}`,
        product: selectedLargeLamp.product,
        quantity: selectedLargeLamp.quantity,
      });
    }
    
    if (selectedBulb) {
      items.push({
        id: `bulb-large-${selectedBulb.product.id}`,
        product: selectedBulb.product,
        quantity: selectedBulb.quantity,
      });
    }
    
    if (selectedSmallLamp) {
      items.push({
        id: `lamp-small-${selectedSmallLamp.product.id}`,
        product: selectedSmallLamp.product,
        quantity: selectedSmallLamp.quantity,
      });
    }
    
    if (selectedSmallBulb) {
      items.push({
        id: `bulb-small-${selectedSmallBulb.product.id}`,
        product: selectedSmallBulb.product,
        quantity: selectedSmallBulb.quantity,
      });
    }
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'oswietlenie',
        data: { ...sections.oswietlenie, items },
      },
    });
  }, [selectedLargeLamp, selectedBulb, selectedSmallLamp, selectedSmallBulb]);

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Lightbulb className="w-5 h-5 text-primary" />
        Oświetlenie
      </div>

      <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-accent mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Zalecenia dla basenu {surfaceArea.toFixed(0)} m²</p>
            <p className="text-muted-foreground">
              Lampy duże: {lightingRec.count} szt. | Zalecana moc: {lightingRec.wattage}W
              {smallLampCount > 0 && ` | Lampy małe (schody/brodzik): ${smallLampCount} szt.`}
            </p>
          </div>
        </div>
      </div>

      {/* Large lamps section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lamp className="w-5 h-5 text-primary" />
          Lampy duże (główne)
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Large Lamps */}
          <div className="glass-card p-6">
            <h4 className="text-base font-medium mb-4">Oprawy oświetleniowe</h4>
            <div className="space-y-3">
              {largeLamps.slice(0, 6).map((product, index) => {
                const isCheapest = index === 0;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedLargeLamp?.product.id === product.id}
                    isSuggested={isCheapest}
                    quantity={selectedLargeLamp?.product.id === product.id ? selectedLargeLamp.quantity : lightingRec.count}
                    onSelect={() => handleLargeLampSelect(product)}
                    onQuantityChange={(qty) => setSelectedLargeLamp(prev => 
                      prev ? { ...prev, quantity: qty } : null
                    )}
                    badge={isCheapest ? 'Najtańsza' : undefined}
                  />
                );
              })}
            </div>
          </div>

          {/* Bulbs for large lamps */}
          <div className="glass-card p-6">
            <h4 className="text-base font-medium mb-4">Żarówki LED</h4>
            
            {/* Bulb color filter */}
            <div className="mb-4">
              <Label className="mb-2 block text-sm">Filtruj wg koloru:</Label>
              <RadioGroup
                value={bulbColorFilter}
                onValueChange={(v) => setBulbColorFilter(v as BulbColorType | 'all')}
                className="flex flex-wrap gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="bulb-all" />
                  <Label htmlFor="bulb-all" className="cursor-pointer text-sm">Wszystkie</Label>
                </div>
                {(Object.keys(bulbColorLabels) as BulbColorType[]).map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`bulb-${type}`} />
                    <Label htmlFor={`bulb-${type}`} className="cursor-pointer text-sm">
                      {bulbColorLabels[type]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="space-y-3">
              {filteredBulbs.slice(0, 6).map((product, index) => {
                const isCheapest = index === 0;
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedBulb?.product.id === product.id}
                    isSuggested={isCheapest}
                    quantity={selectedBulb?.product.id === product.id ? selectedBulb.quantity : lightingRec.count}
                    onSelect={() => handleBulbSelect(product)}
                    onQuantityChange={(qty) => setSelectedBulb(prev => 
                      prev ? { ...prev, quantity: qty } : null
                    )}
                    badge={isCheapest ? 'Najtańsza' : undefined}
                    compact
                  />
                );
              })}
              {filteredBulbs.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  Brak żarówek dla wybranego koloru
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Small lamps section (for stairs and wading pool) */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lamp className="w-4 h-4 text-accent" />
          Lampy małe (schody, brodzik)
        </h3>
        
        {smallLampCount > 0 || true ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Small Lamps */}
            <div className="glass-card p-6">
              <h4 className="text-base font-medium mb-4">Oprawy małe / spot</h4>
              {smallLamps.length > 0 ? (
                <div className="space-y-3">
                  {smallLamps.slice(0, 5).map((product, index) => {
                    const isCheapest = index === 0;
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isSelected={selectedSmallLamp?.product.id === product.id}
                        isSuggested={isCheapest}
                        quantity={selectedSmallLamp?.product.id === product.id ? selectedSmallLamp.quantity : smallLampCount || 2}
                        onSelect={() => handleSmallLampSelect(product)}
                        onQuantityChange={(qty) => setSelectedSmallLamp(prev => 
                          prev ? { ...prev, quantity: qty } : null
                        )}
                        badge={isCheapest ? 'Najtańsza' : undefined}
                        compact
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  Brak małych lamp w bazie. Możesz użyć lamp dużych.
                </p>
              )}
            </div>

            {/* Small Bulbs */}
            <div className="glass-card p-6">
              <h4 className="text-base font-medium mb-4">Żarówki do małych lamp</h4>
              <div className="space-y-3">
                {filteredBulbs.slice(0, 4).map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedSmallBulb?.product.id === product.id}
                    quantity={selectedSmallBulb?.product.id === product.id ? selectedSmallBulb.quantity : smallLampCount || 2}
                    onSelect={() => handleSmallBulbSelect(product)}
                    onQuantityChange={(qty) => setSelectedSmallBulb(prev => 
                      prev ? { ...prev, quantity: qty } : null
                    )}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card p-6">
            <p className="text-center text-muted-foreground">
              Brak schodów i brodzika - lampy małe nie są wymagane.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
