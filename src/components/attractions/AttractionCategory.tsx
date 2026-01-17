import { useState, useMemo } from 'react';
import { Search, Loader2, LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AttractionProductCard } from './AttractionProductCard';
import { useAttractionProducts, AttractionSubcategory } from '@/hooks/useAttractionProducts';
import { useDebounce } from '@/hooks/useDebounce';

interface AttractionCategoryProps {
  subcategory: AttractionSubcategory;
  title: string;
  icon: LucideIcon;
  isProductSelected: (productId: string) => boolean;
  getProductQuantity: (productId: string) => number;
  onAddProduct: (product: any) => void;
  onRemoveProduct: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
}

export function AttractionCategory({
  subcategory,
  title,
  icon: Icon,
  isProductSelected,
  getProductQuantity,
  onAddProduct,
  onRemoveProduct,
  onQuantityChange,
}: AttractionCategoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: products, isLoading, error } = useAttractionProducts(
    subcategory,
    debouncedSearch,
    10
  );

  const hasProducts = products && products.length > 0;

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Products Grid */}
      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-sm text-destructive">
            Błąd ładowania produktów
          </div>
        ) : !hasProducts ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {debouncedSearch ? 'Brak wyników' : 'Brak produktów w tej kategorii'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {products.map((product) => (
              <AttractionProductCard
                key={product.id}
                product={product}
                isSelected={isProductSelected(product.id)}
                quantity={getProductQuantity(product.id)}
                onAdd={() => onAddProduct(product)}
                onRemove={() => onRemoveProduct(product.id)}
                onQuantityChange={(qty) => onQuantityChange(product.id, qty)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
