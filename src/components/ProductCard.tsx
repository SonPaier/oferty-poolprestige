import { Product, getPriceInPLN } from '@/data/products';
import { formatPrice } from '@/lib/calculations';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  isSelected?: boolean;
  isSuggested?: boolean;
  quantity?: number;
  onSelect: () => void;
  onQuantityChange?: (quantity: number) => void;
  compact?: boolean;
}

export function ProductCard({
  product,
  isSelected = false,
  isSuggested = false,
  quantity = 1,
  onSelect,
  onQuantityChange,
  compact = false,
}: ProductCardProps) {
  const price = getPriceInPLN(product);

  if (compact) {
    return (
      <div
        onClick={onSelect}
        className={cn(
          "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
          isSelected 
            ? "bg-primary/10 border border-primary" 
            : "bg-muted/30 border border-border hover:border-primary/40"
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.symbol}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary">
            {formatPrice(price)}
          </span>
          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "product-card relative",
        isSelected && "selected",
        isSuggested && !isSelected && "ring-1 ring-accent/50"
      )}
      onClick={onSelect}
    >
      {isSuggested && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-accent text-accent-foreground text-xs font-medium rounded-full">
          Sugerowany
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-sm leading-tight">{product.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{product.symbol}</p>
        </div>
        
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}
        
        {product.specs && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(product.specs).slice(0, 3).map(([key, value]) => (
              <span 
                key={key}
                className="px-2 py-0.5 bg-muted/50 text-xs rounded"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-lg font-bold text-primary">
            {formatPrice(price)}
          </span>
          
          {isSelected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange?.(Math.max(1, quantity - 1));
                }}
                className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted/70"
              >
                -
              </button>
              <span className="text-sm font-medium w-6 text-center">{quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange?.(quantity + 1);
                }}
                className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted/70"
              >
                +
              </button>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
