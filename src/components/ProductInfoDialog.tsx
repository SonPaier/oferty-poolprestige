import { useState } from 'react';
import { Package, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProductEditDialog } from './ProductEditDialog';
import { useAttractionProductImage } from '@/hooks/useAttractionProducts';

interface ProductInfoDialogProps {
  product: {
    id: string;
    symbol: string;
    name: string;
    price: number;
    currency: string;
    description?: string | null;
    category?: string | null;
    subcategory?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductInfoDialog({ product, open, onOpenChange }: ProductInfoDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { data: imageUrl } = useAttractionProductImage(product?.id ?? null);

  if (!product) return null;

  const formattedPrice = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: product.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(product.price);

  // Convert to format expected by ProductEditDialog
  const productForEdit = {
    id: product.id,
    symbol: product.symbol,
    name: product.name,
    price: product.price,
    currency: product.currency as 'PLN' | 'EUR',
    description: product.description ?? null,
    category: product.category ?? null,
    subcategory: product.subcategory ?? null,
    stock_quantity: null,
    image_id: null,
    foil_category: null,
    foil_width: null,
    created_at: '',
    updated_at: '',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{product.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image */}
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            {/* Product details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Symbol:</span>
                <span className="font-mono text-sm">{product.symbol}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cena:</span>
                <span className="font-bold text-primary">{formattedPrice}</span>
              </div>

              {product.category && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Kategoria:</span>
                  <span className="text-sm">{product.category}</span>
                </div>
              )}

              {product.subcategory && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Podkategoria:</span>
                  <span className="text-sm">{product.subcategory}</span>
                </div>
              )}

              {product.description && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground block mb-1">Opis:</span>
                  <p className="text-sm">{product.description}</p>
                </div>
              )}
            </div>

            {/* Edit button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edytuj produkt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProductEditDialog
        product={productForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
