import { useState } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Cpu, Thermometer } from 'lucide-react';
import { products, Product } from '@/data/products';
import { OfferItem } from '@/types/configurator';

interface AutomationStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function AutomationStep({ onNext, onBack }: AutomationStepProps) {
  const { state, dispatch } = useConfigurator();
  const { sections } = state;
  
  const automationProducts = products.filter(p => p.category === 'automatyka');
  const controllers = automationProducts.filter(p => 
    p.name.toLowerCase().includes('sterownik') || 
    p.name.toLowerCase().includes('automat')
  );
  const heating = automationProducts.filter(p => 
    p.name.toLowerCase().includes('pompa ciepła') ||
    p.name.toLowerCase().includes('wymiennik') ||
    p.subcategory === 'grzanie'
  );

  const [selectedItems, setSelectedItems] = useState<Record<string, Product>>({});

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
          <div className="space-y-3">
            {heating.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={!!selectedItems[product.id]}
                isSuggested={index === 0}
                onSelect={() => toggleProduct(product)}
              />
            ))}
          </div>
          
          {heating.length === 0 && (
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
