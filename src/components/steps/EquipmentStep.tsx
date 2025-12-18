import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Gauge, Info, AlertCircle } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { calculateHydraulics } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';

interface EquipmentStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function EquipmentStep({ onNext, onBack }: EquipmentStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections, dimensions } = state;
  
  const isSkimmerPool = dimensions.overflowType === 'skimmerowy';
  
  const equipmentProducts = products.filter(p => p.category === 'uzbrojenie');
  
  const nozzles = equipmentProducts.filter(p => 
    p.name.toLowerCase().includes('dysza') && !p.name.toLowerCase().includes('denna')
  );
  const drains = equipmentProducts.filter(p => 
    p.name.toLowerCase().includes('odpływ') || p.name.toLowerCase().includes('kratka')
  );
  const skimmers = equipmentProducts.filter(p => 
    p.name.toLowerCase().includes('skimmer')
  );
  const bottomNozzles = equipmentProducts.filter(p => 
    p.name.toLowerCase().includes('denna') && p.name.toLowerCase().includes('dysza')
  );

  const hydraulics = calculations ? 
    calculateHydraulics(calculations.volume, calculations.requiredFlow) : 
    { nozzles: 2, drains: 1, skimmers: 1 };

  // Override: drains default to 1, skimmers only for gutter (rynnowy) pools
  const defaultDrains = 1;
  const defaultSkimmers = isSkimmerPool ? 0 : hydraulics.skimmers;

  const [selectedItems, setSelectedItems] = useState<Record<string, { product: Product; quantity: number }>>({});
  
  // Manual quantity overrides
  const [manualQuantities, setManualQuantities] = useState({
    nozzles: hydraulics.nozzles,
    drains: defaultDrains,
    skimmers: defaultSkimmers,
    bottomNozzles: 1,
  });

  useEffect(() => {
    // Initialize with existing items
    const existing: Record<string, { product: Product; quantity: number }> = {};
    sections.uzbrojenie.items.forEach(item => {
      existing[item.product.id] = { product: item.product, quantity: item.quantity };
    });
    setSelectedItems(existing);
  }, []);

  const toggleProduct = (product: Product, defaultQuantity: number = 1) => {
    setSelectedItems(prev => {
      if (prev[product.id]) {
        const { [product.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [product.id]: { product, quantity: defaultQuantity } };
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: Math.max(1, quantity) },
    }));
  };

  const handleNext = () => {
    const items: OfferItem[] = Object.entries(selectedItems).map(([id, { product, quantity }]) => ({
      id: `equip-${id}`,
      product,
      quantity,
    }));
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'uzbrojenie',
        data: { ...sections.uzbrojenie, items },
      },
    });
    
    onNext();
  };

  const renderProductGroup = (
    title: string, 
    productList: Product[], 
    quantityKey: keyof typeof manualQuantities,
    icon?: React.ReactNode,
    disabled?: boolean,
    disabledMessage?: string
  ) => {
    const recommendedQty = manualQuantities[quantityKey];
    
    if (disabled) {
      return (
        <div className="glass-card p-4 opacity-60">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              {icon}
              {title}
            </h4>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="w-4 h-4" />
            <p>{disabledMessage}</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            {icon}
            {title}
          </h4>
          <div className="flex items-center gap-2">
            <Label htmlFor={`qty-${quantityKey}`} className="text-xs text-muted-foreground">Ilość:</Label>
            <Input
              id={`qty-${quantityKey}`}
              type="number"
              min={0}
              value={recommendedQty}
              onChange={(e) => setManualQuantities(prev => ({
                ...prev,
                [quantityKey]: parseInt(e.target.value) || 0
              }))}
              className="w-16 h-8 text-center"
            />
          </div>
        </div>
        <div className="space-y-2">
          {productList.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              isSelected={!!selectedItems[product.id]}
              isSuggested={index === 0}
              quantity={selectedItems[product.id]?.quantity || recommendedQty}
              onSelect={() => toggleProduct(product, recommendedQty)}
              onQuantityChange={(qty) => updateQuantity(product.id, qty)}
              compact
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Gauge className="w-5 h-5 text-primary" />
        Uzbrojenie niecki
      </div>

      <div className="mb-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-accent mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Zalecenia dla Twojego basenu ({calculations?.volume.toFixed(1)} m³)</p>
            <p className="text-muted-foreground">
              Dysze: {hydraulics.nozzles} szt. | Odpływy denne: {defaultDrains} szt. 
              {!isSkimmerPool && ` | Skimmery: ${hydraulics.skimmers} szt.`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Typ przelewu: <span className="font-medium">{isSkimmerPool ? 'Skimmerowy' : 'Rynnowy'}</span>
              {isSkimmerPool && ' (skimmery niedostępne)'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderProductGroup('Dysze napływowe', nozzles, 'nozzles')}
        {renderProductGroup(
          'Skimmery', 
          skimmers, 
          'skimmers',
          undefined,
          isSkimmerPool,
          'Skimmery dostępne tylko dla basenów rynnowych'
        )}
        {renderProductGroup('Odpływy denne', drains, 'drains')}
        {renderProductGroup('Dysze denne', bottomNozzles, 'bottomNozzles')}
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button onClick={handleNext} className="btn-primary px-8">
          Dalej: Filtracja
        </Button>
      </div>
    </div>
  );
}
