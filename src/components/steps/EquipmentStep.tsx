import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Gauge, Info } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { calculateHydraulics } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';

interface EquipmentStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function EquipmentStep({ onNext, onBack }: EquipmentStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections } = state;
  
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

  const [selectedItems, setSelectedItems] = useState<Record<string, { product: Product; quantity: number }>>({});

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
    recommended: number,
    icon?: React.ReactNode
  ) => (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium flex items-center gap-2">
          {icon}
          {title}
        </h4>
        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
          Zalecane: {recommended} szt.
        </span>
      </div>
      <div className="space-y-2">
        {productList.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            isSelected={!!selectedItems[product.id]}
            isSuggested={index === 0}
            quantity={selectedItems[product.id]?.quantity || recommended}
            onSelect={() => toggleProduct(product, recommended)}
            onQuantityChange={(qty) => updateQuantity(product.id, qty)}
            compact
          />
        ))}
      </div>
    </div>
  );

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
              Dysze: {hydraulics.nozzles} szt. | Odpływy: {hydraulics.drains} szt. | Skimmery: {hydraulics.skimmers} szt.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderProductGroup('Dysze napływowe', nozzles, hydraulics.nozzles)}
        {renderProductGroup('Skimmery', skimmers, hydraulics.skimmers)}
        {renderProductGroup('Odpływy denne', drains, hydraulics.drains)}
        {renderProductGroup('Dysze denne', bottomNozzles, 1)}
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
