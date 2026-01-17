import { Plus, Minus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttractionProduct, getAttractionPriceInPLN, useAttractionProductImage } from '@/hooks/useAttractionProducts';
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
  const { data: imageUrl } = useAttractionProductImage(product.id);
  const priceInPLN = getAttractionPriceInPLN(product);

  const formattedPrice = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceInPLN);

  return (
    <div
      className={cn(
        'relative p-3 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'bg-primary/10 border-primary shadow-sm'
          : 'bg-card hover:bg-accent/50 border-border'
      )}
      onClick={() => !isSelected && onAdd()}
    >
      {/* Image */}
      <div className="aspect-square w-full mb-2 rounded-md overflow-hidden bg-muted flex items-center justify-center">
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
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-mono">{product.symbol}</p>
        <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
        <p className="text-sm font-bold text-primary">{formattedPrice}</p>
      </div>

      {/* Actions */}
      {isSelected ? (
        <div className="mt-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onQuantityChange(quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium px-3">{quantity}</span>
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
          className="w-full mt-2"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Dodaj
        </Button>
      )}
    </div>
  );
}
