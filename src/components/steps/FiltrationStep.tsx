import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Filter, Droplets, Info, Zap, Calculator } from 'lucide-react';
import { products, Product } from '@/data/products';
import { selectPump, selectFilter, formatPrice } from '@/lib/calculations';
import { OfferItem, nominalLoadByType, poolTypeLabels } from '@/types/configurator';

interface FiltrationStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FiltrationStep({ onNext, onBack }: FiltrationStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections, dimensions, poolType } = state;
  
  const requiredFlow = calculations?.requiredFlow || 15;
  const volume = calculations?.volume || 0;
  const nominalLoad = nominalLoadByType[poolType];
  const attractions = poolType === 'hotelowy' ? dimensions.attractions : 0;
  
  const pumpSelection = selectPump(requiredFlow);
  const filterSelection = selectFilter(requiredFlow);
  
  const [selectedPump, setSelectedPump] = useState<Product | null>(
    pumpSelection.suggested || null
  );
  const [selectedFilter, setSelectedFilter] = useState<Product | null>(
    filterSelection.suggested || null
  );
  
  const filterMedia = products.filter(p => 
    p.category === 'materialy' && p.subcategory === 'zloze'
  );
  const [selectedMedia, setSelectedMedia] = useState<Product | null>(filterMedia[1] || null);
  const [mediaQuantity, setMediaQuantity] = useState(filterSelection.filterMediaKg / 25); // bags

  // Auto-save section when selections change
  useEffect(() => {
    const items: OfferItem[] = [];
    
    if (selectedPump) {
      items.push({
        id: `pump-${selectedPump.id}`,
        product: selectedPump,
        quantity: 1,
      });
    }
    
    if (selectedFilter) {
      items.push({
        id: `filter-${selectedFilter.id}`,
        product: selectedFilter,
        quantity: 1,
      });
    }
    
    if (selectedMedia) {
      items.push({
        id: `media-${selectedMedia.id}`,
        product: selectedMedia,
        quantity: Math.ceil(mediaQuantity),
      });
    }
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'filtracja',
        data: { ...sections.filtracja, items },
      },
    });
  }, [selectedPump, selectedFilter, selectedMedia, mediaQuantity]);

  // Build formula string for display
  const formulaBase = `(0,37 × ${volume.toFixed(1)}) / ${nominalLoad}`;
  const formulaAttractions = attractions > 0 ? ` + (6 × ${attractions})` : '';
  const formulaResult = requiredFlow.toFixed(1);

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Filter className="w-5 h-5 text-primary" />
        Filtracja
      </div>

      <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-start gap-2">
          <Droplets className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Wymagana wydajność: {requiredFlow.toFixed(1)} m³/h</p>
            <p className="text-sm text-muted-foreground">
              Złoże filtracyjne: ~{filterSelection.filterMediaKg} kg
            </p>
            
            {/* Formula display */}
            <div className="mt-2 pt-2 border-t border-primary/20">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calculator className="w-3 h-3" />
                <span>Formuła DIN:</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {formulaBase}{formulaAttractions} = <span className="text-primary font-semibold">{formulaResult} m³/h</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Typ basenu: {poolTypeLabels[poolType]} (obciążenie: {nominalLoad})
                {attractions > 0 && ` | Atrakcje: ${attractions}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pump selection */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Pompa obiegowa
          </h3>
          
          {pumpSelection.suggested && (
            <div className="mb-4">
              <p className="text-xs text-accent mb-2 uppercase tracking-wide">Sugerowana</p>
              <ProductCard
                product={pumpSelection.suggested}
                isSelected={selectedPump?.id === pumpSelection.suggested.id}
                isSuggested
                onSelect={() => setSelectedPump(pumpSelection.suggested!)}
              />
            </div>
          )}
          
          {pumpSelection.alternatives.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Alternatywy</p>
              <div className="space-y-2">
                {pumpSelection.alternatives.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedPump?.id === product.id}
                    onSelect={() => setSelectedPump(product)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter selection */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            Filtr
          </h3>
          
          {filterSelection.suggested && (
            <div className="mb-4">
              <p className="text-xs text-accent mb-2 uppercase tracking-wide">Sugerowany</p>
              <ProductCard
                product={filterSelection.suggested}
                isSelected={selectedFilter?.id === filterSelection.suggested.id}
                isSuggested
                onSelect={() => setSelectedFilter(filterSelection.suggested!)}
              />
            </div>
          )}
          
          {filterSelection.alternatives.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Alternatywy</p>
              <div className="space-y-2">
                {filterSelection.alternatives.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isSelected={selectedFilter?.id === product.id}
                    onSelect={() => setSelectedFilter(product)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter media */}
      <div className="glass-card p-6 mt-6">
        <h3 className="text-base font-medium mb-4">Złoże filtracyjne</h3>
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-accent" />
          <span className="text-sm text-muted-foreground">
            Wymagane: ~{filterSelection.filterMediaKg} kg ({Math.ceil(filterSelection.filterMediaKg / 25)} worków 25kg)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filterMedia.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={selectedMedia?.id === product.id}
              isSuggested={index === 1}
              quantity={Math.ceil(mediaQuantity)}
              onSelect={() => setSelectedMedia(product)}
              onQuantityChange={setMediaQuantity}
              compact
            />
          ))}
        </div>
      </div>

    </div>
  );
}
