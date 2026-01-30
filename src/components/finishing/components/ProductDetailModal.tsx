import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, ImageOff } from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { ProductGridItem } from './ProductGrid';

interface ProductDetailModalProps {
  product: ProductGridItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (productId: string) => void;
  isSelected: boolean;
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onSelect,
  isSelected,
}: ProductDetailModalProps) {
  if (!product) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Image */}
          <div className="relative h-48 rounded-lg overflow-hidden bg-muted">
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
                <ImageOff className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>
          
          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Symbol</span>
              <span className="font-medium">{product.symbol}</span>
            </div>
            
            <Separator />
            
            {product.manufacturer && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Producent</span>
                  <span className="font-medium">{product.manufacturer}</span>
                </div>
                <Separator />
              </>
            )}
            
            {product.series && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Seria</span>
                  <span className="font-medium">{product.series}</span>
                </div>
                <Separator />
              </>
            )}
            
            {product.shade && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kolor</span>
                  <div className="flex items-center gap-2">
                    {product.extractedHex && (
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: product.extractedHex }}
                      />
                    )}
                    <span className="font-medium">{product.shade}</span>
                  </div>
                </div>
                <Separator />
              </>
            )}
            
            {product.foilWidth && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Szerokość rolki</span>
                  <Badge variant="secondary">{product.foilWidth}m</Badge>
                </div>
                <Separator />
              </>
            )}
            
            {product.foilCategory && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kategoria</span>
                  <Badge variant="outline">{product.foilCategory}</Badge>
                </div>
                <Separator />
              </>
            )}
            
            <div className="flex items-center justify-between pt-2">
              <span className="text-lg font-semibold">Cena</span>
              <span className="text-xl font-bold text-primary">
                {formatPrice(product.price)} zł/m²
              </span>
            </div>
          </div>
          
          {/* Action button */}
          <Button
            className="w-full"
            onClick={() => onSelect(product.id)}
            variant={isSelected ? 'secondary' : 'default'}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Wybrany
              </>
            ) : (
              'Wybierz produkt'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
