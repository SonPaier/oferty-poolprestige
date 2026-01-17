import { Droplets, Waves, Sparkles, Wind } from 'lucide-react';
import { AttractionCategory } from './AttractionCategory';
import { useAttractionsSelection } from '@/hooks/useAttractionsSelection';
import { AttractionSubcategory } from '@/hooks/useAttractionProducts';

const ATTRACTION_CATEGORIES: {
  id: AttractionSubcategory;
  name: string;
  icon: typeof Droplets;
}[] = [
  { id: 'prysznice', name: 'Prysznice strumieniowe', icon: Droplets },
  { id: 'przeciwprady', name: 'Przeciwprądy', icon: Waves },
  { id: 'masaz_wodny', name: 'Masaże wodne', icon: Sparkles },
  { id: 'masaz_powietrzny', name: 'Masaże powietrzne', icon: Wind },
];

export function AttractionsGrid() {
  const {
    addProduct,
    removeProduct,
    updateQuantity,
    isProductSelected,
    getProductQuantity,
  } = useAttractionsSelection();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[600px]">
      {ATTRACTION_CATEGORIES.map((category) => (
        <AttractionCategory
          key={category.id}
          subcategory={category.id}
          title={category.name}
          icon={category.icon}
          isProductSelected={isProductSelected}
          getProductQuantity={getProductQuantity}
          onAddProduct={addProduct}
          onRemoveProduct={removeProduct}
          onQuantityChange={updateQuantity}
        />
      ))}
    </div>
  );
}
