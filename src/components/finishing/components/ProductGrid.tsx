import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Info, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/calculations';
import { ProductDetailModal } from './ProductDetailModal';

export interface ProductGridItem {
  id: string;
  name: string;
  symbol: string;
  price: number;
  currency: string;
  imageUrl?: string;
  shade?: string;
  manufacturer?: string;
  series?: string;
  foilCategory?: string;
  foilWidth?: number;
  extractedHex?: string;
}

interface ProductGridProps {
  products: ProductGridItem[];
  selectedProductId: string | null;
  onSelect: (productId: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function ProductGrid({
  products,
  selectedProductId,
  onSelect,
  isLoading = false,
  emptyMessage = 'Nie znaleziono produktów',
  columns = 3,
}: ProductGridProps) {
  const [detailProduct, setDetailProduct] = useState<ProductGridItem | null>(null);
  
  if (isLoading) {
    return (
      <div className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-32 w-full" />
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ImageOff className="w-12 h-12 mb-4" />
        <p>{emptyMessage}</p>
      </div>
    );
  }
  
  return (
    <>
      <div className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}>
        {products.map((product) => {
          const isSelected = selectedProductId === product.id;
          
          return (
            <Card
              key={product.id}
              className={cn(
                "overflow-hidden cursor-pointer transition-all hover:shadow-md group",
                isSelected && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => onSelect(product.id)}
            >
              {/* Image */}
              <div className="relative h-32 bg-muted">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : product.extractedHex ? (
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: product.extractedHex }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                
                {/* Info button */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailProduct(product);
                  }}
                >
                  <Info className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Content */}
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-sm truncate" title={product.name}>
                      {product.name}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.symbol}
                    </p>
                  </div>
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {product.shade && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {product.shade}
                    </Badge>
                  )}
                  {product.foilWidth && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {product.foilWidth}m
                    </Badge>
                  )}
                  {product.manufacturer && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {product.manufacturer}
                    </Badge>
                  )}
                </div>
                
                {/* Price */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-primary">
                    {formatPrice(product.price)} zł/m²
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Detail modal */}
      <ProductDetailModal
        product={detailProduct}
        isOpen={detailProduct !== null}
        onClose={() => setDetailProduct(null)}
        onSelect={(id) => {
          onSelect(id);
          setDetailProduct(null);
        }}
        isSelected={detailProduct?.id === selectedProductId}
      />
    </>
  );
}
