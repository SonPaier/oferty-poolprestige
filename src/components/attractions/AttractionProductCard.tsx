import { useState } from 'react';
import { Plus, Minus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttractionProduct, getAttractionPriceInPLN, useAttractionProductImage } from '@/hooks/useAttractionProducts';
import { ProductInfoDialog } from '@/components/ProductInfoDialog';
import { cn } from '@/lib/utils';

interface AttractionProductCardProps {
  product: AttractionProduct;
  isSelected: boolean;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

export function AttractionProductCard({
  product,
  isSelected,
  quantity,
  onAdd,
  onRemove,
  onQuantityChange,
}: AttractionProductCardProps) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const { data: imageUrl } = useAttractionProductImage(product.id);
  const priceInPLN = getAttractionPriceInPLN(product);

  const formattedPrice = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceInPLN);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInfoDialogOpen(true);
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 p-2 rounded-lg border transition-all',
          isSelected
            ? 'bg-primary/10 border-primary shadow-sm'
            : 'bg-card hover:bg-accent/50 border-border'
        )}
      >
        {/* Image */}
        <div className="h-20 w-20 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-mono">{product.symbol}</p>
          <p 
            className="text-sm font-medium truncate cursor-pointer hover:text-primary hover:underline"
            onClick={handleTitleClick}
            title="Kliknij aby zobaczyć szczegóły"
          >
            {product.name}
          </p>
          <p className="text-sm font-bold text-primary">{formattedPrice}</p>
        </div>

        {/* Actions */}
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {isSelected ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onQuantityChange(quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-6 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onQuantityChange(quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ProductInfoDialog
        product={product}
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
      />
    </>
  );
}
