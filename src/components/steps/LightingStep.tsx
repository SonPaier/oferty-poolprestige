import { useState, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Lightbulb, Info } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { calculateLightingRecommendation, formatPrice } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';

interface LightingStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function LightingStep({ onNext, onBack }: LightingStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections } = state;
  
  const surfaceArea = calculations?.surfaceArea || 32;
  const lightingRec = calculateLightingRecommendation(surfaceArea);
  
  const lightingProducts = products.filter(p => p.category === 'oswietlenie');
  
  // Separate lamps and bulbs, sort by price
  const lamps = useMemo(() => {
    return lightingProducts
      .filter(p => p.name.toLowerCase().includes('lampa'))
      .sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
  }, [lightingProducts]);
  
  const bulbs = useMemo(() => {
    return lightingProducts
      .filter(p => p.name.toLowerCase().includes('żarówka'))
      .sort((a, b) => getPriceInPLN(a) - getPriceInPLN(b));
  }, [lightingProducts]);

  // Cheapest lamp is first (index 0) after sorting
  const cheapestLamp = lamps[0];
  
  const [selectedLamp, setSelectedLamp] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedBulb, setSelectedBulb] = useState<{ product: Product; quantity: number } | null>(null);

  const handleLampSelect = (product: Product) => {
    setSelectedLamp(prev => 
      prev?.product.id === product.id ? null : { product, quantity: lightingRec.count }
    );
  };

  const handleBulbSelect = (product: Product) => {
    setSelectedBulb(prev => 
      prev?.product.id === product.id ? null : { product, quantity: lightingRec.count }
    );
  };

  const handleNext = () => {
    const items: OfferItem[] = [];
    
    if (selectedLamp) {
      items.push({
        id: `lamp-${selectedLamp.product.id}`,
        product: selectedLamp.product,
        quantity: selectedLamp.quantity,
      });
    }
    
    if (selectedBulb) {
      items.push({
        id: `bulb-${selectedBulb.product.id}`,
        product: selectedBulb.product,
        quantity: selectedBulb.quantity,
      });
    }
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'oswietlenie',
        data: { ...sections.oswietlenie, items },
      },
    });
    
    onNext();
  };

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
              Liczba lamp: {lightingRec.count} szt. | Zalecana moc: {lightingRec.wattage}W
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lamps */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4">Oprawy oświetleniowe</h3>
          <div className="space-y-3">
            {lamps.map((product, index) => {
              const isCheapest = index === 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedLamp?.product.id === product.id}
                  isSuggested={isCheapest}
                  quantity={selectedLamp?.product.id === product.id ? selectedLamp.quantity : lightingRec.count}
                  onSelect={() => handleLampSelect(product)}
                  onQuantityChange={(qty) => setSelectedLamp(prev => 
                    prev ? { ...prev, quantity: qty } : null
                  )}
                  badge={isCheapest ? 'Najtańsza' : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* Bulbs */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4">Żarówki LED</h3>
          <div className="space-y-3">
            {bulbs.map((product, index) => {
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
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button onClick={handleNext} className="btn-primary px-8">
          Dalej: Automatyka
        </Button>
      </div>
    </div>
  );
}
